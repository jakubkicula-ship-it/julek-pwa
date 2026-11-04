/* Plik działa w workerze: bez window i bez dostępu do panelu administratora. */
importScripts("./js/settings.js");
importScripts("./js/v3-alert-store.js");
const CACHE = "julek-pwa-" + JULEK_SETTINGS.version + "-beta9-compact-alarms";
const FILES = ["./js/v3-alert-model.js", "./js/v3-alert-store.js", "./js/v3-alerts.js", "./js/v3-native.js", "./js/v3-delete-config.js", "./css/v3-compact.css", "./css/v3-alerts.css", "./js/v3-guardians.js", "./js/v3-archive.js", "./css/v3-tasks.css", "./js/v3-layout.js", "./css/v3-layout.css", "./", "./index.html", "./manifest.json", "./css/style.css", "./css/week-result.css",
  "./css/v3-style.css", "./css/v3-refinements.css", "./css/v3-additions.css", "./css/v3-live.css",
  "./js/v3-icons.js", "./js/v3-app.js", "./js/v3-domain.js", "./js/v3-calendar.js", "./js/v3-extras.js", "./js/v3-history-model.js", "./js/v3-history-ui.js", "./js/v3-alarm.js", "./js/v3-dashboard.js", "./js/v3-documents.js", "./css/v3-dashboard.css", "./css/v3-history.css", "./icon-v3.svg", "./icon-64-beta.png", "./icon-180-beta.png", "./icon-192-beta.png", "./icon-512-beta.png", "./icon-512-beta-maskable.png", "./icon-192v3.png", "./icon-512v3.png",
  "./js/push-config.js", "./js/push.js", "./js/week-result.js", "./js/week-result-client.js", "./tada.mp3", "./sad-trombone.mp3",
  "./js/settings.js", "./js/time.js", "./js/settlement.js", "./js/auth.js",
  "./js/state.js", "./js/render.js", "./js/app.js", "./js/parent.js", "./js/child.js",
  "./js/admin.js", "./js/updates.js", "./icon-192v2.png", "./icon-512v2.png"];
self.addEventListener("install", event => {
  // Nowa wersja musi pobrać każdy plik z sieci, pomijając stary cache HTTP.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(
    FILES.map(file => new Request(new URL(file, self.registration.scope), {cache:"reload"}))
  )));
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
  if(event.request.cache==='no-store'||!FILES.some(file=>new URL(file,self.registration.scope).pathname===url.pathname))return;
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

/* Persistent receipt state is separate from notification visibility. */
async function flushAlertReceipts(){try{for(const r of await JulekAlertStore.all()){if(r.synced||!r.ackToken)continue;try{const response=await fetch('https://julek-notifications.jakub-kicula.workers.dev/v3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'reminderAck',id:r.id,pressedAt:r.pressedAt,ackToken:r.ackToken})});if(response.ok){await JulekAlertStore.synced(r.id);for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true}))if(client.url.startsWith(self.registration.scope))client.postMessage?.({type:'REMINDER_ACKED',id:r.id});}}catch{}}}catch{}}
async function openReminderWindow(){const scope=self.registration.scope;for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true})){if(client.url.startsWith(scope)){client.postMessage?.({type:'REMINDER_OPEN'});await client.focus();return;}}return self.clients.openWindow(scope);}
self.addEventListener('push',event=>{event.waitUntil((async()=>{await flushAlertReceipts();let data={title:'Zadania Julka',body:'Nowe powiadomienie'};try{if(event.data)data={...data,...event.data.json()};}catch{}const reminder=data.kind==='reminders'&&data.requiresAck===true,id=data.reminderEvent;if(reminder){const receipts=await JulekAlertStore.all().catch(()=>[]);if(receipts.some(r=>r.id===id))return;}const url=new URL('./',self.registration.scope);const options={body:String(data.body).slice(0,300),icon:'icon-192-beta.png',badge:'icon-192-beta.png',silent:data.silent===true,tag:data.id||undefined,data:{url:url.href}};if(reminder){options.requireInteraction=true;options.renotify=true;options.tag='julek-reminder-'+id;options.actions=[{action:'received',title:'Odebrałem'},{action:'open',title:'Otwórz'}];options.data={url:url.href,id,ackToken:data.ackToken};if(!options.silent)options.vibrate=[450,180,450,180,450];}await self.registration.showNotification(String(data.title).slice(0,120),options);if(reminder)for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true}))if(client.url.startsWith(self.registration.scope))client.postMessage?.({type:'REMINDER_OPEN'});})());});
self.addEventListener('notificationclick',event=>{event.waitUntil((async()=>{if(event.action==='received'&&event.notification.data?.id&&event.notification.data?.ackToken){try{await JulekAlertStore.put({id:event.notification.data.id,ackToken:event.notification.data.ackToken,pressedAt:Date.now(),synced:false});event.notification.close();for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true}))if(client.url.startsWith(self.registration.scope))client.postMessage?.({type:'REMINDER_ACKED',id:event.notification.data.id});await flushAlertReceipts();return;}catch{await openReminderWindow();return;}}event.notification.close();await openReminderWindow();})());});
