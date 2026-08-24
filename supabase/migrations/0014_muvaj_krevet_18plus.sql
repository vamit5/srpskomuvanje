-- MUVAJ 3-izbora (Upoznavanje / Krevet / Ništa) + "18+ Muvanje" (zamena za
-- Tajnu sobu) + nestajuće plaćene slike + plaćeni Boost. Sve idempotentno
-- (create table/index/policy if not exists / drop+create) -- vidi
-- migraciju 0013 za isti obrazac i objasnjenje zasto je to neophodno.
--
-- Ne diramo Tajnu sobu tabele (secret_room_*) -- ostaju u bazi neiskoriscene,
-- bezbednije nego brisanje. Nav/kod jednostavno prestaju da ih koriste.

-- ---------------------------------------------------------------------
-- KONFIGURACIJA
-- ---------------------------------------------------------------------

create table if not exists muvaj_config (
  key text primary key,
  value text not null,
  description text,
  updated_at timestamptz not null default now()
);

drop trigger if exists muvaj_config_set_updated_at on muvaj_config;
create trigger muvaj_config_set_updated_at before update on muvaj_config
  for each row execute function set_updated_at();

insert into muvaj_config (key, value, description) values
  ('krevet_reveal_cost_credits', '1', 'Koliko Credits-a kosta otkljucavanje "neko hoce s tobom u krevet" (kada nije Premium)'),
  ('candidates_per_batch', '15', 'Broj kandidata po ucitavanju u 18+ Muvanje'),
  ('media_expiry_minutes', '5', 'Koliko minuta placeni sadrzaj (foto/video) ostaje dostupan pre nego sto se trajno obrise ako niko ne otkljuca'),
  ('boost_price_cents', '299', 'Cena 60-minutnog Boost-a u centima'),
  ('boost_currency', 'eur', 'Valuta za Boost placanje'),
  ('boost_duration_minutes', '60', 'Koliko traje Boost')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- KREVET SIGNALI -- "krevet" izbor u Muvaj salje SLEP (identitet skriven)
-- notifikaciju primaocu, isti princip kao Tajna soba RIZIKUJ (migracija
-- 0013): primalac mora da plati (ili je Premium) da otkrije KO je poslao.
-- Match NASTAJE odvojeno -- cim primalac i sam, bilo kada, u svom Muvaj
-- feed-u, izabere "upoznavanje" ili "krevet" prema posiljaocu (videti
-- muvaj_choose ispod) -- placanje ovde je samo za brzo zadovoljenje
-- radoznalosti, nije jedini put do match-a.
-- ---------------------------------------------------------------------

create table if not exists krevet_signals (
  id uuid primary key default gen_random_uuid(),
  from_profile_id uuid not null references profiles(id) on delete cascade,
  to_profile_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'revealed')),
  revealed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (from_profile_id, to_profile_id),
  check (from_profile_id <> to_profile_id)
);

create index if not exists krevet_signals_to_idx on krevet_signals (to_profile_id, status);
create index if not exists krevet_signals_from_idx on krevet_signals (from_profile_id);

alter table krevet_signals enable row level security;

drop policy if exists "ucesnici vide svoj signal" on krevet_signals;
create policy "ucesnici vide svoj signal"
  on krevet_signals for select using (auth.uid() = from_profile_id or auth.uid() = to_profile_id);

drop policy if exists "admin vidi sve krevet signale" on krevet_signals;
create policy "admin vidi sve krevet signale"
  on krevet_signals for select using (is_admin());

-- Isti princip kao secret_room_requests (migracija 0013): primalac ne sme
-- da vidi from_profile_id dok ne plati/otkljuca -- kolonski restriktovano.
revoke select on krevet_signals from authenticated;
grant select (id, to_profile_id, status, revealed_at, created_at) on krevet_signals to authenticated;

-- ---------------------------------------------------------------------
-- BOOST (60 min placena vidljivost) -- prost pristup, jedan aktivan
-- Boost po korisniku (isti obrazac kao hot_mode_expires_at).
-- ---------------------------------------------------------------------

alter table profiles add column if not exists boost_expires_at timestamptz;
create index if not exists profiles_boost_idx on profiles (boost_expires_at) where boost_expires_at is not null;

