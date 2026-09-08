-- chat_suggestions -- predlozi poruka ("Predlozi poruke" chip-ovi u chatu)
-- vise NISU hardkodovani u kodu -- admin ih sad menja/dodaje na
-- /admin/predlozi (izricit zahtev). Dve kategorije (normal = obican chat,
-- hot = 18+ Muvanje chat) x 3 faze razgovora (koliko poruka je vec
-- razmenjeno -- vidi pickIcebreakers u src/lib/icebreakers.ts).
create table chat_suggestions (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('normal', 'hot')),
  stage smallint not null check (stage in (1, 2, 3)),
  text text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index chat_suggestions_lookup_idx on chat_suggestions (category, stage, sort_order);

create trigger chat_suggestions_set_updated_at before update on chat_suggestions
  for each row execute function set_updated_at();

alter table chat_suggestions enable row level security;

create policy "svako ulogovan vidi aktivne predloge"
  on chat_suggestions for select using (auth.uid() is not null and is_active = true);

create policy "samo admin upravlja predlozima"
  on chat_suggestions for all using (is_admin()) with check (is_admin());

-- Seed -- prebaceni iz dosadasnjih hardkodovanih nizova (src/lib/icebreakers.ts)
-- tako da chat odmah posle migracije i dalje ima iste predloge, samo sad
-- editabilne kroz admin.
insert into chat_suggestions (category, stage, sort_order, text) values
  ('normal', 1, 0, 'Ej, šta radiš večeras? 😏'),
  ('normal', 1, 1, 'Koji je tvoj plan za vikend?'),
  ('normal', 1, 2, 'Sviđa mi se tvoja slika sa... reci mi više o tome 👀'),
  ('normal', 1, 3, 'Kafa ili piće — šta biraš prvo?'),
  ('normal', 1, 4, 'Koja ti je omiljena kafana u gradu?'),
  ('normal', 1, 5, 'Delujiš zanimljivo, moram da pitam — šta te najviše pali kod ljudi?'),
  ('normal', 1, 6, 'Da probamo nešto ludo — ti pitaš, ja odgovaram, pa obrnuto?'),
  ('normal', 2, 0, 'Ok, sad ozbiljno — kakav je tvoj idealan izlazak?'),
  ('normal', 2, 1, 'Da li si više za kafu popodne ili piće uveče?'),
  ('normal', 2, 2, 'Šta te je nasmejalo poslednje?'),
  ('normal', 2, 3, 'Iskreno, koja ti je najbolja osobina?'),
  ('normal', 2, 4, 'Kad bismo se sad videli, gde bi me poveo/la?'),
  ('normal', 2, 5, 'Nešto mi govori da si zabavan/na — dokaži 😏'),
  ('normal', 3, 0, 'Mislim da je vreme da se vidimo uživo — kad ti odgovara?'),
  ('normal', 3, 1, 'Radije bih te upoznao/la uživo nego kroz ekran, šta kažeš?'),
  ('normal', 3, 2, 'Predlažem kafu ovog vikenda — da ili ne?'),
  ('normal', 3, 3, 'Osećam dobru energiju — da zakažemo nešto?'),
  ('normal', 3, 4, 'Dosta pričanja, hajde da se stvarno vidimo.'),
  ('hot', 1, 0, 'Šta te večeras najviše pali? 😈'),
  ('hot', 1, 1, 'Da ne gubimo vreme na fore — šta tražiš večeras?'),
  ('hot', 1, 2, 'Igramo se? Prvo pitanje: šta ti je najveća slabost?'),
  ('hot', 1, 3, 'Delujiš opasno zanimljivo... nastavi 😏'),
  ('hot', 1, 4, 'Piće kod tebe ili kod mene? 🍸'),
  ('hot', 1, 5, 'Reci mi nešto što bi me iznenadilo.'),
  ('hot', 2, 0, 'Sve si zanimljiviji/a iz minuta u minut... šta bi uradio/la da sam tu?'),
  ('hot', 2, 1, 'Kakvo je tvoje raspoloženje večeras — divlje ili opušteno? 😏'),
  ('hot', 2, 2, 'Da igramo igru — ja postavim pitanje, ti odgovoriš iskreno, bez okolišanja.'),
  ('hot', 2, 3, 'Zvučiš kao neko ko zna šta hoće. Šta hoćeš od večeras?'),
  ('hot', 2, 4, 'Ok, dosta uvoda — šta bi prvo uradio/la kad bismo se videli?'),
  ('hot', 2, 5, 'Gde još nisi probao/la nešto novo, a hteo/la bi? 😏'),
  ('hot', 3, 0, 'Pošalji mi jednu sliku da vidim šta propuštam 😏📸'),
  ('hot', 3, 1, 'Slika vredi hiljadu reči... pokaži mi 😈'),
  ('hot', 3, 2, 'Da vidimo se uživo ili prvo malo fotki za predukus? 📸'),
  ('hot', 3, 3, 'Dosta pričanja — pokaži mi nešto posebno 🔥'),
  ('hot', 3, 4, 'Kad ćemo prestati da pričamo i preći na nešto zanimljivije? 😏'),
  ('hot', 3, 5, 'Radoznao/la sam — imaš nešto da mi pokažeš? 👀'),
  ('hot', 3, 6, 'Koje ti je omiljeno mesto za spontane stvari? 😏'),
  ('hot', 3, 7, 'Hoćemo da igramo sexy izazov skidanja? 😈');
