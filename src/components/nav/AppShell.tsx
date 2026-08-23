"use client";

import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { BottomNav } from "./BottomNav";
import { cn } from "@/lib/utils";

/**
 * Chat razgovor (/poruke/[matchId]) i 18+ Muvanje su jedine stranice koje
 * treba PUNU visinu ekrana za sebe -- kod chata da polje za kucanje bude
 * odmah iznad tastature/ivice ekrana (kao WhatsApp/Telegram), kod 18+
 * Muvanja da atmosfera bude potpuno uronjena (bez donje navigacije koja
 * razbija tok). U oba slucaja <main> ne sme imati rezervisan razmak
 * (pb-24), inače se sopstvena h-dvh visina "gura" ispod vidljivog dela
 * ekrana. Svaki ekran ovde SAM dodaje "safe-top" (notch/status bar
 * razmak) -- AppShell ga NE dodaje za fullScreen rute.
 */
function isFullScreenRoute(pathname: string | null): boolean {
  return !!pathname && (/^\/poruke\/[^/]+$/.test(pathname) || pathname.startsWith("/18-plus"));
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
