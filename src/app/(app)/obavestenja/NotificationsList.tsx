"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { markNotificationRead } from "../_notifications/actions";

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  matchId: string | null;
  isRead: boolean;
  createdAt: string;
}

export function NotificationsList({ initialItems }: { initialItems: NotificationRow[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);

  async function handleClick(n: NotificationRow) {
    if (!n.isRead) {
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, isRead: true } : i)));
      markNotificationRead(n.id);
    }
    if (n.matchId) router.push(`/poruke/${n.matchId}`);
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((n) => (
        <li key={n.id}>
          <button
            type="button"
            onClick={() => handleClick(n)}
            disabled={!n.matchId}
            className={cn(
              "tap-scale flex w-full flex-col gap-0.5 rounded-2xl px-4 py-3 text-left",
              n.isRead ? "bg-[var(--color-bg-card)]" : "glass"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">{n.title}</p>
              {!n.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-accent)]" />}
            </div>
            {n.body && <p className="text-xs text-[var(--color-text-muted)]">{n.body}</p>}
            <p className="mt-0.5 text-[10px] text-[var(--color-text-faint)]">
              {new Date(n.createdAt).toLocaleString("sr-RS")}
            </p>
          </button>
        </li>
      ))}
    </ul>
  );
}
