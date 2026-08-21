// Srpskomuvanje — service worker (ručno pisan, bez build-tool zavisnosti).
// Next.js 16 build po difoltu koristi Turbopack, a Serwist/Workbox integracije
// za Turbopack su još eksperimentalne — zato je ovo namerno prost i čitljiv SW
// koji radi identično u dev i prod okruženju.
//
// Promeni CACHE_VERSION kad god menjaš strategiju keširanja da bi se stari
// keš obrisao kod korisnika (vidi "update notification" u FAZI 7/10).
const CACHE_VERSION = "v1";
const SHELL_CACHE = `iskra-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `iskra-runtime-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline";

const SHELL_ASSETS = [OFFLINE_URL, "/manifest.webmanifest", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/icons/") ||
      /\.(png|jpg|jpeg|webp|avif|svg|ico|woff2?)$/.test(url.pathname))
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Navigacije (otvaranje stranice) — network-first, offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((res) => res || caches.match(request))
      )
    );
    return;
  }

  // Statički asset-i istog porekla — cache-first + tiha revalidacija u pozadini.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            if (res && res.status === 200) {
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, res.clone()));
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }

  // Sve ostalo (API pozivi ka Supabase i sl.) ide direktno na mrežu, bez keširanja —
  // real-time podaci (lajkovi, poruke, online status) NIKAD ne smeju doći iz keša.
});

// --- Push notifikacije (žica je spremna, aktivira se u FAZI 7 kad dodamo
// push subscription + VAPID ključeve na serveru) ---
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Srpskomuvanje", body: event.data.text() };
  }
  const title = payload.title || "Srpskomuvanje";
  const options = {
    body: payload.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: payload.url || "/sada" },
    tag: payload.tag,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/sada";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
