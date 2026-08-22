import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Next.js 16: `middleware.ts` je preimenovan u `proxy.ts`, export `proxy` umesto `middleware`.
// Radi samo u nodejs runtime-u (edge runtime ovde više nije opcija).

const PUBLIC_ROUTES = ["/", "/prijava", "/registracija", "/offline", "/auth/confirm"];
const AUTH_ONLY_ROUTES = ["/prijava", "/registracija"];

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // getUser() (ne getSession()) — validira token kod Supabase Auth servera,
  // ne veruje se samo kolačiću.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_ROUTES.includes(pathname);
  const isAuthOnly = AUTH_ONLY_ROUTES.includes(pathname);

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/prijava";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAuthOnly) {
    const url = request.nextUrl.clone();
    url.pathname = "/sada";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // "api" je namerno izuzeto -- API rute (npr. Stripe webhook) nemaju
    // ulogovanog korisnika/kolačić po prirodi posla i imaju SOPSTVENU
    // proveru (Stripe potpis), pa ih ovaj auth-gate middleware ne sme
    // preusmeravati na /prijava (307 je razbijao Stripe webhook isporuku).
    "/((?!api|_next/static|_next/image|favicon|icons|apple-touch-icon|sw.js|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|webp|avif|svg|ico)$).*)",
  ],
};
