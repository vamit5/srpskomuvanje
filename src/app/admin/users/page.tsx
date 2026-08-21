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

  const rows = (profiles ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    age: calculateAge(p.birth_date),
    city: p.city,
    isVerified: p.is_verified,
    isDiscoverable: p.is_discoverable,
    createdAt: p.created_at,
    lastActiveAt: p.last_active_at,
  }));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[var(--color-text-muted)]">Poslednjih {rows.length} registrovanih (najnoviji prvi).</p>
      <UsersTable initialUsers={rows} />
    </div>
  );
}
