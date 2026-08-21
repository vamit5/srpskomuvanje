"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface OnboardingInput {
  name: string;
  birthDate: string; // YYYY-MM-DD
  gender: "musko" | "zensko" | "drugo";
  interestedIn: ("musko" | "zensko" | "drugo")[];
  city: string;
  bio: string;
  interests: string[];
}

function calculateAge(birthDateStr: string) {
  const today = new Date();
  const birth = new Date(birthDateStr);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// Profile Completion Score (sekcija 9) -- konzervativna verzija dok fotografije
// i video nisu implementirani (FAZA 2). Nikad ne prikazujemo 100% pre nego što
// korisnik stvarno doda foto/video, da ne lažemo o kompletnosti profila.
function computeCompletionScore(input: OnboardingInput) {
  let score = 30; // ime + datum rodjenja + pol (obavezno polje, uvek popunjeno)
  if (input.city.trim()) score += 15;
  if (input.bio.trim().length >= 10) score += 15;
  if (input.interests.length >= 3) score += 15;
  // Preostalih 25% čekaju profilnu fotografiju + video (FAZA 2).
  return score;
}

export async function completeOnboarding(input: OnboardingInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/prijava");
  }

  const age = calculateAge(input.birthDate);
  if (age < 18) {
    return { error: "Moraš imati bar 18 godina da koristiš Srpskomuvanje." };
  }
  if (!input.name.trim()) {
    return { error: "Unesi ime." };
  }
  if (!input.interestedIn.length) {
    return { error: "Izaberi koga želiš da upoznaš." };
  }

  const score = computeCompletionScore(input);

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: user.id,
    name: input.name.trim(),
    birth_date: input.birthDate,
    gender: input.gender,
    city: input.city.trim() || null,
    bio: input.bio.trim() || null,
    interests: input.interests,
    is_18_confirmed: true,
    onboarding_completed_at: new Date().toISOString(),
    profile_completion_score: score,
  });

  if (profileError) {
    return { error: "Ne mogu da sačuvam profil. Pokušaj ponovo." };
  }

  await supabase.from("preferences").upsert({
    profile_id: user.id,
    interested_in: input.interestedIn,
    age_min: 18,
    age_max: 99,
    max_distance_km: 50,
  });

  await supabase.from("notification_preferences").upsert({ profile_id: user.id });

  redirect("/sada");
}
