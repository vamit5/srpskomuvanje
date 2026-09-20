import "server-only";
import nodemailer from "nodemailer";
import { createAdminClient } from "@/lib/supabase/admin";

// Gmail SMTP (App Password) -- namerno umesto Resend-a: Resend-ov besplatan
// test domen (onboarding@resend.dev) sme da salje SAMO na sopstvenu
// registrovanu adresu dok se ne verifikuje pravi domen (nemamo ga jos).
// Gmail SMTP radi odmah za bilo kog primaoca, bez domena -- do 500 mejlova
// dnevno besplatno, dovoljno za sada. Kad se doda pravi domen, moze se
// preci nazad na Resend za bolju isporuku/branding.
function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

/** Salje transakcioni mejl preko Gmail SMTP-a. Nikad ne baca -- najgore sto
 * moze da se desi je da korisnik ne dobije mejl obavestenje, ne sme da obori
 * ostatak akcije (npr. slanje poruke) koja ga poziva. */
export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<{ error: string | null }> {
  const transporter = getTransporter();
  if (!transporter) return { error: "GMAIL_USER/GMAIL_APP_PASSWORD nije podešen." };

  try {
    await transporter.sendMail({
      from: `Srpskomuvanje <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    });
    // Vidi napomenu u catch bloku ispod -- privremeno beleze se i uspesi, da
    // se zna da li se ovaj kod uopste izvrsava u produkciji.
    try {
      await createAdminClient().from("email_debug_log").insert({ to_email: to, error_text: null });
    } catch {
      // ignorisi
    }
    return { error: null };
  } catch (err) {
    const errorText = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    console.error("Gmail SMTP slanje nije uspelo:", err);
    // Privremeno: Vercel-ovi logovi na ovom planu drze mali rolling bafer i
    // prebrzo se prepisuju da bi se uhvatila greska uzivo -- ovo beleza
    // TACNU gresku u bazu da se moze proveriti bilo kad (vidi migraciju
    // 0025_email_debug_log.sql). Best-effort -- ne sme da baci ako i OVO padne.
    try {
      await createAdminClient().from("email_debug_log").insert({ to_email: to, error_text: errorText });
    } catch {
      // ignorisi -- ne dozvoli da dijagnostika obori originalnu gresku
    }
    return { error: "Greška pri slanju mejla." };
  }
}
