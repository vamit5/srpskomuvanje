import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Match" };

export default async function MatchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: matches } = await supabase
    .from("matches")
    .select("id")
    .or(`profile_a_id.eq.${user!.id},profile_b_id.eq.${user!.id}`)
    .is("unmatched_at", null);

  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <header>
        <h1 className="text-2xl font-bold">
          ❤️ <span className="text-gradient">Match</span>
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          {matches?.length ? `${matches.length} match${matches.length === 1 ? "" : "eva"}` : "Tvoji matchevi"}
        </p>
      </header>

      {!matches?.length && (
        <EmptyState
          emoji="❤️"
          title="Još nemaš matcheva"
          description="Kad se ti i neko drugi međusobno lajkujete (ili razmenite tajnu iskru), ovde se pojavljuje match i možete da počnete razgovor. Otkrij dolazi u FAZI 3."
        />
      )}
    </div>
  );
}
