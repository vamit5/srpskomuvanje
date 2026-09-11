import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Tekst "Izdvojen profil" bedza -- editabilan na /admin/pocetna (site_content). */
export async function getFeaturedBadgeLabel(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase.from("site_content").select("value").eq("key", "featured_badge_label").maybeSingle();
  return data?.value ?? "✨ Izdvojen profil";
}
