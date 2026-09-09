"use client";

import { useState } from "react";
import { loginAsTestAccount } from "./actions";

export function LoginAsButton({ profileId, name }: { profileId: string; name: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!confirm(`Ovo te ODJAVLJUJE iz tvog admin naloga i prijavljuje kao "${name}". Nastaviti?`)) return;

    setLoading(true);
    setError(null);
    const result = await loginAsTestAccount(profileId);

    if (result.error || !result.url) {
      setLoading(false);
      setError(result.error ?? "Nešto nije u redu.");
      return;
    }
    window.location.href = result.url;
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="tap-scale rounded-xl border border-[var(--color-accent)] px-3 py-2 text-xs font-bold text-[var(--color-accent)] disabled:opacity-50"
      >
        {loading ? "Prijavljujem..." : `🔑 Uđi kao ${name}`}
      </button>
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
