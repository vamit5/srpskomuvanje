import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Admin — Poruke korisnika" };

export default async function AdminMessagesSearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const supabase = await createClient();

  const query = q?.trim() ?? "";
  const { data: results } = query
    ? await supabase.from("profiles").select("id, name, city").ilike("name", `%${query}%`).limit(20)
    : { data: [] };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Poruke korisnika</h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Pregled razgovora (samo za čitanje) — za istragu prijava i sporova. Pretraži korisnika po imenu.
        </p>
      </div>

      <form className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Ime korisnika..."
          className="h-12 flex-1 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-4 text-[15px] outline-none focus:border-[var(--color-accent)]"
        />
        <button type="submit" className="tap-scale rounded-xl bg-gradient-accent px-4 text-sm font-bold text-white">
          Traži
        </button>
      </form>

      {query && (
        <ul className="flex flex-col gap-2">
          {!results?.length && <p className="text-sm text-[var(--color-text-muted)]">Nema rezultata.</p>}
          {(results ?? []).map((p) => (
            <li key={p.id}>
              <Link
                href={`/admin/poruke/korisnik/${p.id}`}
                className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3 text-sm hover:border-[var(--color-accent)]"
              >
                <span>
                  {p.name} {p.city && <span className="text-[var(--color-text-muted)]">· {p.city}</span>}
                </span>
                <span className="text-[var(--color-text-muted)]">Vidi razgovore →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
