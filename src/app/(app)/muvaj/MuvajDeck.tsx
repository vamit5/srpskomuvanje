"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { X, Heart, ShieldCheck, Drama, Check } from "lucide-react";
import { calculateAge, cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { MatchCelebration } from "@/components/MatchCelebration";
import { vibrate } from "@/lib/haptics";
import {
  getMoreCandidates,
  chooseMuvaj,
  sendSecretSpark,
  type DiscoveryCandidate,
  type MuvajChoice,
} from "./actions";

interface MatchState {
  candidate: DiscoveryCandidate;
  viaSpark: boolean;
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <span className="rounded-full bg-gradient-accent px-2.5 py-1 text-xs font-bold text-white">
      🔥 {Math.round(score)}% tvoj tip
    </span>
  );
}

function SwipeCard({
  candidate,
}: {
  candidate: DiscoveryCandidate;
  disabled: boolean;
  onChoice: (choice: MuvajChoice) => void;
}) {
  const age = calculateAge(candidate.birth_date);

  // NAMERNO bez swipe/drag gesta -- korisnik MORA rucno da izabere jedno
  // od 3 dugmeta ispod (Krevet/Upoznavanje/Nista), da ne bi doslo do
  // slucajnog "krevet" izbora kroz brzi swipe.
  return (
    <motion.div
      className="absolute inset-0"
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.15 }}
    >
      <div className="relative h-full w-full overflow-hidden rounded-3xl bg-[var(--color-bg-card)]">
        {candidate.primary_photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={candidate.primary_photo_url}
            alt={candidate.name}
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-7xl">👤</div>
        )}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-5 pb-5 pt-24 text-white">
          <div className="mb-2 flex items-center gap-2">
            <ScoreBadge score={candidate.score} />
          </div>
          <h2 className="flex items-center gap-1.5 text-2xl font-bold">
            {candidate.name}, {age}
            {candidate.is_verified && <ShieldCheck size={18} className="text-[var(--color-accent-to)]" />}
          </h2>
          {candidate.city && <p className="text-sm text-white/80">{candidate.city}</p>}
          {candidate.bio && <p className="mt-2 line-clamp-2 text-sm text-white/90">{candidate.bio}</p>}
          {candidate.interests?.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {candidate.interests.slice(0, 4).map((interest) => (
                <span key={interest} className="rounded-full bg-white/15 px-2.5 py-1 text-xs">
                  {interest}
                </span>
              ))}
            </div>
          ) : null}
        </div>

      </div>
    </motion.div>
  );
}

