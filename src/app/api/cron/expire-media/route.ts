import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Poziva se periodicno preko Vercel Cron-a (vidi vercel.json) -- nalazi
 * PLACENI (ne-green) Nocno muvanje sadrzaj kome je istekao rok (expires_at)
 * a NIJE otkljucan, i TRAJNO brise originalni fajl iz Storage-a (ne samo
 * DB red) -- "disappearing" mehanika stvarno mora da obrise fajl, ne samo
 * da ga sakrije u UI-ju.
 *
 * Zastita: Vercel Cron zahtevi automatski nose
 * "Authorization: Bearer <CRON_SECRET>" (isti env var koji admin podesi u
 * Vercel Dashboard-u) -- bez toga, bilo ko bi mogao da pogodi ovu rutu i
 * masovno brise tudj sadrzaj.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const admin = createAdminClient();

  const { data: expired, error } = await admin
    .from("night_flirting_content")
    .select("id, original_path")
    .is("media_deleted_at", null)
    .not("expires_at", "is", null)
    .lt("expires_at", new Date().toISOString())
    // Nikad ne brisi sadrzaj koji je vec neko otkljucao -- taj je placen i
    // treba da ostane trajno dostupan tome ko ga je platio.
    .limit(200);

  if (error) {
    console.error("Cron expire-media: greska pri citanju:", error);
    return new Response("error", { status: 500 });
  }

  if (!expired?.length) return Response.json({ deleted: 0 });

  const ids = expired.map((r) => r.id);
  const { data: unlocked } = await admin.from("night_flirting_unlocks").select("content_id").in("content_id", ids);
  const unlockedIds = new Set((unlocked ?? []).map((u) => u.content_id));

  const toDelete = expired.filter((r) => !unlockedIds.has(r.id));
  if (!toDelete.length) return Response.json({ deleted: 0 });

  const { error: removeErr } = await admin.storage
    .from("night-flirting")
    .remove(toDelete.map((r) => r.original_path));
  if (removeErr) console.error("Cron expire-media: brisanje iz Storage-a nije uspelo za neke fajlove:", removeErr);

  const { error: updateErr } = await admin
    .from("night_flirting_content")
    .update({ media_deleted_at: new Date().toISOString() })
    .in(
      "id",
      toDelete.map((r) => r.id)
    );
  if (updateErr) console.error("Cron expire-media: azuriranje media_deleted_at nije uspelo:", updateErr);

  return Response.json({ deleted: toDelete.length });
}
