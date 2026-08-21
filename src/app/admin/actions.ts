"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, isAdmin: false };
  const { data: isAdmin } = await supabase.rpc("is_admin");
  return { supabase, user, isAdmin: !!isAdmin };
}

export async function updateReportStatus(
  reportId: string,
  status: "resolved" | "dismissed"
): Promise<{ error: string | null }> {
  const { supabase, user, isAdmin } = await requireAdmin();
  if (!isAdmin || !user) return { error: "Nemaš admin pristup." };

  const { error } = await supabase
    .from("reports")
    .update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", reportId);

  if (error) return { error: "Ne mogu da ažuriram prijavu." };
  revalidatePath("/admin/reports");
  return { error: null };
}

export async function toggleDiscoverable(profileId: string, discoverable: boolean): Promise<{ error: string | null }> {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Nemaš admin pristup." };

  const { error } = await supabase.from("profiles").update({ is_discoverable: discoverable }).eq("id", profileId);
  if (error) return { error: "Ne mogu da ažuriram profil." };

  revalidatePath("/admin/users");
  revalidatePath("/admin/reports");
  return { error: null };
}
