-- FAZA 9 (dovršetak): automatska NSFW moderacija fotografija/videa pre
-- javnog lansiranja. Do sada je svaki upload odmah dobijao
-- moderation_status='approved' bez ikakve provere (kolona je postojala od
-- FAZE 1, ali se nije koristila). Pokreni u Supabase SQL Editoru.

-- ---------------------------------------------------------------------
-- Admin mora moći da ODOBRI/ODBIJE granične slučajeve (status 'pending')
-- iz admin panela -- do sada nije postojala nijedna UPDATE politika za
-- profile_photos/profile_videos osim "vlasnik menja svoje".
-- ---------------------------------------------------------------------
create policy "admin upravlja moderacijom fotografija"
  on profile_photos for update using (is_admin());

create policy "admin upravlja moderacijom videa"
  on profile_videos for update using (is_admin());

-- ---------------------------------------------------------------------
-- discover_profiles: primary_photo_url ne sme da vrati fotografiju koja
-- čeka proveru ili je odbijena.
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- create_duel: kandidat mora imati ODOBRENU glavnu fotografiju (ne samo
-- bilo koju) da bi mogao da uđe u Duel.
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
    and exists (select 1 from profile_photos pp where pp.profile_id = p.id and pp.is_primary = true and pp.moderation_status = 'approved')
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
    and exists (select 1 from profile_photos pp where pp.profile_id = p.id and pp.is_primary = true and pp.moderation_status = 'approved')
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
