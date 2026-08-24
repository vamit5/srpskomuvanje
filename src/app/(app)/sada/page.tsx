import Link from "next/link";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { calculateAge } from "@/lib/utils";
import { belgradeTimeHHMM, isWithinDailyWindow } from "@/lib/time";
import { LocationCard } from "./LocationCard";
import { SerbianFlag } from "@/components/SerbianFlag";

export const metadata = { title: "Sada" };

/** "1 osoba hoće" / "3 osobe hoće" / "5 osoba hoće" -- srpska brojna kongruencija. */
function personSubjectPhrase(n: number): string {
  const lastTwo = n % 100;
  const last = n % 10;
  const word = last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? "osobe" : "osoba";
  return `${n} ${word} hoće`;
}

interface FeaturedCandidate {
  id: string;
  name: string;
  birth_date: string;
  primary_photo_url: string | null;
  score: number;
}

export default async function SadaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();

  const [
    { count: unreadNotifications },
    { data: incomingLikes },
    { data: incomingSuperLikes },
    { data: myMatches },
    { data: nightConfig },
    { data: myProfile },
    { count: krevetPendingCount },
    { data: unlockCostRow },
  ] = await Promise.all([
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", user!.id)
      .eq("is_read", false),
    supabase.from("likes").select("from_profile_id").eq("to_profile_id", user!.id),
    supabase.from("super_likes").select("from_profile_id").eq("to_profile_id", user!.id),
    supabase
      .from("matches")
      .select("profile_a_id, profile_b_id")
      .or(`profile_a_id.eq.${user!.id},profile_b_id.eq.${user!.id}`)
      .is("unmatched_at", null),
    supabase.from("night_modes").select("starts_at, ends_at, is_enabled").eq("id", 1).maybeSingle(),
    supabase.from("profiles").select("location_updated_at, city, name").eq("id", user!.id).single(),
    supabase
      .from("krevet_signals")
      .select("id", { count: "exact", head: true })
      .eq("to_profile_id", user!.id)
      .eq("status", "pending"),
    supabase.from("muvaj_config").select("value").eq("key", "profile_unlock_cost_credits").maybeSingle(),
  ]);

  const unlockCost = (() => {
    const parsed = unlockCostRow ? Number(unlockCostRow.value) : NaN;
    return Number.isFinite(parsed) ? parsed : 1;
  })();

  const matchedIds = new Set(
    (myMatches ?? []).map((m) => (m.profile_a_id === user!.id ? m.profile_b_id : m.profile_a_id))
  );
  const likerIds = new Set([
    ...(incomingLikes ?? []).map((l) => l.from_profile_id),
    ...(incomingSuperLikes ?? []).map((l) => l.from_profile_id),
  ]);
  const pendingLikerIds = [...likerIds].filter((id) => !matchedIds.has(id));
  const pendingLikesCount = pendingLikerIds.length;

  const [{ data: likerTeasers }, { data: myPhoto }] = await Promise.all([
    pendingLikesCount > 0
      ? supabase
          .from("profile_photos")
          .select("thumbnail_url")
          .in("profile_id", pendingLikerIds.slice(0, 3))
          .eq("is_primary", true)
          .eq("moderation_status", "approved")
      : Promise.resolve({ data: null }),
    supabase.from("profile_photos").select("thumbnail_url").eq("profile_id", user!.id).eq("is_primary", true).maybeSingle(),
  ]);

  const isNight =
    !!nightConfig?.is_enabled && isWithinDailyWindow(belgradeTimeHHMM(), nightConfig.starts_at, nightConfig.ends_at);

  const hasLocation = !!myProfile?.location_updated_at;

  const [{ data: nearbyCount }, { data: featuredRaw }, { data: activeEvents }] = await Promise.all([
    hasLocation
      ? supabase.rpc("nearby_count", { viewer_id: user!.id, radius_km: 25 })
      : Promise.resolve({ data: null }),
    supabase.rpc("discover_profiles", { viewer_id: user!.id, result_limit: 1 }),
    supabase
      .from("events")
      .select("id, title, description, kind, ends_at, city")
      .eq("is_active", true)
      .lte("starts_at", new Date().toISOString())
      .gte("ends_at", new Date().toISOString())
      .or(`city.is.null,city.eq.${myProfile?.city ?? ""}`)
      .limit(3),
  ]);

  const featured = ((featuredRaw as FeaturedCandidate[] | null) ?? [])[0];
  const showFeatured = featured && featured.score >= 70;

  const hasSignals =
    pendingLikesCount > 0 || (unreadNotifications ?? 0) > 0 || !!showFeatured || (activeEvents?.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-3 px-4 pt-4">
      <header className="flex items-center gap-3">
        {myPhoto?.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={myPhoto.thumbnail_url} alt="" className="h-11 w-11 rounded-full object-cover ring-2 ring-[var(--color-accent)]/50" />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-accent text-sm font-bold text-white">
            {myProfile?.name?.[0]?.toUpperCase() ?? "?"}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold">
            {isNight ? (
              <>
                😏 <span className="text-gradient">Ko je još budan?</span>
              </>
            ) : (
              <>
                🔥 <span className="text-gradient">Sada</span>{" "}
                <SerbianFlag className="mb-0.5 inline-block h-4 w-6 rounded-[2px] align-middle" animated />
              </>
            )}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            {isNight ? "Noćni mod je aktivan" : "Šta se dešava upravo sada"}
          </p>
        </div>
      </header>

      <Link
        href="/18-plus"
        className="tap-scale animate-bubble-in relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#3a0d20] via-[#5b0e2e] to-[#c0195e] px-4 py-4 text-white"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-base font-extrabold">
              😈 18+ Muvanje
              {(krevetPendingCount ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" /> {krevetPendingCount} ČEKA
                </span>
              )}
            </p>
            <p className="mt-1 text-xs text-white/80">
              {(krevetPendingCount ?? 0) > 0
                ? `${personSubjectPhrase(krevetPendingCount ?? 0)} u 18+ chat s tobom večeras 😈`
                : "Direktnije. Bez okolišanja."}
            </p>
          </div>
          <span className="text-xs font-semibold">Uđi →</span>
        </div>
      </Link>

      {activeEvents?.map((ev) => (
        <div key={ev.id} className="animate-bubble-in rounded-2xl bg-gradient-accent px-4 py-3.5 text-white">
          <p className="text-sm font-semibold">🔥 {ev.title}</p>
          {ev.description && <p className="mt-0.5 text-xs text-white/90">{ev.description}</p>}
          <p className="mt-1 text-xs text-white/75">
            Traje do {new Date(ev.ends_at).toLocaleTimeString("sr-RS", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      ))}

      {pendingLikesCount > 0 && (
        <Link
          href="/ko-te-zeli"
          className="glass tap-scale animate-bubble-in flex items-center justify-between rounded-2xl px-4 py-3.5"
        >
          <span className="flex items-center gap-3">
            {likerTeasers?.length ? (
              <span className="flex -space-x-3">
                {likerTeasers.map((t, i) => (
                  <span key={i} className="h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-[var(--color-bg-card)]">
                    {t.thumbnail_url ? (
                      // Namerno CSS blur -- obicna profilna slika, isti nivo
                      // kao "Ko te zeli" tizer kartice.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.thumbnail_url} alt="" className="h-full w-full scale-125 object-cover blur-sm" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-gradient-accent text-xs">?</span>
                    )}
                  </span>
                ))}
              </span>
            ) : (
              <span className="text-lg">😍</span>
            )}
            <span className="text-sm">
              {personSubjectPhrase(pendingLikesCount)} da te upozna
              <span className="block text-xs text-[var(--color-text-muted)]">
                Otključaj za {unlockCost} Credit{unlockCost === 1 ? "" : "a"}
              </span>
            </span>
          </span>
          <span className="text-xs text-[var(--color-text-muted)]">Vidi →</span>
        </Link>
      )}

      {(unreadNotifications ?? 0) > 0 && (
        <Link href="/obavestenja" className="glass tap-scale animate-bubble-in flex items-center justify-between rounded-2xl px-4 py-3 text-sm">
          <span>
            🔔 Imaš <strong>{unreadNotifications}</strong> nepročitanih obaveštenja.
          </span>
          <span className="text-xs text-[var(--color-text-muted)]">Vidi →</span>
        </Link>
      )}

      {showFeatured && (
        <Link
          href={`/profil/${featured.id}`}
          className="glass tap-scale animate-bubble-in flex items-center gap-3 rounded-2xl px-4 py-3.5"
        >
          {featured.primary_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={featured.primary_photo_url}
              alt={featured.name}
              className="h-14 w-14 rounded-full object-cover ring-2 ring-[var(--color-accent)]/60"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-accent text-base font-bold text-white">
              {featured.name[0]?.toUpperCase()}
            </div>
          )}
          <span className="text-sm">
            💫 <strong>{featured.name}</strong>, {calculateAge(featured.birth_date)} se veoma uklapa sa tobom —{" "}
            {Math.round(featured.score)}% tvoj tip
          </span>
        </Link>
      )}

      <LocationCard hasLocation={hasLocation} nearbyCount={nearbyCount ?? null} />

      <Link
        href="/duel"
        className="tap-scale animate-bubble-in flex items-center justify-between rounded-2xl bg-gradient-accent px-4 py-3.5 text-white"
      >
        <span className="text-sm font-medium">⚔️ Duel — Ko ti je više tvoj tip?</span>
        <span className="text-xs">Igraj →</span>
      </Link>

      {!hasSignals && (
        <EmptyState
          emoji="👀"
          title="Ovde uskoro počinje akcija"
          description="Čim počneš da lajkuješ, dobijaš matcheve i budeš aktivan/na, ovde ćeš uživo videti ko je nov u tvojoj blizini, ko te je lajkovao i ko je online."
        />
      )}
    </div>
  );
}
