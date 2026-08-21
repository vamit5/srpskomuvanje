-- FAZA 9 (deo): Admin panel + Report/Block iz chata.
-- Pokreni u Supabase SQL Editoru.

-- ---------------------------------------------------------------------
-- BEZBEDNOSNA RUPA IZ FAZE 1: admin_users nikad nije imao RLS uključen!
-- To znači da je do sada svako ko zna API endpoint mogao da čita (ili
-- čak upiše) tu tabelu direktno. Ispravljamo odmah.
-- ---------------------------------------------------------------------
alter table admin_users enable row level security;

drop policy if exists "admin vidi listu admina" on admin_users;
create policy "admin vidi listu admina"
  on admin_users for select
  using (is_admin());

-- Namerno NEMA insert/update/delete politike: dodavanje admina ide
-- isključivo ručno kroz SQL Editor (kao vlasnik projekta), nikad kroz
-- API -- niko (ni postojeći admin) ne sme da doda novog admina "iz
-- aplikacije".

-- Admin sme da menja BILO ČIJI profil (npr. da sakrije neprikladan profil
-- iz Otkrij feed-a postavljanjem is_discoverable = false). Obični korisnici
-- i dalje mogu da menjaju samo svoj (postojeća politika iz schema.sql).
drop policy if exists "admin moze da menja bilo koji profil" on profiles;
create policy "admin moze da menja bilo koji profil"
  on profiles for update
  using (is_admin());

-- ---------------------------------------------------------------------
-- Postavi SEBE kao admina. Zameni email ispod svojim test nalogom
-- (ili bilo kojim nalogom koji ćeš koristiti za /admin).
-- ---------------------------------------------------------------------
insert into admin_users (profile_id, role)
select id, 'owner' from auth.users where email = 'kukicborislav+srpskomuvanjetest@gmail.com'
on conflict (profile_id) do nothing;
