-- TAJNA SOBA (Secret Room) -- real-time, timer-based, obostrani-signal igra.
-- Ponovo koristi: profiles/likes/super_likes/passes/matches/blocks (kao Muvaj/
-- Otkrij), subscriptions (Premium), wallets/credit_transactions (Credits),
-- notifications + web push (kao ostatak app-a), activity_events (analytics,
-- isti obrazac kao night_flirting_* eventi), duel_votes (dodatni signal tipa).
--
-- Ne pravi novi payment sistem -- placeno "OTVORI" trosi Credits (isti
-- mehanizam kao unlock_night_content), Premium ima besplatan bypass.

-- ---------------------------------------------------------------------
-- KONFIGURACIJA (isti key/value obrazac kao night_flirting_config)
-- ---------------------------------------------------------------------

create table secret_room_config (
  key text primary key,
  value text not null,
  description text,
  updated_at timestamptz not null default now()
);

create trigger secret_room_config_set_updated_at before update on secret_room_config
  for each row execute function set_updated_at();

insert into secret_room_config (key, value, description) values
  ('round_duration_seconds', '180', 'Koliko traje jedna runda u Tajnoj sobi (countdown pri ulasku)'),
  ('request_duration_seconds', '180', 'Koliko vremena ima primalac da odgovori na RIZIKUJ zahtev'),
  ('duel_duration_seconds', '120', 'Koliko traje Duel hemije nakon otvaranja zajednicke sobe'),
  ('candidates_per_round', '7', 'Broj kandidata prikazanih po rundi'),
  ('unlock_cost_credits', '1', 'Koliko Credits-a kosta OTVORI (kada primalac nije Premium)'),
  ('rounds_daily_limit_free', '3', 'Koliko rundi dnevno sme besplatan nalog'),
  ('rounds_daily_limit_premium', '10', 'Koliko rundi dnevno sme Premium nalog'),
  ('evening_start_hhmm', '20:00', 'Od kada je Tajna soba istaknuta kao UZIVO u navigaciji (beogradsko vreme)'),
  ('evening_end_hhmm', '02:00', 'Do kada je Tajna soba istaknuta kao UZIVO u navigaciji'),
  ('weight_like_signal', '30', 'Bonus poenima za kandidata kog je gledalac vec lajkovao u Muvaj'),
  ('weight_duel_signal', '20', 'Bonus poenima za kandidata kog je gledalac vec birao u Duelu'),
  (
    'duel_questions',
    '[{"text":"Veceras bih pre...","options":[{"emoji":"🍸","label":"otisao/la na pice"},{"emoji":"🌙","label":"spontano nestao/la negde"},{"emoji":"🔥","label":"ostao/la u ovom razgovoru"},{"emoji":"😈","label":"s tobom u krevet"}]},{"text":"Prvi potez bi bio...","options":[{"emoji":"💬","label":"dug razgovor do kasno"},{"emoji":"🚗","label":"voznja bez plana"},{"emoji":"🍷","label":"casa vina kod mene ili tebe"},{"emoji":"😏","label":"direktno flertovanje"}]},{"text":"Za tebe je flert...","options":[{"emoji":"😇","label":"suptilan i spor"},{"emoji":"😈","label":"direktan i hrabar"},{"emoji":"🎭","label":"igra i zadirkivanje"},{"emoji":"🔥","label":"sav pritisak odjednom"}]}]',
    'JSON niz pitanja za Duel hemije -- svako: {text, options:[{emoji,label}, ...4]}'
  );

-- ---------------------------------------------------------------------
-- SRPSKA PITANJA PRI PRIJAVI (sekcija na kraju spec-a) -- "da li si pravi
-- Srbin/Srpkinja", multi-select omiljenih stvari; koristi se za mali
-- "poklapanje" banner u chatu posle match-a.
-- ---------------------------------------------------------------------

alter table profiles add column if not exists food_favorites text[] not null default '{}';

-- ---------------------------------------------------------------------
-- RUNDE (jedna "igra" -- korisnik ulazi, dobija kandidate, ima countdown)
-- ---------------------------------------------------------------------

