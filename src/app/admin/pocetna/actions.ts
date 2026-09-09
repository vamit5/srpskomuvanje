"use server";

import { revalidatePath } from "next/cache";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { SITE_CONTENT_DEFAULTS, type SiteContentKey } from "@/lib/siteContent";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();
  if (!user) return { supabase, isAdmin: false as const };
  const { data: isAdmin } = await supabase.rpc("is_admin");
  return { supabase, isAdmin: !!isAdmin };
}

/** Prima SAMO poznate kljuceve (SITE_CONTENT_DEFAULTS) -- ignorise sve ostalo,
 * admin menja vrednost postojecih polja, ne pravi proizvoljne nove redove. */
export async function updateSiteContent(values: Record<string, string>): Promise<{ error: string | null }> {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Nemaš admin pristup." };

  const knownKeys = Object.keys(SITE_CONTENT_DEFAULTS) as SiteContentKey[];
  const rows = knownKeys
    .filter((key) => key in values)
    .map((key) => ({ key, value: values[key] }));

  if (!rows.length) return { error: null };

  const { error } = await supabase.from("site_content").upsert(rows, { onConflict: "key" });
  if (error) return { error: "Ne mogu da sačuvam sadržaj." };

  revalidatePath("/");
  revalidatePath("/admin/pocetna");
  return { error: null };
}
