"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Countdown koji je SERVER-autoritativan -- prima expiresAt (ISO timestamp
 * sa servera) i samo lokalno racuna koliko je ostalo za PRIKAZ. Nijedna
 * akcija se ne oslanja na ovaj broj -- svaki server poziv sam proverava
 * expires_at u bazi (sekcija 22 spec-a: "Ne veruj client-side timeru").
 */
export function useCountdown(expiresAt: string | null, onExpire?: () => void): number {
  const [remaining, setRemaining] = useState(() => (expiresAt ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)) : 0));

  useEffect(() => {
    if (!expiresAt) return;
    let done = false;
    const tick = () => {
      const secs = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setRemaining(secs);
      if (secs <= 0 && !done) {
        done = true;
        onExpire?.();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt]);

  return remaining;
}

function formatMMSS(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function RoundTimer({ seconds, urgentBelow = 60 }: { seconds: number; urgentBelow?: number }) {
  const urgent = seconds <= urgentBelow;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 font-mono text-sm font-bold tabular-nums transition-colors",
        urgent ? "animate-pulse bg-red-500/20 text-red-300" : "bg-white/10 text-white"
      )}
    >
      ⏱ {formatMMSS(seconds)}
    </span>
  );
}
