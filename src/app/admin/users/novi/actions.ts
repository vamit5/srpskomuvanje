"use server";

import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { moderateImage } from "@/lib/moderation";
import { computeProfileCompletionScore } from "@/lib/scoring";
import {
  PHOTO_MAIN_MAX_DIMENSION,
  PHOTO_THUMB_SIZE,
  PHOTO_MAIN_QUALITY,
  PHOTO_THUMB_QUALITY,
  MAX_RAW_PHOTO_PICK_BYTES,
} from "@/lib/media/constants";

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

/**
 * Admin rucno unosi PRAVU, stvarnu osobu (izricito potvrdjeno checkbox-om u
 * formi -- vidi NewUserForm.tsx) -- ovo NIJE generator izmisljenih naloga.
 * Nalog se pravi kompletno funkcionalan (pravi auth.users red preko admin
 * API-ja) tako da osoba kasnije moze sama da preuzme pristup preko "Zaboravljena
 * lozinka" na svoj pravi mejl, kad god to hoce -- do tada je vidljiva/aktivna
 * na app-i kao i svaki drugi korisnik (ista tabela, ista pravila, ista
 * moderacija slike).
 */
export async function createManualUser(formData: FormData): Promise<{ error: string | null }> {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Nemaš admin pristup." };

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim();
  const birthDate = String(formData.get("birthDate") || "");
  const gender = String(formData.get("gender") || "");
  const interestedIn = formData.getAll("interestedIn").map(String);
  const city = String(formData.get("city") || "").trim();
  const bio = String(formData.get("bio") || "").trim();
  const interests = formData.getAll("interests").map(String);
  const foodFavorites = formData.getAll("foodFavorites").map(String);
  const consentConfirmed = formData.get("consentConfirmed") === "on";
  const photo = formData.get("photo") as File | null;

  if (!consentConfirmed) {
    return { error: "Moraš potvrditi da je osoba stvarna i saglasna." };
  }
  if (!email || !email.includes("@")) return { error: "Unesi ispravan email." };
  if (!name || name.trim().length < 2) return { error: "Unesi ime." };
  if (!birthDate) return { error: "Unesi datum rođenja." };
  if (calculateAge(birthDate) < 18) return { error: "Osoba mora imati bar 18 godina." };
  if (!["musko", "zensko", "drugo"].includes(gender)) return { error: "Izaberi pol." };
  if (!interestedIn.length) return { error: "Izaberi koga osoba želi da upozna." };
  if (!photo || photo.size === 0) return { error: "Dodaj profilnu fotografiju." };
  if (photo.size > MAX_RAW_PHOTO_PICK_BYTES) return { error: "Fotografija je prevelika (maksimalno 20MB)." };

  const admin = createAdminClient();

  // 1) Pravi auth nalog -- lozinka je nasumična i NIKAD se nigde ne čuva/prikazuje;
  // osoba pristupa kasnije isključivo preko "Zaboravljena lozinka" na svoj email.
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password: crypto.randomUUID() + crypto.randomUUID(),
  });

  if (authError || !created?.user) {
    return {
      error:
        authError?.message?.includes("already been registered") || authError?.code === "email_exists"
          ? "Nalog sa ovim mejlom već postoji."
          : "Ne mogu da napravim nalog. Pokušaj ponovo.",
    };
  }

  const newUserId = created.user.id;

  try {
    // 2) Fotografija -- ISTA obrada i ISTA moderacija kao za svaki drugi
    // upload (bez izuzetka, čak ni za admin-dodate naloge).
    const rawBuffer = Buffer.from(await photo.arrayBuffer());
    const mainBuffer = await sharp(rawBuffer)
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
    const path = `${newUserId}/${id}.webp`;
    const thumbPath = `${newUserId}/${id}-thumb.webp`;

    const [{ error: upErr1 }, { error: upErr2 }] = await Promise.all([
      admin.storage.from("photos").upload(path, mainBuffer.data, { contentType: "image/webp" }),
      admin.storage.from("photos").upload(thumbPath, thumbBuffer, { contentType: "image/webp" }),
    ]);
    if (upErr1 || upErr2) throw new Error("Upload fotografije nije uspeo.");

    const mainUrl = admin.storage.from("photos").getPublicUrl(path).data.publicUrl;
    const thumbUrl = admin.storage.from("photos").getPublicUrl(thumbPath).data.publicUrl;

    const moderation = await moderateImage(mainUrl);

    // 3) Profil + preferences + fotografija -- isti oblik podataka kao
    // completeOnboarding, samo upisano preko admin klijenta.
    const score = computeProfileCompletionScore({
      hasCity: !!city,
      hasBio: bio.length >= 10,
      interestsCount: interests.length,
      photoCount: 1,
      hasVideo: false,
    });

    const { error: profileError } = await admin.from("profiles").insert({
      id: newUserId,
      name,
      birth_date: birthDate,
      gender,
      city: city || null,
      bio: bio || null,
      interests,
      food_favorites: foodFavorites,
      is_18_confirmed: true,
      onboarding_completed_at: new Date().toISOString(),
      profile_completion_score: score,
      is_discoverable: true,
    });
    if (profileError) throw new Error("Ne mogu da sačuvam profil.");

    await admin.from("preferences").upsert({
      profile_id: newUserId,
      interested_in: interestedIn,
      age_min: 18,
      age_max: 99,
      max_distance_km: 50,
    });

    await admin.from("notification_preferences").upsert({ profile_id: newUserId });

    const { error: photoError } = await admin.from("profile_photos").insert({
      profile_id: newUserId,
      url: mainUrl,
      thumbnail_url: thumbUrl,
      storage_path: path,
      thumbnail_path: thumbPath,
      width: mainBuffer.info.width,
      height: mainBuffer.info.height,
      position: 0,
      is_primary: true,
      moderation_status: moderation.status,
    });
    if (photoError) throw new Error("Ne mogu da sačuvam fotografiju.");

    revalidatePath("/admin/users");
    return {
      error:
        moderation.status === "rejected"
          ? "Nalog je napravljen, ali fotografija je odbijena (neprikladan sadržaj) — zameni je na /admin/sadrzaj."
          : moderation.status === "pending"
            ? "Nalog je napravljen — fotografija čeka ručnu proveru na /admin/sadrzaj pre nego što postane vidljiva."
            : null,
    };
  } catch (err) {
    // Ne ostavljamo "napola" nalog bez profila -- ako bilo šta posle
    // kreiranja auth naloga ne uspe, obriši ga i javi grešku.
    await admin.auth.admin.deleteUser(newUserId).catch(() => {});
    return { error: err instanceof Error ? err.message : "Nešto nije u redu, probaj ponovo." };
  }
}
