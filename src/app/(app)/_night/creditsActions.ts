"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  priceCents: number;
  currency: string;
}

export async function getCreditPackages(): Promise<{ packages: CreditPackage[]; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("credit_packages")
    .select("id, name, credits, price_cents, currency")
    .eq("is_active", true)
    .order("position");

  if (error) return { packages: [], error: "Ne mogu da učitam pakete." };
  return {
    packages: (data ?? []).map((p) => ({ id: p.id, name: p.name, credits: p.credits, priceCents: p.price_cents, currency: p.currency })),
    error: null,
  };
}

/**
 * Jednokratna Stripe Checkout sesija (mode: "payment", NE "subscription" --
 * to je posebna funkcija od _premium/actions.ts). Iznos se ne šalje sa
 * klijenta -- čita se iz baze po packageId da korisnik ne bi mogao da
 * izmeni cenu u browseru.
 */
export async function createCreditsCheckoutSession(
  packageId: string
): Promise<{ url: string | null; error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { url: null, error: "Nisi prijavljen/a." };

  const { data: pkg } = await supabase
    .from("credit_packages")
    .select("id, name, credits, price_cents, currency")
    .eq("id", packageId)
    .eq("is_active", true)
    .maybeSingle();
  if (!pkg) return { url: null, error: "Ovaj paket više nije dostupan." };

  const baseUrl = await getBaseUrl();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: pkg.currency,
            unit_amount: pkg.price_cents,
            product_data: { name: `Srpskomuvanje — ${pkg.name}` },
          },
          quantity: 1,
        },
      ],
      client_reference_id: user.id,
      customer_email: user.email,
      // metadata čita webhook da zna KOME i koliko kredita da doda --
      // webhook nema pristup ulogovanoj sesiji.
      metadata: { type: "credits", packageId: pkg.id, profileId: user.id, credits: String(pkg.credits) },
      success_url: `${baseUrl}/poruke?iskrice=uspesno`,
      cancel_url: `${baseUrl}/poruke?iskrice=otkazano`,
    });

    if (!session.url) return { url: null, error: "Stripe nije vratio link za plaćanje." };
    return { url: session.url, error: null };
  } catch (err) {
    console.error("Stripe credits checkout error:", err);
    return { url: null, error: "Ne mogu trenutno da pokrenem plaćanje. Pokušaj ponovo." };
  }
}
