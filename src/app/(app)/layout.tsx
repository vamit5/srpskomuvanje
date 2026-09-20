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
  const [{ data: profile }, { count: krevetPendingCount }, { data: wallet }, { data: myActiveMatches }] =
    await Promise.all([
      supabase.from("profiles").select("id, onboarding_completed_at").eq("id", user.id).maybeSingle(),
      supabase
        .from("krevet_signals")
        .select("id", { count: "exact", head: true })
        .eq("to_profile_id", user.id)
        .eq("status", "pending"),
      supabase.from("wallets").select("balance_credits").eq("profile_id", user.id).maybeSingle(),
      supabase
        .from("matches")
        .select("id, source")
        .or(`profile_a_id.eq.${user.id},profile_b_id.eq.${user.id}`)
        .is("unmatched_at", null),
    ]);

  if (!profile?.onboarding_completed_at) redirect("/onboarding");

  // Nepročitane poruke -- podeljene po tipu razgovora (obican chat vs. 18+
  // Muvaj chat, source='18plus') da bi svaki imao svoj sopstveni indikator
  // u donjoj navigaciji (izricit zahtev).
  const matchIds = (myActiveMatches ?? []).map((m) => m.id);
  const chat18MatchIds = new Set((myActiveMatches ?? []).filter((m) => m.source === "18plus").map((m) => m.id));

  const { data: unreadRows } = matchIds.length
    ? await supabase.from("messages").select("match_id").in("match_id", matchIds).neq("sender_id", user.id).is("read_at", null)
    : { data: [] };

  let unreadRegularCount = 0;
  let has18PlusUnread = false;
  for (const row of unreadRows ?? []) {
    if (chat18MatchIds.has(row.match_id)) has18PlusUnread = true;
    else unreadRegularCount++;
  }

  return (
    <AppShell
      eighteenPlusPending={(krevetPendingCount ?? 0) > 0 || has18PlusUnread}
      unreadMessagesCount={unreadRegularCount}
      creditsBalance={wallet?.balance_credits ?? 0}
      userId={user.id}
    >
      {children}
    </AppShell>
  );
}
