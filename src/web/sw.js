/* Service worker for the hosted PWA.
 *
 * Strategy: cache-first so the installed app opens instantly and works offline.
 * VERSION is stamped from APP_VERSION at build time, so a new release changes
 * this file's bytes -> the browser detects an update on the next visit, caches
 * the new app, and (with the page's controllerchange handler) reloads into it.
 * That's what makes hosted updates seamless: no downloading or replacing files.
 */
const VERSION = "__APP_VERSION__";
const CACHE = "lbom-" + VERSION;
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener("activate", (e) => {
  // Drop old version caches so updates don't pile up.
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE ? null : caches.delete(k))))
    )
  );
});

// The page tells a freshly-installed worker to take over immediately.
self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  e.respondWith(
    caches.match(req).then((cached) =>
      cached ||
      fetch(req)
        .then((res) => {
          try {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          } catch (_) {}
          return res;
        })
        .catch(() => cached)
    )
  );
});
