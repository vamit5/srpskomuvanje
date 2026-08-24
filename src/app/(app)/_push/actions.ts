"use server";

import { createClient, getAuthUser } from "@/lib/supabase/server";

export async function savePushSubscription(input: {
  endpoint: string;
  p256dh: string;
  authKey: string;
  userAgent?: string;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();
  if (!user) return { error: "Nisi prijavljen/a." };

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      profile_id: user.id,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth_key: input.authKey,
      user_agent: input.userAgent ?? null,
    },
    { onConflict: "endpoint" }
  );

  if (error) return { error: "Ne mogu da sačuvam pretplatu za notifikacije." };
  return { error: null };
}

export async function removePushSubscription(endpoint: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();
  if (!user) return { error: "Nisi prijavljen/a." };

  await supabase.from("push_subscriptions").delete().eq("profile_id", user.id).eq("endpoint", endpoint);
  return { error: null };
}
