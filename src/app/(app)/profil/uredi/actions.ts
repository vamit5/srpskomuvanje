"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeProfileCompletionScore } from "@/lib/scoring";

export interface ProfileEditInput {
  name: string;
  birthDate: string; // YYYY-MM-DD
  gender: "musko" | "zensko" | "drugo";
  interestedIn: ("musko" | "zensko" | "drugo")[];
  city: string;
  bio: string;
  interests: string[];
  foodFavorites: string[];
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
 * Isti podaci kao onboarding, ali za VEC postojeci profil -- jedno mesto
 * gde korisnik moze da azurira sve svoje osnovne podatke posle registracije
 * (ime, godine, grad, opis, interesovanja, "koliko si Srbin"). Fotografije
 * i video ostaju posebno na /profil/foto (druga vrsta upload flow-a).
 */
export async function updateProfile(input: ProfileEditInput): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nisi prijavljen/a." };

  const age = calculateAge(input.birthDate);
  if (age < 18) return { error: "Moraš imati bar 18 godina da koristiš Srpskomuvanje." };
  if (!input.name.trim()) return { error: "Unesi ime." };
  if (!input.interestedIn.length) return { error: "Izaberi koga želiš da upoznaš." };

  const [{ count: photoCount }, { count: videoCount }] = await Promise.all([
    supabase.from("profile_photos").select("id", { count: "exact", head: true }).eq("profile_id", user.id),
    supabase.from("profile_videos").select("id", { count: "exact", head: true }).eq("profile_id", user.id),
  ]);

  const score = computeProfileCompletionScore({
    hasCity: !!input.city.trim(),
    hasBio: input.bio.trim().length >= 10,
    interestsCount: input.interests.length,
    photoCount: photoCount ?? 0,
    hasVideo: (videoCount ?? 0) > 0,
  });

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      name: input.name.trim(),
      birth_date: input.birthDate,
      gender: input.gender,
      city: input.city.trim() || null,
      bio: input.bio.trim() || null,
      interests: input.interests,
      food_favorites: input.foodFavorites,
      profile_completion_score: score,
    })
    .eq("id", user.id);

  if (profileError) return { error: "Ne mogu da sačuvam profil. Pokušaj ponovo." };

  // Ne diramo age_min/age_max/max_distance_km ovde -- to su filteri za
  // Discovery koje korisnik podešava odvojeno, ne deo osnovnog profila.
  const { error: prefError } = await supabase
    .from("preferences")
    .update({ interested_in: input.interestedIn })
    .eq("profile_id", user.id);

  if (prefError) return { error: "Ne mogu da sačuvam podešavanja. Pokušaj ponovo." };

  revalidatePath("/profil");
  revalidatePath("/profil/uredi");
  return { error: null };
}
