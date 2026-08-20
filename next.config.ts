import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Roditeljski folder ima svoj nepovezan package-lock.json (drugi projekat) --
  // eksplicitno kažemo Turbopacku gde je koren OVOG projekta da ne bi nagađao.
  turbopack: {
    root: __dirname,
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
