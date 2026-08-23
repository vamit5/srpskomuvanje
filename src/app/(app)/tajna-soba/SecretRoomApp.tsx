"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { RoundTimer, useCountdown } from "./RoundTimer";
import { CandidateSwipeCard } from "./CandidateSwipeCard";
import { SecretCardScreen } from "./SecretCardScreen";
import { IncomingRequestScreen } from "./IncomingRequestScreen";
import { PairedRoomScreen } from "./PairedRoomScreen";
import { ResultScreen } from "./ResultScreen";
import {
  startSecretRoomRound,
  getSecretRoomRoundCandidates,
  swipeSecretRoomCandidate,
  sendSecretRoomRiskRequest,
  getIncomingSecretRoomRequest,
  getSecretRoomPair,
  logSecretRoomOpened,
  logSecretRoomProfileViewed,
  logSecretRoomRoundExpired,
  logSecretRoomRequestExpired,
  type SecretRoomCandidate,
  type IncomingSecretRoomRequest,
  type SecretRoomOtherProfile,
} from "./actions";

type Screen =
  | { kind: "loading" }
  | { kind: "intro" }
  | { kind: "limit-reached" }
  | { kind: "round"; roundId: string; expiresAt: string; candidates: SecretRoomCandidate[] }
  | { kind: "waiting-response"; roundId: string; requestId: string; expiresAt: string }
  | { kind: "incoming"; request: IncomingSecretRoomRequest }
  | { kind: "paired"; pairId: string; other: SecretRoomOtherProfile; expiresAt: string }
  | { kind: "result"; pairId: string | null; other: SecretRoomOtherProfile | null; outcome: "chemistry_confirmed" | "no_chemistry" }
  | { kind: "error"; message: string };

