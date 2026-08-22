import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase klijent sa service_role ključem -- ZAOBILAZI SVA RLS PRAVILA.
 *
 * SME da se koristi SAMO za operacije gde server mora da radi u ime
 * VIŠE korisnika odjednom (npr. pošalji push notifikaciju drugom
 * korisniku kad neko dobije match ili poruku -- RLS mu inače ne bi
 * dozvolio da čita tuđu push_subscriptions tabelu).
 *
 * NIKAD ne importovati ovaj fajl u Client Component. `server-only`
 * paket baca grešku pri build-u ako se to slučajno desi.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY nije podešen u .env.local -- potreban za push notifikacije."
    );
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
