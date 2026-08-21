"use server";

import { createClient } from "@/lib/supabase/server";

export type ReportReason =
  | "lazan_profil"
  | "neprikladan_sadrzaj"
  | "uznemiravanje"
  | "spam"
  | "prevara"
  | "maloletna_osoba"
  | "nasilje_pretnje"
  | "drugo";

export async function reportUser(
  reportedProfileId: string,
  reason: ReportReason,
  details: string,
  relatedMessageId?: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nisi prijavljen/a." };
  if (user.id === reportedProfileId) return { error: "Ne možeš prijaviti sebe." };

  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    reported_profile_id: reportedProfileId,
    reason,
    details: details.trim() || null,
    related_message_id: relatedMessageId ?? null,
  });

  if (error) return { error: "Ne mogu da pošaljem prijavu. Pokušaj ponovo." };
  return { error: null };
}

export async function blockUser(blockedProfileId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nisi prijavljen/a." };
  if (user.id === blockedProfileId) return { error: "Ne možeš blokirati sebe." };

  const { error } = await supabase
    .from("blocks")
    .insert({ blocker_id: user.id, blocked_id: blockedProfileId });

  if (error && error.code !== "23505") {
    // 23505 = već blokiran (unique constraint) -- tretiramo kao uspeh, u redu je.
    return { error: "Ne mogu da blokiram korisnika. Pokušaj ponovo." };
  }

  // Blokiranje prekida i svaki postojeći match/razgovor sa tom osobom.
  const a = user.id < blockedProfileId ? user.id : blockedProfileId;
  const b = user.id < blockedProfileId ? blockedProfileId : user.id;
  await supabase
    .from("matches")
    .update({ unmatched_at: new Date().toISOString(), unmatched_by: user.id })
    .eq("profile_a_id", a)
    .eq("profile_b_id", b)
    .is("unmatched_at", null);

  return { error: null };
}
