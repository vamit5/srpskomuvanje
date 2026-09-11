import { createClient } from "@/lib/supabase/server";
import { mergeSiteContent } from "@/lib/siteContent";
import { SiteContentForm } from "./SiteContentForm";

export const metadata = { title: "Admin — Sadržaj" };

export default async function AdminPocetnaPage() {
  const supabase = await createClient();
  const { data: rows } = await supabase.from("site_content").select("key, value");
  const content = mergeSiteContent(rows);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Sadržaj sajta i aplikacije</h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Prva sekcija je tekst koji vide posetioci na srpskomuvanje.vercel.app pre nego što se
          prijave (naslovi, dugmad, opisi kartica). Ostale sekcije menjaju tekst unutar same
          aplikacije, npr. bedž za istaknute profile.
        </p>
      </div>
      <SiteContentForm initialContent={content} />
    </div>
  );
}
