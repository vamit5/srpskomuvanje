"use server";

import { createClient } from "@/lib/supabase/server";

/** Da li je PARTNER (ne ja) vec odgovorio na dato pitanje u ovoj sobi -- direktan SELECT, RLS ("ucesnici vide odgovore svoje sobe") vec ogranicava na sobu ciji sam ucesnik. */
export async function getSecretRoomDuelAnswerStatus(
  pairId: string,
  questionIndex: number
): Promise<{ bothAnswered: boolean; myAnswerIndex: number | null; otherAnswerIndex: number | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { bothAnswered: false, myAnswerIndex: null, otherAnswerIndex: null };

  const { data } = await supabase
    .from("secret_room_duel_answers")
    .select("profile_id, answer_index")
    .eq("pair_id", pairId)
    .eq("question_index", questionIndex);

  const rows = data ?? [];
  const mine = rows.find((r) => r.profile_id === user.id)?.answer_index ?? null;
  const otherRow = rows.find((r) => r.profile_id !== user.id);
  const other = otherRow?.answer_index ?? null;

  return { bothAnswered: rows.length >= 2, myAnswerIndex: mine, otherAnswerIndex: other };
}
