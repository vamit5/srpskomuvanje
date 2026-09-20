"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { requestManualPayment, type ManualPaymentRequestResult } from "@/app/(app)/_manual_payment/actions";

/** Modal za uplatu na racun -- privremeno resenje dok Stripe pregled ne
 * prodje (nalog trenutno ne moze da naplacuje uzivo karticom). */
export function ManualPaymentModal({
  type,
  packageId,
  onClose,
}: {
  type: "premium" | "credits" | "boost";
  packageId?: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<ManualPaymentRequestResult | null>(null);

  useEffect(() => {
    requestManualPayment(type, packageId).then((r) => {
      setLoading(false);
      setError(r.error);
      setRequest(r.request);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-t-3xl bg-[var(--color-bg-card)] p-5 sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">🏦 Uplata na račun</h2>
          <button type="button" onClick={onClose} aria-label="Zatvori" className="tap-scale text-[var(--color-text-muted)]">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 size={20} className="animate-spin text-[var(--color-text-muted)]" />
          </div>
        ) : error || !request ? (
          <p className="text-sm text-[var(--color-danger)]">{error ?? "Nešto nije u redu."}</p>
        ) : (
          <>
            <div className="flex flex-col gap-2 rounded-2xl border border-[var(--color-border-strong)] p-4 text-sm">
              <p>
                <span className="text-[var(--color-text-muted)]">Primalac:</span> {request.bank.accountName}
              </p>
              <p>
                <span className="text-[var(--color-text-muted)]">Račun:</span> {request.bank.accountNumber}
              </p>
              <p>
                <span className="text-[var(--color-text-muted)]">Banka:</span> {request.bank.bankName}
              </p>
              <p>
                <span className="text-[var(--color-text-muted)]">Iznos:</span> {request.amountLabel}
              </p>
              <p>
                <span className="text-[var(--color-text-muted)]">Poziv na broj / šifra plaćanja:</span>{" "}
                <strong className="text-[var(--color-accent)]">{request.referenceCode}</strong>
              </p>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              OBAVEZNO upiši šifru <strong>{request.referenceCode}</strong> u poziv na broj/svrhu uplate — bez nje ne možemo da
              uparimo tvoju uplatu. {request.bank.note}
            </p>
          </>
        )}

        <Button variant="ghost" className="w-full" onClick={onClose}>
          Zatvori
        </Button>
      </div>
    </div>
  );
}
