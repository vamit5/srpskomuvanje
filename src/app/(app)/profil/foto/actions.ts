"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeProfileCompletionScore } from "@/lib/scoring";
import { MAX_PHOTOS, MAX_VIDEOS } from "@/lib/media/constants";


async function getAuthedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// Vraca isti broj koji se prikazuje na /profil — poziva se posle SVAKE izmene
// foto/video kolekcije da bi Profile Completion Score uvek bio tačan.
async function recomputeCompletionScore(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const [{ count: photoCount }, { count: videoCount }, { data: profile }] = await Promise.all([
    supabase.from("profile_photos").select("id", { count: "exact", head: true }).eq("profile_id", userId),
    supabase.from("profile_videos").select("id", { count: "exact", head: true }).eq("profile_id", userId),
    supabase.from("profiles").select("city, bio, interests").eq("id", userId).single(),
  ]);
  if (!profile) return;

  const score = computeProfileCompletionScore({
    hasCity: !!profile.city,
    hasBio: !!profile.bio && profile.bio.length >= 10,
    interestsCount: profile.interests?.length ?? 0,
    photoCount: photoCount ?? 0,
    hasVideo: (videoCount ?? 0) > 0,
  });

  await supabase.from("profiles").update({ profile_completion_score: score }).eq("id", userId);
}

function revalidateProfileRoutes() {
  revalidatePath("/profil");
  revalidatePath("/profil/foto");
}

export async function addPhoto(input: {
  path: string;
  thumbPath: string;
  width: number;
  height: number;
}): Promise<{ error: string | null; photoId: string | null }> {
  const { supabase, user } = await getAuthedUser();
  if (!user) return { error: "Nisi prijavljen/a.", photoId: null };

  // Odbrana u dubinu: iako Storage RLS već sprečava upload van sopstvenog
  // foldera, ne verujemo klijentu ni ovde.
  if (!input.path.startsWith(`${user.id}/`) || !input.thumbPath.startsWith(`${user.id}/`)) {
    return { error: "Nevažeća putanja fajla.", photoId: null };
  }

  const { count } = await supabase
    .from("profile_photos")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id);

  if ((count ?? 0) >= MAX_PHOTOS) {
    return { error: `Možeš imati najviše ${MAX_PHOTOS} fotografija.`, photoId: null };
  }

  const { data: mainUrl } = supabase.storage.from("photos").getPublicUrl(input.path);
  const { data: thumbUrl } = supabase.storage.from("photos").getPublicUrl(input.thumbPath);

  const { data: photo, error } = await supabase
    .from("profile_photos")
    .insert({
      profile_id: user.id,
      url: mainUrl.publicUrl,
      thumbnail_url: thumbUrl.publicUrl,
      storage_path: input.path,
      thumbnail_path: input.thumbPath,
      width: input.width,
      height: input.height,
      position: count ?? 0,
      is_primary: (count ?? 0) === 0,
      // MVP: nema automatske NSFW/sadržajne moderacije još (dolazi u FAZI 9),
      // zato foto odmah postaje vidljiva. Videti README napomenu o riziku.
      moderation_status: "approved",
    })
    .select("id")
    .single();

  if (error || !photo) return { error: "Ne mogu da sačuvam fotografiju. Pokušaj ponovo.", photoId: null };

  await recomputeCompletionScore(supabase, user.id);
  revalidateProfileRoutes();
  return { error: null, photoId: photo.id };
}

export async function deletePhoto(photoId: string): Promise<{ error: string | null }> {
  const { supabase, user } = await getAuthedUser();
  if (!user) return { error: "Nisi prijavljen/a." };

  const { data: photo } = await supabase
    .from("profile_photos")
    .select("storage_path, thumbnail_path")
    .eq("id", photoId)
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!photo) return { error: "Fotografija nije pronađena." };

  const paths = [photo.storage_path, photo.thumbnail_path].filter((p): p is string => !!p);
  if (paths.length) await supabase.storage.from("photos").remove(paths);

  await supabase.from("profile_photos").delete().eq("id", photoId);

  // Popuni "rupu" u redosledu i osveži ko je glavna fotografija.
  const { data: remaining } = await supabase
    .from("profile_photos")
    .select("id")
    .eq("profile_id", user.id)
    .order("position");

  if (remaining) {
    await Promise.all(
      remaining.map((row, i) =>
        supabase.from("profile_photos").update({ position: i, is_primary: i === 0 }).eq("id", row.id)
      )
    );
  }

  await recomputeCompletionScore(supabase, user.id);
  revalidateProfileRoutes();
  return { error: null };
}

export async function reorderPhotos(orderedIds: string[]): Promise<{ error: string | null }> {
  const { supabase, user } = await getAuthedUser();
  if (!user) return { error: "Nisi prijavljen/a." };

  await Promise.all(
    orderedIds.map((id, i) =>
      supabase
        .from("profile_photos")
        .update({ position: i, is_primary: i === 0 })
        .eq("id", id)
        .eq("profile_id", user.id)
    )
  );

  revalidateProfileRoutes();
  return { error: null };
}

export async function addVideo(input: {
  path: string;
  thumbPath: string;
  durationSeconds: number;
}): Promise<{ error: string | null; videoId: string | null }> {
  const { supabase, user } = await getAuthedUser();
  if (!user) return { error: "Nisi prijavljen/a.", videoId: null };

  if (!input.path.startsWith(`${user.id}/`) || !input.thumbPath.startsWith(`${user.id}/`)) {
    return { error: "Nevažeća putanja fajla.", videoId: null };
  }
  if (input.durationSeconds > 15) {
    return { error: "Video mora biti kraći od 15 sekundi.", videoId: null };
  }

  const { count } = await supabase
    .from("profile_videos")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id);

  if ((count ?? 0) >= MAX_VIDEOS) {
    return { error: `Možeš imati najviše ${MAX_VIDEOS} video snimak. Obriši postojeći da dodaš novi.`, videoId: null };
  }

  const { data: mainUrl } = supabase.storage.from("videos").getPublicUrl(input.path);
  const { data: thumbUrl } = supabase.storage.from("videos").getPublicUrl(input.thumbPath);

  const { data: video, error } = await supabase
    .from("profile_videos")
    .insert({
      profile_id: user.id,
      url: mainUrl.publicUrl,
      thumbnail_url: thumbUrl.publicUrl,
      storage_path: input.path,
      thumbnail_path: input.thumbPath,
      duration_seconds: Math.round(input.durationSeconds),
      position: count ?? 0,
      moderation_status: "approved",
    })
    .select("id")
    .single();

  if (error || !video) return { error: "Ne mogu da sačuvam video. Pokušaj ponovo.", videoId: null };

  await recomputeCompletionScore(supabase, user.id);
  revalidateProfileRoutes();
  return { error: null, videoId: video.id };
}

export async function deleteVideo(videoId: string): Promise<{ error: string | null }> {
  const { supabase, user } = await getAuthedUser();
  if (!user) return { error: "Nisi prijavljen/a." };

  const { data: video } = await supabase
    .from("profile_videos")
    .select("storage_path, thumbnail_path")
    .eq("id", videoId)
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!video) return { error: "Video nije pronađen." };

  const paths = [video.storage_path, video.thumbnail_path].filter((p): p is string => !!p);
  if (paths.length) await supabase.storage.from("videos").remove(paths);

  await supabase.from("profile_videos").delete().eq("id", videoId);

  await recomputeCompletionScore(supabase, user.id);
  revalidateProfileRoutes();
  return { error: null };
}
