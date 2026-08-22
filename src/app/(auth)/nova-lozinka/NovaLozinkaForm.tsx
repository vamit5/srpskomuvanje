"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function NovaLozinkaForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Lozinka mora imati bar 8 karaktera.");
      return;
    }
    if (password !== password2) {
      setError("Lozinke se ne poklapaju.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    // Ako korisnik NIJE stigao ovde preko pravog reset linka (nema privremenu
    // sesiju iz verifyOtp type=recovery), ovo će vratiti grešku -- ne može
    // niko da promeni tuđu lozinku samo posetom ove stranice.
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError("Link je istekao ili je nevažeći. Zatraži novi link za resetovanje.");
      return;
    }

    router.push("/sada");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <h2 className="text-center text-lg font-semibold">Postavi novu lozinku</h2>

      <Input
        type="password"
        placeholder="Nova lozinka (min. 8 karaktera)"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
      />
      <Input
        type="password"
        placeholder="Ponovi novu lozinku"
        required
        minLength={8}
        value={password2}
        onChange={(e) => setPassword2(e.target.value)}
        autoComplete="new-password"
      />

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <Button type="submit" size="lg" disabled={loading}>
        {loading ? "Čuvam..." : "Sačuvaj novu lozinku"}
      </Button>
    </form>
  );
}
