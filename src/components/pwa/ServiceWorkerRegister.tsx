"use client";

import { useEffect } from "react";

/**
 * Registruje service worker (public/sw.js).
 *
 * Ranije smo ovo radili SAMO u produkciji (bojazan od keširanja dok se UI
 * menja iz minuta u minut u razvoju). Sad se registruje uvek -- push
 * notifikacije (FAZA 7) zahtevaju aktivnu registraciju da bi se uopšte
 * mogle testirati, i naša fetch strategija u sw.js je dovoljno bezbedna
 * za dev (statički fajlovi imaju hash u imenu, navigacija je network-first,
 * a HMR ide preko WebSocket-a koji fetch handler i ne dodiruje).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registracija nije uspela:", err);
    });
  }, []);

  return null;
}
