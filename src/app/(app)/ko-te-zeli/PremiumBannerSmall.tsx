"use client";

import { useState } from "react";
import { createCheckoutSession } from "../_premium/actions";

/** Sekundarna opcija -- glavni put je otključavanje osoba pojedinačno za Credits (LikerLockedCard). */
export function PremiumBannerSmall() {
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

  return (
    <button
      type="button"
      onClick={handleSubscribe}
      disabled={loading}
      className="tap-scale flex items-center justify-between rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-bg-card)] px-4 py-3 text-left text-xs text-[var(--color-text-muted)] disabled:opacity-50"
    >
      <span>⭐ Ili postani Premium — vidi svih odjednom, bez plaćanja po osobi.</span>
      <span className="shrink-0 font-semibold text-[var(--color-text)]">{loading ? "..." : "9,99€/mes →"}</span>
      {error && <span className="text-[var(--color-danger)]">{error}</span>}
    </button>
  );
}
