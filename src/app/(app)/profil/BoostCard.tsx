"use client";

import { useEffect, useState } from "react";
import { getBoostInfo, type BoostInfo } from "../_boost/actions";
import { ManualPaymentModal } from "@/components/ManualPaymentModal";

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
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    getBoostInfo().then((r) => setInfo(r.info));
  }, []);

  const activeUntil = info?.activeUntil ?? boostExpiresAt;
  const isActive = !!activeUntil && new Date(activeUntil) > new Date();

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
            onClick={() => setShowManual(true)}
            disabled={!info}
            className="tap-scale shrink-0 rounded-xl bg-gradient-accent px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {info ? formatPrice(info.priceCents, info.currency) : "..."}
          </button>
        )}
      </div>
      {showManual && <ManualPaymentModal type="boost" onClose={() => setShowManual(false)} />}
    </section>
  );
}
