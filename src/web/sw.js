/* Service worker for the hosted PWA.
 *
 * Strategy:
 *   - App shell (the navigation / HTML document, which IS the whole single-file
 *     app): NETWORK-FIRST. When online we always fetch the latest build, so a new
 *     release shows up on the very next launch — no waiting for a service-worker
 *     swap. When offline we fall back to the cached copy, so it still works fully
 *     offline. (Cache-first was the old behaviour and is why a stale version could
 *     stick around after a deploy.)
 *   - Static assets (manifest, icon): cache-first for speed; refreshed in the
 *     background.
 *
 * VERSION is stamped from APP_VERSION at build time so each release gets its own
 * cache bucket and old buckets are cleaned up on activate.
 */
const VERSION = "__APP_VERSION__";
const CACHE = "lbom-" + VERSION;
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.map((k) => (k === CACHE ? null : caches.delete(k))))
      )
      // Take control of open pages right away so the new worker (and its
      // network-first behaviour) applies without needing a second reload.
      .then(() => self.clients.claim())
  );
});

// The page tells a freshly-installed worker to take over immediately.
self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
});

function isNavigation(req) {
  return (
    req.mode === "navigate" ||
    req.destination === "document" ||
    (req.headers.get("accept") || "").includes("text/html")
  );
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  // App shell: network-first so new deploys appear immediately when online.
  if (isNavigation(req)) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          try {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put("./index.html", copy));
          } catch (_) {}
          return res;
        })
        .catch(() =>
          caches
            .match(req)
            .then((c) => c || caches.match("./index.html") || caches.match("./"))
        )
    );
    return;
  }

  // Everything else: cache-first.
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
