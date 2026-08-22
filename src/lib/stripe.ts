import "server-only";
import Stripe from "stripe";

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
