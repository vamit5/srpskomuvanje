"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { calculateAge } from "@/lib/utils";
import { CreditsModal } from "@/components/CreditsModal";
import { MatchCelebration } from "@/components/MatchCelebration";
import { chooseMuvaj, type MuvajChoice } from "../muvaj/actions";
import {
  revealKrevetSignal,
  type EighteenPlusCandidate,
  type PendingKrevetSignal,
  type RevealedKrevet,
} from "./actions";

function PendingSignalCard({
  signal,
  onRevealed,
}: {
  signal: PendingKrevetSignal;
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
    <div className="flex w-40 shrink-0 flex-col items-center gap-2 rounded-2xl border border-[var(--color-accent-to)]/40 bg-black/30 p-3 text-center text-white">
      <motion.div
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 1.3, repeat: Infinity }}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-accent text-2xl"
      >
        😈
      </motion.div>
      <p className="text-xs text-white/70">Neko hoće s tobom u krevet</p>
      <button
        type="button"
        onClick={reveal}
        disabled={busy}
        className="tap-scale w-full rounded-xl bg-gradient-accent px-3 py-2 text-xs font-bold disabled:opacity-50"
      >
        {busy ? "..." : "OTKLJUČAJ"}
      </button>
      {error && <p className="text-[10px] text-[var(--color-danger)]">{error}</p>}
      {showCredits && <CreditsModal onClose={() => setShowCredits(false)} />}
    </div>
  );
}

