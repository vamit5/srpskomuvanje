import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { calculateAge } from "@/lib/utils";

export const metadata = { title: "Match" };

export default async function MatchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: matches } = await supabase
    .from("matches")
    .select("id, profile_a_id, profile_b_id, matched_at, source")
    .or(`profile_a_id.eq.${user!.id},profile_b_id.eq.${user!.id}`)
    .is("unmatched_at", null)
    .order("matched_at", { ascending: false });

  const otherIds = (matches ?? []).map((m) => (m.profile_a_id === user!.id ? m.profile_b_id : m.profile_a_id));

  const [{ data: others }, { data: photos }] = otherIds.length
    ? await Promise.all([
        supabase.from("profiles").select("id, name, birth_date").in("id", otherIds),
        supabase.from("profile_photos").select("profile_id, thumbnail_url").in("profile_id", otherIds).eq("is_primary", true),
      ])
    : [{ data: [] }, { data: [] }];

  const rows = (matches ?? []).map((m) => {
    const otherId = m.profile_a_id === user!.id ? m.profile_b_id : m.profile_a_id;
    const other = others?.find((o) => o.id === otherId);
    const photo = photos?.find((p) => p.profile_id === otherId);
    return { matchId: m.id, matchedAt: m.matched_at, source: m.source, other, photo };
  });

  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <header>
        <h1 className="text-2xl font-bold">
          ❤️ <span className="text-gradient">Match</span>
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          {rows.length ? `${rows.length} match${rows.length === 1 ? "" : "eva"}` : "Tvoji matchevi"}
        </p>
      </header>

      {!rows.length ? (
        <EmptyState
          emoji="❤️"
          title="Još nemaš matcheva"
          description="Kad se ti i neko drugi međusobno lajkujete, ovde se pojavljuje match. Idi na Otkrij da počneš."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map(({ matchId, other, photo, source }) => (
            <li
              key={matchId}
              className="glass flex items-center gap-3 rounded-2xl px-3 py-3"
            >
              {photo?.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo.thumbnail_url}
                  alt={other?.name ?? ""}
                  className="h-14 w-14 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-accent text-lg font-bold text-white">
                  {other?.name?.[0]?.toUpperCase() ?? "?"}
                </div>
              )}
              <div className="flex-1">
                <p className="flex items-center gap-1.5 font-semibold">
                  {other?.name ?? "Korisnik"}
                  {other?.birth_date ? `, ${calculateAge(other.birth_date)}` : ""}
                  {source === "secret_spark" && (
                    <span className="rounded-full bg-[var(--color-bg-elevated)] px-2 py-0.5 text-[10px] font-normal text-[var(--color-text-muted)]">
                      🤫 tajni signal
                    </span>
                  )}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">Chat dolazi u FAZI 4 — uskoro 💬</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
