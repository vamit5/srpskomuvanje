import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isRecentlyActive } from "@/lib/utils";
import { ChatThread } from "../../../poruke/[matchId]/ChatThread";

export const metadata = { title: "18+ Muvanje — chat" };

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

/**
 * Namerno ODVOJENA ruta od /poruke/[matchId] -- korisnik je bio eksplicitan:
 * "Poruke" ostaje iskljucivo za obican chat. Isti ChatThread se ponovo
 * koristi (matchId/messages/sendMessage su identicni ispod haube), samo
 * je "hot" varijanta predloga poruka i drugaciji "Nazad" link.
 */
export default async function EighteenPlusChatPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: match } = await supabase
    .from("matches")
    .select("id, profile_a_id, profile_b_id, unmatched_at")
    .eq("id", matchId)
    .maybeSingle();

  if (!match || (match.profile_a_id !== user!.id && match.profile_b_id !== user!.id)) {
    redirect("/18-plus");
  }

  const otherId = match.profile_a_id === user!.id ? match.profile_b_id : match.profile_a_id;

  const [{ data: other }, { data: photo }, { data: messages }] = await Promise.all([
    supabase.from("profiles").select("name, last_active_at, show_online_status").eq("id", otherId).single(),
    supabase
      .from("profile_photos")
      .select("thumbnail_url")
      .eq("profile_id", otherId)
      .eq("is_primary", true)
      .eq("moderation_status", "approved")
      .maybeSingle(),
    supabase
      .from("messages")
      .select("id, match_id, sender_id, content, image_url, night_content_id, created_at, read_at")
      .eq("match_id", matchId)
      .order("created_at"),
  ]);

  const isOnline = !!other?.show_online_status && isRecentlyActive(other.last_active_at, ONLINE_WINDOW_MS);

  return (
    <ChatThread
      matchId={matchId}
      currentUserId={user!.id}
      otherId={otherId}
      otherName={other?.name ?? "Korisnik"}
      otherPhotoUrl={photo?.thumbnail_url ?? null}
      otherOnline={isOnline}
      initialMessages={messages ?? []}
      isUnmatched={!!match.unmatched_at}
      foodMatches={[]}
      hot
      backHref="/18-plus"
    />
  );
}
