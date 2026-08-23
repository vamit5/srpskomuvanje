"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "./BottomNav";
import { cn } from "@/lib/utils";

/**
 * Chat razgovor (/poruke/[matchId]) je JEDINA stranica koja treba PUNU
 * visinu ekrana za sebe (polje za kucanje mora biti odmah iznad tastature/
 * ivice ekrana, kao u WhatsApp-u/Telegramu) -- zato tamo NEMA donje
 * navigacije, i <main> ne sme imati rezervisan razmak za nju (pb-24),
 * inače se ChatThread-ova sopstvena h-dvh visina "gura" ispod vidljivog
 * dela ekrana i korisnik mora da skroluje da vidi dugme za slanje.
 */
function isFullScreenRoute(pathname: string | null): boolean {
  return !!pathname && /^\/poruke\/[^/]+$/.test(pathname);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const fullScreen = isFullScreenRoute(pathname);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <main className={cn("flex-1", fullScreen ? "" : "safe-top pb-24")}>{children}</main>
      {!fullScreen && <BottomNav />}
    </div>
  );
}
