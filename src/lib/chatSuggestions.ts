import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SuggestionPool } from "@/lib/icebreakers";

/**
 * Ucitava aktivne predloge poruka za jednu kategoriju (normal/hot), vec
 * podeljene po fazi razgovora -- koristi se u ChatThread stranicama
 * (server komponente /poruke/[matchId] i /18-plus/chat/[matchId]).
 * Admin menja/dodaje predloge na /admin/predlozi.
 */
export async function getChatSuggestionPool(
  supabase: SupabaseClient,
  category: "normal" | "hot"
): Promise<SuggestionPool> {
  const { data } = await supabase
    .from("chat_suggestions")
    .select("text, stage")
    .eq("category", category)
    .eq("is_active", true)
    .order("sort_order");

  const rows = (data ?? []) as { text: string; stage: number }[];
  return {
    stage1: rows.filter((r) => r.stage === 1).map((r) => r.text),
    stage2: rows.filter((r) => r.stage === 2).map((r) => r.text),
    stage3: rows.filter((r) => r.stage === 3).map((r) => r.text),
  };
}
