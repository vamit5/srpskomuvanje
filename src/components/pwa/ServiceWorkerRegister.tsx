"use client";

import { useEffect } from "react";

/**
 * Registruje service worker (public/sw.js) samo u produkciji.
 * U razvoju ga namerno preskačemo da izbegnemo probleme sa keširanjem
 * dok se UI menja iz minuta u minut.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registracija nije uspela:", err);
    });
  }, []);

  return null;
}
