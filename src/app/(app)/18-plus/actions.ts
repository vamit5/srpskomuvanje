"use server";

import { createClient, getAuthUser } from "@/lib/supabase/server";

export interface EighteenPlusCandidate {
  id: string;
  name: string;
  birthDate: string;
  city: string | null;
  bio: string | null;
  photoUrl: string | null;
  isBoosted: boolean;
  distanceKm: number | null;
}

export async function get18PlusCandidates(limit = 15): Promise<{ candidates: EighteenPlusCandidate[]; error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();
  if (!user) return { candidates: [], error: "Nisi prijavljen/a." };

  const { data, error } = await supabase.rpc("get_18plus_candidates", { viewer_id: user.id, result_limit: limit });
  if (error) return { candidates: [], error: "Ne mogu da učitam profile. Pokušaj ponovo." };

  const rows = (data ?? []) as {
    id: string;
    name: string;
    birth_date: string;
    city: string | null;
    bio: string | null;
    primary_photo_url: string | null;
    is_boosted: boolean;
    distance_km: number | null;
  }[];

  return {
    error: null,
    candidates: rows.map((r) => ({
      id: r.id,
      name: r.name,
      birthDate: r.birth_date,
      city: r.city,
      bio: r.bio,
      photoUrl: r.primary_photo_url,
      isBoosted: r.is_boosted,
      distanceKm: r.distance_km,
    })),
  };
}

export interface PendingKrevetSignal {
  signalId: string;
  createdAt: string;
  fromPhotoUrl: string | null;
}

export async function getPendingKrevetSignals(): Promise<{ signals: PendingKrevetSignal[]; error: string | null; costCredits: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();
  if (!user) return { signals: [], error: "Nisi prijavljen/a.", costCredits: 1 };

  const [{ data, error }, { data: costRow }] = await Promise.all([
    supabase.rpc("get_muvaj_pending_krevet_list", { viewer_id: user.id }),
    supabase.from("muvaj_config").select("value").eq("key", "krevet_reveal_cost_credits").maybeSingle(),
  ]);
  if (error) return { signals: [], error: "Ne mogu da učitam signale.", costCredits: 1 };

  const rows = (data ?? []) as { signal_id: string; created_at: string; from_photo_url: string | null }[];
  const parsedCost = costRow ? Number(costRow.value) : NaN;
  return {
    error: null,
    costCredits: Number.isFinite(parsedCost) ? parsedCost : 1,
    signals: rows.map((r) => ({ signalId: r.signal_id, createdAt: r.created_at, fromPhotoUrl: r.from_photo_url })),
  };
}

export async function startEighteenPlusChat(targetId: string): Promise<{ matchId: string | null; error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();
  if (!user) return { matchId: null, error: "Nisi prijavljen/a." };

  const { data, error } = await supabase.rpc("start_18plus_chat", { p_viewer_id: user.id, p_target_id: targetId }).single();
  if (error) return { matchId: null, error: "Nešto nije u redu, probaj ponovo." };

  const row = data as { match_id: string | null; error: string | null };
  if (row.error || !row.match_id) return { matchId: null, error: row.error ?? "Nešto nije u redu." };
  return { matchId: row.match_id, error: null };
}

export interface RevealedKrevet {
  id: string;
  name: string;
  birthDate: string;
  city: string | null;
  photoUrl: string | null;
}

export async function revealKrevetSignal(
  signalId: string
): Promise<{ error: string | null; insufficientCredits: boolean; from: RevealedKrevet | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();
  if (!user) return { error: "Nisi prijavljen/a.", insufficientCredits: false, from: null };

  const { data, error } = await supabase
    .rpc("muvaj_reveal_krevet", { viewer_id: user.id, p_signal_id: signalId })
    .single();

  if (error) return { error: "Nešto nije u redu, probaj ponovo.", insufficientCredits: false, from: null };

  const row = data as {
    ok: boolean;
    error: string | null;
    from_id: string | null;
    from_name: string | null;
    from_birth_date: string | null;
    from_city: string | null;
    from_photo_url: string | null;
  };

  if (!row.ok) {
    if (row.error === "insufficient_credits") return { error: null, insufficientCredits: true, from: null };
    return { error: row.error ?? "Nešto nije u redu.", insufficientCredits: false, from: null };
  }

  return {
    error: null,
    insufficientCredits: false,
    from: row.from_id
      ? { id: row.from_id, name: row.from_name ?? "?", birthDate: row.from_birth_date ?? "", city: row.from_city, photoUrl: row.from_photo_url }
      : null,
  };
}
