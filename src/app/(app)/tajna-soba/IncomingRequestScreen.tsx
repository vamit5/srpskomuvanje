"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CreditsModal } from "@/components/CreditsModal";
import { RoundTimer, useCountdown } from "./RoundTimer";
import { respondToSecretRoomRequest, type IncomingSecretRoomRequest, type SecretRoomOtherProfile } from "./actions";

export function IncomingRequestScreen({
  request,
  onAccepted,
  onClosed,
}: {
  request: IncomingSecretRoomRequest;
  onAccepted: (pairId: string, other: SecretRoomOtherProfile) => void;
  onClosed: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCredits, setShowCredits] = useState(false);

  const remaining = useCountdown(request.expiresAt, () => onClosed());

  async function respond(accept: boolean) {
    setBusy(true);
    setError(null);
    const result = await respondToSecretRoomRequest(request.requestId, accept);
    setBusy(false);

    if (result.insufficientCredits) {
      setShowCredits(true);
      return;
    }
    if (result.error) {
      setError(result.error);
      return;
    }
    if (accept && result.pairId && result.other) {
      onAccepted(result.pairId, result.other);
    } else {
      onClosed();
    }
  }

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-6 px-6 text-center text-white">
      <motion.div
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 1.4, repeat: Infinity }}
        className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-accent text-4xl"
      >
        🔥
      </motion.div>

      <div>
        <h2 className="text-2xl font-extrabold">Neko te je izabrao u Tajnoj sobi</h2>
        <p className="mt-2 text-sm text-white/70">Hoćeš da otvoriš vrata?</p>
      </div>

      <RoundTimer seconds={remaining} />

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <div className="flex w-full max-w-xs flex-col gap-2">
        <button
          type="button"
          onClick={() => respond(true)}
          disabled={busy}
          className="tap-scale rounded-2xl bg-gradient-accent px-4 py-3.5 text-base font-extrabold text-white disabled:opacity-50"
        >
          🔥 OTVORI
        </button>
        <button
          type="button"
          onClick={() => respond(false)}
          disabled={busy}
          className="tap-scale rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold text-white/80 disabled:opacity-50"
        >
          ✖ PRESKOČI
        </button>
      </div>

      {showCredits && (
        <CreditsModal
          onClose={() => {
            setShowCredits(false);
          }}
        />
      )}
    </div>
  );
}
