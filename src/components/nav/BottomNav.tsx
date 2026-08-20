"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, Compass, Heart, MessageCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/sada", label: "Sada", icon: Flame },
  { href: "/otkrij", label: "Otkrij", icon: Compass },
  { href: "/match", label: "Match", icon: Heart },
  { href: "/poruke", label: "Poruke", icon: MessageCircle },
  { href: "/profil", label: "Profil", icon: User },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="glass safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-[var(--color-border)]"
      aria-label="Glavna navigacija"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className="tap-scale flex flex-col items-center gap-1 py-2.5 text-[11px]"
              >
                <Icon
                  size={22}
                  strokeWidth={active ? 2.4 : 1.8}
                  className={active ? "text-gradient" : "text-[var(--color-text-muted)]"}
                  style={
                    active
                      ? { stroke: "url(#iskra-nav-gradient)" }
                      : undefined
                  }
                />
                <span
                  className={cn(
                    "font-medium",
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
