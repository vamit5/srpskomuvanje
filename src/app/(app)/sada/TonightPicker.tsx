"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { setTonightStatus, type HotModeVibe } from "../_hotmode/actions";

const OPTIONS: { value: HotModeVibe; label: string }[] = [
  { value: "flert", label: "🔥 Flert" },
  { value: "pice", label: "🍸 Piće" },
  { value: "izlazak", label: "💃 Izlazak" },
  { value: "upoznavanje", label: "❤️ Upoznavanje" },
];

export function TonightPicker({ alreadyActive }: { alreadyActive: boolean }) {
  const [selected, setSelected] = useState<HotModeVibe[]>([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(alreadyActive);
  const [error, setError] = useState<string | null>(null);

  async function handlePick(vibe: HotModeVibe) {
    const next = selected.includes(vibe) ? selected.filter((v) => v !== vibe) : [...selected, vibe];
    setSelected(next);
    if (next.length === 0) return;

    setSaving(true);
    setError(null);
    const result = await setTonightStatus(next);
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <p className="font-semibold">🌙 Večeras?</p>
      <p className="mb-3 text-xs text-[var(--color-text-muted)]">
        {done
          ? "Status je aktivan do 04:00 — vide te drugi u Hot Mode-u."
          : "Označi šta želiš — traje do 04:00, drugi Hot Mode korisnici te vide."}
      </p>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => handlePick(o.value)}
            disabled={saving}
            className={cn(
              "tap-scale rounded-full border px-3 py-1.5 text-sm disabled:opacity-50",
              selected.includes(o.value)
                ? "border-transparent bg-gradient-accent text-white"
                : "border-[var(--color-border-strong)] text-[var(--color-text-muted)]"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>}
    </section>
  );
}
