// Service Worker für den Offline-Betrieb (Satzung, Wahlen/Auszählung).
// Zwischengespeichert werden nur: die statischen Programmdateien (/_next/static) und die Seiten unter
// OFFLINE_PREFIXES. Andere Seiten und API-Antworten werden nie gespeichert (Datenschutz).
const VERSION = "ov-offline-v1";
const OFFLINE_PREFIXES = ["/satzung", "/elections"];
const PRECACHE = ["/satzung"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      for (const path of PRECACHE) {
        try {
          const res = await fetch(path, { credentials: "same-origin" });
          if (!res.ok || res.redirected) continue;
          const html = await res.clone().text();
          await cache.put(path, res);
          const assets = [...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)].map((m) => m[1]);
          await Promise.all(
            [...new Set(assets)].map((a) =>
              fetch(a)
                .then((r) => (r.ok ? cache.put(a, r) : null))
                .catch(() => null),
            ),
          );
        } catch {
          // offline bei Installation – beim nächsten Besuch erneut
        }
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== VERSION) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

function offlinePage(pathname) {
  return OFFLINE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  if (req.mode === "navigate" && offlinePage(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(VERSION);
        try {
          const res = await fetch(req);
          if (res.ok && !res.redirected) cache.put(url.pathname, res.clone());
          return res;
        } catch {
          return (await cache.match(url.pathname)) || (await cache.match("/satzung")) || Response.error();
        }
      })(),
    );
  }
});
