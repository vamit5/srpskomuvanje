"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { setTonightStatus, type HotModeVibe } from "../_hotmode/actions";

const OPTIONS: { value: HotModeVibe; label: string }[] = [
  { value: "flert", label: "🔥 Flert" },
  { value: "pice", label: "🍸 Piće" },
  { value: "izlazak", label: "💃 Izlazak" },
  { value: "upoznavanje", label: "❤️ Upoznavanje" },
  { value: "vreo_razgovor", label: "💬 Vreo razgovor" },
  { value: "masaza", label: "💆 Masaža" },
  { value: "krevet", label: "😈 Krevet" },
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
          ? "😏 Hot Mode je aktivan do 04:00 — vide te drugi koji su ga takođe uključili."
          : "Klikom na bilo koju opciju uključuješ 😏 Hot Mode do 04:00 — vide te samo drugi koji su ga takođe uključili."}
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

      <Link href="/profil" className="mt-3 inline-block text-xs text-[var(--color-text-faint)] underline">
        Podešavanja Hot Mode-a (uključi bez vremenskog ograničenja) →
      </Link>
    </section>
  );
}
