"use server";

import { after } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToProfile } from "@/lib/push/send";
import { sendEmail } from "@/lib/email/send";
import { checkContactInfoFilter } from "@/lib/contentFilter";
import { moderateImage } from "@/lib/moderation";

export interface Conversation {
  matchId: string;
  otherId: string;
  otherName: string;
  otherPhotoUrl: string | null;
  otherShowsOnlineStatus: boolean;
  otherIsFeatured: boolean;
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
    supabase.from("profiles").select("id, name, show_online_status, is_featured").in("id", otherIds),
    supabase
      .from("profile_photos")
      .select("profile_id, thumbnail_url")
      .in("profile_id", otherIds)
      .eq("is_primary", true)
      .eq("moderation_status", "approved"),
    supabase
      .from("messages")
      .select("match_id, content, image_url, media_kind, night_content_id, created_at, sender_id")
      // Tudja jos-neodobrena/odbijena slika/video se ne racuna kao "poslednja
      // poruka" u pregledu razgovora dok admin ne odobri -- sopstvena poruka
      // se uvek racuna, bez obzira na status.
      .or(`moderation_status.eq.approved,sender_id.eq.${user.id}`)
      .in("match_id", matchIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("messages")
      .select("match_id")
      .in("match_id", matchIds)
      .neq("sender_id", user.id)
      .eq("moderation_status", "approved")
      .is("read_at", null),
  ]);

  const lastByMatch = new Map<
    string,
    {
      content: string | null;
      image_url: string | null;
      media_kind: "photo" | "video" | null;
      night_content_id: string | null;
      created_at: string;
      sender_id: string;
    }
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
      otherShowsOnlineStatus: !!other?.show_online_status,
      otherIsFeatured: !!other?.is_featured,
      lastMessage: last
        ? {
            content: last.night_content_id
              ? "🌙 Noćno muvanje"
              : last.image_url
                ? last.media_kind === "video"
                  ? "🎬 Video"
                  : "📷 Fotografija"
                : last.content,
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
    .select("id, match_id, sender_id, content, image_url, media_kind, moderation_status, night_content_id, created_at, read_at")
    .single();

  if (error || !data) return { error: "Ne mogu da pošaljem poruku. Pokušaj ponovo.", message: null };

  const otherId = match.profile_a_id === user.id ? match.profile_b_id : match.profile_a_id;
  const { data: me } = await supabase.from("profiles").select("name").eq("id", user.id).single();
  const senderName = me?.name ?? "Nova poruka";
  after(() =>
    sendPushToProfile(otherId, {
      title: `💬 ${senderName}`,
      body: trimmed.length > 100 ? trimmed.slice(0, 97) + "..." : trimmed,
      url: `/poruke/${matchId}`,
      tag: `chat-${matchId}`,
    })
  );

  // Mejl fallback -- SAMO za primaoce koji nemaju nijednu push pretplatu
  // (najcesce iPhone bez instalirane PWA ikonice, gde push uopste ne moze da
  // radi -- Apple ogranicenje). Salje se za SVAKU poruku (izricit zahtev --
  // ranije ogranicenje "samo prva neprocitana" je uklonjeno).
  after(async () => {
    const admin = createAdminClient();

    const { count: pushSubCount } = await admin
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", otherId);
    if ((pushSubCount ?? 0) > 0) return;

    const [{ data: authUser }, { data: otherProfile }] = await Promise.all([
      admin.auth.admin.getUserById(otherId),
      admin.from("profiles").select("is_test_account").eq("id", otherId).maybeSingle(),
    ]);
    const email = authUser?.user?.email;
    if (!email) return;

    // Test nalozi (admin-dodati, npr. test1@gmail.com) imaju NASUMICNU
    // lozinku koju niko ne zna -- obican link bi ih odveo na login gde ne
    // mogu da se uloguju bez "Zaboravljena lozinka". Za njih generisemo
    // magic-link (ista logika kao "Uđi kao ovaj nalog" u admin/poruke) --
    // otvara razgovor BEZ lozinke. Za STVARNE korisnike ovo namerno NE
    // radimo -- oni imaju svoju pravu lozinku i normalno se uloguju.
    let conversationUrl = `https://srpskomuvanje.vercel.app/poruke/${matchId}`;
    if (otherProfile?.is_test_account) {
      const { data: linkData } = await admin.auth.admin.generateLink({ type: "magiclink", email });
      if (linkData?.properties?.hashed_token) {
        conversationUrl = `https://srpskomuvanje.vercel.app/auth/confirm?token_hash=${linkData.properties.hashed_token}&type=magiclink&next=/poruke/${matchId}`;
      }
    }

    await sendEmail({
      to: email,
      subject: `💬 ${senderName} ti je poslao/la poruku na Srpskomuvanje`,
      html: `
        <p><strong>${senderName}</strong> ti je poslao/la poruku na Srpskomuvanje:</p>
        <p style="padding:12px;background:#f5f5f5;border-radius:8px;">${trimmed.length > 200 ? trimmed.slice(0, 197) + "..." : trimmed}</p>
        <p><a href="${conversationUrl}">Otvori razgovor →</a></p>
      `,
    });
  });

  return { error: null, message: data };
}