function RevealedCard({ from, onSent }: { from: RevealedKrevet; onSent: () => void }) {
  const [busy, setBusy] = useState<MuvajChoice | null>(null);
  const [matched, setMatched] = useState(false);
  const age = calculateAge(from.birthDate);

  async function respond(choice: MuvajChoice) {
    setBusy(choice);
    const result = await chooseMuvaj(from.id, choice);
    setBusy(null);
    if (result.matched) setMatched(true);
    onSent();
  }

  return (
    <div className="flex w-40 shrink-0 flex-col items-center gap-2 rounded-2xl border border-white/15 bg-black/30 p-3 text-center text-white">
      {from.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={from.photoUrl} alt={from.name} className="h-16 w-16 rounded-full object-cover" />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-accent text-xl">👤</div>
      )}
      <p className="text-sm font-bold">
        {from.name}, {age}
      </p>
      {matched ? (
        <p className="text-xs font-bold text-[var(--color-success)]">🔥 MATCH!</p>
      ) : (
        <div className="flex w-full gap-1">
          <button
            type="button"
            onClick={() => respond("upoznavanje")}
            disabled={!!busy}
            className="tap-scale flex-1 rounded-lg bg-white/10 px-2 py-1.5 text-[10px] font-semibold disabled:opacity-50"
          >
            🤝
          </button>
          <button
            type="button"
            onClick={() => respond("krevet")}
            disabled={!!busy}
            className="tap-scale flex-1 rounded-lg bg-white/10 px-2 py-1.5 text-[10px] font-semibold disabled:opacity-50"
          >
            😈
          </button>
          <button
            type="button"
            onClick={() => respond("nista")}
            disabled={!!busy}
            className="tap-scale flex-1 rounded-lg bg-white/10 px-2 py-1.5 text-[10px] font-semibold disabled:opacity-50"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

export function EighteenPlusApp({
  initialSignals,
  initialCandidates,
}: {
  initialSignals: PendingKrevetSignal[];
  initialCandidates: EighteenPlusCandidate[];
}) {
  const router = useRouter();
  const [signals, setSignals] = useState(initialSignals);
  const [revealed, setRevealed] = useState<Record<string, RevealedKrevet>>({});
  const [candidates, setCandidates] = useState(initialCandidates);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matched, setMatched] = useState<EighteenPlusCandidate | null>(null);

  const current = candidates[0];

  function handleRevealed(signalId: string, from: RevealedKrevet) {
    setRevealed((prev) => ({ ...prev, [signalId]: from }));
  }

  function removeSignalIfDone(signalId: string) {
    setSignals((prev) => prev.filter((s) => s.signalId !== signalId));
    setRevealed((prev) => {
      const next = { ...prev };
      delete next[signalId];
      return next;
    });
  }

  async function handleChoice(choice: MuvajChoice) {
    if (!current || pending) return;
    setPending(true);
    setError(null);
    const target = current;
    setCandidates((prev) => prev.slice(1));

    const result = await chooseMuvaj(target.id, choice);
    setPending(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.matched) setMatched(target);
  }

  const age = current ? calculateAge(current.birthDate) : null;

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#2b0b18] via-[#3a0d20] to-[#1a0710] px-4 pb-4 pt-4 safe-top text-white">
      <header className="mb-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-extrabold">😈 18+ Muvanje</h1>
          <Link href="/poruke" className="text-xs text-white/60 underline">
            Poruke →
          </Link>
        </div>
        <p className="mt-1 text-xs leading-snug text-white/70">
          Ovde se pojavljuju samo osobe koje su večeras spremne da ih odvedeš u krevet 😈 Ili da igraš hot igrice sa
          njima, potpuno diskretno.
        </p>
      </header>

      {signals.length > 0 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {signals.map((s) =>
            revealed[s.signalId] ? (
              <RevealedCard key={s.signalId} from={revealed[s.signalId]} onSent={() => removeSignalIfDone(s.signalId)} />
            ) : (
              <PendingSignalCard key={s.signalId} signal={s} onRevealed={handleRevealed} />
            )
          )}
        </div>
      )}

      <div className="relative flex-1">
        {!current ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-3xl border border-white/10 bg-black/20 px-6 text-center text-white/70">
            <span className="text-4xl">🌙</span>
            <p className="font-semibold">Nema još nikog ovde</p>
            <p className="text-sm">Svrati kasnije — čim neko izabere 😈 Krevet u Muvaj, pojaviće se ovde.</p>
          </div>
        ) : (
          <div className="relative h-full overflow-hidden rounded-3xl bg-black/30">
            {current.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={current.photoUrl} alt={current.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-7xl">👤</div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent px-5 pb-5 pt-24">
              {current.isBoosted && (
                <span className="mb-2 inline-block rounded-full bg-gradient-accent px-2.5 py-1 text-xs font-bold">
                  🚀 Boost
                </span>
              )}
              <h2 className="text-2xl font-bold">
                {current.name}, {age}
              </h2>
              {current.city && <p className="text-sm text-white/80">{current.city}</p>}
              {current.bio && <p className="mt-2 line-clamp-2 text-sm text-white/90">{current.bio}</p>}
            </div>
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-center text-sm text-[var(--color-danger)]">{error}</p>}

      <div className="mt-3 flex items-center justify-center gap-4 pb-2">
        <button
          type="button"
          onClick={() => handleChoice("nista")}
          disabled={!current || pending}
          className="tap-scale flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white disabled:opacity-40"
          aria-label="Ništa"
        >
          ✕
        </button>
        <button
          type="button"
          onClick={() => handleChoice("krevet")}
          disabled={!current || pending}
          className="tap-scale pulse-glow flex h-16 w-16 items-center justify-center rounded-full border-2 border-[var(--color-accent-to)] bg-black/30 text-2xl disabled:opacity-40"
          aria-label="Krevet"
        >
          😈
        </button>
        <button
          type="button"
          onClick={() => handleChoice("upoznavanje")}
          disabled={!current || pending}
          className="tap-scale flex h-14 w-14 items-center justify-center rounded-full bg-gradient-accent text-white disabled:opacity-40"
          aria-label="Upoznavanje"
        >
          🤝
        </button>
      </div>

      <AnimatePresence>
        {matched && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-black/92 px-6 text-center text-white"
          >
            <MatchCelebration variant="hot" />
            <p className="animate-bubble-in text-5xl">🔥</p>
            <h2 className="text-3xl font-extrabold text-gradient">MATCH!</h2>
            {matched.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={matched.photoUrl} alt={matched.name} className="h-28 w-28 rounded-full border-4 border-black object-cover" />
            )}
            <p className="max-w-xs text-white/90">
              Ti i <strong>{matched.name}</strong> ste se svideli jedno drugom.
            </p>
            <div className="flex w-full max-w-xs flex-col gap-2">
              <button
                type="button"
                onClick={() => router.push("/poruke")}
                className="tap-scale rounded-2xl bg-gradient-accent px-4 py-3 font-bold"
              >
                Idi na Poruke
              </button>
              <button type="button" onClick={() => setMatched(null)} className="tap-scale rounded-2xl border border-white/20 px-4 py-3">
                Nastavi
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
