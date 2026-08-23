-- Admin panel: prikaz Premium statusa i STVARNE potrošnje (u eurima) po
-- korisniku. Kredit transakcije do sada nisu čuvale iznos u novcu (samo
-- broj kredita) -- dodajemo ga OVDE, na izvoru (webhook u trenutku
-- kupovine), da se ne bi kasnije "nagađalo" koliko je nešto koštalo.

alter table credit_transactions add column if not exists amount_paid_cents int;
alter table credit_transactions add column if not exists currency text;

-- "create or replace" NE zamenjuje funkciju ako se lista parametara
-- promeni (Postgres to tretira kao NOVO preklapanje/overload) -- moramo
-- eksplicitno obrisati staru verziju da ne ostanu dve funkcije istog imena.
drop function if exists credit_wallet(uuid, int, text, text, text);

create or replace function credit_wallet(
  p_profile_id uuid,
  p_amount int,
  p_reason text,
  p_stripe_payment_intent_id text default null,
  p_stripe_checkout_session_id text default null,
  p_amount_paid_cents int default null,
  p_currency text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into wallets (profile_id, balance_credits)
  values (p_profile_id, greatest(p_amount, 0))
  on conflict (profile_id) do update set balance_credits = wallets.balance_credits + p_amount;

  insert into credit_transactions (
    profile_id, amount, reason, stripe_payment_intent_id, stripe_checkout_session_id,
    amount_paid_cents, currency
  )
  values (
    p_profile_id, p_amount, p_reason, p_stripe_payment_intent_id, p_stripe_checkout_session_id,
    p_amount_paid_cents, p_currency
  );
end;
$$;

revoke execute on function credit_wallet(uuid, int, text, text, text, int, text) from public;
grant execute on function credit_wallet(uuid, int, text, text, text, int, text) to service_role;