create table secret_room_rounds (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'completed', 'expired')),
  result text check (result in ('chemistry', 'no_chemistry', 'abandoned')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

-- samo jedna AKTIVNA runda po korisniku u isto vreme
create unique index secret_room_rounds_one_active_idx on secret_room_rounds (profile_id) where status = 'active';
create index secret_room_rounds_profile_idx on secret_room_rounds (profile_id, created_at desc);

alter table secret_room_rounds enable row level security;

create policy "korisnik vidi svoje runde"
  on secret_room_rounds for select using (auth.uid() = profile_id);

create policy "admin vidi sve runde"
  on secret_room_rounds for select using (is_admin());

-- ---------------------------------------------------------------------
-- KANDIDATI PO RUNDI (5-7 profila, jedan je "Tajna karta")
-- ---------------------------------------------------------------------

create table secret_room_candidates (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references secret_room_rounds(id) on delete cascade,
  candidate_id uuid not null references profiles(id) on delete cascade,
  card_position smallint not null,
  is_secret_card boolean not null default false,
  swipe text check (swipe in ('like', 'pass')),
  swiped_at timestamptz,
  created_at timestamptz not null default now(),
  unique (round_id, candidate_id)
);

create index secret_room_candidates_round_idx on secret_room_candidates (round_id, card_position);

alter table secret_room_candidates enable row level security;

create policy "korisnik vidi kandidate iz svoje runde"
  on secret_room_candidates for select using (
    exists (select 1 from secret_room_rounds r where r.id = round_id and r.profile_id = auth.uid())
  );

create policy "admin vidi sve kandidate"
  on secret_room_candidates for select using (is_admin());

-- ---------------------------------------------------------------------
-- ZAHTEVI (RIZIKUJ -> primalac vidi samo "neko te je izabrao", cekaj OTVORI)
-- ---------------------------------------------------------------------

create table secret_room_requests (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references secret_room_rounds(id) on delete cascade,
  from_profile_id uuid not null references profiles(id) on delete cascade,
  to_profile_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  responded_at timestamptz,
  check (from_profile_id <> to_profile_id)
);

create index secret_room_requests_to_idx on secret_room_requests (to_profile_id, status);
create index secret_room_requests_from_idx on secret_room_requests (from_profile_id, status);

alter table secret_room_requests enable row level security;

create policy "ucesnici vide svoj zahtev"
  on secret_room_requests for select using (auth.uid() = from_profile_id or auth.uid() = to_profile_id);

create policy "admin vidi sve zahteve"
  on secret_room_requests for select using (is_admin());

-- KLJUCNO za "ne otkrivaj ko je" (sekcija 10 spec-a): RLS je red-po-red,
-- ne moze sakriti SAMO from_profile_id primaocu dok je zahtev 'pending'.
-- Zato restriktujemo na nivou KOLONE -- obican authenticated klijent
-- (i realtime) nikad ne vidi from_profile_id; nase SECURITY DEFINER
-- funkcije (secret_room_respond_request i sl.) i dalje imaju pun pristup
-- jer citaju direktno iz SQL-a, ne kroz PostgREST grantove.
revoke select on secret_room_requests from authenticated;
grant select (id, round_id, to_profile_id, status, created_at, expires_at, responded_at)
  on secret_room_requests to authenticated;

-- ---------------------------------------------------------------------
-- ZAJEDNICKA SOBA (posle OTVORI -- oboje unutra, Duel hemije)
-- ---------------------------------------------------------------------

create table secret_room_pairs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references secret_room_requests(id) on delete cascade,
  profile_a_id uuid not null references profiles(id) on delete cascade,
  profile_b_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'duel' check (status in ('duel', 'chemistry_confirmed', 'no_chemistry', 'ended')),
  match_count smallint not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  check (profile_a_id < profile_b_id)
);

create unique index secret_room_pairs_request_idx on secret_room_pairs (request_id);
create index secret_room_pairs_a_idx on secret_room_pairs (profile_a_id, status);
create index secret_room_pairs_b_idx on secret_room_pairs (profile_b_id, status);

alter table secret_room_pairs enable row level security;

create policy "ucesnici vide svoju sobu"
  on secret_room_pairs for select using (auth.uid() = profile_a_id or auth.uid() = profile_b_id);

create policy "admin vidi sve sobe"
  on secret_room_pairs for select using (is_admin());

-- ---------------------------------------------------------------------
-- DUEL HEMIJE ODGOVORI
-- ---------------------------------------------------------------------

