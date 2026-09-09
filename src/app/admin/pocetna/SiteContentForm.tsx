"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SITE_CONTENT_FIELDS, type SiteContent } from "@/lib/siteContent";
import { updateSiteContent } from "./actions";

export function SiteContentForm({ initialContent }: { initialContent: SiteContent }) {
  const router = useRouter();
  const [values, setValues] = useState<SiteContent>(initialContent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function setField(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSuccess(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    const result = await updateSiteContent(values);
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setSuccess(true);
    router.refresh();
  }

  const sections: string[] = [];
  for (const f of SITE_CONTENT_FIELDS) {
    if (!sections.includes(f.section)) sections.push(f.section);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {sections.map((section) => (
        <section key={section} className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
          <h3 className="text-sm font-semibold text-[var(--color-text-muted)]">{section}</h3>
          {SITE_CONTENT_FIELDS.filter((f) => f.section === section).map((f) => (
            <div key={f.key} className="flex flex-col gap-1">
              <label className="text-xs text-[var(--color-text-muted)]">{f.label}</label>
              {f.multiline ? (
                <textarea
                  className="h-20 w-full rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] p-3 text-sm outline-none focus:border-[var(--color-accent)]"
                  value={values[f.key]}
                  onChange={(e) => setField(f.key, e.target.value)}
                  maxLength={500}
                />
              ) : (
                <Input value={values[f.key]} onChange={(e) => setField(f.key, e.target.value)} maxLength={200} />
              )}
            </div>
          ))}
        </section>
      ))}

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
      {success && <p className="text-sm text-[var(--color-success)]">Sačuvano ✓ — promene su odmah vidljive na sajtu.</p>}

      <Button type="submit" size="lg" disabled={saving}>
        {saving ? "Čuvam..." : "Sačuvaj sve izmene"}
      </Button>
    </form>
  );
}
