"use client";

import { useState } from "react";
import { deactivateEvent } from "../actions";

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  city: string | null;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
}

export function EventsList({ initialEvents }: { initialEvents: EventRow[] }) {
  const [events, setEvents] = useState(initialEvents);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Kad roditeljska Server Komponenta osveži podatke (npr. router.refresh()
  // posle pravljenja novog događaja), useState-ov initialEvents se NE
  // ažurira sam od sebe -- React koristi početnu vrednost samo pri prvom
  // montiranju. Ovo je React-ov zvanično preporučeni obrazac za
  // sinhronizaciju state-a sa promenjenim propom BEZ efekta (podešavanje
  // tokom render-a, ne posle) -- vidi "You Might Not Need An Effect".
  const [prevInitialEvents, setPrevInitialEvents] = useState(initialEvents);
  if (initialEvents !== prevInitialEvents) {
    setPrevInitialEvents(initialEvents);
    setEvents(initialEvents);
  }

  async function handleDeactivate(id: string) {
    setBusyId(id);
    const result = await deactivateEvent(id);
    setBusyId(null);
    if (!result.error) {
      setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, is_active: false } : e)));
    }
  }

  if (!events.length) {
    return <p className="text-sm text-[var(--color-text-muted)]">Još nema događaja.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {events.map((ev) => {
        const isLive = ev.is_active && new Date(ev.ends_at) > new Date();
        return (
          <li key={ev.id} className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3 text-sm">
            <div>
              <p className="font-semibold">
                {ev.title} {isLive && <span className="text-[var(--color-success)]">● uživo</span>}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {ev.city ?? "Svi gradovi"} · {new Date(ev.starts_at).toLocaleString("sr-RS")} →{" "}
                {new Date(ev.ends_at).toLocaleString("sr-RS")}
              </p>
            </div>
            {ev.is_active && (
              <button
                type="button"
                onClick={() => handleDeactivate(ev.id)}
                disabled={busyId === ev.id}
                className="text-xs text-[var(--color-danger)] underline disabled:opacity-50"
              >
                Ugasi
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
