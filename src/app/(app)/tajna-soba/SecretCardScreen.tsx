"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { calculateAge } from "@/lib/utils";
import type { SecretRoomCandidate } from "./actions";

export function SecretCardScreen({
  candidate,
  busy,
  onRisk,
  onSkip,
}: {
  candidate: SecretRoomCandidate;
  busy: boolean;
  onRisk: () => void;
  onSkip: () => void;
}) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 1100);
    return () => clearTimeout(t);
  }, []);

  const age = calculateAge(candidate.birthDate);

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-5 overflow-hidden px-6 text-center text-white">
      <AnimatePresence mode="wait">
        {!revealed ? (
          <motion.div
            key="waiting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4"
          >
            <motion.div
              animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.1, repeat: Infinity }}
              className="h-16 w-16 rounded-full bg-gradient-accent"
            />
            <p className="text-lg font-semibold text-white/80">Čekaj...</p>
          </motion.div>
        ) : (
          <motion.div
            key="revealed"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
            className="flex w-full max-w-xs flex-col items-center gap-4"
          >
            <p className="text-sm font-bold uppercase tracking-widest text-[var(--color-accent-to)]">🔥 Tajna karta</p>
            <p className="text-sm text-white/70">Pronašli smo nekoga ko bi mogao biti veoma blizu tvom tipu.</p>

            <motion.div
              animate={{ boxShadow: ["0 0 20px 0px rgba(192,25,94,0.4)", "0 0 40px 8px rgba(192,25,94,0.6)", "0 0 20px 0px rgba(192,25,94,0.4)"] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="relative h-56 w-44 overflow-hidden rounded-3xl bg-[#1a0f24]"
            >
              {candidate.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={candidate.photoUrl} alt={candidate.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-5xl">👤</div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-3 pb-3 pt-8">
                <p className="text-base font-bold">
                  {candidate.name}, {age}
                </p>
                {candidate.city && <p className="text-xs text-white/70">{candidate.city}</p>}
              </div>
            </motion.div>

            {candidate.bio && <p className="line-clamp-2 text-xs text-white/60">„{candidate.bio}“</p>}

            <div className="mt-2 flex w-full flex-col gap-2">
              <button
                type="button"
                onClick={onRisk}
                disabled={busy}
                className="tap-scale rounded-2xl bg-gradient-accent px-4 py-3.5 text-base font-extrabold text-white disabled:opacity-50"
              >
                😈 MUVAJ
              </button>
              <button
                type="button"
                onClick={onSkip}
                disabled={busy}
                className="tap-scale rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold text-white/80 disabled:opacity-50"
              >
                👋 PRESKOČI
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
