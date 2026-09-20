"use server";

import { createClient, getAuthUser } from "@/lib/supabase/server";

export interface NavCounts {
  unreadMessagesCount: number;
  eighteenPlusPending: boolean;
}

/**
 * Brojevi za donju navigaciju (nepročitane poruke, 18+ signal). Izdvojeno u
 * server akciju (ne samo u layout.tsx) jer Next.js layout NE osvežava
 * podatke pri klijentskoj navigaciji izmedju stranica iste sekcije -- samo
 * pri punom osvežavanju. AppShell (klijentska komponenta) zove ovo iznova
 * pri SVAKOJ promeni putanje da bedž ne ostane "zaleđen".
 */
export async function getNavCounts(): Promise<NavCounts> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();
  if (!user) return { unreadMessagesCount: 0, eighteenPlusPending: false };

  const [{ count: krevetPendingCount }, { data: myActiveMatches }] = await Promise.all([
    supabase
      .from("krevet_signals")
      .select("id", { count: "exact", head: true })
      .eq("to_profile_id", user.id)
      .eq("status", "pending"),
    supabase
      .from("matches")
      .select("id, source")
      .or(`profile_a_id.eq.${user.id},profile_b_id.eq.${user.id}`)
      .is("unmatched_at", null),
  ]);

  const matchIds = (myActiveMatches ?? []).map((m) => m.id);
  const chat18MatchIds = new Set((myActiveMatches ?? []).filter((m) => m.source === "18plus").map((m) => m.id));

  const { data: unreadRows } = matchIds.length
    ? await supabase.from("messages").select("match_id").in("match_id", matchIds).neq("sender_id", user.id).is("read_at", null)
    : { data: [] };

  let unreadMessagesCount = 0;
  let has18PlusUnread = false;
  for (const row of unreadRows ?? []) {
    if (chat18MatchIds.has(row.match_id)) has18PlusUnread = true;
    else unreadMessagesCount++;
  }

  return { unreadMessagesCount, eighteenPlusPending: (krevetPendingCount ?? 0) > 0 || has18PlusUnread };
}
