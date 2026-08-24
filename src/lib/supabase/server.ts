import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

/**
 * Supabase klijent za Server Components, Server Actions i Route Handlere.
 * `cookies()` je async u Next.js 16, zato je i ova funkcija async.
 *
 * Umotano u React `cache()` -- BEZ ovoga, svaki poziv createClient() unutar
 * istog requesta pravi NOV klijent, i (vidi getAuthUser ispod) svaki poziv
 * .auth.getUser() na njemu ide preko mreže do Supabase Auth servera. Na
 * jednoj stranici to se lako desi 3-4 puta (layout.tsx + page.tsx + jedna
 * ili dve server akcije pozvane direktno iz page.tsx) -- svaki poziv je
 * bio zaseban network round-trip, sto je bio GLAVNI uzrok sporih prelaza
 * izmedju stranica (3-4 sekunde). cache() garantuje da SVI pozivi unutar
 * istog requesta dobiju IST klijent (React "request memoization" -- radi
 * samo unutar jednog server-render prolaza, ne izmedju razlicitih requesta).
 */
export const createClient = cache(async function createClient() {
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
});

/**
 * Isti ulogovani korisnik za CEO request -- koristiti OVO umesto direktnog
 * `supabase.auth.getUser()` svuda gde se korisnik samo identifikuje (skoro
 * svuda). `.auth.getUser()` sam po sebi UVEK ide na mrezu (validira token
 * kod Supabase Auth servera) -- to je ispravno i namerno JEDNOM po requestu,
 * ali pozvano vise puta (layout + page + akcije) je cist gubitak vremena.
 * Bezbedno je: prava provera pristupa je i dalje RLS na bazi (Postgres
 * nezavisno validira JWT potpis na svakom upitu), ovo je samo identifikacija
 * "ko pita", ne jedina linija odbrane.
 */
export const getAuthUser = cache(async function getAuthUser() {
  const supabase = await createClient();
  return supabase.auth.getUser();
});
