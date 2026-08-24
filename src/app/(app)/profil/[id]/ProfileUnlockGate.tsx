"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { CreditsModal } from "@/components/CreditsModal";
import { unlockProfile } from "./actions";

export function ProfileUnlockGate({ profileId, name, costCredits }: { profileId: string; name: string; costCredits: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCredits, setShowCredits] = useState(false);

  async function handleUnlock() {
    setBusy(true);
    setError(null);
    const result = await unlockProfile(profileId);
    setBusy(false);

    if (result.insufficientCredits) {
      setShowCredits(true);
      return;
    }
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <section className="flex flex-col items-center gap-2 rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-6 py-8 text-center">
      <Lock size={28} className="text-[var(--color-accent)]" />
      <p className="font-semibold">Kompletan profil je zaključan</p>
      <p className="text-sm text-[var(--color-text-muted)]">
        Bio, interesovanja i ostale slike od <strong>{name}</strong> vidiš tek kad otključaš — Premium ili Credits.
      </p>
      <button
        type="button"
        onClick={handleUnlock}
        disabled={busy}
        className="tap-scale mt-2 rounded-full bg-gradient-accent px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
      >
        {busy ? "..." : `🔓 OTKLJUČAJ · ${costCredits} Credits`}
      </button>
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      {showCredits && <CreditsModal context="profil" onClose={() => setShowCredits(false)} />}
    </section>
  );
}
