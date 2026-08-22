"use client";

import { useEffect, useState } from "react";
import { Loader2, Flame, Flag } from "lucide-react";
import { getNightContentView, unlockNightContent, reportNightContent } from "../../_night/actions";
import { CreditsModal } from "./CreditsModal";

export function NightFlirtingBubble({ contentId, isMine }: { contentId: string; isMine: boolean }) {
  const [view, setView] = useState<Awaited<ReturnType<typeof getNightContentView>> | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCredits, setShowCredits] = useState(false);
  const [reported, setReported] = useState(false);

  async function handleReport() {
    if (reported) return;
    await reportNightContent(contentId, "neprikladan_sadrzaj", "Prijavljeno iz Noćnog muvanja.");
    setReported(true);
  }

  function load() {
    getNightContentView(contentId).then(setView);
  }

  useEffect(() => {
    getNightContentView(contentId).then(setView);
  }, [contentId]);

  async function handleUnlock() {
    if (!view) return;
    if (!view.premium && view.walletBalance < view.unlockCostCredits) {
      setShowCredits(true);
      return;
    }
    setUnlocking(true);
    setError(null);
    const result = await unlockNightContent(contentId);
    setUnlocking(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    await load();
  }

  if (!view) {
    return (
      <div className="flex h-40 w-40 items-center justify-center rounded-2xl bg-[var(--color-bg-elevated)]">
        <Loader2 size={20} className="animate-spin text-[var(--color-text-muted)]" />
      </div>
    );
  }

  if (view.error) {
    return (
      <div className="w-56 rounded-2xl bg-[var(--color-bg-elevated)] px-4 py-3 text-sm text-[var(--color-text-muted)]">
        🌙 {view.error}
      </div>
    );
  }

  if (!view.locked) {
    return (
      <div className="relative w-56 overflow-hidden rounded-2xl bg-black">
        {view.kind === "video" ? (
          <video src={view.url ?? undefined} controls className="max-h-80 w-full" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={view.url ?? undefined} alt="Noćno muvanje" className="max-h-80 w-full object-contain" />
        )}
        {!isMine && (
          <button
            type="button"
            onClick={handleReport}
            aria-label="Prijavi"
            className="tap-scale absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
          >
            <Flag size={12} className={reported ? "fill-current" : undefined} />
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="w-56 overflow-hidden rounded-2xl bg-black">
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={view.url ?? undefined} alt="" className="h-56 w-full object-cover" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 px-4 text-center text-white">
            <Flame size={22} />
            {isMine ? (
              <p className="text-xs font-medium">😈 Poslato — čeka da se otključa</p>
            ) : (
              <>
                <p className="text-sm font-semibold">😈 Nešto ti je poslato.</p>
                <p className="text-xs text-white/80">Hoćeš da vidiš?</p>
                <button
                  type="button"
                  onClick={handleUnlock}
                  disabled={unlocking}
                  className="tap-scale mt-1 rounded-full bg-gradient-accent px-4 py-2 text-xs font-bold disabled:opacity-50"
                >
                  {unlocking
                    ? "..."
                    : view.premium
                      ? "OTKLJUČAJ (Premium)"
                      : `OTKLJUČAJ · ${view.unlockCostCredits} 🔥`}
                </button>
              </>
            )}
          </div>
          {!isMine && (
            <button
              type="button"
              onClick={handleReport}
              aria-label="Prijavi"
              className="tap-scale absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
            >
              <Flag size={12} className={reported ? "fill-current" : undefined} />
            </button>
          )}
        </div>
        {error && <p className="bg-[var(--color-danger)]/20 px-2 py-1 text-center text-[10px] text-white">{error}</p>}
      </div>
      {showCredits && <CreditsModal onClose={() => setShowCredits(false)} />}
    </>
  );
}
