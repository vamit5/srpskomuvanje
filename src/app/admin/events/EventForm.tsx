"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createEvent } from "../actions";

export function EventForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const result = await createEvent({ title, description, city, startsAt, endsAt });
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setTitle("");
    setDescription("");
    setCity("");
    setStartsAt("");
    setEndsAt("");
    setSuccess(true);
    router.refresh(); // osveži listu ispod (server komponenta) sa novim događajem
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <Input placeholder="Naslov (npr. Vrelo petak)" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <Input placeholder="Kratak opis (opciono)" value={description} onChange={(e) => setDescription(e.target.value)} />
      <Input placeholder="Grad (prazno = svi gradovi)" value={city} onChange={(e) => setCity(e.target.value)} />
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Početak (Beograd)</label>
          <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs text-[var(--color-text-muted)]">Kraj (Beograd)</label>
          <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required />
        </div>
      </div>
      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
      {success && <p className="text-sm text-[var(--color-success)]">Događaj napravljen ✅</p>}
      <Button type="submit" disabled={saving}>
        {saving ? "Čuvam..." : "Napravi događaj"}
      </Button>
    </form>
  );
}
