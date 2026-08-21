-- FAZA 2: Storage konfiguracija za bucket-e "photos", "videos", "verification-selfies".
-- Pokreni u Supabase SQL Editoru NAKON što ručno napraviš sva tri bucket-a u
-- Storage tabu (imena moraju biti tačno ovako).
--
-- Arhitektura: korisnik uploaduje DIREKTNO iz browsera u Supabase Storage
-- (ne preko našeg servera) -- brže je, jeftinije i izbegava limite veličine
-- requesta koje imaju serverless platforme (npr. Vercel). Sigurnost je u
-- ovim RLS politikama: svako sme da čita "photos"/"videos" (to su javne
-- profilne slike), ali sme da piše/briše SAMO unutar sopstvenog foldera
-- (putanja mora da počinje sa <user_id>/...). "verification-selfies" je
-- privatan -- vidi ga samo vlasnik i admin.

-- Javni bucket-i + ograničenja veličine/tipa fajla na nivou Storage servera
-- (dodatna zaštita pored provere u kodu -- korisnik ne može da zaobiđe ovo
-- ni direktnim pozivom Storage API-ja).
update storage.buckets set
  public = true,
  file_size_limit = 8388608, -- 8MB (slike su već kompresovane na klijentu pre uploada)
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'photos';

update storage.buckets set
  public = true,
  file_size_limit = 26214400, -- 25MB (kratki 10-15s video klipovi)
  allowed_mime_types = array['video/mp4', 'video/webm', 'video/quicktime', 'image/webp']
where id = 'videos';

update storage.buckets set
  public = false,
  file_size_limit = 8388608,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'verification-selfies';

-- PHOTOS
drop policy if exists "javno citanje fotografija" on storage.objects;
create policy "javno citanje fotografija"
  on storage.objects for select
  using (bucket_id = 'photos');

drop policy if exists "korisnik upload-uje samo u svoj folder (photos)" on storage.objects;
create policy "korisnik upload-uje samo u svoj folder (photos)"
  on storage.objects for insert
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "korisnik menja samo svoje fajlove (photos)" on storage.objects;
create policy "korisnik menja samo svoje fajlove (photos)"
  on storage.objects for update
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "korisnik brise samo svoje fajlove (photos)" on storage.objects;
create policy "korisnik brise samo svoje fajlove (photos)"
  on storage.objects for delete
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- VIDEOS (identičan obrazac kao photos)
drop policy if exists "javno citanje videa" on storage.objects;
create policy "javno citanje videa"
  on storage.objects for select
  using (bucket_id = 'videos');

drop policy if exists "korisnik upload-uje samo u svoj folder (videos)" on storage.objects;
create policy "korisnik upload-uje samo u svoj folder (videos)"
  on storage.objects for insert
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "korisnik menja samo svoje fajlove (videos)" on storage.objects;
create policy "korisnik menja samo svoje fajlove (videos)"
  on storage.objects for update
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "korisnik brise samo svoje fajlove (videos)" on storage.objects;
create policy "korisnik brise samo svoje fajlove (videos)"
  on storage.objects for delete
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);

-- VERIFICATION SELFIES (privatno -- samo vlasnik i admin mogu da čitaju)
drop policy if exists "vlasnik i admin citaju verifikacione selfije" on storage.objects;
create policy "vlasnik i admin citaju verifikacione selfije"
  on storage.objects for select
  using (
    bucket_id = 'verification-selfies'
    and ((storage.foldername(name))[1] = auth.uid()::text or is_admin())
  );

drop policy if exists "korisnik upload-uje samo svoj verifikacioni selfi" on storage.objects;
create policy "korisnik upload-uje samo svoj verifikacioni selfi"
  on storage.objects for insert
  with check (bucket_id = 'verification-selfies' and (storage.foldername(name))[1] = auth.uid()::text);
