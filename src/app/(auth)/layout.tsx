export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <div className="mb-8 flex flex-col items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Srpskomuvanje" className="h-16 w-16 rounded-2xl" />
        <h1 className="text-sm font-semibold text-[var(--color-text-muted)]">Srpskomuvanje</h1>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