/**
 * Salje fotografiju/video kao poruku u obicnom chat-u -- OBICAN prilog, ne
 * Nocno muvanje (nema zamucenje/otkljucavanje/kredite). Prolazi kroz ISTU
 * NSFW proveru kao profilne slike (vidi lib/moderation.ts) PRE nego sto
 * postane vidljivo drugoj strani -- "pending"/"rejected" se cuvaju u bazi
 * (posiljalac vidi svoju poruku sa oznakom), ali se filtriraju iz onoga sto
 * ucitava DRUGA strana (vidi poruke/[matchId]/page.tsx).
 */
export async function sendMediaMessage(input: {
  matchId: string;
  path: string;
  classifyPath: string;
  kind: "photo" | "video";
}): Promise<{ error: string | null; message: MessageRow | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();
  if (!user) return { error: "Nisi prijavljen/a.", message: null };

  if (!input.path.startsWith(`${user.id}/`) || !input.classifyPath.startsWith(`${user.id}/`)) {
    return { error: "Nevažeća putanja fajla.", message: null };
  }

  const { data: match } = await supabase
    .from("matches")
    .select("id, unmatched_at, profile_a_id, profile_b_id")
    .eq("id", input.matchId)
    .maybeSingle();

  if (!match || match.unmatched_at) return { error: "Ovaj razgovor više nije aktivan.", message: null };
  if (match.profile_a_id !== user.id && match.profile_b_id !== user.id) {
    return { error: "Nemaš pristup ovom razgovoru.", message: null };
  }

  const { data: mainUrl } = supabase.storage.from("chat-media").getPublicUrl(input.path);
  const { data: classifyUrl } = supabase.storage.from("chat-media").getPublicUrl(input.classifyPath);

  const moderation = await moderateImage(classifyUrl.publicUrl);

  const { data, error } = await supabase
    .from("messages")
    .insert({
      match_id: input.matchId,
      sender_id: user.id,
      image_url: mainUrl.publicUrl,
      media_kind: input.kind,
      moderation_status: moderation.status,
    })
    .select("id, match_id, sender_id, content, image_url, media_kind, moderation_status, night_content_id, created_at, read_at")
    .single();

  if (error || !data) return { error: "Ne mogu da pošaljem. Pokušaj ponovo.", message: null };

  if (moderation.status === "rejected") {
    return { error: "Sadrži neprikladan sadržaj i nije vidljivo drugoj strani.", message: data };
  }
  if (moderation.status !== "approved") {
    return { error: null, message: data };
  }

  const otherId = match.profile_a_id === user.id ? match.profile_b_id : match.profile_a_id;
  const { data: me } = await supabase.from("profiles").select("name").eq("id", user.id).single();
  const senderName = me?.name ?? "Nova poruka";
  const previewLabel = input.kind === "photo" ? "📷 Fotografija" : "🎬 Video";
  after(() =>
    sendPushToProfile(otherId, {
      title: `💬 ${senderName}`,
      body: previewLabel,
      url: `/poruke/${input.matchId}`,
      tag: `chat-${input.matchId}`,
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
  media_kind: "photo" | "video" | null;
  moderation_status: "approved" | "pending" | "rejected";
  night_content_id: string | null;
  created_at: string;
  read_at: string | null;
}
