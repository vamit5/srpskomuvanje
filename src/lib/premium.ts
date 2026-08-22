import { createClient } from "@/lib/supabase/server";

/**
 * Da li JA (ulogovani korisnik) trenutno imam aktivan Premium.
 * Radi preko obične (ne admin) klijenta -- RLS politika "korisnik vidi
 * svoju pretplatu" (auth.uid() = profile_id) je dovoljna, jer se ovo uvek
 * poziva za sopstveni nalog.
 */
export async function isPremium(profileId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (!data || data.status !== "active") return false;
  if (data.current_period_end && new Date(data.current_period_end) < new Date()) return false;
  return true;
}

/** Besplatni korisnici imaju ograničen broj Duela dnevno (sekcija 27) -- Premium neograničeno. */
export const FREE_DAILY_DUEL_LIMIT = 5;
