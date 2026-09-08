"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { createSuggestion } from "./actions";

type Category = "normal" | "hot";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "normal", label: "Običan chat" },
  { value: "hot", label: "18+ chat" },
];

const STAGES: { value: 1 | 2 | 3; label: string }[] = [
  { value: 1, label: "Faza 1" },
  { value: 2, label: "Faza 2" },
  { value: 3, label: "Faza 3" },
];

export function SuggestionForm() {
  const router = useRouter();
  const [category, setCategory] = useState<Category>("normal");
  const [stage, setStage] = useState<1 | 2 | 3>(1);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const result = await createSuggestion({ category, stage, text });
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setText("");
    setSuccess(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="flex gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setCategory(c.value)}
            className={cn(
              "tap-scale flex-1 rounded-xl border px-3 py-2 text-sm font-medium",
              category === c.value ? "border-transparent bg-gradient-accent text-white" : "border-[var(--color-border-strong)] text-[var(--color-text-muted)]"
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        {STAGES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setStage(s.value)}
            className={cn(
              "tap-scale flex-1 rounded-xl border px-3 py-2 text-sm font-medium",
              stage === s.value ? "border-transparent bg-gradient-accent text-white" : "border-[var(--color-border-strong)] text-[var(--color-text-muted)]"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      <textarea
        className="h-20 w-full rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] p-3 text-sm outline-none focus:border-[var(--color-accent)]"
        placeholder="Tekst predloga..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={200}
      />
      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
      {success && <p className="text-sm text-[var(--color-success)]">Predlog dodat ✅</p>}
      <Button type="submit" disabled={saving}>
        {saving ? "Čuvam..." : "Dodaj predlog"}
      </Button>
    </form>
  );
}
