-- 0018_looking_for_and_bonus.sql
-- Runda 7 zahtevi:
--  1) Dobrodoslica: 3 -> 1 Credit.
--  2) Nova kolona profiles.looking_for -- "Sta trazis na Srpskomuvanje
--     aplikaciji?" pitanje pri registraciji, zamenjuje stari "interesi"
--     korak. Korisnici koji izaberu 'sex' se automatski pojavljuju u
--     "18+ Muvanje" -> "Pozovi nekoga na 18+ igre" (pored onih koji su
--     ikad izabrali "18+ chat" u Muvaj-u, kao i do sada).
-- ---------------------------------------------------------------------

alter table profiles add column if not exists looking_for text
  check (looking_for in ('sex', 'buduci_partner', 'upoznavanje'));

-- (1) Dobrodoslica -- telo nepromenjenih parametara, bezbedno bez DROP-a.
create or replace function grant_signup_bonus(viewer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from viewer_id then
    raise exception 'Nije dozvoljeno.';
  end if;

  if exists (select 1 from credit_transactions where profile_id = viewer_id and reason = 'signup_bonus') then
    return;
  end if;

  insert into wallets (profile_id, balance_credits) values (viewer_id, 1)
  on conflict (profile_id) do update set balance_credits = wallets.balance_credits + 1;

  insert into credit_transactions (profile_id, amount, reason) values (viewer_id, 1, 'signup_bonus');
end;
$$;

grant execute on function grant_signup_bonus(uuid) to authenticated;

-- (2) get_18plus_candidates -- menja se RETURNS TABLE (dodat looking_for_sex),
-- mora eksplicitan DROP pre CREATE OR REPLACE.
drop function if exists get_18plus_candidates(uuid, int);

create or replace function get_18plus_candidates(viewer_id uuid, result_limit int default 15)
returns table (
  id uuid, name text, birth_date date, city text, bio text,
  primary_photo_url text, is_boosted boolean, distance_km numeric,
  looking_for_sex boolean
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
    end,
    (p.looking_for = 'sex')
  from profiles p
  join preferences pref on pref.profile_id = p.id
  where p.id <> viewer_id
    and p.deleted_at is null
    and p.is_discoverable = true
    and p.gender = any(coalesce(v_interested_in, array[]::text[]))
    and v_gender = any(coalesce(pref.interested_in, array[]::text[]))
    and date_part('year', age(p.birth_date)) between coalesce(v_age_min, 18) and coalesce(v_age_max, 99)
    -- Vidljiv u 18+ Muvanju ako: JE ikad izabrao "18+ chat" nekome u
    -- Muvaj (postojece ponasanje), ILI je pri registraciji rekao da
    -- trazi "sex" (nov zahtev) -- "Buduci partner"/"Upoznavanje" ne
    -- ulaze ovde automatski.
    and (p.looking_for = 'sex' or exists (select 1 from krevet_signals ks where ks.from_profile_id = p.id))
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
