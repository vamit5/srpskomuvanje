"use client";

import Link from "next/link";
import { useIsOnline } from "@/components/OnlinePresence";
import { FeaturedBadge } from "@/components/FeaturedBadge";
import type { Conversation } from "./actions";

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "sad";
  if (minutes < 60) return `pre ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `pre ${hours}h`;
  const days = Math.floor(hours / 24);
  return `pre ${days}d`;
}

export function ConversationRow({ c, featuredBadgeLabel }: { c: Conversation; featuredBadgeLabel: string }) {
  // Stvaran, uzivo online status -- ne procena po vremenu poslednje aktivnosti.
  const online = useIsOnline(c.otherShowsOnlineStatus ? c.otherId : null);

  return (
    <Link
      href={`/poruke/${c.matchId}`}
      className="tap-scale animate-bubble-in flex items-center gap-3 rounded-2xl px-3 py-3 hover:bg-[var(--color-bg-elevated)]"
    >
      <div className="relative shrink-0">
        {c.otherPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.otherPhotoUrl} alt={c.otherName} className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-accent text-lg font-bold text-white">
            {c.otherName[0]?.toUpperCase() ?? "?"}
          </div>
        )}
        {online && (
          <span className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--color-bg)] bg-[var(--color-online)]" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 font-semibold">
          {c.otherName}
          {c.otherIsFeatured && <FeaturedBadge label={featuredBadgeLabel} />}
        </p>
        <p className="truncate text-sm text-[var(--color-text-muted)]">
          {c.lastMessage
            ? `${c.lastMessage.isMine ? "Ti: " : ""}${c.lastMessage.content ?? "📷 Slika"}`
            : "Recite zdravo 👋"}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        {c.lastMessage && <span className="text-xs text-[var(--color-text-faint)]">{timeAgo(c.lastMessage.createdAt)}</span>}
        {c.unreadCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-accent px-1.5 text-[11px] font-bold text-white">
            {c.unreadCount}
          </span>
        )}
      </div>
    </Link>
  );
}
