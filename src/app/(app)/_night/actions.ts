"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPremium } from "@/lib/premium";
import { sendPushToProfile } from "@/lib/push/send";
import { classifyNightContent, getConfigNumber, logNightFlirtingEvent, type NightFlirtingEvent } from "@/lib/nightFlirting";

const SIGNED_URL_TTL = 60 * 60; // 1h -- dovoljno da se slika/video prikaže, ističe samo

async function getAuthedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Lagan event log za UI korake pre slanja (otvaranje panela, izbor galerije/kamere...). */
export async function logNightEvent(eventName: NightFlirtingEvent, metadata: Record<string, unknown> = {}): Promise<void> {
  const { supabase, user } = await getAuthedUser();
  if (!user) return;
  await logNightFlirtingEvent(supabase, user.id, eventName, metadata);
}

/** Podaci potrebni da panel za slanje prikaže limite/stanje. */
export async function getNightFlirtingContext(): Promise<{
  error: string | null;
  premium: boolean;
  walletBalance: number;
  unlockCostCredits: number;
  sentToday: number;
  dailyLimit: number;
}> {
  const { supabase, user } = await getAuthedUser();
  if (!user) {
    return { error: "Nisi prijavljen/a.", premium: false, walletBalance: 0, unlockCostCredits: 1, sentToday: 0, dailyLimit: 0 };
  }

  const premium = await isPremium(user.id);
  const [{ data: wallet }, unlockCost, dailyLimit, { count: sentToday }] = await Promise.all([
    supabase.from("wallets").select("balance_credits").eq("profile_id", user.id).maybeSingle(),
    getConfigNumber("unlock_cost_credits", 1),
    getConfigNumber(premium ? "daily_send_limit_premium" : "daily_send_limit_free", premium ? 20 : 3),
    supabase
      .from("night_flirting_content")
      .select("id", { count: "exact", head: true })
      .eq("sender_id", user.id)
      .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
  ]);

  return {
    error: null,
    premium,
    walletBalance: wallet?.balance_credits ?? 0,
    unlockCostCredits: unlockCost,
    sentToday: sentToday ?? 0,
    dailyLimit,
  };
}

interface SendPhotoInput {
  matchId: string;
  originalPath: string;
  previewPath: string;
  classifyPaths: string[]; // za foto: [originalPath]. Server generiše signed url-ove sam.
}

interface SendVideoInput extends SendPhotoInput {
  durationSeconds: number;
  framePaths: string[]; // privremeni frejmovi, brišu se posle klasifikacije
}

async function signPath(admin: ReturnType<typeof createAdminClient>, path: string): Promise<string | null> {
  const { data } = await admin.storage.from("night-flirting").createSignedUrl(path, SIGNED_URL_TTL);
  return data?.signedUrl ?? null;
}

