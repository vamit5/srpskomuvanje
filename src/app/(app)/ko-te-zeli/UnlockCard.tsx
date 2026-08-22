"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { createCheckoutSession } from "../_premium/actions";

export function UnlockCard({ count }: { count: number }) {
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

  const placeholders = Array.from({ length: Math.min(count, 6) });

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        {placeholders.map((_, i) => (
          <div
            key={i}
            className="flex aspect-square items-center justify-center rounded-2xl bg-[var(--color-bg-elevated)] text-2xl backdrop-blur-md"
          >
            🔒
          </div>
        ))}
      </div>
      <section className="rounded-2xl bg-gradient-accent p-4 text-center text-white">
        <p className="text-sm font-semibold">
          {count} {count === 1 ? "osoba čeka" : "osobe/a čekaju"} da ih vidiš
        </p>
        <p className="mt-1 text-xs text-white/85">
          Premium otključava ko su tačno — i daš im lajk nazad jednim dodirom.
        </p>
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
    </div>
  );
}
