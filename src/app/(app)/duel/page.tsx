import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { getNextDuel } from "./actions";
import { DuelGame } from "./DuelGame";

export const metadata = { title: "Duel" };

export default async function DuelPage() {
  const { duel, error, limitReached } = await getNextDuel();

  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <header>
        <h1 className="text-2xl font-bold">
          ⚔️ <span className="text-gradient">Duel</span>
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">Igra koja pomaže algoritmu da nauči tvoj ukus.</p>
      </header>

      {error ? (
        <EmptyState emoji="⚠️" title="Nešto nije u redu" description={error} />
      ) : limitReached ? (
        <EmptyState
          emoji="⭐"
          title="Iskoristio/la si dnevni Duel"
          description="Besplatni nalog ima ograničen broj Duela dnevno. Premium ima neograničeno."
          action={
            <Link href="/profil">
              <Button>Postani Premium</Button>
            </Link>
          }
        />
      ) : !duel ? (
        <EmptyState
          emoji="⚔️"
          title="Nema dovoljno profila za Duel"
          description="Treba nam bar dvoje ljudi tvog tipa sa profilnom fotografijom. Svrati kasnije kad nas bude više."
        />
      ) : (
        <DuelGame initialDuel={duel} />
      )}
    </div>
  );
}
