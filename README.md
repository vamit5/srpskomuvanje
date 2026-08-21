# Srpskomuvanje 🔥

Srpska dating PWA aplikacija — naziv **Srpskomuvanje**. Projekat i dalje živi u folderu
`iskra/` (samo naziv foldera na disku — ne utiče ni na šta što korisnik vidi; javi ako želiš da
i folder preimenujem). Promena naziva u budućnosti je mehanička (find & replace kroz kod, novi
domen, novo ime u `manifest.ts`/`layout.tsx`).

## Status: FAZA 1, 2, 3, 4 gotove + deo FAZE 6 (Tajni Srbin/Srpkinja, Duel)

**FAZA 1:**
- ✅ Next.js 16 (App Router, TypeScript, Tailwind v4, Turbopack)
- ✅ Supabase auth (email + lozinka), zaštićene rute (`src/proxy.ts`)
- ✅ Kompletna baza podataka (`supabase/schema.sql`) sa Row Level Security
- ✅ Osnovni UI: landing stranica, registracija, prijava, onboarding (skraćena verzija),
  5 glavnih ekrana sa donjom navigacijom (Sada / Otkrij / Match / Poruke / Profil)
- ✅ PWA: manifest, service worker, offline fallback, instalacija na Home Screen
- ✅ Tamna, premium tema sa pink→violet akcentom

**FAZA 2:**
- ✅ Upload fotografija (do 6) — kompresija i pravljenje thumbnail-a direktno u browseru,
  upload direktno u Supabase Storage, redosled/glavna slika, brisanje (i sa Storage-a)
- ✅ Upload videa (1, do 15s) — provera trajanja i thumbnail iz frejma u browseru
- ✅ Profile Completion Score se sada stvarno preračunava posle svake izmene (`src/lib/scoring.ts`)
- ✅ Profil stranica prikazuje pravu glavnu fotografiju

Testirano uživo na povezanom Supabase projektu: upload fotografije i videa, tačan
preračun procenta popunjenosti (50% → 75% → 90%), brisanje sa čišćenjem Storage-a — sve
radi end-to-end.

**FAZA 3:**
- ✅ Otkrij — swipe kartice (drag ili dugmad ❌ 🔥 ❤️, i strelice na tastaturi za desktop),
  sa pravim Discovery algoritmom (`discover_profiles` SQL funkcija) koji kombinuje
  poklapanje interesovanja, popunjenost profila, koliko je nedavno pravljen nalog i koliko
  je korisnik skoro aktivan — sve sa admin-podesivim težinama (`discovery_scoring_config`)
- ✅ Lajk / super lajk / preskoči, sa mutual-match logikom u bazi (`like_profile` SQL
  funkcija, atomski — nema race condition kad oboje lajkuju u istom trenu)
- ✅ Pravi "MATCH!" ekran sa animacijom kad se dvoje svide
- ✅ Match stranica prikazuje stvarne matcheve (foto, ime, godine)
- ✅ Sada prikazuje pravi broj "X te je lajkovalo" (bez otkrivanja identiteta — to je
  Premium fora za FAZU 8)

Testirano uživo sa 5 test naloga (naizmenično lajkovanje, kreiran pravi obostrani match,
proveren i "MATCH!" ekran i Match lista). Usput otkrivena i ispravljena prava trka u kodu
(fetch za nove profile je mogao da krene pre nego što se lajk upiše u bazu).

**FAZA 4:**
- ✅ Real-time chat po match-u (`/poruke/[matchId]`) — poruke stižu uživo obema stranama
  bez ručnog osvežavanja stranice (Supabase Realtime, `postgres_changes` na `messages` tabeli)
- ✅ Indikator "kuca..." (Realtime Broadcast, ne upisuje se u bazu)
- ✅ Status "pročitano" (✓ poslato → ✓✓ pročitano), uz privatnost — vidi se samo unutar
  match-a, ne javno
- ✅ Online status u chat headeru (poštuje `show_online_status` privacy podešavanje)
- ✅ Lista razgovora (`/poruke`) sa poslednjom porukom, nepročitanim brojem, sortirano po
  aktivnosti
- ✅ Prekini match (unmatch) — iz chata, sa potvrdom

Testirano uživo sa dva tab-a otvorena na isti razgovor istovremeno: poruka poslata iz jednog
taba se pojavila u drugom **bez osvežavanja stranice** — pravi real-time. Testiran i unmatch
(razgovor je nestao sa liste). "Pročitano"/"kuca..." indikatori su kodom ispravno dizajnirani
da se ne aktiviraju za sopstvene poruke, pa se ne mogu do kraja potvrditi sa jednim istim
nalogom u oba taba (mogu se testirati samo sa dva različita naloga) — ali koriste identičan,
već dokazan real-time kanal.

