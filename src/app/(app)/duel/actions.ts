"use server";

import { createClient } from "@/lib/supabase/server";

export interface DuelPair {
  duelId: string;
  prompt: string;
  a: { id: string; name: string; birthDate: string; photoUrl: string | null };
  b: { id: string; name: string; birthDate: string; photoUrl: string | null };
}

const PROMPTS = [
  "Ko ti je više zanimljiv/a?",
  "Ko ti više privlači pažnju?",
  "Sa kim bi pre izašao/la?",
  "Ko ti je više \"tvoj tip\"?",
];

export async function getNextDuel(): Promise<{ duel: DuelPair | null; error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { duel: null, error: "Nisi prijavljen/a." };

  const prompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];

  // Bez .single() namerno: kad nema dovoljno kandidata, create_duel vraća
  // NULA redova (ne red sa null vrednostima), a .single() bi to tretirao
  // kao grešku umesto kao legitiman "nema još" odgovor.
  const { data, error } = await supabase.rpc("create_duel", { viewer_id: user.id, prompt });

  if (error) return { duel: null, error: "Ne mogu da učitam duel. Pokušaj ponovo." };

  const rows = data as {
    duel_id: string | null;
    a_id: string | null;
    a_name: string | null;
    a_birth_date: string | null;
    a_photo_url: string | null;
    b_id: string | null;
    b_name: string | null;
    b_birth_date: string | null;
    b_photo_url: string | null;
  }[];

  const row = rows?.[0];
  if (!row?.duel_id || !row.a_id || !row.b_id) return { duel: null, error: null };

  await supabase.from("activity_events").insert({
    profile_id: user.id,
    event_name: "duel_started",
    metadata: { duelId: row.duel_id },
  });

  return {
    error: null,
    duel: {
      duelId: row.duel_id,
      prompt,
      a: { id: row.a_id, name: row.a_name ?? "?", birthDate: row.a_birth_date ?? "", photoUrl: row.a_photo_url },
      b: { id: row.b_id, name: row.b_name ?? "?", birthDate: row.b_birth_date ?? "", photoUrl: row.b_photo_url },
    },
  };
}

export async function voteDuel(duelId: string, votedForId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nisi prijavljen/a." };

  const { error } = await supabase
    .from("duel_votes")
    .insert({ duel_id: duelId, voter_profile_id: user.id, voted_for_profile_id: votedForId });

  if (error) return { error: null }; // već glasano na ovaj duel, tretiramo kao uspeh

  await supabase.from("activity_events").insert({
    profile_id: user.id,
    event_name: "duel_completed",
    metadata: { duelId, votedForId },
  });

  return { error: null };
}
