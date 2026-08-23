import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Admin — Tajna soba" };

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

export default async function AdminSecretRoomPage() {
  const supabase = await createClient();
  const now = new Date();
  const nowISO = now.toISOString();
  const sevenDaysAgoISO = new Date(now.getTime() - 7 * 86400000).toISOString();

  const [
    { count: totalRounds },
    { count: activeRoundsNow },
    { data: activeProfilesRaw },
    { data: endedRounds },
    { count: totalRequests },
    { count: acceptedRequests },
    { count: rejectedRequests },
    { count: expiredRequests },
    { count: totalPairs },
    { count: chemistryPairs },
    { count: chatStartedEvents },
    { count: paymentStarted },
    { count: paymentCompleted },
    { count: creditsSpentOpens },
  ] = await Promise.all([
    supabase.from("secret_room_rounds").select("id", { count: "exact", head: true }),
    supabase.from("secret_room_rounds").select("id", { count: "exact", head: true }).eq("status", "active").gt("expires_at", nowISO),
    supabase.from("secret_room_rounds").select("profile_id").gte("created_at", sevenDaysAgoISO),
    supabase.from("secret_room_rounds").select("started_at, ended_at").not("ended_at", "is", null),
    supabase.from("secret_room_requests").select("id", { count: "exact", head: true }),
    supabase.from("secret_room_requests").select("id", { count: "exact", head: true }).eq("status", "accepted"),
    supabase.from("secret_room_requests").select("id", { count: "exact", head: true }).eq("status", "rejected"),
    supabase.from("secret_room_requests").select("id", { count: "exact", head: true }).eq("status", "expired"),
    supabase.from("secret_room_pairs").select("id", { count: "exact", head: true }),
    supabase.from("secret_room_pairs").select("id", { count: "exact", head: true }).eq("status", "chemistry_confirmed"),
    supabase.from("activity_events").select("id", { count: "exact", head: true }).eq("event_name", "secret_room_chat_started"),
    supabase.from("activity_events").select("id", { count: "exact", head: true }).eq("event_name", "secret_room_payment_started"),
    supabase.from("activity_events").select("id", { count: "exact", head: true }).eq("event_name", "secret_room_payment_completed"),
    // Trosenje Credits-a specificno za Tajnu sobu se prepoznaje po tome sto
    // NEMA related_content_id (Nocno muvanje ga UVEK postavlja na id sadrzaja) --
    // vidi migraciju 0013 (secret_room_respond_request).
    supabase
      .from("credit_transactions")
      .select("id", { count: "exact", head: true })
      .eq("reason", "unlock_spend")
      .is("related_content_id", null),
  ]);

  const activeUsers7d = new Set((activeProfilesRaw ?? []).map((r) => r.profile_id)).size;

  const durations = (endedRounds ?? [])
    .map((r) => (new Date(r.ended_at as string).getTime() - new Date(r.started_at).getTime()) / 1000)
    .filter((s) => s >= 0 && s < 3600);
  const avgDurationSec = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

  const premiumOpens = Math.max(0, (acceptedRequests ?? 0) - (creditsSpentOpens ?? 0));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-muted)]">Aktivnost</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Ulazaka u Tajnu sobu" value={totalRounds ?? 0} />
          <StatCard label="Trenutno aktivnih rundi" value={activeRoundsNow ?? 0} hint="uživo, u ovom trenutku" />
          <StatCard label="Aktivnih korisnika (7d)" value={activeUsers7d} />
          <StatCard label="Prosečno vreme u rundi" value={avgDurationSec ? `${avgDurationSec}s` : "—"} />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-muted)]">Zahtevi (MUVAJ → OTVORI)</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Poslatih zahteva" value={totalRequests ?? 0} />
          <StatCard label="Acceptance rate" value={pct(acceptedRequests ?? 0, totalRequests ?? 0)} />
          <StatCard label="Rejection rate" value={pct(rejectedRequests ?? 0, totalRequests ?? 0)} />
          <StatCard label="Expiration rate" value={pct(expiredRequests ?? 0, totalRequests ?? 0)} />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-muted)]">Hemija i konverzija</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Zajedničkih soba" value={totalPairs ?? 0} />
          <StatCard label="Chemistry rate" value={pct(chemistryPairs ?? 0, totalPairs ?? 0)} />
          <StatCard label="Chat conversion" value={pct(chatStartedEvents ?? 0, chemistryPairs ?? 0)} hint="od potvrđene hemije do 'Nastavi muvanje'" />
          <StatCard label="Payment conversion" value={pct(paymentCompleted ?? 0, paymentStarted ?? 0)} />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-muted)]">Monetizacija</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Otvaranja uz Credits" value={creditsSpentOpens ?? 0} />
          <StatCard label="Otvaranja uz Premium" value={premiumOpens} hint="prihvaćeno bez trošenja Credits-a" />
        </div>
        <p className="mt-2 text-xs text-[var(--color-text-faint)]">
          Stvaran prihod u € (od kupovine Credits paketa) prati se u Stripe Dashboard-u i na stranici{" "}
          <a href="/admin/users" className="underline">
            Korisnici
          </a>{" "}
          po nalogu — ovde ne procenjujemo iznos, samo aktivnost.
        </p>
      </div>
    </div>
  );
}
