import Link from "next/link";
import { ListChecks } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { SerbianFlag } from "@/components/SerbianFlag";
import { getMoreCandidates, touchActivity } from "./actions";
import { MuvajDeck } from "./MuvajDeck";

export const metadata = { title: "Muvaj" };

export default async function MuvajPage() {
  await touchActivity(); // "aktivan upravo sada" signal za Discovery algoritam (sekcija 26)
  const { candidates, error } = await getMoreCandidates();

  return (
    <div className="flex flex-col gap-3 px-4 pt-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-1.5 text-2xl font-bold">
            🔥 <span className="text-gradient">Muvaj</span>{" "}
            <SerbianFlag className="mb-0.5 h-4 w-6 rounded-[2px]" />
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">Ljudi koji ti najviše odgovaraju</p>
        </div>
        <Link
          href="/muvaj/izbori"
          aria-label="Moji izbori"
          className="tap-scale glass flex shrink-0 flex-col items-center gap-0.5 rounded-2xl px-3 py-2"
          title="Moji izbori — ljudi koje čekaš da ti odgovore"
        >
          <ListChecks size={20} className="text-[var(--color-accent)]" />
          <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">Moji izbori</span>
        </Link>
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
        <MuvajDeck initialCandidates={candidates} />
      )}
    </div>
  );
}
