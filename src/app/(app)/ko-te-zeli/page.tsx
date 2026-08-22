import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { calculateAge, personCountPhrase } from "@/lib/utils";
import { isPremium } from "@/lib/premium";
import { LikerCard } from "./LikerCard";
import { UnlockCard } from "./UnlockCard";

export const metadata = { title: "Ko te želi" };

export default async function KoTeZeliPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: likes }, { data: superLikes }, { data: myMatches }, { data: myBlocks }, premium] =
    await Promise.all([
      supabase.from("likes").select("from_profile_id, created_at").eq("to_profile_id", user.id),
      supabase.from("super_likes").select("from_profile_id, created_at").eq("to_profile_id", user.id),
      supabase
        .from("matches")
        .select("profile_a_id, profile_b_id")
        .or(`profile_a_id.eq.${user.id},profile_b_id.eq.${user.id}`)
        .is("unmatched_at", null),
      supabase.from("blocks").select("blocked_id").eq("blocker_id", user.id),
      isPremium(user.id),
    ]);

  const matchedIds = new Set(
    (myMatches ?? []).map((m) => (m.profile_a_id === user.id ? m.profile_b_id : m.profile_a_id))
  );
  const blockedIds = new Set((myBlocks ?? []).map((b) => b.blocked_id));

  type Liker = { id: string; created_at: string; isSuper: boolean };
  const byId = new Map<string, Liker>();
  for (const l of likes ?? []) {
    if (matchedIds.has(l.from_profile_id) || blockedIds.has(l.from_profile_id)) continue;
    byId.set(l.from_profile_id, { id: l.from_profile_id, created_at: l.created_at, isSuper: false });
  }
  for (const l of superLikes ?? []) {
    if (matchedIds.has(l.from_profile_id) || blockedIds.has(l.from_profile_id)) continue;
    byId.set(l.from_profile_id, { id: l.from_profile_id, created_at: l.created_at, isSuper: true });
  }
  const likers = [...byId.values()].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  let profilesById = new Map<
    string,
    { id: string; name: string; birth_date: string; photoUrl: string | null }
  >();
  let teaserPhotoUrls: string[] = [];

  if (likers.length) {
    const ids = likers.map((l) => l.id);
    if (premium) {
      const [{ data: profiles }, { data: photos }] = await Promise.all([
        supabase.from("profiles").select("id, name, birth_date").in("id", ids),
        supabase
          .from("profile_photos")
          .select("profile_id, thumbnail_url")
          .in("profile_id", ids)
          .eq("is_primary", true)
          .eq("moderation_status", "approved"),
      ]);
      profilesById = new Map(
        (profiles ?? []).map((p) => [
          p.id,
          { ...p, photoUrl: photos?.find((ph) => ph.profile_id === p.id)?.thumbnail_url ?? null },
        ])
      );
    } else {
      // Besplatan nalog ne dobija imena/profile, ali PRIKAZ (zamućene)
      // stvarne slike umesto generičkih katanaca -- to je i poenta teasera.
      const { data: photos } = await supabase
        .from("profile_photos")
        .select("profile_id, thumbnail_url")
        .in("profile_id", ids.slice(0, 6))
        .eq("is_primary", true)
        .eq("moderation_status", "approved");
      teaserPhotoUrls = ids
        .slice(0, 6)
        .map((id) => photos?.find((ph) => ph.profile_id === id)?.thumbnail_url ?? null)
        .filter((u): u is string => !!u);
    }
  }

  return (
    <div className="flex flex-col gap-3 px-4 pt-4">
      <header className="flex items-center gap-2">
        <Link href="/profil" className="text-sm text-[var(--color-text-muted)]">
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-bold">
            👀 <span className="text-gradient">Ko te želi</span>
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            {likers.length === 0
              ? "Još niko"
              : `${likers.length} ${personCountPhrase(likers.length, "lajkova")}`}
          </p>
        </div>
      </header>

      {likers.length === 0 ? (
        <EmptyState
          emoji="👀"
          title="Još nema lajkova"
          description="Čim te neko lajkuje, pojaviće se ovde. U međuvremenu, budi aktivan/na na Otkrij da te više ljudi vidi."
        />
      ) : !premium ? (
        <UnlockCard count={likers.length} photoUrls={teaserPhotoUrls} />
      ) : (
        <div className="flex flex-col gap-2">
          {likers.map((l) => {
            const p = profilesById.get(l.id);
            if (!p) return null;
            return (
              <LikerCard
                key={l.id}
                id={p.id}
                name={p.name}
                age={calculateAge(p.birth_date)}
                photoUrl={p.photoUrl}
                isSuper={l.isSuper}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
