import { EmptyState } from "@/components/ui/EmptyState";
import { getMoreCandidates, touchActivity } from "./actions";
import { OtkrijDeck } from "./OtkrijDeck";

export const metadata = { title: "Otkrij" };

export default async function OtkrijPage() {
  await touchActivity(); // "aktivan upravo sada" signal za Discovery algoritam (sekcija 26)
  const { candidates, error } = await getMoreCandidates();

  return (
    <div className="flex h-[75vh] flex-col gap-3 px-4 pt-4">
      <header>
        <h1 className="text-2xl font-bold">
          💘 <span className="text-gradient">Otkrij</span>
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">Ljudi koji ti najviše odgovaraju</p>
      </header>

      {error ? (
        <EmptyState emoji="⚠️" title="Nešto nije u redu" description={error} />
      ) : candidates.length === 0 ? (
        <EmptyState
          emoji="🔍"
          title="Nema novih profila trenutno"
          description="Ili si prošao/la sve dostupne profile za sada, ili još nema dovoljno korisnika u tvom gradu i uzrastu koji traže tebe. Svrati kasnije — Sada obaveštava kad se pojavi neko nov."
        />
      ) : (
        <OtkrijDeck initialCandidates={candidates} />
      )}
    </div>
  );
}
