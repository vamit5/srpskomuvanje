-- get_18plus_candidates: sekcija "Ljudi koji zele 18+ igre ili sex" treba
-- da prikaze SVAKOGA ko je ikad izabrao "18+ chat" na nekoga u Muvaj-u ILI
-- je pri registraciji izabrao "Sex" -- BEZ obostranog rod/orijentacija
-- filtera koji se koristi za Muvaj/discover (izricit zahtev: "ne samo 2
-- osobe kao sto je sada slucaj" -- uzrok je bio da su se p.gender/pref.
-- interested_in morali poklapati u OBA smera, kao u Muvaj-u, sto je za ovu
-- sekciju previse restriktivno po definiciji ("svi koji to zele" a ne
-- "kompatibilni parovi"). is_discoverable, block-lista i starosni opseg
-- viewer-a ostaju (skriveni/blokirani nalozi se i dalje ne prikazuju).
drop function if exists get_18plus_candidates(uuid, int);

create or replace function get_18plus_candidates(viewer_id uuid, result_limit int default 100)
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
    (p.looking_for = 'sex')
  from profiles p
  where p.id <> viewer_id
    and p.deleted_at is null
    and p.is_discoverable = true
    and date_part('year', age(p.birth_date)) between coalesce(v_age_min, 18) and coalesce(v_age_max, 99)
    -- Vidljiv u 18+ Muvanju ako: JE ikad izabrao "18+ chat" nekome u
    -- Muvaj, ILI je pri registraciji rekao da trazi "sex" -- namerno BEZ
    -- provere da li se rod/orijentacija poklapaju sa viewer-om.
    and (p.looking_for = 'sex' or exists (select 1 from krevet_signals ks where ks.from_profile_id = p.id))
    and not exists (
      select 1 from blocks b
      where (b.blocker_id = viewer_id and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = viewer_id)
    )
  order by
    (p.boost_expires_at is not null and p.boost_expires_at > now()) desc,
    coalesce(p.profile_completion_score, 0)
      + greatest(0, 7 - extract(day from (now() - p.last_active_at))) / 7 * 100 desc
  limit result_limit;
end;
$$;

grant execute on function get_18plus_candidates(uuid, int) to authenticated;
