import Link from "next/link";

export const metadata = { title: "Politika privatnosti" };

export default function PolitikaPrivatnostiPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10 text-sm leading-relaxed text-[var(--color-text-muted)]">
      <header>
        <Link href="/" className="text-xs text-[var(--color-text-faint)]">
          ← Nazad
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-[var(--color-text)]">Politika privatnosti</h1>
        <p className="mt-1 text-xs">Poslednja izmena: 22. avgust 2026.</p>
      </header>

      <section>
        <h2 className="mb-1 font-semibold text-[var(--color-text)]">1. Rukovalac podacima</h2>
        <p>
          Rukovalac tvojih ličnih podataka je Borislav Kukić, fizičko lice, Republika Srbija.
          Kontakt: <a href="mailto:adrenalx.challenge@gmail.com" className="underline">adrenalx.challenge@gmail.com</a>,
          tel. 063 706 7172.
        </p>
      </section>

      <section>
        <h2 className="mb-1 font-semibold text-[var(--color-text)]">2. Koje podatke prikupljamo</h2>
        <ul className="ml-5 list-disc">
          <li><strong>Nalog</strong>: email adresa, lozinka (čuva se enkriptovano, mi je ne vidimo)</li>
          <li><strong>Profil</strong>: ime, datum rođenja, pol, grad, opis, interesovanja</li>
          <li><strong>Sadržaj</strong>: fotografije i video koje postaviš</li>
          <li><strong>Lokacija</strong>: samo ako je sam/a uključiš — čuvamo je da bismo izračunali približnu udaljenost, tvoje tačne koordinate se nikad ne prikazuju drugima niti nama van te funkcije</li>
          <li><strong>Aktivnost</strong>: lajkovi, poruke, matchevi, korišćenje Duela — da bi aplikacija radila i da bismo poboljšali predloge profila</li>
          <li><strong>Plaćanje</strong>: ako kupiš Premium, plaćanje obrađuje Stripe direktno — mi čuvamo samo status pretplate, nikad broj kartice</li>
          <li><strong>Tehnički podaci</strong>: IP adresa i osnovni podaci o uređaju/pregledaču (bezbednost, sprečavanje zloupotrebe)</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-1 font-semibold text-[var(--color-text)]">3. Zašto prikupljamo ove podatke</h2>
        <p>
          Da bismo ti pružili osnovnu funkciju aplikacije (pravni osnov: izvršenje ugovora — Uslova
          korišćenja koje prihvataš pri registraciji) i, gde je primenjivo, na osnovu tvog pristanka
          (npr. deljenje lokacije, push notifikacije — oboje uključuješ sam/a i možeš isključiti u bilo
          kom trenutku).
        </p>
      </section>

      <section>
        <h2 className="mb-1 font-semibold text-[var(--color-text)]">4. Ko ima pristup podacima</h2>
        <p>Ne prodajemo tvoje podatke. Koristimo sledeće obrađivače isključivo za rad aplikacije:</p>
        <ul className="ml-5 list-disc">
          <li><strong>Supabase</strong> — baza podataka, nalog i skladištenje fotografija/videa (serveri u EU)</li>
          <li><strong>Vercel</strong> — hostovanje same aplikacije</li>
          <li><strong>Stripe</strong> — obrada plaćanja za Premium (Stripe ima sopstvenu politiku privatnosti za podatke o plaćanju)</li>
        </ul>
        <p className="mt-2">
          Ostalim korisnicima aplikacije vidljivi su podaci koje sam/a odabereš da prikažeš na svom
          profilu (ime, godine, grad, opis, interesovanja, fotografije/video). Tačna lokacija i email
          se nikad ne prikazuju drugim korisnicima.
        </p>
      </section>

      <section>
        <h2 className="mb-1 font-semibold text-[var(--color-text)]">5. Koliko čuvamo podatke</h2>
        <p>
          Dok postoji tvoj nalog. Ako zatražiš brisanje naloga, brišemo profil i sadržaj (fotografije,
          video, poruke) u razumnom roku, osim podataka koje smo po zakonu obavezni da čuvamo duže
          (npr. evidencija plaćanja).
        </p>
      </section>

      <section>
        <h2 className="mb-1 font-semibold text-[var(--color-text)]">6. Tvoja prava</h2>
        <p>U skladu sa Zakonom o zaštiti podataka o ličnosti, imaš pravo da:</p>
        <ul className="ml-5 list-disc">
          <li>zatražiš uvid u svoje podatke koje čuvamo</li>
          <li>zatražiš ispravku netačnih podataka</li>
          <li>zatražiš brisanje svog naloga i podataka</li>
          <li>povučeš pristanak za lokaciju/push notifikacije u bilo kom trenutku (u samoj aplikaciji)</li>
          <li>uložiš pritužbu Povereniku za informacije od javnog značaja i zaštitu podataka o ličnosti Republike Srbije</li>
        </ul>
        <p className="mt-2">
          Zahteve šalji na <a href="mailto:adrenalx.challenge@gmail.com" className="underline">adrenalx.challenge@gmail.com</a> — odgovaramo u razumnom roku.
        </p>
      </section>

      <section>
        <h2 className="mb-1 font-semibold text-[var(--color-text)]">7. Kolačići i lokalno čuvanje podataka</h2>
        <p>
          Koristimo samo tehnički neophodne kolačiće/lokalno čuvanje podataka za prijavu (sesija) i
          rad aplikacije (npr. da zapamtimo da si instalirao/la aplikaciju). Ne koristimo reklamne ili
          analitičke kolačiće trećih strana.
        </p>
      </section>

      <section>
        <h2 className="mb-1 font-semibold text-[var(--color-text)]">8. Maloletna lica</h2>
        <p>
          Aplikacija nije namenjena osobama mlađim od 18 godina. Ako saznamo da je nalog napravilo
          maloletno lice, brišemo ga odmah.
        </p>
      </section>

      <section>
        <h2 className="mb-1 font-semibold text-[var(--color-text)]">9. Izmene ove politike</h2>
        <p>
          Ako značajnije izmenimo ovu politiku, obavestićemo te unutar aplikacije. Datum poslednje
          izmene stoji na vrhu ove stranice.
        </p>
      </section>
    </div>
  );
}
