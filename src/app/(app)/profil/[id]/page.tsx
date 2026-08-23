import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { calculateAge } from "@/lib/utils";
import { foodFavoriteLabel } from "@/lib/foodFavorites";
import { ProfileViewActions } from "./ProfileViewActions";
import { ProfileUnlockGate } from "./ProfileUnlockGate";
import { getProfileUnlockCost } from "./actions";

export const metadata = { title: "Profil" };

export default async function OtherProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  if (id === user.id) return null; // sopstveni profil ide na /profil, ne ovde

  const [{ data: baseProfile }, { data: unlockRow }, { data: subscription }] = await Promise.all([
    supabase.from("profiles").select("id, name, birth_date, city, is_verified, deleted_at").eq("id", id).maybeSingle(),
    supabase.from("profile_unlocks").select("id").eq("viewer_id", user.id).eq("target_id", id).maybeSingle(),
    supabase.from("subscriptions").select("status, current_period_end").eq("profile_id", user.id).maybeSingle(),
  ]);

  if (!baseProfile || baseProfile.deleted_at) notFound();

  const isPremium =
    subscription?.status === "active" &&
    (!subscription.current_period_end || new Date(subscription.current_period_end) > new Date());
  const unlocked = !!unlockRow || isPremium;

  // KLJUCNO ("da ne dodje do varanja"): bio/interesovanja/hrana/dodatne
  // slike/video se NE UCITAVAJU sa servera uopste dok korisnik nije
  // otkljucao -- nije CSS-sakrivanje na klijentu (to bi moglo da se
  // zaobidje kroz DevTools), podaci fizicki nikad ne stignu do browsera.
  const [{ data: primaryPhoto }, fullData] = await Promise.all([
    supabase
      .from("profile_photos")
      .select("url")
      .eq("profile_id", id)
      .eq("is_primary", true)
      .eq("moderation_status", "approved")
      .maybeSingle(),
    unlocked
      ? (async () => {
          const [{ data: profileExtra }, { data: photos }, { data: videos }] = await Promise.all([
            supabase.from("profiles").select("bio, interests, food_favorites").eq("id", id).single(),
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
          return { profileExtra, photos, videos };
        })()
      : Promise.resolve(null),
  ]);

  const age = calculateAge(baseProfile.birth_date);
  const costCredits = unlocked ? 0 : await getProfileUnlockCost();

  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <Link href="/poruke" className="text-sm text-[var(--color-text-muted)]">
        ← Nazad
      </Link>

      {unlocked && fullData?.photos?.length ? (
        <div className="flex snap-x gap-2 overflow-x-auto pb-1">
          {fullData.photos.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={p.id}
              src={p.url}
              alt={baseProfile.name}
              className="h-80 w-64 shrink-0 snap-center rounded-3xl object-cover"
            />
          ))}
        </div>
      ) : primaryPhoto?.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={primaryPhoto.url} alt={baseProfile.name} className="h-80 w-full rounded-3xl object-cover" />
      ) : (
        <div className="flex h-80 w-full items-center justify-center rounded-3xl bg-gradient-accent text-5xl font-bold text-white">
          {baseProfile.name?.[0]?.toUpperCase() ?? "?"}
        </div>
      )}

      <div>
        <h1 className="flex items-center gap-1 text-xl font-bold">
          {baseProfile.name}, {age}
          {baseProfile.is_verified && <span title="Verifikovan profil">✓</span>}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">{baseProfile.city || "Grad nije podešen"}</p>
      </div>

      {!unlocked && <ProfileUnlockGate profileId={id} name={baseProfile.name} costCredits={costCredits} />}

      {unlocked && fullData?.profileExtra?.bio && (
        <section>
          <h2 className="mb-1 text-sm font-semibold text-[var(--color-text-muted)]">O meni</h2>
          <p className="text-sm">{fullData.profileExtra.bio}</p>
        </section>
      )}

      {unlocked && fullData?.profileExtra?.food_favorites?.length ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--color-text-muted)]">🇷🇸 Voli</h2>
          <div className="flex flex-wrap gap-2">
            {fullData.profileExtra.food_favorites.map((f: string) => {
              const { label, emoji } = foodFavoriteLabel(f);
              return (
                <span key={f} className="bg-gradient-serbia rounded-full px-3 py-1 text-xs font-medium text-white">
                  {emoji} {label}
                </span>
              );
            })}
          </div>
        </section>
      ) : null}

      {unlocked && fullData?.profileExtra?.interests?.length ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--color-text-muted)]">Interesovanja</h2>
          <div className="flex flex-wrap gap-2">
            {fullData.profileExtra.interests.map((interest: string) => (
              <span key={interest} className="rounded-full border border-[var(--color-border-strong)] px-3 py-1 text-xs">
                {interest}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {unlocked && fullData?.videos?.length ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--color-text-muted)]">Video</h2>
          <div className="flex gap-2 overflow-x-auto">
            {fullData.videos.map((v) => (
              <video key={v.id} src={v.url} poster={v.thumbnail_url ?? undefined} controls className="h-64 w-40 shrink-0 rounded-2xl bg-black" />
            ))}
          </div>
        </section>
      ) : null}

      <ProfileViewActions profileId={id} name={baseProfile.name} />
    </div>
  );
}