export function SecretRoomApp({ myId }: { myId: string }) {
  const [screen, setScreen] = useState<Screen>({ kind: "loading" });
  const notifiedPairRef = useRef<string | null>(null);

  useEffect(() => {
    logSecretRoomOpened();
    (async () => {
      const { request } = await getIncomingSecretRoomRequest();
      if (request) {
        setScreen({ kind: "incoming", request });
      } else {
        setScreen({ kind: "intro" });
      }
    })();
  }, []);

  // Real-time: notifications tabela (postojeci mehanizam) -- prati zahteve
  // koji stignu DOK je korisnik vec na ovoj stranici, i "vrata su otvorena"
  // signal za onog ko je poslao RIZIKUJ (sekcija 21: minimalan realtime sloj).
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      await supabase.auth.getSession();
      if (cancelled) return;

      channel = supabase
        .channel(`secret-room-notif:${myId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `profile_id=eq.${myId}` },
          async (payload) => {
            const row = payload.new as { type: string; data: Record<string, unknown> };
            if (row.type === "secret_room_request") {
              const { request } = await getIncomingSecretRoomRequest();
              if (request) setScreen((s) => (s.kind === "incoming" ? s : { kind: "incoming", request }));
            } else if (row.type === "secret_room_pair_ready") {
              const pairId = row.data?.pairId as string | undefined;
              if (pairId && notifiedPairRef.current !== pairId) {
                notifiedPairRef.current = pairId;
                const { pair } = await getSecretRoomPair(pairId);
                if (pair) setScreen({ kind: "paired", pairId: pair.pairId, other: pair.other, expiresAt: pair.expiresAt });
              }
            } else if (row.type === "secret_room_rejected") {
              setScreen((s) =>
                s.kind === "waiting-response" ? { kind: "result", pairId: null, other: null, outcome: "no_chemistry" } : s
              );
            }
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [myId]);

  async function enterRoom() {
    setScreen({ kind: "loading" });
    const result = await startSecretRoomRound();
    if (result.limitReached) {
      setScreen({ kind: "limit-reached" });
      return;
    }
    if (result.error || !result.roundId || !result.expiresAt) {
      setScreen({ kind: "error", message: result.error ?? "Nešto nije u redu." });
      return;
    }
    const { candidates, error } = await getSecretRoomRoundCandidates(result.roundId);
    if (error) {
      setScreen({ kind: "error", message: error });
      return;
    }
    setScreen({ kind: "round", roundId: result.roundId, expiresAt: result.expiresAt, candidates });
  }

  function endNoChemistry() {
    setScreen({ kind: "result", pairId: null, other: null, outcome: "no_chemistry" });
  }

  async function handleSwipe(roundId: string, candidate: SecretRoomCandidate, action: "like" | "pass") {
    const result = await swipeSecretRoomCandidate(roundId, candidate.id, action);
    setScreen((s) => {
      if (s.kind !== "round") return s;
      const rest = s.candidates.filter((c) => c.candidateRowId !== candidate.candidateRowId);
      return { ...s, candidates: rest };
    });
    void result;
  }

  async function handleRisk(roundId: string) {
    setScreen({ kind: "loading" });
    const result = await sendSecretRoomRiskRequest(roundId);
    if (result.error || !result.requestId || !result.expiresAt) {
      setScreen({ kind: "error", message: result.error ?? "Nešto nije u redu." });
      return;
    }
    setScreen({ kind: "waiting-response", roundId, requestId: result.requestId, expiresAt: result.expiresAt });
  }

  async function handleSkipSecretCard(roundId: string, candidateId: string) {
    await swipeSecretRoomCandidate(roundId, candidateId, "pass");
    endNoChemistry();
  }

  if (screen.kind === "loading") {
    return (
      <div className="flex h-dvh safe-top items-center justify-center bg-[#150a1e]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  if (screen.kind === "intro") {
    return (
      <div className="flex h-dvh safe-top flex-col items-center justify-center gap-5 bg-gradient-to-b from-[#1a0f24] to-[#2b0b3f] px-6 text-center text-white">
        <h1 className="text-4xl font-extrabold">🔥 TAJNA SOBA</h1>
        <p className="text-white/70">Ovde nema beskonačnog swipovanja.</p>
        <p className="max-w-xs text-white/85">Imaš 3 minuta da pronađeš nekoga ko te stvarno privlači.</p>
        <button type="button" onClick={enterRoom} className="tap-scale mt-2 rounded-2xl bg-gradient-accent px-8 py-4 text-lg font-extrabold text-white">
          🔥 UĐI
        </button>
      </div>
    );
  }

  if (screen.kind === "limit-reached") {
    return (
      <div className="flex h-dvh safe-top flex-col items-center justify-center gap-4 bg-[#150a1e] px-6 text-center text-white">
        <p className="text-4xl">🌙</p>
        <h2 className="text-xl font-bold">Iskoristio/la si dnevne runde</h2>
        <p className="text-sm text-white/70">Vrati se sutra, ili postani Premium za više rundi dnevno.</p>
      </div>
    );
  }

  if (screen.kind === "error") {
    return (
      <div className="flex h-dvh safe-top flex-col items-center justify-center gap-4 bg-[#150a1e] px-6 text-center text-white">
        <p className="text-3xl">⚠️</p>
        <p className="text-white/80">{screen.message}</p>
        <button type="button" onClick={() => setScreen({ kind: "intro" })} className="tap-scale rounded-2xl bg-gradient-accent px-6 py-3 font-semibold text-white">
          Nazad
        </button>
      </div>
    );
  }

  if (screen.kind === "incoming") {
    return (
      <div className="h-dvh safe-top bg-gradient-to-b from-[#1a0f24] to-[#2b0b3f]">
        <IncomingRequestScreen
          request={screen.request}
          onAccepted={async (pairId, fallbackOther) => {
            notifiedPairRef.current = pairId;
            const { pair } = await getSecretRoomPair(pairId);
            if (pair) {
              setScreen({ kind: "paired", pairId: pair.pairId, other: pair.other, expiresAt: pair.expiresAt });
            } else {
              // getSecretRoomPair retko moze da omane usled trenutne mrezne
              // greske -- fallback na podatke koje smo vec dobili iz same
              // respondToSecretRoomRequest akcije, da korisnik ne ostane zaglavljen.
              setScreen({ kind: "paired", pairId, other: fallbackOther, expiresAt: new Date(Date.now() + 120000).toISOString() });
            }
          }}
          onClosed={() => setScreen({ kind: "intro" })}
        />
      </div>
    );
  }

  if (screen.kind === "waiting-response") {
    return (
      <WaitingResponseScreen
        expiresAt={screen.expiresAt}
        onExpire={() => {
          logSecretRoomRequestExpired(screen.requestId);
          endNoChemistry();
        }}
      />
    );
  }

  if (screen.kind === "paired") {
    return (
      <div className="h-dvh safe-top bg-gradient-to-b from-[#1a0f24] to-[#2b0b3f]">
        <PairedRoomScreen
          pairId={screen.pairId}
          other={screen.other}
          expiresAt={screen.expiresAt}
          onFinished={(outcome) => setScreen({ kind: "result", pairId: screen.pairId, other: screen.other, outcome })}
        />
      </div>
    );
  }

  if (screen.kind === "result") {
    return (
      <div className="h-dvh safe-top bg-gradient-to-b from-[#1a0f24] to-[#2b0b3f]">
        <ResultScreen pairId={screen.pairId} other={screen.other} outcome={screen.outcome} onRestart={() => setScreen({ kind: "intro" })} />
      </div>
    );
  }

  // screen.kind === "round"
  const current = screen.candidates[0];

  return (
    <div className="flex h-dvh safe-top flex-col bg-gradient-to-b from-[#1a0f24] to-[#2b0b3f] px-4 pb-4 pt-4">
      <div className="mb-3 flex items-center justify-between text-white">
        <h1 className="text-lg font-extrabold">🔥 Tajna soba</h1>
        <RoundTimerBridge
          expiresAt={screen.expiresAt}
          onExpire={() => {
            logSecretRoomRoundExpired(screen.roundId);
            endNoChemistry();
          }}
        />
      </div>

      <div className="relative flex-1">
        {!current ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-white/70">
            <p className="text-3xl">🌙</p>
            <p>Nema više kandidata u ovoj rundi.</p>
          </div>
        ) : current.isSecretCard ? (
          <SecretCardScreen
            candidate={current}
            busy={false}
            onRisk={() => handleRisk(screen.roundId)}
            onSkip={() => handleSkipSecretCard(screen.roundId, current.id)}
          />
        ) : (
          <SwipeStep candidate={current} onSwipe={(action) => handleSwipe(screen.roundId, current, action)} />
        )}
      </div>
    </div>
  );
}

function SwipeStep({
  candidate,
  onSwipe,
}: {
  candidate: SecretRoomCandidate;
  onSwipe: (action: "like" | "pass") => void;
}) {
  useEffect(() => {
    logSecretRoomProfileViewed(candidate.id);
  }, [candidate.id]);

  return (
    <div className="relative h-[calc(100%-4rem)]">
      <CandidateSwipeCard candidate={candidate} disabled={false} onLike={() => onSwipe("like")} onPass={() => onSwipe("pass")} />
    </div>
  );
}

function RoundTimerBridge({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
  const remaining = useCountdown(expiresAt, onExpire);
  return <RoundTimer seconds={remaining} />;
}

function WaitingResponseScreen({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
  const remaining = useCountdown(expiresAt, onExpire);
  return (
    <div className="flex h-dvh safe-top flex-col items-center justify-center gap-5 bg-gradient-to-b from-[#1a0f24] to-[#2b0b3f] px-6 text-center text-white">
      <div className="animate-pulse text-5xl">🔥</div>
      <h2 className="text-xl font-bold">Čeka te odgovor.</h2>
      <RoundTimer seconds={remaining} />
      <p className="text-sm text-white/60">Poslato je — sad je red na njima da otvore vrata.</p>
    </div>
  );
}
