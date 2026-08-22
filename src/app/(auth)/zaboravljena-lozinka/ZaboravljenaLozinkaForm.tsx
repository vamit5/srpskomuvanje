"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function ZaboravljenaLozinkaForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const baseUrl = window.location.origin;
    // Supabase "Reset Password" email templejt mora da koristi:
    // {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/nova-lozinka
    // (ista ruta koja već radi za potvrdu registracije, samo type=recovery).
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${baseUrl}/auth/confirm?next=/nova-lozinka`,
    });
    setLoading(false);

    // Namerno ne otkrivamo da li email postoji u bazi (isti odgovor u oba
    // slučaja) -- sprečava da neko "proverava" koji su email-ovi registrovani.
    if (resetError) {
      setError("Nešto nije u redu. Pokušaj ponovo.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="glass rounded-2xl p-6 text-center">
        <p className="text-3xl">📩</p>
        <h2 className="mt-2 text-lg font-semibold">Proveri email</h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Ako nalog sa adresom <strong>{email}</strong> postoji, poslali smo link za resetovanje lozinke.
        </p>
        <Link href="/prijava" className="mt-4 inline-block text-sm text-[var(--color-text)] underline">
          Nazad na prijavu
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h2 className="text-center text-lg font-semibold">Zaboravljena lozinka</h2>
      <p className="text-center text-sm text-[var(--color-text-muted)]">
        Unesi svoju email adresu — poslaćemo ti link za resetovanje lozinke.
      </p>

      <Input
        type="email"
        placeholder="Email adresa"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
      />

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <Button type="submit" size="lg" disabled={loading}>
        {loading ? "Šaljem..." : "Pošalji link"}
      </Button>

      <p className="text-center text-sm text-[var(--color-text-muted)]">
        <Link href="/prijava" className="text-[var(--color-text)] underline">
          Nazad na prijavu
        </Link>
      </p>
    </form>
  );
}
