"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { sendAsTestUser } from "../../actions";

export function TestSendForm({
  matchId,
  participants,
}: {
  matchId: string;
  participants: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [senderId, setSenderId] = useState(participants[0]?.id ?? "");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setError(null);
    if (!text.trim()) return setError("Unesi tekst poruke.");

    setSending(true);
    const result = await sendAsTestUser(matchId, senderId, text);
    setSending(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setText("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-dashed border-[var(--color-accent)]/50 bg-[var(--color-accent)]/5 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-accent)]">
        🧪 Test alat — oba naloga su označena kao test, piši u ime jednog od njih
      </p>
      <div className="flex gap-2">
        {participants.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSenderId(p.id)}
            className={cn(
              "tap-scale flex-1 rounded-xl border px-3 py-2 text-sm font-medium",
              senderId === p.id ? "border-transparent bg-gradient-accent text-white" : "border-[var(--color-border-strong)] text-[var(--color-text-muted)]"
            )}
          >
            Piši kao {p.name}
          </button>
        ))}
      </div>
      <textarea
        className="h-16 w-full rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] p-3 text-sm outline-none focus:border-[var(--color-accent)]"
        placeholder="Tekst poruke..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={1000}
      />
      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
      <Button onClick={handleSend} disabled={sending}>
        {sending ? "Šaljem..." : "Pošalji"}
      </Button>
    </div>
  );
}
