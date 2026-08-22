# Srpskomuvanje 🔥

Srpska dating PWA aplikacija — naziv **Srpskomuvanje**. Projekat i dalje živi u folderu
`iskra/` (samo naziv foldera na disku — ne utiče ni na šta što korisnik vidi; javi ako želiš da
i folder preimenujem). Promena naziva u budućnosti je mehanička (find & replace kroz kod, novi
domen, novo ime u `manifest.ts`/`layout.tsx`).

## Status: FAZA 1-8 uživo na produkciji (srpskomuvanje.vercel.app, Stripe Live) + deo FAZE 9

**Live na adresi**: https://srpskomuvanje.vercel.app (Vercel, auto-deploy na svaki push na `main`
grane GitHub repozitorijuma `vamit5/srpskomuvanje`). Stripe je u **Live režimu** — Premium
plaćanja su prava, ne test.

**FAZA 10 (deo — Deploy, uživo je otkriven i ispravljen jedan pravi bag):**
- ✅ Deploy na Vercel, povezan sa GitHub-om (auto-deploy na push)
- ✅ Supabase Site URL/Redirect URLs ažurirani na produkcioni domen
- ✅ Email potvrda naloga uključena (Confirm email), sa custom SMTP-om (Brevo, jer Supabase-ov
  besplatni ugrađeni email servis ima jako mali limit slanja i ne dozvoljava izmenu templejta)
- ✅ Confirm signup email templejt preveden na srpski i usmeren na `/auth/confirm` rutu
- ✅ Uslovi korišćenja + Politika privatnosti (nove javne stranice, obavezno prihvatanje pri
  registraciji) — pre javnog lansiranja i reklame
- ✅ Stripe prebačen sa test na Live režim (novi live secret key, live Price ID, live webhook)

