"use server";

import { revalidatePath } from "next/cache";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();
  if (!user) return { isAdmin: false as const };
  const { data: isAdmin } = await supabase.rpc("is_admin");
  return { isAdmin: !!isAdmin };
}

/**
 * Admin pise poruku "u ime" nekog naloga u njegovom razgovoru -- SAMO kad
 * su OBE strane tog razgovora oznacene kao test nalozi (profiles.is_test_account).
 * Ova ograda je namerna i NE SME da se ukloni/zaobidje: pisanje u ime
 * stvarnog, samostalno registrovanog korisnika bi znacilo da neko realno
 * misli da razgovara sa svojim matchom, a zapravo cita ono sto je admin
 * napisao -- to je obmana prema pravim (cesto placenim) korisnicima.
 */
export async function sendAsTestUser(matchId: string, senderId: string, content: string): Promise<{ error: string | null }> {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Nemaš admin pristup." };
  if (!content.trim()) return { error: "Unesi tekst poruke." };

  const admin = createAdminClient();

  const { data: match } = await admin
    .from("matches")
    .select("profile_a_id, profile_b_id, unmatched_at")
    .eq("id", matchId)
    .maybeSingle();
  if (!match) return { error: "Razgovor nije pronađen." };
  if (match.unmatched_at) return { error: "Ovaj match je prekinut." };
  if (senderId !== match.profile_a_id && senderId !== match.profile_b_id) {
    return { error: "Ta osoba nije deo ovog razgovora." };
  }

  const { data: participants } = await admin
    .from("profiles")
    .select("id, is_test_account")
    .in("id", [match.profile_a_id, match.profile_b_id]);

  const bothTest = participants?.length === 2 && participants.every((p) => p.is_test_account);
  if (!bothTest) {
    return { error: "Moguće je samo kad su OBE strane u razgovoru označene kao test nalozi." };
  }

  const { error } = await admin.from("messages").insert({ match_id: matchId, sender_id: senderId, content: content.trim() });
  if (error) return { error: "Ne mogu da pošaljem poruku." };

  revalidatePath(`/admin/poruke/razgovor/${matchId}`);
  return { error: null };
}
