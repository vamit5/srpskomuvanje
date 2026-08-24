"use server";

import { createClient, getAuthUser } from "@/lib/supabase/server";

export async function markNotificationRead(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();
  if (!user) return;

  await supabase.from("notifications").update({ is_read: true }).eq("id", id).eq("profile_id", user.id);
}
