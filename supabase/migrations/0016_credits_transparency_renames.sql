-- 0016_credits_transparency_renames.sql
-- Runda 5 zahtevi:
--  1) Vise Credits paketa (do sada max 25) -- dodato 50 i 100.
--  2) Dobrodoslica: 3 besplatna Credits-a jednom po nalogu (transparentno
--     zabelezeno u credit_transactions kao 'signup_bonus') -- do sada nije
--     postojao NIKAKAV mehanizam besplatnih kredita, korisnik je pitao
--     "kada dobija gratis credits" pa je ovo iskren, stvaran odgovor.
--  3) muvaj_choose notifikacija: "u krevet" -> "u 18+ chat" (korisnicki
--     vidljiv tekst, "krevet" vec ne sme nigde da se pojavljuje).
-- ---------------------------------------------------------------------

-- (1) Credits paketi -- idempotentno (INSERT...WHERE NOT EXISTS, jer
-- credit_packages.id je gen_random_uuid() i ne postoji prirodan unique
-- kljuc za ON CONFLICT).
insert into credit_packages (name, credits, price_cents, position)
select '50 Iskrica', 50, 1499, 3
where not exists (select 1 from credit_packages where credits = 50);

insert into credit_packages (name, credits, price_cents, position)
select '100 Iskrica', 100, 2499, 4
where not exists (select 1 from credit_packages where credits = 100);

-- (2) Dobrodoslica -- prosireni reason check + funkcija za dodelu.
alter table credit_transactions drop constraint if exists credit_transactions_reason_check;
alter table credit_transactions add constraint credit_transactions_reason_check
  check (reason in ('purchase', 'unlock_spend', 'admin_adjustment', 'refund', 'signup_bonus'));

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

  -- Idempotentno -- ako je bonus vec dodeljen (npr. dupli poziv), ne
  -- dodaj ga opet.
  if exists (select 1 from credit_transactions where profile_id = viewer_id and reason = 'signup_bonus') then
    return;
  end if;

  insert into wallets (profile_id, balance_credits) values (viewer_id, 3)
  on conflict (profile_id) do update set balance_credits = wallets.balance_credits + 3;

  insert into credit_transactions (profile_id, amount, reason) values (viewer_id, 3, 'signup_bonus');
end;
$$;

grant execute on function grant_signup_bonus(uuid) to authenticated;

-- (3) muvaj_choose -- telo nepromenjenih kolona, bezbedno bez DROP-a.
-- JEDINA izmena u odnosu na 0015: tekst notifikacije "u krevet" -> "u 18+
-- chat" (korisnicki vidljiv tekst se vise nigde ne sme zvati "krevet").
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
        target_id, 'krevet_signal', '😈 Neko hoće s tobom u 18+ chat',
        'Otključaj da vidiš ko je to.', jsonb_build_object('fromHidden', true)
      );
  end if;

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
