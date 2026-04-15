// sw.js
// 🔴 ZWIĘKSZAJ TĘ WERSJĘ PRZY KAŻDEJ ZMIANIE INDEX.HTML LUB SW
const SW_VERSION = "2.0.4";
const CACHE_NAME = "julek-cache-" + SW_VERSION;

// co ma być zawsze w cache (żeby nie mieszać wersji plików)
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",

  "./css/style.css",

  "./js/time.js",
  "./js/auth.js",
  "./js/state.js",
  "./js/render.js",
  "./js/app.js",
  "./js/parent.js",
  "./js/child.js",
  "./js/admin.js",

  "./icon-192v2.png",
  "./icon-512v2.png",

  "./UMOWA_JULEK_system_godzin.pdf",
  "./TABELA_PUNKTOW_JULEK.pdf",
  "./Instrukcja_obsługi.pdf"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

/*
  Strategia:
  - CORE_ASSETS: cache-first (szybko, spójna wersja)
  - reszta: network-first + fallback cache (żeby app działała offline)
*/
self.addEventListener("fetch", event => {
  const req = event.request;
  if(req.method !== "GET") return;

  const url = new URL(req.url);

  // tylko nasza domena/ścieżka (żeby nie próbować cachować firebase/gstatic itd.)
  const isSameOrigin = url.origin === self.location.origin;

  // cache-first dla plików z listy CORE
  const isCore = isSameOrigin && CORE_ASSETS.some(p => url.pathname.endsWith(p.replace("./","/")));

  if(isCore){
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        return resp;
      }))
    );
    return;
  }

  // network-first dla reszty naszych plików (fallback cache)
  if(isSameOrigin){
    event.respondWith(
      fetch(req).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        return resp;
      }).catch(() => caches.match(req))
    );
  }
});

/* =========================
   🔔 OBSŁUGA PUSH
========================= */

self.addEventListener("push", event => {
  let data = { title: "Punkty Julka", body: "Nowe powiadomienie" };

  if (event.data) {
    try{ data = event.data.json(); }catch(_){}
  }

  const options = {
    body: data.body,
    icon: "icon-192v2.png",
    badge: "icon-192v2.png",
    data: {
      url: data.url || "./"
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url === event.notification.data.url && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url);
        }
      })
  );
});
