-- FAZA 5: "Sada" ekran sa PRAVIM aktivnostima -- lokacija ("Blizu sada",
-- sekcija 16), istaknuti profil, i vremenski ograničeni događaji ("Vrelo
-- petak", sekcija 25).
-- Pokreni u Supabase SQL Editoru.

-- ---------------------------------------------------------------------
-- BEZBEDNOSNA ISPRAVKA PRE NEGO ŠTO POČNEMO DA ČUVAMO PRAVE KOORDINATE:
-- profiles.lat/lng su od FAZE 1 bile čitljive SVAKOM ulogovanom korisniku
-- (deo šire "javni profili vidljivi svima" politike) -- niko ih dosad nije
-- popunio pravim podacima pa ništa nije procurelo, ali moramo zatvoriti
-- pre nego što korisnici počnu da dele lokaciju. Ukidamo SELECT pristup
-- tim kolonama na nivou baze (ne samo u našem kodu) -- ostaje čitljivo
-- SAMO za SECURITY DEFINER funkcije (koje rade kao vlasnik, ne kao
-- pozivalac), koje su jedini legitiman put do "udaljenost je X km".
-- ---------------------------------------------------------------------
revoke select (lat, lng) on profiles from authenticated, anon;

-- ---------------------------------------------------------------------
-- "BLIZU SADA": broj kompatibilnih ljudi u datom radijusu. Vraća NULL
-- (ne 0) ako korisnik nije podelio lokaciju -- UI to razlikuje od "nema
-- nikog blizu".
-- ---------------------------------------------------------------------
create or replace function nearby_count(viewer_id uuid, radius_km int default 25)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lat double precision;
  v_lng double precision;
  v_gender text;
  v_interested_in text[];
  v_count int;
begin
  if auth.uid() is distinct from viewer_id then
    raise exception 'Nije dozvoljeno.';
  end if;

  select profiles.lat, profiles.lng, profiles.gender into v_lat, v_lng, v_gender
  from profiles where profiles.id = viewer_id;

  if v_lat is null or v_lng is null then
    return null;
  end if;

  select interested_in into v_interested_in from preferences where profile_id = viewer_id;

  select count(*) into v_count
  from profiles p
  join preferences pref on pref.profile_id = p.id
  where p.id <> viewer_id
    and p.deleted_at is null
    and p.is_discoverable = true
    and p.lat is not null
    and p.lng is not null
    and p.gender = any(coalesce(v_interested_in, array[]::text[]))
    and v_gender = any(coalesce(pref.interested_in, array[]::text[]))
    and distance_km(v_lat, v_lng, p.lat, p.lng) <= radius_km
    and not exists (
      select 1 from blocks b
      where (b.blocker_id = viewer_id and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = viewer_id)
    );

  return v_count;
end;
$$;

grant execute on function nearby_count(uuid, int) to authenticated;

-- ---------------------------------------------------------------------
-- Upis lokacije korisnika (poziva se sa klijenta posle geolocation
-- dozvole). Obična funkcija (nije SECURITY DEFINER) bi radila i preko
-- RLS UPDATE politike koju korisnik već ima nad svojim redom, ali
-- prolazimo kroz funkciju radi validacije opsega (sanity check).
-- ---------------------------------------------------------------------
create or replace function update_my_location(new_lat double precision, new_lng double precision)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new_lat < -90 or new_lat > 90 or new_lng < -180 or new_lng > 180 then
    raise exception 'Nevažeće koordinate.';
  end if;

  update profiles
  set lat = new_lat, lng = new_lng, location_updated_at = now()
  where id = auth.uid();
end;
$$;

grant execute on function update_my_location(double precision, double precision) to authenticated;

create or replace function clear_my_location()
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update profiles set lat = null, lng = null, location_updated_at = null where id = auth.uid();
end;
$$;

grant execute on function clear_my_location() to authenticated;

-- ---------------------------------------------------------------------
-- EVENTI ("Vrelo petak" i slično, sekcija 25) -- admin pravi, svako čita.
-- Politike za "events" tabelu već postoje od FAZE 1 (admin all, ostali
-- select) -- ovde nema izmene, samo napomena da tabela već radi.
-- ---------------------------------------------------------------------
