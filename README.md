# Srpskomuvanje 🔥

Srpska dating PWA aplikacija — naziv **Srpskomuvanje**. Projekat i dalje živi u folderu
`iskra/` (samo naziv foldera na disku — ne utiče ni na šta što korisnik vidi; javi ako želiš da
i folder preimenujem). Promena naziva u budućnosti je mehanička (find & replace kroz kod, novi
domen, novo ime u `manifest.ts`/`layout.tsx`).

## Status: FAZA 1 gotova

- ✅ Next.js 16 (App Router, TypeScript, Tailwind v4, Turbopack)
- ✅ Supabase auth (email + lozinka), zaštićene rute (`src/proxy.ts`)
- ✅ Kompletna baza podataka (`supabase/schema.sql`) sa Row Level Security
- ✅ Osnovni UI: landing stranica, registracija, prijava, onboarding (skraćena verzija),
  5 glavnih ekrana sa donjom navigacijom (Sada / Otkrij / Match / Poruke / Profil)
- ✅ PWA: manifest, service worker, offline fallback, instalacija na Home Screen
- ✅ Tamna, premium tema sa pink→violet akcentom

Ekrani Otkrij / Match / Poruke trenutno prikazuju iskren "uskoro" placeholder — nema
izmišljenih lajkova, matcheva ili poruka. Prava logika (swipe, matching, chat) dolazi u
narednim fazama (vidi mapu puta ispod).

## Tech stack i zašto

| Deo | Izbor | Zašto |
|---|---|---|
| Frontend | Next.js 16 (App Router) + React 19 | Server Components = manje JS-a na telefonu, PWA-friendly, jedan repo za sve |
| Baza / Auth / Storage / Realtime | Supabase (Postgres) | Besplatan tier pokriva ceo MVP, RLS rešava security "iz kutije", realtime kanali idealni za chat/online status |
| Stilovi | Tailwind CSS v4 | Brzo, malo CSS-a u finalnom bundlu |
| Hosting | Vercel | Besplatan tier, najbolja integracija sa Next.js, deploy iz git push-a |
| Push notifikacije | Web Push (VAPID) preko service workera | Besplatno, radi na Androidu i noviji iOS (16.4+) kad je app instalirana na Home Screen |

Nema AWS-a, nema mesečnih fiksnih troškova dok ne narastemo iznad besplatnih limita
(Supabase: 500MB baze / 1GB storage / 50k mesečnih aktivnih korisnika; Vercel: velikodušan
besplatan tier za hobby/rani proizvod).

## Kako pokrenuti lokalno

```bash
cd iskra
npm install
npm run dev
```

Otvara se na `http://localhost:3000`.

### Poveži Supabase (obavezno pre nego što auth/baza rade)

1. Napravi besplatan nalog na [supabase.com](https://supabase.com) i novi projekat (izaberi
   region blizu Srbije, npr. Frankfurt).
2. U **SQL Editor** nalepi ceo sadržaj [`supabase/schema.sql`](supabase/schema.sql) i pokreni.
   Ovo pravi sve tabele, sigurnosna pravila i podrazumevane vrednosti.
3. U **Storage** napravi tri bucket-a (imena tačno ovako): `photos`, `videos`,
   `verification-selfies` — ovo aktiviramo u FAZI 2.
4. U **Project Settings → API** kopiraj `Project URL` i `anon public` ključ.
5. Kopiraj `.env.local.example` u `.env.local` i popuni te dve vrednosti.
6. Email potvrda naloga — dve opcije:
   - **Brže za sada (preporuka za lokalno testiranje):** Authentication → Sign In / Providers →
     Email → isključi "Confirm email". Korisnik tada odmah upada u onboarding posle registracije,
     bez čekanja na mejl.
   - **Ako ostaje uključeno** (preporučeno pred pravi lansiranje): Authentication → Email
     Templates → "Confirm signup" → zameni link u templateu na:
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/onboarding`
     (podrazumevano tamo stoji `{{ .ConfirmationURL }}` — to zameni). Kod za tu rutu
     (`src/app/auth/confirm/route.ts`) je već gotov.

Bez ovog koraka: landing stranica i navigacija rade, ali registracija/prijava neće moći da
stvarno sačuvaju korisnika (Supabase URL je trenutno placeholder u `.env.local`).

## Struktura projekta

```
iskra/
  src/
    app/
      (marketing)/page.tsx      -- landing (/ )
      (auth)/prijava, registracija
      onboarding/                -- kreiranje profila posle registracije
      (app)/sada, otkrij, match, poruke, profil  -- glavni ekrani (zaštićeni)
      manifest.ts                -- PWA manifest
      offline/                   -- offline fallback stranica
    components/
      nav/BottomNav.tsx
      ui/                        -- Button, Input, EmptyState
      pwa/ServiceWorkerRegister.tsx
    lib/supabase/                -- browser + server Supabase klijenti
    proxy.ts                     -- auth middleware (Next.js 16: middleware.ts -> proxy.ts)
  public/
    sw.js                        -- service worker (ručno pisan, bez build-tool magije)
    icons/                       -- PWA ikonice (generisane iz brand/icon-source.svg)
  supabase/schema.sql            -- kompletna šema baze + RLS politike
  scripts/generate-icons.mjs     -- pokreni ponovo kad dobijemo pravi logo