-- Boost kupovina se evidentira kao credit_transactions red sa amount=0
-- (samo za idempotenciju/istoriju u Stripe webhook-u -- ne dira Credits
-- stanje) -- zato dodajemo 'boost_purchase' u dozvoljene razloge.
alter table credit_transactions drop constraint if exists credit_transactions_reason_check;
alter table credit_transactions add constraint credit_transactions_reason_check
  check (reason in ('purchase', 'unlock_spend', 'admin_adjustment', 'refund', 'boost_purchase'));

-- ---------------------------------------------------------------------
-- NESTAJUCE PLACENE SLIKE -- rok posle kog se original TRAJNO brise (API
-- cron ruta cita ove kolone i zove Storage.remove -- SQL sam ne moze da
-- brise fajlove, samo evidenciju).
-- ---------------------------------------------------------------------

alter table night_flirting_content add column if not exists expires_at timestamptz;
alter table night_flirting_content add column if not exists media_deleted_at timestamptz;
create index if not exists night_flirting_content_expiry_idx
  on night_flirting_content (expires_at) where media_deleted_at is null and expires_at is not null;

-- ---------------------------------------------------------------------
-- muvaj_choose -- "Upoznavanje" / "Krevet" / "Ništa" na jednu profilnu
-- sliku. Match nastaje cim POSTOJI obostrano pozitivan izbor (bilo koja
-- kombinacija upoznavanje/krevet), u bilo kom smeru/redosledu.
-- ---------------------------------------------------------------------

