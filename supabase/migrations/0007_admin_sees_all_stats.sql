-- FAZA 9 (deo 2): admin statistika je bila pogrešna -- brojala je samo
-- matcheve/poruke u kojima admin LIČNO učestvuje (jer RLS ograničava sve
-- na "moje", a admin nije imao izuzetak za ove dve tabele). Ispravka:
-- dodaj admin-only SELECT politiku na matches i messages, isto kao što
-- profiles i reports već imaju.
-- Pokreni u Supabase SQL Editoru.

drop policy if exists "admin vidi sve matcheve" on matches;
create policy "admin vidi sve matcheve"
  on matches for select
  using (is_admin());

drop policy if exists "admin vidi sve poruke" on messages;
create policy "admin vidi sve poruke"
  on messages for select
  using (is_admin());
