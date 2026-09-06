"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getCreditPackages, createCreditsCheckoutSession, type CreditPackage } from "@/app/(app)/_night/creditsActions";

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("sr-RS", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

const DESCRIPTIONS = {
  nocno: "Credits otključavaju zaključan sadržaj u Noćnom muvanju. Premium korisnici ne moraju da ih kupuju.",
  osamnaest: "Credits otključavaju zaključan sadržaj u 18+ Muvanju. Premium korisnici ne moraju da ih kupuju.",
  profil: "Credits otključavaju kompletan profil (bio, interesovanja, dodatne slike). Premium korisnici ne moraju da ih kupuju.",
  kotezeli: "Credits otključavaju ko te je lajkovao, osobu po osobu. Premium korisnici vide sve odjednom, bez plaćanja po osobi.",
} as const;

export function CreditsModal({
  onClose,
  context = "nocno",
}: {
  onClose: () => void;
  context?: keyof typeof DESCRIPTIONS;
}) {
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
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center">
      {/* z-[60], NE z-50 -- BottomNav je TAKODJE fixed na z-50, pa je pri
          istom z-indexu iscrtavan PREKO donjeg dela modala (poslednji
          paket, "Zatvori" dugme) po redosledu u DOM-u, bez obzira na
          unutrasnji scroll. max-h + unutrasnji overflow-y-auto na listi
          paketa -- 5 paketa (5/10/25/50/100) zna da bude vise od visine
          ekrana na nizim telefonima, pa se poslednji paket i "Zatvori"
          dugme odseku van vidljive zone. Header/opis/dugme ostaju fiksni,
          scroluje se SAMO lista paketa u sredini. */}
      <div className="flex max-h-[85dvh] w-full max-w-sm flex-col rounded-t-3xl bg-[var(--color-bg-card)] sm:rounded-3xl">
        <div className="p-5 pb-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">🔥 Kupi Credits</h2>
            <button type="button" onClick={onClose} className="tap-scale text-[var(--color-text-muted)]" aria-label="Zatvori">
              <X size={20} />
            </button>
          </div>
          <p className="mb-4 text-sm text-[var(--color-text-muted)]">{DESCRIPTIONS[context]}</p>
        </div>

        <div className="overflow-y-auto px-5">
          {!packages ? (
            <div className="flex justify-center py-6">
              <Loader2 size={20} className="animate-spin text-[var(--color-text-muted)]" />
            </div>
          ) : (
            <div className="flex flex-col gap-2 pb-1">
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
        </div>

        <div className="p-5 pt-3">
          {error && <p className="mb-1 text-sm text-[var(--color-danger)]">{error}</p>}
          <Button variant="ghost" className="w-full" onClick={onClose}>
            Zatvori
          </Button>
        </div>
      </div>
    </div>
  );
}
