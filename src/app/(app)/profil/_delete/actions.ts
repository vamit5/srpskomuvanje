"use server";

import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

/**
 * Brisanje naloga -- NAMERNO soft-delete (deleted_at + scrub licnih
 * podataka), ne hard-delete auth korisnika. profiles.id ima "on delete
 * cascade" na matches/messages/itd -- da smo hard-obrisali auth red,
 * povukli bismo za sobom i CELU istoriju razgovora DRUGE strane (njihov
 * match/chat bi nestao samo zato sto je OVAJ korisnik obrisao nalog).
 * Soft-delete + RLS ("deleted_at is null") vec sakriva korisnika svuda
 * (Muvaj, Ko te zeli, 18+, pretraga) -- vidi schema.sql komentar uz kolonu.
 */
export async function deleteMyAccount(): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();
  if (!user) return { error: "Nisi prijavljen/a." };

  // Best-effort otkazivanje aktivne Stripe pretplate -- ne sme da obori
  // brisanje naloga ako Stripe poziv ne uspe (korisnik i dalje ocekuje da
  // je nalog obrisan; eventualnu naplatu resava webhook/podrska naknadno).
  try {
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("provider_subscription_id, status")
      .eq("profile_id", user.id)
      .maybeSingle();
    if (subscription?.status === "active" && subscription.provider_subscription_id) {
      await stripe.subscriptions.cancel(subscription.provider_subscription_id);
    }
  } catch (err) {
    console.error("Otkazivanje pretplate pri brisanju naloga nije uspelo:", err);
  }

  await supabase.from("push_subscriptions").delete().eq("profile_id", user.id);

  const { error } = await supabase
    .from("profiles")
    .update({
      deleted_at: new Date().toISOString(),
      is_discoverable: false,
      name: "Obrisan korisnik",
      bio: null,
      interests: [],
      food_favorites: [],
      city: null,
      lat: null,
      lng: null,
    })
    .eq("id", user.id);

  if (error) return { error: "Ne mogu da obrišem nalog. Pokušaj ponovo ili nas kontaktiraj." };

  await supabase.auth.signOut();
  redirect("/");
}
