"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, Check, CheckCheck, MoreVertical } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { sendMessage, markAsRead, unmatchAction, type MessageRow } from "../actions";
import { reportUser, blockUser, type ReportReason } from "../../_safety/actions";
import { getNightFlirtingContext, logNightEvent } from "../../_night/actions";
import { NightFlirtingBubble } from "./NightFlirtingBubble";
import { NightFlirtingPanel } from "./NightFlirtingPanel";

const TYPING_CLEAR_MS = 3000;
const TYPING_THROTTLE_MS = 2000;

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "neprikladan_sadrzaj", label: "Neprikladan sadržaj" },
  { value: "uznemiravanje", label: "Uznemiravanje" },
  { value: "lazan_profil", label: "Lažan profil" },
  { value: "spam", label: "Spam" },
  { value: "prevara", label: "Prevara" },
  { value: "maloletna_osoba", label: "Maloletna osoba" },
  { value: "nasilje_pretnje", label: "Nasilje / pretnje" },
  { value: "drugo", label: "Drugo" },
];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("sr-RS", { hour: "2-digit", minute: "2-digit" });
}

export function ChatThread({
  matchId,
  currentUserId,
  otherId,
  otherName,
  otherPhotoUrl,
  otherOnline,
  initialMessages,
  isUnmatched,
}: {
  matchId: string;
  currentUserId: string;
  otherId: string;
  otherName: string;
  otherPhotoUrl: string | null;
  otherOnline: boolean;
  initialMessages: MessageRow[];
  isUnmatched: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [unmatched, setUnmatched] = useState(isUnmatched);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingUnmatch, setConfirmingUnmatch] = useState(false);
  const [confirmingBlock, setConfirmingBlock] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>("neprikladan_sadrzaj");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSending, setReportSending] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [nightPanelOpen, setNightPanelOpen] = useState(false);
  const [nightContext, setNightContext] = useState<{ sentToday: number; dailyLimit: number } | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  // Real-time: nove poruke, izmene (pročitano), i typing indikator na istom kanalu.
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      // KRITIČNO: mora se sačekati da se sesija učita PRE subscribe-a.
      // Bez ovoga Realtime websocket konekcija krene bez JWT-a, pa RLS
      // (koja proverava auth.uid()) tiho filtrira SVE promene -- kanal
      // izgleda kao da je uspešno povezan (status "SUBSCRIBED"), ali
      // nijedan event nikad ne stigne. getSession() forsira supabase-js
      // da učita sesiju i pozove realtime.setAuth(token) pre nego što
      // nastavimo.
      await supabase.auth.getSession();
      if (cancelled) return;

      channel = supabase
        .channel(`chat:${matchId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` },
          (payload) => {
            const row = payload.new as MessageRow;
            setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
            if (row.sender_id !== currentUserId) markAsRead(matchId);
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` },
          (payload) => {
            const row = payload.new as MessageRow;
            setMessages((prev) => prev.map((m) => (m.id === row.id ? row : m)));
          }
        )
        .on("broadcast", { event: "typing" }, ({ payload }) => {
          if (payload?.userId === currentUserId) return;
          setOtherTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setOtherTyping(false), TYPING_CLEAR_MS);
        })
        .subscribe();

      channelRef.current = channel;
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [matchId, currentUserId]);

  // Označi tuđe poruke kao pročitane čim uđeš u razgovor.
  useEffect(() => {
    markAsRead(matchId);
  }, [matchId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function handleDraftChange(value: string) {
    setDraft(value);
    const now = Date.now();
    if (now - lastTypingSentRef.current > TYPING_THROTTLE_MS) {
      lastTypingSentRef.current = now;
      channelRef.current?.send({ type: "broadcast", event: "typing", payload: { userId: currentUserId } });
    }
  }

  async function openNightPanel() {
    logNightEvent("night_flirting_opened");
    const ctx = await getNightFlirtingContext();
    setNightContext({ sentToday: ctx.sentToday, dailyLimit: ctx.dailyLimit });
    setNightPanelOpen(true);
  }

  async function handleSend() {
    const content = draft.trim();
    if (!content || sending || unmatched) return;
    setSending(true);
    setError(null);
    setDraft("");

    const result = await sendMessage(matchId, content);
    setSending(false);

    if (result.error || !result.message) {
      setError(result.error ?? "Ne mogu da pošaljem poruku.");
      setDraft(content);
      return;
    }
    setMessages((prev) => (prev.some((m) => m.id === result.message!.id) ? prev : [...prev, result.message!]));
  }

  async function handleUnmatch() {
    const result = await unmatchAction(matchId);
    if (result.error) {
      setError(result.error);
      return;
    }
    setUnmatched(true);
    setConfirmingUnmatch(false);
    router.push("/poruke");
  }

  async function handleBlock() {
    const result = await blockUser(otherId);
    if (result.error) {
      setError(result.error);
      return;
    }
    setBlocked(true);
    setConfirmingBlock(false);
    router.push("/poruke");
  }

  async function handleSubmitReport() {
    setReportSending(true);
    const result = await reportUser(otherId, reportReason, reportDetails);
    setReportSending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setReportSent(true);
  }

  if (blocked) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-3xl">🚫</p>
        <p className="font-semibold">{otherName} je blokiran/a</p>
        <Link href="/poruke" className="text-sm text-[var(--color-text-muted)] underline">
          Nazad na poruke
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="safe-top glass flex items-center gap-3 border-b border-[var(--color-border)] px-3 py-3">
        <Link href="/poruke" className="tap-scale p-1" aria-label="Nazad">
          <ArrowLeft size={22} />
        </Link>
        {otherPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={otherPhotoUrl} alt={otherName} className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-accent text-sm font-bold text-white">
            {otherName[0]?.toUpperCase() ?? "?"}
          </div>
        )}
        <div className="flex-1">
          <p className="font-semibold leading-tight">{otherName}</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {otherTyping ? "kuca..." : otherOnline ? "🟢 Online" : ""}
          </p>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="tap-scale p-1 text-[var(--color-text-muted)]"
            aria-label="Više opcija"
          >
            <MoreVertical size={20} />
          </button>
          {menuOpen && (
            <div className="glass absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-xl border border-[var(--color-border)] py-1 text-sm">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setReportOpen(true);
                }}
                className="block w-full px-4 py-2 text-left hover:bg-[var(--color-bg-elevated)]"
              >
                🚩 Prijavi
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setConfirmingBlock(true);
                }}
                className="block w-full px-4 py-2 text-left text-[var(--color-danger)] hover:bg-[var(--color-bg-elevated)]"
              >
                🚫 Blokiraj
              </button>
              {!unmatched && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmingUnmatch(true);
                  }}
                  className="block w-full px-4 py-2 text-left text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)]"
                >
                  Prekini match
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {confirmingUnmatch && (
        <div className="flex items-center justify-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-2 text-sm">
          <span>Prekinuti match sa {otherName}?</span>
          <button type="button" onClick={handleUnmatch} className="font-semibold text-[var(--color-danger)]">
            Da
          </button>
          <button type="button" onClick={() => setConfirmingUnmatch(false)} className="text-[var(--color-text-muted)]">
            Ne
          </button>
        </div>
      )}
      {confirmingBlock && (
        <div className="flex items-center justify-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-2 text-sm">
          <span>Blokirati {otherName}? Neće više moći da te vidi ni kontaktira.</span>
          <button type="button" onClick={handleBlock} className="font-semibold text-[var(--color-danger)]">
            Da
          </button>
          <button type="button" onClick={() => setConfirmingBlock(false)} className="text-[var(--color-text-muted)]">
            Ne
          </button>
        </div>
      )}

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <p className="pt-10 text-center text-sm text-[var(--color-text-muted)]">
            Recite zdravo — vi ste se međusobno svideli 👋
          </p>
        )}
        {messages.map((m) => {
          const isMine = m.sender_id === currentUserId;

          if (m.night_content_id) {
            return (
              <div key={m.id} className={cn("flex flex-col gap-1", isMine ? "items-end" : "items-start")}>
                <NightFlirtingBubble contentId={m.night_content_id} isMine={isMine} />
                <span className="px-1 text-[10px] text-[var(--color-text-faint)]">{formatTime(m.created_at)}</span>
              </div>
            );
          }

          return (
            <div key={m.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
                  isMine ? "bg-gradient-accent text-white" : "bg-[var(--color-bg-card)] text-[var(--color-text)]"
                )}
              >
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                <div className={cn("mt-1 flex items-center gap-1 text-[10px]", isMine ? "text-white/70" : "text-[var(--color-text-faint)]")}>
                  <span>{formatTime(m.created_at)}</span>
                  {isMine && (m.read_at ? <CheckCheck size={12} /> : <Check size={12} />)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p className="px-4 pb-1 text-center text-xs text-[var(--color-danger)]">{error}</p>}

      {unmatched ? (
        <div className="safe-bottom border-t border-[var(--color-border)] px-4 py-4 text-center text-sm text-[var(--color-text-muted)]">
          Ovaj match je prekinut. Ne možete više da razmenjujete poruke.
        </div>
      ) : (
        <div className="safe-bottom flex items-center gap-2 border-t border-[var(--color-border)] px-3 py-3">
          <button
            type="button"
            onClick={openNightPanel}
            aria-label="Noćno muvanje"
            className="tap-scale relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-accent text-lg shadow-[0_4px_16px_-4px_rgba(255,45,107,0.55)]"
          >
            🌙😈
            <span className="absolute -inset-0.5 -z-10 animate-pulse rounded-full bg-gradient-accent opacity-40 blur-md" />
          </button>
          <input
            type="text"
            value={draft}
            onChange={(e) => handleDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            placeholder="Napiši poruku..."
            className="h-11 flex-1 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-4 text-[15px] outline-none focus:border-[var(--color-accent)]"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            className="tap-scale flex h-11 w-11 items-center justify-center rounded-full bg-gradient-accent text-white disabled:opacity-40"
            aria-label="Pošalji"
          >
            <Send size={18} />
          </button>
        </div>
      )}

      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center">
          <div className="w-full max-w-sm rounded-t-3xl bg-[var(--color-bg-card)] p-5 sm:rounded-3xl">
            {reportSent ? (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <p className="text-3xl">✅</p>
                <p className="font-semibold">Prijava poslata</p>
                <p className="text-sm text-[var(--color-text-muted)]">Pregledaćemo je što pre.</p>
                <Button
                  className="mt-3 w-full"
                  onClick={() => {
                    setReportOpen(false);
                    setReportSent(false);
                    setReportDetails("");
                  }}
                >
                  Zatvori
                </Button>
              </div>
            ) : (
              <>
                <h2 className="mb-3 font-semibold">Prijavi {otherName}</h2>
                <div className="mb-3 flex flex-col gap-2">
                  {REPORT_REASONS.map((r) => (
                    <label key={r.value} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="reason"
                        checked={reportReason === r.value}
                        onChange={() => setReportReason(r.value)}
                        className="accent-[var(--color-accent)]"
                      />
                      {r.label}
                    </label>
                  ))}
                </div>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Dodatni detalji (opciono)"
                  maxLength={500}
                  className="h-20 w-full rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] p-3 text-sm outline-none focus:border-[var(--color-accent)]"
                />
                <div className="mt-3 flex flex-col gap-2">
                  <Button variant="danger" onClick={handleSubmitReport} disabled={reportSending}>
                    {reportSending ? "Šaljem..." : "Pošalji prijavu"}
                  </Button>
                  <Button variant="ghost" onClick={() => setReportOpen(false)}>
                    Otkaži
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {nightPanelOpen && nightContext && (
        <NightFlirtingPanel
          matchId={matchId}
          sentToday={nightContext.sentToday}
          dailyLimit={nightContext.dailyLimit}
          onClose={() => setNightPanelOpen(false)}
          onSent={() => setNightContext((c) => (c ? { ...c, sentToday: c.sentToday + 1 } : c))}
        />
      )}
    </div>
  );
}
