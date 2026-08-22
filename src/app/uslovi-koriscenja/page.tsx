import Link from "next/link";

export const metadata = { title: "Uslovi korišćenja" };

export default function UsloviKoriscenjaPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10 text-sm leading-relaxed text-[var(--color-text-muted)]">
      <header>
        <Link href="/" className="text-xs text-[var(--color-text-faint)]">
          ← Nazad
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-[var(--color-text)]">Uslovi korišćenja</h1>
        <p className="mt-1 text-xs">Poslednja izmena: 22. avgust 2026.</p>
      </header>

      <section>
        <h2 className="mb-1 font-semibold text-[var(--color-text)]">1. Ko smo mi</h2>
        <p>
          Srpskomuvanje je platforma za upoznavanje kojom upravlja Borislav Kukić, fizičko lice, sa
          sedištem u Republici Srbiji (kontakt niže). Korišćenjem aplikacije prihvataš ove Uslove.
        </p>
      </section>

      <section>
        <h2 className="mb-1 font-semibold text-[var(--color-text)]">2. Ko sme da koristi aplikaciju</h2>
        <p>
          Srpskomuvanje je namenjeno isključivo osobama koje imaju <strong>18 ili više godina</strong>.
          Registracijom potvrđuješ da ispunjavaš ovaj uslov. Nalog maloletnog lica se briše čim se
          otkrije, bez najave.
        </p>
      </section>

      <section>
        <h2 className="mb-1 font-semibold text-[var(--color-text)]">3. Tvoj nalog</h2>
        <p>
          Odgovoran/na si za tačnost podataka koje uneseš i za čuvanje svoje lozinke. Jedna osoba sme
          imati samo jedan nalog. Zabranjeno je lažno predstavljanje (lažni identitet, tuđe
          fotografije, bot nalozi).
        </p>
      </section>

      <section>
        <h2 className="mb-1 font-semibold text-[var(--color-text)]">4. Pravila ponašanja</h2>
        <p>Zabranjeno je:</p>
        <ul className="ml-5 list-disc">
          <li>Uznemiravanje, pretnje, govor mržnje ili diskriminacija drugih korisnika</li>
          <li>Postavljanje nezakonitog, nasilnog ili seksualno eksplicitnog sadržaja sa maloletnicima (nulta tolerancija — prijavljuje se nadležnim organima)</li>
          <li>Slanje neželjenih komercijalnih poruka, reklama, prevara ili phishing linkova</li>
          <li>Prikupljanje podataka drugih korisnika van same aplikacije</li>
          <li>Pokušaj zaobilaženja bezbednosnih mera ili automatizovano korišćenje (botovi, scraping)</li>
        </ul>
        <p className="mt-2">
          Kršenje ovih pravila može dovesti do brisanja sadržaja, privremenog ili trajnog gašenja
          naloga, bez prava na povraćaj uplaćenog Premium iznosa u slučaju gašenja zbog kršenja
          pravila.
        </p>
      </section>

      <section>
        <h2 className="mb-1 font-semibold text-[var(--color-text)]">5. Sadržaj koji postavljaš</h2>
        <p>
          Zadržavaš sva prava na svoje fotografije, video snimke i tekst. Postavljanjem sadržaja nam
          daješ neisključivu dozvolu da ga prikazujemo unutar aplikacije drugim korisnicima, u svrhu
          za koju je aplikacija namenjena. Ne prodajemo tvoj sadržaj trećim licima.
        </p>
      </section>

      <section>
        <h2 className="mb-1 font-semibold text-[var(--color-text)]">6. Premium pretplata i plaćanje</h2>
        <p>
          Premium je mesečna pretplata koja se automatski obnavlja dok je ne otkažeš (Profil →
          Upravljaj pretplatom). Plaćanje obrađuje Stripe — mi nikad ne vidimo niti čuvamo broj tvoje
          kartice. U skladu sa Zakonom o zaštiti potrošača, imaš pravo odustanka u roku od 14 dana od
          kupovine, osim ako si eksplicitno tražio/la da usluga počne odmah i već si počeo/la da
          koristiš Premium funkcije — u tom slučaju to pravo prestaje u trenutku prvog korišćenja.
        </p>
      </section>

      <section>
        <h2 className="mb-1 font-semibold text-[var(--color-text)]">7. Bezbednost i tvoja odgovornost</h2>
        <p>
          Srpskomuvanje povezuje ljude, ali ne možemo garantovati identitet ili namere drugih
          korisnika. Sastanke uživo organizuj oprezno (javno mesto, obavesti nekoga, itd.). Sumnjivo
          ponašanje prijavi kroz dugme &bdquo;Prijavi&ldquo; u razgovoru — mi pregledamo prijave ručno.
        </p>
      </section>

      <section>
        <h2 className="mb-1 font-semibold text-[var(--color-text)]">8. Brisanje naloga</h2>
        <p>
          Nalog možeš obrisati u bilo kom trenutku (Profil → Odjavi se, pa kontaktiraj nas za trajno
          brisanje dok ne dodamo samostalno brisanje direktno iz aplikacije). Detalji o brisanju
          podataka su u{" "}
          <Link href="/politika-privatnosti" className="underline">
            Politici privatnosti
          </Link>
          .
        </p>
      </section>

      <section>
        <h2 className="mb-1 font-semibold text-[var(--color-text)]">9. Ograničenje odgovornosti</h2>
        <p>
          Aplikaciju koristiš na sopstvenu odgovornost. Ne odgovaramo za štetu nastalu iz interakcije
          sa drugim korisnicima, van naše razumne kontrole (npr. lažni podaci koje je korisnik uneo o
          sebi).
        </p>
      </section>

      <section>
        <h2 className="mb-1 font-semibold text-[var(--color-text)]">10. Izmene Uslova</h2>
        <p>
          Ove Uslove možemo povremeno menjati. O značajnijim izmenama ćemo te obavestiti unutar
          aplikacije. Nastavak korišćenja posle izmene znači da ih prihvataš.
        </p>
      </section>

      <section>
        <h2 className="mb-1 font-semibold text-[var(--color-text)]">11. Merodavno pravo</h2>
        <p>Na ove Uslove primenjuje se pravo Republike Srbije.</p>
      </section>

      <section>
        <h2 className="mb-1 font-semibold text-[var(--color-text)]">12. Kontakt</h2>
        <p>
          Pitanja i prijave: <a href="mailto:adrenalx.challenge@gmail.com" className="underline">adrenalx.challenge@gmail.com</a>
        </p>
      </section>
    </div>
  );
}
