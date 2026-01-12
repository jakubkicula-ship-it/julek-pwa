// 🔴 ZWIĘKSZAJ TĘ WERSJĘ PRZY KAŻDEJ ZMIANIE INDEX.HTML LUB SW
const SW_VERSION = "2.0.2";
const CACHE_NAME = "julek-cache-" + SW_VERSION;

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll([
        "./",
        "./index.html",
        "./manifest.json"
      ])
    )
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  event.respondWith(
    fetch(event.request)
      .then(resp => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, copy);
        });
        return resp;
      })
      .catch(() => caches.match(event.request))
  );
});

/* =========================
   🔔 OBSŁUGA PUSH
========================= */

self.addEventListener("push", event => {
  let data = { title: "Punkty Julka", body: "Nowe powiadomienie" };

  if (event.data) {
    data = event.data.json();
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
