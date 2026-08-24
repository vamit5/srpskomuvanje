-- =====================================================================
-- SRPSKOMUVANJE — Supabase (Postgres) šema, FAZA 1
-- =====================================================================
-- Kako da primeniš ovo:
--   1) Napravi projekat na https://supabase.com (besplatan tier je dovoljan za start).
--   2) Otvori SQL Editor u Supabase dashboard-u.
--   3) Nalepi ceo ovaj fajl i pokreni (Run).
--   4) Storage bucket-e ("photos", "videos", "verification-selfies") napravi
--      ručno u Storage tabu -- vidi napomenu na dnu fajla.
--
-- Napomene o dizajnu (bitno da razumeš odluke):
-- - Ne pravimo posebnu "users" tabelu -- Supabase Auth već ima ugrađenu
--   auth.users. "profiles" je 1:1 produžetak sa svim dating podacima.
-- - Svaka tabela ima Row Level Security (RLS) UKLJUČEN. To znači: čak i ako
--   neko dobije anon/public API ključ (koji je namerno javan u frontend kodu),
--   Postgres sam po sebi sprečava čitanje/pisanje tuđih privatnih podataka.
--   Admin panel i pozadinski poslovi (cron, moderacija) koriste service_role
--   ključ koji zaobilazi RLS -- taj ključ NIKAD ne sme ući u frontend kod.
-- - Tačna lokacija (lat/lng) se čuva, ali se NIKAD ne izlaže drugim
--   korisnicima direktno -- udaljenost se računa na serveru (RPC funkcija
--   distance_km) i klijentu se šalje samo zaokružen broj kilometara.
-- - Nazivi tabela prate listu iz specifikacije (sekcija 39). Par tabela
--   (push_subscriptions, admin_users, feature_flags, discovery_scoring_config)
--   je dodato jer su neophodna infrastruktura za funkcije koje spec traži
--   (push notifikacije, admin panel, podesiv algoritam) a nisu bile
--   eksplicitno nabrojane.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Zajedničke helper funkcije
-- ---------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Haversine udaljenost u kilometrima (dovoljno precizno za "3 km od tebe",
-- ne zahteva PostGIS ekstenziju).
create or replace function distance_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision as $$
  select 6371 * acos(
    least(1.0, greatest(-1.0,
      cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lng2) - radians(lng1)) +
      sin(radians(lat1)) * sin(radians(lat2))
    ))
  );
$$ language sql immutable strict;

-- ---------------------------------------------------------------------
-- ADMIN
-- ---------------------------------------------------------------------

create table admin_users (
  profile_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'moderator' check (role in ('moderator', 'admin', 'owner')),
  created_at timestamptz not null default now()
);

create or replace function is_admin()
returns boolean as $$
  select exists (select 1 from admin_users where profile_id = auth.uid());
$$ language sql stable security definer set search_path = public;

alter table admin_users enable row level security;

create policy "admin vidi listu admina"
  on admin_users for select
  using (is_admin());

-- Namerno NEMA insert/update/delete politike: dodavanje admina ide
-- isključivo ručno kroz SQL Editor (vlasnik projekta), nikad kroz API.

-- ---------------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  birth_date date not null,
  gender text not null check (gender in ('musko', 'zensko', 'drugo')),
  city text,
  lat double precision,
  lng double precision,
  location_updated_at timestamptz,
  bio text,
  height_cm smallint,
  looking_for text, -- šta traži: 'vezu', 'druzenje', 'flert', 'nije siguran_na' ...
  languages text[] default '{}',
  interests text[] default '{}',
  is_verified boolean not null default false,
  is_18_confirmed boolean not null default false,
  onboarding_completed_at timestamptz,
  profile_completion_score smallint not null default 0 check (profile_completion_score between 0 and 100),

  -- Vidljivost / privatnost (sekcija 46)
  show_online_status boolean not null default true,
  show_distance boolean not null default true,
  show_age boolean not null default true,
  is_discoverable boolean not null default true,

  -- Hot Mode (sekcija 13) + "Večeras" (sekcija 15) -- isti mehanizam,
  -- "Večeras" je samo Hot Mode sa expires_at postavljenim na 04:00.
  hot_mode_enabled boolean not null default false,
  hot_mode_vibes text[] default '{}', -- podskup: flert, vrelo, veceras, pice, izlazak
  hot_mode_expires_at timestamptz,

  last_active_at timestamptz not null default now(),
  activity_score real not null default 0,
  profile_quality_score real not null default 0,

  deleted_at timestamptz, -- soft delete (obrisan nalog), radi GDPR-friendly brisanja
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at before update on profiles
  for each row execute function set_updated_at();

create index profiles_discoverable_idx on profiles (is_discoverable) where deleted_at is null;
create index profiles_hot_mode_idx on profiles (hot_mode_enabled) where hot_mode_enabled = true;

alter table profiles enable row level security;

create policy "javni profili su vidljivi svima ko je ulogovan"
  on profiles for select
  using (auth.uid() is not null and deleted_at is null);

create policy "korisnik menja samo svoj profil"
  on profiles for update
  using (auth.uid() = id);

create policy "korisnik pravi samo svoj profil"
  on profiles for insert
  with check (auth.uid() = id);

create policy "admin vidi sve profile"
  on profiles for select
  using (is_admin());

create policy "admin moze da menja bilo koji profil"
  on profiles for update
  using (is_admin());

-- Tačna GPS lokacija se NIKAD ne izlaže preko API-ja, ni sopstvenog reda --
-- jedini put do "koliko si daleko" je distance_km() unutar SECURITY DEFINER
-- funkcija (nearby_count, discover_profiles, create_duel), koje rade kao
-- vlasnik i zato zaobilaze ovo ograničenje.
revoke select (lat, lng) on profiles from authenticated, anon;

-- ---------------------------------------------------------------------
-- PROFILE PHOTOS / VIDEOS
-- ---------------------------------------------------------------------

create table profile_photos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  url text not null,
  thumbnail_url text,
  storage_path text, -- putanja u Storage bucket-u "photos" (za brisanje fajla)
  thumbnail_path text,
  position smallint not null default 0,
  is_primary boolean not null default false,
  width smallint,
  height smallint,
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create index profile_photos_profile_idx on profile_photos (profile_id, position);

alter table profile_photos enable row level security;

create policy "fotografije su vidljive svima ko je ulogovan"
  on profile_photos for select using (auth.uid() is not null);

create policy "korisnik upravlja svojim fotografijama"
  on profile_photos for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- Admin mora moći da odobri/odbije granične slučajeve (NSFW moderacija, FAZA 9).
create policy "admin upravlja moderacijom fotografija"
  on profile_photos for update using (is_admin());

create table profile_videos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  url text not null,
  thumbnail_url text,
  storage_path text, -- putanja u Storage bucket-u "videos" (za brisanje fajla)
  thumbnail_path text,
  duration_seconds smallint not null check (duration_seconds <= 15),
  position smallint not null default 0,
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create index profile_videos_profile_idx on profile_videos (profile_id, position);

alter table profile_videos enable row level security;

create policy "video snimci su vidljivi svima ko je ulogovan"
  on profile_videos for select using (auth.uid() is not null);

create policy "korisnik upravlja svojim video snimcima"
  on profile_videos for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create policy "admin upravlja moderacijom videa"
  on profile_videos for update using (is_admin());

-- ---------------------------------------------------------------------
-- PREFERENCES
-- ---------------------------------------------------------------------

create table preferences (
  profile_id uuid primary key references profiles(id) on delete cascade,
  interested_in text[] not null default '{}', -- 'musko' | 'zensko' | 'drugo'
  age_min smallint not null default 18 check (age_min >= 18),
  age_max smallint not null default 99,
  max_distance_km smallint not null default 50,
  updated_at timestamptz not null default now()
);

create trigger preferences_set_updated_at before update on preferences
  for each row execute function set_updated_at();

alter table preferences enable row level security;

create policy "korisnik upravlja samo svojim preferencama"
  on preferences for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- ---------------------------------------------------------------------
-- LIKES / SUPER LIKES / SECRET SPARKS
-- ---------------------------------------------------------------------

create table likes (
  id uuid primary key default gen_random_uuid(),
  from_profile_id uuid not null references profiles(id) on delete cascade,
  to_profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (from_profile_id, to_profile_id),
  check (from_profile_id <> to_profile_id)
);

create index likes_to_profile_idx on likes (to_profile_id);

alter table likes enable row level security;

create policy "korisnik vidi lajkove koje je poslao ili primio"
  on likes for select
  using (auth.uid() = from_profile_id or auth.uid() = to_profile_id);

create policy "korisnik salje lajk samo u svoje ime"
  on likes for insert
  with check (auth.uid() = from_profile_id);

create policy "korisnik brise samo svoj lajk"
  on likes for delete
  using (auth.uid() = from_profile_id);

create table super_likes (
  id uuid primary key default gen_random_uuid(),
  from_profile_id uuid not null references profiles(id) on delete cascade,
  to_profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (from_profile_id, to_profile_id),
  check (from_profile_id <> to_profile_id)
);

create index super_likes_to_profile_idx on super_likes (to_profile_id);

alter table super_likes enable row level security;

create policy "korisnik vidi super lajkove koje je poslao ili primio"
  on super_likes for select
  using (auth.uid() = from_profile_id or auth.uid() = to_profile_id);

create policy "korisnik salje super lajk samo u svoje ime"
  on super_likes for insert
  with check (auth.uid() = from_profile_id);

create table secret_sparks (
  id uuid primary key default gen_random_uuid(),
  from_profile_id uuid not null references profiles(id) on delete cascade,
  to_profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (from_profile_id, to_profile_id),
  check (from_profile_id <> to_profile_id)
);

create index secret_sparks_to_profile_idx on secret_sparks (to_profile_id);

alter table secret_sparks enable row level security;

-- Bitno: primalac NE SME videti ko mu je poslao tajnu iskru dok i sam ne
-- pošalje iskru toj osobi (inače nije "tajna"). Zato SELECT politika
-- otkriva red samo pošiljaocu, ili primaocu AKO postoji obostrana iskra.
create policy "posiljalac vidi svoju iskru"
  on secret_sparks for select
  using (auth.uid() = from_profile_id);

create policy "primalac vidi iskru samo ako je obostrana"
  on secret_sparks for select
  using (
    auth.uid() = to_profile_id
    and exists (
      select 1 from secret_sparks s2
      where s2.from_profile_id = secret_sparks.to_profile_id
        and s2.to_profile_id = secret_sparks.from_profile_id
    )
  );

create policy "korisnik salje iskru samo u svoje ime"
  on secret_sparks for insert
  with check (auth.uid() = from_profile_id);

-- PASSES ("preskoči") -- nije u originalnoj listi tabela iz specifikacije,
-- ali bez ovoga bi se isti profil ponovo i ponovo pojavljivao u Otkrij
-- feed-u posle svakog "X" (sekcija 26 -- Discovery algoritam).
create table passes (
  id uuid primary key default gen_random_uuid(),
  from_profile_id uuid not null references profiles(id) on delete cascade,
  to_profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (from_profile_id, to_profile_id),
  check (from_profile_id <> to_profile_id)
);

alter table passes enable row level security;

create policy "korisnik vidi svoje passeve"
  on passes for select using (auth.uid() = from_profile_id);

create policy "korisnik pravi pass samo u svoje ime"
  on passes for insert with check (auth.uid() = from_profile_id);

-- ---------------------------------------------------------------------
-- MATCHES / MESSAGES / REACTIONS
-- ---------------------------------------------------------------------

create table matches (
  id uuid primary key default gen_random_uuid(),
  profile_a_id uuid not null references profiles(id) on delete cascade,
  profile_b_id uuid not null references profiles(id) on delete cascade,
  source text not null default 'like' check (source in ('like', 'secret_spark', 'duel')),
  matched_at timestamptz not null default now(),
  unmatched_at timestamptz,
  unmatched_by uuid references profiles(id),
  check (profile_a_id < profile_b_id), -- konzistentan redosled, sprečava duplikate
  unique (profile_a_id, profile_b_id)
);

create index matches_profile_a_idx on matches (profile_a_id);
create index matches_profile_b_idx on matches (profile_b_id);

alter table matches enable row level security;

create policy "korisnik vidi samo svoje matcheve"
  on matches for select
  using (auth.uid() = profile_a_id or auth.uid() = profile_b_id);

create policy "korisnik moze da unmatch-uje samo svoj match"
  on matches for update
  using (auth.uid() = profile_a_id or auth.uid() = profile_b_id);

create policy "admin vidi sve matcheve"
  on matches for select
  using (is_admin());

create table messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  content text,
  image_url text,
  night_content_id uuid, -- fk se dodaje niže (na night_flirting_content, definisana kasnije u fajlu)
  created_at timestamptz not null default now(),
  read_at timestamptz,
  deleted_at timestamptz,
  check (content is not null or image_url is not null or night_content_id is not null)
);

create index messages_match_idx on messages (match_id, created_at desc);

alter table messages enable row level security;

create policy "korisnik vidi poruke samo iz svojih matcheva"
  on messages for select
  using (
    exists (
      select 1 from matches m
      where m.id = messages.match_id
        and (m.profile_a_id = auth.uid() or m.profile_b_id = auth.uid())
    )
  );

create policy "admin vidi sve poruke"
  on messages for select
  using (is_admin());

create policy "korisnik salje poruku samo u svoj match, u svoje ime"
  on messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from matches m
      where m.id = messages.match_id
        and m.unmatched_at is null
        and (m.profile_a_id = auth.uid() or m.profile_b_id = auth.uid())
    )
  );

