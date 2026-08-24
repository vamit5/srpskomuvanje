"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushToProfile } from "@/lib/push/send";

export interface DiscoveryCandidate {
  id: string;
  name: string;
  birth_date: string;
  city: string | null;
  bio: string | null;
  interests: string[];
  is_verified: boolean;
  hot_mode_enabled: boolean;
  primary_photo_url: string | null;
  score: number;
  distance_km: number | null;
}

export async function getMoreCandidates(limit = 15): Promise<{ candidates: DiscoveryCandidate[]; error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { candidates: [], error: "Nisi prijavljen/a." };

  const { data, error } = await supabase.rpc("discover_profiles", {
    viewer_id: user.id,
    result_limit: limit,
  });

  if (error) return { candidates: [], error: "Ne mogu da učitam profile. Pokušaj ponovo." };
  return { candidates: (data as DiscoveryCandidate[]) ?? [], error: null };
}

export type MuvajChoice = "upoznavanje" | "krevet" | "nista";

/**
 * Jedan od 3 izbora na profilnu sliku u Muvaj -- zamenjuje stari
 * like/super_like/pass model. "krevet" salje SLEP signal (primalac ne zna
 * ko je poslao dok ne plati/otkljuca -- vidi muvaj_reveal_krevet), ali
 * match nastaje NEZAVISNO od toga, cim postoji obostrano pozitivan izbor
 * (upoznavanje ILI krevet, u bilo kom smeru) -- vidi migraciju 0014.
 */
export async function chooseMuvaj(
  targetId: string,
  choice: MuvajChoice
): Promise<{ error: string | null; matched: boolean; matchId: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nisi prijavljen/a.", matched: false, matchId: null };

  const { data, error } = await supabase
    .rpc("muvaj_choose", { viewer_id: user.id, target_id: targetId, choice })
    .single();

  if (error) return { error: "Nešto nije u redu. Pokušaj ponovo.", matched: false, matchId: null };

  // Nema revalidatePath ovde namerno: /match je već potpuno dinamična ruta
  // (svaki put sveže čita bazu), pa revalidacija ne bi ništa promenila u
  // podacima -- samo bi terala Next.js da odmah iznova renderuje OVU
  // (/muvaj) rutu i pri tom resetuje lokalni state (match ekran).
  const result = data as { matched: boolean; match_id: string | null };

  if (result.matched) {
    const { data: me } = await supabase.from("profiles").select("name").eq("id", user.id).single();
    // after(): push se šalje POSLE što je odgovor već otišao korisniku koji
    // gleda "MATCH!" ekran (ne usporava njega), ali Next.js garantuje da se
    // izvrši do kraja i na serverless hostingu (Vercel) -- obično
    // "ispali-pa-zaboravi" async poziv bi mogao da se prekine pre nego što
    // stigne da pošalje.
    after(() =>
      sendPushToProfile(targetId, {
        title: "🔥 MATCH!",
        body: `Ti i ${me?.name ?? "neko"} ste se svideli jedno drugom.`,
        url: "/match",
        tag: "match",
      })
    );
  } else if (choice === "krevet") {
    after(() =>
      sendPushToProfile(targetId, {
        title: "😈 Neko hoće s tobom u krevet",
        body: "Otključaj da vidiš ko je to.",
        url: "/18-plus",
        tag: "krevet_signal",
      })
    );
  } else if (choice === "upoznavanje") {
    after(() =>
      sendPushToProfile(targetId, {
        title: "😍 Neko hoće da te upozna",
        body: "Otključaj da vidiš ko je to.",
        url: "/ko-te-zeli",
        tag: "like",
      })
    );
  }

  return { error: null, matched: result.matched, matchId: result.match_id };
}

/** Zadrzano za ko-te-zeli/LikerCard.tsx (uzvracanje "upoznavanje"). */
export async function likeProfile(targetId: string) {
  return chooseMuvaj(targetId, "upoznavanje");
}

export async function sendSecretSpark(
  targetId: string
): Promise<{ error: string | null; mutual: boolean; matchId: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nisi prijavljen/a.", mutual: false, matchId: null };

  const { data, error } = await supabase
    .rpc("send_secret_spark", { sender_id: user.id, target_id: targetId })
    .single();

  if (error) return { error: "Nešto nije u redu. Pokušaj ponovo.", mutual: false, matchId: null };

  const result = data as { mutual: boolean; match_id: string | null };

  if (result.mutual) {
    after(() =>
      sendPushToProfile(targetId, {
        title: "🔥 Obostrana privlačnost!",
        body: "Vas dvoje ste se izabrali tajno — otključan je match!",
        url: "/match",
        tag: "match",
      })
    );
    // Pošiljaocu (koji sad gleda ekran) ne treba push -- već je u appu.
  } else {
    // Diskretno: primalac dobija push BEZ otkrivanja identiteta pošiljaoca
    // (isti tekst kao notifikacija u bazi, iz send_secret_spark funkcije).
    const { data: target } = await supabase.from("profiles").select("gender").eq("id", targetId).single();
    const { data: sender } = await supabase.from("profiles").select("gender").eq("id", user.id).single();
    const senderLabel =
      sender?.gender === "musko" ? "Tajni Srbin" : sender?.gender === "zensko" ? "Tajna Srpkinja" : "Tajna osoba";
    const targetAdj = target?.gender === "musko" ? "zanimljiv" : target?.gender === "zensko" ? "zanimljiva" : "zanimljiv/a";
    after(() =>
      sendPushToProfile(targetId, {
        title: "🤫 Tajni signal",
        body: `${senderLabel} misli da si ${targetAdj}.`,
        url: "/sada",
        tag: "secret_spark",
      })
    );
  }

  return { error: null, mutual: result.mutual, matchId: result.match_id };
}

export async function touchActivity(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("profiles").update({ last_active_at: new Date().toISOString() }).eq("id", user.id);
}
