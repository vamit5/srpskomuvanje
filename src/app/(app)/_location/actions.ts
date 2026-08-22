"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateMyLocation(lat: number, lng: number): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nisi prijavljen/a." };

  const { error } = await supabase.rpc("update_my_location", { new_lat: lat, new_lng: lng });
  if (error) return { error: "Ne mogu da sačuvam lokaciju. Pokušaj ponovo." };

  revalidatePath("/sada");
  return { error: null };
}

export async function clearMyLocation(): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nisi prijavljen/a." };

  const { error } = await supabase.rpc("clear_my_location");
  if (error) return { error: "Ne mogu da isključim lokaciju." };

  revalidatePath("/sada");
  revalidatePath("/profil");
  return { error: null };
}
