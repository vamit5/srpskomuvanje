"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { nextBelgrade4AMISO } from "@/lib/time";

export type HotModeVibe =
  | "flert"
  | "vrelo"
  | "veceras"
  | "pice"
  | "izlazak"
  | "upoznavanje"
  | "krevet"
  | "masaza"
  | "vreo_razgovor";

async function closeOpenHotModeLog(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string
) {
  const { data: openLog } = await supabase
    .from("hot_modes")
    .select("id")
    .eq("profile_id", profileId)
    .is("deactivated_at", null)
    .order("activated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (openLog) {
    await supabase.from("hot_modes").update({ deactivated_at: new Date().toISOString() }).eq("id", openLog.id);
  }
}

/**
 * Uključuje/isključuje Hot Mode. `expiresAt: null` = traje dok korisnik sam
 * ne isključi (sekcija 13). Prosleđen ISO string = ističe automatski (koristi
 * se za "Večeras" status koji traje do 04:00, sekcija 15).
 */
export async function setHotMode(input: {
  enabled: boolean;
  vibes: HotModeVibe[];
  expiresAt: string | null;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nisi prijavljen/a." };

  const { error } = await supabase
    .from("profiles")
    .update({
      hot_mode_enabled: input.enabled,
      hot_mode_vibes: input.enabled ? input.vibes : [],
      hot_mode_expires_at: input.enabled ? input.expiresAt : null,
    })
    .eq("id", user.id);

  if (error) return { error: "Ne mogu da sačuvam. Pokušaj ponovo." };

  await closeOpenHotModeLog(supabase, user.id);
  if (input.enabled) {
    await supabase.from("hot_modes").insert({ profile_id: user.id, vibes: input.vibes });
  }

  revalidatePath("/profil");
  revalidatePath("/sada");
  return { error: null };
}

/** Isto kao setHotMode(enabled:true, ...) ali sa automatskim isticanjem u 04:00 (sekcija 15). */
export async function setTonightStatus(vibes: HotModeVibe[]): Promise<{ error: string | null }> {
  return setHotMode({ enabled: true, vibes, expiresAt: nextBelgrade4AMISO() });
}
