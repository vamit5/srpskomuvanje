"use server";

import { revalidatePath } from "next/cache";
import { createClient, getAuthUser } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();
  if (!user) return { supabase, isAdmin: false as const };
  const { data: isAdmin } = await supabase.rpc("is_admin");
  return { supabase, isAdmin: !!isAdmin };
}

export async function createSuggestion(input: {
  category: "normal" | "hot";
  stage: 1 | 2 | 3;
  text: string;
}): Promise<{ error: string | null }> {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Nemaš admin pristup." };
  if (!input.text.trim()) return { error: "Unesi tekst predloga." };

  const { error } = await supabase.from("chat_suggestions").insert({
    category: input.category,
    stage: input.stage,
    text: input.text.trim(),
  });
  if (error) return { error: "Ne mogu da sačuvam predlog." };

  revalidatePath("/admin/predlozi");
  return { error: null };
}

export async function updateSuggestionText(id: string, text: string): Promise<{ error: string | null }> {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Nemaš admin pristup." };
  if (!text.trim()) return { error: "Tekst ne sme biti prazan." };

  const { error } = await supabase.from("chat_suggestions").update({ text: text.trim() }).eq("id", id);
  if (error) return { error: "Ne mogu da sačuvam izmenu." };

  revalidatePath("/admin/predlozi");
  return { error: null };
}

export async function toggleSuggestionActive(id: string, isActive: boolean): Promise<{ error: string | null }> {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Nemaš admin pristup." };

  const { error } = await supabase.from("chat_suggestions").update({ is_active: isActive }).eq("id", id);
  if (error) return { error: "Ne mogu da ažuriram predlog." };

  revalidatePath("/admin/predlozi");
  return { error: null };
}

export async function deleteSuggestion(id: string): Promise<{ error: string | null }> {
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return { error: "Nemaš admin pristup." };

  const { error } = await supabase.from("chat_suggestions").delete().eq("id", id);
  if (error) return { error: "Ne mogu da obrišem predlog." };

  revalidatePath("/admin/predlozi");
  return { error: null };
}
