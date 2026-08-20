import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase klijent za Server Components, Server Actions i Route Handlere.
 * `cookies()` je async u Next.js 16, zato je i ova funkcija async.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // set() pozvan iz Server Componente (renderovanje) — u redu je,
            // proxy.ts (src/proxy.ts) osvežava sesiju na svakom requestu.
          }
        },
      },
    }
  );
}
