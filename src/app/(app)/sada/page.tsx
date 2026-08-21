import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Sada" };

export default async function SadaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ count: unreadNotifications }, { data: incomingLikes }, { data: incomingSuperLikes }, { data: myMatches }] =
    await Promise.all([
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
    ]);

  const matchedIds = new Set(
    (myMatches ?? []).map((m) => (m.profile_a_id === user!.id ? m.profile_b_id : m.profile_a_id))
  );
  const likerIds = new Set([
    ...(incomingLikes ?? []).map((l) => l.from_profile_id),
    ...(incomingSuperLikes ?? []).map((l) => l.from_profile_id),
  ]);
  const pendingLikesCount = [...likerIds].filter((id) => !matchedIds.has(id)).length;

  const hasSignals = pendingLikesCount > 0 || (unreadNotifications ?? 0) > 0;

  return (
    <div className="flex flex-col gap-3 px-4 pt-4">
      <header>
        <h1 className="text-2xl font-bold">
          🔥 <span className="text-gradient">Sada</span>
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">Šta se dešava upravo sada</p>
      </header>

      {pendingLikesCount > 0 && (
        <Link
          href="/otkrij"
          className="glass tap-scale flex items-center justify-between rounded-2xl px-4 py-3.5"
        >
          <span className="text-sm">
            👀 <strong>{pendingLikesCount}</strong> {pendingLikesCount === 1 ? "osoba te je" : "osobe/a te je"}{" "}
            lajkovalo
          </span>
          <span className="text-xs text-[var(--color-text-muted)]">Otkrij →</span>
        </Link>
      )}

      {(unreadNotifications ?? 0) > 0 && (
        <div className="glass rounded-2xl px-4 py-3 text-sm">
          Imaš <strong>{unreadNotifications}</strong> nepročitanih obaveštenja.
        </div>
      )}

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
