"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { deleteMyAccount } from "./actions";

const CONFIRM_WORD = "OBRIŠI";

export function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (confirmText.trim().toUpperCase() !== CONFIRM_WORD) {
      setError(`Ukucaj tačno "${CONFIRM_WORD}" da potvrdiš.`);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await deleteMyAccount();
    // deleteMyAccount radi redirect() na uspehu (baca NEXT_REDIRECT) --
    // do ovde se stiže samo ako postoji greška.
    if (result?.error) {
      setBusy(false);
      setError(result.error);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-center text-xs text-[var(--color-text-faint)] underline"
      >
        Obriši nalog
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5 p-4">
      <p className="text-sm font-semibold text-[var(--color-danger)]">⚠️ Brisanje naloga</p>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
        Ovo je trajno. Tvoj profil, slike i podaci nestaju za sve druge korisnike odmah, aktivna
        Premium pretplata (ako postoji) se otkazuje, i nalog se ne može vratiti. Da potvrdiš,
        ukucaj <strong>{CONFIRM_WORD}</strong> ispod.
      </p>
      <input
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={CONFIRM_WORD}
        className="mt-3 h-11 w-full rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-4 text-[15px] outline-none focus:border-[var(--color-danger)]"
      />
      {error && <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>}
      <div className="mt-3 flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={() => setOpen(false)} disabled={busy}>
          Odustani
        </Button>
        <Button
          className="flex-1 !bg-[var(--color-danger)] !text-white"
          onClick={handleDelete}
          disabled={busy}
        >
          {busy ? "Brišem..." : "Trajno obriši nalog"}
        </Button>
      </div>
    </div>
  );
}
