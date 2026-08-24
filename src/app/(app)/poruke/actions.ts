"use server";

import { after } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { sendPushToProfile } from "@/lib/push/send";
import { checkContactInfoFilter } from "@/lib/contentFilter";

export interface Conversation {
  matchId: string;
  otherId: string;
  otherName: string;
  otherPhotoUrl: string | null;
  lastMessage: { content: string | null; createdAt: string; isMine: boolean } | null;
  unreadCount: number;
  matchedAt: string;
}

export async function getConversations(): Promise<{ conversations: Conversation[]; error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();
  if (!user) return { conversations: [], error: "Nisi prijavljen/a." };

  const { data: matches } = await supabase
    .from("matches")
    .select("id, profile_a_id, profile_b_id, matched_at")
    .or(`profile_a_id.eq.${user.id},profile_b_id.eq.${user.id}`)
    .is("unmatched_at", null)
    // "Poruke" ostaje iskljucivo za obican chat -- 18+ Muvanje chat-ovi
    // (source='18plus') imaju svoju sopstvenu listu na /18-plus.
    .neq("source", "18plus")
    .order("matched_at", { ascending: false });

  if (!matches?.length) return { conversations: [], error: null };

  const otherIds = matches.map((m) => (m.profile_a_id === user.id ? m.profile_b_id : m.profile_a_id));
  const matchIds = matches.map((m) => m.id);

  const [{ data: others }, { data: photos }, { data: recentMessages }, { data: unread }] = await Promise.all([
    supabase.from("profiles").select("id, name").in("id", otherIds),
    supabase
      .from("profile_photos")
      .select("profile_id, thumbnail_url")
      .in("profile_id", otherIds)
      .eq("is_primary", true)
      .eq("moderation_status", "approved"),
    supabase
      .from("messages")
      .select("match_id, content, night_content_id, created_at, sender_id")
      .in("match_id", matchIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("messages")
      .select("match_id")
      .in("match_id", matchIds)
      .neq("sender_id", user.id)
      .is("read_at", null),
  ]);

  const lastByMatch = new Map<
    string,
    { content: string | null; night_content_id: string | null; created_at: string; sender_id: string }
  >();
  for (const m of recentMessages ?? []) {
    if (!lastByMatch.has(m.match_id)) lastByMatch.set(m.match_id, m);
  }
  const unreadByMatch = new Map<string, number>();
  for (const u of unread ?? []) {
    unreadByMatch.set(u.match_id, (unreadByMatch.get(u.match_id) ?? 0) + 1);
  }

  const conversations: Conversation[] = matches.map((m) => {
    const otherId = m.profile_a_id === user.id ? m.profile_b_id : m.profile_a_id;
    const other = others?.find((o) => o.id === otherId);
    const photo = photos?.find((p) => p.profile_id === otherId);
    const last = lastByMatch.get(m.id);
    return {
      matchId: m.id,
      otherId,
      otherName: other?.name ?? "Korisnik",
      otherPhotoUrl: photo?.thumbnail_url ?? null,
      lastMessage: last
        ? {
            content: last.night_content_id ? "🌙 Noćno muvanje" : last.content,
            createdAt: last.created_at,
            isMine: last.sender_id === user.id,
          }
        : null,
      unreadCount: unreadByMatch.get(m.id) ?? 0,
      matchedAt: m.matched_at,
    };
  });

  conversations.sort((a, b) => {
    const at = a.lastMessage?.createdAt ?? a.matchedAt;
    const bt = b.lastMessage?.createdAt ?? b.matchedAt;
    return new Date(bt).getTime() - new Date(at).getTime();
  });

  return { conversations, error: null };
}

export async function sendMessage(
  matchId: string,
  content: string
): Promise<{ error: string | null; message: MessageRow | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();
  if (!user) return { error: "Nisi prijavljen/a.", message: null };

  const trimmed = content.trim();
  if (!trimmed) return { error: "Poruka je prazna.", message: null };
  if (trimmed.length > 2000) return { error: "Poruka je predugačka.", message: null };

  const filterResult = checkContactInfoFilter(trimmed);
  if (filterResult.blocked) return { error: filterResult.reason, message: null };

  const { data: match } = await supabase
    .from("matches")
    .select("id, unmatched_at, profile_a_id, profile_b_id")
    .eq("id", matchId)
    .maybeSingle();

  if (!match || match.unmatched_at) return { error: "Ovaj razgovor više nije aktivan.", message: null };
  if (match.profile_a_id !== user.id && match.profile_b_id !== user.id) {
    return { error: "Nemaš pristup ovom razgovoru.", message: null };
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({ match_id: matchId, sender_id: user.id, content: trimmed })
    .select("id, match_id, sender_id, content, image_url, night_content_id, created_at, read_at")
    .single();

  if (error || !data) return { error: "Ne mogu da pošaljem poruku. Pokušaj ponovo.", message: null };

  const otherId = match.profile_a_id === user.id ? match.profile_b_id : match.profile_a_id;
  const { data: me } = await supabase.from("profiles").select("name").eq("id", user.id).single();
  after(() =>
    sendPushToProfile(otherId, {
      title: `💬 ${me?.name ?? "Nova poruka"}`,
      body: trimmed.length > 100 ? trimmed.slice(0, 97) + "..." : trimmed,
      url: `/poruke/${matchId}`,
      tag: `chat-${matchId}`,
    })
  );

  return { error: null, message: data };
}

export async function markAsRead(matchId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();
  if (!user) return;

  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("match_id", matchId)
    .neq("sender_id", user.id)
    .is("read_at", null);
}

export async function unmatchAction(matchId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();
  if (!user) return { error: "Nisi prijavljen/a." };

  const { error } = await supabase
    .from("matches")
    .update({ unmatched_at: new Date().toISOString(), unmatched_by: user.id })
    .eq("id", matchId)
    .or(`profile_a_id.eq.${user.id},profile_b_id.eq.${user.id}`);

  if (error) return { error: "Ne mogu da prekinem match. Pokušaj ponovo." };
  return { error: null };
}

export interface MessageRow {
  id: string;
  match_id: string;
  sender_id: string;
  content: string | null;
  image_url: string | null;
  night_content_id: string | null;
  created_at: string;
  read_at: string | null;
}