create or replace function muvaj_choose(viewer_id uuid, target_id uuid, choice text)
returns table (matched boolean, match_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reciprocal boolean;
  v_a uuid;
  v_b uuid;
  v_match_id uuid;
  v_my_name text;
  v_their_name text;
begin
  if auth.uid() is distinct from viewer_id then
    raise exception 'Nije dozvoljeno.';
  end if;
  if viewer_id = target_id then
    raise exception 'Ne mozes birati sebe.';
  end if;
  if choice not in ('upoznavanje', 'krevet', 'nista') then
    raise exception 'Nepoznat izbor.';
  end if;

  if choice = 'nista' then
    insert into passes (from_profile_id, to_profile_id) values (viewer_id, target_id)
    on conflict (from_profile_id, to_profile_id) do nothing;
    return query select false, null::uuid;
    return;
  end if;

  if choice = 'upoznavanje' then
    insert into likes (from_profile_id, to_profile_id) values (viewer_id, target_id)
    on conflict (from_profile_id, to_profile_id) do nothing;
  else -- 'krevet'
    insert into krevet_signals (from_profile_id, to_profile_id) values (viewer_id, target_id)
    on conflict (from_profile_id, to_profile_id) do nothing;

    select name into v_my_name from profiles where id = viewer_id;
    insert into notifications (profile_id, type, title, body, data)
      values (
        target_id, 'krevet_signal', '😈 Neko hoće s tobom u krevet',
        'Otključaj da vidiš ko je to.', jsonb_build_object('fromHidden', true)
      );
  end if;

  -- Obostrano pozitivan izbor u BILO KOJOJ kombinaciji (likes UNION
  -- krevet_signals, oba smera) -- vidi komentar iznad funkcije.
  select exists(
    select 1 from likes where from_profile_id = target_id and to_profile_id = viewer_id
    union
    select 1 from krevet_signals where from_profile_id = target_id and to_profile_id = viewer_id
  ) into v_reciprocal;

  if not v_reciprocal then
    return query select false, null::uuid;
    return;
  end if;

  v_a := least(viewer_id, target_id);
  v_b := greatest(viewer_id, target_id);

  insert into matches (profile_a_id, profile_b_id, source)
  values (v_a, v_b, 'like')
  on conflict (profile_a_id, profile_b_id) do nothing;

  select id into v_match_id from matches where profile_a_id = v_a and profile_b_id = v_b;

  select name into v_my_name from profiles where id = viewer_id;
  select name into v_their_name from profiles where id = target_id;

  insert into notifications (profile_id, type, title, body, data)
  values
    (viewer_id, 'match', '🔥 MATCH!', 'Ti i ' || coalesce(v_their_name, 'neko') || ' ste se svideli jedno drugom.', jsonb_build_object('matchId', v_match_id, 'otherId', target_id)),
    (target_id, 'match', '🔥 MATCH!', 'Ti i ' || coalesce(v_my_name, 'neko') || ' ste se svideli jedno drugom.', jsonb_build_object('matchId', v_match_id, 'otherId', viewer_id));

  return query select true, v_match_id;
end;
$$;

grant execute on function muvaj_choose(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- get_muvaj_pending_krevet_count -- za bedz na nav ikonici (bez otkrivanja
-- identiteta).
-- ---------------------------------------------------------------------

create or replace function get_muvaj_pending_krevet_count(viewer_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from krevet_signals
  where to_profile_id = viewer_id and status = 'pending' and auth.uid() = viewer_id;
$$;

grant execute on function get_muvaj_pending_krevet_count(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- get_muvaj_pending_krevet_list -- lista (bez identiteta) za "18+ Muvanje"
-- ekran gde korisnik bira koji "misteriozni" signal da otkljuca.
-- ---------------------------------------------------------------------

-- Menjamo RETURNS TABLE kolone (dodajemo from_photo_url) -- Postgres NE
-- dozvoljava "create or replace" kad se menja OUT-parametar lista, mora
-- eksplicitan drop prvo (isti gotcha kao promena parametara, samo za
-- povratni tip -- vidi migraciju 0012 za prvi primer u ovom projektu).
drop function if exists get_muvaj_pending_krevet_list(uuid);

create or replace function get_muvaj_pending_krevet_list(viewer_id uuid)
returns table (signal_id uuid, created_at timestamptz, from_photo_url text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from viewer_id then
    raise exception 'Nije dozvoljeno.';
  end if;

  -- NAPOMENA: from_photo_url OVDE nije "otkrivanje identiteta" -- to je
  -- obicna profilna slika (vec javno vidljiva svima drugde u appu, npr.
  -- u "Pozovi nekoga u krevet" gridu ispod), samo obicnim CSS blur-om
  -- zamagljena na klijentu dok se veza SLIKA<->OVAJ KONKRETAN SIGNAL ne
  -- otkljuca -- isti bezbednosni nivo kao "Ko te zeli" tizer (vidi
  -- UnlockCard/LikerLockedCard komentare). Ime/godine/grad OSTAJU skriveni.
  return query
  select k.id, k.created_at,
    (select pp.url from profile_photos pp where pp.profile_id = k.from_profile_id and pp.is_primary = true and pp.moderation_status = 'approved' limit 1)
  from krevet_signals k
  where k.to_profile_id = viewer_id and k.status = 'pending'
  order by k.created_at desc;
end;
$$;

grant execute on function get_muvaj_pending_krevet_list(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- muvaj_reveal_krevet -- placeno otkljucavanje "ko je to" (osim Premium).
-- Isti obrazac kao unlock_night_content / secret_room_respond_request.
-- NAPOMENA: ovo NE pravi match samo po sebi -- match nastaje iskljucivo
-- kroz muvaj_choose (obostrano pozitivan izbor), namerno odvojeno.
-- ---------------------------------------------------------------------

create or replace function muvaj_reveal_krevet(viewer_id uuid, p_signal_id uuid)
returns table (ok boolean, error text, from_id uuid, from_name text, from_birth_date date, from_city text, from_photo_url text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sig krevet_signals%rowtype;
  v_is_premium boolean;
  v_cost int;
  v_balance int;
begin
  if auth.uid() is distinct from viewer_id then
    return query select false, 'Nije dozvoljeno.'::text, null::uuid, null::text, null::date, null::text, null::text; return;
  end if;

  select * into v_sig from krevet_signals where id = p_signal_id;
  if v_sig.id is null or v_sig.to_profile_id <> viewer_id then
    return query select false, 'Signal ne postoji.'::text, null::uuid, null::text, null::date, null::text, null::text; return;
  end if;

  if v_sig.status = 'revealed' then
    -- vec otkljucano ranije -- idempotentno, samo vrati podatke ponovo
    return query
    select true, null::text, p.id, p.name, p.birth_date, p.city,
      (select pp.url from profile_photos pp where pp.profile_id = p.id and pp.is_primary = true and pp.moderation_status = 'approved' limit 1)
    from profiles p where p.id = v_sig.from_profile_id;
    return;
  end if;

  select exists(
    select 1 from subscriptions
    where profile_id = viewer_id and status = 'active'
      and (current_period_end is null or current_period_end > now())
  ) into v_is_premium;

  if not v_is_premium then
    select coalesce(value::int, 1) into v_cost from muvaj_config where key = 'krevet_reveal_cost_credits';
    select balance_credits into v_balance from wallets where profile_id = viewer_id;
    if coalesce(v_balance, 0) < v_cost then
      return query select false, 'insufficient_credits'::text, null::uuid, null::text, null::date, null::text, null::text; return;
    end if;
    update wallets set balance_credits = balance_credits - v_cost where profile_id = viewer_id;
    insert into credit_transactions (profile_id, amount, reason)
      values (viewer_id, -v_cost, 'unlock_spend');
  end if;

  update krevet_signals set status = 'revealed', revealed_at = now() where id = p_signal_id;

  return query
  select true, null::text, p.id, p.name, p.birth_date, p.city,
    (select pp.url from profile_photos pp where pp.profile_id = p.id and pp.is_primary = true and pp.moderation_status = 'approved' limit 1)
  from profiles p where p.id = v_sig.from_profile_id;
end;
$$;

grant execute on function muvaj_reveal_krevet(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- get_18plus_candidates -- isti scoring kao discover_profiles, ali
-- filtrirano SAMO na korisnike koji su BAR JEDNOM izabrali "krevet" u
-- Muvaj (poslali krevet_signals kao posiljalac) -- tacno kako je trazeno.
-- Boost (profiles.boost_expires_at aktivan) dobija veliki bonus poena.
-- ---------------------------------------------------------------------

create or replace function get_18plus_candidates(viewer_id uuid, result_limit int default 15)
returns table (
  id uuid, name text, birth_date date, city text, bio text,
  primary_photo_url text, is_boosted boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gender text;
  v_interests text[];
  v_lat double precision;
  v_lng double precision;
  v_interested_in text[];
  v_age_min smallint;
  v_age_max smallint;
begin
  if auth.uid() is distinct from viewer_id then
    raise exception 'Nije dozvoljeno.';
  end if;

  select profiles.gender, profiles.interests, profiles.lat, profiles.lng
    into v_gender, v_interests, v_lat, v_lng
  from profiles where profiles.id = viewer_id;

  select interested_in, age_min, age_max
    into v_interested_in, v_age_min, v_age_max
  from preferences where profile_id = viewer_id;

  return query
  select p.id, p.name, p.birth_date, p.city, p.bio,
    (select pp.url from profile_photos pp where pp.profile_id = p.id and pp.is_primary = true and pp.moderation_status = 'approved' limit 1),
    (p.boost_expires_at is not null and p.boost_expires_at > now())
  from profiles p
  join preferences pref on pref.profile_id = p.id
  where p.id <> viewer_id
    and p.deleted_at is null
    and p.is_discoverable = true
    and p.gender = any(coalesce(v_interested_in, array[]::text[]))
    and v_gender = any(coalesce(pref.interested_in, array[]::text[]))
    and date_part('year', age(p.birth_date)) between coalesce(v_age_min, 18) and coalesce(v_age_max, 99)
    and exists (select 1 from krevet_signals ks where ks.from_profile_id = p.id)
    and not exists (
      select 1 from blocks b
      where (b.blocker_id = viewer_id and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = viewer_id)
    )
    and not exists (select 1 from passes ps where ps.from_profile_id = viewer_id and ps.to_profile_id = p.id)
    and not exists (select 1 from likes l where l.from_profile_id = viewer_id and l.to_profile_id = p.id)
    and not exists (select 1 from krevet_signals ks2 where ks2.from_profile_id = viewer_id and ks2.to_profile_id = p.id)
  order by
    (p.boost_expires_at is not null and p.boost_expires_at > now()) desc,
    (
      case when coalesce(array_length(v_interests, 1), 0) = 0 or coalesce(array_length(p.interests, 1), 0) = 0 then 30
      else (select count(*) from unnest(p.interests) i where i = any(v_interests))::numeric
           / greatest(array_length(v_interests, 1), 1) * 100
      end
      + coalesce(p.profile_completion_score, 0)
      + greatest(0, 7 - extract(day from (now() - p.last_active_at))) / 7 * 100
      + (
          case
            when v_lat is null or v_lng is null or p.lat is null or p.lng is null then 50
            else greatest(0, 100 - distance_km(v_lat, v_lng, p.lat, p.lng))
          end
        )
    ) desc
  limit result_limit;
end;
$$;

grant execute on function get_18plus_candidates(uuid, int) to authenticated;

-- ---------------------------------------------------------------------
-- send_night_flirting_content -- azurirano (parametri NEPROMENJENI, samo
-- telo -- "create or replace" je bezbedno bez drop-a, isto kao svugde
-- gde se menja SAMO telo funkcije) da postavi expires_at za PLACENI
-- (ne-green) sadrzaj -- disappearing-media zahtev. Green (besplatan)
-- sadrzaj nema rok, vec je odmah vidljiv.
-- ---------------------------------------------------------------------

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
  v_expiry_minutes int;
  v_expires_at timestamptz;
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

  if not v_is_free then
    select coalesce(value::int, 5) into v_expiry_minutes from muvaj_config where key = 'media_expiry_minutes';
    v_expires_at := now() + make_interval(mins => v_expiry_minutes);
  end if;

  insert into night_flirting_content (
    match_id, sender_id, receiver_id, kind, original_path, preview_path,
    duration_seconds, classifier_score, classification, moderation_status, is_free, expires_at
  ) values (
    p_match_id, p_sender_id, v_receiver_id, p_kind, p_original_path, p_preview_path,
    p_duration_seconds, p_classifier_score, p_classification, p_moderation_status, v_is_free, v_expires_at
  ) returning id into v_content_id;

  insert into messages (match_id, sender_id, night_content_id)
  values (p_match_id, p_sender_id, v_content_id)
  returning id into v_message_id;

  return query select v_content_id, v_message_id, null::text;
end;
$$;

grant execute on function send_night_flirting_content(uuid, uuid, text, text, text, int, text, numeric, text, int) to authenticated;

-- ---------------------------------------------------------------------
-- unlock_night_content -- azurirano da odbije otkljucavanje ako je rok
-- (expires_at) vec prosao -- cak i za Premium (nema smisla "otkljucati"
-- nesto sto je vec obrisano ili ce svaki cas biti). Parametri nepromenjeni.
-- ---------------------------------------------------------------------

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
  if v_content.media_deleted_at is not null or (v_content.expires_at is not null and v_content.expires_at < now()) then
    return query select false, 'Sadržaj je istekao i više ne postoji.'; return;
  end if;

  if exists (select 1 from night_flirting_unlocks where content_id = p_content_id and unlocker_id = p_viewer_id) then
    return query select true, null::text; return;
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

-- ---------------------------------------------------------------------
-- PROFILE UNLOCKS -- korisnik NIKAD ne sme videti kompletan tudji profil
-- (bio, interesovanja, hrana, dodatne slike/video) bez Premium-a ili
-- placanja Credits-a. Primarna slika + ime/godine/grad ostaju besplatni
-- (to se vec vidi tokom Muvaj swipe-a, ne bi imalo smisla ponovo
-- sakrivati) -- sve OSTALO se NE SALJE klijentu dok nije otkljucano
-- (server-side, ne CSS-blur trik -- "da ne dodje do varanja").
-- ---------------------------------------------------------------------

create table if not exists profile_unlocks (
  id uuid primary key default gen_random_uuid(),
  viewer_id uuid not null references profiles(id) on delete cascade,
  target_id uuid not null references profiles(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  unique (viewer_id, target_id),
  check (viewer_id <> target_id)
);

create index if not exists profile_unlocks_viewer_idx on profile_unlocks (viewer_id);

alter table profile_unlocks enable row level security;

drop policy if exists "korisnik vidi svoja otkljucavanja" on profile_unlocks;
create policy "korisnik vidi svoja otkljucavanja"
  on profile_unlocks for select using (auth.uid() = viewer_id);

drop policy if exists "admin vidi sva otkljucavanja profila" on profile_unlocks;
create policy "admin vidi sva otkljucavanja profila"
  on profile_unlocks for select using (is_admin());

insert into muvaj_config (key, value, description) values
  ('profile_unlock_cost_credits', '1', 'Koliko Credits-a kosta otkljucavanje kompletnog profila (bio, interesovanja, dodatne slike) kada nije Premium')
on conflict (key) do nothing;

create or replace function unlock_profile_view(p_viewer_id uuid, p_target_id uuid)
returns table (ok boolean, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_premium boolean;
  v_cost int;
  v_balance int;
begin
  if auth.uid() is distinct from p_viewer_id then
    return query select false, 'Nije dozvoljeno.'; return;
  end if;
  if p_viewer_id = p_target_id then
    return query select true, null::text; return;
  end if;

  if exists (select 1 from profile_unlocks where viewer_id = p_viewer_id and target_id = p_target_id) then
    return query select true, null::text; return;
  end if;

  select exists(
    select 1 from subscriptions
    where profile_id = p_viewer_id and status = 'active'
      and (current_period_end is null or current_period_end > now())
  ) into v_is_premium;

  if v_is_premium then
    insert into profile_unlocks (viewer_id, target_id) values (p_viewer_id, p_target_id)
    on conflict (viewer_id, target_id) do nothing;
    return query select true, null::text; return;
  end if;

  select coalesce(value::int, 1) into v_cost from muvaj_config where key = 'profile_unlock_cost_credits';
  select balance_credits into v_balance from wallets where profile_id = p_viewer_id;

  if coalesce(v_balance, 0) < v_cost then
    return query select false, 'insufficient_credits'; return;
  end if;

  update wallets set balance_credits = balance_credits - v_cost where profile_id = p_viewer_id;
  insert into credit_transactions (profile_id, amount, reason)
    values (p_viewer_id, -v_cost, 'unlock_spend');
  insert into profile_unlocks (viewer_id, target_id) values (p_viewer_id, p_target_id)
    on conflict (viewer_id, target_id) do nothing;

  return query select true, null::text;
end;
$$;

grant execute on function unlock_profile_view(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 18+ DIREKTAN CHAT -- klik na nekoga u "Pozovi nekoga u krevet" odmah
-- otvara privatan chat (BEZ cekanja na obostrani match) -- ponovo
-- koristi POSTOJECI matches/messages sistem (nov "izvor" matcha), ali je
-- ruta ODVOJENA od /poruke (poruke ostaju iskljucivo za obican chat,
-- 18+ chat ide preko /18-plus/chat/[matchId]).
-- ---------------------------------------------------------------------

alter table matches drop constraint if exists matches_source_check;
alter table matches add constraint matches_source_check
  check (source in ('like', 'secret_spark', 'duel', '18plus'));

create or replace function start_18plus_chat(p_viewer_id uuid, p_target_id uuid)
returns table (match_id uuid, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_a uuid;
  v_b uuid;
  v_match_id uuid;
begin
  if auth.uid() is distinct from p_viewer_id then
    return query select null::uuid, 'Nije dozvoljeno.'; return;
  end if;
  if p_viewer_id = p_target_id then
    return query select null::uuid, 'Ne mozes kontaktirati sebe.'; return;
  end if;

  if exists (
    select 1 from blocks b
    where (b.blocker_id = p_viewer_id and b.blocked_id = p_target_id)
       or (b.blocker_id = p_target_id and b.blocked_id = p_viewer_id)
  ) then
    return query select null::uuid, 'Ne mozes kontaktirati ovog korisnika.'; return;
  end if;

  v_a := least(p_viewer_id, p_target_id);
  v_b := greatest(p_viewer_id, p_target_id);

  select id into v_match_id from matches where profile_a_id = v_a and profile_b_id = v_b and unmatched_at is null;

  if v_match_id is null then
    insert into matches (profile_a_id, profile_b_id, source)
      values (v_a, v_b, '18plus')
      returning id into v_match_id;
  end if;

  return query select v_match_id, null::text;
end;
$$;

grant execute on function start_18plus_chat(uuid, uuid) to authenticated;
