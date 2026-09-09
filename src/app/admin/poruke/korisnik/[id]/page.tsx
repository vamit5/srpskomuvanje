import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Admin — Razgovori korisnika" };

export default async function AdminUserMatchesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase.from("profiles").select("name").eq("id", id).maybeSingle();
  if (!profile) notFound();

  const { data: matches } = await supabase
    .from("matches")
    .select("id, profile_a_id, profile_b_id, matched_at, unmatched_at")
    .or(`profile_a_id.eq.${id},profile_b_id.eq.${id}`)
    .order("matched_at", { ascending: false });

  const otherIds = (matches ?? []).map((m) => (m.profile_a_id === id ? m.profile_b_id : m.profile_a_id));
  const { data: others } = otherIds.length ? await supabase.from("profiles").select("id, name").in("id", otherIds) : { data: [] };
  const nameById = new Map((others ?? []).map((o) => [o.id, o.name]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Link href="/admin/poruke" className="text-sm text-[var(--color-text-muted)] underline">
          ← Pretraga
        </Link>
      </div>
      <h2 className="text-lg font-semibold">Razgovori — {profile.name}</h2>

      {!matches?.length ? (
        <p className="text-sm text-[var(--color-text-muted)]">Ovaj korisnik nema matcheva.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {matches.map((m) => {
            const otherId = m.profile_a_id === id ? m.profile_b_id : m.profile_a_id;
            return (
              <li key={m.id}>
                <Link
                  href={`/admin/poruke/razgovor/${m.id}`}
                  className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3 text-sm hover:border-[var(--color-accent)]"
                >
                  <span>
                    sa {nameById.get(otherId) ?? "?"} {m.unmatched_at && <span className="text-[var(--color-text-faint)]">(prekinut)</span>}
                  </span>
                  <span className="text-[var(--color-text-muted)]">{new Date(m.matched_at).toLocaleDateString("sr-RS")} →</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
