"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { approveManualPayment, rejectManualPayment } from "./actions";

export interface ManualPaymentRow {
  id: string;
  profileId: string;
  profileName: string;
  type: string;
  amountLabel: string;
  referenceCode: string;
  status: string;
  createdAt: string;
}

const TYPE_LABEL: Record<string, string> = { premium: "Premium", credits: "Credits", boost: "Boost" };

function ManualPaymentItem({
  row,
  onResolved,
}: {
  row: ManualPaymentRow;
  onResolved: (id: string, status: "approved" | "rejected") => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    if (!confirm(`Potvrđuješ da je uplata sa šifrom ${row.referenceCode} STVARNO stigla na račun?`)) return;
    setBusy(true);
    setError(null);
    const result = await approveManualPayment(row.id);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onResolved(row.id, "approved");
  }

  async function reject() {
    setBusy(true);
    setError(null);
    const result = await rejectManualPayment(row.id);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onResolved(row.id, "rejected");
  }

  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{row.profileName}</span>
        <span className="text-xs text-[var(--color-text-muted)]">{new Date(row.createdAt).toLocaleString("sr-RS")}</span>
      </div>
      <p className="text-xs text-[var(--color-text-muted)]">
        {TYPE_LABEL[row.type] ?? row.type} — {row.amountLabel}
      </p>
      <p className="text-xs">
        Šifra plaćanja: <strong className="text-[var(--color-accent)]">{row.referenceCode}</strong>
      </p>
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      <div className="flex gap-3 text-xs">
        <button type="button" onClick={approve} disabled={busy} className="font-semibold text-[var(--color-success)] disabled:opacity-50">
          Odobri
        </button>
        <button type="button" onClick={reject} disabled={busy} className="text-[var(--color-danger)] underline disabled:opacity-50">
          Odbij
        </button>
      </div>
    </li>
  );
}

export function ManualPaymentsList({ initialRequests }: { initialRequests: ManualPaymentRow[] }) {
  const [rows, setRows] = useState(initialRequests);

  const [prevInitial, setPrevInitial] = useState(initialRequests);
  if (initialRequests !== prevInitial) {
    setPrevInitial(initialRequests);
    setRows(initialRequests);
  }

  function handleResolved(id: string, status: "approved" | "rejected") {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  const pending = rows.filter((r) => r.status === "pending");
  const resolved = rows.filter((r) => r.status !== "pending");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
          Na čekanju ({pending.length})
        </h3>
        {pending.length ? (
          <ul className="flex flex-col gap-2">
            {pending.map((row) => (
              <ManualPaymentItem key={row.id} row={row} onResolved={handleResolved} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">Nema zahteva na čekanju.</p>
        )}
      </div>

      {resolved.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Istorija</h3>
          <ul className="flex flex-col gap-2">
            {resolved.map((row) => (
              <li
                key={row.id}
                className={cn(
                  "flex items-center justify-between rounded-xl border border-[var(--color-border)] p-3 text-xs",
                  row.status === "approved" ? "text-[var(--color-success)]" : "text-[var(--color-text-muted)] opacity-60"
                )}
              >
                <span>
                  {row.profileName} — {TYPE_LABEL[row.type] ?? row.type} — {row.referenceCode}
                </span>
                <span>{row.status === "approved" ? "Odobreno" : "Odbijeno"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
