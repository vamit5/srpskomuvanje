import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // "name" je tekst koji Android/Chrome unapred upisuje u polje pri
    // "Instaliraj app" dijalogu -- mora biti tacno "Srpskomuvanje" (zahtev).
    name: "Srpskomuvanje",
    short_name: "Srpskomuvanje", // ime ispod ikonice na Home Screen-u
    description: "Uđi. Vidi ko je tu.",
    start_url: "/sada",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0e",
    theme_color: "#0a0a0e",
    lang: "sr",
    categories: ["social", "lifestyle", "dating"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
