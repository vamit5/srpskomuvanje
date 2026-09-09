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

/**
 * Pravi jednokratni link za prijavu KAO odredjeni nalog -- radi SAMO za
 * naloge oznacene kao test nalog (profiles.is_test_account). Otvaranjem
 * linka, admin-ov browser se ODJAVLJUJE iz sopstvene sesije i PRIJAVLJUJE
 * kao taj test nalog (prava sesija, ne "poruka u ime nekog" -- otud sme
 * da se koristi i za razgovor sa stvarnim korisnicima: to je isto kao da
 * je admin sam ulogovan na taj nalog preko "Zaboravljena lozinka", samo
 * bez tog koraka). Namerno NE radi za stvaran, samostalno registrovan
 * korisnik -- to bi bilo preuzimanje tudjeg naloga bez njihovog znanja.
 */
export async function loginAsTestAccount(profileId: string): Promise<{ url: string | null; error: string | null }> {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return { url: null, error: "Nemaš admin pristup." };

  const admin = createAdminClient();

  const { data: profile } = await admin.from("profiles").select("is_test_account").eq("id", profileId).maybeSingle();
  if (!profile?.is_test_account) {
    return { url: null, error: "Moguće je samo za naloge označene kao test nalog." };
  }

  const { data: authUser, error: getUserError } = await admin.auth.admin.getUserById(profileId);
  if (getUserError || !authUser?.user?.email) {
    return { url: null, error: "Ne mogu da pronađem email ovog naloga." };
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: authUser.user.email,
  });
  if (linkError || !linkData?.properties?.hashed_token) {
    return { url: null, error: "Ne mogu da napravim link za prijavu." };
  }

  return {
    url: `/auth/confirm?token_hash=${linkData.properties.hashed_token}&type=magiclink&next=/sada`,
    error: null,
  };
}
