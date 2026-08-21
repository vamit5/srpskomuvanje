import Link from "next/link";
import { Button } from "@/components/ui/Button";

const FEATURES = [
  {
    emoji: "🔥",
    title: "Sada",
    text: "Ne listaš profile u prazno. Vidiš šta se dešava upravo sada — ko je nov, ko te je lajkovao, ko je blizu.",
  },
  {
    emoji: "💘",
    title: "Otkrij",
    text: "Swipe kartice sa fotografijama, kratkim video snimcima i personalizovanim Match Score-om.",
  },
  {
    emoji: "❤️",
    title: "Match",
    text: "Kad se međusobno lajkujete, otvara se razgovor u trenutku. Bez čekanja, bez nagađanja.",
  },
  {
    emoji: "🎭",
    title: "Tajni Srbin/Srpkinja",
    text: "Pošalji nekome anoniman signal da ti se sviđa, bez da zna ko si. Ako i ona/on pošalje tebi — otključava se obostrana privlačnost.",
  },
  {
    emoji: "⚔️",
    title: "Duel",
    text: "Dva profila, jedno pitanje — 'Ko ti je više tvoj tip?' Zabavno, anonimno za obe strane, i uči algoritam tvoj ukus.",
  },
  {
    emoji: "😏",
    title: "Hot Mode",
    text: "Opcioni 18+ režim za direktniji flert — Flert, Vrelo, Večeras, Piće, Izlazak. Uvek dobrovoljno.",
  },
  {
    emoji: "🌙",
    title: "Večeras",
    text: "Noću se app menja — 'Ko je još budan?' pokazuje ko je stvarno raspoložen za upoznavanje večeras.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="safe-top flex items-center justify-between px-5 py-4">
        <span className="text-lg font-bold text-gradient">Srpskomuvanje</span>
        <Link href="/prijava" className="text-sm text-[var(--color-text-muted)]">
          Prijava
        </Link>
      </header>

      <main className="flex-1">
        <section className="flex flex-col items-center px-6 pb-10 pt-8 text-center">
          <h1 className="text-4xl font-extrabold leading-tight">
            Uđi. <span className="text-gradient">Vidi ko je tu.</span>
          </h1>
          <p className="mt-4 max-w-sm text-[15px] text-[var(--color-text-muted)]">
            Srpska dating aplikacija u kojoj se stvarno nešto dešava — ne još jedan beskrajan
            spisak profila, već real-time upoznavanje, flert i radoznalost.
          </p>
          <Link href="/registracija" className="mt-6 w-full max-w-xs">
            <Button size="lg" className="w-full">
              Uđi besplatno
            </Button>
          </Link>
          <p className="mt-3 text-xs text-[var(--color-text-faint)]">18+ · Besplatno za početak</p>
        </section>

        <section className="grid grid-cols-1 gap-3 px-5 pb-12 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
              <span className="text-2xl">{f.emoji}</span>
              <h3 className="mt-2 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">{f.text}</p>
            </div>
          ))}
        </section>

        <section className="mx-5 mb-12 rounded-3xl bg-gradient-accent p-6 text-center text-white">
          <h2 className="text-xl font-bold">Premium</h2>
          <p className="mt-2 text-sm text-white/90">
            Vidi ko te je lajkovao, dobij više tajnih iskri i duela, napredne filtere i profile
            boost. Besplatna verzija ostaje dovoljno dobra da uđeš i uživaš.
          </p>
        </section>

        <section className="px-6 pb-16 text-center">
          <h2 className="text-lg font-semibold">Spreman/na?</h2>
          <Link href="/registracija" className="mt-4 inline-block w-full max-w-xs">
            <Button size="lg" className="w-full">
              Uđi besplatno
            </Button>
          </Link>
        </section>
      </main>

      <footer className="safe-bottom border-t border-[var(--color-border)] px-6 py-6 text-center text-xs text-[var(--color-text-faint)]">
        <p>Srpskomuvanje je namenjeno isključivo punoletnim osobama (18+).</p>
        <p className="mt-1">
          Prijava zloupotrebe: <span className="underline">podrska@srpskomuvanje.rs</span>
        </p>
      </footer>
    </div>
  );
}
