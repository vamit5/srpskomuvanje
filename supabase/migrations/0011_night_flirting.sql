-- "Noćno muvanje" -- provokativan, plaćen unlock sistem za fotografije/video
-- u chatu. Pokreni u Supabase SQL Editoru NAKON što napraviš Storage bucket
-- "night-flirting" (Storage tab, ime tačno ovako, Public = OFF).

-- ---------------------------------------------------------------------
-- KONFIGURACIJA -- admin menja cenu/pragove BEZ izmene koda (traženo u
-- specifikaciji). Sve vrednosti su text (parsiraju se u kodu) da bi jedna
-- tabela mogla da nosi brojeve i procente bez šeme po ključu.
-- ---------------------------------------------------------------------
create table night_flirting_config (
  key text primary key,
  value text not null,
  description text,
  updated_at timestamptz not null default now()
);

insert into night_flirting_config (key, value, description) values
  ('unlock_cost_credits', '1', 'Koliko Iskrica košta otključavanje jednog zaključanog sadržaja'),
  ('daily_send_limit_free', '3', 'Koliko Noćno muvanje slanja dnevno sme besplatan nalog'),
  ('daily_send_limit_premium', '20', 'Koliko Noćno muvanje slanja dnevno sme Premium nalog'),
  ('yellow_score_threshold', '0.15', 'Prag (0-1) za nudity/erotica skor iznad kog se sadržaj zaključava (žuto)'),
  ('red_score_threshold', '0.5', 'Prag (0-1) za sexual_activity skor iznad kog ide na ručni pregled (crveno)');

create trigger night_flirting_config_set_updated_at before update on night_flirting_config
  for each row execute function set_updated_at();

alter table night_flirting_config enable row level security;

create policy "svako ulogovan cita konfiguraciju"
  on night_flirting_config for select using (auth.uid() is not null);

create policy "samo admin menja konfiguraciju"
  on night_flirting_config for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------
-- KREDITI ("Iskrice") -- kupuju se u paketima (jedna normalna Stripe
-- transakcija), troše se interno po otključavanju. Izbegava Stripe-ov
-- minimalni iznos naplate (~€0.50) i fiksnu proviziju koja bi pojela
-- doslovno €0.39 po transakciji.
-- ---------------------------------------------------------------------
create table wallets (
  profile_id uuid primary key references profiles(id) on delete cascade,
  balance_credits int not null default 0 check (balance_credits >= 0),
  updated_at timestamptz not null default now()
);

create trigger wallets_set_updated_at before update on wallets
  for each row execute function set_updated_at();

alter table wallets enable row level security;

create policy "korisnik vidi svoj novcanik"
  on wallets for select using (auth.uid() = profile_id);

create policy "admin upravlja novcanicima"
  on wallets for all using (is_admin()) with check (is_admin());

create table credit_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  credits int not null check (credits > 0),
  price_cents int not null check (price_cents > 0),
  currency text not null default 'eur',
  is_active boolean not null default true,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);

insert into credit_packages (name, credits, price_cents, position) values
  ('5 Iskrica', 5, 249, 0),
  ('10 Iskrica', 10, 399, 1),
  ('25 Iskrica', 25, 799, 2);

alter table credit_packages enable row level security;

create policy "svako ulogovan vidi aktivne pakete"
  on credit_packages for select using (auth.uid() is not null and is_active = true);

create policy "admin upravlja paketima"
  on credit_packages for all using (is_admin()) with check (is_admin());

create table credit_transactions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  amount int not null, -- + kupovina/admin dodela, - trošenje na otključavanje
  reason text not null check (reason in ('purchase', 'unlock_spend', 'admin_adjustment', 'refund')),
  related_content_id uuid, -- fk se dodaje ispod (night_flirting_content još ne postoji)
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  created_at timestamptz not null default now()
);

create index credit_transactions_profile_idx on credit_transactions (profile_id, created_at desc);

alter table credit_transactions enable row level security;

