/**
 * Prikazuje se AUTOMATSKI od strane Next.js-a (App Router "loading.tsx"
 * konvencija) dok se nova stranica ucitava -- BottomNav/header ostaju na
 * mestu (Suspense granica je samo oko <main>{children}</main> sadrzaja),
 * samo se sadrzaj stranice privremeno zameni ovim spinnerom. Radi na
 * CELOJ app-i jer je postavljen na nivou (app) layout-a -- svaka
 * podstranica ga automatski nasledjuje bez ikakve dodatne konfiguracije.
 */
export function LogoSpinner() {
  return (
    <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Učitavanje" className="h-14 w-14 animate-spin rounded-2xl" />
      <p className="text-xs font-medium text-[var(--color-text-faint)]">Učitavam...</p>
    </div>
  );
}
