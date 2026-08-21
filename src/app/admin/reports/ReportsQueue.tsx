"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { updateReportStatus, toggleDiscoverable } from "../actions";

const REASON_LABELS: Record<string, string> = {
  lazan_profil: "Lažan profil",
  neprikladan_sadrzaj: "Neprikladan sadržaj",
  uznemiravanje: "Uznemiravanje",
  spam: "Spam",
  prevara: "Prevara",
  maloletna_osoba: "Maloletna osoba",
  nasilje_pretnje: "Nasilje / pretnje",
  drugo: "Drugo",
};

interface ReportRow {
  id: string;
  reason: string;
  details: string | null;
  createdAt: string;
  reporterName: string;
  reportedId: string;
  reportedName: string;
}

export function ReportsQueue({ initialReports }: { initialReports: ReportRow[] }) {
  const [reports, setReports] = useState(initialReports);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleStatus(id: string, status: "resolved" | "dismissed") {
    setBusyId(id);
    const result = await updateReportStatus(id, status);
    setBusyId(null);
    if (!result.error) setReports((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleHideProfile(reportId: string, profileId: string) {
    setBusyId(reportId);
    await toggleDiscoverable(profileId, false);
    setBusyId(null);
  }

  if (!reports.length) {
    return <p className="text-sm text-[var(--color-text-muted)]">Sve prijave su obrađene. 🎉</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {reports.map((r) => (
        <li key={r.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="rounded-full bg-[var(--color-bg-elevated)] px-2.5 py-1 text-xs font-semibold">
              {REASON_LABELS[r.reason] ?? r.reason}
            </span>
            <span className="text-xs text-[var(--color-text-faint)]">
              {new Date(r.createdAt).toLocaleString("sr-RS")}
            </span>
          </div>
          <p className="text-sm">
            <strong>{r.reporterName}</strong> je prijavio/la <strong>{r.reportedName}</strong>
          </p>
          {r.details && (
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">&ldquo;{r.details}&rdquo;</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="md"
              variant="secondary"
              disabled={busyId === r.id}
              onClick={() => handleHideProfile(r.id, r.reportedId)}
            >
              Sakrij profil
            </Button>
            <Button size="md" variant="danger" disabled={busyId === r.id} onClick={() => handleStatus(r.id, "resolved")}>
              Reši
            </Button>
            <Button size="md" variant="ghost" disabled={busyId === r.id} onClick={() => handleStatus(r.id, "dismissed")}>
              Odbaci
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
