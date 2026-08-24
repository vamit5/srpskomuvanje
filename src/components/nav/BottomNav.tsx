"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, Compass, Heart, MessageCircle, Swords, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/sada", label: "Home", icon: Flame, eighteenPlus: false },
  { href: "/muvaj", label: "Muvaj", icon: Compass, eighteenPlus: false },
  { href: "/match", label: "Match", icon: Heart, eighteenPlus: false },
  { href: "/18-plus", label: "18+", icon: Zap, eighteenPlus: true },
  { href: "/poruke", label: "Poruke", icon: MessageCircle, eighteenPlus: false },
  { href: "/duel", label: "Duel", icon: Swords, eighteenPlus: false },
] as const;

export function BottomNav({ eighteenPlusPending = false }: { eighteenPlusPending?: boolean }) {
  const pathname = usePathname();
  // Bubble efekat u bojama Srbije pri klику na tab -- brojac (ne bool) da
  // svaki klik, čak i na ISTI tab dva puta zaredom, dobije svoj sveži
  // "key" i time novi animacioni ciklus (React inače ne bi re-triggerovao
  // CSS animaciju na nepromenjenom elementu).
  const [tapped, setTapped] = useState<{ href: string; n: number } | null>(null);

  return (
    <nav
      className="glass safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-[var(--color-border)]"
      aria-label="Glavna navigacija"
    >
      <div className="serbia-ribbon" />
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-1">
        {TABS.map(({ href, label, icon: Icon, eighteenPlus }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          const pending = eighteenPlus && eighteenPlusPending;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                onClick={() => setTapped((prev) => ({ href, n: (prev?.href === href ? prev.n : 0) + 1 }))}
                className="tap-scale relative flex flex-col items-center gap-0.5 py-2.5 text-[10px]"
              >
                {tapped?.href === href && (
                  <span key={tapped.n} className="nav-bubble animate-nav-bubble" aria-hidden="true" />
                )}
                {pending && (
                  <span className="absolute -top-0.5 right-1/2 flex h-4 w-4 translate-x-3 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                    !
                  </span>
                )}
                <Icon
                  size={21}
                  strokeWidth={active ? 2.4 : 1.8}
                  className={cn("relative", active ? "text-gradient" : "text-[var(--color-text-muted)]")}
                  style={
                    active
                      ? { stroke: "url(#iskra-nav-gradient)" }
                      : undefined
                  }
                />
                <span
                  className={cn(
                    "relative font-medium leading-tight",
                    active ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)]"
                  )}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {/* SVG gradient definicija za ikonice (lucide prihvata stroke: url(#id)) */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="iskra-nav-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-accent-from)" />
            <stop offset="100%" stopColor="var(--color-accent-to)" />
          </linearGradient>
        </defs>
      </svg>
    </nav>
  );
}
