"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { createCheckoutSession } from "../_premium/actions";

function personWaitingPhrase(n: number): string {
  if (n === 1) return "osoba čeka";
  const lastTwo = n % 100;
  const last = n % 10;
  return last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? "osobe čekaju" : "osoba čeka";
}

export function UnlockCard({ count, photoUrls }: { count: number; photoUrls: string[] }) {
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
        {placeholders.map((_, i) => {
          const url = photoUrls[i];
          return (
            <div key={i} className="relative aspect-square overflow-hidden rounded-2xl bg-[var(--color-bg-elevated)]">
              {url && (
                // Namerno CSS blur (ne pixelate+destruktivan blur kao kod
                // Noćnog muvanja) -- ovo je obična profilna slika, ne
                // osetljiv sadržaj, samo teaser da podstakne pretplatu.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="h-full w-full scale-110 object-cover blur-lg" />
              )}
              <div className="absolute inset-0 flex items-center justify-center text-2xl">🔒</div>
            </div>
          );
        })}
      </div>
      <section className="rounded-2xl bg-gradient-accent p-4 text-center text-white">
        <p className="text-sm font-semibold">
          {count} {personWaitingPhrase(count)} da ih vidiš
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
