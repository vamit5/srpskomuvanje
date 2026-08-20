export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <div className="mb-8 flex flex-col items-center gap-2">
        <span className="text-4xl">🔥</span>
        <h1 className="text-2xl font-bold text-gradient">Iskra</h1>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
