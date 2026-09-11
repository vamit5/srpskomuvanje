-- is_featured -- transparentan "istaknut profil" bedz koji admin rucno
-- ukljucuje/iskljucuje po nalogu (na /admin/users/[id]). Za razliku od
-- Boost-a (koji korisnik sam kupuje), ovo je nesto sto SAMO admin dodeljuje
-- -- ali bedz NE tvrdi nista o sadrzaju slika/snimaka te osobe, samo da je
-- profil istaknut (sto jeste istina, jer se stvarno gura napred u
-- rezultatima) -- vidi napomenu u src/lib/siteContent.ts zasto tekst bedza
-- ide preko site_content umesto da bude fiksan u kodu.
alter table profiles add column if not exists is_featured boolean not null default false;

insert into site_content (key, value) values
  ('featured_badge_label', '✨ Izdvojen profil')
on conflict (key) do nothing;

-- discover_profiles (Muvaj): dodat is_featured, istaknuti profili idu prvi
-- u rezultatima (ispred score-a), isto kao boost logika u 18+ Muvanju.
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
  distance_km numeric,
  is_featured boolean
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
    end as distance_km,
    p.is_featured
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
  order by p.is_featured desc, score desc nulls last
  limit result_limit;
end;
$$;

grant execute on function discover_profiles(uuid, int) to authenticated;

-- get_18plus_candidates: dodat is_featured, istaknuti profili idu odmah
-- posle Boost-ovanih.
drop function if exists get_18plus_candidates(uuid, int);

create or replace function get_18plus_candidates(viewer_id uuid, result_limit int default 100)
returns table (
  id uuid, name text, birth_date date, city text, bio text,
  primary_photo_url text, is_boosted boolean, distance_km numeric,
  looking_for_sex boolean, is_featured boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lat double precision;
  v_lng double precision;
  v_age_min smallint;
  v_age_max smallint;
begin
  if auth.uid() is distinct from viewer_id then
    raise exception 'Nije dozvoljeno.';
  end if;

  select profiles.lat, profiles.lng into v_lat, v_lng
  from profiles where profiles.id = viewer_id;

  select age_min, age_max into v_age_min, v_age_max
  from preferences where profile_id = viewer_id;

  return query
  select p.id, p.name, p.birth_date, p.city, p.bio,
    (select pp.url from profile_photos pp where pp.profile_id = p.id and pp.is_primary = true and pp.moderation_status = 'approved' limit 1),
    (p.boost_expires_at is not null and p.boost_expires_at > now()),
    case
      when v_lat is null or v_lng is null or p.lat is null or p.lng is null then null
      else round(public.distance_km(v_lat, v_lng, p.lat, p.lng)::numeric, 1)
    end,
    (p.looking_for = 'sex'),
    p.is_featured
  from profiles p
  where p.id <> viewer_id
    and p.deleted_at is null
    and p.is_discoverable = true
    and date_part('year', age(p.birth_date)) between coalesce(v_age_min, 18) and coalesce(v_age_max, 99)
    and (p.looking_for = 'sex' or exists (select 1 from krevet_signals ks where ks.from_profile_id = p.id))
    and not exists (
      select 1 from blocks b
      where (b.blocker_id = viewer_id and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = viewer_id)
    )
  order by
    (p.boost_expires_at is not null and p.boost_expires_at > now()) desc,
    p.is_featured desc,
    coalesce(p.profile_completion_score, 0)
      + greatest(0, 7 - extract(day from (now() - p.last_active_at))) / 7 * 100 desc
  limit result_limit;
end;
$$;

grant execute on function get_18plus_candidates(uuid, int) to authenticated;
