"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { savePushSubscription, removePushSubscription } from "../_push/actions";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

type Status = "checking" | "unsupported" | "denied" | "off" | "on";

export function PushToggle() {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setStatus(sub ? "on" : "off");
      } catch {
        setStatus("off");
      }
    })();
  }, []);

  async function handleEnable() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      setError("Notifikacije trenutno nisu podešene.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        setBusy(false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      const json = sub.toJSON();
      const result = await savePushSubscription({
        endpoint: sub.endpoint,
        p256dh: json.keys!.p256dh!,
        authKey: json.keys!.auth!,
        userAgent: navigator.userAgent,
      });
      if (result.error) {
        setError(result.error);
        setBusy(false);
        return;
      }
      setStatus("on");
    } catch {
      setError("Nešto nije u redu. Pokušaj ponovo.");
    }
    setBusy(false);
  }

  async function handleDisable() {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("off");
    } catch {
      setError("Nešto nije u redu. Pokušaj ponovo.");
    }
    setBusy(false);
  }

  if (status === "checking" || status === "unsupported") return null;

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">🔔 Push notifikacije</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {status === "denied"
              ? "Blokirane su u podešavanjima pregledača — moraš ručno da ih dozvoliš."
              : "Obavesti me kad dobijem match, poruku ili tajni signal."}
          </p>
        </div>
        {status !== "denied" && (
          <button
            type="button"
            onClick={status === "on" ? handleDisable : handleEnable}
            disabled={busy}
            aria-pressed={status === "on"}
            className={cn(
              "tap-scale relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50",
              status === "on" ? "bg-gradient-accent" : "bg-[var(--color-bg-elevated)]"
            )}
          >
            <span
              className={cn(
                "absolute top-1 h-5 w-5 rounded-full bg-white transition-transform",
                status === "on" ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>}
    </section>
  );
}