export function MuvajDeck({ initialCandidates }: { initialCandidates: DiscoveryCandidate[] }) {
  const [stack, setStack] = useState(initialCandidates);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matched, setMatched] = useState<MatchState | null>(null);
  const [sparkedIds, setSparkedIds] = useState<Set<string>>(new Set());
  const [sparkSending, setSparkSending] = useState(false);
  const [sparkToast, setSparkToast] = useState(false);
  const [krevetToast, setKrevetToast] = useState(false);
  const fetchingMore = useRef(false);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = stack[0];

  async function maybeFetchMore(remaining: DiscoveryCandidate[]) {
    if (remaining.length > 2 || fetchingMore.current) return;
    fetchingMore.current = true;
    const { candidates } = await getMoreCandidates();
    const existingIds = new Set(remaining.map((c) => c.id));
    setStack((prev) => [...prev, ...candidates.filter((c) => !existingIds.has(c.id))]);
    fetchingMore.current = false;
  }

  async function handleChoice(choice: MuvajChoice) {
    if (!current || pending) return;
    setPending(true);
    setError(null);
    const target = current;
    const rest = stack.slice(1);
    setStack(rest);

    const result = await chooseMuvaj(target.id, choice);
    setPending(false);

    // Tek POSLE što je izbor upisan u bazu tražimo još kandidata -- inače
    // bi "discover_profiles" mogao da vrati istu osobu koju smo upravo
    // sklonili, ako fetch stigne pre nego što se upis zabeleži.
    maybeFetchMore(rest);

    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.matched) {
      setMatched({ candidate: target, viaSpark: false });
    } else if (choice === "krevet") {
      vibrate(30);
      setKrevetToast(true);
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
      toastTimeout.current = setTimeout(() => setKrevetToast(false), 2500);
    }
  }

  async function handleSecretSpark() {
    if (!current || sparkSending || sparkedIds.has(current.id)) return;
    setSparkSending(true);
    setError(null);
    const target = current;
    const result = await sendSecretSpark(target.id);
    setSparkSending(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSparkedIds((prev) => new Set(prev).add(target.id));

    if (result.mutual) {
      setMatched({ candidate: target, viaSpark: true });
    } else {
      setSparkToast(true);
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
      toastTimeout.current = setTimeout(() => setSparkToast(false), 2500);
    }
  }

  useEffect(() => {
    return () => {
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
    };
  }, []);

  // Desktop fallback (sekcija 35): tastatura umesto swipe-a.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (matched) return;
      if (e.key === "ArrowLeft") handleChoice("nista");
      else if (e.key === "ArrowRight") handleChoice("upoznavanje");
      else if (e.key === "ArrowUp") handleChoice("krevet");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, pending, matched]);

  const currentSparked = current ? sparkedIds.has(current.id) : false;

  return (
    <div className="relative flex flex-1 flex-col gap-4">
      <div className="relative flex-1">
        {current ? (
          <SwipeCard key={current.id} candidate={current} disabled={pending} onChoice={handleChoice} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-6 text-center">
            <span className="text-4xl">🎉</span>
            <h2 className="text-lg font-semibold">To je za sada sve</h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              Prošao/la si sve dostupne profile. Svrati kasnije po nove.
            </p>
          </div>
        )}

        {sparkToast && (
          <div className="absolute inset-x-0 top-4 z-50 mx-auto w-fit rounded-full bg-black/80 px-4 py-2 text-sm text-white shadow-lg">
            🤫 Tajni signal poslat — ako ti i on/ona uzvratite, otključava se match
          </div>
        )}
        {krevetToast && (
          <div className="absolute inset-x-0 top-4 z-50 mx-auto w-fit rounded-full bg-black/80 px-4 py-2 text-sm text-white shadow-lg">
            😈 Poslato — ako i ona/on izabere tebe, otključava se match
          </div>
        )}
      </div>

      {error && <p className="text-center text-sm text-[var(--color-danger)]">{error}</p>}

      <div className="flex items-center justify-end pb-1">
        <button
          type="button"
          onClick={handleSecretSpark}
          disabled={!current || sparkSending || currentSparked}
          className={cn(
            "tap-scale flex h-9 w-9 items-center justify-center rounded-full border text-white disabled:opacity-40",
            currentSparked
              ? "border-transparent bg-[var(--color-success)]"
              : "border-[var(--color-border-strong)] bg-[var(--color-bg-card)] text-[var(--color-accent)]"
          )}
          aria-label="Pošalji tajni signal (Tajni Srbin/Srpkinja)"
          title="Tajni Srbin/Srpkinja — pošalji anoniman signal"
        >
          {currentSparked ? <Check size={14} /> : <Drama size={14} />}
        </button>
      </div>

      <div className="flex items-center justify-center gap-2 pb-2">
        <button
          type="button"
          onClick={() => handleChoice("krevet")}
          disabled={!current || pending}
          className="tap-scale pulse-glow flex flex-1 items-center justify-center gap-1.5 rounded-full border-2 border-[var(--color-accent-to)] bg-[var(--color-bg-card)] px-3 py-3.5 text-xs font-extrabold tracking-wide disabled:opacity-40"
        >
          😈 KREVET
        </button>
        <button
          type="button"
          onClick={() => handleChoice("upoznavanje")}
          disabled={!current || pending}
          className="tap-scale flex flex-1 items-center justify-center gap-1.5 rounded-full bg-gradient-accent px-3 py-3.5 text-xs font-extrabold tracking-wide text-white disabled:opacity-40"
        >
          <Heart size={16} /> UPOZNAVANJE
        </button>
        <button
          type="button"
          onClick={() => handleChoice("nista")}
          disabled={!current || pending}
          className="tap-scale flex flex-1 items-center justify-center gap-1.5 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-bg-card)] px-3 py-3.5 text-xs font-extrabold tracking-wide text-[var(--color-danger)] disabled:opacity-40"
        >
          <X size={16} /> NIŠTA
        </button>
      </div>

      {matched && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-black/92 px-6 text-center text-white">
          <MatchCelebration />
          <p className="animate-bubble-in text-5xl">{matched.viaSpark ? "🤫🔥" : "🔥"}</p>
          <h2 className="text-3xl font-extrabold text-gradient">
            {matched.viaSpark ? "OBOSTRANA PRIVLAČNOST!" : "MATCH!"}
          </h2>
          {matched.candidate.primary_photo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={matched.candidate.primary_photo_url}
              alt={matched.candidate.name}
              className="h-28 w-28 rounded-full border-4 border-black object-cover"
            />
          )}
          <p className="max-w-xs text-white/90">
            {matched.viaSpark ? (
              <>
                Vas dvoje ste jedno drugom poslali tajni signal — <strong>{matched.candidate.name}</strong> se
                svideo/la i tebi i ti njemu/njoj.
              </>
            ) : (
              <>
                Ti i <strong>{matched.candidate.name}</strong> ste se svideli jedno drugom.
              </>
            )}
          </p>
          <div className="flex w-full max-w-xs flex-col gap-2">
            <Link href="/match">
              <Button className="w-full">Idi na Match</Button>
            </Link>
            <Button variant="ghost" className="w-full" onClick={() => setMatched(null)}>
              Nastavi da otkrivaš
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
