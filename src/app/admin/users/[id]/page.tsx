import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditUserForm } from "./EditUserForm";
import { EditUserPhotos } from "./EditUserPhotos";

export const metadata = { title: "Admin — Uredi korisnika" };

// Vidi napomenu u ../novi/page.tsx -- ista obrada slike (addManualUserPhoto).
export const maxDuration = 30;

export default async function AdminEditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: profile }, { data: preferences }, { data: photos }] = await Promise.all([
    supabase
      .from("profiles")
      .select("name, birth_date, gender, city, bio, looking_for, food_favorites, is_test_account")
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
          lookingFor: profile.looking_for ?? "",
          city: profile.city ?? "",
          bio: profile.bio ?? "",
          foodFavorites: profile.food_favorites ?? [],
          isTestAccount: profile.is_test_account ?? false,
        }}
      />
    </div>
  );
}
