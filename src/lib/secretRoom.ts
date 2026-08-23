import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { belgradeTimeHHMM, isWithinDailyWindow } from "@/lib/time";

// Mala keš-mapa u okviru jednog "toplog" servera (isti obrazac kao
// src/lib/nightFlirting.ts) -- izbegava N upita ka secret_room_config za
// N poziva u istom procesu.
let configCache: Map<string, string> | null = null;

async function loadConfig(): Promise<Map<string, string>> {
  if (configCache) return configCache;
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data } = await admin.from("secret_room_config").select("key, value");
  configCache = new Map((data ?? []).map((row) => [row.key, row.value]));
  return configCache;
}

export async function getConfigNumber(key: string, fallback: number): Promise<number> {
  const config = await loadConfig();
  const raw = config.get(key);
  const parsed = raw !== undefined ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function getConfigString(key: string, fallback: string): Promise<string> {
  const config = await loadConfig();
  return config.get(key) ?? fallback;
}

export interface DuelQuestionOption {
  emoji: string;
  label: string;
}

export interface DuelQuestion {
  text: string;
  options: DuelQuestionOption[];
}

export async function getDuelQuestions(): Promise<DuelQuestion[]> {
  const raw = await getConfigString("duel_questions", "[]");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DuelQuestion[]) : [];
  } catch {
    return [];
  }
}

/**
 * Tajna soba je dostupna uvek, ali je "UŽIVO" istaknuta u navigaciji samo
 * uveče (sekcija 4 spec-a) -- isti Belgrade-vreme mehanizam kao "Večeras"
 * status Hot Mode-a (src/lib/time.ts).
 */
export async function isSecretRoomEveningLive(): Promise<boolean> {
  const start = await getConfigString("evening_start_hhmm", "20:00");
  const end = await getConfigString("evening_end_hhmm", "02:00");
  return isWithinDailyWindow(belgradeTimeHHMM(), start, end);
}

export { FOOD_FAVORITE_OPTIONS, type FoodFavorite } from "@/lib/foodFavorites";

export type SecretRoomEvent =
  | "secret_room_opened"
  | "secret_room_started"
  | "secret_room_profile_viewed"
  | "secret_room_like"
  | "secret_room_pass"
  | "secret_room_risk_clicked"
  | "secret_room_request_sent"
  | "secret_room_request_received"
  | "secret_room_request_accepted"
  | "secret_room_request_rejected"
  | "secret_room_request_expired"
  | "secret_room_duel_started"
  | "secret_room_duel_match"
  | "secret_room_chemistry_confirmed"
  | "secret_room_chat_started"
  | "secret_room_round_expired"
  | "secret_room_payment_started"
  | "secret_room_payment_completed";

/** Isti obrazac kao logNightFlirtingEvent -- upisuje se u activity_events (RLS: "korisnik upisuje svoje aktivnosti"). */
export async function logSecretRoomEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string,
  eventName: SecretRoomEvent,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  await supabase.from("activity_events").insert({ profile_id: profileId, event_name: eventName, metadata });
}
