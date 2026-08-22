import { createClient } from "@/lib/supabase/server";
import { EventForm } from "./EventForm";
import { EventsList } from "./EventsList";

export const metadata = { title: "Admin — Događaji" };

export default async function AdminEventsPage() {
  const supabase = await createClient();

  const { data: events } = await supabase
    .from("events")
    .select("id, title, description, city, starts_at, ends_at, is_active")
    .order("starts_at", { ascending: false })
    .limit(20);

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-muted)]">Novi događaj (npr. &ldquo;Vrelo petak&rdquo;)</h2>
        <EventForm />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-muted)]">Poslednji događaji</h2>
        <EventsList initialEvents={events ?? []} />
      </section>
    </div>
  );
}
