"use server";

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushToProfile } from "@/lib/push/send";
import { isPremium } from "@/lib/premium";
import { belgradeStartOfDayISO } from "@/lib/time";
import { getConfigNumber, getDuelQuestions, logSecretRoomEvent, type DuelQuestion } from "@/lib/secretRoom";

export interface SecretRoomCandidate {
  candidateRowId: string;
  id: string;
  name: string;
  birthDate: string;
  city: string | null;
  bio: string | null;
  photoUrl: string | null;
  position: number;
  isSecretCard: boolean;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Otvara novu rundu (ili vraca postojecu aktivnu) -- besplatni nalozi imaju dnevni limit, isti obrazac kao Duel. */
export async function startSecretRoomRound(): Promise<{
  roundId: string | null;
  expiresAt: string | null;
  error: string | null;
  limitReached: boolean;
}> {
  const { supabase, user } = await requireUser();
  if (!user) return { roundId: null, expiresAt: null, error: "Nisi prijavljen/a.", limitReached: false };

  const premium = await isPremium(user.id);
  if (!premium) {
    const limit = await getConfigNumber("rounds_daily_limit_free", 3);
    const { count } = await supabase
      .from("activity_events")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", user.id)
      .eq("event_name", "secret_room_started")
      .gte("created_at", belgradeStartOfDayISO());
    if ((count ?? 0) >= limit) {
      return { roundId: null, expiresAt: null, error: null, limitReached: true };
    }
  }

  const { data, error } = await supabase.rpc("start_secret_room_round", { viewer_id: user.id }).single();
  if (error) return { roundId: null, expiresAt: null, error: "Ne mogu da otvorim Tajnu sobu. Pokušaj ponovo.", limitReached: false };

  const row = data as { round_id: string; expires_at: string; is_new: boolean };
  if (row.is_new) {
    await logSecretRoomEvent(supabase, user.id, "secret_room_started", { roundId: row.round_id });
  }
  return { roundId: row.round_id, expiresAt: row.expires_at, error: null, limitReached: false };
}

export async function getSecretRoomRoundCandidates(roundId: string): Promise<{ candidates: SecretRoomCandidate[]; error: string | null }> {
  const { supabase, user } = await requireUser();
  if (!user) return { candidates: [], error: "Nisi prijavljen/a." };

  const { data, error } = await supabase.rpc("get_secret_room_candidates", { viewer_id: user.id, p_round_id: roundId });
  if (error) return { candidates: [], error: "Ne mogu da učitam kandidate." };

  const rows = (data ?? []) as {
    candidate_row_id: string;
    candidate_id: string;
    name: string;
    birth_date: string;
    city: string | null;
    bio: string | null;
    primary_photo_url: string | null;
    position: number;
    is_secret_card: boolean;
  }[];

  return {
    error: null,
    candidates: rows.map((r) => ({
      candidateRowId: r.candidate_row_id,
      id: r.candidate_id,
      name: r.name,
      birthDate: r.birth_date,
      city: r.city,
      bio: r.bio,
      photoUrl: r.primary_photo_url,
      position: r.position,
      isSecretCard: r.is_secret_card,
    })),
  };
}

export async function swipeSecretRoomCandidate(
  roundId: string,
  candidateId: string,
  action: "like" | "pass"
): Promise<{ error: string | null; matched: boolean; matchId: string | null }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Nisi prijavljen/a.", matched: false, matchId: null };

  const { data, error } = await supabase
    .rpc("secret_room_swipe", { viewer_id: user.id, p_round_id: roundId, p_candidate_id: candidateId, p_action: action })
    .single();

  if (error) return { error: "Nešto nije u redu, probaj ponovo.", matched: false, matchId: null };

  const result = data as { matched: boolean; match_id: string | null };
  await logSecretRoomEvent(supabase, user.id, action === "like" ? "secret_room_like" : "secret_room_pass", { roundId, candidateId });

  if (result.matched) {
    const { data: me } = await supabase.from("profiles").select("name").eq("id", user.id).single();
    after(() =>
      sendPushToProfile(candidateId, {
        title: "🔥 MATCH!",
        body: `Ti i ${me?.name ?? "neko"} ste se svideli jedno drugom.`,
        url: "/match",
        tag: "match",
      })
    );
  }

  return { error: null, matched: result.matched, matchId: result.match_id };
}

