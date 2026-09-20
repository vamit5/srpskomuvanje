import { createClient } from "@/lib/supabase/server";
import { ManualPaymentsList } from "./ManualPaymentsList";

export const metadata = { title: "Admin — Uplate na račun" };

export default async function AdminManualPaymentsPage() {
  const supabase = await createClient();

  const { data: requests } = await supabase
    .from("manual_payment_requests")
    .select("id, profile_id, type, amount_label, reference_code, status, created_at, profiles:profile_id(name)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-semibold text-[var(--color-text-muted)]">Ručne uplate na račun</h2>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          Proveri da li je novac stvarno stigao na bankovni račun (po šifri plaćanja) PRE nego što odobriš. Odobravanje
          odmah aktivira Premium/Credits/Boost korisniku.
        </p>
      </div>
      <ManualPaymentsList
        initialRequests={(requests ?? []).map((r) => ({
          id: r.id,
          profileId: r.profile_id,
          profileName: (r.profiles as unknown as { name: string } | null)?.name ?? "?",
          type: r.type,
          amountLabel: r.amount_label,
          referenceCode: r.reference_code,
          status: r.status,
          createdAt: r.created_at,
        }))}
      />
    </div>
  );
}