```

## Napomena o brendu

`brand/icon-source.svg` je privremen logo-mark (spark oblik, pink→violet gradijent na
tamnoj pozadini) — placeholder dok ne napravimo pravi vizuelni identitet. Kad imamo pravi
logo, zameni taj SVG i pokreni:

```bash
node scripts/generate-icons.mjs
```

## Mapa puta (iz specifikacije, sekcija 48)

- [x] **FAZA 1** — arhitektura, baza, auth, osnovni UI, PWA
- [ ] **FAZA 2** — profil, upload fotografija/videa, profile completion (stvarna logika)
- [ ] **FAZA 3** — Otkrij (swipe), lajkovi, matchevi, Discovery algoritam
- [ ] **FAZA 4** — real-time chat
- [ ] **FAZA 5** — "Sada" feed sa pravim aktivnostima
- [ ] **FAZA 6** — Tajna iskra, Duel, Hot Mode, Noćni mod
- [ ] **FAZA 7** — push notifikacije (VAPID + service worker push handler je već spreman)
- [ ] **FAZA 8** — pretplate (Premium), Boost
- [ ] **FAZA 9** — moderacija sadržaja, admin panel
- [ ] **FAZA 10** — analytics, performance, security hardening, deploy na Vercel

## Odluke koje sam doneo bez pitanja (i zašto)

- **Email + lozinka** umesto telefon/SMS verifikacije za MVP auth — SMS provajderi (Twilio i sl.)
  koštaju po poruci, email je besplatan i Supabase ga podržava iz kutije. Telefonski broj/SMS OTP
  možemo dodati kasnije ako se pokaže da korisnici to očekuju.
- **Onboarding je skraćen na 5 koraka** (ime+datum+pol, koga tražiš, grad, opis, interesovanja)
  umesto punih 11 iz specifikacije — upload fotografija namerno nije uključen jer photo
  pipeline (kompresija, WebP, thumbnail) dolazi tek u FAZI 2. Kad to bude gotovo, dodajemo
  korak za fotografije i onboarding postaje kompletan.
- **Service worker je ručno pisan** (`public/sw.js`) umesto preko Serwist/Workbox biblioteke —
  Next.js 16 po difoltu koristi Turbopack za build, a ta biblioteka za sada zvanično ne
  podržava Turbopack (samo webpack). Ručni SW je jednostavniji, lakši za održavanje i radi
  identično u razvoju i produkciji.
- **Profile Completion Score** je namerno konzervativan (max ~60% bez foto/videa) da ne lažemo
  korisnika da mu je profil "kompletan" pre nego što stvarno ima sliku.

## Šta može biti skupo kasnije (na radaru, ne hitno)

- **Video/foto storage i transformacije** — Supabase Storage naplaćuje po GB kad pređeš
  besplatan limit (1GB). Sa puno korisnika i 10s video klipova ovo raste brzo — rešenje:
  agresivna kompresija na klijentu pre uploada (FAZA 2) + eventualni prelazak na Cloudinary
  free/pay-as-you-go tier za transformacije (imamo iskustva sa Cloudinary iz drugog projekta —
  slična ideja radi i ovde).
- **SMS verifikacija** ako je kasnije uvedemo — po poruci se plaća.
- **Push notifikacije na velikom broju korisnika** — same po sebi besplatne (Web Push), ali
  compute za slanje (cron job / edge function) raste sa brojem korisnika.

Ništa od ovoga nije problem sada — sve navedeno postaje relevantno tek kad aplikacija ima
realan broj aktivnih korisnika.
