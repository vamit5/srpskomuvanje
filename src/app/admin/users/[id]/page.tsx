import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditUserForm } from "./EditUserForm";
import { EditUserPhotos } from "./EditUserPhotos";

export const metadata = { title: "Admin — Uredi korisnika" };

export default async function AdminEditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: profile }, { data: preferences }, { data: photos }] = await Promise.all([
    supabase
      .from("profiles")
      .select("name, birth_date, gender, city, bio, interests, food_favorites")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("preferences").select("interested_in").eq("profile_id", id).maybeSingle(),
    supabase
      .from("profile_photos")
      .select("id, thumbnail_url, is_primary, moderation_status")
      .eq("profile_id", id)
      .order("position"),
  ]);

  if (!profile) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Link href="/admin/users" className="text-sm text-[var(--color-text-muted)] underline">
          ← Korisnici
        </Link>
      </div>
      <h2 className="text-lg font-semibold">Uredi korisnika — {profile.name}</h2>

      <EditUserPhotos userId={id} initialPhotos={photos ?? []} />

      <EditUserForm
        userId={id}
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