create policy "korisnik vidi svoje transakcije"
  on credit_transactions for select using (auth.uid() = profile_id);

create policy "admin vidi i upisuje sve transakcije"
  on credit_transactions for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------
-- SADRŽAJ -- svaka poslata Noćno muvanje fotografija/video.
-- ---------------------------------------------------------------------
create table night_flirting_content (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  receiver_id uuid not null references profiles(id),
  kind text not null check (kind in ('photo', 'video')),
  original_path text not null, -- putanja u PRIVATNOM "night-flirting" bucket-u
  preview_path text not null, -- zamućen preview, isti bucket, uvek vidljiv primaocu
  duration_seconds smallint,
  classifier_score numeric,
  classification text not null check (classification in ('green', 'yellow', 'red')),
  -- 'auto' = automatska odluka važi; ostalo su admin override-i koji imaju
  -- prioritet nad automatskom klasifikacijom (traženo u specifikaciji).
  moderation_status text not null default 'auto'
    check (moderation_status in ('auto', 'pending_review', 'admin_locked', 'admin_unlocked', 'admin_marked_safe', 'rejected')),
  is_free boolean not null default false, -- true za 'green' (auto) ili 'admin_marked_safe'/'admin_unlocked'
  admin_note text,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table credit_transactions add constraint credit_transactions_content_fk
  foreign key (related_content_id) references night_flirting_content(id);

create index night_flirting_content_receiver_idx on night_flirting_content (receiver_id, created_at desc);
create index night_flirting_content_sender_idx on night_flirting_content (sender_id, created_at desc);
create index night_flirting_content_review_idx on night_flirting_content (moderation_status) where moderation_status = 'pending_review';

alter table night_flirting_content enable row level security;

create policy "posiljalac i primalac vide svoj sadrzaj"
  on night_flirting_content for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id or is_admin());

create policy "admin upravlja sadrzajem (moderacija)"
  on night_flirting_content for update using (is_admin());

create policy "admin brise sadrzaj"
  on night_flirting_content for delete using (is_admin());

-- ---------------------------------------------------------------------
-- OTKLJUČAVANJA -- ko je platio/dobio pristup originalu.
-- ---------------------------------------------------------------------
create table night_flirting_unlocks (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references night_flirting_content(id) on delete cascade,
  unlocker_id uuid not null references profiles(id),
  credits_spent int not null default 0,
  source text not null default 'credits' check (source in ('credits', 'premium', 'admin_free')),
  created_at timestamptz not null default now(),
  unique (content_id, unlocker_id)
);

create index night_flirting_unlocks_content_idx on night_flirting_unlocks (content_id);

alter table night_flirting_unlocks enable row level security;

