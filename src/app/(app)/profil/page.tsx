import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import { calculateAge } from "@/lib/utils";
import { signOutAction } from "./actions";
import { HotModeToggle } from "./HotModeToggle";

export const metadata = { title: "Profil" };

export default async function ProfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: primaryPhoto }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "name, birth_date, city, is_verified, profile_completion_score, bio, interests, hot_mode_enabled, hot_mode_vibes"
      )
      .eq("id", user!.id)
      .single(),
    supabase
      .from("profile_photos")
      .select("thumbnail_url")
      .eq("profile_id", user!.id)
      .eq("is_primary", true)
      .maybeSingle(),
  ]);

  if (!profile) return null;

  const age = calculateAge(profile.birth_date);
  const score = profile.profile_completion_score ?? 0;

  return (
    <div className="flex flex-col gap-6 px-4 pt-4">
      <header className="flex items-center gap-4">
        {primaryPhoto?.thumbnail_url ? (
          <Image
            src={primaryPhoto.thumbnail_url}
            alt={profile.name}
            width={64}
            height={64}
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-accent text-xl font-bold text-white">
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
      </header>

      <section className="glass rounded-2xl p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">Profil popunjen</span>
          <span className="text-[var(--color-text-muted)]">{score}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
          <div
            className="h-full rounded-full bg-gradient-accent transition-all"
            style={{ width: `${score}%` }}
          />
        </div>
        {score < 100 && (
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            {primaryPhoto
              ? "Dodaj još fotografija ili video da profil bude još jači."
              : "Dodaj profilnu fotografiju — najviše utiče na to koliko će te ljudi videti."}
          </p>
        )}
      </section>

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
              <span
                key={interest}
                className="rounded-full border border-[var(--color-border-strong)] px-3 py-1 text-xs"
              >
                {interest}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <HotModeToggle initialEnabled={profile.hot_mode_enabled} initialVibes={profile.hot_mode_vibes ?? []} />

      <div className="flex flex-col gap-2">
        <Link href="/profil/foto">
          <Button variant="secondary" className="w-full">
            Fotografije i video
          </Button>
        </Link>
        <form action={signOutAction}>
          <Button variant="ghost" type="submit" className="w-full">
            Odjavi se
          </Button>
        </form>
      </div>
    </div>
  );
}
