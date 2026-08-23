import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Stripe šalje ovde POST kad se nešto desi sa pretplatom (plaćeno, otkazano,
 * kartica odbijena...). OVO je jedini pravi izvor istine za status pretplate
 * -- klijent nikad direktno ne upisuje u `subscriptions`, jer bi to
 * korisniku dalo Premium besplatno bez stvarnog plaćanja.
 *
 * Lokalno testiranje: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
 * (ispiše privremeni whsec_... koji ide u STRIPE_WEBHOOK_SECRET).
 * Posle deploy-a: Stripe Dashboard -> Developers -> Webhooks -> Add endpoint
 * -> https://tvoj-domen/api/stripe/webhook -> tamo dobiješ trajni whsec_...
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET nije podešen -- webhook odbijen.");
    return new Response("Webhook nije podešen na serveru.", { status: 500 });
  }
  if (!signature) {
    return new Response("Nedostaje stripe-signature header.", { status: 400 });
  }

  // Sirov (neparsiran) tekst tela je OBAVEZAN za proveru potpisa -- zato
  // request.text(), ne request.json().
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook: nevažeći potpis.", err);
    return new Response("Nevažeći potpis.", { status: 400 });
  }

  const admin = createAdminClient();

  // Stripe API stanja pretplate mapiramo na naša (check constraint u bazi
  // dozvoljava samo: active, canceled, expired, trialing).
  function mapStatus(stripeStatus: Stripe.Subscription.Status): "active" | "canceled" | "expired" | "trialing" {
    if (stripeStatus === "active") return "active";
    if (stripeStatus === "trialing") return "trialing";
    if (stripeStatus === "canceled") return "canceled";
    // past_due, unpaid, incomplete, incomplete_expired, paused -- tretiramo
    // kao "nema više Premium" dok se ne reši (Stripe sam pokušava naplatu
    // više puta pre nego što stigne do "canceled").
    return "expired";
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Jednokratna kupovina Iskrica (Noćno muvanje) -- odvojeno od
        // pretplate ispod, prepoznaje se po mode: "payment" + metadata.type.
        if (session.mode === "payment" && session.metadata?.type === "credits") {
          const profileId = session.metadata.profileId;
          const credits = Number(session.metadata.credits);
          if (!profileId || !Number.isFinite(credits) || credits <= 0) break;

          // Idempotencija -- Stripe ume da isporuči isti event više puta
          // (retry), ne smemo dodati kredite dvaput za istu sesiju.
          const { data: existing } = await admin
            .from("credit_transactions")
            .select("id")
            .eq("stripe_checkout_session_id", session.id)
            .maybeSingle();
          if (existing) break;

          const paymentIntentId =
            typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;

          const { error } = await admin.rpc("credit_wallet", {
            p_profile_id: profileId,
            p_amount: credits,
            p_reason: "purchase",
            p_stripe_payment_intent_id: paymentIntentId,
            p_stripe_checkout_session_id: session.id,
            p_amount_paid_cents: session.amount_total,
            p_currency: session.currency,
          });
          if (error) console.error("Stripe webhook: dodela Iskrica nije uspela.", error);
          break;
        }

        const profileId = session.client_reference_id;
        if (!profileId || session.mode !== "subscription" || !session.subscription) break;

        const subscriptionId =
          typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
        // current_period_end živi na svakoj stavci (subscription item), ne
        // više na samoj pretplati -- promena u novijoj Stripe API verziji.
        const periodEnd = subscription.items.data[0]?.current_period_end;

        const { error } = await admin.from("subscriptions").upsert(
          {
            profile_id: profileId,
            tier: "premium",
            status: mapStatus(subscription.status),
            provider: "stripe",
            provider_subscription_id: subscription.id,
            stripe_customer_id: customerId,
            current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
            cancel_at_period_end: subscription.cancel_at_period_end,
          },
          { onConflict: "profile_id" }
        );
        if (error) console.error("Stripe webhook: upis pretplate nije uspeo.", error);
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const periodEnd = subscription.items.data[0]?.current_period_end;

        const { error } = await admin
          .from("subscriptions")
          .update({
            status: mapStatus(subscription.status),
            current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
            cancel_at_period_end: subscription.cancel_at_period_end,
          })
          .eq("provider_subscription_id", subscription.id);
        if (error) console.error("Stripe webhook: ažuriranje pretplate nije uspelo.", error);
        break;
      }

      default:
        break; // ostali eventi nas ne zanimaju
    }
  } catch (err) {
    console.error("Stripe webhook: neočekivana greška pri obradi.", err);
    return new Response("Interna greška.", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
