import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/nav/AppShell";
import { isSecretRoomEveningLive } from "@/lib/secretRoom";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // proxy.ts već štiti ove rute, ali proveravamo ponovo ovde (defense in depth)
  // i zato što ovde imamo pristup profilu da proverimo da li je onboarding gotov.
  if (!user) redirect("/prijava");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.onboarding_completed_at) redirect("/onboarding");

  const [secretRoomLive, { count: secretRoomPendingCount }] = await Promise.all([
    isSecretRoomEveningLive(),
    supabase
      .from("secret_room_requests")
      .select("id", { count: "exact", head: true })
      .eq("to_profile_id", user.id)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString()),
  ]);

  return (
    <AppShell secretRoomLive={secretRoomLive} secretRoomPending={(secretRoomPendingCount ?? 0) > 0}>
      {children}
    </AppShell>
  );
}