create table secret_room_duel_answers (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references secret_room_pairs(id) on delete cascade,
  question_index smallint not null,
  profile_id uuid not null references profiles(id) on delete cascade,
  answer_index smallint not null,
  created_at timestamptz not null default now(),
  unique (pair_id, question_index, profile_id)
);

alter table secret_room_duel_answers enable row level security;

create policy "ucesnici vide odgovore svoje sobe"
  on secret_room_duel_answers for select using (
    exists (
      select 1 from secret_room_pairs p
      where p.id = pair_id and (p.profile_a_id = auth.uid() or p.profile_b_id = auth.uid())
    )
  );

create policy "ucesnik upisuje svoj odgovor"
  on secret_room_duel_answers for insert with check (
    auth.uid() = profile_id
    and exists (
      select 1 from secret_room_pairs p
      where p.id = pair_id and (p.profile_a_id = auth.uid() or p.profile_b_id = auth.uid())
    )
  );

create policy "admin vidi sve duel hemije odgovore"
  on secret_room_duel_answers for select using (is_admin());

-- ---------------------------------------------------------------------
-- start_secret_room_round -- bira kandidate i otvara novu rundu.
-- Ako vec postoji aktivna, ne otisla runda (istekla po vremenu), vraca
-- tu istu (idempotentno -- korisnik moze da osvezi stranicu bez greske).
-- ---------------------------------------------------------------------

create or replace function start_secret_room_round(viewer_id uuid, result_limit int default null)
returns table (round_id uuid, expires_at timestamptz, is_new boolean)
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
  v_limit int;
  v_round_seconds int;
  v_w_like numeric;
  v_w_duel numeric;
  v_existing_round_id uuid;
  v_existing_expires timestamptz;
  v_new_round_id uuid;
  v_new_expires timestamptz;
  v_secret_candidate_id uuid;
  v_secret_position smallint;
