"use client";

import { useState } from "react";
import { motion, useMotionValue, useTransform, AnimatePresence, type PanInfo } from "framer-motion";
import { calculateAge } from "@/lib/utils";
import type { SecretRoomCandidate } from "./actions";

const SWIPE_THRESHOLD = 110;

/** Male svetlece cestice za LIKE "eksploziju" -- fiksne pozicije, samo transform/opacity (GPU-friendly, performansno). */
const BURST_PARTICLES = Array.from({ length: 10 }, (_, i) => {
  const angle = (i / 10) * Math.PI * 2;
  return { x: Math.cos(angle) * 140, y: Math.sin(angle) * 140, delay: i * 0.012 };
});

export function CandidateSwipeCard({
  candidate,
  disabled,
  onLike,
  onPass,
}: {
  candidate: SecretRoomCandidate;
  disabled: boolean;
  onLike: () => void;
  onPass: () => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-16, 16]);
  const likeOpacity = useTransform(x, [20, 110], [0, 1]);
  const passOpacity = useTransform(x, [-110, -20], [1, 0]);
  const [bursting, setBursting] = useState(false);
  const [exiting, setExiting] = useState<"like" | "pass" | null>(null);
  const age = calculateAge(candidate.birthDate);

  function fireLike() {
    if (exiting) return;
    setBursting(true);
    setExiting("like");
    setTimeout(onLike, 280);
  }

  function firePass() {
    if (exiting) return;
    setExiting("pass");
    setTimeout(onPass, 220);
  }

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x > SWIPE_THRESHOLD) fireLike();
    else if (info.offset.x < -SWIPE_THRESHOLD) firePass();
  }

  return (
    <motion.div
      className="absolute inset-0"
      style={{ x, rotate }}
      drag={disabled || !!exiting ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={1}
      onDragEnd={handleDragEnd}
      initial={{ scale: 0.94, opacity: 0 }}
      animate={
        exiting === "pass"
          ? { x: -420, opacity: 0, rotate: -20, transition: { duration: 0.22 } }
          : exiting === "like"
            ? { scale: 1.05, opacity: 0, transition: { duration: 0.28 } }
            : { scale: 1, opacity: 1, transition: { duration: 0.15 } }
      }
    >
      <div className="relative h-full w-full overflow-hidden rounded-3xl bg-[#1a0f24] shadow-[0_0_40px_-8px_rgba(192,25,94,0.5)]">
        {candidate.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={candidate.photoUrl} alt={candidate.name} className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="flex h-full items-center justify-center text-7xl">👤</div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-black/10" />

        <div className="absolute inset-x-0 bottom-0 px-5 pb-6 pt-24 text-white">
          <h2 className="flex items-center gap-1.5 text-2xl font-bold">
            {candidate.name}, {age}
          </h2>
          {candidate.city && <p className="text-sm text-white/75">{candidate.city}</p>}
          {candidate.bio && <p className="mt-2 line-clamp-2 text-sm text-white/85">{candidate.bio}</p>}
        </div>

        <motion.div
          style={{ opacity: likeOpacity }}
          className="absolute left-5 top-8 -rotate-12 rounded-xl border-4 border-[var(--color-success)] px-3 py-1 text-xl font-extrabold text-[var(--color-success)]"
        >
          SVIĐA MI SE
        </motion.div>
        <motion.div
          style={{ opacity: passOpacity }}
          className="absolute right-5 top-8 rotate-12 rounded-xl border-4 border-white/70 px-3 py-1 text-xl font-extrabold text-white/70"
        >
          PRESKOČI
        </motion.div>

        <AnimatePresence>
          {bursting && (
            <div className="pointer-events-none absolute left-1/2 top-1/2">
              {BURST_PARTICLES.map((p, i) => (
                <motion.span
                  key={i}
                  className="absolute h-2.5 w-2.5 rounded-full bg-[var(--color-accent-to)]"
                  initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                  animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.3 }}
                  transition={{ duration: 0.5, delay: p.delay, ease: "easeOut" }}
                />
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-4 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={firePass}
          disabled={disabled || !!exiting}
          className="tap-scale flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white disabled:opacity-40"
          aria-label="Preskoči"
        >
          ✕
        </button>
        <button
          type="button"
          onClick={fireLike}
          disabled={disabled || !!exiting}
          className="tap-scale flex h-14 w-14 items-center justify-center rounded-full bg-gradient-accent text-white disabled:opacity-40"
          aria-label="Sviđa mi se"
        >
          🔥
        </button>
      </div>
    </motion.div>
  );
}
