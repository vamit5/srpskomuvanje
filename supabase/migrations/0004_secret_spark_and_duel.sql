-- FAZA 6 (deo): "Tajni Srbin/Srpkinja" (Secret Spark) i Duel.
-- Pokreni u Supabase SQL Editoru.

-- ---------------------------------------------------------------------
-- TAJNI SRBIN/SRPKINJA (secret_sparks tabela već postoji od FAZE 1)
-- ---------------------------------------------------------------------
-- Isti atomski obrazac kao like_profile: upiši signal, proveri obostranost,
-- napravi match ako je obostrano. SECURITY DEFINER jer mora da pročita
-- pol pošiljaoca/primaoca (za "Tajni Srbin"/"Tajna Srpkinja" tekst) i da
-- upiše notifikaciju primaocu -- RLS to inače ne bi dozvolio.
--
-- Bitno: primalac NIKAD ne saznaje IDENTITET pošiljaoca, samo pol (a to
-- ionako ništa ne otkriva -- Otkrij mu već pokazuje samo ljude njegovog
-- traženog pola). Ako veza nije obostrana, pošiljalac ne dobija nikakvu
-- potvrdu -- to je poenta "tajnosti".

create or replace function send_secret_spark(sender_id uuid, target_id uuid)
returns table (mutual boolean, match_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reciprocal boolean;
  v_a uuid;
  v_b uuid;
  v_match_id uuid;
  v_sender_gender text;
  v_target_gender text;
  v_sender_label text;
  v_target_adj text;
begin
  if auth.uid() is distinct from sender_id then
    raise exception 'Nije dozvoljeno.';
  end if;
  if sender_id = target_id then
    raise exception 'Ne možeš poslati signal sebi.';
  end if;

  insert into secret_sparks (from_profile_id, to_profile_id) values (sender_id, target_id)
  on conflict (from_profile_id, to_profile_id) do nothing;

  select exists(
    select 1 from secret_sparks where from_profile_id = target_id and to_profile_id = sender_id
  ) into v_reciprocal;

  if not v_reciprocal then
    select profiles.gender into v_sender_gender from profiles where profiles.id = sender_id;
    select profiles.gender into v_target_gender from profiles where profiles.id = target_id;

    v_sender_label := case v_sender_gender
      when 'musko' then 'Tajni Srbin'
      when 'zensko' then 'Tajna Srpkinja'
      else 'Tajna osoba'
    end;
    v_target_adj := case v_target_gender
      when 'musko' then 'zanimljiv'
      when 'zensko' then 'zanimljiva'
      else 'zanimljiv/a'
    end;

    insert into notifications (profile_id, type, title, body, data)
    values (
      target_id, 'secret_spark', '🤫 Tajni signal',
      v_sender_label || ' misli da si ' || v_target_adj || '.',
      '{}'::jsonb
    );

    return query select false, null::uuid;
    return;
  end if;

  v_a := least(sender_id, target_id);
  v_b := greatest(sender_id, target_id);

  insert into matches (profile_a_id, profile_b_id, source)
  values (v_a, v_b, 'secret_spark')
  on conflict (profile_a_id, profile_b_id) do nothing;

  select id into v_match_id from matches where profile_a_id = v_a and profile_b_id = v_b;

  insert into notifications (profile_id, type, title, body, data)
  values
    (sender_id, 'match', '🔥 Obostrana privlačnost!', 'Vas dvoje ste se izabrali tajno — otključan je match!', jsonb_build_object('matchId', v_match_id, 'otherId', target_id)),
    (target_id, 'match', '🔥 Obostrana privlačnost!', 'Vas dvoje ste se izabrali tajno — otključan je match!', jsonb_build_object('matchId', v_match_id, 'otherId', sender_id));

  return query select true, v_match_id;
end;
$$;

grant execute on function send_secret_spark(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- DUEL ("A ili B?")
-- ---------------------------------------------------------------------
-- Za MVP: svaki poziv pravi NOV duel sa dva nasumična kompatibilna
-- profila (koja imaju bar profilnu fotografiju). Deljenje istog duela
-- između više glasača (za agregatnu statistiku) je nadogradnja za kasnije
-- -- ovde je prosto i dovoljno za igru/personalizaciju (sekcija 11).

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
    and exists (select 1 from profile_photos pp where pp.profile_id = p.id and pp.is_primary = true)
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
    and exists (select 1 from profile_photos pp where pp.profile_id = p.id and pp.is_primary = true)
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
    (select pp.url from profile_photos pp where pp.profile_id = a.id and pp.is_primary = true limit 1),
    b.id, b.name, b.birth_date,
    (select pp.url from profile_photos pp where pp.profile_id = b.id and pp.is_primary = true limit 1)
  from profiles a, profiles b
  where a.id = v_a and b.id = v_b;
end;
$$;

grant execute on function create_duel(uuid, text) to authenticated;
