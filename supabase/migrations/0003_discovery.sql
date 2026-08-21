-- FAZA 3: Otkrij, lajkovi, matchevi, Discovery algoritam.
-- Pokreni u Supabase SQL Editoru.

-- ---------------------------------------------------------------------
-- PASSES ("preskoči") -- nije bilo u originalnoj listi tabela, ali bez
-- ovoga bi se isti profil ponovo i ponovo pojavljivao u Otkrij feed-u
-- posle svakog "X", što bi odmah delovalo pokvareno.
-- ---------------------------------------------------------------------

create table if not exists passes (
  id uuid primary key default gen_random_uuid(),
  from_profile_id uuid not null references profiles(id) on delete cascade,
  to_profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (from_profile_id, to_profile_id),
  check (from_profile_id <> to_profile_id)
);

alter table passes enable row level security;

drop policy if exists "korisnik vidi svoje passeve" on passes;
create policy "korisnik vidi svoje passeve"
  on passes for select using (auth.uid() = from_profile_id);

drop policy if exists "korisnik pravi pass samo u svoje ime" on passes;
create policy "korisnik pravi pass samo u svoje ime"
  on passes for insert with check (auth.uid() = from_profile_id);

-- ---------------------------------------------------------------------
-- DISCOVERY ALGORITAM (sekcija 26)
-- ---------------------------------------------------------------------
-- SECURITY DEFINER: funkcija mora da pročita tuđe preference (RLS ih
-- inače skriva) da bi proverila obostranu kompatibilnost pola. Zato
-- interno proveravamo auth.uid() = viewer_id da niko ne može da pozove
-- feed u ime drugog korisnika.
--
-- Weights dolaze iz "discovery_scoring_config" -- admin ih menja bez
-- redeploy-a koda (traženo u sekciji 26: "algoritam mora biti... lako
-- podesiv"). "mutual_interest_probability" weight postoji u tabeli kao
-- rezervisan za FAZU 6+ kada budemo imali dovoljno podataka o
-- lajkovima/pass-evima da tu verovatnoću stvarno računamo -- dok tih
-- podataka nema, NE izmišljamo je, pa se ovde ne koristi.

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
  score numeric
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

  -- Napomena: kolone MORAJU biti kvalifikovane sa "profiles." ovde -- inače
  -- Postgres ne zna da li "interests"/"id" znače kolonu tabele ili
  -- OUT parametar iz RETURNS TABLE(...) sa istim imenom (greška 42702).
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
    (select pp.url from profile_photos pp where pp.profile_id = p.id and pp.is_primary = true limit 1) as primary_photo_url,
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
            else greatest(0, 100 - distance_km(v_lat, v_lng, p.lat, p.lng))
          end
        )
    ) / greatest(coalesce(w_compatibility,0)+coalesce(w_profile_quality,0)+coalesce(w_freshness,0)+coalesce(w_activity,0)+coalesce(w_distance,0), 1))::numeric as score
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
  order by score desc nulls last
  limit result_limit;
end;
$$;

grant execute on function discover_profiles(uuid, int) to authenticated;

-- ---------------------------------------------------------------------
-- LIKE / SUPER LIKE + ATOMSKO PRAVLJENJE MATCH-A
-- ---------------------------------------------------------------------
-- Sve u jednoj funkciji (umesto više poziva sa klijenta) da izbegnemo
-- race condition kad oboje lajkuju u istom trenu, i da izbegnemo
-- potrebu za javnom INSERT politikom na "notifications" (koju inače
-- ne želimo -- ne sme svako da piše bilo kom u notifikacije).

create or replace function like_profile(viewer_id uuid, target_id uuid, is_super boolean default false)
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
    raise exception 'Ne možeš lajkovati sebe.';
  end if;

  if is_super then
    insert into super_likes (from_profile_id, to_profile_id) values (viewer_id, target_id)
    on conflict (from_profile_id, to_profile_id) do nothing;
  else
    insert into likes (from_profile_id, to_profile_id) values (viewer_id, target_id)
    on conflict (from_profile_id, to_profile_id) do nothing;
  end if;

  select exists(
    select 1 from likes where from_profile_id = target_id and to_profile_id = viewer_id
    union
    select 1 from super_likes where from_profile_id = target_id and to_profile_id = viewer_id
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

grant execute on function like_profile(uuid, uuid, boolean) to authenticated;
