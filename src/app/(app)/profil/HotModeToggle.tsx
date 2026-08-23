"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { setHotMode, type HotModeVibe } from "../_hotmode/actions";

const VIBES: { value: HotModeVibe; label: string }[] = [
  { value: "flert", label: "😏 Flert" },
  { value: "vrelo", label: "🔥 Vrelo" },
  { value: "veceras", label: "🌙 Večeras" },
  { value: "pice", label: "🍸 Piće" },
  { value: "izlazak", label: "💃 Izlazak" },
  { value: "vreo_razgovor", label: "💬 Vreo razgovor" },
  { value: "masaza", label: "💆 Masaža" },
  { value: "krevet", label: "😈 Krevet" },
];

export function HotModeToggle({
  initialEnabled,
  initialVibes,
}: {
  initialEnabled: boolean;
  initialVibes: string[];
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [vibes, setVibes] = useState<HotModeVibe[]>(initialVibes as HotModeVibe[]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    const next = !enabled;
    setSaving(true);
    setError(null);
    const result = await setHotMode({ enabled: next, vibes: next ? vibes : [], expiresAt: null });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEnabled(next);
  }

  async function handleVibeToggle(vibe: HotModeVibe) {
    const next = vibes.includes(vibe) ? vibes.filter((v) => v !== vibe) : [...vibes, vibe];
    setVibes(next);
    if (enabled) {
      setSaving(true);
      const result = await setHotMode({ enabled: true, vibes: next, expiresAt: null });
      setSaving(false);
      if (result.error) setError(result.error);
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">😏 Hot Mode</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            18+ režim za direktniji flert. Vide te samo drugi koji su ga takođe uključili.
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={saving}
          aria-pressed={enabled}
          className={cn(
            "tap-scale relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50",
            enabled ? "bg-gradient-accent" : "bg-[var(--color-bg-elevated)]"
          )}
        >
          <span
            className={cn(
              "absolute top-1 h-5 w-5 rounded-full bg-white transition-transform",
              enabled ? "translate-x-6" : "translate-x-1"
            )}
          />
        </button>
      </div>

      {enabled && (
        <div className="mt-3 flex flex-wrap gap-2">
          {VIBES.map((v) => (
            <button
              key={v.value}
              type="button"
              onClick={() => handleVibeToggle(v.value)}
              disabled={saving}
              className={cn(
                "tap-scale rounded-full border px-3 py-1.5 text-sm disabled:opacity-50",
                vibes.includes(v.value)
                  ? "border-transparent bg-gradient-accent text-white"
                  : "border-[var(--color-border-strong)] text-[var(--color-text-muted)]"
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>}
    </section>
  );
}
