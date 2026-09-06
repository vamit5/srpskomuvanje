"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeProfileCompletionScore } from "@/lib/scoring";
import { sendPushToProfile } from "@/lib/push/send";

export interface OnboardingInput {
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

export async function completeOnboarding(input: OnboardingInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();

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

  // Nema fotografija/videa u ovom trenutku — dodaju se odmah posle onboardinga
  // na /profil/foto, i score se tada automatski preračunava (vidi src/lib/scoring.ts).
  const score = computeProfileCompletionScore({
    hasCity: !!input.city.trim(),
    hasBio: input.bio.trim().length >= 10,
    interestsCount: input.interests.length,
    photoCount: 0,
    hasVideo: false,
  });

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: user.id,
    name: input.name.trim(),
    birth_date: input.birthDate,
    gender: input.gender,
    city: input.city.trim() || null,
    bio: input.bio.trim() || null,
    interests: input.interests,
    food_favorites: input.foodFavorites,
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

  // Dobrodošlica -- 3 besplatna Credits-a, jednom po nalogu (idempotentno
  // unutar same funkcije). Best-effort: ne sme da obori onboarding ako
  // ovo iz nekog razloga ne uspe.
  await supabase.rpc("grant_signup_bonus", { viewer_id: user.id });

  // Obavesti SVE postojeće korisnike da se neko nov pridružio (izričit
  // zahtev). notifications tabela nema INSERT politiku za obične
  // korisnike (sve ostalo ide preko SECURITY DEFINER funkcija) -- ovde
  // zato koristimo admin (service-role) klijent, isti obrazac kao za
  // push slanje drugom korisniku.
  const admin = createAdminClient();
  const { data: others } = await admin.from("profiles").select("id").neq("id", user.id).is("deleted_at", null);

  if (others?.length) {
    const title = "🎉 Novi korisnik/ca na Srpskomuvanju";
    const body = `${input.name.trim()} se upravo pridružio/la${input.city.trim() ? " iz " + input.city.trim() : ""}.`;

    await admin.from("notifications").insert(
      others.map((o) => ({
        profile_id: o.id,
        type: "new_user",
        title,
        body,
        data: { newUserId: user.id },
      }))
    );

    // Push posle redirect-a (after()) -- ne sme da uspori onboarding,
    // i Next.js garantuje da se izvrši do kraja i na serverless hostingu.
    after(() =>
      Promise.all(
        others.map((o) => sendPushToProfile(o.id, { title, body, url: `/profil/${user.id}`, tag: "new_user" }))
      )
    );
  }

  redirect("/sada");
}
