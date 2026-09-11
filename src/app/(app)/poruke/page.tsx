import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { getFeaturedBadgeLabel } from "@/lib/featured";
import { getConversations } from "./actions";
import { ConversationRow } from "./ConversationRow";

export const metadata = { title: "Poruke" };

export default async function PorukePage() {
  const supabase = await createClient();
  const [{ conversations, error }, featuredBadgeLabel] = await Promise.all([
    getConversations(),
    getFeaturedBadgeLabel(supabase),
  ]);

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
              <ConversationRow c={c} featuredBadgeLabel={featuredBadgeLabel} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
