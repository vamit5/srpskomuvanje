import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/nav/BottomNav";

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

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <main className="safe-top flex-1 pb-24">{children}</main>
      <BottomNav />
    </div>
  );
}