Usput otkrivena i ispravljena suptilna, ali ozbiljna greška: Realtime konekcija je krenula
PRE nego što se učita korisnička sesija, pa je server (zbog sigurnosnih pravila koja
proveravaju ko si) tiho odbacivao sve promene — konekcija je izgledala uspešno uspostavljena,
ali ništa nije stizalo. Ispravka: sačekati da se sesija učita pre nego što se pretplatimo na
promene.

**FAZA 6 (samo deo — Tajni Srbin/Srpkinja i Duel; Hot Mode/Noćni mod nisu još rađeni):**
- ✅ **Tajni Srbin/Srpkinja** (Secret Spark, sekcija 12 iz spec-a) — pošalji nekome anoniman
  signal na Otkrij kartici (🎭 dugme). Primalac dobija diskretno obaveštenje ("Tajni Srbin/
  Tajna Srpkinja misli da si zanimljiv/a") bez otkrivanja identiteta. Ako i on/ona pošalje
  tebi — otključava se poseban "OBOSTRANA PRIVLAČNOST!" ekran i match. Ne šalje se ništa
  pošiljaocu ako veza nije obostrana — to je poenta tajnosti.
- ✅ **Duel** ("A ili B?") — nova `/duel` stranica, dostupna sa linka na Sada. Pokazuje dva
  nasumična kompatibilna profila, glasanje ne šalje lajk niti bilo koga obaveštava, samo je
  igra/signal za algoritam.

Testirano uživo: poslat jednostran tajni signal (primalac dobio diskretno obaveštenje, bez
otkrivanja ko je poslao), pa obostran (odmah se pojavio "OBOSTRANA PRIVLAČNOST!" ekran, i
Match stranica ispravno označava taj match sa "🤫 tajni signal" bedžom, za razliku od
običnih matcheva). Duel testiran sa dva kandidata — glasanje ispravno učitava sledeći duel.
Usput otkrivena i ispravljena greška: `.single()` na Supabase RPC pozivu baca grešku kad
funkcija vrati nula redova (npr. nema dovoljno kandidata za Duel) — trebalo je čitati kao
niz i proveriti da li je prazan, ne oslanjati se na `.single()` da to sam otkrije.

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
   `verification-selfies`.
4. U SQL Editoru pokreni i [`supabase/storage-policies.sql`](supabase/storage-policies.sql) —
   podešava ko sme da čita/piše u ta tri bucket-a.
5. U **Project Settings → API** kopiraj `Project URL` i `anon public` ključ.
6. Kopiraj `.env.local.example` u `.env.local` i popuni te dve vrednosti.
7. Email potvrda naloga — dve opcije:
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
    lib/
      supabase/                  -- browser + server Supabase klijenti
      media/                     -- kompresija slika/videa u browseru (Canvas API)
      scoring.ts                 -- Profile Completion Score (jedina definicija, deljena svuda)
    proxy.ts                     -- auth middleware (Next.js 16: middleware.ts -> proxy.ts)
  public/
    sw.js                        -- service worker (ručno pisan, bez build-tool magije)
    icons/                       -- PWA ikonice (generisane iz brand/icon-source.svg)
  supabase/
    schema.sql                   -- kompletna šema baze + RLS politike
    storage-policies.sql         -- ko sme da čita/piše u photos/videos/verification-selfies
    migrations/                  -- inkrementalne izmene za projekte koji već imaju schema.sql
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
- [x] **FAZA 2** — profil, upload fotografija/videa, profile completion (stvarna logika)
- [x] **FAZA 3** — Otkrij (swipe), lajkovi, matchevi, Discovery algoritam
- [x] **FAZA 4** — real-time chat
- [ ] **FAZA 5** — "Sada" feed sa pravim aktivnostima
- [~] **FAZA 6** — Tajni Srbin/Srpkinja ✅, Duel ✅, Hot Mode ⬜, Noćni mod ⬜
- [ ] **FAZA 7** — push notifikacije (VAPID + service worker push handler je već spreman)
- [ ] **FAZA 8** — pretplate (Premium), Boost
- [ ] **FAZA 9** — moderacija sadržaja, admin panel
- [ ] **FAZA 10** — analytics, performance, security hardening, deploy na Vercel

## Odluke koje sam doneo bez pitanja (i zašto)

- **Email + lozinka** umesto telefon/SMS verifikacije za MVP auth — SMS provajderi (Twilio i sl.)
  koštaju po poruci, email je besplatan i Supabase ga podržava iz kutije. Telefonski broj/SMS OTP
  možemo dodati kasnije ako se pokaže da korisnici to očekuju.
- **Onboarding je skraćen na 5 koraka** (ime+datum+pol, koga tražiš, grad, opis, interesovanja)
  umesto punih 11 iz specifikacije — upload fotografija namerno nije u samom wizard-u, korisnik
  ga radi odmah posle na `/profil/foto` (koji sada postoji, FAZA 2). Kad hoćemo, lako je dodati
  fotografiju kao poslednji korak wizard-a — kod za upload je već gotov i deljiv.
- **Service worker je ručno pisan** (`public/sw.js`) umesto preko Serwist/Workbox biblioteke —
  Next.js 16 po difoltu koristi Turbopack za build, a ta biblioteka za sada zvanično ne
  podržava Turbopack (samo webpack). Ručni SW je jednostavniji, lakši za održavanje i radi
  identično u razvoju i produkciji.
- **Profile Completion Score** je namerno konzervativan (max 50% bez foto/videa, profilna slika
  nosi najviše bodova) da ne lažemo korisnika da mu je profil "kompletan" pre nego što stvarno
  ima sliku.
- **Upload ide direktno iz browsera u Supabase Storage, ne preko našeg servera.** Razlog:
  serverless platforme (Vercel) imaju tvrd limit veličine requesta (par MB) koji bi razbio
  upload videa. Slika/video se prvo kompresuje u browseru (Canvas API — ista tehnika uzgred
  briše EXIF/GPS metapodatke iz slike, dobro za privatnost), pa ide pravo u Storage, a naš
  server samo upiše red u bazu. Sigurnost je u Storage RLS pravilima
  (`supabase/storage-policies.sql`): svako sme da upload-uje/briše SAMO u svom folderu.
- **Nema automatske moderacije sadržaja fotografija/videa još** (NSFW/maloletnost detekcija —
  to je FAZA 9). Upload se odmah odobrava ("moderation_status: approved"). Ovo je prihvatljivo
  za razvoj/testiranje, ali **mora biti rešeno pre nego što aplikacija ide živim korisnicima** —
  vidi listu ispod.
- **Video se ne re-enkoduje/kompresuje** (samo se validira trajanje ≤15s i veličina ≤25MB u
  browseru) — nema jeftinog, pouzdanog načina da se to radi bez servera sa ffmpeg-om, što je
  van MVP budžeta. Ako fajl klijent snimi prevelik, dobija jasnu poruku da snimi kraći/manje
  kvalitetan klip.
- **Discovery algoritam i matching žive u bazi kao SQL funkcije** (`discover_profiles`,
  `like_profile`), ne u JavaScript kodu. Dva razloga: (1) `like_profile` mora biti atomska
  operacija (upiši lajk + proveri obostranost + napravi match + pošalji notifikacije) da ne
  bi dva istovremena lajka napravila duplirane/nepotpune matcheve; (2) obe funkcije su
  `SECURITY DEFINER` jer moraju da pročitaju tuđe podatke (preference, lajkove) koje RLS
  inače sakriva — sa internom proverom `auth.uid() = viewer_id` da niko ne može da pozove
  tuđi feed ili lajkuje u tuđe ime.
- **Dodata je "passes" tabela** (nije bila u originalnom spisku) — bez pamćenja koga si
  već preskočio/la, isti profil bi se vrteo ukrug u Otkrij feed-u.
- **"Ko te je lajkovao" na Sada pokazuje samo broj, ne identitet** — namerno, to je prirodno
  mesto za Premium foru (sekcija 20 "Ko te želi") kad dođemo do FAZE 8. Broj je uvek stvaran,
  nikad izmišljen.
- **Realtime kanal mora sačekati `supabase.auth.getSession()` pre `subscribe()`.** Suptilan
  Supabase gotcha: ako se pretplatiš pre nego što se sesija učita, konekcija se "uspešno"
  poveže, ali server tiho ne šalje NIŠTA (sigurnosna pravila ne znaju ko si). Ovo je
  dokumentovano u kodu (`ChatThread.tsx`) da se ne zaboravi kod sledećeg real-time ekrana
  (npr. "ko je online" u kasnijoj fazi).
- **Block/Report dugmad nisu još u chatu** iako ih spec pominje uz chat (sekcija 18) —
  namerno odloženo za FAZU 9 kad pravimo i moderation queue/admin pregled prijava, da ne
  gradimo dugme koje vodi u prazno. Unmatch (koji ne zahteva admin infrastrukturu) je gotov
  sada.

## Pre nego što pravi (nepoznati) korisnici počnu da uploaduju slike

Ovo NIJE hitno dok samo ti i ja testiramo, ali ne sme se preskočiti pre javnog lansiranja:

- [ ] Automatska NSFW/sadržajna moderacija fotografija i videa (FAZA 9) — trenutno ništa ne
      sprečava neprikladan upload da odmah bude vidljiv.
- [ ] Provera maloletnosti / signali za moderatora (FAZA 9).
- [ ] Admin panel sa redom za pregled prijavljenog sadržaja (FAZA 9).

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
