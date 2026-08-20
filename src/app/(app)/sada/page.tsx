import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Sada" };

export default async function SadaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { count: unreadNotifications } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user!.id)
    .eq("is_read", false);

  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <header>
        <h1 className="text-2xl font-bold">
          🔥 <span className="text-gradient">Sada</span>
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">Šta se dešava upravo sada</p>
      </header>

      {unreadNotifications ? (
        <div className="glass rounded-2xl px-4 py-3 text-sm">
          Imaš <strong>{unreadNotifications}</strong> nepročitanih obaveštenja.
        </div>
      ) : null}

      <EmptyState
        emoji="👀"
        title="Ovde uskoro počinje akcija"
        description="Čim počneš da lajkuješ, dobijaš matcheve i budeš aktivan/na, ovde ćeš uživo videti ko je nov u tvojoj blizini, ko te je lajkovao i ko je online. Diskavri (Otkrij) dolazi u sledećoj fazi razvoja."
      />
    </div>
  );
}
