"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { vibrate } from "@/lib/haptics";

const EMOJIS = ["🎉", "💥", "❤️", "🔥", "😈", "✨"];

interface Particle {
  id: number;
  x: number;
  y: number;
  rotate: number;
  delay: number;
  emoji: string;
}

function makeParticles(variant: "match" | "hot"): Particle[] {
  return Array.from({ length: 18 }, (_, i) => {
    const angle = (i / 18) * Math.PI * 2 + Math.random() * 0.4;
    const distance = 140 + Math.random() * 160;
    return {
      id: i,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance - 60,
      rotate: (Math.random() - 0.5) * 180,
      delay: Math.random() * 0.25,
      emoji: variant === "hot" ? "😈" : EMOJIS[i % EMOJIS.length],
    };
  });
}

/** Konfeti/emoji "prasak" preko celog ekrana -- cist CSS/transform (GPU-friendly), bez teskih biblioteka. */
export function MatchCelebration({ variant = "match" }: { variant?: "match" | "hot" }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    vibrate([40, 60, 120]);
    // Math.random() NAMERNO tek posle mount-a (ne tokom render-a) -- isti
    // razlog kao icebreakers.ts: izbegava se "impure function during
    // render" (i moguci hydration mismatch).
    Promise.resolve().then(() => setParticles(makeParticles(variant)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute left-1/2 top-1/2 text-2xl"
          initial={{ x: 0, y: 0, opacity: 1, scale: 0.4, rotate: 0 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 1.1, rotate: p.rotate }}
          transition={{ duration: 1.1, delay: p.delay, ease: "easeOut" }}
        >
          {p.emoji}
        </motion.span>
      ))}
    </div>
  );
}