create policy "korisnik oznacava kao procitano / soft-delete svoju poruku"
  on messages for update
  using (
    exists (
      select 1 from matches m
      where m.id = messages.match_id
        and (m.profile_a_id = auth.uid() or m.profile_b_id = auth.uid())
    )
  );

-- Real-time: poruke stižu uživo objema stranama (FAZA 4).
alter publication supabase_realtime add table messages;
alter table messages replica identity full;

create table message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, profile_id, emoji)
);

alter table message_reactions enable row level security;

create policy "korisnik vidi reakcije u svojim match porukama"
  on message_reactions for select
  using (
    exists (
      select 1 from messages msg
      join matches m on m.id = msg.match_id
      where msg.id = message_reactions.message_id
        and (m.profile_a_id = auth.uid() or m.profile_b_id = auth.uid())
    )
  );

create policy "korisnik reaguje u svoje ime"
  on message_reactions for insert
  with check (profile_id = auth.uid());

-- ---------------------------------------------------------------------
-- DUEL ("A ili B?")
-- ---------------------------------------------------------------------

create table duels (
  id uuid primary key default gen_random_uuid(),
  prompt text not null, -- npr. 'privlacniji' | 'pre_izaci' | 'tvoj_tip'
  profile_a_id uuid not null references profiles(id) on delete cascade,
  profile_b_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (profile_a_id <> profile_b_id)
);

alter table duels enable row level security;

create policy "svaki ulogovan korisnik moze da vidi duel parove"
  on duels for select using (auth.uid() is not null);

create table duel_votes (
  id uuid primary key default gen_random_uuid(),
  duel_id uuid not null references duels(id) on delete cascade,
  voter_profile_id uuid not null references profiles(id) on delete cascade,
  voted_for_profile_id uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  unique (duel_id, voter_profile_id)
);

alter table duel_votes enable row level security;

create policy "korisnik vidi samo svoje glasove"
  on duel_votes for select using (auth.uid() = voter_profile_id);

create policy "korisnik glasa samo u svoje ime"
  on duel_votes for insert with check (auth.uid() = voter_profile_id);

-- ---------------------------------------------------------------------
-- HOT MODE istorija + NOĆNI MOD konfiguracija + EVENTI ("Vrelo petak")
-- ---------------------------------------------------------------------

-- Trenutno stanje Hot Mode-a živi direktno na profiles (hot_mode_enabled,
-- hot_mode_vibes, hot_mode_expires_at) jer se čita na svakom Discovery
-- upitu -- ne isplati se JOIN na posebnu tabelu za nešto što se menja
-- često i čita još češće. Ova tabela je istorijski log (analytics + audit).
create table hot_modes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  vibes text[] not null default '{}',
  activated_at timestamptz not null default now(),
  deactivated_at timestamptz
);

create index hot_modes_profile_idx on hot_modes (profile_id, activated_at desc);

alter table hot_modes enable row level security;

create policy "korisnik vidi svoju hot mode istoriju"
  on hot_modes for select using (auth.uid() = profile_id);

create policy "korisnik upisuje svoju hot mode istoriju"
  on hot_modes for insert with check (auth.uid() = profile_id);

-- Globalna, adminom podesiva konfiguracija noćnog moda (sekcija 14: "npr 22-04").
create table night_modes (
  id smallint primary key default 1 check (id = 1), -- singleton red
  starts_at time not null default '22:00',
  ends_at time not null default '04:00',
  is_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into night_modes (id) values (1);

create trigger night_modes_set_updated_at before update on night_modes
  for each row execute function set_updated_at();

alter table night_modes enable row level security;

create policy "svako ulogovan cita nocni mod konfiguraciju"
  on night_modes for select using (auth.uid() is not null);

create policy "samo admin menja nocni mod konfiguraciju"
  on night_modes for update using (is_admin());

create table events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  kind text not null default 'custom',
  city text, -- null = svi gradovi
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default true,
  created_by uuid references admin_users(profile_id),
  created_at timestamptz not null default now()
);

alter table events enable row level security;

create policy "svako ulogovan vidi aktivne evente"
  on events for select using (auth.uid() is not null);

create policy "samo admin upravlja eventima"
  on events for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------
-- SUBSCRIPTIONS / BOOSTS (monetizacija, sekcije 27-28)
-- ---------------------------------------------------------------------

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  tier text not null default 'premium' check (tier in ('premium', 'vip')),
  status text not null default 'active' check (status in ('active', 'canceled', 'expired', 'trialing')),
  provider text not null default 'stripe',
  provider_subscription_id text,
  stripe_customer_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id)
);

create index subscriptions_profile_idx on subscriptions (profile_id);
create index subscriptions_stripe_customer_idx on subscriptions (stripe_customer_id);

create trigger subscriptions_set_updated_at before update on subscriptions
  for each row execute function set_updated_at();

alter table subscriptions enable row level security;

create policy "korisnik vidi svoju pretplatu"
  on subscriptions for select using (auth.uid() = profile_id);

create policy "samo admin/servis upisuje pretplate"
  on subscriptions for all using (is_admin()) with check (is_admin());

create table boosts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  source text not null default 'purchase' check (source in ('purchase', 'premium_monthly')),
  created_at timestamptz not null default now()
);

create index boosts_profile_idx on boosts (profile_id, ends_at);

alter table boosts enable row level security;

create policy "korisnik vidi svoje boostove"
  on boosts for select using (auth.uid() = profile_id);

create policy "samo admin/servis upisuje boostove"
  on boosts for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------
-- NOTIFIKACIJE
-- ---------------------------------------------------------------------

create table notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  type text not null, -- 'match' | 'like' | 'spark_mutual' | 'message' | 'nearby' | 'hot_mode' | 'event' ...
  title text not null,
  body text,
  data jsonb not null default '{}',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_profile_idx on notifications (profile_id, created_at desc);

alter table notifications enable row level security;

create policy "korisnik vidi samo svoje notifikacije"
  on notifications for select using (auth.uid() = profile_id);

create policy "korisnik oznacava svoje notifikacije kao procitane"
  on notifications for update using (auth.uid() = profile_id);

create table notification_preferences (
  profile_id uuid primary key references profiles(id) on delete cascade,
  matches boolean not null default true,
  likes boolean not null default true,
  messages boolean not null default true,
  nearby boolean not null default true,
  hot_mode boolean not null default true,
  events boolean not null default true,
  marketing boolean not null default false,
  updated_at timestamptz not null default now()
);

create trigger notification_preferences_set_updated_at before update on notification_preferences
  for each row execute function set_updated_at();

alter table notification_preferences enable row level security;

create policy "korisnik upravlja svojim notification podesavanjima"
  on notification_preferences for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- Web Push pretplate (nije bilo eksplicitno u spisku tabela, ali je
-- neophodna infrastruktura za PWA push notifikacije -- sekcija 22/37).
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

create policy "korisnik upravlja svojim push pretplatama"
  on push_subscriptions for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- ---------------------------------------------------------------------
