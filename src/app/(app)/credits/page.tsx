import Link from "next/link";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { CREDIT_REASON_LABEL, type CreditReason } from "@/lib/credits";
import { CreditsPageClient } from "./CreditsPageClient";

export const metadata = { title: "Credits" };

export default async function CreditsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();
  if (!user) return null;

  const [{ data: wallet }, { data: transactions }] = await Promise.all([
    supabase.from("wallets").select("balance_credits").eq("profile_id", user.id).maybeSingle(),
    supabase
      .from("credit_transactions")
      .select("id, amount, reason, amount_paid_cents, currency, created_at")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="flex flex-col gap-6 px-4 pt-4 pb-8">
      <header className="flex items-center gap-2">
        <Link href="/profil" className="text-sm text-[var(--color-text-muted)]">
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-bold">
            🔥 <span className="text-gradient">Credits</span>
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">Tvoj saldo, kupovina i istorija — sve na jednom mestu.</p>
        </div>
      </header>

      <CreditsPageClient balance={wallet?.balance_credits ?? 0} />

      <section>
        <h2 className="mb-2 text-sm font-semibold text-[var(--color-text-muted)]">Istorija</h2>
        {!transactions?.length ? (
          <p className="rounded-2xl border border-dashed border-[var(--color-border-strong)] px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">
            Još nema transakcija.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {transactions.map((t) => {
              const meta = CREDIT_REASON_LABEL[t.reason as CreditReason] ?? { label: t.reason, emoji: "•" };
              const positive = t.amount > 0;
              return (
                <div
                  key={t.id}
                  className="glass flex items-center justify-between rounded-xl px-4 py-2.5 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span>{meta.emoji}</span>
                    <span>
                      {meta.label}
                      <span className="block text-xs text-[var(--color-text-faint)]">
                        {new Date(t.created_at).toLocaleDateString("sr-RS", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {t.amount_paid_cents ? (
                          <>
                            {" · "}
                            {new Intl.NumberFormat("sr-RS", {
                              style: "currency",
                              currency: (t.currency ?? "eur").toUpperCase(),
                            }).format(t.amount_paid_cents / 100)}
                          </>
                        ) : null}
                      </span>
                    </span>
                  </span>
                  <span
                    className={
                      positive ? "font-bold text-[var(--color-success)]" : "font-bold text-[var(--color-text-muted)]"
                    }
                  >
                    {positive ? "+" : ""}
                    {t.amount}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
