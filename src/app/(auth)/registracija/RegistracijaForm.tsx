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
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendNotice, setResendNotice] = useState<string | null>(null);

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
      // Email confirmation je uključena u Supabase projektu -- korisnik unosi
      // 6-cifreni kod iz mejla (Supabase "Confirm signup" sablon mora da
      // prikazuje {{ .Token }}), umesto da klikne na link.
      setAwaitingCode(true);
    }
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault();
    setCodeError(null);
    setResendNotice(null);

    if (code.trim().length < 6) {
      setCodeError("Unesi ceo kod od 6 cifara.");
      return;
    }

    setVerifying(true);
    const supabase = createClient();
    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "signup",
    });
    setVerifying(false);

    if (verifyError || !data.session) {
      setCodeError("Pogrešan ili istekao kod. Proveri kod ili pošalji novi.");
      return;
    }

    router.push("/onboarding");
    router.refresh();
  }

  async function handleResendCode() {
    setResending(true);
    setCodeError(null);
    setResendNotice(null);
    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({ type: "signup", email });
    setResending(false);
    setResendNotice(resendError ? "Ne mogu trenutno da pošaljem novi kod. Pokušaj malo kasnije." : "Poslali smo ti novi kod.");
  }

  if (awaitingCode) {
    return (
      <form onSubmit={handleVerifyCode} className="glass flex flex-col gap-4 rounded-2xl p-6">
        <p className="text-center text-3xl">📩</p>
        <h2 className="text-center text-lg font-semibold">Unesi kod za potvrdu</h2>
        <p className="text-center text-sm text-[var(--color-text-muted)]">
          Poslali smo 6-cifreni kod na <strong>{email}</strong>. Unesi ga ispod da nastaviš.
        </p>

        <Input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="text-center text-xl tracking-[0.5em]"
        />

        {codeError && <p className="text-center text-sm text-[var(--color-danger)]">{codeError}</p>}
        {resendNotice && !codeError && <p className="text-center text-sm text-[var(--color-text-muted)]">{resendNotice}</p>}

        <Button type="submit" size="lg" disabled={verifying}>
          {verifying ? "Proveravam..." : "Potvrdi"}
        </Button>

        <button
          type="button"
          onClick={handleResendCode}
          disabled={resending}
          className="text-center text-sm text-[var(--color-text)] underline disabled:opacity-50"
        >
          {resending ? "Šaljem..." : "Pošalji kod ponovo"}
        </button>
      </form>
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
        Imam 18 ili više godina i prihvatam{" "}
        <Link href="/uslovi-koriscenja" target="_blank" className="text-[var(--color-text)] underline">
          Uslove korišćenja
        </Link>{" "}
        i{" "}
        <Link href="/politika-privatnosti" target="_blank" className="text-[var(--color-text)] underline">
          Politiku privatnosti
        </Link>
        .
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
