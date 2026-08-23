"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { confirmSecretRoomMatch, type SecretRoomOtherProfile } from "./actions";

export function ResultScreen({
  pairId,
  other,
  outcome,
  onRestart,
}: {
  pairId: string | null;
  other: SecretRoomOtherProfile | null;
  outcome: "chemistry_confirmed" | "no_chemistry";
  onRestart: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"chat" | "match" | null>(null);

  async function goToChat() {
    if (!pairId) return;
    setBusy("chat");
    const result = await confirmSecretRoomMatch(pairId, true);
    setBusy(null);
    if (result.matchId) router.push(`/poruke/${result.matchId}`);
  }

  async function addToMatch() {
    if (!pairId) return;
    setBusy("match");
    const result = await confirmSecretRoomMatch(pairId, false);
    setBusy(null);
    if (result.matchId) router.push("/match");
  }

  const chemistry = outcome === "chemistry_confirmed";

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-6 px-6 text-center text-white">
      <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-3">
        <p className="text-5xl">{chemistry ? "🔥" : "🌙"}</p>
        <h2 className="text-2xl font-extrabold">{chemistry ? "HEMIJA POTVRĐENA" : "Ovaj put nije bilo hemije"}</h2>
        {chemistry && other && <p className="text-white/70">Ti i {other.name} se stvarno uklapate.</p>}
      </motion.div>

      {chemistry ? (
        <div className="flex w-full max-w-xs flex-col gap-2">
          <button
            type="button"
            onClick={goToChat}
            disabled={!!busy}
            className="tap-scale rounded-2xl bg-gradient-accent px-4 py-3.5 text-base font-extrabold text-white disabled:opacity-50"
          >
            💬 {busy === "chat" ? "Otvaram..." : "NASTAVI MUVANJE"}
          </button>
          <button
            type="button"
            onClick={addToMatch}
            disabled={!!busy}
            className="tap-scale rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold text-white/80 disabled:opacity-50"
          >
            ❤️ {busy === "match" ? "Dodajem..." : "DODAJ U MATCH"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onRestart}
          className="tap-scale rounded-2xl bg-gradient-accent px-6 py-3.5 text-base font-extrabold text-white"
        >
          🔥 PONOVI RUNDU
        </button>
      )}
    </div>
  );
}