/** "RIZIKUJ" na Tajnu kartu. */
export async function sendSecretRoomRiskRequest(roundId: string): Promise<{ requestId: string | null; expiresAt: string | null; error: string | null }> {
  const { supabase, user } = await requireUser();
  if (!user) return { requestId: null, expiresAt: null, error: "Nisi prijavljen/a." };

  await logSecretRoomEvent(supabase, user.id, "secret_room_risk_clicked", { roundId });

  const { data, error } = await supabase.rpc("secret_room_send_request", { viewer_id: user.id, p_round_id: roundId }).single();
  if (error) return { requestId: null, expiresAt: null, error: error.message?.includes("Tajne karte") ? "Nema aktivne Tajne karte." : "Ne mogu da pošaljem zahtev." };

  const row = data as { request_id: string; expires_at: string };
  await logSecretRoomEvent(supabase, user.id, "secret_room_request_sent", { roundId, requestId: row.request_id });

  after(async () => {
    const targetId = await getRequestTargetId(row.request_id);
    if (targetId) {
      await sendPushToProfile(targetId, {
        title: "🔥 Neko te je izabrao u Tajnoj sobi",
        body: "Hoćeš da otvoriš vrata?",
        url: "/tajna-soba",
        tag: "secret_room_request",
      });
    }
  });

  return { requestId: row.request_id, expiresAt: row.expires_at, error: null };
}

async function getRequestTargetId(requestId: string): Promise<string | null> {
  // Koristi admin klijent (server-only) namerno -- ovo se izvrsava POSLE
  // odgovora korisniku (after()), a to_profile_id je bezbedno citati ovde
  // jer se ne vraca nikakvom klijentu, samo koristi da se posalje push.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data } = await admin.from("secret_room_requests").select("to_profile_id").eq("id", requestId).maybeSingle();
  return data?.to_profile_id ?? null;
}

export interface IncomingSecretRoomRequest {
  requestId: string;
  createdAt: string;
  expiresAt: string;
}

/** Cita dolazni zahtev BEZ identiteta posiljaoca (namerno -- vidi migraciju 0013). */
export async function getIncomingSecretRoomRequest(): Promise<{ request: IncomingSecretRoomRequest | null; error: string | null }> {
  const { supabase, user } = await requireUser();
  if (!user) return { request: null, error: "Nisi prijavljen/a." };

  const { data, error } = await supabase.rpc("get_secret_room_incoming_request", { viewer_id: user.id });
  if (error) return { request: null, error: "Ne mogu da proverim zahteve." };

  const rows = data as { request_id: string; status: string; created_at: string; expires_at: string }[];
  const row = rows?.[0];
  if (!row) return { request: null, error: null };

  return { request: { requestId: row.request_id, createdAt: row.created_at, expiresAt: row.expires_at }, error: null };
}

export interface SecretRoomOtherProfile {
  id: string;
  name: string;
  birthDate: string;
  city: string | null;
  photoUrl: string | null;
}

/** OTVORI (placeno osim Premium) ili PRESKOCI na dolazni zahtev. */
export async function respondToSecretRoomRequest(
  requestId: string,
  accept: boolean
): Promise<{ error: string | null; insufficientCredits: boolean; pairId: string | null; other: SecretRoomOtherProfile | null }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Nisi prijavljen/a.", insufficientCredits: false, pairId: null, other: null };

  if (accept) await logSecretRoomEvent(supabase, user.id, "secret_room_payment_started", { requestId });

  const { data, error } = await supabase
    .rpc("secret_room_respond_request", { viewer_id: user.id, p_request_id: requestId, p_accept: accept })
    .single();

  if (error) return { error: "Nešto nije u redu, probaj ponovo.", insufficientCredits: false, pairId: null, other: null };

  const row = data as {
    ok: boolean;
    error: string | null;
    pair_id: string | null;
    other_id: string | null;
    other_name: string | null;
    other_birth_date: string | null;
    other_city: string | null;
    other_photo_url: string | null;
  };

  if (!row.ok) {
    if (row.error === "insufficient_credits") {
      return { error: null, insufficientCredits: true, pairId: null, other: null };
    }
    return { error: row.error ?? "Nešto nije u redu.", insufficientCredits: false, pairId: null, other: null };
  }

  if (!accept) {
    await logSecretRoomEvent(supabase, user.id, "secret_room_request_rejected", { requestId });
    return { error: null, insufficientCredits: false, pairId: null, other: null };
  }

  await logSecretRoomEvent(supabase, user.id, "secret_room_payment_completed", { requestId });
  await logSecretRoomEvent(supabase, user.id, "secret_room_request_accepted", { requestId, pairId: row.pair_id });

  if (row.other_id) {
    after(() =>
      sendPushToProfile(row.other_id!, {
        title: "🚪 Vrata su otvorena!",
        body: "Ušli ste u Tajnu sobu.",
        url: "/tajna-soba",
        tag: "secret_room_pair_ready",
      })
    );
  }

  return {
    error: null,
    insufficientCredits: false,
    pairId: row.pair_id,
    other: row.other_id
      ? { id: row.other_id, name: row.other_name ?? "?", birthDate: row.other_birth_date ?? "", city: row.other_city, photoUrl: row.other_photo_url }
      : null,
  };
}

