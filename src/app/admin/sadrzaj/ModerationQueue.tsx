"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { reviewMedia } from "../actions";

interface MediaRow {
  id: string;
  kind: "photo" | "video";
  profileId: string;
  profileName: string;
  url: string;
  thumbnailUrl: string | null;
  createdAt: string;
}

export function ModerationQueue({ initialItems }: { initialItems: MediaRow[] }) {
  const [items, setItems] = useState(initialItems);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleDecide(item: MediaRow, decision: "approved" | "rejected") {
    setBusyId(item.id);
    const result = await reviewMedia(item.kind, item.id, decision);
    setBusyId(null);
    if (!result.error) setItems((prev) => prev.filter((i) => i.id !== item.id));
  }

  if (!items.length) {
    return <p className="text-sm text-[var(--color-text-muted)]">Sve je pregledano. 🎉</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="rounded-full bg-[var(--color-bg-elevated)] px-2.5 py-1 text-xs font-semibold">
              {item.kind === "photo" ? "📷 Fotografija" : "🎬 Video"} — {item.profileName}
            </span>
            <span className="text-xs text-[var(--color-text-faint)]">
              {new Date(item.createdAt).toLocaleString("sr-RS")}
            </span>
          </div>

          {item.kind === "photo" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumbnailUrl ?? item.url}
              alt=""
              className="max-h-80 w-full rounded-xl object-contain bg-black"
            />
          ) : (
            <video src={item.url} poster={item.thumbnailUrl ?? undefined} controls className="max-h-80 w-full rounded-xl bg-black" />
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="md"
              variant="secondary"
              disabled={busyId === item.id}
              onClick={() => handleDecide(item, "approved")}
            >
              ✅ Odobri
            </Button>
            <Button
              size="md"
              variant="danger"
              disabled={busyId === item.id}
              onClick={() => handleDecide(item, "rejected")}
            >
              🚫 Odbij
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
