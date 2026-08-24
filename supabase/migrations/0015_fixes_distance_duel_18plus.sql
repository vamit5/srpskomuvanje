-- 0015_fixes_distance_duel_18plus.sql
-- Runda 4 live-testing ispravki:
--  1) discover_profiles: vraca i distance_km (korisnik hoce da vidi tacno
--     koliko je km udaljena svaka osoba), i vise ne predlaze ponovo ljude
--     kojima je vec poslat "krevet" signal (ranije se iskljucivao samo
--     likes/super_likes/passes, ne i krevet_signals -- ista osoba se
--     beskonacno vracala u Muvaj posle "KREVET" izbora).
--  2) get_18plus_candidates: KRITICNA ispravka -- funkcija je iskljucivala
--     iz rezultata svakog kome je viewer VEC poslao krevet signal (ili
--     koga je lajkovao), sto je znacilo da cak i posle OBOSTRANOG "krevet"
--     izbora (match!) ta osoba vise nikad nije bila vidljiva u "Pozovi
--     nekoga u krevet" gridu -- tacno bug koji je korisnik prijavio
--     testiranjem sa 2 naloga. "18+ Muvanje" je direktorijum za kontakt,
--     ne swipe-deck -- filtriranje po vec-poslatom-signalu/lajku ovde
--     nema smisla i uklanja se u potpunosti (ostaje samo blokovi).
--     Dodat i distance_km iz istog razloga kao (1).
--  3) create_duel: vise NE zahteva da kandidat ima odobrenu profilnu
--     sliku (DuelGame.tsx vec ima fallback "👤" za praznu sliku) --
--     ranije je ovo dovodilo do "nema dovoljno profila za Duel" cim
--     manje od 2 kandidata odgovarajuceg pola imaju odobrenu sliku, iako
--     je bilo mnogo vise profila ukupno.
--  4) muvaj_choose: dodata notifikacija (i, u aplikaciji, push) i za
--     "upoznavanje" izbor (ranije je notifikacija/push postojala SAMO za
--     "krevet" i za match -- obican lajk je bio potpuno tih).
-- ---------------------------------------------------------------------

-- (1) discover_profiles -- menja se RETURNS TABLE (dodat distance_km),
-- mora eksplicitan DROP pre CREATE OR REPLACE.
drop function if exists discover_profiles(uuid, int);

create or replace function discover_profiles(viewer_id uuid, result_limit int default 20)
returns table (
  id uuid,
  name text,
  birth_date date,
  city text,
  bio text,
  interests text[],
  is_verified boolean,
  hot_mode_enabled boolean,
  primary_photo_url text,
  score numeric,
  distance_km numeric
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
  w_compatibility numeric;
  w_activity numeric;
  w_freshness numeric;
  w_profile_quality numeric;
  w_distance numeric;
begin
  if auth.uid() is distinct from viewer_id then
    raise exception 'Nije dozvoljeno da učitaš tuđi Otkrij feed.';
  end if;

  select profiles.gender, profiles.interests, profiles.lat, profiles.lng
    into v_gender, v_interests, v_lat, v_lng
  from profiles where profiles.id = viewer_id;

  select interested_in, age_min, age_max
    into v_interested_in, v_age_min, v_age_max
  from preferences where profile_id = viewer_id;

  select weight into w_compatibility from discovery_scoring_config where key = 'compatibility';
  select weight into w_activity from discovery_scoring_config where key = 'activity';
  select weight into w_freshness from discovery_scoring_config where key = 'freshness';
  select weight into w_profile_quality from discovery_scoring_config where key = 'profile_quality';
  select weight into w_distance from discovery_scoring_config where key = 'distance';

  return query
  select
    p.id, p.name, p.birth_date, p.city, p.bio, p.interests, p.is_verified, p.hot_mode_enabled,
    (select pp.url from profile_photos pp where pp.profile_id = p.id and pp.is_primary = true and pp.moderation_status = 'approved' limit 1) as primary_photo_url,
    round((
      coalesce(w_compatibility, 0) * (
        case when coalesce(array_length(v_interests, 1), 0) = 0 or coalesce(array_length(p.interests, 1), 0) = 0 then 30
        else (select count(*) from unnest(p.interests) i where i = any(v_interests))::numeric
             / greatest(array_length(v_interests, 1), 1) * 100
        end
      )
      + coalesce(w_profile_quality, 0) * coalesce(p.profile_completion_score, 0)
      + coalesce(w_freshness, 0) * greatest(0, 30 - extract(day from (now() - p.created_at))) / 30 * 100
      + coalesce(w_activity, 0) * greatest(0, 7 - extract(day from (now() - p.last_active_at))) / 7 * 100
      + coalesce(w_distance, 0) * (
          case
            when v_lat is null or v_lng is null or p.lat is null or p.lng is null then 50
            else greatest(0, 100 - public.distance_km(v_lat, v_lng, p.lat, p.lng))
          end
        )
    ) / greatest(coalesce(w_compatibility,0)+coalesce(w_profile_quality,0)+coalesce(w_freshness,0)+coalesce(w_activity,0)+coalesce(w_distance,0), 1))::numeric as score,
    case
      when v_lat is null or v_lng is null or p.lat is null or p.lng is null then null
      else round(public.distance_km(v_lat, v_lng, p.lat, p.lng)::numeric, 1)
    end as distance_km
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
    and not exists (select 1 from likes l where l.from_profile_id = viewer_id and l.to_profile_id = p.id)
    and not exists (select 1 from super_likes sl where sl.from_profile_id = viewer_id and sl.to_profile_id = p.id)
    and not exists (select 1 from passes ps where ps.from_profile_id = viewer_id and ps.to_profile_id = p.id)
    and not exists (select 1 from krevet_signals ks where ks.from_profile_id = viewer_id and ks.to_profile_id = p.id)
  order by score desc nulls last
  limit result_limit;
end;
$$;

grant execute on function discover_profiles(uuid, int) to authenticated;

-- ---------------------------------------------------------------------
-- (2) get_18plus_candidates -- menja se RETURNS TABLE (dodat distance_km).
-- ---------------------------------------------------------------------

drop function if exists get_18plus_candidates(uuid, int);

create or replace function get_18plus_candidates(viewer_id uuid, result_limit int default 15)
returns table (
  id uuid, name text, birth_date date, city text, bio text,
  primary_photo_url text, is_boosted boolean, distance_km numeric
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
    (p.boost_expires_at is not null and p.boost_expires_at > now()),
    case
      when v_lat is null or v_lng is null or p.lat is null or p.lng is null then null
      else round(public.distance_km(v_lat, v_lng, p.lat, p.lng)::numeric, 1)
    end
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
            else greatest(0, 100 - public.distance_km(v_lat, v_lng, p.lat, p.lng))
          end
        )
    ) desc
  limit result_limit;
