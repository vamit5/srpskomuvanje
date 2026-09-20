import "server-only";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Stripe klijent -- SAMO server-side (secret key nikad ne sme u browser).
 * Koristi se za pravljenje Checkout sesija, Billing Portal linkova, i za
 * verifikaciju webhook potpisa.
 */
function getStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY nije podešen u .env.local -- potreban za Premium pretplatu."
    );
  }
  return key;
}

export const stripe = new Stripe(getStripeSecretKey());

export function getPremiumPriceId(): string {
  const priceId = process.env.STRIPE_PREMIUM_PRICE_ID;
  if (!priceId) {
    throw new Error("STRIPE_PREMIUM_PRICE_ID nije podešen u .env.local.");
  }
  return priceId;
}

/**
 * Privremena dijagnostika (ista ideja kao email_debug_log) -- beleži TAČNU
 * Stripe grešku u bazu umesto da je samo tiho proguta generic poruka
 * korisniku. Vercel-ovi logovi na ovom planu drže mali rolling bafer i
 * prebrzo se prepisuju da bi se uhvatila greška uživo dok korisnik testira.
 */
export async function logStripeError(context: string, err: unknown): Promise<void> {
  console.error(`Stripe greška (${context}):`, err);
  const errorText =
    err instanceof Stripe.errors.StripeError
      ? `${err.type} / ${err.code ?? "?"}: ${err.message}`
      : err instanceof Error
        ? err.message
        : String(err);
  try {
    await createAdminClient().from("stripe_debug_log").insert({ context, error_text: errorText });
  } catch {
    // ignoriši -- ne dozvoli da dijagnostika obori originalnu grešku
  }
}
