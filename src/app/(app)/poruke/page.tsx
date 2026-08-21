import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { getConversations } from "./actions";

export const metadata = { title: "Poruke" };

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

export default async function PorukePage() {
  const { conversations, error } = await getConversations();

  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <header>
        <h1 className="text-2xl font-bold">
          💬 <span className="text-gradient">Poruke</span>
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">Razgovori sa tvojim matchevima</p>
      </header>

      {error ? (
        <EmptyState emoji="⚠️" title="Nešto nije u redu" description={error} />
      ) : !conversations.length ? (
        <EmptyState
          emoji="💬"
          title="Nema razgovora još"
          description="Kad dobiješ prvi match, ovde se otvara real-time chat."
        />
      ) : (
        <ul className="flex flex-col gap-1">
          {conversations.map((c) => (
            <li key={c.matchId}>
              <Link
                href={`/poruke/${c.matchId}`}
                className="tap-scale flex items-center gap-3 rounded-2xl px-3 py-3 hover:bg-[var(--color-bg-elevated)]"
              >
                {c.otherPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.otherPhotoUrl} alt={c.otherName} className="h-14 w-14 rounded-full object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-accent text-lg font-bold text-white">
                    {c.otherName[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{c.otherName}</p>
                  <p className="truncate text-sm text-[var(--color-text-muted)]">
                    {c.lastMessage
                      ? `${c.lastMessage.isMine ? "Ti: " : ""}${c.lastMessage.content ?? "📷 Slika"}`
                      : "Recite zdravo 👋"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {c.lastMessage && (
                    <span className="text-xs text-[var(--color-text-faint)]">{timeAgo(c.lastMessage.createdAt)}</span>
                  )}
                  {c.unreadCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-accent px-1.5 text-[11px] font-bold text-white">
                      {c.unreadCount}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
