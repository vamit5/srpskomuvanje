import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Ruta na koju vodi link za potvrdu email-a (Supabase "Confirm signup" template).
 * Supabase dashboard -> Authentication -> Email Templates -> Confirm signup mora
 * da koristi:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/onboarding
 * umesto podrazumevanog {{ .ConfirmationURL }} (koji vodi direktno na Supabase server).
 * Vidi README -> "Poveži Supabase" korak 6.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/onboarding";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      redirect(next);
    }
  }

  redirect("/prijava?error=confirmation");
}
