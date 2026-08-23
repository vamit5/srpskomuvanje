"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, Compass, Heart, MessageCircle, Swords, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/sada", label: "Home", icon: Flame, secret: false },
  { href: "/muvaj", label: "Muvaj", icon: Compass, secret: false },
  { href: "/match", label: "Match", icon: Heart, secret: false },
  { href: "/tajna-soba", label: "Tajna soba", icon: Lock, secret: true },
  { href: "/poruke", label: "Poruke", icon: MessageCircle, secret: false },
  { href: "/duel", label: "Duel", icon: Swords, secret: false },
] as const;

export function BottomNav({
  secretRoomLive = false,
  secretRoomPending = false,
}: {
  secretRoomLive?: boolean;
  secretRoomPending?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav
      className="glass safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-[var(--color-border)]"
      aria-label="Glavna navigacija"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-1">
        {TABS.map(({ href, label, icon: Icon, secret }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          const glow = secret && secretRoomLive;
          const pending = secret && secretRoomPending;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className="tap-scale relative flex flex-col items-center gap-0.5 py-2.5 text-[10px]"
              >
                {pending ? (
                  <span className="absolute -top-0.5 right-1/2 flex h-4 w-4 translate-x-3 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                    !
                  </span>
                ) : (
                  glow && (
                    <span className="absolute -top-0.5 right-1/2 h-1.5 w-1.5 translate-x-3 animate-pulse rounded-full bg-red-500" />
                  )
                )}
                <Icon
                  size={21}
                  strokeWidth={active ? 2.4 : 1.8}
                  className={cn(
                    active ? "text-gradient" : glow ? "text-[var(--color-accent-to)]" : "text-[var(--color-text-muted)]"
                  )}
                  style={
                    active
                      ? { stroke: "url(#iskra-nav-gradient)" }
                      : undefined
                  }
                />
                <span
                  className={cn(
                    "font-medium leading-tight",
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
