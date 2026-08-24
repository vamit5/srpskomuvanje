"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { BottomNav } from "./BottomNav";
import { cn } from "@/lib/utils";

/**
 * Chat razgovori (/poruke/[matchId] i /18-plus/chat/[matchId]) su jedine
 * stranice koje treba PUNU visinu ekrana za sebe -- polje za kucanje mora
 * biti odmah iznad tastature/ivice ekrana (kao WhatsApp/Telegram). <main>
 * tu ne sme imati rezervisan razmak (pb-24), inače se sopstvena h-dvh
 * visina "gura" ispod vidljivog dela ekrana. 18+ Muvanje LISTA (ne chat)
 * ima donju navigaciju kao svaka druga stranica.
 */
function isFullScreenRoute(pathname: string | null): boolean {
  return !!pathname && (/^\/poruke\/[^/]+$/.test(pathname) || /^\/18-plus\/chat\/[^/]+$/.test(pathname));
}

export function AppShell({
  children,
  eighteenPlusPending = false,
}: {
  children: React.ReactNode;
  eighteenPlusPending?: boolean;
}) {
  const pathname = usePathname();
  const fullScreen = isFullScreenRoute(pathname);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      {!fullScreen && pathname !== "/profil" && (
        // "Moj profil" -- vidljivo na CELOJ app-i (ne samo na Sada), fixed
        // gore desno, iznad safe-area (notch/status bar).
        <Link
          href="/profil"
          aria-label="Moj profil"
          className="tap-scale glass fixed right-3 z-40 flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-text-muted)]"
          style={{ top: "calc(var(--safe-top) + 0.75rem)" }}
        >
          <User size={19} />
        </Link>
      )}
      <main className={cn("flex-1", fullScreen ? "" : "safe-top pb-24")}>
        {fullScreen ? (
          children
        ) : (
          // "Bubble" prelaz izmedju tabova donjeg menija -- namerno NE za
          // fullScreen rute (chat/18+ Muvanje) da se ne kosi sa njihovim
          // sopstvenim animacijama i da ostanu trenutno responzivne.
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.22, ease: [0.34, 1.2, 0.64, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        )}
      </main>
      {!fullScreen && <BottomNav eighteenPlusPending={eighteenPlusPending} />}
    </div>
  );
}
