"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateMyLocation, clearMyLocation } from "../_location/actions";

export function LocationCard({ hasLocation, nearbyCount }: { hasLocation: boolean; nearbyCount: number | null }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(hasLocation);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleEnable() {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setError("Tvoj pregledač ne podržava deljenje lokacije.");
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const result = await updateMyLocation(pos.coords.latitude, pos.coords.longitude);
        setLoading(false);
        if (result.error) {
          setError(result.error);
          return;
        }
        setEnabled(true);
        router.refresh(); // dovuci pravi nearbyCount sa servera (prop je do sad bio null)
      },
      (err) => {
        setLoading(false);
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Dozvola za lokaciju je odbijena — možeš je promeniti u podešavanjima pregledača."
            : "Ne mogu trenutno da odredim lokaciju."
        );
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }

  async function handleDisable() {
    setLoading(true);
    await clearMyLocation();
    setLoading(false);
    setEnabled(false);
    router.refresh();
  }

  if (!enabled) {
    return (
      <section className="rounded-2xl border border-dashed border-[var(--color-border-strong)] px-4 py-5 text-center">
        <p className="text-2xl">📍</p>
        <p className="mt-1 font-semibold">Vidi ko je blizu tebe</p>
        <p className="mx-auto mt-1 max-w-xs text-xs text-[var(--color-text-muted)]">
          Nikad ne prikazujemo tvoju tačnu lokaciju — samo približnu udaljenost, i samo drugima.
        </p>
        <button
          type="button"
          onClick={handleEnable}
          disabled={loading}
          className="tap-scale mt-3 rounded-full bg-gradient-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Tražim lokaciju..." : "Uključi lokaciju"}
        </button>
        {error && <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>}
      </section>
    );
  }

  return (
    <div className="glass flex items-center justify-between rounded-2xl px-4 py-3.5">
      <span className="text-sm">
        📍{" "}
        {nearbyCount === null ? (
          "Učitavam..."
        ) : nearbyCount === 0 ? (
          "Niko u tvojoj blizini trenutno"
        ) : (
          <>
            <strong>{nearbyCount}</strong> {nearbyCount === 1 ? "osoba je" : "ljudi je"} u tvojoj blizini
          </>
        )}
      </span>
      <button
        type="button"
        onClick={handleDisable}
        disabled={loading}
        className="text-xs text-[var(--color-text-faint)] underline disabled:opacity-50"
      >
        Isključi
      </button>
    </div>
  );
}
