"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { Heart, X, Flame, ShieldCheck, Drama, Check } from "lucide-react";
import { calculateAge, cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
  getMoreCandidates,
  likeProfile,
  passProfile,
  superLikeProfile,
  sendSecretSpark,
  type DiscoveryCandidate,
} from "./actions";

const SWIPE_THRESHOLD = 120;

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
  disabled,
  onLike,
  onPass,
}: {
  candidate: DiscoveryCandidate;
  disabled: boolean;
  onLike: () => void;
  onPass: () => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-18, 18]);
  const likeOpacity = useTransform(x, [20, 120], [0, 1]);
  const nopeOpacity = useTransform(x, [-120, -20], [1, 0]);
  const age = calculateAge(candidate.birth_date);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x > SWIPE_THRESHOLD) onLike();
    else if (info.offset.x < -SWIPE_THRESHOLD) onPass();
  }

  return (
    <motion.div
      className="absolute inset-0"
      style={{ x, rotate }}
      drag={disabled ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={1}
      onDragEnd={handleDragEnd}
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
            {candidate.hot_mode_enabled && (
              <span className="rounded-full bg-black/50 px-2.5 py-1 text-xs font-semibold">😏 Hot Mode</span>
            )}
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

        <motion.div
          style={{ opacity: likeOpacity }}
          className="absolute left-5 top-8 -rotate-12 rounded-xl border-4 border-[var(--color-success)] px-3 py-1 text-xl font-extrabold text-[var(--color-success)]"
        >
          SVIĐA MI SE
        </motion.div>
        <motion.div
          style={{ opacity: nopeOpacity }}
          className="absolute right-5 top-8 rotate-12 rounded-xl border-4 border-[var(--color-danger)] px-3 py-1 text-xl font-extrabold text-[var(--color-danger)]"
        >
          PRESKOČI
        </motion.div>
      </div>
    </motion.div>
  );
}

export function OtkrijDeck({ initialCandidates }: { initialCandidates: DiscoveryCandidate[] }) {
  const [stack, setStack] = useState(initialCandidates);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matched, setMatched] = useState<MatchState | null>(null);
  const [sparkedIds, setSparkedIds] = useState<Set<string>>(new Set());
  const [sparkSending, setSparkSending] = useState(false);
  const [sparkToast, setSparkToast] = useState(false);
  const fetchingMore = useRef(false);
  const sparkToastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = stack[0];

  async function maybeFetchMore(remaining: DiscoveryCandidate[]) {
    if (remaining.length > 2 || fetchingMore.current) return;
    fetchingMore.current = true;
    const { candidates } = await getMoreCandidates();
    const existingIds = new Set(remaining.map((c) => c.id));
    setStack((prev) => [...prev, ...candidates.filter((c) => !existingIds.has(c.id))]);
    fetchingMore.current = false;
  }

  async function handleAction(kind: "like" | "pass" | "super_like") {
    if (!current || pending) return;
    setPending(true);
    setError(null);
    const target = current;
    const rest = stack.slice(1);
    setStack(rest);

    const action = kind === "like" ? likeProfile : kind === "pass" ? passProfile : superLikeProfile;
    const result = await action(target.id);
    setPending(false);

    // Tek POSLE što je lajk/pass upisan u bazu tražimo još kandidata --
    // inače bi "discover_profiles" mogao da vrati istu osobu koju smo
    // upravo sklonili, ako fetch stigne pre nego što se upis zabeleži.
    maybeFetchMore(rest);

    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.matched) setMatched({ candidate: target, viaSpark: false });
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
      if (sparkToastTimeout.current) clearTimeout(sparkToastTimeout.current);
      sparkToastTimeout.current = setTimeout(() => setSparkToast(false), 2500);
    }
  }

  useEffect(() => {
    return () => {
      if (sparkToastTimeout.current) clearTimeout(sparkToastTimeout.current);
    };
  }, []);

  // Desktop fallback (sekcija 35): tastatura umesto swipe-a.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (matched) return;
      if (e.key === "ArrowLeft") handleAction("pass");
      else if (e.key === "ArrowRight") handleAction("like");
      else if (e.key === "ArrowUp") handleAction("super_like");
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
          <SwipeCard
            key={current.id}
            candidate={current}
            disabled={pending}
            onLike={() => handleAction("like")}
            onPass={() => handleAction("pass")}
          />
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
      </div>

      {error && <p className="text-center text-sm text-[var(--color-danger)]">{error}</p>}

      <div className="flex items-center justify-center gap-3 pb-2">
        <button
          type="button"
          onClick={() => handleAction("pass")}
          disabled={!current || pending}
          className="tap-scale flex h-14 w-14 items-center justify-center rounded-full border border-[var(--color-border-strong)] bg-[var(--color-bg-card)] text-[var(--color-danger)] disabled:opacity-40"
          aria-label="Preskoči"
        >
          <X size={26} />
        </button>
        <button
          type="button"
          onClick={handleSecretSpark}
          disabled={!current || sparkSending || currentSparked}
          className={cn(
            "tap-scale flex h-12 w-12 items-center justify-center rounded-full border text-white disabled:opacity-40",
            currentSparked
              ? "border-transparent bg-[var(--color-success)]"
              : "border-[var(--color-border-strong)] bg-[var(--color-bg-card)] text-[var(--color-accent)]"
          )}
          aria-label="Pošalji tajni signal (Tajni Srbin/Srpkinja)"
          title="Tajni Srbin/Srpkinja — pošalji anoniman signal"
        >
          {currentSparked ? <Check size={18} /> : <Drama size={18} />}
        </button>
        <button
          type="button"
          onClick={() => handleAction("super_like")}
          disabled={!current || pending}
          className="tap-scale flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-border-strong)] bg-[var(--color-bg-card)] text-[var(--color-accent-to)] disabled:opacity-40"
          aria-label="Super lajk"
        >
          <Flame size={20} />
        </button>
        <button
          type="button"
          onClick={() => handleAction("like")}
          disabled={!current || pending}
          className="tap-scale flex h-14 w-14 items-center justify-center rounded-full bg-gradient-accent text-white disabled:opacity-40"
          aria-label="Sviđa mi se"
        >
          <Heart size={26} />
        </button>
      </div>

      {matched && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-black/92 px-6 text-center text-white">
          <p className="text-5xl">{matched.viaSpark ? "🤫🔥" : "🔥"}</p>
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
