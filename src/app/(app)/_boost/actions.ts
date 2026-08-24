"use server";

import { headers } from "next/headers";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

async function getConfigNumber(supabase: Awaited<ReturnType<typeof createClient>>, key: string, fallback: number): Promise<number> {
  const { data } = await supabase.from("muvaj_config").select("value").eq("key", key).maybeSingle();
  const parsed = data ? Number(data.value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export interface BoostInfo {
  priceCents: number;
  currency: string;
  durationMinutes: number;
  activeUntil: string | null;
}

export async function getBoostInfo(): Promise<{ info: BoostInfo | null; error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();
  if (!user) return { info: null, error: "Nisi prijavljen/a." };

  const [priceCents, durationMinutes, { data: profile }] = await Promise.all([
    getConfigNumber(supabase, "boost_price_cents", 299),
    getConfigNumber(supabase, "boost_duration_minutes", 60),
    supabase.from("profiles").select("boost_expires_at").eq("id", user.id).single(),
  ]);
  const { data: currencyRow } = await supabase.from("muvaj_config").select("value").eq("key", "boost_currency").maybeSingle();

  return {
    error: null,
    info: {
      priceCents,
      currency: currencyRow?.value ?? "eur",
      durationMinutes,
      activeUntil:
        profile?.boost_expires_at && new Date(profile.boost_expires_at) > new Date() ? profile.boost_expires_at : null,
    },
  };
}

/** Jednokratna Stripe Checkout sesija za Boost -- isti obrazac kao Credits (mode: "payment", price_data). */
export async function createBoostCheckoutSession(): Promise<{ url: string | null; error: string | null }> {
  const {
    data: { user },
  } = await getAuthUser();
  if (!user) return { url: null, error: "Nisi prijavljen/a." };

  const { info } = await getBoostInfo();
  if (!info) return { url: null, error: "Ne mogu da učitam cenu Boost-a." };

  const baseUrl = await getBaseUrl();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: info.currency,
            unit_amount: info.priceCents,
            product_data: { name: `Srpskomuvanje — Boost ${info.durationMinutes} min` },
          },
          quantity: 1,
        },
      ],
      client_reference_id: user.id,
      customer_email: user.email,
      metadata: { type: "boost", profileId: user.id, durationMinutes: String(info.durationMinutes) },
      success_url: `${baseUrl}/profil?boost=uspesno`,
      cancel_url: `${baseUrl}/profil?boost=otkazano`,
    });

    if (!session.url) return { url: null, error: "Stripe nije vratio link za plaćanje." };
    return { url: session.url, error: null };
  } catch (err) {
    console.error("Stripe boost checkout error:", err);
    return { url: null, error: "Ne mogu trenutno da pokrenem plaćanje. Pokušaj ponovo." };
  }
}