export interface SecretRoomPairState {
  pairId: string;
  status: "duel" | "chemistry_confirmed" | "no_chemistry" | "ended";
  matchCount: number;
  expiresAt: string;
  other: SecretRoomOtherProfile;
}

export async function getSecretRoomPair(pairId: string): Promise<{ pair: SecretRoomPairState | null; error: string | null }> {
  const { supabase, user } = await requireUser();
  if (!user) return { pair: null, error: "Nisi prijavljen/a." };

  const { data, error } = await supabase.rpc("get_secret_room_pair", { viewer_id: user.id, p_pair_id: pairId }).single();
  if (error) return { pair: null, error: "Soba nije pronađena." };

  const row = data as {
    pair_id: string;
    status: string;
    match_count: number;
    expires_at: string;
    other_id: string;
    other_name: string;
    other_birth_date: string;
    other_city: string | null;
    other_photo_url: string | null;
  };

  return {
    error: null,
    pair: {
      pairId: row.pair_id,
      status: row.status as SecretRoomPairState["status"],
      matchCount: row.match_count,
      expiresAt: row.expires_at,
      other: { id: row.other_id, name: row.other_name, birthDate: row.other_birth_date, city: row.other_city, photoUrl: row.other_photo_url },
    },
  };
}

export async function getSecretRoomDuelQuestions(): Promise<DuelQuestion[]> {
  return getDuelQuestions();
}

export async function answerSecretRoomDuelQuestion(
  pairId: string,
  questionIndex: number,
  answerIndex: number
): Promise<{ error: string | null; isMatch: boolean; matchCount: number; chemistryConfirmed: boolean }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Nisi prijavljen/a.", isMatch: false, matchCount: 0, chemistryConfirmed: false };

  if (questionIndex === 0) await logSecretRoomEvent(supabase, user.id, "secret_room_duel_started", { pairId });

  const { data, error } = await supabase
    .rpc("secret_room_duel_answer", { viewer_id: user.id, p_pair_id: pairId, p_question_index: questionIndex, p_answer_index: answerIndex })
    .single();

  if (error) return { error: "Nešto nije u redu.", isMatch: false, matchCount: 0, chemistryConfirmed: false };

  const row = data as { ok: boolean; error: string | null; both_answered: boolean; is_match: boolean; match_count: number; chemistry_confirmed: boolean };
  if (!row.ok) return { error: row.error, isMatch: false, matchCount: 0, chemistryConfirmed: false };

  if (row.is_match) await logSecretRoomEvent(supabase, user.id, "secret_room_duel_match", { pairId, questionIndex });
  if (row.chemistry_confirmed) await logSecretRoomEvent(supabase, user.id, "secret_room_chemistry_confirmed", { pairId });

  return { error: null, isMatch: row.is_match, matchCount: row.match_count, chemistryConfirmed: row.chemistry_confirmed };
}

export async function confirmSecretRoomMatch(pairId: string, andOpenChat: boolean): Promise<{ error: string | null; matchId: string | null }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Nisi prijavljen/a.", matchId: null };

  const { data, error } = await supabase.rpc("secret_room_confirm_match", { viewer_id: user.id, p_pair_id: pairId }).single();
  if (error) return { error: "Nešto nije u redu.", matchId: null };

  const row = data as { ok: boolean; error: string | null; match_id: string | null };
  if (!row.ok) return { error: row.error, matchId: null };

  await logSecretRoomEvent(supabase, user.id, andOpenChat ? "secret_room_chat_started" : "secret_room_chemistry_confirmed", {
    pairId,
    matchId: row.match_id,
  });

  return { error: null, matchId: row.match_id };
}

export async function logSecretRoomOpened(): Promise<void> {
  const { supabase, user } = await requireUser();
  if (!user) return;
  await logSecretRoomEvent(supabase, user.id, "secret_room_opened", {});
}

export async function logSecretRoomProfileViewed(candidateId: string): Promise<void> {
  const { supabase, user } = await requireUser();
  if (!user) return;
  await logSecretRoomEvent(supabase, user.id, "secret_room_profile_viewed", { candidateId });
}

export async function logSecretRoomRoundExpired(roundId: string): Promise<void> {
  const { supabase, user } = await requireUser();
  if (!user) return;
  await logSecretRoomEvent(supabase, user.id, "secret_room_round_expired", { roundId });
}

export async function logSecretRoomRequestExpired(requestId: string): Promise<void> {
  const { supabase, user } = await requireUser();
  if (!user) return;
  await logSecretRoomEvent(supabase, user.id, "secret_room_request_expired", { requestId });
}
