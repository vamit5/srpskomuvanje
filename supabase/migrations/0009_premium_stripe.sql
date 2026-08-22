-- FAZA 8: Premium pretplata preko Stripe-a (sekcije 27-28).
-- Pokreni u Supabase SQL Editoru.

-- Stripe Customer ID -- treba nam da bismo korisnika mogli poslati na
-- Stripe "Billing Portal" (da sam otkaže/promeni karticu) bez ponovnog
-- traženja email-a. Popunjava ga webhook kad se pretplata prvi put napravi.
alter table subscriptions add column if not exists stripe_customer_id text;

-- Jedan korisnik = najviše jedan red pretplate. Webhook upisuje sa
-- upsert(onConflict: profile_id) -- ako se neko ponovo pretplati posle
-- otkazivanja, isti red se samo ažurira umesto da se gomilaju duplikati.
alter table subscriptions add constraint subscriptions_profile_id_unique unique (profile_id);

create index if not exists subscriptions_stripe_customer_idx on subscriptions (stripe_customer_id);
