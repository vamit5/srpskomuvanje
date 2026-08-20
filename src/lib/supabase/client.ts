import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase klijent za Client Components (browser).
 * Napomena o tipovima: čim šema bude deployovana na Supabase, pokreni
 *   npx supabase gen types typescript --project-id <id> > src/types/database.ts
 * i dodaj <Database> generic ovde i u server.ts, da dobijemo end-to-end tipove.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
