"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { updateSuggestionText, toggleSuggestionActive, deleteSuggestion } from "./actions";

export interface SuggestionRow {
  id: string;
  category: "normal" | "hot";
  stage: number;
  text: string;
  is_active: boolean;
}

const CATEGORY_LABEL: Record<string, string> = { normal: "Običan chat", hot: "18+ chat" };
const CATEGORIES: ("normal" | "hot")[] = ["normal", "hot"];
const STAGES = [1, 2, 3] as const;

function SuggestionItem({
  row,
  onTextSaved,
  onToggled,
  onDeleted,
}: {
  row: SuggestionRow;
  onTextSaved: (id: string, text: string) => void;
  onToggled: (id: string, isActive: boolean) => void;
  onDeleted: (id: string) => void;
}) {
  const [text, setText] = useState(row.text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = text.trim().length > 0 && text.trim() !== row.text;

  async function saveText() {
    setBusy(true);
    setError(null);
    const result = await updateSuggestionText(row.id, text);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onTextSaved(row.id, text.trim());
  }

  async function toggleActive() {
    setBusy(true);
    const result = await toggleSuggestionActive(row.id, !row.is_active);
    setBusy(false);
    if (!result.error) onToggled(row.id, !row.is_active);
  }

  async function remove() {
    if (!confirm("Obriši ovaj predlog?")) return;
    setBusy(true);
    const result = await deleteSuggestion(row.id);
    setBusy(false);
    if (!result.error) onDeleted(row.id);
  }

  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-2xl border p-3",
        row.is_active ? "border-[var(--color-border)] bg-[var(--color-bg-card)]" : "border-[var(--color-border)] bg-[var(--color-bg-elevated)] opacity-60"
      )}
    >
      <textarea
        className="w-full resize-none rounded-lg border border-[var(--color-border-strong)] bg-transparent p-2 text-sm outline-none focus:border-[var(--color-accent)]"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        maxLength={200}
      />
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      <div className="flex items-center gap-3 text-xs">
        {dirty && (
          <button type="button" onClick={saveText} disabled={busy} className="font-semibold text-[var(--color-accent)] disabled:opacity-50">
            Sačuvaj
          </button>
        )}
        <button type="button" onClick={toggleActive} disabled={busy} className="text-[var(--color-text-muted)] underline disabled:opacity-50">
          {row.is_active ? "Ugasi" : "Uključi"}
        </button>
        <button type="button" onClick={remove} disabled={busy} className="text-[var(--color-danger)] underline disabled:opacity-50">
          Obriši
        </button>
      </div>
    </li>
  );
}

export function SuggestionsList({ initialSuggestions }: { initialSuggestions: SuggestionRow[] }) {
  const [rows, setRows] = useState(initialSuggestions);

  // Sinhronizacija sa Server Komponentom posle router.refresh() -- podesavanje
  // state-a TOKOM render-a (React-ov preporuceni obrazac), bez useEffect-a.
  const [prevInitial, setPrevInitial] = useState(initialSuggestions);
  if (initialSuggestions !== prevInitial) {
    setPrevInitial(initialSuggestions);
    setRows(initialSuggestions);
  }

  function handleTextSaved(id: string, text: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, text } : r)));
  }
  function handleToggled(id: string, isActive: boolean) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, is_active: isActive } : r)));
  }
  function handleDeleted(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  if (!rows.length) {
    return <p className="text-sm text-[var(--color-text-muted)]">Još nema predloga.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      {CATEGORIES.map((category) =>
        STAGES.map((stage) => {
          const group = rows.filter((r) => r.category === category && r.stage === stage);
          if (!group.length) return null;
          return (
            <div key={`${category}-${stage}`}>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                {CATEGORY_LABEL[category]} · Faza {stage}
              </h3>
              <ul className="flex flex-col gap-2">
                {group.map((row) => (
                  <SuggestionItem key={row.id} row={row} onTextSaved={handleTextSaved} onToggled={handleToggled} onDeleted={handleDeleted} />
                ))}
              </ul>
            </div>
          );
        })
      )}
    </div>
  );
}
