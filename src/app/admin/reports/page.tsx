import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReportsQueue } from "./ReportsQueue";

export const metadata = { title: "Admin — Prijave" };

export default async function AdminReportsPage() {
  const supabase = await createClient();

  const { data: reports } = await supabase
    .from("reports")
    .select("id, reason, details, status, created_at, reporter_id, reported_profile_id")
    .in("status", ["open", "reviewing"])
    .order("created_at", { ascending: false });

  if (!reports?.length) {
    return (
      <EmptyState emoji="✅" title="Nema otvorenih prijava" description="Sve je trenutno pregledano." />
    );
  }

  const profileIds = Array.from(new Set(reports.flatMap((r) => [r.reporter_id, r.reported_profile_id])));
  const { data: profiles } = await supabase.from("profiles").select("id, name").in("id", profileIds);
  const nameOf = (id: string) => profiles?.find((p) => p.id === id)?.name ?? "Nepoznat";

  const rows = reports.map((r) => ({
    id: r.id,
    reason: r.reason,
    details: r.details,
    createdAt: r.created_at,
    reporterName: nameOf(r.reporter_id),
    reportedId: r.reported_profile_id,
    reportedName: nameOf(r.reported_profile_id),
  }));

  return <ReportsQueue initialReports={rows} />;
}
