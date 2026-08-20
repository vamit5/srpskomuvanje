"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function RegistracijaForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [is18, setIs18] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!is18) {
      setError("Moraš potvrditi da imaš 18 ili više godina.");
      return;
    }
    if (password.length < 8) {
      setError("Lozinka mora imati bar 8 karaktera.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });
    setLoading(false);

    if (signUpError) {
      setError(
        signUpError.message === "User already registered"
          ? "Ovaj email je već registrovan. Probaj da se prijaviš."
          : "Nešto nije u redu. Pokušaj ponovo."
      );
      return;
    }

    if (data.session) {
      router.push("/onboarding");
      router.refresh();
    } else {
      // Email confirmation je uključena u Supabase projektu.
      setConfirmSent(true);
    }
  }

  if (confirmSent) {
    return (
      <div className="glass rounded-2xl p-6 text-center">
        <p className="text-3xl">📩</p>
        <h2 className="mt-2 text-lg font-semibold">Proveri email</h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Poslali smo ti link za potvrdu naloga na <strong>{email}</strong>. Klikni na njega da
          nastaviš.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h2 className="text-center text-lg font-semibold">Napravi nalog</h2>

      <Input
        type="email"
        placeholder="Email adresa"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
      />
      <Input
        type="password"
        placeholder="Lozinka (min. 8 karaktera)"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
      />

      <label className="flex items-start gap-2 text-sm text-[var(--color-text-muted)]">
        <input
          type="checkbox"
          checked={is18}
          onChange={(e) => setIs18(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
        />
        Imam 18 ili više godina i prihvatam Uslove korišćenja.
      </label>

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <Button type="submit" size="lg" disabled={loading}>
        {loading ? "Sačekaj..." : "Napravi nalog"}
      </Button>

      <p className="text-center text-sm text-[var(--color-text-muted)]">
        Već imaš nalog?{" "}
        <Link href="/prijava" className="text-[var(--color-text)] underline">
          Prijavi se
        </Link>
      </p>
    </form>
  );
}
