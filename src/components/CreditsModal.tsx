"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getCreditPackages, createCreditsCheckoutSession, type CreditPackage } from "@/app/(app)/_night/creditsActions";

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("sr-RS", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

export function CreditsModal({ onClose }: { onClose: () => void }) {
  const [packages, setPackages] = useState<CreditPackage[] | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCreditPackages().then((r) => setPackages(r.packages));
  }, []);

  async function handleBuy(pkgId: string) {
    setBuyingId(pkgId);
    setError(null);
    const result = await createCreditsCheckoutSession(pkgId);
    if (result.error || !result.url) {
      setError(result.error ?? "Nešto nije u redu.");
      setBuyingId(null);
      return;
    }
    window.location.assign(result.url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center">
      <div className="w-full max-w-sm rounded-t-3xl bg-[var(--color-bg-card)] p-5 sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">🔥 Kupi Credits</h2>
          <button type="button" onClick={onClose} className="tap-scale text-[var(--color-text-muted)]" aria-label="Zatvori">
            <X size={20} />
          </button>
        </div>
        <p className="mb-4 text-sm text-[var(--color-text-muted)]">
          Credits otključavaju zaključan sadržaj u Noćnom muvanju. Premium korisnici ne moraju da ih kupuju.
        </p>

        {!packages ? (
          <div className="flex justify-center py-6">
            <Loader2 size={20} className="animate-spin text-[var(--color-text-muted)]" />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {packages.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleBuy(p.id)}
                disabled={buyingId === p.id}
                className="tap-scale flex items-center justify-between rounded-2xl border border-[var(--color-border-strong)] px-4 py-3 text-left disabled:opacity-50"
              >
                <span className="text-sm font-semibold">🔥 {p.credits} Credits</span>
                <span className="text-sm text-[var(--color-text-muted)]">
                  {buyingId === p.id ? "Otvaram..." : formatPrice(p.priceCents, p.currency)}
                </span>
              </button>
            ))}
          </div>
        )}

        {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}

        <Button variant="ghost" className="mt-4 w-full" onClick={onClose}>
          Zatvori
        </Button>
      </div>
    </div>
  );
}
