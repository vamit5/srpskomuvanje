"use client";

import { useEffect, useState } from "react";
import { savePushSubscription } from "@/app/(app)/_push/actions";

const DISMISS_KEY = "pushPromptDismissed";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/**
 * Ponudi push notifikacije PROAKTIVNO (ne samo skriveno u /profil) --
 * korisniku ne treba instalirana ikonica na telefonu da bi ovo radilo
 * (Android/desktop Chrome podržava Web Push direktno iz browsera). Jedini
 * stvaran izuzetak je iPhone (Safari) -- Apple dozvoljava Web Push SAMO
 * ako je stranica dodata na Pocetni ekran, to je OS ogranicenje koje se ne
 * moze zaobici iz koda.
 */
export function PushPrompt() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
      if (Notification.permission !== "default") return; // vec pitano (dozvoljeno ili odbijeno)
      try {
        if (localStorage.getItem(DISMISS_KEY)) return;
      } catch {
        // privatni mod i sl. -- nastavi bez pamcenja odbijanja
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!sub) setVisible(true);
      } catch {
        // ignorisi -- jednostavno ne prikazuj ponudu
      }
    })();
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // u redu je i bez pamcenja
    }
  }

  async function handleEnable() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      dismiss();
      return;
    }
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        dismiss();
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      const json = sub.toJSON();
      await savePushSubscription({
        endpoint: sub.endpoint,
        p256dh: json.keys!.p256dh!,
        authKey: json.keys!.auth!,
        userAgent: navigator.userAgent,
      });
    } catch {
      // tiho -- korisnik i dalje moze rucno da ukljuci na /profil
    }
    dismiss();
  }

  if (!visible) return null;

  return (
    <div className="animate-bubble-in glass mx-4 mt-2 flex items-center gap-3 rounded-2xl px-4 py-3">
      <span className="text-xl">🔔</span>
      <p className="flex-1 text-xs text-[var(--color-text-muted)]">
        Uključi obaveštenja da ne propustiš poruke i matcheve.
      </p>
      <button
        type="button"
        onClick={handleEnable}
        disabled={busy}
        className="tap-scale shrink-0 rounded-full bg-gradient-accent px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
      >
        {busy ? "..." : "Uključi"}
      </button>
      <button type="button" onClick={dismiss} aria-label="Zatvori" className="tap-scale shrink-0 text-[var(--color-text-faint)]">
        ✕
      </button>
    </div>
  );
}
