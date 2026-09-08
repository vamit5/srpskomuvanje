import { createClient } from "@/lib/supabase/server";
import { SuggestionForm } from "./SuggestionForm";
import { SuggestionsList } from "./SuggestionsList";

export const metadata = { title: "Admin — Predlozi poruka" };

export default async function AdminSuggestionsPage() {
  const supabase = await createClient();

  const { data: suggestions } = await supabase
    .from("chat_suggestions")
    .select("id, category, stage, text, is_active")
    .order("sort_order");

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-1 text-sm font-semibold text-[var(--color-text-muted)]">Novi predlog</h2>
        <p className="mb-3 text-xs text-[var(--color-text-muted)]">
          Faza 1 = prve poruke u razgovoru, Faza 2 = sredina, Faza 3 = kasnije (direktniji ton).
        </p>
        <SuggestionForm />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-muted)]">Svi predlozi</h2>
        <SuggestionsList initialSuggestions={suggestions ?? []} />
      </section>
    </div>
  );
}
