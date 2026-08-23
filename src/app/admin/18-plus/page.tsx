import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Admin — 18+ Muvanje" };

function StatCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
      {hint && <p className="mt-1 text-[10px] text-[var(--color-text-faint)]">{hint}</p>}
    </div>
  );
}

function pct(numerator: number, denominator: number): string {
  if (!denominator) return "—";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

export default async function Admin18PlusPage() {
  const supabase = await createClient();

  const nowISO = new Date().toISOString();

  const [{ count: totalSignals }, { count: revealedSignals }, { count: activeBoosts }, { count: creditsSpentOn18Plus }, { data: flaggedRows }] =
    await Promise.all([
      supabase.from("krevet_signals").select("id", { count: "exact", head: true }),
      supabase.from("krevet_signals").select("id", { count: "exact", head: true }).eq("status", "revealed"),
      supabase.from("profiles").select("id", { count: "exact", head: true }).gt("boost_expires_at", nowISO),
      supabase
        .from("credit_transactions")
        .select("id", { count: "exact", head: true })
        .eq("reason", "unlock_spend")
        .is("related_content_id", null),
      // Broj razlicitih korisnika koji su BAR JEDNOM poslali "krevet" (kandidat pool za 18+ Muvanje).
      supabase.from("krevet_signals").select("from_profile_id"),
    ]);

  const flaggedCount = new Set((flaggedRows ?? []).map((r) => r.from_profile_id)).size;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-muted)]">Krevet signali</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Poslatih signala" value={totalSignals ?? 0} />
          <StatCard label="Otključano" value={revealedSignals ?? 0} />
          <StatCard label="Reveal rate" value={pct(revealedSignals ?? 0, totalSignals ?? 0)} />
          <StatCard label="Korisnika u 18+ pool-u" value={flaggedCount} hint="bar jednom izabrali Krevet" />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-muted)]">Monetizacija</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Otključavanja uz Credits" value={creditsSpentOn18Plus ?? 0} />
          <StatCard label="Aktivnih Boost-ova sada" value={activeBoosts ?? 0} />
        </div>
        <p className="mt-2 text-xs text-[var(--color-text-faint)]">
          Stvaran prihod u € (Credits paketi + Boost kupovine) prati se u Stripe Dashboard-u i na stranici{" "}
          <a href="/admin/users" className="underline">
            Korisnici
          </a>
          .
        </p>
      </div>
    </div>
  );
}
