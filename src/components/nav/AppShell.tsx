"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "./BottomNav";
import { cn } from "@/lib/utils";

/**
 * Chat razgovor (/poruke/[matchId]) i Tajna soba su jedine stranice koje
 * treba PUNU visinu ekrana za sebe -- kod chata da polje za kucanje bude
 * odmah iznad tastature/ivice ekrana (kao WhatsApp/Telegram), kod Tajne
 * sobe da atmosfera bude potpuno uronjena (bez donje navigacije koja
 * razbija "igru"). U oba slucaja <main> ne sme imati rezervisan razmak
 * (pb-24), inače se sopstvena h-dvh visina "gura" ispod vidljivog dela
 * ekrana.
 */
function isFullScreenRoute(pathname: string | null): boolean {
  return !!pathname && (/^\/poruke\/[^/]+$/.test(pathname) || pathname.startsWith("/tajna-soba"));
}

export function AppShell({ children, secretRoomLive = false }: { children: React.ReactNode; secretRoomLive?: boolean }) {
  const pathname = usePathname();
  const fullScreen = isFullScreenRoute(pathname);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <main className={cn("flex-1", fullScreen ? "" : "safe-top pb-24")}>{children}</main>
      {!fullScreen && <BottomNav secretRoomLive={secretRoomLive} />}
    </div>
  );
}
