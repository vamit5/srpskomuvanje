"use server";

import { createClient } from "@/lib/supabase/server";

export interface EighteenPlusCandidate {
  id: string;
  name: string;
  birthDate: string;
  city: string | null;
  bio: string | null;
  photoUrl: string | null;
  isBoosted: boolean;
}

export async function get18PlusCandidates(limit = 15): Promise<{ candidates: EighteenPlusCandidate[]; error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
    })),
  };
}

export interface PendingKrevetSignal {
  signalId: string;
  createdAt: string;
}

export async function getPendingKrevetSignals(): Promise<{ signals: PendingKrevetSignal[]; error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { signals: [], error: "Nisi prijavljen/a." };

  const { data, error } = await supabase.rpc("get_muvaj_pending_krevet_list", { viewer_id: user.id });
  if (error) return { signals: [], error: "Ne mogu da učitam signale." };

  const rows = (data ?? []) as { signal_id: string; created_at: string }[];
  return { error: null, signals: rows.map((r) => ({ signalId: r.signal_id, createdAt: r.created_at })) };
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
  } = await supabase.auth.getUser();
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
