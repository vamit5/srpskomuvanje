"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { reviewNightContent, deleteNightContent } from "../actions";

interface Row {
  id: string;
  kind: "photo" | "video";
  senderName: string;
  receiverName: string;
  score: number | null;
  classification: string;
  createdAt: string;
  previewUrl: string | null;
}

export function NightModerationQueue({ initialItems }: { initialItems: Row[] }) {
  const [items, setItems] = useState(initialItems);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleDecision(id: string, decision: "admin_locked" | "admin_unlocked" | "admin_marked_safe") {
    setBusyId(id);
    const result = await reviewNightContent(id, decision, "");
    setBusyId(null);
    if (!result.error) setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    const result = await deleteNightContent(id);
    setBusyId(null);
    if (!result.error) setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
          <div className="mb-2 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
            <span>
              {item.kind === "photo" ? "📷" : "🎬"} {item.senderName} → {item.receiverName}
            </span>
            <span>{new Date(item.createdAt).toLocaleString("sr-RS")}</span>
          </div>
          <p className="mb-2 text-xs text-[var(--color-text-faint)]">
            Klasifikacija: {item.classification} · Skor: {item.score?.toFixed(2) ?? "N/A"}
          </p>
          {item.previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.previewUrl} alt="" className="mb-3 max-h-64 w-full rounded-xl bg-black object-contain" />
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="md" variant="secondary" disabled={busyId === item.id} onClick={() => handleDecision(item.id, "admin_marked_safe")}>
              ✅ Mark Safe
            </Button>
            <Button size="md" variant="secondary" disabled={busyId === item.id} onClick={() => handleDecision(item.id, "admin_unlocked")}>
              🔓 Unlock
            </Button>
            <Button size="md" variant="secondary" disabled={busyId === item.id} onClick={() => handleDecision(item.id, "admin_locked")}>
              🔒 Lock
            </Button>
            <Button size="md" variant="danger" disabled={busyId === item.id} onClick={() => handleDelete(item.id)}>
              🗑️ Delete
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
