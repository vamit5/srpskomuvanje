import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { NightModerationQueue } from "./NightModerationQueue";

export const metadata = { title: "Admin — Noćno muvanje" };

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
    </div>
  );
}

export default async function AdminNightFlirtingPage() {
  const supabase = await createClient();

  const [
    { count: totalSent },
    { count: autoLocked },
    { count: autoApproved },
    { count: totalUnlocks },
    { data: purchases },
    { count: premiumAccesses },
    { count: reportedCount },
    { count: falsePositives },
    { count: falseNegatives },
    { data: pending },
  ] = await Promise.all([
    supabase.from("night_flirting_content").select("id", { count: "exact", head: true }),
    supabase.from("night_flirting_content").select("id", { count: "exact", head: true }).eq("classification", "yellow"),
    supabase.from("night_flirting_content").select("id", { count: "exact", head: true }).eq("classification", "green"),
    supabase.from("night_flirting_unlocks").select("id", { count: "exact", head: true }),
    supabase.from("credit_transactions").select("amount").eq("reason", "purchase"),
    supabase.from("night_flirting_unlocks").select("id", { count: "exact", head: true }).eq("source", "premium"),
    supabase.from("reports").select("id", { count: "exact", head: true }).ilike("details", "%Noćnog muvanja%"),
    supabase
      .from("night_flirting_content")
      .select("id", { count: "exact", head: true })
      .in("moderation_status", ["admin_unlocked", "admin_marked_safe"]),
    supabase.from("night_flirting_content").select("id", { count: "exact", head: true }).eq("moderation_status", "admin_locked"),
    supabase
      .from("night_flirting_content")
      .select("id, sender_id, receiver_id, kind, original_path, preview_path, classifier_score, classification, created_at")
      .eq("moderation_status", "pending_review")
      .order("created_at", { ascending: true }),
  ]);

  // `amount` na credit_transactions je broj KREDITA, ne novca -- za pravi
  // prihod u € bi trebalo spojiti sa cenom paketa, što ostavljamo za kasnije
  // (Stripe Dashboard već ima tačan izveštaj o prihodu). Ovde prikazujemo
  // broj kupovina kao proxy za aktivnost.
  const purchaseCount = purchases?.length ?? 0;

  const profileIds = Array.from(new Set((pending ?? []).flatMap((p) => [p.sender_id, p.receiver_id])));
  const { data: profiles } = profileIds.length
    ? await supabase.from("profiles").select("id, name").in("id", profileIds)
    : { data: [] };
  const nameOf = (id: string) => profiles?.find((p) => p.id === id)?.name ?? "Nepoznat";

  const admin = await import("@/lib/supabase/admin").then((m) => m.createAdminClient());
  const pendingRows = await Promise.all(
    (pending ?? []).map(async (p) => {
      const { data: signed } = await admin.storage.from("night-flirting").createSignedUrl(p.preview_path, 3600);
      return {
        id: p.id,
        kind: p.kind as "photo" | "video",
        senderName: nameOf(p.sender_id),
        receiverName: nameOf(p.receiver_id),
        score: p.classifier_score,
        classification: p.classification,
        createdAt: p.created_at,
        previewUrl: signed?.signedUrl ?? null,
      };
    })
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Ukupno poslato" value={totalSent ?? 0} />
        <StatCard label="Automatski zaključano" value={autoLocked ?? 0} />
        <StatCard label="Automatski odobreno" value={autoApproved ?? 0} />
        <StatCard label="Broj otključavanja" value={totalUnlocks ?? 0} />
        <StatCard label="Kupovina Iskrica" value={purchaseCount} />
        <StatCard label="Premium pristupi" value={premiumAccesses ?? 0} />
        <StatCard label="Prijavljen sadržaj" value={reportedCount ?? 0} />
        <StatCard label="Verovatno false positive" value={falsePositives ?? 0} />
        <StatCard label="Verovatno false negative" value={falseNegatives ?? 0} />
      </div>
      <p className="text-xs text-[var(--color-text-faint)]">
        &bdquo;False positive/negative&ldquo; su procena na osnovu admin izmena automatske odluke
        (unlock/mark safe = algoritam je bio prestrog; lock = algoritam je bio previše popustljiv),
        ne stvarna ručna klasifikacija svakog slučaja.
      </p>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-muted)]">
          Na ručnom pregledu ({pendingRows.length})
        </h2>
        {!pendingRows.length ? (
          <EmptyState emoji="✅" title="Nema ničega na čekanju" description="Svi granični slučajevi su obrađeni." />
        ) : (
          <NightModerationQueue initialItems={pendingRows} />
        )}
      </section>
    </div>
  );
}
