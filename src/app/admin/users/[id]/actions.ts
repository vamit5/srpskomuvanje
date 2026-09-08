"use server";

import { revalidatePath } from "next/cache";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminProcessAndStorePhoto } from "@/lib/adminPhoto";
import { computeProfileCompletionScore } from "@/lib/scoring";
import { MAX_PHOTOS, MAX_RAW_PHOTO_PICK_BYTES } from "@/lib/media/constants";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();
  if (!user) return { isAdmin: false as const };
  const { data: isAdmin } = await supabase.rpc("is_admin");
  return { isAdmin: !!isAdmin };
}

function calculateAge(birthDateStr: string) {
  const today = new Date();
  const birth = new Date(birthDateStr);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

/** Admin uredjuje osnovne podatke VEC postojeceg korisnika (bilo koga, ne samo admin-dodatih). */
export async function updateManualUser(userId: string, formData: FormData): Promise<{ error: string | null }> {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Nemaš admin pristup." };

  const name = String(formData.get("name") || "").trim();
  const birthDate = String(formData.get("birthDate") || "");
  const gender = String(formData.get("gender") || "");
  const interestedIn = formData.getAll("interestedIn").map(String);
  const lookingFor = String(formData.get("lookingFor") || "");
  const city = String(formData.get("city") || "").trim();
  const bio = String(formData.get("bio") || "").trim();
  const foodFavorites = formData.getAll("foodFavorites").map(String);

  if (!name || name.trim().length < 2) return { error: "Unesi ime." };
  if (!birthDate) return { error: "Unesi datum rođenja." };
  if (calculateAge(birthDate) < 18) return { error: "Osoba mora imati bar 18 godina." };
  if (!["musko", "zensko", "drugo"].includes(gender)) return { error: "Izaberi pol." };
  if (!interestedIn.length) return { error: "Izaberi koga osoba želi da upozna." };
  if (!["sex", "buduci_partner", "upoznavanje"].includes(lookingFor)) {
    return { error: "Izaberi šta osoba traži na aplikaciji." };
  }

  const admin = createAdminClient();

  const [{ count: photoCount }, { count: videoCount }, { data: existingProfile }] = await Promise.all([
    admin.from("profile_photos").select("id", { count: "exact", head: true }).eq("profile_id", userId),
    admin.from("profile_videos").select("id", { count: "exact", head: true }).eq("profile_id", userId),
    admin.from("profiles").select("interests").eq("id", userId).maybeSingle(),
  ]);

  const score = computeProfileCompletionScore({
    hasCity: !!city,
    hasBio: bio.length >= 10,
    interestsCount: existingProfile?.interests?.length ?? 0,
    photoCount: photoCount ?? 0,
    hasVideo: (videoCount ?? 0) > 0,
  });

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      name,
      birth_date: birthDate,
      gender,
      city: city || null,
      bio: bio || null,
      looking_for: lookingFor,
      food_favorites: foodFavorites,
      profile_completion_score: score,
    })
    .eq("id", userId);
  if (profileError) return { error: "Ne mogu da sačuvam profil." };

  const { error: prefError } = await admin
    .from("preferences")
    .update({ interested_in: interestedIn })
    .eq("profile_id", userId);
  if (prefError) return { error: "Ne mogu da sačuvam podešavanja." };

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  return { error: null };
}

export async function addManualUserPhoto(userId: string, formData: FormData): Promise<{ error: string | null }> {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Nemaš admin pristup." };

  const photo = formData.get("photo") as File | null;
  if (!photo || photo.size === 0) return { error: "Izaberi fotografiju." };
  if (photo.size > MAX_RAW_PHOTO_PICK_BYTES) return { error: "Fotografija je prevelika (maksimalno 20MB)." };

  const admin = createAdminClient();
  const { count } = await admin.from("profile_photos").select("id", { count: "exact", head: true }).eq("profile_id", userId);
  if ((count ?? 0) >= MAX_PHOTOS) return { error: `Korisnik već ima najviše ${MAX_PHOTOS} fotografija.` };

  const { error, moderationStatus } = await adminProcessAndStorePhoto(admin, userId, photo, {
    position: count ?? 0,
    isPrimary: (count ?? 0) === 0,
  });
  if (error) return { error };

  revalidatePath(`/admin/users/${userId}`);
  return {
    error:
      moderationStatus === "rejected"
        ? "Fotografija je odbijena (neprikladan sadržaj)."
        : moderationStatus === "pending"
          ? "Fotografija čeka ručnu proveru na /admin/sadrzaj."
          : null,
  };
}

export async function deleteManualUserPhoto(userId: string, photoId: string): Promise<{ error: string | null }> {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Nemaš admin pristup." };

  const admin = createAdminClient();
  const { data: photo } = await admin
    .from("profile_photos")
    .select("storage_path, thumbnail_path")
    .eq("id", photoId)
    .eq("profile_id", userId)
    .maybeSingle();
  if (!photo) return { error: "Fotografija nije pronađena." };

  const paths = [photo.storage_path, photo.thumbnail_path].filter((p): p is string => !!p);
  if (paths.length) await admin.storage.from("photos").remove(paths);
  await admin.from("profile_photos").delete().eq("id", photoId);

  const { data: remaining } = await admin.from("profile_photos").select("id").eq("profile_id", userId).order("position");
  if (remaining) {
    await Promise.all(
      remaining.map((row, i) =>
        admin.from("profile_photos").update({ position: i, is_primary: i === 0 }).eq("id", row.id)
      )
    );
  }

  revalidatePath(`/admin/users/${userId}`);
  return { error: null };
}

export async function setManualUserPrimaryPhoto(userId: string, photoId: string): Promise<{ error: string | null }> {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Nemaš admin pristup." };

  const admin = createAdminClient();
  const { data: photos } = await admin.from("profile_photos").select("id").eq("profile_id", userId).order("position");
  if (!photos) return { error: "Ne mogu da učitam fotografije." };

  const reordered = [photoId, ...photos.map((p) => p.id).filter((id) => id !== photoId)];
  await Promise.all(
    reordered.map((id, i) => admin.from("profile_photos").update({ position: i, is_primary: i === 0 }).eq("id", id))
  );

  revalidatePath(`/admin/users/${userId}`);
  return { error: null };
}