end;
$$;

grant execute on function get_18plus_candidates(uuid, int) to authenticated;

-- ---------------------------------------------------------------------
-- (3) create_duel -- telo NEPROMENJENIH parametara/kolona, bezbedno bez
-- DROP-a. Uklonjen zahtev za odobrenu sliku (DuelGame.tsx ima "👤"
-- fallback za profile bez slike).
-- ---------------------------------------------------------------------

create or replace function create_duel(viewer_id uuid, prompt text)
returns table (
  duel_id uuid,
  a_id uuid, a_name text, a_birth_date date, a_photo_url text,
  b_id uuid, b_name text, b_birth_date date, b_photo_url text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gender text;
  v_interested_in text[];
  v_age_min smallint;
  v_age_max smallint;
  v_a uuid;
  v_b uuid;
  v_duel_id uuid;
begin
  if auth.uid() is distinct from viewer_id then
    raise exception 'Nije dozvoljeno.';
  end if;

  select profiles.gender into v_gender from profiles where profiles.id = viewer_id;
  select interested_in, age_min, age_max into v_interested_in, v_age_min, v_age_max
    from preferences where profile_id = viewer_id;

  select p.id into v_a
  from profiles p
  join preferences pref on pref.profile_id = p.id
  where p.id <> viewer_id
    and p.deleted_at is null
    and p.is_discoverable = true
    and p.gender = any(coalesce(v_interested_in, array[]::text[]))
    and v_gender = any(coalesce(pref.interested_in, array[]::text[]))
    and date_part('year', age(p.birth_date)) between coalesce(v_age_min, 18) and coalesce(v_age_max, 99)
  order by random()
  limit 1;

  select p.id into v_b
  from profiles p
  join preferences pref on pref.profile_id = p.id
  where p.id <> viewer_id
    and p.id is distinct from v_a
    and p.deleted_at is null
    and p.is_discoverable = true
    and p.gender = any(coalesce(v_interested_in, array[]::text[]))
    and v_gender = any(coalesce(pref.interested_in, array[]::text[]))
    and date_part('year', age(p.birth_date)) between coalesce(v_age_min, 18) and coalesce(v_age_max, 99)
  order by random()
  limit 1;

  if v_a is null or v_b is null then
    return;
  end if;

  insert into duels (prompt, profile_a_id, profile_b_id)
  values (prompt, v_a, v_b)
  returning id into v_duel_id;

  return query
  select
    v_duel_id,
    a.id, a.name, a.birth_date,
    (select pp.url from profile_photos pp where pp.profile_id = a.id and pp.is_primary = true and pp.moderation_status = 'approved' limit 1),
    b.id, b.name, b.birth_date,
    (select pp.url from profile_photos pp where pp.profile_id = b.id and pp.is_primary = true and pp.moderation_status = 'approved' limit 1)
  from profiles a, profiles b
  where a.id = v_a and b.id = v_b;
end;
$$;

grant execute on function create_duel(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- (4) muvaj_choose -- telo nepromenjenih kolona (matched, match_id),
-- bezbedno bez DROP-a. Dodata notifikacija za "upoznavanje" (ranije je
-- postojala samo za "krevet" i match) -- push za nju se salje iz
-- src/app/(app)/muvaj/actions.ts (isti obrazac kao za krevet/match).
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

    select name into v_my_name from profiles where id = viewer_id;
    insert into notifications (profile_id, type, title, body, data)
      values (
        target_id, 'like', '😍 Neko hoće da te upozna',
        'Otključaj da vidiš ko je to.', jsonb_build_object('fromHidden', true)
      );
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