-- SAFETY: REPORTS / BLOCKS / VERIFICATION
-- ---------------------------------------------------------------------

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles(id),
  reported_profile_id uuid not null references profiles(id),
  reason text not null check (reason in (
    'lazan_profil', 'neprikladan_sadrzaj', 'uznemiravanje', 'spam',
    'prevara', 'maloletna_osoba', 'nasilje_pretnje', 'drugo'
  )),
  details text,
  related_message_id uuid references messages(id),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  reviewed_by uuid references admin_users(profile_id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index reports_reported_idx on reports (reported_profile_id);
create index reports_status_idx on reports (status);

alter table reports enable row level security;

create policy "korisnik vidi svoje prijave"
  on reports for select using (auth.uid() = reporter_id);

create policy "korisnik prijavljuje u svoje ime"
  on reports for insert with check (auth.uid() = reporter_id);

create policy "admin vidi i menja sve prijave"
  on reports for all using (is_admin()) with check (is_admin());

create table blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index blocks_blocker_idx on blocks (blocker_id);

alter table blocks enable row level security;

create policy "korisnik upravlja svojom listom blokiranih"
  on blocks for all
  using (auth.uid() = blocker_id)
  with check (auth.uid() = blocker_id);

create table verification (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  selfie_url text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references admin_users(profile_id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create index verification_profile_idx on verification (profile_id, created_at desc);

alter table verification enable row level security;

create policy "korisnik vidi svoje verifikacije"
  on verification for select using (auth.uid() = profile_id);

create policy "korisnik salje svoju verifikaciju"
  on verification for insert with check (auth.uid() = profile_id);

create policy "admin upravlja svim verifikacijama"
  on verification for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------
-- ANALYTICS / SCORING
-- ---------------------------------------------------------------------

create table activity_events (
  id bigint generated always as identity primary key,
  profile_id uuid references profiles(id) on delete set null,
  event_name text not null, -- signup, profile_completed, first_like, first_match, ...
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index activity_events_profile_idx on activity_events (profile_id, created_at desc);
create index activity_events_name_idx on activity_events (event_name, created_at desc);

alter table activity_events enable row level security;

create policy "korisnik upisuje svoje aktivnosti"
  on activity_events for insert with check (auth.uid() = profile_id);

create policy "admin cita sve aktivnosti"
  on activity_events for select using (is_admin());

-- Keširan, personalizovan "Personal Match Score" po paru (gledalac -> profil).
-- Ovo je algoritamska procena (sekcija 10) -- UI je uvek mora prikazati kao
-- procenu aplikacije, nikad kao naučnu činjenicu.
create table user_scores (
  viewer_id uuid not null references profiles(id) on delete cascade,
  target_id uuid not null references profiles(id) on delete cascade,
  compatibility_score real not null check (compatibility_score between 0 and 100),
  computed_at timestamptz not null default now(),
  primary key (viewer_id, target_id)
);

alter table user_scores enable row level security;

create policy "korisnik vidi samo svoje personalizovane skorove"
  on user_scores for select using (auth.uid() = viewer_id);

-- ---------------------------------------------------------------------
-- ADMIN ALATI: feature flags + podesivi weightovi discovery algoritma
-- ---------------------------------------------------------------------

create table feature_flags (
  key text primary key,
  is_enabled boolean not null default false,
  description text,
  updated_at timestamptz not null default now()
);

create trigger feature_flags_set_updated_at before update on feature_flags
  for each row execute function set_updated_at();

alter table feature_flags enable row level security;

create policy "svako ulogovan cita feature flagove"
  on feature_flags for select using (auth.uid() is not null);

create policy "samo admin menja feature flagove"
  on feature_flags for all using (is_admin()) with check (is_admin());

create table discovery_scoring_config (
  key text primary key, -- npr. 'weight_distance', 'weight_freshness', 'weight_activity'
  weight real not null default 1,
  description text,
  updated_at timestamptz not null default now()
);

create trigger discovery_scoring_config_set_updated_at before update on discovery_scoring_config
  for each row execute function set_updated_at();

insert into discovery_scoring_config (key, weight, description) values
  ('compatibility', 3.0, 'Poklapanje interesovanja/preferenci (AI personal match score)'),
  ('activity', 1.5, 'Koliko je profil skoro bio aktivan'),
  ('freshness', 1.2, 'Noviji profili dobijaju blagi bonus'),
  ('profile_quality', 1.0, 'Popunjenost i kvalitet profila'),
  ('distance', 2.0, 'Blizina lokacije'),
  ('mutual_interest_probability', 2.5, 'Procena verovatnoće da će oboje lajkovati');

alter table discovery_scoring_config enable row level security;

create policy "svako ulogovan cita scoring config"
  on discovery_scoring_config for select using (auth.uid() is not null);

create policy "samo admin menja scoring config"
  on discovery_scoring_config for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------
-- DISCOVERY ALGORITAM (sekcija 26) -- vidi supabase/migrations/0003_discovery.sql
-- za potpun komentar. SECURITY DEFINER je namerno: funkcija mora da
-- pročita tuđe preferences (RLS ih inače skriva) da bi proverila
-- obostranu kompatibilnost pola. Interna provera auth.uid() = viewer_id
-- sprečava da neko pozove tuđi feed.
-- ---------------------------------------------------------------------

create or replace function discover_profiles(viewer_id uuid, result_limit int default 20)
returns table (
  id uuid,
  name text,
  birth_date date,
  city text,
  bio text,
  interests text[],
  is_verified boolean,
  hot_mode_enabled boolean,
  primary_photo_url text,
  score numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gender text;
  v_interests text[];
  v_lat double precision;
  v_lng double precision;
  v_interested_in text[];
  v_age_min smallint;
  v_age_max smallint;
  w_compatibility numeric;
  w_activity numeric;
  w_freshness numeric;
  w_profile_quality numeric;
  w_distance numeric;
begin
  if auth.uid() is distinct from viewer_id then
    raise exception 'Nije dozvoljeno da učitaš tuđi Otkrij feed.';
  end if;

  -- Napomena: kolone MORAJU biti kvalifikovane sa "profiles." ovde -- inače
  -- Postgres ne zna da li "interests"/"id" znače kolonu tabele ili
  -- OUT parametar iz RETURNS TABLE(...) sa istim imenom (greška 42702).
  select profiles.gender, profiles.interests, profiles.lat, profiles.lng
    into v_gender, v_interests, v_lat, v_lng
  from profiles where profiles.id = viewer_id;

  select interested_in, age_min, age_max
    into v_interested_in, v_age_min, v_age_max
  from preferences where profile_id = viewer_id;

  select weight into w_compatibility from discovery_scoring_config where key = 'compatibility';
  select weight into w_activity from discovery_scoring_config where key = 'activity';
  select weight into w_freshness from discovery_scoring_config where key = 'freshness';
  select weight into w_profile_quality from discovery_scoring_config where key = 'profile_quality';
  select weight into w_distance from discovery_scoring_config where key = 'distance';

  return query
  select
    p.id, p.name, p.birth_date, p.city, p.bio, p.interests, p.is_verified, p.hot_mode_enabled,
    (select pp.url from profile_photos pp where pp.profile_id = p.id and pp.is_primary = true and pp.moderation_status = 'approved' limit 1) as primary_photo_url,
    round((
      coalesce(w_compatibility, 0) * (
        case when coalesce(array_length(v_interests, 1), 0) = 0 or coalesce(array_length(p.interests, 1), 0) = 0 then 30
        else (select count(*) from unnest(p.interests) i where i = any(v_interests))::numeric
             / greatest(array_length(v_interests, 1), 1) * 100
        end
      )
      + coalesce(w_profile_quality, 0) * coalesce(p.profile_completion_score, 0)
      + coalesce(w_freshness, 0) * greatest(0, 30 - extract(day from (now() - p.created_at))) / 30 * 100
      + coalesce(w_activity, 0) * greatest(0, 7 - extract(day from (now() - p.last_active_at))) / 7 * 100
      + coalesce(w_distance, 0) * (
          case
            when v_lat is null or v_lng is null or p.lat is null or p.lng is null then 50
            else greatest(0, 100 - distance_km(v_lat, v_lng, p.lat, p.lng))
          end
        )
    ) / greatest(coalesce(w_compatibility,0)+coalesce(w_profile_quality,0)+coalesce(w_freshness,0)+coalesce(w_activity,0)+coalesce(w_distance,0), 1))::numeric as score
  from profiles p
  join preferences pref on pref.profile_id = p.id
  where p.id <> viewer_id
    and p.deleted_at is null
    and p.is_discoverable = true
    and p.gender = any(coalesce(v_interested_in, array[]::text[]))
    and v_gender = any(coalesce(pref.interested_in, array[]::text[]))
    and date_part('year', age(p.birth_date)) between coalesce(v_age_min, 18) and coalesce(v_age_max, 99)
    and not exists (
      select 1 from blocks b
      where (b.blocker_id = viewer_id and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = viewer_id)
    )
    and not exists (select 1 from likes l where l.from_profile_id = viewer_id and l.to_profile_id = p.id)
    and not exists (select 1 from super_likes sl where sl.from_profile_id = viewer_id and sl.to_profile_id = p.id)
    and not exists (select 1 from passes ps where ps.from_profile_id = viewer_id and ps.to_profile_id = p.id)
  order by score desc nulls last
  limit result_limit;
end;
$$;

grant execute on function discover_profiles(uuid, int) to authenticated;

-- ---------------------------------------------------------------------
-- LIKE / SUPER LIKE + ATOMSKO PRAVLJENJE MATCH-A -- vidi potpun komentar
-- u supabase/migrations/0003_discovery.sql
-- ---------------------------------------------------------------------

create or replace function like_profile(viewer_id uuid, target_id uuid, is_super boolean default false)
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
    raise exception 'Ne možeš lajkovati sebe.';
  end if;

  if is_super then
    insert into super_likes (from_profile_id, to_profile_id) values (viewer_id, target_id)
    on conflict (from_profile_id, to_profile_id) do nothing;
  else
    insert into likes (from_profile_id, to_profile_id) values (viewer_id, target_id)
    on conflict (from_profile_id, to_profile_id) do nothing;
  end if;

  select exists(
    select 1 from likes where from_profile_id = target_id and to_profile_id = viewer_id
    union
    select 1 from super_likes where from_profile_id = target_id and to_profile_id = viewer_id
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

grant execute on function like_profile(uuid, uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- TAJNI SRBIN/SRPKINJA (Secret Spark) + DUEL -- vidi potpun komentar u
-- supabase/migrations/0004_secret_spark_and_duel.sql
-- ---------------------------------------------------------------------

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
    and exists (select 1 from profile_photos pp where pp.profile_id = p.id and pp.is_primary = true and pp.moderation_status = 'approved')
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
    and exists (select 1 from profile_photos pp where pp.profile_id = p.id and pp.is_primary = true and pp.moderation_status = 'approved')
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
    (select pp.url from profile_photos pp where pp.profile_id = a.id and pp.is_primary = true and pp.moderation_status = 'approved' limit 1),
    b.id, b.name, b.birth_date,
    (select pp.url from profile_photos pp where pp.profile_id = b.id and pp.is_primary = true and pp.moderation_status = 'approved' limit 1)
  from profiles a, profiles b
  where a.id = v_a and b.id = v_b;
end;
$$;

grant execute on function create_duel(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- "BLIZU SADA" (sekcija 16) -- vidi potpun komentar u
-- supabase/migrations/0008_faza5_blizu_sada.sql
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
-- "NOĆNO MUVANJE" -- provokativan, plaćen unlock sistem za fotografije/
-- video u chatu (vidi supabase/migrations/0011_night_flirting.sql za
-- potpun komentar o svakoj odluci).
-- ---------------------------------------------------------------------

create table night_flirting_config (
  key text primary key,
  value text not null,
  description text,
  updated_at timestamptz not null default now()
);

insert into night_flirting_config (key, value, description) values
  ('unlock_cost_credits', '1', 'Koliko Iskrica košta otključavanje jednog zaključanog sadržaja'),
  ('daily_send_limit_free', '3', 'Koliko Noćno muvanje slanja dnevno sme besplatan nalog'),
  ('daily_send_limit_premium', '20', 'Koliko Noćno muvanje slanja dnevno sme Premium nalog'),
  ('yellow_score_threshold', '0.15', 'Prag (0-1) za nudity/erotica skor iznad kog se sadržaj zaključava (žuto)'),
  ('red_score_threshold', '0.5', 'Prag (0-1) za sexual_activity skor iznad kog ide na ručni pregled (crveno)');

create trigger night_flirting_config_set_updated_at before update on night_flirting_config
  for each row execute function set_updated_at();

alter table night_flirting_config enable row level security;

create policy "svako ulogovan cita konfiguraciju"
  on night_flirting_config for select using (auth.uid() is not null);

create policy "samo admin menja konfiguraciju"
  on night_flirting_config for all using (is_admin()) with check (is_admin());

create table wallets (
  profile_id uuid primary key references profiles(id) on delete cascade,
  balance_credits int not null default 0 check (balance_credits >= 0),
  updated_at timestamptz not null default now()
);

create trigger wallets_set_updated_at before update on wallets
  for each row execute function set_updated_at();

alter table wallets enable row level security;

create policy "korisnik vidi svoj novcanik"
  on wallets for select using (auth.uid() = profile_id);

create policy "admin upravlja novcanicima"
  on wallets for all using (is_admin()) with check (is_admin());

create table credit_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  credits int not null check (credits > 0),
  price_cents int not null check (price_cents > 0),
  currency text not null default 'eur',
  is_active boolean not null default true,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);

insert into credit_packages (name, credits, price_cents, position) values
  ('5 Iskrica', 5, 249, 0),
  ('10 Iskrica', 10, 399, 1),
  ('25 Iskrica', 25, 799, 2);

alter table credit_packages enable row level security;

create policy "svako ulogovan vidi aktivne pakete"
  on credit_packages for select using (auth.uid() is not null and is_active = true);

create policy "admin upravlja paketima"
  on credit_packages for all using (is_admin()) with check (is_admin());

create table credit_transactions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  amount int not null,
  reason text not null check (reason in ('purchase', 'unlock_spend', 'admin_adjustment', 'refund')),
  related_content_id uuid, -- fk se dodaje niže (na night_flirting_content)
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  amount_paid_cents int, -- stvaran iznos u novcu (samo za reason='purchase'), da admin ne mora da nagađa
  currency text,
  created_at timestamptz not null default now()
);

create index credit_transactions_profile_idx on credit_transactions (profile_id, created_at desc);

alter table credit_transactions enable row level security;

create policy "korisnik vidi svoje transakcije"
  on credit_transactions for select using (auth.uid() = profile_id);

create policy "admin vidi i upisuje sve transakcije"
  on credit_transactions for all using (is_admin()) with check (is_admin());

create table night_flirting_content (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  receiver_id uuid not null references profiles(id),
  kind text not null check (kind in ('photo', 'video')),
  original_path text not null,
  preview_path text not null,
  duration_seconds smallint,
  classifier_score numeric,
  classification text not null check (classification in ('green', 'yellow', 'red')),
  moderation_status text not null default 'auto'
    check (moderation_status in ('auto', 'pending_review', 'admin_locked', 'admin_unlocked', 'admin_marked_safe', 'rejected')),
  is_free boolean not null default false,
  admin_note text,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table credit_transactions add constraint credit_transactions_content_fk
  foreign key (related_content_id) references night_flirting_content(id);

alter table messages add constraint messages_night_content_fk
  foreign key (night_content_id) references night_flirting_content(id);

create index night_flirting_content_receiver_idx on night_flirting_content (receiver_id, created_at desc);
create index night_flirting_content_sender_idx on night_flirting_content (sender_id, created_at desc);
create index night_flirting_content_review_idx on night_flirting_content (moderation_status) where moderation_status = 'pending_review';

alter table night_flirting_content enable row level security;

create policy "posiljalac i primalac vide svoj sadrzaj"
  on night_flirting_content for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id or is_admin());

create policy "admin upravlja sadrzajem (moderacija)"
  on night_flirting_content for update using (is_admin());

create policy "admin brise sadrzaj"
  on night_flirting_content for delete using (is_admin());

create table night_flirting_unlocks (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references night_flirting_content(id) on delete cascade,
  unlocker_id uuid not null references profiles(id),
  credits_spent int not null default 0,
  source text not null default 'credits' check (source in ('credits', 'premium', 'admin_free')),
  created_at timestamptz not null default now(),
  unique (content_id, unlocker_id)
);

create index night_flirting_unlocks_content_idx on night_flirting_unlocks (content_id);

alter table night_flirting_unlocks enable row level security;

create policy "ucesnici vide otkljucavanja svog sadrzaja"
  on night_flirting_unlocks for select
  using (
    auth.uid() = unlocker_id
    or is_admin()
    or exists (select 1 from night_flirting_content c where c.id = content_id and c.sender_id = auth.uid())
  );

create or replace function send_night_flirting_content(
  p_sender_id uuid,
  p_match_id uuid,
  p_kind text,
  p_original_path text,
  p_preview_path text,
  p_duration_seconds int,
  p_classification text,
  p_classifier_score numeric,
  p_moderation_status text,
  p_daily_limit int
)
returns table (content_id uuid, message_id uuid, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receiver_id uuid;
  v_profile_a uuid;
  v_profile_b uuid;
  v_sent_today int;
  v_content_id uuid;
  v_message_id uuid;
  v_is_free boolean;
begin
  if auth.uid() is distinct from p_sender_id then
    return query select null::uuid, null::uuid, 'Nije dozvoljeno.'; return;
  end if;

  select profile_a_id, profile_b_id into v_profile_a, v_profile_b
  from matches where id = p_match_id and unmatched_at is null;

  if v_profile_a is null then
    return query select null::uuid, null::uuid, 'Ovaj razgovor više nije aktivan.'; return;
  end if;
  if p_sender_id <> v_profile_a and p_sender_id <> v_profile_b then
    return query select null::uuid, null::uuid, 'Nemaš pristup ovom razgovoru.'; return;
  end if;
  v_receiver_id := case when v_profile_a = p_sender_id then v_profile_b else v_profile_a end;

  if exists (
    select 1 from blocks b
    where (b.blocker_id = p_sender_id and b.blocked_id = v_receiver_id)
       or (b.blocker_id = v_receiver_id and b.blocked_id = p_sender_id)
  ) then
    return query select null::uuid, null::uuid, 'Ne možeš slati ovoj osobi.'; return;
  end if;

  select count(*) into v_sent_today
  from night_flirting_content
  where sender_id = p_sender_id and created_at >= date_trunc('day', now());

  if v_sent_today >= p_daily_limit then
    return query select null::uuid, null::uuid, 'Iskoristio/la si dnevni limit Noćnog muvanja.'; return;
  end if;

  v_is_free := p_classification = 'green';

  insert into night_flirting_content (
    match_id, sender_id, receiver_id, kind, original_path, preview_path,
    duration_seconds, classifier_score, classification, moderation_status, is_free
  ) values (
    p_match_id, p_sender_id, v_receiver_id, p_kind, p_original_path, p_preview_path,
    p_duration_seconds, p_classifier_score, p_classification, p_moderation_status, v_is_free
  ) returning id into v_content_id;

  insert into messages (match_id, sender_id, night_content_id)
  values (p_match_id, p_sender_id, v_content_id)
  returning id into v_message_id;

  return query select v_content_id, v_message_id, null::text;
end;
$$;

grant execute on function send_night_flirting_content(uuid, uuid, text, text, text, int, text, numeric, text, int) to authenticated;

create or replace function unlock_night_content(p_viewer_id uuid, p_content_id uuid)
returns table (ok boolean, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_content night_flirting_content%rowtype;
  v_is_premium boolean;
  v_cost int;
  v_balance int;
begin
  if auth.uid() is distinct from p_viewer_id then
    return query select false, 'Nije dozvoljeno.'; return;
  end if;

  select * into v_content from night_flirting_content where id = p_content_id;
  if v_content.id is null then
    return query select false, 'Sadržaj nije pronađen.'; return;
  end if;
  if v_content.receiver_id <> p_viewer_id then
    return query select false, 'Nemaš pristup ovom sadržaju.'; return;
  end if;
  if v_content.moderation_status in ('rejected', 'pending_review') then
    return query select false, 'Ovaj sadržaj još nije dostupan.'; return;
  end if;

  if exists (select 1 from night_flirting_unlocks where content_id = p_content_id and unlocker_id = p_viewer_id) then
    return query select true, null::text; return;
  end if;

  select exists(
    select 1 from subscriptions
    where profile_id = p_viewer_id and status = 'active'
      and (current_period_end is null or current_period_end > now())
  ) into v_is_premium;

  if v_is_premium then
    insert into night_flirting_unlocks (content_id, unlocker_id, credits_spent, source)
    values (p_content_id, p_viewer_id, 0, 'premium');
    return query select true, null::text; return;
  end if;

  select coalesce(value::int, 1) into v_cost from night_flirting_config where key = 'unlock_cost_credits';
  select balance_credits into v_balance from wallets where profile_id = p_viewer_id;

  if coalesce(v_balance, 0) < v_cost then
    return query select false, 'Nemaš dovoljno Iskrica.'; return;
  end if;

  update wallets set balance_credits = balance_credits - v_cost where profile_id = p_viewer_id;
  insert into credit_transactions (profile_id, amount, reason, related_content_id)
    values (p_viewer_id, -v_cost, 'unlock_spend', p_content_id);
  insert into night_flirting_unlocks (content_id, unlocker_id, credits_spent, source)
    values (p_content_id, p_viewer_id, v_cost, 'credits');

  return query select true, null::text;
end;
$$;

grant execute on function unlock_night_content(uuid, uuid) to authenticated;

create or replace function credit_wallet(
  p_profile_id uuid,
  p_amount int,
  p_reason text,
  p_stripe_payment_intent_id text default null,
  p_stripe_checkout_session_id text default null,
  p_amount_paid_cents int default null,
  p_currency text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into wallets (profile_id, balance_credits)
  values (p_profile_id, greatest(p_amount, 0))
  on conflict (profile_id) do update set balance_credits = wallets.balance_credits + p_amount;

  insert into credit_transactions (
    profile_id, amount, reason, stripe_payment_intent_id, stripe_checkout_session_id,
    amount_paid_cents, currency
  )
  values (
    p_profile_id, p_amount, p_reason, p_stripe_payment_intent_id, p_stripe_checkout_session_id,
    p_amount_paid_cents, p_currency
  );
end;
$$;

revoke execute on function credit_wallet(uuid, int, text, text, text, int, text) from public;
grant execute on function credit_wallet(uuid, int, text, text, text, int, text) to service_role;

create or replace function admin_review_night_content(p_content_id uuid, p_decision text, p_note text default null)
returns table (ok boolean, error text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    return query select false, 'Nemaš admin pristup.'; return;
  end if;
  if p_decision not in ('admin_locked', 'admin_unlocked', 'admin_marked_safe') then
    return query select false, 'Nevažeća odluka.'; return;
  end if;

  update night_flirting_content
  set moderation_status = p_decision,
      is_free = case
        when p_decision = 'admin_unlocked' then true
        when p_decision = 'admin_locked' then false
        else is_free
      end,
      admin_note = p_note,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_content_id;

  return query select true, null::text;
end;
$$;

grant execute on function admin_review_night_content(uuid, text, text) to authenticated;

-- =====================================================================
-- Storage: napravi ove bucket-e ručno u Supabase dashboard -> Storage
-- (imena moraju biti tačno ovako, kod ih referencira):
--   - "photos"                (javno čitanje, upload samo vlasnik)
--   - "videos"                (javno čitanje, upload samo vlasnik)
--   - "verification-selfies"  (privatno -- čita samo admin + vlasnik)
--   - "night-flirting"        (privatno -- original ide samo preko signed URL-a)
-- Storage RLS politike su u posebnom fajlu: supabase/storage-policies.sql
-- =====================================================================

-- =====================================================================
-- MIGRACIJA 0013: Tajna soba (vidi supabase/migrations/0013_secret_room.sql)
-- =====================================================================

-- TAJNA SOBA (Secret Room) -- real-time, timer-based, obostrani-signal igra.
-- Ponovo koristi: profiles/likes/super_likes/passes/matches/blocks (kao Muvaj/
-- Otkrij), subscriptions (Premium), wallets/credit_transactions (Credits),
-- notifications + web push (kao ostatak app-a), activity_events (analytics,
-- isti obrazac kao night_flirting_* eventi), duel_votes (dodatni signal tipa).
--
-- Ne pravi novi payment sistem -- placeno "OTVORI" trosi Credits (isti
-- mehanizam kao unlock_night_content), Premium ima besplatan bypass.

-- ---------------------------------------------------------------------
-- KONFIGURACIJA (isti key/value obrazac kao night_flirting_config)
-- ---------------------------------------------------------------------

create table if not exists secret_room_config (
  key text primary key,
  value text not null,
  description text,
  updated_at timestamptz not null default now()
);

drop trigger if exists secret_room_config_set_updated_at on secret_room_config;
create trigger secret_room_config_set_updated_at before update on secret_room_config
  for each row execute function set_updated_at();

insert into secret_room_config (key, value, description) values
  ('round_duration_seconds', '180', 'Koliko traje jedna runda u Tajnoj sobi (countdown pri ulasku)'),
  ('request_duration_seconds', '180', 'Koliko vremena ima primalac da odgovori na RIZIKUJ zahtev'),
  ('duel_duration_seconds', '120', 'Koliko traje Duel hemije nakon otvaranja zajednicke sobe'),
  ('candidates_per_round', '7', 'Broj kandidata prikazanih po rundi'),
  ('unlock_cost_credits', '1', 'Koliko Credits-a kosta OTVORI (kada primalac nije Premium)'),
  ('rounds_daily_limit_free', '3', 'Koliko rundi dnevno sme besplatan nalog'),
  ('rounds_daily_limit_premium', '10', 'Koliko rundi dnevno sme Premium nalog'),
  ('evening_start_hhmm', '20:00', 'Od kada je Tajna soba istaknuta kao UZIVO u navigaciji (beogradsko vreme)'),
  ('evening_end_hhmm', '02:00', 'Do kada je Tajna soba istaknuta kao UZIVO u navigaciji'),
  ('weight_like_signal', '30', 'Bonus poenima za kandidata kog je gledalac vec lajkovao u Muvaj'),
  ('weight_duel_signal', '20', 'Bonus poenima za kandidata kog je gledalac vec birao u Duelu'),
  (
    'duel_questions',
    '[{"text":"Veceras bih pre...","options":[{"emoji":"🍸","label":"otisao/la na pice"},{"emoji":"🌙","label":"spontano nestao/la negde"},{"emoji":"🔥","label":"ostao/la u ovom razgovoru"},{"emoji":"😈","label":"s tobom u krevet"}]},{"text":"Prvi potez bi bio...","options":[{"emoji":"💬","label":"dug razgovor do kasno"},{"emoji":"🚗","label":"voznja bez plana"},{"emoji":"🍷","label":"casa vina kod mene ili tebe"},{"emoji":"😏","label":"direktno flertovanje"}]},{"text":"Za tebe je flert...","options":[{"emoji":"😇","label":"suptilan i spor"},{"emoji":"😈","label":"direktan i hrabar"},{"emoji":"🎭","label":"igra i zadirkivanje"},{"emoji":"🔥","label":"sav pritisak odjednom"}]}]',
    'JSON niz pitanja za Duel hemije -- svako: {text, options:[{emoji,label}, ...4]}'
  )
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- SRPSKA PITANJA PRI PRIJAVI (sekcija na kraju spec-a) -- "da li si pravi
-- Srbin/Srpkinja", multi-select omiljenih stvari; koristi se za mali
-- "poklapanje" banner u chatu posle match-a.
-- ---------------------------------------------------------------------

alter table profiles add column if not exists food_favorites text[] not null default '{}';

-- ---------------------------------------------------------------------
-- RUNDE (jedna "igra" -- korisnik ulazi, dobija kandidate, ima countdown)
-- ---------------------------------------------------------------------

create table if not exists secret_room_rounds (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'completed', 'expired')),
  result text check (result in ('chemistry', 'no_chemistry', 'abandoned')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

-- samo jedna AKTIVNA runda po korisniku u isto vreme
create unique index if not exists secret_room_rounds_one_active_idx on secret_room_rounds (profile_id) where status = 'active';
create index if not exists secret_room_rounds_profile_idx on secret_room_rounds (profile_id, created_at desc);

alter table secret_room_rounds enable row level security;

drop policy if exists "korisnik vidi svoje runde" on secret_room_rounds;
create policy "korisnik vidi svoje runde"
  on secret_room_rounds for select using (auth.uid() = profile_id);

drop policy if exists "admin vidi sve runde" on secret_room_rounds;
create policy "admin vidi sve runde"
  on secret_room_rounds for select using (is_admin());

-- ---------------------------------------------------------------------
-- KANDIDATI PO RUNDI (5-7 profila, jedan je "Tajna karta")
-- ---------------------------------------------------------------------

create table if not exists secret_room_candidates (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references secret_room_rounds(id) on delete cascade,
  candidate_id uuid not null references profiles(id) on delete cascade,
  card_position smallint not null,
  is_secret_card boolean not null default false,
  swipe text check (swipe in ('like', 'pass')),
  swiped_at timestamptz,
  created_at timestamptz not null default now(),
  unique (round_id, candidate_id)
);

create index if not exists secret_room_candidates_round_idx on secret_room_candidates (round_id, card_position);

alter table secret_room_candidates enable row level security;

drop policy if exists "korisnik vidi kandidate iz svoje runde" on secret_room_candidates;
create policy "korisnik vidi kandidate iz svoje runde"
  on secret_room_candidates for select using (
    exists (select 1 from secret_room_rounds r where r.id = round_id and r.profile_id = auth.uid())
  );

drop policy if exists "admin vidi sve kandidate" on secret_room_candidates;
create policy "admin vidi sve kandidate"
  on secret_room_candidates for select using (is_admin());

-- ---------------------------------------------------------------------
-- ZAHTEVI (RIZIKUJ -> primalac vidi samo "neko te je izabrao", cekaj OTVORI)
-- ---------------------------------------------------------------------

create table if not exists secret_room_requests (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references secret_room_rounds(id) on delete cascade,
  from_profile_id uuid not null references profiles(id) on delete cascade,
  to_profile_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  responded_at timestamptz,
  check (from_profile_id <> to_profile_id)
);

create index if not exists secret_room_requests_to_idx on secret_room_requests (to_profile_id, status);
create index if not exists secret_room_requests_from_idx on secret_room_requests (from_profile_id, status);

alter table secret_room_requests enable row level security;

drop policy if exists "ucesnici vide svoj zahtev" on secret_room_requests;
create policy "ucesnici vide svoj zahtev"
  on secret_room_requests for select using (auth.uid() = from_profile_id or auth.uid() = to_profile_id);

drop policy if exists "admin vidi sve zahteve" on secret_room_requests;
create policy "admin vidi sve zahteve"
  on secret_room_requests for select using (is_admin());

-- KLJUCNO za "ne otkrivaj ko je" (sekcija 10 spec-a): RLS je red-po-red,
-- ne moze sakriti SAMO from_profile_id primaocu dok je zahtev 'pending'.
-- Zato restriktujemo na nivou KOLONE -- obican authenticated klijent
-- (i realtime) nikad ne vidi from_profile_id; nase SECURITY DEFINER
-- funkcije (secret_room_respond_request i sl.) i dalje imaju pun pristup
-- jer citaju direktno iz SQL-a, ne kroz PostgREST grantove.
revoke select on secret_room_requests from authenticated;
grant select (id, round_id, to_profile_id, status, created_at, expires_at, responded_at)
  on secret_room_requests to authenticated;

-- ---------------------------------------------------------------------
-- ZAJEDNICKA SOBA (posle OTVORI -- oboje unutra, Duel hemije)
-- ---------------------------------------------------------------------

create table if not exists secret_room_pairs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references secret_room_requests(id) on delete cascade,
  profile_a_id uuid not null references profiles(id) on delete cascade,
  profile_b_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'duel' check (status in ('duel', 'chemistry_confirmed', 'no_chemistry', 'ended')),
  match_count smallint not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  check (profile_a_id < profile_b_id)
);

create unique index if not exists secret_room_pairs_request_idx on secret_room_pairs (request_id);
create index if not exists secret_room_pairs_a_idx on secret_room_pairs (profile_a_id, status);
create index if not exists secret_room_pairs_b_idx on secret_room_pairs (profile_b_id, status);

alter table secret_room_pairs enable row level security;

drop policy if exists "ucesnici vide svoju sobu" on secret_room_pairs;
create policy "ucesnici vide svoju sobu"
  on secret_room_pairs for select using (auth.uid() = profile_a_id or auth.uid() = profile_b_id);

drop policy if exists "admin vidi sve sobe" on secret_room_pairs;
create policy "admin vidi sve sobe"
  on secret_room_pairs for select using (is_admin());

-- ---------------------------------------------------------------------
-- DUEL HEMIJE ODGOVORI
-- ---------------------------------------------------------------------

create table if not exists secret_room_duel_answers (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references secret_room_pairs(id) on delete cascade,
  question_index smallint not null,
  profile_id uuid not null references profiles(id) on delete cascade,
  answer_index smallint not null,
  created_at timestamptz not null default now(),
  unique (pair_id, question_index, profile_id)
);

alter table secret_room_duel_answers enable row level security;

drop policy if exists "ucesnici vide odgovore svoje sobe" on secret_room_duel_answers;
create policy "ucesnici vide odgovore svoje sobe"
  on secret_room_duel_answers for select using (
    exists (
      select 1 from secret_room_pairs p
      where p.id = pair_id and (p.profile_a_id = auth.uid() or p.profile_b_id = auth.uid())
    )
  );

drop policy if exists "ucesnik upisuje svoj odgovor" on secret_room_duel_answers;
create policy "ucesnik upisuje svoj odgovor"
  on secret_room_duel_answers for insert with check (
    auth.uid() = profile_id
    and exists (
      select 1 from secret_room_pairs p
      where p.id = pair_id and (p.profile_a_id = auth.uid() or p.profile_b_id = auth.uid())
    )
  );

drop policy if exists "admin vidi sve duel hemije odgovore" on secret_room_duel_answers;
create policy "admin vidi sve duel hemije odgovore"
  on secret_room_duel_answers for select using (is_admin());

-- ---------------------------------------------------------------------
-- start_secret_room_round -- bira kandidate i otvara novu rundu.
-- Ako vec postoji aktivna, ne otisla runda (istekla po vremenu), vraca
-- tu istu (idempotentno -- korisnik moze da osvezi stranicu bez greske).
-- ---------------------------------------------------------------------

create or replace function start_secret_room_round(viewer_id uuid, result_limit int default null)
returns table (round_id uuid, expires_at timestamptz, is_new boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gender text;
  v_interests text[];
  v_lat double precision;
  v_lng double precision;
  v_interested_in text[];
  v_age_min smallint;
  v_age_max smallint;
  v_limit int;
  v_round_seconds int;
  v_w_like numeric;
  v_w_duel numeric;
  v_existing_round_id uuid;
  v_existing_expires timestamptz;
  v_new_round_id uuid;
  v_new_expires timestamptz;
  v_secret_candidate_id uuid;
  v_secret_position smallint;
begin
  if auth.uid() is distinct from viewer_id then
    raise exception 'Nije dozvoljeno.';
  end if;

  -- Oportunisticko isticanje: nema pozadinskog posla (cron), pa istekle
  -- runde/zahteve zatvaramo cim neko dodirne sistem (isti obrazac kao
  -- Belgrade-vreme dnevni limiti drugde u app-u).
  --
  -- NAPOMENA: "expires_at" MORA biti kvalifikovano (r./req.) svuda ovde --
  -- funkcija vraca RETURNS TABLE(..., expires_at timestamptz, ...), sto
  -- Postgres tretira kao dostupnu plpgsql promenljivu u celom telu
  -- funkcije, pa se nekvalifikovano "expires_at" kosi sa kolonom istog
  -- imena (greska 42702, "column reference is ambiguous").
  update secret_room_rounds r set status = 'expired', ended_at = now()
    where r.profile_id = viewer_id and r.status = 'active' and r.expires_at < now();
  update secret_room_requests req set status = 'expired'
    where req.to_profile_id = viewer_id and req.status = 'pending' and req.expires_at < now();

  select r.id, r.expires_at into v_existing_round_id, v_existing_expires
    from secret_room_rounds r where r.profile_id = viewer_id and r.status = 'active';

  if v_existing_round_id is not null then
    return query select v_existing_round_id, v_existing_expires, false;
    return;
  end if;

  select coalesce(value::int, 7) into v_limit from secret_room_config where key = 'candidates_per_round';
  select coalesce(value::int, 180) into v_round_seconds from secret_room_config where key = 'round_duration_seconds';
  select coalesce(value::numeric, 30) into v_w_like from secret_room_config where key = 'weight_like_signal';
  select coalesce(value::numeric, 20) into v_w_duel from secret_room_config where key = 'weight_duel_signal';
  v_limit := coalesce(result_limit, v_limit);

  select profiles.gender, profiles.interests, profiles.lat, profiles.lng
    into v_gender, v_interests, v_lat, v_lng
  from profiles where profiles.id = viewer_id;

  select interested_in, age_min, age_max
    into v_interested_in, v_age_min, v_age_max
  from preferences where profile_id = viewer_id;

  v_new_round_id := gen_random_uuid();
  v_new_expires := now() + make_interval(secs => v_round_seconds);

  insert into secret_room_rounds (id, profile_id, status, expires_at)
    values (v_new_round_id, viewer_id, 'active', v_new_expires);

  -- Napomena o performansama: skoring i LIMIT su namerno u UNUTRASNJEM
  -- upitu (obican "order by score desc limit N", bez window funkcije) --
  -- to Postgres-u dozvoljava top-N (bounded heap) sortiranje umesto da
  -- mora da materijalizuje i rangira SVE kandidate. row_number() se
  -- primenjuje tek POSLE, na vec skraceni skup od najvise v_limit redova.
  insert into secret_room_candidates (round_id, candidate_id, card_position, is_secret_card)
  select v_new_round_id, x.id, row_number() over (order by x.score desc), false
  from (
    select
      p.id,
      (
        case when coalesce(array_length(v_interests, 1), 0) = 0 or coalesce(array_length(p.interests, 1), 0) = 0 then 30
        else (select count(*) from unnest(p.interests) i where i = any(v_interests))::numeric
             / greatest(array_length(v_interests, 1), 1) * 100
        end
        + coalesce(p.profile_completion_score, 0)
        + greatest(0, 7 - extract(day from (now() - p.last_active_at))) / 7 * 100
        + (
            case
              when v_lat is null or v_lng is null or p.lat is null or p.lng is null then 50
              else greatest(0, 100 - distance_km(v_lat, v_lng, p.lat, p.lng))
            end
          )
        + (case when exists (
            select 1 from likes l where l.from_profile_id = viewer_id and l.to_profile_id = p.id
            union
            select 1 from super_likes sl where sl.from_profile_id = viewer_id and sl.to_profile_id = p.id
          ) then v_w_like else 0 end)
        + (case when exists (
            select 1 from duel_votes dv where dv.voter_profile_id = viewer_id and dv.voted_for_profile_id = p.id
          ) then v_w_duel else 0 end)
      ) as score
    from profiles p
    join preferences pref on pref.profile_id = p.id
    where p.id <> viewer_id
      and p.deleted_at is null
      and p.is_discoverable = true
      and p.gender = any(coalesce(v_interested_in, array[]::text[]))
      and v_gender = any(coalesce(pref.interested_in, array[]::text[]))
      and date_part('year', age(p.birth_date)) between coalesce(v_age_min, 18) and coalesce(v_age_max, 99)
      and not exists (
        select 1 from blocks b
        where (b.blocker_id = viewer_id and b.blocked_id = p.id)
           or (b.blocker_id = p.id and b.blocked_id = viewer_id)
      )
      and not exists (
        select 1 from matches m
        where m.unmatched_at is null
          and ((m.profile_a_id = viewer_id and m.profile_b_id = p.id)
            or (m.profile_a_id = p.id and m.profile_b_id = viewer_id))
      )
      and not exists (
        select 1 from secret_room_pairs sp
        where sp.status = 'duel' and sp.expires_at > now()
          and (sp.profile_a_id = p.id or sp.profile_b_id = p.id)
      )
    order by score desc
    limit v_limit
  ) x;

  -- "Tajna karta": najbolje ocenjeni kandidat (card_position = 1), ali se
  -- prikazuje tek posle par swipe-ova -- zato ga fizicki pomeramo na
  -- kasniju poziciju (min(4, poslednja)), da FE prirodno dodje do njega
  -- posle nekoliko izbora, kako spec trazi.
  --
  -- NAPOMENA: i "round_id" je OUT parametar ove funkcije (RETURNS TABLE),
  -- pa mora biti kvalifikovano (c.) svuda ovde iz istog razloga kao
  -- "expires_at" gore.
  select c.candidate_id into v_secret_candidate_id
    from secret_room_candidates c where c.round_id = v_new_round_id and c.card_position = 1;

  if v_secret_candidate_id is not null then
    select least(4, count(*)) into v_secret_position from secret_room_candidates c where c.round_id = v_new_round_id;

    update secret_room_candidates c set card_position = 0
      where c.round_id = v_new_round_id and c.card_position = v_secret_position and c.candidate_id <> v_secret_candidate_id;
    update secret_room_candidates c set card_position = v_secret_position, is_secret_card = true
      where c.round_id = v_new_round_id and c.candidate_id = v_secret_candidate_id;
    update secret_room_candidates c set card_position = 1
      where c.round_id = v_new_round_id and c.card_position = 0;
  end if;

  return query select v_new_round_id, v_new_expires, true;
end;
$$;

grant execute on function start_secret_room_round(uuid, int) to authenticated;

-- ---------------------------------------------------------------------
-- get_secret_room_candidates -- lista neodgovorenih kandidata za rundu.
-- ---------------------------------------------------------------------

create or replace function get_secret_room_candidates(viewer_id uuid, p_round_id uuid)
returns table (
  candidate_row_id uuid,
  candidate_id uuid,
  name text,
  birth_date date,
  city text,
  bio text,
  primary_photo_url text,
  card_position smallint,
  is_secret_card boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from viewer_id then
    raise exception 'Nije dozvoljeno.';
  end if;
  if not exists (select 1 from secret_room_rounds r where r.id = p_round_id and r.profile_id = viewer_id) then
    raise exception 'Runda ne postoji.';
  end if;

  return query
  select
    c.id, p.id, p.name, p.birth_date, p.city, p.bio,
    (select pp.url from profile_photos pp where pp.profile_id = p.id and pp.is_primary = true and pp.moderation_status = 'approved' limit 1),
    c.card_position, c.is_secret_card
  from secret_room_candidates c
  join profiles p on p.id = c.candidate_id
  where c.round_id = p_round_id and c.swipe is null
  order by c.card_position asc;
end;
$$;

grant execute on function get_secret_room_candidates(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- secret_room_swipe -- like/pass na obicnog kandidata (ne Tajnu kartu).
-- Like ovde prolazi kroz POSTOJECI like_profile() -- ako je obostrano,
-- pravi se pravi Match, isto kao u Muvaj.
-- ---------------------------------------------------------------------

create or replace function secret_room_swipe(viewer_id uuid, p_round_id uuid, p_candidate_id uuid, p_action text)
returns table (matched boolean, match_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_secret boolean;
  v_matched boolean := false;
  v_match_id uuid;
begin
  if auth.uid() is distinct from viewer_id then
    raise exception 'Nije dozvoljeno.';
  end if;
  if p_action not in ('like', 'pass') then
    raise exception 'Nepoznata akcija.';
  end if;

  if not exists (
    select 1 from secret_room_rounds r
    where r.id = p_round_id and r.profile_id = viewer_id and r.status = 'active' and r.expires_at > now()
  ) then
    raise exception 'Runda je istekla.';
  end if;

  select is_secret_card into v_is_secret
    from secret_room_candidates where round_id = p_round_id and candidate_id = p_candidate_id and swipe is null;

  if v_is_secret is null then
    raise exception 'Kandidat ne postoji ili je vec odgovoren.';
  end if;
  if v_is_secret then
    raise exception 'Tajna karta se otvara preko RIZIKUJ/PRESKOCI, ne obicnog swipe-a.';
  end if;

  update secret_room_candidates set swipe = p_action, swiped_at = now()
    where round_id = p_round_id and candidate_id = p_candidate_id;

  if p_action = 'like' then
    select l.matched, l.match_id into v_matched, v_match_id from like_profile(viewer_id, p_candidate_id, false) l;
  end if;

  return query select coalesce(v_matched, false), v_match_id;
end;
$$;

grant execute on function secret_room_swipe(uuid, uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- secret_room_send_request -- "RIZIKUJ" na Tajnu kartu. Besplatno za
-- posiljaoca (kao super-like); primalac NE vidi identitet dok ne prihvati.
-- ---------------------------------------------------------------------

create or replace function secret_room_send_request(viewer_id uuid, p_round_id uuid)
returns table (request_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate_id uuid;
  v_req_seconds int;
  v_req_id uuid;
  v_expires timestamptz;
  v_my_name text;
begin
  if auth.uid() is distinct from viewer_id then
    raise exception 'Nije dozvoljeno.';
  end if;

  if not exists (
    select 1 from secret_room_rounds r
    where r.id = p_round_id and r.profile_id = viewer_id and r.status = 'active' and r.expires_at > now()
  ) then
    raise exception 'Runda je istekla.';
  end if;

  select candidate_id into v_candidate_id
    from secret_room_candidates
    where round_id = p_round_id and is_secret_card = true and swipe is null;

  if v_candidate_id is null then
    raise exception 'Nema aktivne Tajne karte u ovoj rundi.';
  end if;

  if exists (
    select 1 from blocks b
    where (b.blocker_id = viewer_id and b.blocked_id = v_candidate_id)
       or (b.blocker_id = v_candidate_id and b.blocked_id = viewer_id)
  ) then
    raise exception 'Ne mozes poslati zahtev ovom korisniku.';
  end if;

  select coalesce(value::int, 180) into v_req_seconds from secret_room_config where key = 'request_duration_seconds';
  v_expires := now() + make_interval(secs => v_req_seconds);
  v_req_id := gen_random_uuid();

  update secret_room_candidates set swipe = 'like', swiped_at = now()
    where round_id = p_round_id and candidate_id = v_candidate_id;

  insert into secret_room_requests (id, round_id, from_profile_id, to_profile_id, expires_at)
    values (v_req_id, p_round_id, viewer_id, v_candidate_id, v_expires);

  select name into v_my_name from profiles where id = viewer_id;

  insert into notifications (profile_id, type, title, body, data)
    values (
      v_candidate_id, 'secret_room_request', '🔥 Neko te je izabrao u Tajnoj sobi',
      'Hoces da otvoris vrata?', jsonb_build_object('requestId', v_req_id)
    );

  return query select v_req_id, v_expires;
end;
$$;

grant execute on function secret_room_send_request(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- get_secret_room_incoming_request -- jedini nacin na koji FE cita svoj
-- dolazni zahtev; namerno NIKAD ne vraca from_profile_id (identitet se
-- otkriva tek posle OTVORI, kroz secret_room_respond_request). Ovo je
-- glavni put za "real-time" -- klijent slusa POSTOJECU notifications
-- realtime pretplatu (tip 'secret_room_request'), pa pozove ovu funkciju
-- da dobije bezbedno stanje -- bez nove realtime infrastrukture.
-- ---------------------------------------------------------------------

create or replace function get_secret_room_incoming_request(viewer_id uuid)
returns table (request_id uuid, status text, created_at timestamptz, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from viewer_id then
    raise exception 'Nije dozvoljeno.';
  end if;

  -- "status" i "expires_at" MORAJU biti kvalifikovani (req.) -- oba su
  -- takodje imena OUT parametara iz RETURNS TABLE(...) ove funkcije.
  update secret_room_requests req set status = 'expired'
    where req.to_profile_id = viewer_id and req.status = 'pending' and req.expires_at < now();

  return query
  select r.id, r.status, r.created_at, r.expires_at
  from secret_room_requests r
  where r.to_profile_id = viewer_id and r.status = 'pending'
  order by r.created_at desc
  limit 1;
end;
$$;

grant execute on function get_secret_room_incoming_request(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- secret_room_respond_request -- primalac klikne OTVORI (placeno, osim
-- Premium) ili PRESKOCI (besplatno). Isti obrazac trosenja kredita kao
-- unlock_night_content -- direktan update wallets + credit_transactions,
-- credit_wallet() ostaje rezervisan iskljucivo za KUPOVINU (webhook).
-- ---------------------------------------------------------------------

create or replace function secret_room_respond_request(viewer_id uuid, p_request_id uuid, p_accept boolean)
returns table (ok boolean, error text, pair_id uuid, other_id uuid, other_name text, other_birth_date date, other_city text, other_photo_url text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req secret_room_requests%rowtype;
  v_is_premium boolean;
  v_cost int;
  v_balance int;
  v_duel_seconds int;
  v_pair_id uuid;
  v_pair_a uuid;
  v_pair_b uuid;
begin
  if auth.uid() is distinct from viewer_id then
    return query select false, 'Nije dozvoljeno.'::text, null::uuid, null::uuid, null::text, null::date, null::text, null::text; return;
  end if;

  select * into v_req from secret_room_requests where id = p_request_id;

  if v_req.id is null or v_req.to_profile_id <> viewer_id then
    return query select false, 'Zahtev ne postoji.'::text, null::uuid, null::uuid, null::text, null::date, null::text, null::text; return;
  end if;

  if v_req.status <> 'pending' or v_req.expires_at < now() then
    if v_req.status = 'pending' then
      update secret_room_requests set status = 'expired' where id = p_request_id;
    end if;
    return query select false, 'Zahtev je vec istekao.'::text, null::uuid, null::uuid, null::text, null::date, null::text, null::text; return;
  end if;

  if not p_accept then
    update secret_room_requests set status = 'rejected', responded_at = now() where id = p_request_id;
    insert into notifications (profile_id, type, title, body, data)
      values (v_req.from_profile_id, 'secret_room_rejected', '✖ Vrata su se zatvorila', 'Ovaj put nije bilo hemije.', jsonb_build_object('requestId', p_request_id));
    return query select true, null::text, null::uuid, null::uuid, null::text, null::date, null::text, null::text; return;
  end if;

  if exists (
    select 1 from secret_room_pairs sp
    where sp.status = 'duel' and sp.expires_at > now()
      and (sp.profile_a_id = viewer_id or sp.profile_b_id = viewer_id)
  ) then
    return query select false, 'Vec si u aktivnoj sobi.'::text, null::uuid, null::uuid, null::text, null::date, null::text, null::text; return;
  end if;

  select exists(
    select 1 from subscriptions
    where profile_id = viewer_id and status = 'active'
      and (current_period_end is null or current_period_end > now())
  ) into v_is_premium;

  if not v_is_premium then
    select coalesce(value::int, 1) into v_cost from secret_room_config where key = 'unlock_cost_credits';
    select balance_credits into v_balance from wallets where profile_id = viewer_id;
    if coalesce(v_balance, 0) < v_cost then
      return query select false, 'insufficient_credits'::text, null::uuid, null::uuid, null::text, null::date, null::text, null::text; return;
    end if;
    update wallets set balance_credits = balance_credits - v_cost where profile_id = viewer_id;
    insert into credit_transactions (profile_id, amount, reason)
      values (viewer_id, -v_cost, 'unlock_spend');
  end if;

  update secret_room_requests set status = 'accepted', responded_at = now() where id = p_request_id;

  select coalesce(value::int, 120) into v_duel_seconds from secret_room_config where key = 'duel_duration_seconds';
  v_pair_a := least(v_req.from_profile_id, v_req.to_profile_id);
  v_pair_b := greatest(v_req.from_profile_id, v_req.to_profile_id);
  v_pair_id := gen_random_uuid();

  insert into secret_room_pairs (id, request_id, profile_a_id, profile_b_id, status, expires_at)
    values (v_pair_id, p_request_id, v_pair_a, v_pair_b, 'duel', now() + make_interval(secs => v_duel_seconds));

  insert into notifications (profile_id, type, title, body, data)
    values (v_req.from_profile_id, 'secret_room_pair_ready', '🚪 Vrata su otvorena!', 'Usli ste u Tajnu sobu.', jsonb_build_object('pairId', v_pair_id));

  return query
  select true, null::text, v_pair_id, p.id, p.name, p.birth_date, p.city,
    (select pp.url from profile_photos pp where pp.profile_id = p.id and pp.is_primary = true and pp.moderation_status = 'approved' limit 1)
  from profiles p where p.id = v_req.from_profile_id;
end;
$$;

grant execute on function secret_room_respond_request(uuid, uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- get_secret_room_pair -- ucitavanje zajednicke sobe (oba ucesnika, npr.
-- posiljalac posle 'secret_room_pair_ready' notifikacije, ili osvezavanje
-- stranice). Vraca podatke DRUGE osobe (identitet je vec otkriven).
-- ---------------------------------------------------------------------

create or replace function get_secret_room_pair(viewer_id uuid, p_pair_id uuid)
returns table (
  pair_id uuid, status text, match_count smallint, expires_at timestamptz,
  other_id uuid, other_name text, other_birth_date date, other_city text, other_photo_url text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pair secret_room_pairs%rowtype;
  v_other_id uuid;
begin
  if auth.uid() is distinct from viewer_id then
    raise exception 'Nije dozvoljeno.';
  end if;

  select * into v_pair from secret_room_pairs where id = p_pair_id;
  if v_pair.id is null or (v_pair.profile_a_id <> viewer_id and v_pair.profile_b_id <> viewer_id) then
    raise exception 'Soba ne postoji.';
  end if;

  if v_pair.status = 'duel' and v_pair.expires_at < now() then
    update secret_room_pairs set status = 'no_chemistry', ended_at = now() where id = p_pair_id;
    v_pair.status := 'no_chemistry';
  end if;

  v_other_id := case when v_pair.profile_a_id = viewer_id then v_pair.profile_b_id else v_pair.profile_a_id end;

  return query
  select v_pair.id, v_pair.status, v_pair.match_count, v_pair.expires_at,
    p.id, p.name, p.birth_date, p.city,
    (select pp.url from profile_photos pp where pp.profile_id = p.id and pp.is_primary = true and pp.moderation_status = 'approved' limit 1)
  from profiles p where p.id = v_other_id;
end;
$$;

grant execute on function get_secret_room_pair(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- secret_room_duel_answer -- upisuje odgovor i vraca da li je runda
-- pitanja "pogodak" (oba ista) + trenutni ukupan broj poklapanja.
-- ---------------------------------------------------------------------

create or replace function secret_room_duel_answer(viewer_id uuid, p_pair_id uuid, p_question_index smallint, p_answer_index smallint)
returns table (ok boolean, error text, both_answered boolean, is_match boolean, match_count smallint, chemistry_confirmed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pair secret_room_pairs%rowtype;
  v_other_id uuid;
  v_other_answer smallint;
  v_is_match boolean := false;
  v_count smallint;
  v_confirmed boolean := false;
begin
  if auth.uid() is distinct from viewer_id then
    return query select false, 'Nije dozvoljeno.'::text, false, false, 0::smallint, false; return;
  end if;

  select * into v_pair from secret_room_pairs where id = p_pair_id;
  if v_pair.id is null or (v_pair.profile_a_id <> viewer_id and v_pair.profile_b_id <> viewer_id) then
    return query select false, 'Soba ne postoji.'::text, false, false, 0::smallint, false; return;
  end if;
  if v_pair.status <> 'duel' or v_pair.expires_at < now() then
    return query select false, 'Duel hemije je zavrsen.'::text, false, false, v_pair.match_count, false; return;
  end if;

  v_other_id := case when v_pair.profile_a_id = viewer_id then v_pair.profile_b_id else v_pair.profile_a_id end;

  insert into secret_room_duel_answers (pair_id, question_index, profile_id, answer_index)
    values (p_pair_id, p_question_index, viewer_id, p_answer_index)
  on conflict (pair_id, question_index, profile_id) do update set answer_index = excluded.answer_index;

  select answer_index into v_other_answer
    from secret_room_duel_answers where pair_id = p_pair_id and question_index = p_question_index and profile_id = v_other_id;

  if v_other_answer is not null and v_other_answer = p_answer_index then
    v_is_match := true;
    v_count := v_pair.match_count + 1;
    update secret_room_pairs set match_count = v_count where id = p_pair_id;
    if v_count >= 3 then
      v_confirmed := true;
      update secret_room_pairs set status = 'chemistry_confirmed', ended_at = now() where id = p_pair_id;
    end if;
  else
    v_count := v_pair.match_count;
  end if;

  return query select true, null::text, (v_other_answer is not null), v_is_match, v_count, v_confirmed;
end;
$$;

grant execute on function secret_room_duel_answer(uuid, uuid, smallint, smallint) to authenticated;

-- ---------------------------------------------------------------------
-- secret_room_confirm_match -- posle "HEMIJA POTVRDJENA": korisnik bira
-- NASTAVI MUVANJE ili DODAJ U MATCH -- oba u sustini prave pravi Match
-- (isti mehanizam kao like_profile), samo se FE CTA i navigacija razlikuju.
-- ---------------------------------------------------------------------

create or replace function secret_room_confirm_match(viewer_id uuid, p_pair_id uuid)
returns table (ok boolean, error text, match_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pair secret_room_pairs%rowtype;
  v_a uuid;
  v_b uuid;
  v_match_id uuid;
  v_my_name text;
  v_their_name text;
  v_other_id uuid;
begin
  if auth.uid() is distinct from viewer_id then
    return query select false, 'Nije dozvoljeno.'::text, null::uuid; return;
  end if;

  select * into v_pair from secret_room_pairs where id = p_pair_id;
  if v_pair.id is null or (v_pair.profile_a_id <> viewer_id and v_pair.profile_b_id <> viewer_id) then
    return query select false, 'Soba ne postoji.'::text, null::uuid; return;
  end if;
  if v_pair.status <> 'chemistry_confirmed' then
    return query select false, 'Hemija nije potvrdjena.'::text, null::uuid; return;
  end if;

  v_other_id := case when v_pair.profile_a_id = viewer_id then v_pair.profile_b_id else v_pair.profile_a_id end;
  v_a := least(viewer_id, v_other_id);
  v_b := greatest(viewer_id, v_other_id);

  insert into matches (profile_a_id, profile_b_id, source)
    values (v_a, v_b, 'duel')
  on conflict (profile_a_id, profile_b_id) do nothing;

  select id into v_match_id from matches where profile_a_id = v_a and profile_b_id = v_b;

  select name into v_my_name from profiles where id = viewer_id;
  select name into v_their_name from profiles where id = v_other_id;

  insert into notifications (profile_id, type, title, body, data)
    values (viewer_id, 'match', '🔥 MATCH!', 'Ti i ' || coalesce(v_their_name, 'neko') || ' ste se svideli jedno drugom.', jsonb_build_object('matchId', v_match_id, 'otherId', v_other_id));

  return query select true, null::text, v_match_id;
end;
$$;

grant execute on function secret_room_confirm_match(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- get_secret_room_food_match -- zajednicke "srpske" omiljene stvari
-- dvoje matchovanih korisnika (koristi se u chatu za banner).
-- ---------------------------------------------------------------------

create or replace function get_secret_room_food_match(viewer_id uuid, other_id uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  -- NAPOMENA: "x = any((select ... ))" je NAMERNO izbegnuto -- kad je
  -- desna strana ANY(...) podupit (a ne kolona/promenljiva tipa text[]),
  -- Postgres ga tumaci kao "ANY podupita" (poredi x sa svakim REDOM koji
  -- podupit vrati), a ne kao element niza -- tu bi podupit vratio JEDAN
  -- red tipa text[], pa bi ispalo "text = text[]" (greska 42883). Zato
  -- ovde koristimo p2.food_favorites kao pravu kolonu (iz JOIN-a), ne
  -- podupit -- tada ANY() ispravno gleda njene elemente.
  select coalesce(
    (
      select array_agg(x)
      from unnest(p1.food_favorites) as x
      where x = any(p2.food_favorites)
    ),
    array[]::text[]
  )
  from profiles p1
  join profiles p2 on p2.id = other_id
  where p1.id = viewer_id and auth.uid() = viewer_id;
$$;

grant execute on function get_secret_room_food_match(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Trenutno UZIVO brojac (koliko ima realno aktivnih runda) -- realan
-- broj, nikad izmisljen (sekcija 4 spec-a to eksplicitno trazi).
-- ---------------------------------------------------------------------

create or replace function get_secret_room_live_count()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from secret_room_rounds where status = 'active' and expires_at > now();
$$;

grant execute on function get_secret_room_live_count() to authenticated;

-- =====================================================================
-- MIGRACIJA 0014: Muvaj (Upoznavanje/Krevet/Nista) + 18+ Muvanje + Boost
-- (vidi supabase/migrations/0014_muvaj_krevet_18plus.sql)
-- =====================================================================

-- MUVAJ 3-izbora (Upoznavanje / Krevet / Ništa) + "18+ Muvanje" (zamena za
-- Tajnu sobu) + nestajuće plaćene slike + plaćeni Boost. Sve idempotentno
-- (create table/index/policy if not exists / drop+create) -- vidi
-- migraciju 0013 za isti obrazac i objasnjenje zasto je to neophodno.
--
-- Ne diramo Tajnu sobu tabele (secret_room_*) -- ostaju u bazi neiskoriscene,
-- bezbednije nego brisanje. Nav/kod jednostavno prestaju da ih koriste.

-- ---------------------------------------------------------------------
-- KONFIGURACIJA
-- ---------------------------------------------------------------------

create table if not exists muvaj_config (
  key text primary key,
  value text not null,
  description text,
  updated_at timestamptz not null default now()
);

drop trigger if exists muvaj_config_set_updated_at on muvaj_config;
create trigger muvaj_config_set_updated_at before update on muvaj_config
  for each row execute function set_updated_at();

insert into muvaj_config (key, value, description) values
  ('krevet_reveal_cost_credits', '1', 'Koliko Credits-a kosta otkljucavanje "neko hoce s tobom u krevet" (kada nije Premium)'),
  ('candidates_per_batch', '15', 'Broj kandidata po ucitavanju u 18+ Muvanje'),
  ('media_expiry_minutes', '5', 'Koliko minuta placeni sadrzaj (foto/video) ostaje dostupan pre nego sto se trajno obrise ako niko ne otkljuca'),
  ('boost_price_cents', '299', 'Cena 60-minutnog Boost-a u centima'),
  ('boost_currency', 'eur', 'Valuta za Boost placanje'),
  ('boost_duration_minutes', '60', 'Koliko traje Boost')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- KREVET SIGNALI -- "krevet" izbor u Muvaj salje SLEP (identitet skriven)
-- notifikaciju primaocu, isti princip kao Tajna soba RIZIKUJ (migracija
-- 0013): primalac mora da plati (ili je Premium) da otkrije KO je poslao.
-- Match NASTAJE odvojeno -- cim primalac i sam, bilo kada, u svom Muvaj
-- feed-u, izabere "upoznavanje" ili "krevet" prema posiljaocu (videti
-- muvaj_choose ispod) -- placanje ovde je samo za brzo zadovoljenje
-- radoznalosti, nije jedini put do match-a.
-- ---------------------------------------------------------------------

create table if not exists krevet_signals (
  id uuid primary key default gen_random_uuid(),
  from_profile_id uuid not null references profiles(id) on delete cascade,
  to_profile_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'revealed')),
  revealed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (from_profile_id, to_profile_id),
  check (from_profile_id <> to_profile_id)
);

create index if not exists krevet_signals_to_idx on krevet_signals (to_profile_id, status);
create index if not exists krevet_signals_from_idx on krevet_signals (from_profile_id);

alter table krevet_signals enable row level security;

drop policy if exists "ucesnici vide svoj signal" on krevet_signals;
create policy "ucesnici vide svoj signal"
  on krevet_signals for select using (auth.uid() = from_profile_id or auth.uid() = to_profile_id);

drop policy if exists "admin vidi sve krevet signale" on krevet_signals;
create policy "admin vidi sve krevet signale"
  on krevet_signals for select using (is_admin());

-- Isti princip kao secret_room_requests (migracija 0013): primalac ne sme
-- da vidi from_profile_id dok ne plati/otkljuca -- kolonski restriktovano.
revoke select on krevet_signals from authenticated;
grant select (id, to_profile_id, status, revealed_at, created_at) on krevet_signals to authenticated;

-- ---------------------------------------------------------------------
-- BOOST (60 min placena vidljivost) -- prost pristup, jedan aktivan
-- Boost po korisniku (isti obrazac kao hot_mode_expires_at).
-- ---------------------------------------------------------------------

alter table profiles add column if not exists boost_expires_at timestamptz;
create index if not exists profiles_boost_idx on profiles (boost_expires_at) where boost_expires_at is not null;

-- Boost kupovina se evidentira kao credit_transactions red sa amount=0
-- (samo za idempotenciju/istoriju u Stripe webhook-u -- ne dira Credits
-- stanje) -- zato dodajemo 'boost_purchase' u dozvoljene razloge.
alter table credit_transactions drop constraint if exists credit_transactions_reason_check;
alter table credit_transactions add constraint credit_transactions_reason_check
  check (reason in ('purchase', 'unlock_spend', 'admin_adjustment', 'refund', 'boost_purchase'));

-- ---------------------------------------------------------------------
-- NESTAJUCE PLACENE SLIKE -- rok posle kog se original TRAJNO brise (API
-- cron ruta cita ove kolone i zove Storage.remove -- SQL sam ne moze da
-- brise fajlove, samo evidenciju).
-- ---------------------------------------------------------------------

alter table night_flirting_content add column if not exists expires_at timestamptz;
alter table night_flirting_content add column if not exists media_deleted_at timestamptz;
create index if not exists night_flirting_content_expiry_idx
  on night_flirting_content (expires_at) where media_deleted_at is null and expires_at is not null;

-- ---------------------------------------------------------------------
-- muvaj_choose -- "Upoznavanje" / "Krevet" / "Ništa" na jednu profilnu
-- sliku. Match nastaje cim POSTOJI obostrano pozitivan izbor (bilo koja
-- kombinacija upoznavanje/krevet), u bilo kom smeru/redosledu.
-- ---------------------------------------------------------------------

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
  else -- 'krevet'
    insert into krevet_signals (from_profile_id, to_profile_id) values (viewer_id, target_id)
    on conflict (from_profile_id, to_profile_id) do nothing;

    select name into v_my_name from profiles where id = viewer_id;
    insert into notifications (profile_id, type, title, body, data)
      values (
        target_id, 'krevet_signal', '😈 Neko hoće s tobom u krevet',
        'Otključaj da vidiš ko je to.', jsonb_build_object('fromHidden', true)
      );
  end if;

  -- Obostrano pozitivan izbor u BILO KOJOJ kombinaciji (likes UNION
  -- krevet_signals, oba smera) -- vidi komentar iznad funkcije.
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

-- ---------------------------------------------------------------------
-- get_muvaj_pending_krevet_count -- za bedz na nav ikonici (bez otkrivanja
-- identiteta).
-- ---------------------------------------------------------------------

create or replace function get_muvaj_pending_krevet_count(viewer_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from krevet_signals
  where to_profile_id = viewer_id and status = 'pending' and auth.uid() = viewer_id;
$$;

grant execute on function get_muvaj_pending_krevet_count(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- get_muvaj_pending_krevet_list -- lista (bez identiteta) za "18+ Muvanje"
-- ekran gde korisnik bira koji "misteriozni" signal da otkljuca.
-- ---------------------------------------------------------------------

-- Menjamo RETURNS TABLE kolone (dodajemo from_photo_url) -- Postgres NE
-- dozvoljava "create or replace" kad se menja OUT-parametar lista, mora
-- eksplicitan drop prvo (isti gotcha kao promena parametara, samo za
-- povratni tip -- vidi migraciju 0012 za prvi primer u ovom projektu).
drop function if exists get_muvaj_pending_krevet_list(uuid);

create or replace function get_muvaj_pending_krevet_list(viewer_id uuid)
returns table (signal_id uuid, created_at timestamptz, from_photo_url text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from viewer_id then
    raise exception 'Nije dozvoljeno.';
  end if;

  -- NAPOMENA: from_photo_url OVDE nije "otkrivanje identiteta" -- to je
  -- obicna profilna slika (vec javno vidljiva svima drugde u appu, npr.
  -- u "Pozovi nekoga u krevet" gridu ispod), samo obicnim CSS blur-om
  -- zamagljena na klijentu dok se veza SLIKA<->OVAJ KONKRETAN SIGNAL ne
  -- otkljuca -- isti bezbednosni nivo kao "Ko te zeli" tizer (vidi
  -- UnlockCard/LikerLockedCard komentare). Ime/godine/grad OSTAJU skriveni.
  return query
  select k.id, k.created_at,
    (select pp.url from profile_photos pp where pp.profile_id = k.from_profile_id and pp.is_primary = true and pp.moderation_status = 'approved' limit 1)
  from krevet_signals k
  where k.to_profile_id = viewer_id and k.status = 'pending'
  order by k.created_at desc;
end;
$$;

grant execute on function get_muvaj_pending_krevet_list(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- muvaj_reveal_krevet -- placeno otkljucavanje "ko je to" (osim Premium).
-- Isti obrazac kao unlock_night_content / secret_room_respond_request.
-- NAPOMENA: ovo NE pravi match samo po sebi -- match nastaje iskljucivo
-- kroz muvaj_choose (obostrano pozitivan izbor), namerno odvojeno.
-- ---------------------------------------------------------------------

create or replace function muvaj_reveal_krevet(viewer_id uuid, p_signal_id uuid)
returns table (ok boolean, error text, from_id uuid, from_name text, from_birth_date date, from_city text, from_photo_url text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sig krevet_signals%rowtype;
  v_is_premium boolean;
  v_cost int;
  v_balance int;
begin
  if auth.uid() is distinct from viewer_id then
    return query select false, 'Nije dozvoljeno.'::text, null::uuid, null::text, null::date, null::text, null::text; return;
  end if;

  select * into v_sig from krevet_signals where id = p_signal_id;
  if v_sig.id is null or v_sig.to_profile_id <> viewer_id then
    return query select false, 'Signal ne postoji.'::text, null::uuid, null::text, null::date, null::text, null::text; return;
  end if;

  if v_sig.status = 'revealed' then
    -- vec otkljucano ranije -- idempotentno, samo vrati podatke ponovo
    return query
    select true, null::text, p.id, p.name, p.birth_date, p.city,
      (select pp.url from profile_photos pp where pp.profile_id = p.id and pp.is_primary = true and pp.moderation_status = 'approved' limit 1)
    from profiles p where p.id = v_sig.from_profile_id;
    return;
  end if;

  select exists(
    select 1 from subscriptions
    where profile_id = viewer_id and status = 'active'
      and (current_period_end is null or current_period_end > now())
  ) into v_is_premium;

  if not v_is_premium then
    select coalesce(value::int, 1) into v_cost from muvaj_config where key = 'krevet_reveal_cost_credits';
    select balance_credits into v_balance from wallets where profile_id = viewer_id;
    if coalesce(v_balance, 0) < v_cost then
      return query select false, 'insufficient_credits'::text, null::uuid, null::text, null::date, null::text, null::text; return;
    end if;
    update wallets set balance_credits = balance_credits - v_cost where profile_id = viewer_id;
    insert into credit_transactions (profile_id, amount, reason)
      values (viewer_id, -v_cost, 'unlock_spend');
  end if;

  update krevet_signals set status = 'revealed', revealed_at = now() where id = p_signal_id;

  return query
  select true, null::text, p.id, p.name, p.birth_date, p.city,
    (select pp.url from profile_photos pp where pp.profile_id = p.id and pp.is_primary = true and pp.moderation_status = 'approved' limit 1)
  from profiles p where p.id = v_sig.from_profile_id;
end;
$$;

grant execute on function muvaj_reveal_krevet(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- get_18plus_candidates -- isti scoring kao discover_profiles, ali
-- filtrirano SAMO na korisnike koji su BAR JEDNOM izabrali "krevet" u
-- Muvaj (poslali krevet_signals kao posiljalac) -- tacno kako je trazeno.
-- Boost (profiles.boost_expires_at aktivan) dobija veliki bonus poena.
-- ---------------------------------------------------------------------

create or replace function get_18plus_candidates(viewer_id uuid, result_limit int default 15)
returns table (
  id uuid, name text, birth_date date, city text, bio text,
  primary_photo_url text, is_boosted boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gender text;
  v_interests text[];
  v_lat double precision;
  v_lng double precision;
  v_interested_in text[];
  v_age_min smallint;
  v_age_max smallint;
begin
  if auth.uid() is distinct from viewer_id then
    raise exception 'Nije dozvoljeno.';
  end if;

  select profiles.gender, profiles.interests, profiles.lat, profiles.lng
    into v_gender, v_interests, v_lat, v_lng
  from profiles where profiles.id = viewer_id;

  select interested_in, age_min, age_max
    into v_interested_in, v_age_min, v_age_max
  from preferences where profile_id = viewer_id;

  return query
  select p.id, p.name, p.birth_date, p.city, p.bio,
    (select pp.url from profile_photos pp where pp.profile_id = p.id and pp.is_primary = true and pp.moderation_status = 'approved' limit 1),
    (p.boost_expires_at is not null and p.boost_expires_at > now())
  from profiles p
  join preferences pref on pref.profile_id = p.id
  where p.id <> viewer_id
    and p.deleted_at is null
    and p.is_discoverable = true
    and p.gender = any(coalesce(v_interested_in, array[]::text[]))
    and v_gender = any(coalesce(pref.interested_in, array[]::text[]))
    and date_part('year', age(p.birth_date)) between coalesce(v_age_min, 18) and coalesce(v_age_max, 99)
    and exists (select 1 from krevet_signals ks where ks.from_profile_id = p.id)
    and not exists (
      select 1 from blocks b
      where (b.blocker_id = viewer_id and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = viewer_id)
    )
    and not exists (select 1 from passes ps where ps.from_profile_id = viewer_id and ps.to_profile_id = p.id)
    and not exists (select 1 from likes l where l.from_profile_id = viewer_id and l.to_profile_id = p.id)
    and not exists (select 1 from krevet_signals ks2 where ks2.from_profile_id = viewer_id and ks2.to_profile_id = p.id)
  order by
    (p.boost_expires_at is not null and p.boost_expires_at > now()) desc,
    (
      case when coalesce(array_length(v_interests, 1), 0) = 0 or coalesce(array_length(p.interests, 1), 0) = 0 then 30
      else (select count(*) from unnest(p.interests) i where i = any(v_interests))::numeric
           / greatest(array_length(v_interests, 1), 1) * 100
      end
      + coalesce(p.profile_completion_score, 0)
      + greatest(0, 7 - extract(day from (now() - p.last_active_at))) / 7 * 100
      + (
          case
            when v_lat is null or v_lng is null or p.lat is null or p.lng is null then 50
            else greatest(0, 100 - distance_km(v_lat, v_lng, p.lat, p.lng))
          end
        )
    ) desc
  limit result_limit;
end;
$$;

grant execute on function get_18plus_candidates(uuid, int) to authenticated;

-- ---------------------------------------------------------------------
-- send_night_flirting_content -- azurirano (parametri NEPROMENJENI, samo
-- telo -- "create or replace" je bezbedno bez drop-a, isto kao svugde
-- gde se menja SAMO telo funkcije) da postavi expires_at za PLACENI
-- (ne-green) sadrzaj -- disappearing-media zahtev. Green (besplatan)
-- sadrzaj nema rok, vec je odmah vidljiv.
-- ---------------------------------------------------------------------

create or replace function send_night_flirting_content(
  p_sender_id uuid,
  p_match_id uuid,
  p_kind text,
  p_original_path text,
  p_preview_path text,
  p_duration_seconds int,
  p_classification text,
  p_classifier_score numeric,
  p_moderation_status text,
  p_daily_limit int
)
returns table (content_id uuid, message_id uuid, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receiver_id uuid;
  v_profile_a uuid;
  v_profile_b uuid;
  v_sent_today int;
  v_content_id uuid;
  v_message_id uuid;
  v_is_free boolean;
  v_expiry_minutes int;
  v_expires_at timestamptz;
begin
  if auth.uid() is distinct from p_sender_id then
    return query select null::uuid, null::uuid, 'Nije dozvoljeno.'; return;
  end if;

  select profile_a_id, profile_b_id into v_profile_a, v_profile_b
  from matches where id = p_match_id and unmatched_at is null;

  if v_profile_a is null then
    return query select null::uuid, null::uuid, 'Ovaj razgovor više nije aktivan.'; return;
  end if;
  if p_sender_id <> v_profile_a and p_sender_id <> v_profile_b then
    return query select null::uuid, null::uuid, 'Nemaš pristup ovom razgovoru.'; return;
  end if;
  v_receiver_id := case when v_profile_a = p_sender_id then v_profile_b else v_profile_a end;

  if exists (
    select 1 from blocks b
    where (b.blocker_id = p_sender_id and b.blocked_id = v_receiver_id)
       or (b.blocker_id = v_receiver_id and b.blocked_id = p_sender_id)
  ) then
    return query select null::uuid, null::uuid, 'Ne možeš slati ovoj osobi.'; return;
  end if;

  select count(*) into v_sent_today
  from night_flirting_content
  where sender_id = p_sender_id and created_at >= date_trunc('day', now());

  if v_sent_today >= p_daily_limit then
    return query select null::uuid, null::uuid, 'Iskoristio/la si dnevni limit Noćnog muvanja.'; return;
  end if;

  v_is_free := p_classification = 'green';

  if not v_is_free then
    select coalesce(value::int, 5) into v_expiry_minutes from muvaj_config where key = 'media_expiry_minutes';
    v_expires_at := now() + make_interval(mins => v_expiry_minutes);
  end if;

  insert into night_flirting_content (
    match_id, sender_id, receiver_id, kind, original_path, preview_path,
    duration_seconds, classifier_score, classification, moderation_status, is_free, expires_at
  ) values (
    p_match_id, p_sender_id, v_receiver_id, p_kind, p_original_path, p_preview_path,
    p_duration_seconds, p_classifier_score, p_classification, p_moderation_status, v_is_free, v_expires_at
  ) returning id into v_content_id;

  insert into messages (match_id, sender_id, night_content_id)
  values (p_match_id, p_sender_id, v_content_id)
  returning id into v_message_id;

  return query select v_content_id, v_message_id, null::text;
end;
$$;

grant execute on function send_night_flirting_content(uuid, uuid, text, text, text, int, text, numeric, text, int) to authenticated;

-- ---------------------------------------------------------------------
-- unlock_night_content -- azurirano da odbije otkljucavanje ako je rok
-- (expires_at) vec prosao -- cak i za Premium (nema smisla "otkljucati"
-- nesto sto je vec obrisano ili ce svaki cas biti). Parametri nepromenjeni.
-- ---------------------------------------------------------------------

create or replace function unlock_night_content(p_viewer_id uuid, p_content_id uuid)
returns table (ok boolean, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_content night_flirting_content%rowtype;
  v_is_premium boolean;
  v_cost int;
  v_balance int;
begin
  if auth.uid() is distinct from p_viewer_id then
    return query select false, 'Nije dozvoljeno.'; return;
  end if;

  select * into v_content from night_flirting_content where id = p_content_id;
  if v_content.id is null then
    return query select false, 'Sadržaj nije pronađen.'; return;
  end if;
  if v_content.receiver_id <> p_viewer_id then
    return query select false, 'Nemaš pristup ovom sadržaju.'; return;
  end if;
  if v_content.moderation_status in ('rejected', 'pending_review') then
    return query select false, 'Ovaj sadržaj još nije dostupan.'; return;
  end if;
  if v_content.media_deleted_at is not null or (v_content.expires_at is not null and v_content.expires_at < now()) then
    return query select false, 'Sadržaj je istekao i više ne postoji.'; return;
  end if;

  if exists (select 1 from night_flirting_unlocks where content_id = p_content_id and unlocker_id = p_viewer_id) then
    return query select true, null::text; return;
  end if;

  select exists(
    select 1 from subscriptions
    where profile_id = p_viewer_id and status = 'active'
      and (current_period_end is null or current_period_end > now())
  ) into v_is_premium;

  if v_is_premium then
    insert into night_flirting_unlocks (content_id, unlocker_id, credits_spent, source)
    values (p_content_id, p_viewer_id, 0, 'premium');
    return query select true, null::text; return;
  end if;

  select coalesce(value::int, 1) into v_cost from night_flirting_config where key = 'unlock_cost_credits';
  select balance_credits into v_balance from wallets where profile_id = p_viewer_id;

  if coalesce(v_balance, 0) < v_cost then
    return query select false, 'Nemaš dovoljno Iskrica.'; return;
  end if;

  update wallets set balance_credits = balance_credits - v_cost where profile_id = p_viewer_id;
  insert into credit_transactions (profile_id, amount, reason, related_content_id)
    values (p_viewer_id, -v_cost, 'unlock_spend', p_content_id);
  insert into night_flirting_unlocks (content_id, unlocker_id, credits_spent, source)
    values (p_content_id, p_viewer_id, v_cost, 'credits');

  return query select true, null::text;
end;
$$;

grant execute on function unlock_night_content(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- PROFILE UNLOCKS -- korisnik NIKAD ne sme videti kompletan tudji profil
-- (bio, interesovanja, hrana, dodatne slike/video) bez Premium-a ili
-- placanja Credits-a. Primarna slika + ime/godine/grad ostaju besplatni
-- (to se vec vidi tokom Muvaj swipe-a, ne bi imalo smisla ponovo
-- sakrivati) -- sve OSTALO se NE SALJE klijentu dok nije otkljucano
-- (server-side, ne CSS-blur trik -- "da ne dodje do varanja").
-- ---------------------------------------------------------------------

create table if not exists profile_unlocks (
  id uuid primary key default gen_random_uuid(),
  viewer_id uuid not null references profiles(id) on delete cascade,
  target_id uuid not null references profiles(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  unique (viewer_id, target_id),
  check (viewer_id <> target_id)
);

create index if not exists profile_unlocks_viewer_idx on profile_unlocks (viewer_id);

alter table profile_unlocks enable row level security;

drop policy if exists "korisnik vidi svoja otkljucavanja" on profile_unlocks;
create policy "korisnik vidi svoja otkljucavanja"
  on profile_unlocks for select using (auth.uid() = viewer_id);

drop policy if exists "admin vidi sva otkljucavanja profila" on profile_unlocks;
create policy "admin vidi sva otkljucavanja profila"
  on profile_unlocks for select using (is_admin());

insert into muvaj_config (key, value, description) values
  ('profile_unlock_cost_credits', '1', 'Koliko Credits-a kosta otkljucavanje kompletnog profila (bio, interesovanja, dodatne slike) kada nije Premium')
on conflict (key) do nothing;

create or replace function unlock_profile_view(p_viewer_id uuid, p_target_id uuid)
returns table (ok boolean, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_premium boolean;
  v_cost int;
  v_balance int;
begin
  if auth.uid() is distinct from p_viewer_id then
    return query select false, 'Nije dozvoljeno.'; return;
  end if;
  if p_viewer_id = p_target_id then
    return query select true, null::text; return;
  end if;

  if exists (select 1 from profile_unlocks where viewer_id = p_viewer_id and target_id = p_target_id) then
    return query select true, null::text; return;
  end if;

  select exists(
    select 1 from subscriptions
    where profile_id = p_viewer_id and status = 'active'
      and (current_period_end is null or current_period_end > now())
  ) into v_is_premium;

  if v_is_premium then
    insert into profile_unlocks (viewer_id, target_id) values (p_viewer_id, p_target_id)
    on conflict (viewer_id, target_id) do nothing;
    return query select true, null::text; return;
  end if;

  select coalesce(value::int, 1) into v_cost from muvaj_config where key = 'profile_unlock_cost_credits';
  select balance_credits into v_balance from wallets where profile_id = p_viewer_id;

  if coalesce(v_balance, 0) < v_cost then
    return query select false, 'insufficient_credits'; return;
  end if;

  update wallets set balance_credits = balance_credits - v_cost where profile_id = p_viewer_id;
  insert into credit_transactions (profile_id, amount, reason)
    values (p_viewer_id, -v_cost, 'unlock_spend');
  insert into profile_unlocks (viewer_id, target_id) values (p_viewer_id, p_target_id)
    on conflict (viewer_id, target_id) do nothing;

  return query select true, null::text;
end;
$$;

grant execute on function unlock_profile_view(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 18+ DIREKTAN CHAT -- klik na nekoga u "Pozovi nekoga u krevet" odmah
-- otvara privatan chat (BEZ cekanja na obostrani match) -- ponovo
-- koristi POSTOJECI matches/messages sistem (nov "izvor" matcha), ali je
-- ruta ODVOJENA od /poruke (poruke ostaju iskljucivo za obican chat,
-- 18+ chat ide preko /18-plus/chat/[matchId]).
-- ---------------------------------------------------------------------

alter table matches drop constraint if exists matches_source_check;
alter table matches add constraint matches_source_check
  check (source in ('like', 'secret_spark', 'duel', '18plus'));

create or replace function start_18plus_chat(p_viewer_id uuid, p_target_id uuid)
returns table (match_id uuid, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_a uuid;
  v_b uuid;
  v_match_id uuid;
begin
  if auth.uid() is distinct from p_viewer_id then
    return query select null::uuid, 'Nije dozvoljeno.'; return;
  end if;
  if p_viewer_id = p_target_id then
    return query select null::uuid, 'Ne mozes kontaktirati sebe.'; return;
  end if;

  if exists (
    select 1 from blocks b
    where (b.blocker_id = p_viewer_id and b.blocked_id = p_target_id)
       or (b.blocker_id = p_target_id and b.blocked_id = p_viewer_id)
  ) then
    return query select null::uuid, 'Ne mozes kontaktirati ovog korisnika.'; return;
  end if;

  v_a := least(p_viewer_id, p_target_id);
  v_b := greatest(p_viewer_id, p_target_id);

  select id into v_match_id from matches where profile_a_id = v_a and profile_b_id = v_b and unmatched_at is null;

  if v_match_id is null then
    insert into matches (profile_a_id, profile_b_id, source)
      values (v_a, v_b, '18plus')
      returning id into v_match_id;
  end if;

  return query select v_match_id, null::text;
end;
$$;

grant execute on function start_18plus_chat(uuid, uuid) to authenticated;
