import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TestSendForm } from "./TestSendForm";

export const metadata = { title: "Admin — Razgovor" };

export default async function AdminConversationPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  const supabase = await createClient();

  const { data: match } = await supabase.from("matches").select("id, profile_a_id, profile_b_id, unmatched_at").eq("id", matchId).maybeSingle();
  if (!match) notFound();

  const [{ data: profiles }, { data: messages }] = await Promise.all([
    supabase.from("profiles").select("id, name, is_test_account").in("id", [match.profile_a_id, match.profile_b_id]),
    supabase
      .from("messages")
      .select("id, sender_id, content, image_url, night_content_id, created_at, deleted_at")
      .eq("match_id", matchId)
      .order("created_at"),
  ]);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));
  const bothTest = profiles?.length === 2 && profiles.every((p) => p.is_test_account);

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/admin/poruke/korisnik/${match.profile_a_id}`} className="text-sm text-[var(--color-text-muted)] underline">
        ← Nazad
      </Link>
      <h2 className="text-lg font-semibold">
        {nameById.get(match.profile_a_id) ?? "?"} ↔ {nameById.get(match.profile_b_id) ?? "?"}
        {bothTest && <span className="ml-2 rounded-full bg-[var(--color-accent)]/15 px-2 py-0.5 text-xs font-bold text-[var(--color-accent)]">TEST</span>}
      </h2>
      <p className="text-xs text-[var(--color-text-muted)]">
        {bothTest
          ? "Oba naloga su test nalozi -- ispod možeš da pišeš u njihovo ime."
          : "Samo za čitanje — za istragu prijava/sporova."}{" "}
        Efemerni sadržaj iz Noćnog muvanja se ovde ne prikazuje (pregleda se na{" "}
        <Link href="/admin/nocno-muvanje" className="underline">
          /admin/nocno-muvanje
        </Link>
        ).
      </p>

      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
        {!messages?.length ? (
          <p className="text-sm text-[var(--color-text-muted)]">Nema poruka.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="flex flex-col gap-0.5 border-b border-[var(--color-border)] pb-2 last:border-0">
              <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                {nameById.get(m.sender_id) ?? "?"} · {new Date(m.created_at).toLocaleString("sr-RS")}
              </span>
              {m.deleted_at ? (
                <span className="text-sm italic text-[var(--color-text-faint)]">(obrisana poruka)</span>
              ) : m.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.image_url} alt="" className="max-h-64 max-w-xs rounded-xl object-cover" />
              ) : m.night_content_id ? (
                <span className="text-sm italic text-[var(--color-text-faint)]">
                  📷 Sadržaj iz Noćnog muvanja (pregleda se u /admin/nocno-muvanje)
                </span>
              ) : (
                <p className="text-sm">{m.content}</p>
              )}
            </div>
          ))
        )}
      </div>

      {bothTest && !match.unmatched_at && (
        <TestSendForm
          matchId={matchId}
          participants={[match.profile_a_id, match.profile_b_id].map((id) => ({ id, name: nameById.get(id) ?? "?" }))}
        />
      )}
    </div>
  );
}
