import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/prijava");

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect("/sada");

  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 pb-16 pt-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">
          🛠️ <span className="text-gradient">Admin</span>
        </h1>
        <Link href="/sada" className="text-sm text-[var(--color-text-muted)] underline">
          Nazad u app
        </Link>
      </header>

      <nav className="mb-6 flex gap-2 border-b border-[var(--color-border)]">
        {[
          { href: "/admin", label: "Pregled" },
          { href: "/admin/reports", label: "Prijave" },
          { href: "/admin/sadrzaj", label: "Sadržaj" },
          { href: "/admin/nocno-muvanje", label: "Noćno muvanje" },
          { href: "/admin/tajna-soba", label: "Tajna soba" },
          { href: "/admin/users", label: "Korisnici" },
          { href: "/admin/events", label: "Događaji" },
        ].map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="px-3 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
