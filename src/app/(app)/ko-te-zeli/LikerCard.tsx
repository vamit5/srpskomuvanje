"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { likeProfile } from "../otkrij/actions";

export function LikerCard({
  id,
  name,
  age,
  photoUrl,
  isSuper,
}: {
  id: string;
  name: string;
  age: number;
  photoUrl: string | null;
  isSuper: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [matched, setMatched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLikeBack() {
    setLoading(true);
    setError(null);
    const result = await likeProfile(id);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.matched) {
      setMatched(true);
      setTimeout(() => router.push("/match"), 900);
    }
  }

  return (
    <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt={name} className="h-14 w-14 rounded-full object-cover" />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-accent text-lg font-bold text-white">
          {name[0]?.toUpperCase() ?? "?"}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {name}, {age} {isSuper && <span title="Super lajk">⭐</span>}
        </p>
        {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      </div>
      {matched ? (
        <span className="shrink-0 text-sm font-semibold text-[var(--color-success)]">Match! 🔥</span>
      ) : (
        <button
          type="button"
          onClick={handleLikeBack}
          disabled={loading}
          className="tap-scale shrink-0 rounded-full bg-gradient-accent px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {loading ? "..." : "❤️ Lajkuj"}
        </button>
      )}
    </div>
  );
}
