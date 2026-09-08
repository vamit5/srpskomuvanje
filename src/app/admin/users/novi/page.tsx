import Link from "next/link";
import { NewUserForm } from "./NewUserForm";

export const metadata = { title: "Admin — Dodaj korisnika" };

// Default serverless limit (10s) zna da bude tesan za obradu slike +
// moderaciju + nekoliko upisa u bazu (createManualUser) -- vise vremena,
// ne manje, da se izbegne "tiho" isteklo vreme koje na klijentu izgleda
// kao vecno ucitavanje dugmeta. Server Actions NASLEDJUJU maxDuration od
// stranice na kojoj se koriste -- ne moze da se postavi direktno u
// "use server" fajlu akcije (Next.js to odbacuje bez jasne greske).
export const maxDuration = 30;

export default function AdminNewUserPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link href="/admin/users" className="text-sm text-[var(--color-text-muted)] underline">
          ← Korisnici
        </Link>
      </div>
      <div>
        <h2 className="text-lg font-semibold">Dodaj korisnika</h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Za stvarne, postojeće osobe koje si lično pozvao/la na app (npr. rane beta korisnike) — ne
          za izmišljene profile. Nalog se pravi potpuno funkcionalan; osoba mu kasnije sama pristupa
          preko svog mejla (&quot;Zaboravljena lozinka&quot;).
        </p>
      </div>
      <NewUserForm />
    </div>
  );
}