begin
  if auth.uid() is distinct from viewer_id then
    raise exception 'Nije dozvoljeno.';
  end if;

  -- Oportunisticko isticanje: nema pozadinskog posla (cron), pa istekle
  -- runde/zahteve zatvaramo cim neko dodirne sistem (isti obrazac kao
  -- Belgrade-vreme dnevni limiti drugde u app-u).
  update secret_room_rounds set status = 'expired', ended_at = now()
    where profile_id = viewer_id and status = 'active' and expires_at < now();
  update secret_room_requests set status = 'expired'
    where to_profile_id = viewer_id and status = 'pending' and expires_at < now();

  select id, expires_at into v_existing_round_id, v_existing_expires
    from secret_room_rounds where profile_id = viewer_id and status = 'active';

  if v_existing_round_id is not null then
    return query select v_existing_round_id, v_existing_expires, false;
    return;
  end if;

  select coalesce(value::int, 7) into v_limit from secret_room_config where key = 'candidates_per_round';
  select coalesce(value::int, 180) into v_round_seconds from secret_room_config where key = 'round_duration_seconds';
  select coalesce(value::numeric, 30) into v_w_like from secret_room_config where key = 'weight_like_signal';
  select coalesce(value::numeric, 20) into v_w_duel from secret_room_config where key = 'weight_duel_signal';
  v_limit := coalesce(result_limit, v_limit);

  select profiles.gender, profiles.interests, profiles.lat, profiles.lng
    into v_gender, v_interests, v_lat, v_lng
  from profiles where profiles.id = viewer_id;

  select interested_in, age_min, age_max
    into v_interested_in, v_age_min, v_age_max
  from preferences where profile_id = viewer_id;

  v_new_round_id := gen_random_uuid();
  v_new_expires := now() + make_interval(secs => v_round_seconds);

  insert into secret_room_rounds (id, profile_id, status, expires_at)
    values (v_new_round_id, viewer_id, 'active', v_new_expires);

  -- Napomena o performansama: skoring i LIMIT su namerno u UNUTRASNJEM
  -- upitu (obican "order by score desc limit N", bez window funkcije) --
  -- to Postgres-u dozvoljava top-N (bounded heap) sortiranje umesto da
  -- mora da materijalizuje i rangira SVE kandidate. row_number() se
  -- primenjuje tek POSLE, na vec skraceni skup od najvise v_limit redova.
  insert into secret_room_candidates (round_id, candidate_id, card_position, is_secret_card)
  select v_new_round_id, x.id, row_number() over (order by x.score desc), false
  from (
    select
      p.id,
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
        + (case when exists (
            select 1 from likes l where l.from_profile_id = viewer_id and l.to_profile_id = p.id
            union
            select 1 from super_likes sl where sl.from_profile_id = viewer_id and sl.to_profile_id = p.id
          ) then v_w_like else 0 end)
        + (case when exists (
            select 1 from duel_votes dv where dv.voter_profile_id = viewer_id and dv.voted_for_profile_id = p.id
          ) then v_w_duel else 0 end)
      ) as score
    from profiles p
    join preferences pref on pref.profile_id = p.id
    where p.id <> viewer_id
      and p.deleted_at is null
      and p.is_discoverable = true
      and p.gender = any(coalesce(v_interested_in, array[]::text[]))
      and v_gender = any(coalesce(pref.interested_in, array[]::text[]))
      and date_part('year', age(p.birth_date)) between coalesce(v_age_min, 18) and coalesce(v_age_max, 99)
      and not exists (
        select 1 from blocks b
        where (b.blocker_id = viewer_id and b.blocked_id = p.id)
           or (b.blocker_id = p.id and b.blocked_id = viewer_id)
      )
      and not exists (
        select 1 from matches m
        where m.unmatched_at is null
          and ((m.profile_a_id = viewer_id and m.profile_b_id = p.id)
            or (m.profile_a_id = p.id and m.profile_b_id = viewer_id))
      )
      and not exists (
        select 1 from secret_room_pairs sp
        where sp.status = 'duel' and sp.expires_at > now()
          and (sp.profile_a_id = p.id or sp.profile_b_id = p.id)
      )
    order by score desc
    limit v_limit
  ) x;

  -- "Tajna karta": najbolje ocenjeni kandidat (card_position = 1), ali se
  -- prikazuje tek posle par swipe-ova -- zato ga fizicki pomeramo na
  -- kasniju poziciju (min(4, poslednja)), da FE prirodno dodje do njega
  -- posle nekoliko izbora, kako spec trazi.
  select candidate_id into v_secret_candidate_id
    from secret_room_candidates where round_id = v_new_round_id and card_position = 1;

  if v_secret_candidate_id is not null then
    select least(4, count(*)) into v_secret_position from secret_room_candidates where round_id = v_new_round_id;

    update secret_room_candidates set card_position = 0
      where round_id = v_new_round_id and card_position = v_secret_position and candidate_id <> v_secret_candidate_id;
    update secret_room_candidates set card_position = v_secret_position, is_secret_card = true
      where round_id = v_new_round_id and candidate_id = v_secret_candidate_id;
    update secret_room_candidates set card_position = 1
      where round_id = v_new_round_id and card_position = 0;
  end if;

  return query select v_new_round_id, v_new_expires, true;
end;
$$;

grant execute on function start_secret_room_round(uuid, int) to authenticated;

-- ---------------------------------------------------------------------
-- get_secret_room_candidates -- lista neodgovorenih kandidata za rundu.
-- ---------------------------------------------------------------------

