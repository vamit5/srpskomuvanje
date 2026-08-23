"use server";

import { createClient } from "@/lib/supabase/server";

export async function getProfileUnlockCost(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.from("muvaj_config").select("value").eq("key", "profile_unlock_cost_credits").maybeSingle();
  const parsed = data ? Number(data.value) : NaN;
  return Number.isFinite(parsed) ? parsed : 1;
}

export async function unlockProfile(
  targetId: string
): Promise<{ error: string | null; insufficientCredits: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nisi prijavljen/a.", insufficientCredits: false };

  const { data, error } = await supabase
    .rpc("unlock_profile_view", { p_viewer_id: user.id, p_target_id: targetId })
    .single();

  if (error) return { error: "Nešto nije u redu, probaj ponovo.", insufficientCredits: false };

  const row = data as { ok: boolean; error: string | null };
  if (!row.ok) {
    if (row.error === "insufficient_credits") return { error: null, insufficientCredits: true };
    return { error: row.error ?? "Nešto nije u redu.", insufficientCredits: false };
  }

  return { error: null, insufficientCredits: false };
}
