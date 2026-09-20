"use server";

import { revalidatePath } from "next/cache";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();
  if (!user) return { supabase, isAdmin: false as const, adminId: null };
  const { data: isAdmin } = await supabase.rpc("is_admin");
  return { supabase, isAdmin: !!isAdmin, adminId: user.id };
}

/**
 * Odobri rucnu uplatu -- SAMO posto je admin RUCNO proverio na pravom
 * bankovnom izvodu da je novac stvarno stigao (sa tacnom sifrom placanja).
 * Ovo NIJE automatska potvrda placanja -- to bi bilo lazno predstavljanje.
 */
export async function approveManualPayment(requestId: string): Promise<{ error: string | null }> {
  const { supabase, isAdmin, adminId } = await requireAdmin();
  if (!isAdmin || !adminId) return { error: "Nemaš admin pristup." };

  const { data: reqRow } = await supabase
    .from("manual_payment_requests")
    .select("id, profile_id, type, package_id, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!reqRow) return { error: "Zahtev ne postoji." };
  if (reqRow.status !== "pending") return { error: "Ovaj zahtev je već obrađen." };

  const admin = createAdminClient();

  if (reqRow.type === "premium") {
    const { error } = await admin.from("subscriptions").upsert(
      {
        profile_id: reqRow.profile_id,
        tier: "premium",
        status: "active",
        provider: "manual",
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        cancel_at_period_end: false,
      },
      { onConflict: "profile_id" }
    );
    if (error) return { error: "Ne mogu da aktiviram Premium." };
  } else if (reqRow.type === "credits") {
    if (!reqRow.package_id) return { error: "Zahtevu nedostaje paket." };
    const { data: pkg } = await admin.from("credit_packages").select("credits").eq("id", reqRow.package_id).maybeSingle();
    if (!pkg) return { error: "Paket više ne postoji." };
    const { error } = await admin.rpc("credit_wallet", {
      p_profile_id: reqRow.profile_id,
      p_amount: pkg.credits,
      p_reason: "manual_purchase",
    });
    if (error) return { error: "Ne mogu da dodam Credits." };
  } else if (reqRow.type === "boost") {
    const { data: durationRow } = await admin.from("muvaj_config").select("value").eq("key", "boost_duration_minutes").maybeSingle();
    const parsed = durationRow ? Number(durationRow.value) : NaN;
    const durationMinutes = Number.isFinite(parsed) ? parsed : 60;
    const { error } = await admin
      .from("profiles")
      .update({ boost_expires_at: new Date(Date.now() + durationMinutes * 60 * 1000).toISOString() })
      .eq("id", reqRow.profile_id);
    if (error) return { error: "Ne mogu da aktiviram Boost." };
  }

  const { error: statusError } = await admin
    .from("manual_payment_requests")
    .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: adminId })
    .eq("id", requestId)
    .eq("status", "pending");
  if (statusError) return { error: "Odobreno, ali ne mogu da ažuriram status zahteva." };

  revalidatePath("/admin/uplate");
  return { error: null };
}

export async function rejectManualPayment(requestId: string): Promise<{ error: string | null }> {
  const { supabase, isAdmin, adminId } = await requireAdmin();
  if (!isAdmin || !adminId) return { error: "Nemaš admin pristup." };

  const { error } = await supabase
    .from("manual_payment_requests")
    .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: adminId })
    .eq("id", requestId)
    .eq("status", "pending");
  if (error) return { error: "Ne mogu da odbijem zahtev." };

  revalidatePath("/admin/uplate");
  return { error: null };
}
