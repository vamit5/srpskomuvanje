"use server";

import { createClient } from "@/lib/supabase/server";

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

async function reactToProfile(
  targetId: string,
  kind: "like" | "super_like" | "pass"
): Promise<{ error: string | null; matched: boolean; matchId: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nisi prijavljen/a.", matched: false, matchId: null };

  if (kind === "pass") {
    const { error } = await supabase.from("passes").insert({ from_profile_id: user.id, to_profile_id: targetId });
    if (error) return { error: null, matched: false, matchId: null }; // već pass-ovano ranije, u redu je
    return { error: null, matched: false, matchId: null };
  }

  const { data, error } = await supabase
    .rpc("like_profile", { viewer_id: user.id, target_id: targetId, is_super: kind === "super_like" })
    .single();

  if (error) return { error: "Nešto nije u redu. Pokušaj ponovo.", matched: false, matchId: null };

  // Nema revalidatePath ovde namerno: /match je već potpuno dinamična ruta
  // (svaki put sveže čita bazu), pa revalidacija ne bi ništa promenila u
  // podacima -- samo bi terala Next.js da odmah iznova renderuje OVU
  // (/otkrij) rutu i pri tom resetuje lokalni state (match ekran).
  const result = data as { matched: boolean; match_id: string | null };
  return { error: null, matched: result.matched, matchId: result.match_id };
}

export async function likeProfile(targetId: string) {
  return reactToProfile(targetId, "like");
}

export async function superLikeProfile(targetId: string) {
  return reactToProfile(targetId, "super_like");
}

export async function passProfile(targetId: string) {
  return reactToProfile(targetId, "pass");
}

export async function touchActivity(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("profiles").update({ last_active_at: new Date().toISOString() }).eq("id", user.id);
}
