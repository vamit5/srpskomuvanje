import "server-only";

const RESEND_API_URL = "https://api.resend.com/emails";
// resend.dev je Resend-ov ugradjeni test domen -- radi odmah, bez
// verifikacije sopstvenog domena. Kad se doda i verifikuje pravi domen
// (npr. srpskomuvanje.rs) na resend.com, ovo treba zameniti (bolja
// isporuka/manje sanse da padne u spam).
const FROM_ADDRESS = "Srpskomuvanje <onboarding@resend.dev>";

/** Salje transakcioni mejl preko Resend-a. Nikad ne baca -- najgore sto
 * moze da se desi je da korisnik ne dobije mejl obavestenje, ne sme da obori
 * ostatak akcije (npr. slanje poruke) koja ga poziva. */
export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<{ error: string | null }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { error: "RESEND_API_KEY nije podešen." };

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
    });
    if (!res.ok) {
      console.error("Resend slanje nije uspelo:", res.status, await res.text());
      return { error: `Resend HTTP ${res.status}` };
    }
    return { error: null };
  } catch (err) {
    console.error("Resend slanje nije uspelo:", err);
    return { error: "Greška pri slanju mejla." };
  }
}
