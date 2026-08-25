"use client";

import { useState } from "react";
import { createBillingPortalSession } from "@/app/(app)/_premium/actions";

/**
 * Dugme za upravljanje pretplatom -- ponovo iskorisceno na /profil i na
 * /credits (izricit zahtev da bude dostupno na oba mesta). Radi i kad
 * korisnik NEMA aktivnu pretplatu -- tada samo prikaze jasnu poruku
 * umesto da baci Stripe gresku.
 */
export function ManageSubscriptionLink({ className = "" }: { className?: string }) {
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setNotice(null);
    const result = await createBillingPortalSession();
    if (result.error || !result.url) {
      setLoading(false);
      setNotice(result.error ?? "Nešto nije u redu.");
      return;
    }
    window.location.href = result.url;
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="tap-scale glass flex w-full items-center justify-between rounded-2xl px-4 py-3.5 text-sm font-medium disabled:opacity-60"
      >
        <span>⚙️ Upravljaj pretplatom</span>
        <span className="text-xs text-[var(--color-text-muted)]">{loading ? "Otvaram..." : "→"}</span>
      </button>
      {notice && <p className="mt-2 text-xs text-[var(--color-text-muted)]">{notice}</p>}
    </div>
  );
}
