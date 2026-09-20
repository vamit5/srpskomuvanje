-- Usput ispravljeno: 'boost_purchase' je slucajno izgubljen iz dozvoljenih
-- credit_transactions.reason vrednosti kad je 0018 dodala 'signup_bonus'
-- (drop+recreate constraint bez prenosa stare vrednosti) -- Stripe webhook
-- boost upis je od tada tiho padao (samo logovano, nije rusio ceo webhook,
-- ali istorija transakcije se nije pravila). Dodata i 'manual_purchase' za
-- rucne uplate ispod.
alter table credit_transactions drop constraint if exists credit_transactions_reason_check;
alter table credit_transactions add constraint credit_transactions_reason_check
  check (reason in ('purchase', 'unlock_spend', 'admin_adjustment', 'refund', 'signup_bonus', 'boost_purchase', 'manual_purchase'));

-- Rucne uplate na racun -- privremeno resenje dok se Stripe pregled ne
-- zavrsi (nalog trenutno ne moze da naplacuje uzivo). Korisnik vidi
-- bankovne podatke + jedinstvenu sifru za uplatu, admin RUCNO potvrdjuje
-- da je novac stvarno stigao na racun pre nego sto odobri (odobravanje
-- NIJE automatsko na osnovu ovog zahteva -- to bi bilo lazno predstavljanje
-- da je placeno kad nije).
create table manual_payment_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('premium', 'credits', 'boost')),
  package_id uuid references credit_packages(id),
  amount_label text not null,
  reference_code text not null unique,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references profiles(id)
);

create index manual_payment_requests_status_idx on manual_payment_requests (status, created_at desc);

alter table manual_payment_requests enable row level security;

create policy "korisnik pravi svoj zahtev"
  on manual_payment_requests for insert
  with check (auth.uid() = profile_id);

create policy "korisnik vidi svoje zahteve"
  on manual_payment_requests for select
  using (auth.uid() = profile_id);

create policy "admin upravlja svim zahtevima"
  on manual_payment_requests for all using (is_admin()) with check (is_admin());

-- Bankovni podaci za uplatu -- admin popunjava STVARNE podatke na
-- /admin/pocetna (site_content sistem, vec postoji), ovde su samo
-- placeholderi dok ih ne popuni.
insert into site_content (key, value) values
  ('bank_transfer_account_name', 'Popuni u adminu'),
  ('bank_transfer_account_number', 'Popuni u adminu'),
  ('bank_transfer_bank_name', 'Popuni u adminu'),
  ('bank_transfer_note', 'Uplata se obično potvrđuje u roku od 1 radnog dana.'),
  ('manual_premium_amount_label', 'Popuni u adminu (npr. 1500 RSD / mesečno)')
on conflict (key) do nothing;
