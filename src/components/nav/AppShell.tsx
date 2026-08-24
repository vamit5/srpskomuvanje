"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User } from "lucide-react";
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
  creditsBalance,
}: {
  children: React.ReactNode;
  eighteenPlusPending?: boolean;
  creditsBalance?: number;
}) {
  const pathname = usePathname();
  const fullScreen = isFullScreenRoute(pathname);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      {/* Traka srpske trobojke -- vidljiva na SVAKOJ stranici (i chat),
          "nesto drugo pored zastave" iz zahteva -- konstantan brend dodir.
          margin-top: safe-top je NAMERAN -- bez njega traka pada ispod
          notch-a/status bara na telefonu i uopste se ne vidi. */}
      <div className="serbia-ribbon" style={{ marginTop: "var(--safe-top)" }} />
      {/* Srpskomuvanje brend (logo + ime) -- vidljiv na CELOJ app-i, ne samo
          na landing stranici (izricit zahtev), fiksirano skroz gore. */}
      {!fullScreen && (
        <div className="flex items-center justify-between gap-2 py-2 pl-4 pr-14">
          <span className="flex min-w-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-6 w-6 shrink-0 rounded-md" />
            <span className="truncate text-xs font-bold tracking-wide text-[var(--color-text-muted)]">Srpskomuvanje</span>
          </span>
          {creditsBalance != null && (
            // Uvek vidljiv saldo Credits-a -- korisnik mora u svako doba da
            // zna koliko ima, i klik vodi na /credits (istorija + kupovina).
            <Link
              href="/credits"
              className="tap-scale glass flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold"
            >
              🔥 {creditsBalance} <span className="font-normal text-[var(--color-text-muted)]">credits</span>
            </Link>
          )}
        </div>
      )}
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
          // "Bubble" prelaz izmedju tabova donjeg menija -- NAMERNO cist CSS
          // keyframe (.animate-bubble-in), NE Framer Motion. Framer Motion
          // ostavlja trajan inline "transform" na ovom omotacu (cak i kad
          // animira ka scale:1/y:0) -- a SVAKI "position: fixed" potomak
          // (CreditsModal i sl.) se onda pozicionira u odnosu na TAJ
          // transformisani div umesto na pravi viewport (CSS spec: transform
          // na pretku menja containing block za fixed decu) -- zato su se
          // svi modali pomerali van vidljive zone. Obican CSS keyframe nema
          // taj problem jer transform postoji SAMO tokom trajanja animacije.
          <div key={pathname} className="animate-bubble-in">{children}</div>
        )}
      </main>
      {!fullScreen && <BottomNav eighteenPlusPending={eighteenPlusPending} />}
    </div>
  );
}
