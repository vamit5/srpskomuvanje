import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { calculateAge, personCountPhrase } from "@/lib/utils";
import { belgradeTimeHHMM, isWithinDailyWindow } from "@/lib/time";
import { TonightPicker } from "./TonightPicker";
import { LocationCard } from "./LocationCard";

export const metadata = { title: "Sada" };

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
  } = await supabase.auth.getUser();

  const [
    { count: unreadNotifications },
    { data: incomingLikes },
    { data: incomingSuperLikes },
    { data: myMatches },
    { data: nightConfig },
    { data: myPrefs },
    { data: myProfile },
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
    supabase.from("preferences").select("interested_in").eq("profile_id", user!.id).maybeSingle(),
    supabase
      .from("profiles")
      .select("hot_mode_enabled, hot_mode_expires_at, location_updated_at, city")
      .eq("id", user!.id)
      .single(),
  ]);

  const matchedIds = new Set(
    (myMatches ?? []).map((m) => (m.profile_a_id === user!.id ? m.profile_b_id : m.profile_a_id))
  );
  const likerIds = new Set([
    ...(incomingLikes ?? []).map((l) => l.from_profile_id),
    ...(incomingSuperLikes ?? []).map((l) => l.from_profile_id),
  ]);
  const pendingLikesCount = [...likerIds].filter((id) => !matchedIds.has(id)).length;

  const isNight =
    !!nightConfig?.is_enabled && isWithinDailyWindow(belgradeTimeHHMM(), nightConfig.starts_at, nightConfig.ends_at);

  const myHotModeActive =
    !!myProfile?.hot_mode_enabled &&
    (!myProfile.hot_mode_expires_at || new Date(myProfile.hot_mode_expires_at) > new Date());

  const hasLocation = !!myProfile?.location_updated_at;

  const interestedIn = myPrefs?.interested_in ?? [];

  const [{ data: hotNowRaw }, { data: nearbyCount }, { data: featuredRaw }, { data: activeEvents }] =
    await Promise.all([
      interestedIn.length
        ? supabase
            .from("profiles")
            .select("id, name, birth_date, hot_mode_vibes")
            .neq("id", user!.id)
            .eq("hot_mode_enabled", true)
            .eq("is_discoverable", true)
            .is("deleted_at", null)
            .in("gender", interestedIn)
            .or(`hot_mode_expires_at.is.null,hot_mode_expires_at.gt.${new Date().toISOString()}`)
            .order("last_active_at", { ascending: false })
            .limit(8)
        : Promise.resolve({ data: [] }),
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

  const hotNowIds = (hotNowRaw ?? []).map((p) => p.id);
  const { data: hotNowPhotos } = hotNowIds.length
    ? await supabase
        .from("profile_photos")
        .select("profile_id, thumbnail_url")
        .in("profile_id", hotNowIds)
        .eq("is_primary", true)
        .eq("moderation_status", "approved")
    : { data: [] };

  const hotNow = (hotNowRaw ?? []).map((p) => ({
    ...p,
    photoUrl: hotNowPhotos?.find((ph) => ph.profile_id === p.id)?.thumbnail_url ?? null,
  }));

  const featured = ((featuredRaw as FeaturedCandidate[] | null) ?? [])[0];
  const showFeatured = featured && featured.score >= 70;

  const hasSignals =
    pendingLikesCount > 0 || (unreadNotifications ?? 0) > 0 || !!showFeatured || (activeEvents?.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-3 px-4 pt-4">
      <header>
        <h1 className="text-2xl font-bold">
          {isNight ? (
            <>
              😏 <span className="text-gradient">Ko je još budan?</span>
            </>
          ) : (
            <>
              🔥 <span className="text-gradient">Sada</span>
            </>
          )}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          {isNight ? "Noćni mod je aktivan" : "Šta se dešava upravo sada"}
        </p>
      </header>

      {activeEvents?.map((ev) => (
        <div key={ev.id} className="rounded-2xl bg-gradient-accent px-4 py-3.5 text-white">
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
          className="glass tap-scale flex items-center justify-between rounded-2xl px-4 py-3.5"
        >
          <span className="text-sm">
            👀 <strong>{pendingLikesCount}</strong> {personCountPhrase(pendingLikesCount, "lajkova")}
          </span>
          <span className="text-xs text-[var(--color-text-muted)]">Vidi →</span>
        </Link>
      )}

      {(unreadNotifications ?? 0) > 0 && (
        <Link href="/obavestenja" className="glass tap-scale flex items-center justify-between rounded-2xl px-4 py-3 text-sm">
          <span>
            🔔 Imaš <strong>{unreadNotifications}</strong> nepročitanih obaveštenja.
          </span>
          <span className="text-xs text-[var(--color-text-muted)]">Vidi →</span>
        </Link>
      )}

      {showFeatured && (
        <Link
          href="/otkrij"
          className="glass tap-scale flex items-center gap-3 rounded-2xl px-4 py-3.5"
        >
          {featured.primary_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={featured.primary_photo_url} alt={featured.name} className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-accent text-sm font-bold text-white">
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

      <TonightPicker alreadyActive={myHotModeActive} />

      {hotNow.length > 0 && (
        <section>
          <p className="mb-2 text-sm font-semibold text-[var(--color-text-muted)]">
            😏 {hotNow.length} {hotNow.length === 1 ? "osoba je" : "osobe/a su"} u Hot Mode-u sada
          </p>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {hotNow.map((p) => (
              <Link
                key={p.id}
                href="/otkrij"
                className="tap-scale flex w-20 shrink-0 flex-col items-center gap-1 text-center"
              >
                <div className="relative">
                  {p.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.photoUrl} alt={p.name} className="h-16 w-16 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-accent text-lg font-bold text-white">
                      {p.name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-[var(--color-bg)] bg-[var(--color-success)]" />
                </div>
                <span className="truncate text-xs text-[var(--color-text-muted)]">
                  {p.name}, {calculateAge(p.birth_date)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <Link
        href="/duel"
        className="tap-scale flex items-center justify-between rounded-2xl bg-gradient-accent px-4 py-3.5 text-white"
      >
        <span className="text-sm font-medium">⚔️ Duel — Ko ti je više tvoj tip?</span>
        <span className="text-xs">Igraj →</span>
      </Link>

      {!hasSignals && hotNow.length === 0 && (
        <EmptyState
          emoji="👀"
          title="Ovde uskoro počinje akcija"
          description="Čim počneš da lajkuješ, dobijaš matcheve i budeš aktivan/na, ovde ćeš uživo videti ko je nov u tvojoj blizini, ko te je lajkovao i ko je online."
        />
      )}
    </div>
  );
}
