-- 0017_moji_izbori_krevet_fix.sql
-- "Moji izbori" nije prikazivao "18+ chat" izbore (samo "Upoznavanje") --
-- uzrok: krevet_signals ima namerno kolonsko REVOKE na from_profile_id za
-- CEO 'authenticated' role (migracija 0014, "primalac ne sme da vidi ko je
-- poslao dok ne plati"). To REVOKE se odnosi na SVAKOG, ukljucujuci i
-- POSILJAOCA koji pokusava da procita SVOJE sopstvene poslate signale --
-- kolonske privilegije u Postgresu nisu ograničene po redu (row), pa
-- obican klijentski upit "where from_profile_id = ja" ne moze ni da
-- EVALUIRA taj filter, bez obzira sto RLS red-politika to inace dozvoljava.
--
-- Resenje: SECURITY DEFINER funkcija (radi kao vlasnik, zaobilazi kolonsko
-- REVOKE) koja vraca SAMO ono sto posiljalac vec zna (kome je poslao, kad) --
-- ovo NIJE "otkrivanje identiteta" (to ostaje zasticeno za PRIMAOCA), samo
-- dozvoljava posiljaocu da vidi svoju sopstvenu listu.
-- ---------------------------------------------------------------------

create or replace function get_my_sent_krevet_targets(viewer_id uuid)
returns table (to_profile_id uuid, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from viewer_id then
    raise exception 'Nije dozvoljeno.';
  end if;

  return query
  select k.to_profile_id, k.created_at
  from krevet_signals k
  where k.from_profile_id = viewer_id
  order by k.created_at desc;
end;
$$;

grant execute on function get_my_sent_krevet_targets(uuid) to authenticated;
