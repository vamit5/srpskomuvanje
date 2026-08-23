"use client";

import { useEffect, useState } from "react";
import { getBoostInfo, createBoostCheckoutSession, type BoostInfo } from "../_boost/actions";

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("sr-RS", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

function formatRemaining(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  const mins = Math.max(0, Math.round(ms / 60000));
  return `${mins} min`;
}

export function BoostCard({ boostExpiresAt }: { boostExpiresAt: string | null }) {
  const [info, setInfo] = useState<BoostInfo | null>(null);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBoostInfo().then((r) => setInfo(r.info));
  }, []);

  const activeUntil = info?.activeUntil ?? boostExpiresAt;
  const isActive = !!activeUntil && new Date(activeUntil) > new Date();

  async function handleBuy() {
    setBuying(true);
    setError(null);
    const result = await createBoostCheckoutSession();
    if (result.error || !result.url) {
      setError(result.error ?? "Nešto nije u redu.");
      setBuying(false);
      return;
    }
    window.location.assign(result.url);
  }

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">🚀 Boost</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {isActive
              ? `Aktivan još ${formatRemaining(activeUntil!)} — algoritam te pokazuje mnogo više.`
              : `Budi vidljiv/a svima ${info?.durationMinutes ?? 60} minuta, istaknut/a više u algoritmu.`}
          </p>
        </div>
        {!isActive && (
          <button
            type="button"
            onClick={handleBuy}
            disabled={buying || !info}
            className="tap-scale shrink-0 rounded-xl bg-gradient-accent px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {buying ? "..." : info ? formatPrice(info.priceCents, info.currency) : "..."}
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>}
    </section>
  );
}
