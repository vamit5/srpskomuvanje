import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { NotificationsList } from "./NotificationsList";

export const metadata = { title: "Obaveštenja" };

/** Gde vodi klik na obaveštenje, po tipu -- MORA se azurirati kad god se doda novi tip notifikacije. */
function notificationHref(type: string, data: { matchId?: string; otherId?: string } | null): string | null {
  if (data?.matchId) return `/poruke/${data.matchId}`;
  switch (type) {
    case "krevet_signal":
      return "/18-plus";
    case "like":
      return "/ko-te-zeli";
    case "nearby":
    case "hot_mode":
    case "event":
      return "/sada";
    // Legacy tipovi (Tajna soba, ukinuta) -- stari redovi u bazi i dalje
    // treba negde da vode umesto da budu mrtvi.
    case "secret_room_request":
    case "secret_room_rejected":
    case "secret_room_pair_ready":
      return "/18-plus";
    default:
      return null;
  }
}

export default async function ObavestenjaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, type, title, body, data, is_read, created_at")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="flex flex-col gap-3 px-4 pt-4">
      <header className="flex items-center gap-2">
        <Link href="/sada" className="text-sm text-[var(--color-text-muted)]">
          ←
        </Link>
        <h1 className="text-2xl font-bold">
          🔔 <span className="text-gradient">Obaveštenja</span>
        </h1>
      </header>

      {!notifications?.length ? (
        <EmptyState emoji="🔔" title="Još nema obaveštenja" description="Ovde će se pojaviti kad nešto novo bude." />
      ) : (
        <NotificationsList
          initialItems={notifications.map((n) => ({
            id: n.id,
            type: n.type,
            title: n.title,
            body: n.body,
            href: notificationHref(n.type, n.data as { matchId?: string; otherId?: string } | null),
            isRead: n.is_read,
            createdAt: n.created_at,
          }))}
        />
      )}
    </div>
  );
}
