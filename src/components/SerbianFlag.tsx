/**
 * Prava srpska trobojka -- CRVENA (gore) / PLAVA (sredina) / BELA (dole).
 * PAZI: obrnut redosled (belo/plavo/crveno odozgo) je RUSKA zastava, ne
 * srpska -- bag koji se vec jednom desio ovde (preklapajuci rect-ovi u
 * pogresnom redosledu su nenamerno napravili rusku). Zato su ovde TRI
 * ODVOJENE (ne preklapajuce) trake, da nema dvosmislenosti.
 */
export function SerbianFlag({ className = "h-4 w-6 rounded-[2px]", animated = false }: { className?: string; animated?: boolean }) {
  return (
    <svg viewBox="0 0 3 2" className={`${className}${animated ? " animate-flag-wave" : ""}`} aria-hidden="true">
      <rect y="0" width="3" height="0.667" fill="#C6363C" />
      <rect y="0.667" width="3" height="0.667" fill="#0C4076" />
      <rect y="1.333" width="3" height="0.667" fill="#FFFFFF" />
    </svg>
  );
}
