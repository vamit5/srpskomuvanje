import { createClient } from "@/lib/supabase/server";
import { UrediProfilForm } from "./UrediProfilForm";

export const metadata = { title: "Uredi profil" };

export default async function UrediProfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: preferences }] = await Promise.all([
    supabase
      .from("profiles")
      .select("name, birth_date, gender, city, bio, interests, food_favorites")
      .eq("id", user!.id)
      .single(),
    supabase.from("preferences").select("interested_in").eq("profile_id", user!.id).single(),
  ]);

  if (!profile) return null;

  return (
    <div className="flex flex-col gap-6 px-4 pt-4 pb-8">
      <header>
        <h1 className="text-xl font-bold">Uredi profil</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Ime, godine, grad, opis, interesovanja i koliko si Srbin/Srpkinja — sve na jednom mestu.
        </p>
      </header>

      <UrediProfilForm
        initial={{
          name: profile.name,
          birthDate: profile.birth_date,
          gender: profile.gender,
          interestedIn: preferences?.interested_in ?? [],
          city: profile.city ?? "",
          bio: profile.bio ?? "",
          interests: profile.interests ?? [],
          foodFavorites: profile.food_favorites ?? [],
        }}
      />
    </div>
  );
}
