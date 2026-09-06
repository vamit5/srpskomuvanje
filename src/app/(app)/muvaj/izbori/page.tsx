import Link from "next/link";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { calculateAge } from "@/lib/utils";
import { IzboriList } from "./IzboriList";

export const metadata = { title: "Moji izbori" };

export default async function MojiIzboriPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getAuthUser();
  if (!user) return null;

  type KrevetTarget = { to_profile_id: string; created_at: string };

  const [{ data: likes }, { data: krevetSignalsRaw }, { data: myMatches }] = await Promise.all([
    supabase.from("likes").select("to_profile_id, created_at").eq("from_profile_id", user.id),
    // NE obican .from("krevet_signals").select(...) -- ta tabela ima
    // namerno kolonsko REVOKE na from_profile_id za CEO 'authenticated'
    // role (da primalac ne vidi ko mu je poslao dok ne plati), sto bi
    // blokiralo i OVAJ upit (posiljalac cita svoje sopstvene redove).
    // get_my_sent_krevet_targets zaobilazi to (SECURITY DEFINER) i vraca
    // samo ono sto posiljalac vec zna -- kome je poslao, kad.
    supabase.rpc("get_my_sent_krevet_targets", { viewer_id: user.id }),
    supabase
      .from("matches")
      .select("profile_a_id, profile_b_id")
      .or(`profile_a_id.eq.${user.id},profile_b_id.eq.${user.id}`)
      .is("unmatched_at", null),
  ]);

  const krevetSignals = (krevetSignalsRaw ?? []) as KrevetTarget[];

  // Već spojeni (match) više nisu "čekanje" -- razgovor im je već otvoren
  // (u Porukama ili 18+ chatu), ne treba ih duplirati ovde.
  const matchedIds = new Set(
    (myMatches ?? []).map((m) => (m.profile_a_id === user.id ? m.profile_b_id : m.profile_a_id))
  );

  const pendingLikes = (likes ?? []).filter((l) => !matchedIds.has(l.to_profile_id));
  const pendingKrevet = krevetSignals.filter((k) => !matchedIds.has(k.to_profile_id));

  const allIds = [...new Set([...pendingLikes.map((l) => l.to_profile_id), ...pendingKrevet.map((k) => k.to_profile_id)])];

  const [{ data: profiles }, { data: photos }] = await Promise.all([
    allIds.length
      ? supabase.from("profiles").select("id, name, birth_date, city").in("id", allIds)
      : Promise.resolve({ data: [] }),
    allIds.length
      ? supabase
          .from("profile_photos")
          .select("profile_id, thumbnail_url")
          .in("profile_id", allIds)
          .eq("is_primary", true)
          .eq("moderation_status", "approved")
      : Promise.resolve({ data: [] }),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const photoById = new Map((photos ?? []).map((p) => [p.profile_id, p.thumbnail_url]));

  function toItem(id: string, createdAt: string) {
    const p = profileById.get(id);
    if (!p) return null;
    return {
      id,
      name: p.name,
      age: calculateAge(p.birth_date),
      city: p.city,
      photoUrl: photoById.get(id) ?? null,
      createdAt,
    };
  }

  const upoznavanje = pendingLikes.map((l) => toItem(l.to_profile_id, l.created_at)).filter((x) => x !== null);
  const chat18 = pendingKrevet.map((k) => toItem(k.to_profile_id, k.created_at)).filter((x) => x !== null);

  return (
    <div className="flex flex-col gap-3 px-4 pt-4">
      <header className="flex items-center gap-2">
        <Link href="/muvaj" className="text-sm text-[var(--color-text-muted)]">
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-bold">
            📋 <span className="text-gradient">Moji izbori</span>
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">Ljudi koje si izabrao/la, dok čekaš odgovor</p>
        </div>
      </header>

      <IzboriList upoznavanje={upoznavanje} chat18={chat18} />
    </div>
  );
}
