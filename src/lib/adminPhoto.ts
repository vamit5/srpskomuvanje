import "server-only";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { moderateImage } from "@/lib/moderation";
import { PHOTO_MAIN_MAX_DIMENSION, PHOTO_THUMB_SIZE, PHOTO_MAIN_QUALITY, PHOTO_THUMB_QUALITY } from "@/lib/media/constants";

/**
 * Deljena logika za "admin uploaduje sliku UMESTO korisnika" (nova osoba u
 * /admin/users/novi, ili dodata/zamenjena slika u /admin/users/[id]/uredi).
 * ISTA obrada i ISTA moderacija kao kad korisnik sam uploaduje na
 * /profil/foto -- bez izuzetka, samo radi preko admin (service-role)
 * klijenta jer cilja tudji Storage folder/tabelu.
 */
export async function adminProcessAndStorePhoto(
  admin: SupabaseClient,
  targetUserId: string,
  file: File,
  { position, isPrimary }: { position: number; isPrimary: boolean }
): Promise<{ error: string | null; moderationStatus: "approved" | "pending" | "rejected" | null }> {
  const rawBuffer = Buffer.from(await file.arrayBuffer());

  const mainResult = await sharp(rawBuffer)
    .rotate()
    .resize({ width: PHOTO_MAIN_MAX_DIMENSION, height: PHOTO_MAIN_MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .webp({ quality: Math.round(PHOTO_MAIN_QUALITY * 100) })
    .toBuffer({ resolveWithObject: true });
  const thumbBuffer = await sharp(rawBuffer)
    .rotate()
    .resize(PHOTO_THUMB_SIZE, PHOTO_THUMB_SIZE, { fit: "cover" })
    .webp({ quality: Math.round(PHOTO_THUMB_QUALITY * 100) })
    .toBuffer();

  const id = crypto.randomUUID();
  const path = `${targetUserId}/${id}.webp`;
  const thumbPath = `${targetUserId}/${id}-thumb.webp`;

  const [{ error: upErr1 }, { error: upErr2 }] = await Promise.all([
    admin.storage.from("photos").upload(path, mainResult.data, { contentType: "image/webp" }),
    admin.storage.from("photos").upload(thumbPath, thumbBuffer, { contentType: "image/webp" }),
  ]);
  if (upErr1 || upErr2) return { error: "Upload fotografije nije uspeo.", moderationStatus: null };

  const mainUrl = admin.storage.from("photos").getPublicUrl(path).data.publicUrl;
  const thumbUrl = admin.storage.from("photos").getPublicUrl(thumbPath).data.publicUrl;

  const moderation = await moderateImage(mainUrl);

  const { error: insertError } = await admin.from("profile_photos").insert({
    profile_id: targetUserId,
    url: mainUrl,
    thumbnail_url: thumbUrl,
    storage_path: path,
    thumbnail_path: thumbPath,
    width: mainResult.info.width,
    height: mainResult.info.height,
    position,
    is_primary: isPrimary,
    moderation_status: moderation.status,
  });
  if (insertError) return { error: "Ne mogu da sačuvam fotografiju.", moderationStatus: null };

  return { error: null, moderationStatus: moderation.status };
}
