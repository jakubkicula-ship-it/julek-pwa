/* ===============================
   JULEK PWA SERVICE WORKER
   WYMUSZONA AKTUALIZACJA
   =============================== */

const SW_VERSION = "julek-v2025-12-15-01"; // <<< ZMIEŃ PRZY KAŻDEJ PUBLIKACJI
const STATIC_CACHE = `static-${SW_VERSION}`;

const STATIC_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

/* ================= INSTALL ================= */
self.addEventListener("install", event => {
  self.skipWaiting(); // NATYCHMIAST nowa wersja

  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(STATIC_FILES);
    })
  );
});

/* ================= ACTIVATE ================= */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ================= FETCH ================= */
self.addEventListener("fetch", event => {
  const req = event.request;

  // ZAWSZE pobieraj index.html z sieci (najważniejsze!)
  if (req.mode === "navigate" || req.url.endsWith("index.html")) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Pozostałe pliki: cache first
  event.respondWith(
    caches.match(req).then(cached => {
      return cached || fetch(req);
    })
  );
});

/* ================= MESSAGE ================= */
self.addEventListener("message", event => {
  if (event.data && event.data.action === "skipWaiting") {
    self.skipWaiting();
  }
});
