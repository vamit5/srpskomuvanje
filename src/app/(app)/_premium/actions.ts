"use server";

import { headers } from "next/headers";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { stripe, getPremiumPriceId } from "@/lib/stripe";

/** Localhost u razvoju, pravi domen posle deploy-a -- čita se iz same requestove adrese. */
async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

/** Napravi Stripe Checkout sesiju i vrati link -- klijent preusmerava korisnika tamo. */
export async function createCheckoutSession(): Promise<{ url: string | null; error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();
  if (!user) return { url: null, error: "Nisi prijavljen/a." };

  const { data: existing } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("profile_id", user.id)
    .maybeSingle();

  const baseUrl = await getBaseUrl();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: getPremiumPriceId(), quantity: 1 }],
      // client_reference_id je kako webhook zna KOM profilu da upiše
      // pretplatu -- webhook nema pristup ulogovanoj sesiji korisnika.
      client_reference_id: user.id,
      customer: existing?.stripe_customer_id ?? undefined,
      customer_email: existing?.stripe_customer_id ? undefined : user.email,
      success_url: `${baseUrl}/profil?premium=uspesno`,
      cancel_url: `${baseUrl}/profil?premium=otkazano`,
    });

    if (!session.url) return { url: null, error: "Stripe nije vratio link za plaćanje." };
    return { url: session.url, error: null };
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return { url: null, error: "Ne mogu trenutno da pokrenem plaćanje. Pokušaj ponovo." };
  }
}

/** Link ka Stripe stranici gde korisnik sam upravlja pretplatom (otkaz, kartica, računi). */
export async function createBillingPortalSession(): Promise<{ url: string | null; error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();
  if (!user) return { url: null, error: "Nisi prijavljen/a." };

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!sub?.stripe_customer_id) return { url: null, error: "Nemaš još aktivnu pretplatu." };

  const baseUrl = await getBaseUrl();

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${baseUrl}/profil`,
    });
    return { url: portalSession.url, error: null };
  } catch (err) {
    console.error("Stripe billing portal error:", err);
    return { url: null, error: "Ne mogu trenutno da otvorim upravljanje pretplatom." };
  }
}
