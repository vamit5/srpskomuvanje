import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { SerbianFlag } from "@/components/SerbianFlag";
import { createClient } from "@/lib/supabase/server";
import { mergeSiteContent } from "@/lib/siteContent";

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: rows } = await supabase.from("site_content").select("key, value");
  const c = mergeSiteContent(rows);

  const FEATURES = [
    { emoji: c.feature_1_emoji, title: c.feature_1_title, text: c.feature_1_text },
    { emoji: c.feature_2_emoji, title: c.feature_2_title, text: c.feature_2_text },
    { emoji: c.feature_3_emoji, title: c.feature_3_title, text: c.feature_3_text },
    { emoji: c.feature_4_emoji, title: c.feature_4_title, text: c.feature_4_text },
    { emoji: c.feature_5_emoji, title: c.feature_5_title, text: c.feature_5_text },
    { emoji: c.feature_6_emoji, title: c.feature_6_title, text: c.feature_6_text },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="safe-top flex items-center justify-between px-5 py-4">
        <span className="flex items-center gap-2 text-lg font-bold text-gradient">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-7 w-7 rounded-lg" /> {c.header_title}
        </span>
        <Link href="/prijava" className="text-sm text-[var(--color-text-muted)]">
          {c.header_login_label}
        </Link>
      </header>

      <main className="flex-1">
        <section className="flex flex-col items-center px-6 pb-10 pt-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Srpskomuvanje" className="mb-3 h-20 w-20 rounded-2xl" />
          <p className="mb-4 text-xs font-semibold text-[var(--color-text-muted)]">{c.hero_kicker}</p>
          <span className="bg-gradient-serbia mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold text-white">
            <SerbianFlag /> {c.hero_badge}
          </span>
          <h1 className="text-4xl font-extrabold leading-tight">
            {c.hero_title_line1} <span className="text-gradient">{c.hero_title_line2}</span>
          </h1>
          <p className="mt-4 max-w-sm text-[15px] text-[var(--color-text-muted)]">{c.hero_subtitle}</p>
          <Link href="/registracija" className="mt-6 w-full max-w-xs">
            <Button size="lg" className="w-full">
              {c.hero_cta}
            </Button>
          </Link>
          <p className="mt-3 text-xs text-[var(--color-text-faint)]">{c.hero_note}</p>
        </section>

        <section className="grid grid-cols-1 gap-3 px-5 pb-12 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
              <span className="text-2xl">{f.emoji}</span>
              <h3 className="mt-2 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">{f.text}</p>
            </div>
          ))}
        </section>

        <section className="mx-5 mb-12 rounded-3xl bg-gradient-accent p-6 text-center text-white">
          <h2 className="text-xl font-bold">{c.premium_title}</h2>
          <p className="mt-2 text-sm text-white/90">{c.premium_text}</p>
        </section>

        <section className="px-6 pb-16 text-center">
          <h2 className="text-lg font-semibold">{c.bottom_cta_title}</h2>
          <Link href="/registracija" className="mt-4 inline-block w-full max-w-xs">
            <Button size="lg" className="w-full">
              {c.bottom_cta_button}
            </Button>
          </Link>
        </section>
      </main>

      <footer className="safe-bottom border-t border-[var(--color-border)] px-6 py-6 text-center text-xs text-[var(--color-text-faint)]">
        <p>{c.footer_age_note}</p>
        <p className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <Link href="/uslovi-koriscenja" className="underline">
            Uslovi korišćenja
          </Link>
          <Link href="/politika-privatnosti" className="underline">
            Politika privatnosti
          </Link>
        </p>
        <p className="mt-1">
          {c.footer_contact_label}{" "}
          <a href="mailto:srpskomuvanje@gmail.com" className="underline">
            srpskomuvanje@gmail.com
          </a>
        </p>
      </footer>
    </div>
  );
}
