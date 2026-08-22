"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { calculateAge, cn } from "@/lib/utils";
import { getNextDuel, voteDuel, type DuelPair } from "./actions";

function DuelCard({
  person,
  side,
  chosen,
  disabled,
  onPick,
}: {
  person: DuelPair["a"];
  side: "left" | "right";
  chosen: boolean | null; // null = niko jos nije izabran, true = ovaj je izabran, false = izabran je drugi
  disabled: boolean;
  onPick: () => void;
}) {
  const age = person.birthDate ? calculateAge(person.birthDate) : null;

  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      className={cn(
        "tap-scale relative aspect-[3/4] flex-1 overflow-hidden rounded-3xl bg-[var(--color-bg-card)] transition-all",
        chosen === true && "ring-4 ring-[var(--color-success)]",
        chosen === false && "opacity-40 grayscale"
      )}
    >
      {person.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={person.photoUrl} alt={person.name} className="h-full w-full object-cover" draggable={false} />
      ) : (
        <div className="flex h-full items-center justify-center text-6xl">👤</div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 pb-3 pt-10 text-left text-white">
        <p className="font-semibold">
          {person.name}
          {age ? `, ${age}` : ""}
        </p>
      </div>
      <span className="absolute left-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-xs font-bold text-white">
        {side === "left" ? "A" : "B"}
      </span>
    </button>
  );
}

export function DuelGame({ initialDuel }: { initialDuel: DuelPair }) {
  const [duel, setDuel] = useState<DuelPair | null>(initialDuel);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [loadingNext, setLoadingNext] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);

  async function handlePick(personId: string) {
    if (!duel || chosenId) return;
    setChosenId(personId);
    setError(null);

    await voteDuel(duel.duelId, personId);
    await new Promise((r) => setTimeout(r, 550)); // kratka pauza da se vidi izbor pre sledeceg

    setLoadingNext(true);
    const result = await getNextDuel();
    setLoadingNext(false);
    setChosenId(null);

    if (result.error) {
      setError(result.error);
      return;
    }
    setLimitReached(result.limitReached);
    setDuel(result.duel);
  }

  if (limitReached) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-6 py-10 text-center">
        <span className="text-4xl">⭐</span>
        <h2 className="text-lg font-semibold">Iskoristio/la si dnevni Duel</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Besplatni nalog ima ograničen broj Duela dnevno. Premium ima neograničeno.
        </p>
        <Link href="/profil">
          <Button>Postani Premium</Button>
        </Link>
      </div>
    );
  }

  if (!duel) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-6 py-10 text-center">
        <span className="text-4xl">🎉</span>
        <h2 className="text-lg font-semibold">To je bilo sve za sada</h2>
        <p className="text-sm text-[var(--color-text-muted)]">Vrati se kasnije po nove duele.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-lg font-semibold">{duel.prompt}</p>
      <div className="flex gap-3">
        <DuelCard
          person={duel.a}
          side="left"
          chosen={chosenId ? chosenId === duel.a.id : null}
          disabled={!!chosenId || loadingNext}
          onPick={() => handlePick(duel.a.id)}
        />
        <DuelCard
          person={duel.b}
          side="right"
          chosen={chosenId ? chosenId === duel.b.id : null}
          disabled={!!chosenId || loadingNext}
          onPick={() => handlePick(duel.b.id)}
        />
      </div>

      {loadingNext && (
        <div className="flex items-center justify-center gap-2 text-sm text-[var(--color-text-muted)]">
          <Loader2 size={16} className="animate-spin" /> Sledeći duel...
        </div>
      )}

      {error && <p className="text-center text-sm text-[var(--color-danger)]">{error}</p>}

      <p className="text-center text-xs text-[var(--color-text-faint)]">
        Ovo ne šalje lajk niti obaveštava nikoga — samo pomaže algoritmu da nauči tvoj ukus.
      </p>
    </div>
  );
}
