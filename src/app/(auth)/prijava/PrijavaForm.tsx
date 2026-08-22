"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function PrijavaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (signInError) {
      setError("Pogrešan email ili lozinka.");
      return;
    }

    const next = searchParams.get("next") || "/sada";
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h2 className="text-center text-lg font-semibold">Prijavi se</h2>

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
        placeholder="Lozinka"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
      />

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <Button type="submit" size="lg" disabled={loading}>
        {loading ? "Sačekaj..." : "Prijavi se"}
      </Button>

      <p className="text-center text-sm">
        <Link href="/zaboravljena-lozinka" className="text-[var(--color-text-muted)] underline">
          Zaboravljena lozinka?
        </Link>
      </p>

      <p className="text-center text-sm text-[var(--color-text-muted)]">
        Nemaš nalog?{" "}
        <Link href="/registracija" className="text-[var(--color-text)] underline">
          Napravi nalog
        </Link>
      </p>
    </form>
  );
}
