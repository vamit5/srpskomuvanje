"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { createCheckoutSession, createBillingPortalSession } from "../_premium/actions";

export function PremiumCard({
  isPremium,
  currentPeriodEnd,
}: {
  isPremium: boolean;
  currentPeriodEnd: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe() {
    setLoading(true);
    setError(null);
    const result = await createCheckoutSession();
    if (result.error || !result.url) {
      setError(result.error ?? "Nešto nije u redu.");
      setLoading(false);
      return;
    }
    window.location.href = result.url;
  }

  async function handleManage() {
    setLoading(true);
    setError(null);
    const result = await createBillingPortalSession();
    if (result.error || !result.url) {
      setError(result.error ?? "Nešto nije u redu.");
      setLoading(false);
      return;
    }
    window.location.href = result.url;
  }

  if (isPremium) {
    return (
      <section className="glass rounded-2xl p-4">
        <p className="text-sm font-semibold">
          ⭐ <span className="text-gradient">Premium je aktivan</span>
        </p>
        {currentPeriodEnd && (
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Važi do {new Date(currentPeriodEnd).toLocaleDateString("sr-RS")}
          </p>
        )}
        {error && <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>}
        <Button variant="secondary" className="mt-3 w-full" onClick={handleManage} disabled={loading}>
          {loading ? "Otvaram..." : "Upravljaj pretplatom"}
        </Button>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-gradient-accent p-4 text-white">
      <p className="text-sm font-semibold">⭐ Postani Premium</p>
      <ul className="mt-1.5 flex flex-col gap-0.5 text-xs text-white/90">
        <li>👀 Vidi ko te je sve lajkovao</li>
        <li>⚔️ Neograničeni Duel</li>
      </ul>
      {error && <p className="mt-2 text-xs text-white">{error}</p>}
      <Button
        variant="secondary"
        className="mt-3 w-full !bg-white !text-[var(--color-accent)]"
        onClick={handleSubscribe}
        disabled={loading}
      >
        {loading ? "Otvaram..." : "Postani Premium"}
      </Button>
    </section>
  );
}
