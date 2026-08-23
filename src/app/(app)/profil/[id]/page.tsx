import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { calculateAge } from "@/lib/utils";
import { ProfileViewActions } from "./ProfileViewActions";

export const metadata = { title: "Profil" };

export default async function OtherProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  if (id === user.id) return null; // sopstveni profil ide na /profil, ne ovde

  const [{ data: profile }, { data: photos }, { data: videos }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, name, birth_date, city, bio, interests, is_verified, deleted_at")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("profile_photos")
      .select("id, url, is_primary")
      .eq("profile_id", id)
      .eq("moderation_status", "approved")
      .order("position"),
    supabase
      .from("profile_videos")
      .select("id, url, thumbnail_url")
      .eq("profile_id", id)
      .eq("moderation_status", "approved")
      .order("position"),
  ]);

  if (!profile || profile.deleted_at) notFound();

  const age = calculateAge(profile.birth_date);

  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <Link href="/poruke" className="text-sm text-[var(--color-text-muted)]">
        ← Nazad
      </Link>

      {photos?.length ? (
        <div className="flex snap-x gap-2 overflow-x-auto pb-1">
          {photos.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={p.id}
              src={p.url}
              alt={profile.name}
              className="h-80 w-64 shrink-0 snap-center rounded-3xl object-cover"
            />
          ))}
        </div>
      ) : (
        <div className="flex h-80 w-full items-center justify-center rounded-3xl bg-gradient-accent text-5xl font-bold text-white">
          {profile.name?.[0]?.toUpperCase() ?? "?"}
        </div>
      )}

      <div>
        <h1 className="flex items-center gap-1 text-xl font-bold">
          {profile.name}, {age}
          {profile.is_verified && <span title="Verifikovan profil">✓</span>}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">{profile.city || "Grad nije podešen"}</p>
      </div>

      {profile.bio && (
        <section>
          <h2 className="mb-1 text-sm font-semibold text-[var(--color-text-muted)]">O meni</h2>
          <p className="text-sm">{profile.bio}</p>
        </section>
      )}

      {profile.interests?.length ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--color-text-muted)]">Interesovanja</h2>
          <div className="flex flex-wrap gap-2">
            {profile.interests.map((interest: string) => (
              <span key={interest} className="rounded-full border border-[var(--color-border-strong)] px-3 py-1 text-xs">
                {interest}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {videos?.length ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--color-text-muted)]">Video</h2>
          <div className="flex gap-2 overflow-x-auto">
            {videos.map((v) => (
              <video key={v.id} src={v.url} poster={v.thumbnail_url ?? undefined} controls className="h-64 w-40 shrink-0 rounded-2xl bg-black" />
            ))}
          </div>
        </section>
      ) : null}

      <ProfileViewActions profileId={id} name={profile.name} />
    </div>
  );
}
