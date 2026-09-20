"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { FeaturedBadge } from "@/components/FeaturedBadge";

export interface IzborItem {
  id: string;
  name: string;
  age: number;
  city: string | null;
  photoUrl: string | null;
  isFeatured: boolean;
  createdAt: string;
}

type SortBy = "novo" | "ime";

function ItemRow({ item, featuredBadgeLabel }: { item: IzborItem; featuredBadgeLabel: string }) {
  return (
    <Link href={`/profil/${item.id}`} className="glass tap-scale flex items-center gap-3 rounded-2xl px-4 py-3">
      {item.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.photoUrl} alt={item.name} className="h-12 w-12 rounded-full object-cover" />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-accent text-sm font-bold text-white">
          {item.name[0]?.toUpperCase() ?? "?"}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
          {item.name}, {item.age}
          {item.isFeatured && <FeaturedBadge label={featuredBadgeLabel} />}
        </p>
        <p className="truncate text-xs text-[var(--color-text-muted)]">{item.city ?? "Grad nije podešen"}</p>
      </div>
      <span className="shrink-0 text-xs text-[var(--color-text-faint)]">
        {new Date(item.createdAt).toLocaleDateString("sr-RS", { day: "numeric", month: "short" })}
      </span>
    </Link>
  );
}

export function IzboriList({
  upoznavanje,
  featuredBadgeLabel,
}: {
  upoznavanje: IzborItem[];
  featuredBadgeLabel: string;
}) {
  const [sortBy, setSortBy] = useState<SortBy>("novo");

  const sorted = useMemo(() => {
    const copy = [...upoznavanje];
    if (sortBy === "ime") copy.sort((a, b) => a.name.localeCompare(b.name, "sr"));
    else copy.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return copy;
  }, [upoznavanje, sortBy]);

  return (
    <div className="flex flex-col gap-3">
      {sorted.length > 0 && (
        <div className="flex items-center justify-end gap-2 text-xs text-[var(--color-text-muted)]">
          <span>Sortiraj:</span>
          <button
            type="button"
            onClick={() => setSortBy("novo")}
            className={cn("tap-scale rounded-full px-2.5 py-1", sortBy === "novo" ? "bg-gradient-accent text-white" : "border border-[var(--color-border-strong)]")}
          >
            Najnovije
          </button>
          <button
            type="button"
            onClick={() => setSortBy("ime")}
            className={cn("tap-scale rounded-full px-2.5 py-1", sortBy === "ime" ? "bg-gradient-accent text-white" : "border border-[var(--color-border-strong)]")}
          >
            Ime
          </button>
        </div>
      )}

      {sorted.length === 0 ? (
        <EmptyState
          emoji="📋"
          title="Još nikog nema ovde"
          description="Kad izabereš 'Upoznavanje' na nekom profilu u Muvaj, pojaviće se ovde dok čekaš odgovor."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((item) => (
            <ItemRow key={item.id} item={item} featuredBadgeLabel={featuredBadgeLabel} />
          ))}
        </div>
      )}
    </div>
  );
}
