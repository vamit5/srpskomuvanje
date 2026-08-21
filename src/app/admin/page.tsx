import { createClient } from "@/lib/supabase/server";
import { isoHoursAgo } from "@/lib/utils";

export const metadata = { title: "Admin — Pregled" };

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
    </div>
  );
}

export default async function AdminOverviewPage() {
  const supabase = await createClient();

  const dayAgo = isoHoursAgo(24);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    { count: totalUsers },
    { count: newToday },
    { count: activeLast24h },
    { count: totalMatches },
    { count: totalMessages },
    { count: openReports },
    { count: pendingVerifications },
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", todayStart.toISOString()),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("last_active_at", dayAgo),
    supabase.from("matches").select("id", { count: "exact", head: true }).is("unmatched_at", null),
    supabase.from("messages").select("id", { count: "exact", head: true }),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("verification").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Ukupno korisnika" value={totalUsers ?? 0} />
        <StatCard label="Novih danas" value={newToday ?? 0} />
        <StatCard label="Aktivnih (24h)" value={activeLast24h ?? 0} />
        <StatCard label="Aktivnih matcheva" value={totalMatches ?? 0} />
        <StatCard label="Poruka ukupno" value={totalMessages ?? 0} />
        <StatCard label="Otvorenih prijava" value={openReports ?? 0} />
      </div>

      {(openReports ?? 0) > 0 && (
        <div className="rounded-2xl border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-4 py-3 text-sm">
          ⚠️ Imaš <strong>{openReports}</strong> neobrađenih prijava. Pogledaj tab &ldquo;Prijave&rdquo;.
        </div>
      )}
      {(pendingVerifications ?? 0) > 0 && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 text-sm text-[var(--color-text-muted)]">
          {pendingVerifications} zahtev(a) za verifikaciju čeka pregled (UI za ovo dolazi kasnije).
        </div>
      )}
    </div>
  );
}
