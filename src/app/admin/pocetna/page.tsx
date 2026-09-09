import { createClient } from "@/lib/supabase/server";
import { mergeSiteContent } from "@/lib/siteContent";
import { SiteContentForm } from "./SiteContentForm";

export const metadata = { title: "Admin — Početna strana" };

export default async function AdminPocetnaPage() {
  const supabase = await createClient();
  const { data: rows } = await supabase.from("site_content").select("key, value");
  const content = mergeSiteContent(rows);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Sadržaj javne početne strane</h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Ovo je tekst koji vide posetioci na srpskomuvanje.vercel.app pre nego što se prijave —
          naslovi, dugmad, opisi kartica. Ne dira ostatak aplikacije (posle prijave).
        </p>
      </div>
      <SiteContentForm initialContent={content} />
    </div>
  );
}
