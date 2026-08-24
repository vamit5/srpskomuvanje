"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditsModal } from "@/components/CreditsModal";
import { unlockProfile } from "../profil/[id]/actions";

export function LikerLockedCard({ id, photoUrl, costCredits }: { id: string; photoUrl: string | null; costCredits: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCredits, setShowCredits] = useState(false);

  async function handleUnlock() {
    setBusy(true);
    setError(null);
    const result = await unlockProfile(id);
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
    <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3">
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-[var(--color-bg-elevated)]">
        {photoUrl && (
          // Namerno CSS blur (ne pixelate+destruktivan) -- obicna profilna
          // slika, ne osetljiv sadrzaj, samo teaser.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" className="h-full w-full scale-125 object-cover blur-md" />
        )}
        <div className="absolute inset-0 flex items-center justify-center text-lg">🔒</div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--color-text-muted)]">Neko te je lajkovao</p>
        {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      </div>
      <button
        type="button"
        onClick={handleUnlock}
        disabled={busy}
        className="tap-scale shrink-0 rounded-full bg-gradient-accent px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
      >
        {busy ? "..." : `🔓 Otključaj za ${costCredits} Credit${costCredits === 1 ? "" : "a"}`}
      </button>
      {showCredits && <CreditsModal context="kotezeli" onClose={() => setShowCredits(false)} />}
    </div>
  );
}
