"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const OnlineContext = createContext<Set<string>>(new Set());

/**
 * PRAVI, uzivo status ko je online -- preko Supabase Realtime Presence
 * (WebSocket konekcija), ne priblizna procena po "poslednja aktivnost pre
 * X minuta" (kako je ranije radilo -- vidi ONLINE_WINDOW_MS u
 * poruke/[matchId]/page.tsx, i dalje se koristi kao fallback ako neko
 * ima ugasen JS/websocket). Svaki ulogovan klijent "track"-uje sebe na
 * DELJENOM kanalu cim se app ucita; svi ostali klijenti na istom kanalu
 * dobijaju "sync" event sa spiskom trenutno povezanih -- ovo je zaista
 * uzivo (cim neko zatvori tab/app, njegova prisutnost nestaje u
 * sekundama, Supabase Realtime sam otkriva prekid konekcije).
 */
export function OnlinePresenceProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel("online-users", {
      config: { presence: { key: userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        setOnlineIds(new Set(Object.keys(channel.presenceState())));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return <OnlineContext.Provider value={onlineIds}>{children}</OnlineContext.Provider>;
}

/** Set ID-jeva profila koji su TRENUTNO povezani (uzivo, azurira se samo). */
export function useOnlineIds(): Set<string> {
  return useContext(OnlineContext);
}

export function useIsOnline(profileId: string | null | undefined): boolean {
  const onlineIds = useOnlineIds();
  return !!profileId && onlineIds.has(profileId);
}
