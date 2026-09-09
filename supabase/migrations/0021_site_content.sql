-- site_content -- tekst javne pocetne stranice (srpskomuvanje.vercel.app/,
-- pre prijave) sad je editabilan iz admina (/admin/pocetna), ne vise
-- hardkodovan u kodu. Fiksni skup kljuceva (definisan u
-- src/lib/siteContent.ts) -- admin menja VREDNOST postojecih kljuceva,
-- ne dodaje nove (izbegava se "prazna" stranica ako neko obrise red --
-- svaki kljuc uvek ima default u kodu kao fallback).
create table site_content (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create trigger site_content_set_updated_at before update on site_content
  for each row execute function set_updated_at();

alter table site_content enable row level security;

-- Pocetna stranica je javna (i za neulogovane posetioce) -- svako sme da cita.
create policy "svako vidi sadrzaj pocetne strane"
  on site_content for select using (true);

create policy "samo admin upisuje sadrzaj pocetne strane"
  on site_content for all using (is_admin()) with check (is_admin());

insert into site_content (key, value) values
  ('header_title', 'Srpskomuvanje'),
  ('header_login_label', 'Prijava'),
  ('hero_kicker', 'Srpskomuvanje'),
  ('hero_badge', 'Napravljeno za Srbe, od Srba'),
  ('hero_title_line1', 'Uđi.'),
  ('hero_title_line2', 'Vidi ko je tu.'),
  ('hero_subtitle', 'Srpska dating aplikacija u kojoj se stvarno nešto dešava — ne još jedan beskrajan spisak profila, već real-time upoznavanje, flert i radoznalost.'),
  ('hero_cta', 'Uđi besplatno'),
  ('hero_note', '18+ · Besplatno za početak'),
  ('feature_1_emoji', '🔥'),
  ('feature_1_title', 'Sada'),
  ('feature_1_text', 'Ne listaš profile u prazno. Vidiš šta se dešava upravo sada — ko je nov, ko te je lajkovao, ko je blizu.'),
  ('feature_2_emoji', '🔥'),
  ('feature_2_title', 'Muvaj'),
  ('feature_2_text', 'Swipe kartice sa fotografijama, kratkim video snimcima i personalizovanim Match Score-om.'),
  ('feature_3_emoji', '❤️'),
  ('feature_3_title', 'Match'),
  ('feature_3_text', 'Kad se međusobno lajkujete, otvara se razgovor u trenutku. Bez čekanja, bez nagađanja.'),
  ('feature_4_emoji', '😈'),
  ('feature_4_title', '18+ Muvanje'),
  ('feature_4_text', 'Za kad si direktan/na i znaš šta hoćeš. Vidiš ko je večeras raspoložen za krevet i pišeš im odmah, potpuno diskretno — odvojeno od običnog chata.'),
  ('feature_5_emoji', '⚔️'),
  ('feature_5_title', 'Duel'),
  ('feature_5_text', 'Dva profila, jedno pitanje — ''Ko ti je više tvoj tip?'' Zabavno, anonimno za obe strane, i uči algoritam tvoj ukus.'),
  ('feature_6_emoji', '🌙'),
  ('feature_6_title', 'Večeras'),
  ('feature_6_text', 'Noću se app menja — ''Ko je još budan?'' pokazuje ko je stvarno raspoložen za upoznavanje večeras.'),
  ('premium_title', 'Premium'),
  ('premium_text', 'Vidi ko te je lajkovao, dobij više tajnih iskri i duela, napredne filtere i profile boost. Besplatna verzija ostaje dovoljno dobra da uđeš i uživaš.'),
  ('bottom_cta_title', 'Spreman/na?'),
  ('bottom_cta_button', 'Uđi besplatno'),
  ('footer_age_note', 'Srpskomuvanje je namenjeno isključivo punoletnim osobama (18+).'),
  ('footer_contact_label', 'Prijava zloupotrebe / kontakt:');
