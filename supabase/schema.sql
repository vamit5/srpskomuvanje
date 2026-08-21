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

create table messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  content text,
  image_url text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  deleted_at timestamptz,
  check (content is not null or image_url is not null)
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
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_profile_idx on subscriptions (profile_id);

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

-- =====================================================================
-- Storage: napravi ove bucket-e ručno u Supabase dashboard -> Storage
-- (imena moraju biti tačno ovako, kod ih referencira):
--   - "photos"                (javno čitanje, upload samo vlasnik)
--   - "videos"                (javno čitanje, upload samo vlasnik)
--   - "verification-selfies"  (privatno -- čita samo admin + vlasnik)
-- Storage RLS politike se podešavaju u dashboard-u ili posebnim SQL-om
-- kad budemo radili FAZU 2 (photo/video upload).
-- =====================================================================