async function sendInternal(
  input: SendPhotoInput | SendVideoInput,
  kind: "photo" | "video"
): Promise<{ error: string | null; messageId: string | null; classification: string | null }> {
  const { supabase, user } = await getAuthedUser();
  if (!user) return { error: "Nisi prijavljen/a.", messageId: null, classification: null };

  const prefix = `${user.id}/`;
  const allPaths = [input.originalPath, input.previewPath, ...("framePaths" in input ? input.framePaths : [])];
  if (allPaths.some((p) => !p.startsWith(prefix))) {
    return { error: "Nevažeća putanja fajla.", messageId: null, classification: null };
  }

  const admin = createAdminClient();

  await logNightFlirtingEvent(supabase, user.id, "night_flirting_classification_started", { matchId: input.matchId, kind });

  const signedUrls = (await Promise.all(input.classifyPaths.map((p) => signPath(admin, p)))).filter(
    (u): u is string => !!u
  );

  const result =
    signedUrls.length === input.classifyPaths.length
      ? await classifyNightContent(signedUrls)
      : { classification: "yellow" as const, moderationStatus: "pending_review" as const, score: null };

  await logNightFlirtingEvent(supabase, user.id, "night_flirting_classification_completed", {
    matchId: input.matchId,
    classification: result.classification,
    score: result.score,
  });

  // Privremeni frejmovi (samo za klasifikaciju videa) -- nikad se ne
  // prikazuju, brišemo ih odmah posle.
  if ("framePaths" in input && input.framePaths.length) {
    await admin.storage.from("night-flirting").remove(input.framePaths);
  }

  const premium = await isPremium(user.id);
  const dailyLimit = await getConfigNumber(
    premium ? "daily_send_limit_premium" : "daily_send_limit_free",
    premium ? 20 : 3
  );

  const { data, error } = await supabase
    .rpc("send_night_flirting_content", {
      p_sender_id: user.id,
      p_match_id: input.matchId,
      p_kind: kind,
      p_original_path: input.originalPath,
      p_preview_path: input.previewPath,
      p_duration_seconds: "durationSeconds" in input ? Math.round(input.durationSeconds) : null,
      p_classification: result.classification,
      p_classifier_score: result.score,
      p_moderation_status: result.moderationStatus,
      p_daily_limit: dailyLimit,
    })
    .single();

  if (error || !data) return { error: "Nešto nije u redu. Pokušaj ponovo.", messageId: null, classification: null };

  const row = data as { content_id: string | null; message_id: string | null; error: string | null };
  if (row.error || !row.message_id) {
    return { error: row.error ?? "Ne mogu da pošaljem.", messageId: null, classification: null };
  }

  if (result.classification !== "green") {
    await logNightFlirtingEvent(supabase, user.id, "night_flirting_locked", {
      matchId: input.matchId,
      classification: result.classification,
    });
  }
  await logNightFlirtingEvent(supabase, user.id, "night_flirting_sent", { matchId: input.matchId, kind });

  const { data: match } = await supabase
    .from("matches")
    .select("profile_a_id, profile_b_id")
    .eq("id", input.matchId)
    .single();
  const receiverId = match ? (match.profile_a_id === user.id ? match.profile_b_id : match.profile_a_id) : null;

  if (receiverId) {
    // Notifikacija NIKAD ne otkriva da li je sadržaj eksplicitan/zaključan
    // -- ista poruka za sve slučajeve (traženo u specifikaciji, deo 16).
    after(() =>
      sendPushToProfile(receiverId, {
        title: "🌙😈 Noćno muvanje",
        body: "Nešto ti je poslato. Otvori da vidiš.",
        url: `/poruke/${input.matchId}`,
        tag: `night-${input.matchId}`,
      })
    );
  }

  return { error: null, messageId: row.message_id, classification: result.classification };
}

export async function sendNightFlirtingPhoto(input: SendPhotoInput) {
  return sendInternal(input, "photo");
}

export async function sendNightFlirtingVideo(input: SendVideoInput) {
  return sendInternal(input, "video");
}

export interface NightContentView {
  error: string | null;
  kind: "photo" | "video" | null;
  locked: boolean;
  url: string | null; // original (otključano) ili preview (zaključano)
  durationSeconds: number | null;
  unlockCostCredits: number;
  walletBalance: number;
  premium: boolean;
  isSender: boolean;
  // Za pošiljaočevu sopstvenu poruku (uvek "locked: false") -- ovo govori
  // da li je sadržaj STVARNO zaključan za PRIMAOCA, da pošiljalac zna da
  // se nešto desilo umesto da izgleda kao da je poslato "normalno".
  isFreeForReceiver: boolean;
  pendingReview: boolean;
  expiresAt: string | null;
  expired: boolean;
}

