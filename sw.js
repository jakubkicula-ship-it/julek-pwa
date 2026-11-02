/* Plik działa w workerze: bez window i bez dostępu do panelu administratora. */
importScripts("./js/settings.js");
const CACHE = "julek-pwa-" + JULEK_SETTINGS.version + "-r1";
const FILES = ["./", "./index.html", "./manifest.json", "./css/style.css", "./css/week-result.css",
  "./js/push-config.js", "./js/push.js", "./js/week-result.js", "./js/week-result-client.js", "./tada.mp3", "./sad-trombone.mp3",
  "./js/settings.js", "./js/time.js", "./js/settlement.js", "./js/auth.js",
  "./js/state.js", "./js/render.js", "./js/app.js", "./js/parent.js", "./js/child.js",
  "./js/admin.js", "./js/updates.js", "./icon-192v2.png", "./icon-512v2.png"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith("julek-pwa-") && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  // Wyłącznie własne pliki statyczne. Firebase i inne domeny omijają cache.
  if (event.request.method !== "GET" || url.origin !== self.location.origin ||
      !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const saved = await cache.match(event.request);
    // Zestaw plików należy do jednej wersji. „Później” zostawia tę wersję aktywną.
    if (saved) return saved;
    try {
      const response = await fetch(event.request, { cache: "no-cache" });
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    } catch(error) {
      throw error;
    }
  })());
});

/* Push never changes point balances and never plays background audio. */
self.addEventListener("push",event=>{
  event.waitUntil((async()=>{
    let data={title:"Punkty Julka",body:"Nowe powiadomienie"};
    try{if(event.data)data={...data,...event.data.json()};}catch(_){}
    // Click targets remain inside this PWA, even if a payload is malformed.
    const url=new URL("./",self.registration.scope);
    await self.registration.showNotification(String(data.title).slice(0,120),{
      body:String(data.body).slice(0,300),icon:"icon-192v2.png",badge:"icon-192v2.png",
      tag:data.id||undefined,data:{url:url.href}
    });
  })());
});
self.addEventListener("notificationclick",event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const scope=self.registration.scope;
    for(const client of await self.clients.matchAll({type:"window",includeUncontrolled:true})){
      if(client.url.startsWith(scope)){await client.focus();return;}
    }
    return self.clients.openWindow(scope);
  })());
});