create policy "ucesnici vide otkljucavanja svog sadrzaja"
  on night_flirting_unlocks for select
  using (
    auth.uid() = unlocker_id
    or is_admin()
    or exists (select 1 from night_flirting_content c where c.id = content_id and c.sender_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- Poveži chat poruke sa Noćno muvanje sadržajem. "messages" tabela je od
-- FAZE 1 imala image_url kolonu pripremljenu ali nikad korišćenu -- chat
-- je do sada bio isključivo tekstualan.
-- ---------------------------------------------------------------------
alter table messages add column night_content_id uuid references night_flirting_content(id);

-- Stari check constraint (content is not null or image_url is not null)
-- nema fiksno ime u našem kodu (Postgres ga je auto-generisao) -- nalazimo
-- ga po definiciji umesto da nagađamo ime, pa ga zamenjujemo širom verzijom.
do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'messages'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%content is not null%image_url is not null%';
  if con_name is not null then
    execute format('alter table messages drop constraint %I', con_name);
  end if;
end $$;

alter table messages add constraint messages_content_check
  check (content is not null or image_url is not null or night_content_id is not null);

-- ---------------------------------------------------------------------
-- SQL FUNKCIJE (SECURITY DEFINER -- atomske operacije, isti obrazac kao
-- like_profile/send_secret_spark).
-- ---------------------------------------------------------------------

-- Šalje Noćno muvanje sadržaj: pravi content red + poruku u chatu atomski,
-- uz proveru dnevnog limita i da match/blok ne sprečavaju slanje.
-- Klasifikacija (Sightengine poziv) se radi PRE ovoga u TS kodu -- ova
-- funkcija samo upisuje već izračunatu odluku.
create or replace function send_night_flirting_content(
  p_sender_id uuid,
  p_match_id uuid,
  p_kind text,
  p_original_path text,
  p_preview_path text,
  p_duration_seconds int,
  p_classification text,
  p_classifier_score numeric,
  p_moderation_status text,
  p_daily_limit int
)
returns table (content_id uuid, message_id uuid, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receiver_id uuid;
  v_profile_a uuid;
  v_profile_b uuid;
  v_sent_today int;
  v_content_id uuid;
  v_message_id uuid;
  v_is_free boolean;
begin
  if auth.uid() is distinct from p_sender_id then
    return query select null::uuid, null::uuid, 'Nije dozvoljeno.'; return;
  end if;

  select profile_a_id, profile_b_id into v_profile_a, v_profile_b
  from matches where id = p_match_id and unmatched_at is null;

  if v_profile_a is null then
    return query select null::uuid, null::uuid, 'Ovaj razgovor više nije aktivan.'; return;
  end if;
  if p_sender_id <> v_profile_a and p_sender_id <> v_profile_b then
    return query select null::uuid, null::uuid, 'Nemaš pristup ovom razgovoru.'; return;
  end if;
  v_receiver_id := case when v_profile_a = p_sender_id then v_profile_b else v_profile_a end;

  if exists (
    select 1 from blocks b
    where (b.blocker_id = p_sender_id and b.blocked_id = v_receiver_id)
       or (b.blocker_id = v_receiver_id and b.blocked_id = p_sender_id)
  ) then
    return query select null::uuid, null::uuid, 'Ne možeš slati ovoj osobi.'; return;
  end if;

  select count(*) into v_sent_today
  from night_flirting_content
  where sender_id = p_sender_id and created_at >= date_trunc('day', now());

  if v_sent_today >= p_daily_limit then
    return query select null::uuid, null::uuid, 'Iskoristio/la si dnevni limit Noćnog muvanja.'; return;
  end if;

  v_is_free := p_classification = 'green';

  insert into night_flirting_content (
    match_id, sender_id, receiver_id, kind, original_path, preview_path,
    duration_seconds, classifier_score, classification, moderation_status, is_free
  ) values (
    p_match_id, p_sender_id, v_receiver_id, p_kind, p_original_path, p_preview_path,
    p_duration_seconds, p_classifier_score, p_classification, p_moderation_status, v_is_free
  ) returning id into v_content_id;

  insert into messages (match_id, sender_id, night_content_id)
  values (p_match_id, p_sender_id, v_content_id)
  returning id into v_message_id;

  return query select v_content_id, v_message_id, null::text;
end;
$$;

grant execute on function send_night_flirting_content(uuid, uuid, text, text, text, int, text, numeric, text, int) to authenticated;

-- Otključavanje: Premium prolazi besplatno, ostali plaćaju iz novčanika.
-- Sve atomski -- nema šanse da klijent "kaže" da je platio bez da stvarno
-- jeste (frontend success nikad nije dovoljan, traženo u specifikaciji).
create or replace function unlock_night_content(p_viewer_id uuid, p_content_id uuid)
returns table (ok boolean, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_content night_flirting_content%rowtype;
  v_is_premium boolean;
  v_cost int;
  v_balance int;
begin
  if auth.uid() is distinct from p_viewer_id then
    return query select false, 'Nije dozvoljeno.'; return;
  end if;

  select * into v_content from night_flirting_content where id = p_content_id;
  if v_content.id is null then
    return query select false, 'Sadržaj nije pronađen.'; return;
  end if;
  if v_content.receiver_id <> p_viewer_id then
    return query select false, 'Nemaš pristup ovom sadržaju.'; return;
  end if;
  if v_content.moderation_status in ('rejected', 'pending_review') then
    return query select false, 'Ovaj sadržaj još nije dostupan.'; return;
  end if;

  if exists (select 1 from night_flirting_unlocks where content_id = p_content_id and unlocker_id = p_viewer_id) then
    return query select true, null::text; return; -- već otključano, idempotentno
  end if;

  select exists(
    select 1 from subscriptions
    where profile_id = p_viewer_id and status = 'active'
      and (current_period_end is null or current_period_end > now())
  ) into v_is_premium;

  if v_is_premium then
    insert into night_flirting_unlocks (content_id, unlocker_id, credits_spent, source)
    values (p_content_id, p_viewer_id, 0, 'premium');
    return query select true, null::text; return;
  end if;

  select coalesce(value::int, 1) into v_cost from night_flirting_config where key = 'unlock_cost_credits';
  select balance_credits into v_balance from wallets where profile_id = p_viewer_id;

  if coalesce(v_balance, 0) < v_cost then
    return query select false, 'Nemaš dovoljno Iskrica.'; return;
  end if;

  update wallets set balance_credits = balance_credits - v_cost where profile_id = p_viewer_id;
  insert into credit_transactions (profile_id, amount, reason, related_content_id)
    values (p_viewer_id, -v_cost, 'unlock_spend', p_content_id);
  insert into night_flirting_unlocks (content_id, unlocker_id, credits_spent, source)
    values (p_content_id, p_viewer_id, v_cost, 'credits');

  return query select true, null::text;
end;
$$;

grant execute on function unlock_night_content(uuid, uuid) to authenticated;

-- Dodaje kredite (kupovina) -- poziva SAMO webhook preko admin (service
-- role) klijenta, nikad direktno korisnik. Zato NEMA "grant to authenticated"
-- -- eksplicitno uklanjamo podrazumevanu PUBLIC dozvolu da niko sa običnim
-- nalogom ne može sebi da dodeli besplatne Iskrice pozivanjem funkcije.
create or replace function credit_wallet(
  p_profile_id uuid,
  p_amount int,
  p_reason text,
  p_stripe_payment_intent_id text default null,
  p_stripe_checkout_session_id text default null
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

  insert into credit_transactions (profile_id, amount, reason, stripe_payment_intent_id, stripe_checkout_session_id)
  values (p_profile_id, p_amount, p_reason, p_stripe_payment_intent_id, p_stripe_checkout_session_id);
end;
$$;

revoke execute on function credit_wallet(uuid, int, text, text, text) from public;
grant execute on function credit_wallet(uuid, int, text, text, text) to service_role;

-- Admin override -- ima prioritet nad automatskom klasifikacijom (traženo
-- u specifikaciji). LOCK/UNLOCK/MARK SAFE se rade odavde (DELETE je
-- posebna operacija u TS kodu, jer mora da obriše i Storage fajlove).
--   'admin_locked'      -- prisilno zaključaj (i da je automatski bilo 'green')
--   'admin_unlocked'    -- prisilno besplatno za primaoca (npr. podrška slučaj)
--   'admin_marked_safe' -- skida sa ručnog pregleda, vraća na normalan tok
--                           po ORIGINALNOJ klasifikaciji (is_free se ne dira)
create or replace function admin_review_night_content(p_content_id uuid, p_decision text, p_note text default null)
returns table (ok boolean, error text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    return query select false, 'Nemaš admin pristup.'; return;
  end if;
  if p_decision not in ('admin_locked', 'admin_unlocked', 'admin_marked_safe') then
    return query select false, 'Nevažeća odluka.'; return;
  end if;

  update night_flirting_content
  set moderation_status = p_decision,
      is_free = case
        when p_decision = 'admin_unlocked' then true
        when p_decision = 'admin_locked' then false
        else is_free
      end,
      admin_note = p_note,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_content_id;

  return query select true, null::text;
end;
$$;

grant execute on function admin_review_night_content(uuid, text, text) to authenticated;