**Pravi bag otkriven i ispravljen uživo na produkciji:** auth middleware (`src/proxy.ts`) je
štitio SVE rute uključujući `/api/stripe/webhook` — kad Stripe pošalje webhook (nema "ulogovanog
korisnika"/kolačić), middleware ga je preusmeravao (307) na `/prijava` umesto da pusti webhook da
radi. Otkriveno preko Stripe Dashboard → Webhooks → failed deliveries. Ispravljeno izuzimanjem
`/api/*` ruta iz middleware matcher-a — API rute imaju sopstvenu proveru (Stripe potpis), ne
treba im cookie-based auth gate.

Nije još urađeno (ostatak FAZE 10): Analytics dashboard UI, dodatni performance/security
hardening. Vidi i FAZA 8/9 liste ispod za preostale stavke u tim fazama.

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

**FAZA 6 (kompletna):**
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

- ✅ **Hot Mode** (sekcija 13) — prekidač i izbor "vibe"-ova (Flert/Vrelo/Večeras/Piće/Izlazak)
  na Profil ekranu, traje dok ga korisnik sam ne isključi. Već se prikazuje kao bedž na
  Otkrij karticama (od FAZE 3).
- ✅ **Večeras** (sekcija 15) — brzi izbor na Sada ekranu (Flert/Piće/Izlazak/Upoznavanje),
  automatski ističe u 04:00 po beogradskom vremenu (ne po vremenu servera — Vercel je
  obično UTC, pa je ovo namerno rešeno preko `Europe/Belgrade` vremenske zone).
- ✅ **Noćni mod** (sekcija 14) — Sada ekran se menja između 22:00–04:00 (podesivo u bazi,
  `night_modes` tabela): naslov postaje "😏 Ko je još budan?", i prikazuje se stvarna lista
  ljudi koji su trenutno u Hot Mode-u i odgovaraju tvom tipu — real-time, nema izmišljenih
  profila.

Testirano uživo: Hot Mode uključen na jednom nalogu → odmah se pojavio na Sada ekranu
DRUGOG (kompatibilnog) naloga u "Hot Mode sada" listi, sa tačnim imenom/godinama. "Večeras"
dugmad testirana — status ispravno pokazuje "aktivan do 04:00" i vidljiv je drugim nalozima.
Logika za beogradsko vreme (uključujući prelazak preko ponoći i letnje/zimsko računanje
vremena) testirana odvojenim skriptom sa konkretnim datumima pre ugrađivanja u app.

Nijedna nova SQL migracija nije bila potrebna — sve potrebne kolone/tabele su već postojale
od FAZE 1 (dizajnirane unapred baš za ovo).

**FAZA 9 (samo deo — Prijavi/Blokiraj + Admin panel; automatska NSFW/sadržajna moderacija
i dalje ne postoji):**
- ✅ **Prijavi** i **Blokiraj** dugmad u chatu (meni "⋮" pored imena) — prijava ide pravo
  admin redu za pregled; blokiranje odmah prekida match/razgovor i sklanja tu osobu iz
  budućeg Otkrij feed-a (obostrano).
- ✅ **Admin panel** (`/admin`, samo za naloge upisane u `admin_users`) — pregled (broj
  korisnika, novih danas, aktivnih 24h, matchevi, poruke, otvorene prijave), red za prijave
  sa dugmadima Reši / Odbaci / Sakrij profil, i lista korisnika sa prekidačem
  vidljivosti (Otkrij feed).

Testirano uživo: poslata prijava iz chata → pojavila se u `/admin/reports` sa tačnim
podacima → "Reši" je uklanja iz reda. "Sakrij profil" i "Blokiraj" testirani i potvrđeni
(blokiranje je odmah uklonilo osobu iz liste razgovora). Ne-admin nalog je ispravno
preusmeren sa `/admin` na `/sada`.

Usput otkrivene i ispravljene **dve prave bezbednosne/tačnosti greške**:
1. `admin_users` tabela nikad nije imala uključen RLS (od FAZE 1!) — svako je teoretski
   mogao direktno da čita ili čak upiše tu tabelu preko API-ja. Ispravljeno.
2. Admin statistika (matchevi, poruke) je prvo brojala samo ono što je ULOGOVANI admin
   lično učestvovao (jer RLS ograničava na "moje", a admin nije imao izuzetak) — brojevi su
   izgledali verovatno, ali su bili pogrešni. Dodate su prave admin-only politike da se broji
   stvarno sve u aplikaciji.

**FAZA 7 — Push notifikacije:**
- ✅ Prekidač "🔔 Push notifikacije" na Profil ekranu (traži dozvolu pregledača, pretplaćuje
  se preko service workera, čuva pretplatu u `push_subscriptions`)
- ✅ Server šalje pravu push notifikaciju (ne samo upisuje u bazu) za: **match** (i preko
  lajka i preko tajnog signala — sa istim "OBOSTRANA PRIVLAČNOST" tekstom), **novu poruku**,
  i **tajni signal** (diskretno, bez otkrivanja identiteta — isti tekst kao notifikacija u
  aplikaciji)
- ✅ VAPID ključevi generisani lokalno (`npx web-push generate-vapid-keys`, nema spoljni
  nalog); slanje ide preko `web-push` biblioteke sa Supabase `service_role` ključem (mora da
  čita tuđe pretplate, RLS to inače ne dozvoljava)
- ✅ Service worker se sada registruje UVEK (ranije samo u produkciji) — push se ne može
  testirati bez aktivne registracije, a naša cache strategija je dovoljno bezbedna i za dev

Testirano: poslata poruka posle kačenja push koda — server je odgovorio uspešno, bez
grešaka, dok nijedan nalog još nema aktivnu pretplatu (potvrđuje da kod ne ruši glavnu akciju
kad push nema kome da ode — realno stanje dok niko nije test-uređaj pretplatio). **Stvarnu
vizuelnu notifikaciju NISAM mogao da potvrdim** — moj test browser ima trajno blokirane
notifikacije (bezbednosna politika sandbox okruženja koju ne mogu da zaobiđem). Ti treba da
probaš na svom telefonu (uputstvo ispod) da vidiš pravu notifikaciju.

Bitna tehnička odluka: slanje push-a koristi Next.js `after()` API, ne običan
"ispali-pa-zaboravi" async poziv — na serverless hostingu (Vercel, kuda ćemo na kraju da
deploy-ujemo) bi se takav poziv mogao prekinuti pre nego što stigne da pošalje, jer se
funkcija gasi čim se odgovor pošalje korisniku. `after()` garantuje da se izvrši do kraja.

**FAZA 5 — "Sada" ekran, dovršen (ranije rađen samo delimično usput kroz druge faze):**
- ✅ **Blizu sada** (sekcija 16) — dugme "Uključi lokaciju" (pravi geolocation API iz
  pregledača), pa "📍 X ljudi je u tvojoj blizini" (pravi broj, 25km radijus, samo kompatibilni
  ljudi). Tačna lokacija se NIKAD ne šalje drugima — samo broj/udaljenost.
- ✅ **Istaknuti profil** (💫) — profil koji se najviše uklapa sa tobom (≥70% Match Score),
  ponovo koristi već postojeći Discovery algoritam, nema novog koda za računanje.
- ✅ **Vrelo petak / vremenski događaji** (sekcija 25) — admin pravi događaj (`/admin/events`,
  nov tab), Sada ga prikazuje svima u tom gradu (ili svima ako je grad prazan) dok traje.

**Bezbednosna ispravka pre ovoga:** `profiles.lat`/`lng` kolone su od FAZE 1 bile čitljive
SVAKOM ulogovanom korisniku direktno preko API-ja (deo šire "javni profil" politike) — niko
ih dosad nije popunio pa ništa nije procurelo, ali smo morali zatvoriti pre nego što
korisnici počnu da dele pravu GPS lokaciju. Sad je `revoke select (lat, lng)` na nivou baze
— čak ni sopstveni red nije čitljiv direktno, samo kroz posebne funkcije koje računaju
udaljenost, nikad ne vraćaju sirove koordinate.

Testirano uživo (uz jedan trik): moj test pregledač ima trajno odbijenu dozvolu za lokaciju
(isto sandbox ograničenje kao za push notifikacije), pa sam simulirao pravi GPS API
(`navigator.geolocation.getCurrentPosition`) sa poznatim koordinatama da testiram STVARNI
kod, ne zaobilazan put. Sa dva naloga na različitim (bliskim) koordinatama: "📍 1 osoba je u
tvojoj blizini" — tačno. Vrelo petak događaj napravljen u admin panelu odmah se pojavio na
Sada ekranu, sa ispravnim vremenom do kraja.

Usput otkrivene i ispravljene **dve prave greške**:
1. `nearby_count` RPC poziv je čitao rezultat iz pogrešnog polja (`count` umesto `data` —
   PostgREST razlikuje ta dva, TypeScript to nije uhvatio) — broj je tiho uvek bio prazan.
2. Klasična React zamka: kad server (posle `router.refresh()`) pošalje sveže podatke
   komponenti koja ih čuva u `useState(initialX)`, React NE ažurira taj state sam od sebe
   (`useState`-ova početna vrednost se koristi samo pri prvom renderu). Pogodilo je i listu
   događaja u adminu i broj "ljudi u blizini" — oba ispravljena (drugo uz React-ov zvanično
   preporučen obrazac "podešavanje state-a tokom render-a", ne u efektu, da izbegnemo
   dodatni lint upozorenje o kaskadnim render-ima).

**FAZA 8 (deo — Premium pretplata preko Stripe-a; Boost i dodatni filteri još ne postoje):**
- ✅ **Stripe Checkout** — "Postani Premium" na Profil ekranu otvara pravu Stripe stranicu za
  plaćanje (hostuje je Stripe, mi nikad ne dodirujemo broj kartice). Radi u **test režimu** dok
  ne budemo spremni za prava plaćanja.
- ✅ **Webhook** (`/api/stripe/webhook`) prima potvrdu od Stripe-a i UPISUJE Premium status u
  bazu — korisnik ga ne dobija sam upisivanjem, samo pravom potvrdom plaćanja od Stripe-a.
- ✅ **"Ko te želi"** (`/ko-te-zeli`, sekcija 20) — Premium korisnici vide STVARAN identitet
  (foto, ime) svih koji su ih lajkovali, sa dugmetom da lajkuju nazad (odmah pravi match ako je
  obostrano). Besplatni nalozi vide samo broj + zamućen pregled + poziv da postanu Premium.
- ✅ **Dnevni limit Duela za besplatne naloge** (5 dnevno, po beogradskom danu) — Premium
  neograničeno.
- ✅ **Upravljanje pretplatom** — Premium korisnik ima dugme "Upravljaj pretplatom" koje vodi na
  Stripe-ov Billing Portal (sam menja karticu ili otkazuje, mi ne moramo da gradimo taj UI).

Testirano uživo: dugme "Postani Premium" ispravno kreira Stripe Checkout sesiju i preusmerava
na pravu (test-mode) Stripe stranicu za plaćanje, sa tačnim email-om i cenom. Grešku (npr.
pogrešan Price ID iz drugog režima) app prikazuje korisniku umesto da puca. **Sâmo plaćanje +
webhook potvrda još NISU end-to-end testirani** — namerno odloženo do FAZE 10 (Deploy), gde je
podešavanje webhook-a jednostavnije (par klikova u Stripe Dashboard-u, umesto instaliranja
Stripe CLI alata za lokalno testiranje). Do tada: `STRIPE_WEBHOOK_SECRET` u `.env.local` je
prazan.

Nije još urađeno (ostatak FAZE 8, sledeći koraci):
- [ ] Boost (privremeno više prikazivanje profila) — tabela `boosts` postoji u bazi od FAZE 1,
      kod za kupovinu/aktivaciju još ne postoji.
- [ ] Dodatni filteri za Premium (napredni Discovery).
- [ ] Premium bedž vidljiv drugima (na profilu/karticama u Otkrij).

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

### Poveži Stripe (obavezno pre nego što Premium dugme radi)

1. Napravi/koristi postojeći nalog na [stripe.com](https://stripe.com). Pređi u **Test mode**
   (Sandboxes) — dok razvijamo, nikad ne koristi live ključeve, da slučajno ne dođe do prave
   naplate.
2. **Developers → API keys** → kopiraj **Secret key** (počinje `sk_test_...`) u `.env.local` kao
   `STRIPE_SECRET_KEY`.
3. **Product catalog → Add product** → napravi proizvod (npr. "Srpskomuvanje Premium") sa
   **Recurring/monthly** cenom. Klikni na cenu, kopiraj **Price ID** (`price_...`) u
   `STRIPE_PREMIUM_PRICE_ID`.
4. **Webhook** (`STRIPE_WEBHOOK_SECRET`) — popunjava se tek u FAZI 10 (Deploy), kad postoji
   javna adresa na koju Stripe može da šalje potvrde plaćanja. Dok je prazno, Checkout dugme
   radi (kreira sesiju, preusmerava na Stripe), ali sâmo plaćanje neće otključati Premium u
   bazi — to je očekivano do deploy-a.

### Testiraj push notifikacije na svom telefonu

Ovo se ne može testirati na `localhost` sa telefona (telefon ne zna šta je "localhost" na
tvom računaru), ali može preko lokalne mreže:

1. Pokreni `npm run dev` na računaru (ostani na istom WiFi-ju kao telefon).
2. Na telefonu otvori `http://<IP-adresa-računara>:3000` (terminal ispiše tu adresu kao
   "Network:" kad pokreneš server).
3. Uloguj se, idi na **Profil → 🔔 Push notifikacije**, uključi, dozvoli kad pregledač pita.
4. Zaključaj telefon ili pređi na drugu aplikaciju (notifikacije se ne prikazuju dok si
   aktivno na toj stranici u nekim pregledačima).
5. Sa drugog naloga (npr. na računaru) pošalji poruku ili lajkuj taj profil — notifikacija bi
   trebalo da stigne na telefon za par sekundi.

Ako ne stigne: proveri da li si zaista dozvolio notifikacije (Podešavanja pregledača →
Sajtovi → dozvole), i da je `SUPABASE_SERVICE_ROLE_KEY` popunjen u `.env.local`.

## Struktura projekta

```
iskra/
  src/
    app/
      (marketing)/page.tsx      -- landing (/ )
      (auth)/prijava, registracija
      onboarding/                -- kreiranje profila posle registracije
      (app)/sada, otkrij, match, poruke, profil  -- glavni ekrani (zaštićeni)
      (app)/ko-te-zeli           -- Premium reveal ko te je lajkovao (FAZA 8)
      api/stripe/webhook         -- prima potvrde plaćanja od Stripe-a
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
      stripe.ts, premium.ts      -- Stripe klijent + provera "da li sam Premium" (FAZA 8)
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
- [x] **FAZA 5** — "Sada" feed sa pravim aktivnostima
- [x] **FAZA 6** — Tajni Srbin/Srpkinja, Duel, Hot Mode, Noćni mod
- [x] **FAZA 7** — push notifikacije
- [~] **FAZA 8** — Premium/Stripe Checkout ✅ (Live režim), "Ko te želi" ✅, dnevni limit Duela ✅,
      webhook end-to-end testiran uživo ✅, Boost ⬜, dodatni filteri ⬜
- [~] **FAZA 9** — Prijavi/Blokiraj ✅, Admin panel (osnova) ✅, Uslovi korišćenja/Privatnost ✅,
      automatska NSFW moderacija ⬜
- [~] **FAZA 10** — Deploy na Vercel ✅ (uživo, auto-deploy), analytics ⬜, dodatni performance/
      security hardening ⬜

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
- **"Sakrij profil" u admin panelu je meka mera** (postavlja `is_discoverable = false` —
  profil nestaje iz Otkrij feed-a) — nema pravog "banovanja" naloga (koje bi sprečilo i
  prijavu) jer to zahteva auth-nivo infrastrukturu. Dovoljno za sada; pravo suspendovanje
  naloga je nadogradnja za kasnije ako zatreba.
- **Admin panel nema svoj tab u donjoj navigaciji** — namerno, to nije deo iskustva
  običnog korisnika. Dostupan je samo direktno na `/admin`, i samo nalozima upisanim u
  `admin_users` (dodaju se ručno kroz SQL Editor, nikad kroz aplikaciju).
- **"Ko je u Hot Mode-u sada" (Sada ekran) filtrira samo u jednom smeru** (da li TI želiš
  da vidiš njihov pol), ne proverava obostrano kao Otkrij algoritam (koji dodatno proverava
  da li i oni žele tvoj pol). Namerno pojednostavljeno — ovo je ambijentalni prikaz
  ("dešava se nešto"), ne akcija poput lajka, pa manja preciznost nije značajan problem, a
  izbegava potrebu za još jednom SECURITY DEFINER funkcijom.

- **Stripe Checkout (hostovana stranica), ne Stripe Elements** za naplatu — Stripe hostuje
  celu formu za karticu, mi joj samo napravimo sesiju i preusmerimo korisnika. Nikad ne vidimo
  ni dodirujemo broj kartice, nema potrebe za PCI compliance na našoj strani, i implementacija
  je mnogo manja površina za greške.
- **`client_reference_id` u Checkout sesiji, ne prethodno čuvan Stripe Customer ID**, za
  povezivanje plaćanja sa korisnikom — webhook nema pristup ulogovanoj sesiji korisnika, pa
  mu ovako direktno prosleđujemo naš `profiles.id` kad sesiju kreiramo.
- **Jedan red pretplate po korisniku** (`unique (profile_id)` na `subscriptions`, dodato u
  FAZI 8) — webhook upisuje sa `upsert`, pa ponovna pretplata posle otkazivanja samo ažurira
  isti red umesto da pravi duplikate.
- **Stripe Subscription API je promenio gde živi `current_period_end`** (nije više na samoj
  pretplati, sad je na svakoj stavci/`subscription item`) — novija verzija `stripe` paketa to
  odražava, kod čita `subscription.items.data[0].current_period_end`. Ako se ovo opet promeni
  posle nadogradnje paketa, prvo mesto za proveru je `src/app/api/stripe/webhook/route.ts`.

- **Stripe nalog je deljen sa drugim projektom (VAMIT-5)**, po odluci vlasnika projekta. To znači:
  ceo prihod od oba projekta ide u ISTI bankovni račun/isplatu (Stripe ih ne razdvaja sam), i
  svaka automatizacija na tom nalogu (npr. make.com scenario) koja nije eksplicitno filtrirana po
  proizvodu/ceni "vidi" evente iz OBA projekta. Kad se to prvi put desilo (make.com scenario za
  VAMIT-5 dobrodošlicu je poslao mejlove i za Srpskomuvanje test kupovinu), rešeno je (22.08.2026)
  dodavanjem filtera u tom scenariju -- uslov na `payment_link` polju (Stripe Payment Link ID koji
  koristi SAMO VAMIT-5; Srpskomuvanje pravi Checkout sesije direktno bez Payment Link-a, pa je to
  polje kod nas uvek prazno) umesto odvajanja naloga. Podešeno direktno u make.com, van ovog koda
  -- ako se doda još neka automatizacija na ovom nalogu ubuduće, mora dobiti isti tip filtera.

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
- **Stripe naplaćuje procenat + fiksni iznos po transakciji** (standardno ~1.5-2.9% + fiksni
  iznos, zavisi od zemlje/kartice) — normalan trošak za bilo koji payment provider, ne nešto
  što možemo izbeći, samo treba da uđe u cenu Premium-a kad je budemo finalno određivali.
- **Push notifikacije na velikom broju korisnika** — same po sebi besplatne (Web Push), ali
  compute za slanje (cron job / edge function) raste sa brojem korisnika.

Ništa od ovoga nije problem sada — sve navedeno postaje relevantno tek kad aplikacija ima
realan broj aktivnih korisnika.
