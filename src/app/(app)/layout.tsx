import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { AppShell } from "@/components/nav/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();

  // proxy.ts već štiti ove rute, ali proveravamo ponovo ovde (defense in depth)
  // i zato što ovde imamo pristup profilu da proverimo da li je onboarding gotov.
  if (!user) redirect("/prijava");

  // Paralelno (ne sekvencijalno) -- ni krevetPendingCount ni wallet ne
  // zavise od profila, nema razloga da čekaju da se profil upit prvo završi.
  const [{ data: profile }, { count: krevetPendingCount }, { data: wallet }] = await Promise.all([
    supabase.from("profiles").select("id, onboarding_completed_at").eq("id", user.id).maybeSingle(),
    supabase
      .from("krevet_signals")
      .select("id", { count: "exact", head: true })
      .eq("to_profile_id", user.id)
      .eq("status", "pending"),
    supabase.from("wallets").select("balance_credits").eq("profile_id", user.id).maybeSingle(),
  ]);

  if (!profile?.onboarding_completed_at) redirect("/onboarding");

  return (
    <AppShell eighteenPlusPending={(krevetPendingCount ?? 0) > 0} creditsBalance={wallet?.balance_credits ?? 0}>
      {children}
    </AppShell>
  );
}
