import { createClient } from "@/lib/supabase/server";
import { FotoVideoManager } from "./FotoVideoManager";

export const metadata = { title: "Fotografije i video" };

export default async function FotoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: photos }, { data: videos }] = await Promise.all([
    supabase
      .from("profile_photos")
      .select("id, url, thumbnail_url, position, is_primary, moderation_status")
      .eq("profile_id", user!.id)
      .order("position"),
    supabase
      .from("profile_videos")
      .select("id, url, thumbnail_url, duration_seconds, moderation_status")
      .eq("profile_id", user!.id)
      .order("position"),
  ]);

  return (
    <div className="flex flex-col gap-6 px-4 pt-4">
      <header>
        <h1 className="text-xl font-bold">Fotografije i video</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Prva fotografija je tvoja glavna slika koju drugi prvo vide.
        </p>
      </header>

      <FotoVideoManager userId={user!.id} initialPhotos={photos ?? []} initialVideos={videos ?? []} />
    </div>
  );
}
