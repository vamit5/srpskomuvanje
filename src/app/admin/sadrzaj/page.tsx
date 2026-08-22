import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { ModerationQueue } from "./ModerationQueue";

export const metadata = { title: "Admin — Sadržaj" };

export default async function AdminSadrzajPage() {
  const supabase = await createClient();

  const [{ data: photos }, { data: videos }] = await Promise.all([
    supabase
      .from("profile_photos")
      .select("id, profile_id, url, thumbnail_url, created_at")
      .eq("moderation_status", "pending")
      .order("created_at", { ascending: true }),
    supabase
      .from("profile_videos")
      .select("id, profile_id, url, thumbnail_url, created_at")
      .eq("moderation_status", "pending")
      .order("created_at", { ascending: true }),
  ]);

  const items = [
    ...(photos ?? []).map((p) => ({ ...p, kind: "photo" as const })),
    ...(videos ?? []).map((v) => ({ ...v, kind: "video" as const })),
  ].sort((a, b) => (a.created_at < b.created_at ? -1 : 1));

  if (!items.length) {
    return (
      <EmptyState
        emoji="✅"
        title="Nema sadržaja na čekanju"
        description="Automatska NSFW provera (Sightengine) je jasno odobrila ili odbila sve dosad otpremljeno. Ovde se pojavljuju samo granični slučajevi."
      />
    );
  }

  const profileIds = Array.from(new Set(items.map((i) => i.profile_id)));
  const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", profileIds);
  const nameOf = (id: string) => profiles?.find((p) => p.id === id)?.name ?? "Nepoznat";

  const rows = items.map((i) => ({
    id: i.id,
    kind: i.kind,
    profileId: i.profile_id,
    profileName: nameOf(i.profile_id),
    url: i.url,
    thumbnailUrl: i.thumbnail_url,
    createdAt: i.created_at,
  }));

  return <ModerationQueue initialItems={rows} />;
}
