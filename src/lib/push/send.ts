import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:podrska@srpskomuvanje.rs";
  if (!publicKey || !privateKey) return; // push jednostavno preskačemo ako nije podešeno
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Šalje push notifikaciju SVIM uređajima na kojima je dati profil
 * pretplaćen. Tiho preskače ako push nije podešen (nema VAPID ključeva)
 * ili ako korisnik nema nijednu aktivnu pretplatu -- ovo NIKAD ne sme
 * da obori glavnu akciju (slanje poruke, match) koja ga poziva.
 */
export async function sendPushToProfile(profileId: string, payload: PushPayload): Promise<void> {
  ensureConfigured();
  if (!configured) return;

  try {
    const admin = createAdminClient();
    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_key")
      .eq("profile_id", profileId);

    if (!subs?.length) return;

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth_key },
            },
            JSON.stringify(payload)
          );
        } catch (err: unknown) {
          const statusCode = (err as { statusCode?: number })?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            // Pretplata je istekla/ugašena (npr. korisnik je odjavio push u
            // pregledaču) -- počisti je da ne pokušavamo ponovo zauvek.
            await admin.from("push_subscriptions").delete().eq("id", sub.id);
          } else {
            console.error("Push slanje nije uspelo:", err);
          }
        }
      })
    );
  } catch (err) {
    console.error("sendPushToProfile greška:", err);
  }
}
