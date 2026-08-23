import { createClient } from "@/lib/supabase/server";
import { calculateAge } from "@/lib/utils";
import { UsersTable } from "./UsersTable";

export const metadata = { title: "Admin — Korisnici" };

export default async function AdminUsersPage() {
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, birth_date, city, is_verified, is_discoverable, created_at, last_active_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const ids = (profiles ?? []).map((p) => p.id);

  const [{ data: subs }, { data: purchases }] = await Promise.all([
    ids.length
      ? supabase.from("subscriptions").select("profile_id, status, current_period_end").in("profile_id", ids)
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabase
          .from("credit_transactions")
          .select("profile_id, amount_paid_cents, currency")
          .in("profile_id", ids)
          .eq("reason", "purchase")
      : Promise.resolve({ data: [] }),
  ]);

  const now = new Date();
  const premiumByProfile = new Map(
    (subs ?? [])
      .filter((s) => s.status === "active" && (!s.current_period_end || new Date(s.current_period_end) > now))
      .map((s) => [s.profile_id, true])
  );

  // Zbir po korisniku, po valuti -- ne mešamo eure i druge valute u jedan
  // broj (retko će se desiti da neko ima obe, ali ne izmišljamo kurs).
  const spentByProfile = new Map<string, Map<string, number>>();
  for (const p of purchases ?? []) {
    if (!p.amount_paid_cents) continue;
    const cur = p.currency ?? "eur";
    const forUser = spentByProfile.get(p.profile_id) ?? new Map<string, number>();
    forUser.set(cur, (forUser.get(cur) ?? 0) + p.amount_paid_cents);
    spentByProfile.set(p.profile_id, forUser);
  }

  const rows = (profiles ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    age: calculateAge(p.birth_date),
    city: p.city,
    isVerified: p.is_verified,
    isDiscoverable: p.is_discoverable,
    createdAt: p.created_at,
    lastActiveAt: p.last_active_at,
    isPremium: premiumByProfile.get(p.id) ?? false,
    spent: Array.from(spentByProfile.get(p.id)?.entries() ?? []).map(([currency, cents]) => ({ currency, cents })),
  }));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[var(--color-text-muted)]">
        Poslednjih {rows.length} registrovanih (najnoviji prvi). &bdquo;Potrošeno&ldquo; su samo Credits
        kupovine (jednokratna plaćanja) — za tačan pregled Premium prihoda (mesečna pretplata,
        obnavljanja) koristi Stripe Dashboard, tamo je taj podatak potpun i tačan.
      </p>
      <UsersTable initialUsers={rows} />
    </div>
  );
}
