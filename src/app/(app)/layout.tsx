import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/nav/AppShell";

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

  return <AppShell>{children}</AppShell>;
}
