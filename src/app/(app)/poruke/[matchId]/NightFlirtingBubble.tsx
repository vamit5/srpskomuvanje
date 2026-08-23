"use client";

import { useEffect, useState } from "react";
import { Loader2, Flame, Flag, Lock, Eye, Clock } from "lucide-react";
import { getNightContentView, unlockNightContent, reportNightContent } from "../../_night/actions";
import { CreditsModal } from "@/components/CreditsModal";

function ReportButton({ reported, onClick }: { reported: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Prijavi"
      className="tap-scale absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm"
    >
      <Flag size={13} className={reported ? "fill-current text-[var(--color-danger)]" : undefined} />
    </button>
  );
}

function formatCountdown(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, "0")}`;
}

export function NightFlirtingBubble({ contentId, isMine }: { contentId: string; isMine: boolean }) {
  const [view, setView] = useState<Awaited<ReturnType<typeof getNightContentView>> | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCredits, setShowCredits] = useState(false);
  const [reported, setReported] = useState(false);
  const [now, setNow] = useState(0);

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

  // Zivi odbrojavanje do isteka (samo za prikaz -- server je jedini
  // autoritet, ovo je samo vizuelni pritisak da otkljuca na vreme).
  useEffect(() => {
    if (!view?.expiresAt || view.expired) return;
    const id = setInterval(() => setNow((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [view?.expiresAt, view?.expired]);

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
      <div className="flex h-44 w-44 items-center justify-center rounded-3xl bg-[var(--color-bg-elevated)]">
        <Loader2 size={20} className="animate-spin text-[var(--color-text-muted)]" />
      </div>
    );
  }

  if (view.error) {
    return (
      <div className="w-60 rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-3 text-sm text-[var(--color-text-muted)]">
        🌙 {view.error}
      </div>
    );
  }

  // Poslato, ali još čeka ručni pregled (crveni/granični slučaj) -- ni
  // pošiljalac ne vidi da je "normalno" poslato, da ne pomisli da ništa
  // nije urađeno.
  if (view.pendingReview) {
    return (
      <div className="flex w-60 items-center gap-2 rounded-3xl border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 px-4 py-3 text-sm">
        <Clock size={16} className="shrink-0 text-[var(--color-warning)]" />
        <span>{isMine ? "Šalje se na pregled pre isporuke..." : "Stiže uskoro."}</span>
      </div>
    );
  }

  if (view.expired && !view.isSender) {
    return (
      <div className="flex w-60 flex-col items-center gap-1 rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">
        <span className="text-2xl">⏳</span>
        <p className="font-semibold">Isteklo</p>
        <p className="text-xs">Nije otključano na vreme, sadržaj je trajno obrisan.</p>
      </div>
    );
  }

  if (!view.locked) {
    return (
      <div className="relative w-60 overflow-hidden rounded-3xl bg-black shadow-lg">
        {view.kind === "video" ? (
          <video src={view.url ?? undefined} controls className="max-h-80 w-full" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={view.url ?? undefined} alt="Noćno muvanje" className="max-h-80 w-full object-contain" />
        )}
        {!isMine && <ReportButton reported={reported} onClick={handleReport} />}
        {isMine && (
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2 pt-6 text-[11px] font-medium text-white">
            {view.isFreeForReceiver ? (
              <>
                <Eye size={12} /> Odmah vidljivo
              </>
            ) : (
              <>
                <Lock size={12} /> Zaključano dok ne otključa
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="w-60 overflow-hidden rounded-3xl bg-black shadow-lg">
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={view.url ?? undefined} alt="" className="h-64 w-full object-cover" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-black/50 via-black/55 to-black/70 px-5 text-center text-white">
            <Flame size={26} className="text-[var(--color-accent)] drop-shadow" />
            {isMine ? (
              <>
                <p className="text-sm font-semibold">😈 Poslato</p>
                <p className="text-xs text-white/75">Čeka da otključa</p>
              </>
            ) : (
              <>
                <p className="text-base font-bold">😈 Nešto ti je poslato</p>
                <p className="text-xs text-white/80">Hoćeš da vidiš?</p>
                {view.expiresAt && (
                  <p key={now} className="text-[11px] font-semibold text-[var(--color-danger)]">
                    ⏱ Nestaje za {formatCountdown(view.expiresAt)}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleUnlock}
                  disabled={unlocking}
                  className="tap-scale mt-2 rounded-full bg-gradient-accent px-6 py-3 text-sm font-bold shadow-[0_8px_24px_-8px_rgba(255,45,107,0.6)] disabled:opacity-50"
                >
                  {unlocking
                    ? "..."
                    : view.premium
                      ? "OTKLJUČAJ (Premium) 👑"
                      : `OTKLJUČAJ · ${view.unlockCostCredits} Credits 🔥`}
                </button>
              </>
            )}
          </div>
          {!isMine && <ReportButton reported={reported} onClick={handleReport} />}
        </div>
        {error && <p className="bg-[var(--color-danger)]/20 px-3 py-2 text-center text-xs text-white">{error}</p>}
      </div>
      {showCredits && <CreditsModal onClose={() => setShowCredits(false)} />}
    </>
  );
}
