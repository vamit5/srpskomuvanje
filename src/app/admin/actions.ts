"use server";

import { revalidatePath } from "next/cache";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { belgradeLocalInputToISO } from "@/lib/time";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();
  if (!user) return { supabase, user: null, isAdmin: false };
  const { data: isAdmin } = await supabase.rpc("is_admin");
  return { supabase, user, isAdmin: !!isAdmin };
}

export async function updateReportStatus(
  reportId: string,
  status: "resolved" | "dismissed"
): Promise<{ error: string | null }> {
  const { supabase, user, isAdmin } = await requireAdmin();
  if (!isAdmin || !user) return { error: "Nemaš admin pristup." };

  const { error } = await supabase
    .from("reports")
    .update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", reportId);

  if (error) return { error: "Ne mogu da ažuriram prijavu." };
  revalidatePath("/admin/reports");
  return { error: null };
}

export async function toggleDiscoverable(profileId: string, discoverable: boolean): Promise<{ error: string | null }> {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Nemaš admin pristup." };

  const { error } = await supabase.from("profiles").update({ is_discoverable: discoverable }).eq("id", profileId);
  if (error) return { error: "Ne mogu da ažuriram profil." };

  revalidatePath("/admin/users");
  revalidatePath("/admin/reports");
  return { error: null };
}

export async function createEvent(input: {
  title: string;
  description: string;
  city: string; // prazno = svi gradovi
  startsAt: string; // datetime-local vrednost
  endsAt: string;
}): Promise<{ error: string | null }> {
  const { supabase, user, isAdmin } = await requireAdmin();
  if (!isAdmin || !user) return { error: "Nemaš admin pristup." };

  if (!input.title.trim()) return { error: "Naslov je obavezan." };
  if (!input.startsAt || !input.endsAt) return { error: "Unesi početak i kraj." };

  // Uneto vreme se tumači kao beogradsko lokalno vreme (ne UTC, ne vreme
  // servera) -- ista logika kao za "Večeras"/Noćni mod.
  const startsAtISO = belgradeLocalInputToISO(input.startsAt);
  const endsAtISO = belgradeLocalInputToISO(input.endsAt);
  if (new Date(endsAtISO) <= new Date(startsAtISO)) {
    return { error: "Proveri datume — kraj mora biti posle početka." };
  }

  const slug =
    input.title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9čćžšđ\s-]/gi, "")
      .replace(/\s+/g, "-") +
    "-" +
    Date.now().toString(36);

  const { error } = await supabase.from("events").insert({
    title: input.title.trim(),
    slug,
    description: input.description.trim() || null,
    kind: "custom",
    city: input.city.trim() || null,
    starts_at: startsAtISO,
    ends_at: endsAtISO,
    is_active: true,
    created_by: user.id,
  });

  if (error) return { error: "Ne mogu da napravim događaj." };
  revalidatePath("/admin/events");
  revalidatePath("/sada");
  return { error: null };
}

export async function deactivateEvent(eventId: string): Promise<{ error: string | null }> {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Nemaš admin pristup." };

  const { error } = await supabase.from("events").update({ is_active: false }).eq("id", eventId);
  if (error) return { error: "Ne mogu da ugasim događaj." };

  revalidatePath("/admin/events");
  revalidatePath("/sada");
  return { error: null };
}

/**
 * Noćno muvanje: LOCK/UNLOCK/MARK SAFE. Admin odluka ima prioritet nad
 * automatskom klasifikacijom (traženo u specifikaciji).
 */
export async function reviewNightContent(
  contentId: string,
  decision: "admin_locked" | "admin_unlocked" | "admin_marked_safe",
  note: string
): Promise<{ error: string | null }> {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Nemaš admin pristup." };

  const { data, error } = await supabase
    .rpc("admin_review_night_content", { p_content_id: contentId, p_decision: decision, p_note: note || null })
    .single();
  if (error || !data) return { error: "Ne mogu da sačuvam odluku." };

  const row = data as { ok: boolean; error: string | null };
  if (!row.ok) return { error: row.error ?? "Ne mogu da sačuvam odluku." };

  revalidatePath("/admin/nocno-muvanje");
  return { error: null };
}

/** DELETE -- posebna operacija (ne samo status) jer mora da obriše i Storage fajlove. */
export async function deleteNightContent(contentId: string): Promise<{ error: string | null }> {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Nemaš admin pristup." };

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const { data: content } = await admin
    .from("night_flirting_content")
    .select("original_path, preview_path")
    .eq("id", contentId)
    .maybeSingle();

  if (content) {
    const paths = [content.original_path, content.preview_path].filter(Boolean) as string[];
    if (paths.length) await admin.storage.from("night-flirting").remove(paths);
  }

  const { error } = await admin.from("night_flirting_content").delete().eq("id", contentId);
  if (error) return { error: "Ne mogu da obrišem sadržaj." };

  revalidatePath("/admin/nocno-muvanje");
  return { error: null };
}

/**
 * Ručna odluka o graničnom slučaju (moderation_status='pending') iz
 * automatske NSFW provere (sekcija 9/FAZA 9) -- ili o već odbijenoj
 * fotografiji/videu ako admin proceni da je automatska provera pogrešila.
 */
export async function reviewMedia(
  kind: "photo" | "video",
  mediaId: string,
  decision: "approved" | "rejected"
): Promise<{ error: string | null }> {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Nemaš admin pristup." };

  const table = kind === "photo" ? "profile_photos" : "profile_videos";
  const { error } = await supabase.from(table).update({ moderation_status: decision }).eq("id", mediaId);
  if (error) return { error: "Ne mogu da sačuvam odluku." };

  revalidatePath("/admin/sadrzaj");
  return { error: null };
}
