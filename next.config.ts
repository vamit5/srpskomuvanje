import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Roditeljski folder ima svoj nepovezan package-lock.json (drugi projekat) --
  // eksplicitno kažemo Turbopacku gde je koren OVOG projekta da ne bi nagađao.
  turbopack: {
    root: __dirname,
  },
  experimental: {
    // Default za Server Actions je 1MB -- admin "Dodaj korisnika"/"Dodaj
    // sliku" (/admin/users/novi, /admin/users/[id]) salje SIROVU fotografiju
    // (do MAX_RAW_PHOTO_PICK_BYTES = 20MB, bez klijentske kompresije, za
    // razliku od obicnog korisnickog uploada koji ide direktno u Supabase
    // Storage) kroz Server Action -- bez ovoga, svaka realna telefonska
    // slika (tipicno 3-15MB) tiho pada na tom limitu, i dugme "Napravi
    // nalog"/"Dodaj" samo vecno ucitava bez ikakve greske. Ova ruta je
    // admin-only (is_admin() gate), nisko-prometna -- veci limit ovde nema
    // isti DDoS rizik na koji upozorava Next.js dokumentacija za javne rute.
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  images: {
    // Supabase Storage javni URL-ovi za profilne fotografije/video thumbnove
    // (FAZA 2). Zameni "*.supabase.co" ako koristiš custom domen.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