create or replace function get_secret_room_candidates(viewer_id uuid, p_round_id uuid)
returns table (
  candidate_row_id uuid,
  candidate_id uuid,
  name text,
  birth_date date,
  city text,
  bio text,
  primary_photo_url text,
  card_position smallint,
  is_secret_card boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from viewer_id then
    raise exception 'Nije dozvoljeno.';
  end if;
  if not exists (select 1 from secret_room_rounds r where r.id = p_round_id and r.profile_id = viewer_id) then
    raise exception 'Runda ne postoji.';
  end if;

  return query
  select
    c.id, p.id, p.name, p.birth_date, p.city, p.bio,
    (select pp.url from profile_photos pp where pp.profile_id = p.id and pp.is_primary = true and pp.moderation_status = 'approved' limit 1),
    c.card_position, c.is_secret_card
  from secret_room_candidates c
  join profiles p on p.id = c.candidate_id
  where c.round_id = p_round_id and c.swipe is null
  order by c.card_position asc;
end;
$$;

grant execute on function get_secret_room_candidates(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- secret_room_swipe -- like/pass na obicnog kandidata (ne Tajnu kartu).
-- Like ovde prolazi kroz POSTOJECI like_profile() -- ako je obostrano,
-- pravi se pravi Match, isto kao u Muvaj.
-- ---------------------------------------------------------------------

create or replace function secret_room_swipe(viewer_id uuid, p_round_id uuid, p_candidate_id uuid, p_action text)
returns table (matched boolean, match_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_secret boolean;
  v_matched boolean := false;
  v_match_id uuid;
begin
  if auth.uid() is distinct from viewer_id then
    raise exception 'Nije dozvoljeno.';
  end if;
  if p_action not in ('like', 'pass') then
    raise exception 'Nepoznata akcija.';
  end if;

  if not exists (
    select 1 from secret_room_rounds r
    where r.id = p_round_id and r.profile_id = viewer_id and r.status = 'active' and r.expires_at > now()
  ) then
    raise exception 'Runda je istekla.';
  end if;

  select is_secret_card into v_is_secret
    from secret_room_candidates where round_id = p_round_id and candidate_id = p_candidate_id and swipe is null;

  if v_is_secret is null then
    raise exception 'Kandidat ne postoji ili je vec odgovoren.';
  end if;
  if v_is_secret then
    raise exception 'Tajna karta se otvara preko RIZIKUJ/PRESKOCI, ne obicnog swipe-a.';
  end if;

  update secret_room_candidates set swipe = p_action, swiped_at = now()
    where round_id = p_round_id and candidate_id = p_candidate_id;

  if p_action = 'like' then
    select l.matched, l.match_id into v_matched, v_match_id from like_profile(viewer_id, p_candidate_id, false) l;
  end if;

  return query select coalesce(v_matched, false), v_match_id;
end;
$$;

grant execute on function secret_room_swipe(uuid, uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- secret_room_send_request -- "RIZIKUJ" na Tajnu kartu. Besplatno za
-- posiljaoca (kao super-like); primalac NE vidi identitet dok ne prihvati.
-- ---------------------------------------------------------------------

create or replace function secret_room_send_request(viewer_id uuid, p_round_id uuid)
returns table (request_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid;
  v_req_seconds int;
  v_req_id uuid;
  v_expires timestamptz;
  v_my_name text;
begin
  if auth.uid() is distinct from viewer_id then
    raise exception 'Nije dozvoljeno.';
  end if;

  if not exists (
    select 1 from secret_room_rounds r
    where r.id = p_round_id and r.profile_id = viewer_id and r.status = 'active' and r.expires_at > now()
  ) then
    raise exception 'Runda je istekla.';
  end if;

  select candidate_id into v_candidate_id
    from secret_room_candidates
    where round_id = p_round_id and is_secret_card = true and swipe is null;

  if v_candidate_id is null then
    raise exception 'Nema aktivne Tajne karte u ovoj rundi.';
  end if;

  if exists (
    select 1 from blocks b
    where (b.blocker_id = viewer_id and b.blocked_id = v_candidate_id)
       or (b.blocker_id = v_candidate_id and b.blocked_id = viewer_id)
  ) then
    raise exception 'Ne mozes poslati zahtev ovom korisniku.';
  end if;

  select coalesce(value::int, 180) into v_req_seconds from secret_room_config where key = 'request_duration_seconds';
  v_expires := now() + make_interval(secs => v_req_seconds);
  v_req_id := gen_random_uuid();

  update secret_room_candidates set swipe = 'like', swiped_at = now()
    where round_id = p_round_id and candidate_id = v_candidate_id;

  insert into secret_room_requests (id, round_id, from_profile_id, to_profile_id, expires_at)
    values (v_req_id, p_round_id, viewer_id, v_candidate_id, v_expires);

  select name into v_my_name from profiles where id = viewer_id;

  insert into notifications (profile_id, type, title, body, data)
    values (
      v_candidate_id, 'secret_room_request', '🔥 Neko te je izabrao u Tajnoj sobi',
      'Hoces da otvoris vrata?', jsonb_build_object('requestId', v_req_id)
    );

  return query select v_req_id, v_expires;
end;
$$;

grant execute on function secret_room_send_request(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- get_secret_room_incoming_request -- jedini nacin na koji FE cita svoj
-- dolazni zahtev; namerno NIKAD ne vraca from_profile_id (identitet se
-- otkriva tek posle OTVORI, kroz secret_room_respond_request). Ovo je
-- glavni put za "real-time" -- klijent slusa POSTOJECU notifications
-- realtime pretplatu (tip 'secret_room_request'), pa pozove ovu funkciju
-- da dobije bezbedno stanje -- bez nove realtime infrastrukture.
-- ---------------------------------------------------------------------

create or replace function get_secret_room_incoming_request(viewer_id uuid)
returns table (request_id uuid, status text, created_at timestamptz, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from viewer_id then
    raise exception 'Nije dozvoljeno.';
  end if;

  update secret_room_requests set status = 'expired'
    where to_profile_id = viewer_id and status = 'pending' and expires_at < now();

  return query
  select r.id, r.status, r.created_at, r.expires_at
  from secret_room_requests r
  where r.to_profile_id = viewer_id and r.status = 'pending'
  order by r.created_at desc
  limit 1;
end;
$$;

grant execute on function get_secret_room_incoming_request(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- secret_room_respond_request -- primalac klikne OTVORI (placeno, osim
-- Premium) ili PRESKOCI (besplatno). Isti obrazac trosenja kredita kao
-- unlock_night_content -- direktan update wallets + credit_transactions,
-- credit_wallet() ostaje rezervisan iskljucivo za KUPOVINU (webhook).
-- ---------------------------------------------------------------------

create or replace function secret_room_respond_request(viewer_id uuid, p_request_id uuid, p_accept boolean)
returns table (ok boolean, error text, pair_id uuid, other_id uuid, other_name text, other_birth_date date, other_city text, other_photo_url text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req secret_room_requests%rowtype;
  v_is_premium boolean;
  v_cost int;
  v_balance int;
  v_duel_seconds int;
  v_pair_id uuid;
  v_pair_a uuid;
  v_pair_b uuid;
begin
  if auth.uid() is distinct from viewer_id then
    return query select false, 'Nije dozvoljeno.'::text, null::uuid, null::uuid, null::text, null::date, null::text, null::text; return;
  end if;

  select * into v_req from secret_room_requests where id = p_request_id;

  if v_req.id is null or v_req.to_profile_id <> viewer_id then
    return query select false, 'Zahtev ne postoji.'::text, null::uuid, null::uuid, null::text, null::date, null::text, null::text; return;
  end if;

  if v_req.status <> 'pending' or v_req.expires_at < now() then
    if v_req.status = 'pending' then
      update secret_room_requests set status = 'expired' where id = p_request_id;
    end if;
    return query select false, 'Zahtev je vec istekao.'::text, null::uuid, null::uuid, null::text, null::date, null::text, null::text; return;
  end if;

  if not p_accept then
    update secret_room_requests set status = 'rejected', responded_at = now() where id = p_request_id;
    insert into notifications (profile_id, type, title, body, data)
      values (v_req.from_profile_id, 'secret_room_rejected', '✖ Vrata su se zatvorila', 'Ovaj put nije bilo hemije.', jsonb_build_object('requestId', p_request_id));
    return query select true, null::text, null::uuid, null::uuid, null::text, null::date, null::text, null::text; return;
  end if;

  if exists (
    select 1 from secret_room_pairs sp
    where sp.status = 'duel' and sp.expires_at > now()
      and (sp.profile_a_id = viewer_id or sp.profile_b_id = viewer_id)
  ) then
    return query select false, 'Vec si u aktivnoj sobi.'::text, null::uuid, null::uuid, null::text, null::date, null::text, null::text; return;
  end if;

  select exists(
    select 1 from subscriptions
    where profile_id = viewer_id and status = 'active'
      and (current_period_end is null or current_period_end > now())
  ) into v_is_premium;

  if not v_is_premium then
    select coalesce(value::int, 1) into v_cost from secret_room_config where key = 'unlock_cost_credits';
    select balance_credits into v_balance from wallets where profile_id = viewer_id;
    if coalesce(v_balance, 0) < v_cost then
      return query select false, 'insufficient_credits'::text, null::uuid, null::uuid, null::text, null::date, null::text, null::text; return;
    end if;
    update wallets set balance_credits = balance_credits - v_cost where profile_id = viewer_id;
    insert into credit_transactions (profile_id, amount, reason)
      values (viewer_id, -v_cost, 'unlock_spend');
  end if;

  update secret_room_requests set status = 'accepted', responded_at = now() where id = p_request_id;

  select coalesce(value::int, 120) into v_duel_seconds from secret_room_config where key = 'duel_duration_seconds';
  v_pair_a := least(v_req.from_profile_id, v_req.to_profile_id);
  v_pair_b := greatest(v_req.from_profile_id, v_req.to_profile_id);
  v_pair_id := gen_random_uuid();

  insert into secret_room_pairs (id, request_id, profile_a_id, profile_b_id, status, expires_at)
    values (v_pair_id, p_request_id, v_pair_a, v_pair_b, 'duel', now() + make_interval(secs => v_duel_seconds));

  insert into notifications (profile_id, type, title, body, data)
    values (v_req.from_profile_id, 'secret_room_pair_ready', '🚪 Vrata su otvorena!', 'Usli ste u Tajnu sobu.', jsonb_build_object('pairId', v_pair_id));

  return query
  select true, null::text, v_pair_id, p.id, p.name, p.birth_date, p.city,
    (select pp.url from profile_photos pp where pp.profile_id = p.id and pp.is_primary = true and pp.moderation_status = 'approved' limit 1)
  from profiles p where p.id = v_req.from_profile_id;
end;
$$;

grant execute on function secret_room_respond_request(uuid, uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- get_secret_room_pair -- ucitavanje zajednicke sobe (oba ucesnika, npr.
-- posiljalac posle 'secret_room_pair_ready' notifikacije, ili osvezavanje
-- stranice). Vraca podatke DRUGE osobe (identitet je vec otkriven).
-- ---------------------------------------------------------------------

create or replace function get_secret_room_pair(viewer_id uuid, p_pair_id uuid)
returns table (
  pair_id uuid, status text, match_count smallint, expires_at timestamptz,
  other_id uuid, other_name text, other_birth_date date, other_city text, other_photo_url text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pair secret_room_pairs%rowtype;
  v_other_id uuid;
begin
  if auth.uid() is distinct from viewer_id then
    raise exception 'Nije dozvoljeno.';
  end if;

  select * into v_pair from secret_room_pairs where id = p_pair_id;
  if v_pair.id is null or (v_pair.profile_a_id <> viewer_id and v_pair.profile_b_id <> viewer_id) then
    raise exception 'Soba ne postoji.';
  end if;

  if v_pair.status = 'duel' and v_pair.expires_at < now() then
    update secret_room_pairs set status = 'no_chemistry', ended_at = now() where id = p_pair_id;
    v_pair.status := 'no_chemistry';
  end if;

  v_other_id := case when v_pair.profile_a_id = viewer_id then v_pair.profile_b_id else v_pair.profile_a_id end;

  return query
  select v_pair.id, v_pair.status, v_pair.match_count, v_pair.expires_at,
    p.id, p.name, p.birth_date, p.city,
    (select pp.url from profile_photos pp where pp.profile_id = p.id and pp.is_primary = true and pp.moderation_status = 'approved' limit 1)
  from profiles p where p.id = v_other_id;
end;
$$;

grant execute on function get_secret_room_pair(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- secret_room_duel_answer -- upisuje odgovor i vraca da li je runda
-- pitanja "pogodak" (oba ista) + trenutni ukupan broj poklapanja.
-- ---------------------------------------------------------------------

create or replace function secret_room_duel_answer(viewer_id uuid, p_pair_id uuid, p_question_index smallint, p_answer_index smallint)
returns table (ok boolean, error text, both_answered boolean, is_match boolean, match_count smallint, chemistry_confirmed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pair secret_room_pairs%rowtype;
  v_other_id uuid;
  v_other_answer smallint;
  v_is_match boolean := false;
  v_count smallint;
  v_confirmed boolean := false;
begin
  if auth.uid() is distinct from viewer_id then
    return query select false, 'Nije dozvoljeno.'::text, false, false, 0::smallint, false; return;
  end if;

  select * into v_pair from secret_room_pairs where id = p_pair_id;
  if v_pair.id is null or (v_pair.profile_a_id <> viewer_id and v_pair.profile_b_id <> viewer_id) then
    return query select false, 'Soba ne postoji.'::text, false, false, 0::smallint, false; return;
  end if;
  if v_pair.status <> 'duel' or v_pair.expires_at < now() then
    return query select false, 'Duel hemije je zavrsen.'::text, false, false, v_pair.match_count, false; return;
  end if;

  v_other_id := case when v_pair.profile_a_id = viewer_id then v_pair.profile_b_id else v_pair.profile_a_id end;

  insert into secret_room_duel_answers (pair_id, question_index, profile_id, answer_index)
    values (p_pair_id, p_question_index, viewer_id, p_answer_index)
  on conflict (pair_id, question_index, profile_id) do update set answer_index = excluded.answer_index;

  select answer_index into v_other_answer
    from secret_room_duel_answers where pair_id = p_pair_id and question_index = p_question_index and profile_id = v_other_id;

  if v_other_answer is not null and v_other_answer = p_answer_index then
    v_is_match := true;
    v_count := v_pair.match_count + 1;
    update secret_room_pairs set match_count = v_count where id = p_pair_id;
    if v_count >= 3 then
      v_confirmed := true;
      update secret_room_pairs set status = 'chemistry_confirmed', ended_at = now() where id = p_pair_id;
    end if;
  else
    v_count := v_pair.match_count;
  end if;

  return query select true, null::text, (v_other_answer is not null), v_is_match, v_count, v_confirmed;
end;
$$;

grant execute on function secret_room_duel_answer(uuid, uuid, smallint, smallint) to authenticated;

-- ---------------------------------------------------------------------
-- secret_room_confirm_match -- posle "HEMIJA POTVRDJENA": korisnik bira
-- NASTAVI MUVANJE ili DODAJ U MATCH -- oba u sustini prave pravi Match
-- (isti mehanizam kao like_profile), samo se FE CTA i navigacija razlikuju.
-- ---------------------------------------------------------------------

create or replace function secret_room_confirm_match(viewer_id uuid, p_pair_id uuid)
returns table (ok boolean, error text, match_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pair secret_room_pairs%rowtype;
  v_a uuid;
  v_b uuid;
  v_match_id uuid;
  v_my_name text;
  v_their_name text;
  v_other_id uuid;
begin
  if auth.uid() is distinct from viewer_id then
    return query select false, 'Nije dozvoljeno.'::text, null::uuid; return;
  end if;

  select * into v_pair from secret_room_pairs where id = p_pair_id;
  if v_pair.id is null or (v_pair.profile_a_id <> viewer_id and v_pair.profile_b_id <> viewer_id) then
    return query select false, 'Soba ne postoji.'::text, null::uuid; return;
  end if;
  if v_pair.status <> 'chemistry_confirmed' then
    return query select false, 'Hemija nije potvrdjena.'::text, null::uuid; return;
  end if;

  v_other_id := case when v_pair.profile_a_id = viewer_id then v_pair.profile_b_id else v_pair.profile_a_id end;
  v_a := least(viewer_id, v_other_id);
  v_b := greatest(viewer_id, v_other_id);

  insert into matches (profile_a_id, profile_b_id, source)
    values (v_a, v_b, 'duel')
  on conflict (profile_a_id, profile_b_id) do nothing;

  select id into v_match_id from matches where profile_a_id = v_a and profile_b_id = v_b;

  select name into v_my_name from profiles where id = viewer_id;
  select name into v_their_name from profiles where id = v_other_id;

  insert into notifications (profile_id, type, title, body, data)
    values (viewer_id, 'match', '🔥 MATCH!', 'Ti i ' || coalesce(v_their_name, 'neko') || ' ste se svideli jedno drugom.', jsonb_build_object('matchId', v_match_id, 'otherId', v_other_id));

  return query select true, null::text, v_match_id;
end;
$$;

grant execute on function secret_room_confirm_match(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- get_secret_room_food_match -- zajednicke "srpske" omiljene stvari
-- dvoje matchovanih korisnika (koristi se u chatu za banner).
-- ---------------------------------------------------------------------

create or replace function get_secret_room_food_match(viewer_id uuid, other_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select array_agg(x)
      from unnest(
        (select food_favorites from profiles where id = viewer_id)
      ) x
      where x = any((select food_favorites from profiles where id = other_id))
    ),
    array[]::text[]
  )
  where auth.uid() = viewer_id;
$$;

grant execute on function get_secret_room_food_match(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Trenutno UZIVO brojac (koliko ima realno aktivnih runda) -- realan
-- broj, nikad izmisljen (sekcija 4 spec-a to eksplicitno trazi).
-- ---------------------------------------------------------------------

create or replace function get_secret_room_live_count()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from secret_room_rounds where status = 'active' and expires_at > now();
$$;

grant execute on function get_secret_room_live_count() to authenticated;