export async function getNightContentView(contentId: string): Promise<NightContentView> {
  const { supabase, user } = await getAuthedUser();
  const empty: NightContentView = {
    error: null,
    kind: null,
    locked: true,
    url: null,
    durationSeconds: null,
    unlockCostCredits: 1,
    walletBalance: 0,
    premium: false,
    isSender: false,
    isFreeForReceiver: false,
    pendingReview: false,
    expiresAt: null,
    expired: false,
  };
  if (!user) return { ...empty, error: "Nisi prijavljen/a." };

  const { data: content } = await supabase
    .from("night_flirting_content")
    .select(
      "id, sender_id, receiver_id, kind, original_path, preview_path, duration_seconds, is_free, moderation_status, expires_at, media_deleted_at"
    )
    .eq("id", contentId)
    .maybeSingle();

  if (!content) return { ...empty, error: "Sadržaj nije pronađen." };
  if (content.sender_id !== user.id && content.receiver_id !== user.id) {
    return { ...empty, error: "Nemaš pristup ovom sadržaju." };
  }

  const isSender = content.sender_id === user.id;
  const admin = createAdminClient();
  const [{ data: unlock }, premium, unlockCost, { data: wallet }] = await Promise.all([
    supabase
      .from("night_flirting_unlocks")
      .select("id")
      .eq("content_id", contentId)
      .eq("unlocker_id", user.id)
      .maybeSingle(),
    isPremium(user.id),
    getConfigNumber("unlock_cost_credits", 1),
    supabase.from("wallets").select("balance_credits").eq("profile_id", user.id).maybeSingle(),
  ]);

  const pendingReview = content.moderation_status === "pending_review";
  if (pendingReview && !isSender) {
    // Primaocu se ni preview ne prikazuje dok admin ne pregleda -- traženo
    // u specifikaciji ("NE šalji ga receiveru").
    return { ...empty, error: "Ovaj sadržaj se još pregleda." };
  }

  const unlocked = isSender || content.is_free || !!unlock;
  // Isteklo (disappearing media) SAMO ako NIJE otkljucano -- ko je platio
  // zadrzava pristup zauvek, original fajl se za njega nikad ne brise
  // (vidi cron rutu src/app/api/cron/expire-media).
  const expired =
    !unlocked &&
    (!!content.media_deleted_at || (!!content.expires_at && new Date(content.expires_at) < new Date()));
  const path = unlocked ? content.original_path : content.preview_path;
  const url = expired && !isSender ? null : await signPath(admin, path);

  return {
    error: null,
    kind: content.kind as "photo" | "video",
    locked: !unlocked,
    url,
    durationSeconds: content.duration_seconds,
    unlockCostCredits: unlockCost,
    walletBalance: wallet?.balance_credits ?? 0,
    premium,
    isSender,
    isFreeForReceiver: content.is_free,
    pendingReview,
    expiresAt: content.expires_at,
    expired,
  };
}

export async function unlockNightContent(contentId: string): Promise<{ error: string | null }> {
  const { supabase, user } = await getAuthedUser();
  if (!user) return { error: "Nisi prijavljen/a." };

  await logNightFlirtingEvent(supabase, user.id, "night_flirting_unlock_started", { contentId });

  const { data, error } = await supabase
    .rpc("unlock_night_content", { p_viewer_id: user.id, p_content_id: contentId })
    .single();

  if (error || !data) {
    await logNightFlirtingEvent(supabase, user.id, "night_flirting_unlock_failed", { contentId, reason: "rpc_error" });
    return { error: "Nešto nije u redu. Pokušaj ponovo." };
  }

  const row = data as { ok: boolean; error: string | null };
  if (!row.ok) {
    await logNightFlirtingEvent(supabase, user.id, "night_flirting_unlock_failed", { contentId, reason: row.error });
    return { error: row.error ?? "Ne mogu da otključam." };
  }

  const premium = await isPremium(user.id);
  await logNightFlirtingEvent(
    supabase,
    user.id,
    premium ? "night_flirting_premium_access" : "night_flirting_unlock_completed",
    { contentId }
  );

  return { error: null };
}

export async function reportNightContent(contentId: string, reason: string, details: string): Promise<{ error: string | null }> {
  const { supabase, user } = await getAuthedUser();
  if (!user) return { error: "Nisi prijavljen/a." };

  const { data: content } = await supabase
    .from("night_flirting_content")
    .select("sender_id, receiver_id")
    .eq("id", contentId)
    .maybeSingle();
  if (!content) return { error: "Sadržaj nije pronađen." };

  const reportedId = content.sender_id === user.id ? content.receiver_id : content.sender_id;

  const { error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    reported_profile_id: reportedId,
    reason,
    details: details.trim() || null,
  });
  if (error) return { error: "Ne mogu da pošaljem prijavu. Pokušaj ponovo." };

  await logNightFlirtingEvent(supabase, user.id, "night_flirting_reported", { contentId });
  revalidatePath("/admin/nocno-muvanje");
  return { error: null };
}
