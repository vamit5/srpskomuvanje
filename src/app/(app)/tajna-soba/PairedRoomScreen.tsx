"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { calculateAge } from "@/lib/utils";
import { RoundTimer, useCountdown } from "./RoundTimer";
import { getSecretRoomDuelAnswerStatus } from "./pairStatus";
import {
  answerSecretRoomDuelQuestion,
  getSecretRoomDuelQuestions,
  getSecretRoomPair,
  type SecretRoomOtherProfile,
} from "./actions";

// Lokalno definisano (ne uvozi se iz src/lib/secretRoom.ts, koji je
// "server-only" -- ovaj fajl je klijentska komponenta).
interface DuelQuestion {
  text: string;
  options: { emoji: string; label: string }[];
}

type Phase = "doors" | "duel" | "waiting-answer" | "reveal" | "done";

export function PairedRoomScreen({
  pairId,
  other,
  expiresAt,
  onFinished,
}: {
  pairId: string;
  other: SecretRoomOtherProfile;
  expiresAt: string;
  onFinished: (outcome: "chemistry_confirmed" | "no_chemistry") => void;
}) {
  const [phase, setPhase] = useState<Phase>("doors");
  const [questions, setQuestions] = useState<DuelQuestion[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [myPick, setMyPick] = useState<number | null>(null);
  const [matchCount, setMatchCount] = useState(0);
  const [lastWasMatch, setLastWasMatch] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishedRef = useRef(false);

  const remaining = useCountdown(expiresAt, () => {
    if (!finishedRef.current) {
      finishedRef.current = true;
      onFinished("no_chemistry");
    }
  });

  useEffect(() => {
    const t = setTimeout(() => setPhase("duel"), 1600);
    getSecretRoomDuelQuestions().then(setQuestions);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function pick(answerIndex: number) {
    if (myPick !== null) return;
    setMyPick(answerIndex);
    setPhase("waiting-answer");

    const result = await answerSecretRoomDuelQuestion(pairId, qIndex, answerIndex);
    if (result.error) return;

    if (result.chemistryConfirmed) {
      setMatchCount(result.matchCount);
      setLastWasMatch(true);
      setPhase("reveal");
      setTimeout(() => {
        if (!finishedRef.current) {
          finishedRef.current = true;
          onFinished("chemistry_confirmed");
        }
      }, 1800);
      return;
    }

    // Partner je vec odgovorio (both_answered odmah tacno) -- rezultat vec znamo.
    pollRef.current = setInterval(async () => {
      const status = await getSecretRoomDuelAnswerStatus(pairId, qIndex);
      if (!status.bothAnswered) return;
      if (pollRef.current) clearInterval(pollRef.current);

      const isMatch = status.myAnswerIndex !== null && status.myAnswerIndex === status.otherAnswerIndex;
      setLastWasMatch(isMatch);
      if (isMatch) setMatchCount((c) => c + 1);
      setPhase("reveal");

      setTimeout(async () => {
        const { pair } = await getSecretRoomPair(pairId);
        if (pair?.status === "chemistry_confirmed") {
          if (!finishedRef.current) {
            finishedRef.current = true;
            onFinished("chemistry_confirmed");
          }
          return;
        }
        if (qIndex + 1 >= questions.length) {
          if (!finishedRef.current) {
            finishedRef.current = true;
            onFinished("no_chemistry");
          }
          return;
        }
        setQIndex((i) => i + 1);
        setMyPick(null);
        setPhase("duel");
      }, 1400);
    }, 1200);
  }

  const age = calculateAge(other.birthDate);
  const question = questions[qIndex];

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-6 overflow-hidden px-6 text-center text-white">
      <AnimatePresence mode="wait">
        {phase === "doors" && (
          <motion.div key="doors" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="text-5xl"
            >
              🚪
            </motion.div>
            <h2 className="text-2xl font-extrabold">VRATA SE OTVARAJU</h2>
            <p className="text-lg font-semibold text-[var(--color-accent-to)]">Ušli ste u Tajnu sobu</p>
            {other.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={other.photoUrl} alt={other.name} className="h-24 w-24 rounded-full border-4 border-[var(--color-accent-to)] object-cover" />
            )}
            <p className="text-white/80">
              {other.name}, {age}
              {other.city ? ` · ${other.city}` : ""}
            </p>
          </motion.div>
        )}

        {(phase === "duel" || phase === "waiting-answer") && question && (
          <motion.div key={`q-${qIndex}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex w-full max-w-xs flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Duel hemije</p>
              <RoundTimer seconds={remaining} />
            </div>
            <h3 className="text-xl font-bold">{question.text}</h3>
            <div className="grid grid-cols-2 gap-2">
              {question.options.map((opt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => pick(i)}
                  disabled={myPick !== null}
                  className={`tap-scale flex flex-col items-center gap-1 rounded-2xl border px-3 py-4 text-sm font-medium transition-colors ${
                    myPick === i
                      ? "border-[var(--color-accent-to)] bg-[var(--color-accent-to)]/20"
                      : "border-white/15 bg-white/5"
                  } disabled:opacity-60`}
                >
                  <span className="text-2xl">{opt.emoji}</span>
                  {opt.label}
                </button>
              ))}
            </div>
            {phase === "waiting-answer" && <p className="text-xs text-white/50">Čeka se odgovor druge osobe...</p>}
          </motion.div>
        )}

        {phase === "reveal" && (
          <motion.div key="reveal" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-3">
            <p className="text-4xl">{lastWasMatch ? (matchCount >= 3 ? "🔥🔥🔥" : matchCount === 2 ? "🔥" : "💥") : "🙈"}</p>
            <p className="text-xl font-extrabold">
              {lastWasMatch ? (matchCount >= 3 ? "HEMIJA POTVRĐENA" : matchCount === 2 ? "HEMIJA RASTE" : "POGODAK") : "Različiti odgovori"}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
