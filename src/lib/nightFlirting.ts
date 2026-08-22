import "server-only";
import type { createClient } from "@/lib/supabase/server";

export type NightClassification = "green" | "yellow" | "red";
export type NightModerationStatus =
  | "auto"
  | "pending_review"
  | "admin_locked"
  | "admin_unlocked"
  | "admin_marked_safe"
  | "rejected";

export interface NightClassificationResult {
  classification: NightClassification;
  moderationStatus: NightModerationStatus;
  score: number | null;
}

interface SightengineNudityResponse {
  status?: string;
  nudity?: {
    sexual_activity?: number;
    sexual_display?: number;
    erotica?: number;
    very_suggestive?: number;
  };
}

interface NudityScores {
  activityScore: number;
  displayScore: number;
}

/** Jedan poziv Sightengine-a za JEDNU sliku (ili jedan frejm videa). null = poziv nije uspeo. */
async function getNudityScores(imageUrl: string): Promise<NudityScores | null> {
  const apiUser = process.env.SIGHTENGINE_API_USER;
  const apiSecret = process.env.SIGHTENGINE_API_SECRET;
  if (!apiUser || !apiSecret) return null;

  try {
    const params = new URLSearchParams({
      url: imageUrl,
      models: "nudity-2.1",
      api_user: apiUser,
      api_secret: apiSecret,
    });
    const res = await fetch(`https://api.sightengine.com/1.0/check.json?${params.toString()}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as SightengineNudityResponse;
    if (data.status !== "success" || !data.nudity) return null;

    return {
      activityScore: data.nudity.sexual_activity ?? 0,
      displayScore: Math.max(
        data.nudity.sexual_display ?? 0,
        data.nudity.erotica ?? 0,
        data.nudity.very_suggestive ?? 0
      ),
    };
  } catch (err) {
    console.error("Sightengine (Noćno muvanje) poziv nije uspeo:", err);
    return null;
  }
}

/**
 * Klasifikacija SAMO za Noćno muvanje -- namerno DRUGAČIJI (širi) prag od
 * profila (src/lib/moderation.ts), po eksplicitnom zahtevu: gola koža/seksi
 * poze/donji veš se NE blokiraju ovde, samo se zaključavaju iza plaćanja
 * (to je i smisao funkcije). Jedini stvaran "crveni" izuzetak je visok
 * sexual_activity skor -- to specifično znači da slika prikazuje SEKSUALNI
 * ČIN (ne samo golotinju), što je jak signal da sadržaj možda nije
 * sopstveni snimak (preuzet, tuđ, bez pristanka) -- to ide na ručni pregled,
 * ne na direktno slanje.
 *
 * Prima NIZ url-ova (jedan za foto, više za reprezentativne frejmove videa)
 * i uzima NAJGORI (max) skor iz svih -- konzervativno, jedan "vreo" frejm
 * je dovoljan da ceo video ide na žuto/crveno.
 */
export async function classifyNightContent(imageUrls: string[]): Promise<NightClassificationResult> {
  const results = await Promise.all(imageUrls.map(getNudityScores));

  // Fail-closed: ako ijedan poziv nije uspeo, ne verujemo ostatku uzorka
  // (traženo u specifikaciji, deo 14) -- ide na ručni pregled.
  if (results.some((r) => r === null)) {
    return { classification: "yellow", moderationStatus: "pending_review", score: null };
  }
  const scores = results as NudityScores[];

  const [yellowThreshold, redThreshold] = await Promise.all([
    getConfigNumber("yellow_score_threshold", 0.15),
    getConfigNumber("red_score_threshold", 0.5),
  ]);

  const activityScore = Math.max(...scores.map((s) => s.activityScore));
  const displayScore = Math.max(...scores.map((s) => s.displayScore));

  if (activityScore >= redThreshold) {
    return { classification: "red", moderationStatus: "pending_review", score: activityScore };
  }
  if (displayScore >= yellowThreshold) {
    return { classification: "yellow", moderationStatus: "auto", score: displayScore };
  }
  return { classification: "green", moderationStatus: "auto", score: displayScore };
}

// Mala keš-mapa u okviru jednog request-a (Server Action poziva) -- ne
// treba nam trajan keš, samo da izbegnemo N upita za N frejmova iste
// klasifikacije u istom pozivu.
let configCache: Map<string, string> | null = null;

async function loadConfig(): Promise<Map<string, string>> {
  if (configCache) return configCache;
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data } = await admin.from("night_flirting_config").select("key, value");
  configCache = new Map((data ?? []).map((row) => [row.key, row.value]));
  return configCache;
}

export async function getConfigNumber(key: string, fallback: number): Promise<number> {
  const config = await loadConfig();
  const raw = config.get(key);
  const parsed = raw !== undefined ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export type NightFlirtingEvent =
  | "night_flirting_opened"
  | "night_flirting_gallery_opened"
  | "night_flirting_camera_opened"
  | "night_flirting_media_selected"
  | "night_flirting_media_recorded"
  | "night_flirting_upload_started"
  | "night_flirting_classification_started"
  | "night_flirting_classification_completed"
  | "night_flirting_locked"
  | "night_flirting_sent"
  | "night_flirting_unlock_viewed"
  | "night_flirting_unlock_started"
  | "night_flirting_unlock_completed"
  | "night_flirting_unlock_failed"
  | "night_flirting_premium_access"
  | "night_flirting_reported";

/** Isti obrazac kao ostali analytics eventi u aplikaciji (duel_started i sl.) -- upisuje se u activity_events. */
export async function logNightFlirtingEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileId: string,
  eventName: NightFlirtingEvent,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  await supabase.from("activity_events").insert({ profile_id: profileId, event_name: eventName, metadata });
}
