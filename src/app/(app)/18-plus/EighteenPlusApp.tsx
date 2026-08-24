"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { calculateAge } from "@/lib/utils";
import { CreditsModal } from "@/components/CreditsModal";
import {
  revealKrevetSignal,
  startEighteenPlusChat,
  type EighteenPlusCandidate,
  type PendingKrevetSignal,
  type RevealedKrevet,
} from "./actions";

function PendingSignalCard({
  signal,
  costCredits,
  onRevealed,
}: {
  signal: PendingKrevetSignal;
  costCredits: number;
  onRevealed: (signalId: string, from: RevealedKrevet) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCredits, setShowCredits] = useState(false);

  async function reveal() {
    setBusy(true);
    setError(null);
    const result = await revealKrevetSignal(signal.signalId);
    setBusy(false);
    if (result.insufficientCredits) {
      setShowCredits(true);
      return;
    }
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.from) onRevealed(signal.signalId, result.from);
  }

  return (
    <div className="flex w-36 shrink-0 flex-col items-center gap-2 rounded-2xl border border-[var(--color-accent-to)]/40 bg-black/30 p-3 text-center text-white">
      <div className="relative h-20 w-20 overflow-hidden rounded-full">
        {signal.fromPhotoUrl ? (
          // Namerno CSS blur -- obicna profilna slika (vec javno vidljiva
          // drugde u appu), samo veza sa OVIM signalom je skrivena. Vidi
          // komentar u migraciji 0014 (get_muvaj_pending_krevet_list).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={signal.fromPhotoUrl} alt="" className="h-full w-full scale-125 object-cover blur-lg brightness-75" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-accent text-2xl">😈</div>
        )}
        <div className="absolute inset-0 flex items-center justify-center text-xl">🔒</div>
      </div>
      <p className="text-xs text-white/70">Neko hoće s tobom u krevet</p>
      <button
        type="button"
        onClick={reveal}
        disabled={busy}
        className="pulse-glow tap-scale w-full rounded-xl bg-gradient-accent px-3 py-2 text-xs font-bold disabled:opacity-50"
      >
        {busy ? "..." : `OTKLJUČAJ za ${costCredits} Credit${costCredits === 1 ? "" : "a"}`}
      </button>
      {error && <p className="text-[10px] text-[var(--color-danger)]">{error}</p>}
      {showCredits && <CreditsModal context="osamnaest" onClose={() => setShowCredits(false)} />}
    </div>
  );
}

function RevealedCard({ from }: { from: RevealedKrevet }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const age = calculateAge(from.birthDate);

  async function openChat() {
    setStarting(true);
    const result = await startEighteenPlusChat(from.id);
    setStarting(false);
    if (result.matchId) router.push(`/18-plus/chat/${result.matchId}`);
  }

  return (
    <div className="flex w-36 shrink-0 flex-col items-center gap-2 rounded-2xl border border-white/15 bg-black/30 p-3 text-center text-white">
      {from.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={from.photoUrl} alt={from.name} className="h-20 w-20 rounded-full object-cover" />
      ) : (
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-accent text-xl">👤</div>
      )}
      <p className="text-sm font-bold">
        {from.name}, {age}
      </p>
      <button
        type="button"
        onClick={openChat}
        disabled={starting}
        className="tap-scale w-full rounded-xl bg-gradient-accent px-3 py-2 text-xs font-bold disabled:opacity-50"
      >
        {starting ? "..." : "💬 Piši"}
      </button>
    </div>
  );
}

export function EighteenPlusApp({
  initialSignals,
  initialCandidates,
  costCredits,
}: {
  initialSignals: PendingKrevetSignal[];
  initialCandidates: EighteenPlusCandidate[];
  costCredits: number;
}) {
  const router = useRouter();
  const signals = initialSignals;
  const [revealed, setRevealed] = useState<Record<string, RevealedKrevet>>({});
  const [startingId, setStartingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleRevealed(signalId: string, from: RevealedKrevet) {
    setRevealed((prev) => ({ ...prev, [signalId]: from }));
  }

  async function handleCandidateClick(candidate: EighteenPlusCandidate) {
    setStartingId(candidate.id);
    setError(null);
    const result = await startEighteenPlusChat(candidate.id);
    setStartingId(null);
    if (result.error || !result.matchId) {
      setError(result.error ?? "Nešto nije u redu.");
      return;
    }
    router.push(`/18-plus/chat/${result.matchId}`);
  }

  return (
    <div className="flex flex-col gap-5 rounded-3xl bg-gradient-to-b from-[#2b0b18] via-[#3a0d20] to-[#1a0710] px-4 py-5 text-white">
      <header>
        <h1 className="text-xl font-extrabold">😈 18+ Muvanje</h1>
        <p className="mt-1 text-xs leading-snug text-white/70">
          Ovde se pojavljuju samo osobe koje su večeras spremne da ih odvedeš u krevet 😈 Ili da igraš hot igrice sa
          njima, potpuno diskretno.
        </p>
      </header>

      <section>
        <h2 className="mb-2 text-sm font-bold text-white/90">😈 Neko hoće s tobom u krevet</h2>
        {signals.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-center text-xs text-white/60">
            Još niko — kad neko izabere Krevet na tebe, pojaviće se ovde.
          </p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {signals.map((s) =>
              revealed[s.signalId] ? (
                <RevealedCard key={s.signalId} from={revealed[s.signalId]} />
              ) : (
                <PendingSignalCard key={s.signalId} signal={s} costCredits={costCredits} onRevealed={handleRevealed} />
              )
            )}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-white/90">🔥 Pozovi nekoga u krevet</h2>
        {error && <p className="mb-2 text-center text-xs text-[var(--color-danger)]">{error}</p>}
        {initialCandidates.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 px-6 py-8 text-center text-white/70">
            <p className="text-3xl">🌙</p>
            <p className="mt-2 font-semibold">Nema još nikog ovde</p>
            <p className="mt-1 text-sm">Svrati kasnije — čim neko izabere 😈 Krevet u Muvaj, pojaviće se ovde.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {initialCandidates.map((c, i) => (
              <motion.button
                key={c.id}
                type="button"
                onClick={() => handleCandidateClick(c)}
                disabled={startingId === c.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="tap-scale relative aspect-square overflow-hidden rounded-2xl bg-black/30 disabled:opacity-60"
              >
                {c.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.photoUrl} alt={c.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl">👤</div>
                )}
                {c.isBoosted && (
                  <span className="absolute left-1 top-1 rounded-full bg-gradient-accent px-1.5 py-0.5 text-[9px] font-bold">
                    🚀
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-2 pb-1.5 pt-4 text-left text-[11px] font-semibold">
                  {startingId === c.id ? "..." : c.name}
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
