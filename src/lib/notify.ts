import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";

/**
 * Mejl fallback za NE-chat obaveštenja (match, 18+ chat signal, "neko hoće
 * da te upozna") -- ista logika kao u poruke/actions.ts sendMessage: SAMO
 * za primaoce bez ijedne push pretplate (iPhone bez instalirane PWA
 * ikonice, ili niko ko jos nije ukljucio push). Test nalozi (nasumicna
 * lozinka, niko je ne zna) dobijaju magic-link umesto obicnog linka --
 * isti mehanizam kao "Uđi kao ovaj nalog".
 */
export async function sendEmailFallback(
  profileId: string,
  opts: { subject: string; bodyHtml: string; path: string }
): Promise<void> {
  const admin = createAdminClient();

  const { count: pushSubCount } = await admin
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId);
  if ((pushSubCount ?? 0) > 0) return;

  const [{ data: authUser }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(profileId),
    admin.from("profiles").select("is_test_account").eq("id", profileId).maybeSingle(),
  ]);
  const email = authUser?.user?.email;
  if (!email) return;

  let url = `https://srpskomuvanje.vercel.app${opts.path}`;
  if (profile?.is_test_account) {
    const { data: linkData } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (linkData?.properties?.hashed_token) {
      url = `https://srpskomuvanje.vercel.app/auth/confirm?token_hash=${linkData.properties.hashed_token}&type=magiclink&next=${opts.path}`;
    }
  }

  await sendEmail({
    to: email,
    subject: opts.subject,
    html: `${opts.bodyHtml}<p><a href="${url}">Otvori Srpskomuvanje →</a></p>`,
  });
}
