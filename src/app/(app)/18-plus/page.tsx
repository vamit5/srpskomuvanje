import { createClient } from "@/lib/supabase/server";
import { mergeSiteContent } from "@/lib/siteContent";
import { get18PlusCandidates, getPendingKrevetSignals } from "./actions";
import { EighteenPlusApp } from "./EighteenPlusApp";

export const metadata = { title: "18+ Muvanje" };

export default async function EighteenPlusPage() {
  const supabase = await createClient();
  const [{ candidates }, { signals, costCredits }, { data: contentRows }] = await Promise.all([
    get18PlusCandidates(),
    getPendingKrevetSignals(),
    supabase.from("site_content").select("key, value").eq("key", "featured_badge_label"),
  ]);
  const featuredBadgeLabel = mergeSiteContent(contentRows).featured_badge_label;

  return (
    <EighteenPlusApp
      initialSignals={signals}
      initialCandidates={candidates}
      costCredits={costCredits}
      featuredBadgeLabel={featuredBadgeLabel}
    />
  );
}
