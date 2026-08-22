"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { belgradeLocalInputToISO } from "@/lib/time";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
