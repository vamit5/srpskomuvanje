import "server-only";

export type ModerationStatus = "approved" | "pending" | "rejected";

export interface ModerationResult {
  status: ModerationStatus;
  reason: string | null;
}

// Iznad ovoga se smatra eksplicitnim sadržajem i odmah se odbija -- namerno
// visok prag (izričit zahtev da moderacija profilnih slika bude labava):
// odbija se samo nedvosmisleno pornografski/eksplicitan seksualni sadržaj
// (stvaran polni čin ili krupni plan genitalija), ne i gola gornja polovina
// tela, provokativne poze, donji veš i sl. -- to sve prolazi.
const REJECT_THRESHOLD = 0.85;
// Između ova dva praga je granični slučaj -- ide na ručni pregled u admin
// panelu umesto automatske odluke. Ispod DONJEG praga se automatski
// odobrava -- namerno širok raspon auto-odobravanja (kupaći kostim, bez
// majice, donji veš, provokativne poze i sl.), uobičajeno za dating app.
const REVIEW_THRESHOLD = 0.6;

interface SightengineNudityResponse {
  status?: string;
  nudity?: {
    sexual_activity?: number;
    sexual_display?: number;
    erotica?: number;
  };
}

/**
 * Proverava sliku (fotografiju, ili thumbnail od videa) preko Sightengine
 * nudity-2.1 modela PRE nego što postane vidljiva drugim korisnicima.
 * Nikad ne baca grešku -- ako spoljni servis nije dostupan/nije podešen,
 * vraća "pending" (ide na ručni pregled) umesto da blokira upload ili da
 * ga tiho odobri bez ikakve provere.
 */
export async function moderateImage(imageUrl: string): Promise<ModerationResult> {
  const apiUser = process.env.SIGHTENGINE_API_USER;
  const apiSecret = process.env.SIGHTENGINE_API_SECRET;

  if (!apiUser || !apiSecret) {
    return { status: "pending", reason: "SIGHTENGINE_API_USER/SECRET nije podešen." };
  }

  try {
    const params = new URLSearchParams({
      url: imageUrl,
      models: "nudity-2.1",
      api_user: apiUser,
      api_secret: apiSecret,
    });

    const res = await fetch(`https://api.sightengine.com/1.0/check.json?${params.toString()}`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return { status: "pending", reason: `Sightengine HTTP ${res.status}` };
    }

    const data = (await res.json()) as SightengineNudityResponse;
    if (data.status !== "success" || !data.nudity) {
      return { status: "pending", reason: "Neočekivan odgovor od Sightengine." };
    }

    // Samo prave "eksplicitne" kategorije nas zanimaju -- suggestive/mildly_suggestive
    // (kupaći kostim, dekolte i sl.) su normalni za dating app i NE ulaze u ovaj račun.
    const explicitScore = Math.max(
      data.nudity.sexual_activity ?? 0,
      data.nudity.sexual_display ?? 0,
      data.nudity.erotica ?? 0
    );

    if (explicitScore >= REJECT_THRESHOLD) {
      return { status: "rejected", reason: `Eksplicitan sadržaj (skor ${explicitScore.toFixed(2)}).` };
    }
    if (explicitScore >= REVIEW_THRESHOLD) {
      return { status: "pending", reason: `Granični slučaj (skor ${explicitScore.toFixed(2)}) -- ručni pregled.` };
    }
    return { status: "approved", reason: null };
  } catch (err) {
    console.error("Sightengine moderacija nije uspela:", err);
    return { status: "pending", reason: "Greška pri pozivu moderacije." };
  }
}
