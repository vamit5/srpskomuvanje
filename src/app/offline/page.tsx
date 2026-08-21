export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-4xl">📡</p>
      <h1 className="text-xl font-semibold">Nema interneta</h1>
      <p className="max-w-xs text-sm text-[var(--color-text-muted)]">
        Srpskomuvanje treba internet konekciju da bi ti pokazalo šta se dešava upravo sada. Proveri
        konekciju i pokušaj ponovo.
      </p>
    </main>
  );
}
