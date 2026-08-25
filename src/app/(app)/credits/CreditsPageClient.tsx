"use client";

import { useState } from "react";
import { CreditsModal } from "@/components/CreditsModal";
import { ManageSubscriptionLink } from "@/components/ManageSubscriptionLink";

export function CreditsPageClient({ balance }: { balance: number }) {
  const [showBuy, setShowBuy] = useState(false);

  return (
    <>
      <section className="bg-gradient-accent rounded-3xl p-5 text-center text-white">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Tvoj saldo</p>
        <p className="mt-1 text-4xl font-extrabold">🔥 {balance}</p>
        <p className="text-sm text-white/85">Credit{balance === 1 ? "" : "a"}</p>
        <button
          type="button"
          onClick={() => setShowBuy(true)}
          className="tap-scale mt-4 w-full rounded-full !bg-white px-4 py-3 text-sm font-bold !text-[var(--color-accent)]"
        >
          Kupi još Credits
        </button>
      </section>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 text-sm">
        <p className="font-semibold">🎁 Besplatni Credits</p>
        <p className="mt-1 text-[var(--color-text-muted)]">
          Dobijaš 3 Credits-a besplatno kad prvi put završiš profil (dobrodošlica). Trenutno je to
          jedini način da dobiješ besplatne Credits-e — svi ostali dolaze kroz kupovinu.
        </p>
      </section>

      <ManageSubscriptionLink />

      {showBuy && <CreditsModal context="nocno" onClose={() => setShowBuy(false)} />}
    </>
  );
}
