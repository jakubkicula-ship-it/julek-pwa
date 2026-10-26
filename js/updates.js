(function(){
  if (!("serviceWorker" in navigator)) return;
  let registration;
  let deferred = false;
  let applying = false;
  const banner = document.getElementById("updateBanner");
  const button = document.getElementById("updateNow");
  const later = document.getElementById("updateLater");
  const message = document.getElementById("updateMessage");
  function showUpdate(){
    if (registration?.waiting && !deferred && !applying) banner?.classList.remove("hidden");
  }
  window.deferAppUpdate = function(){
    deferred = true;
    banner?.classList.add("hidden");
  };
  window.forceDesktopUpdate = function(){
    if (!registration?.waiting) {
      if (message) message.innerText = "Sprawdzam dostępność aktualizacji…";
      checkUpdate(false);
      return;
    }
    applying = true;
    if (button) button.disabled = true;
    if (later) later.disabled = true;
    if (message) message.innerText = "Aktualizowanie aplikacji…";
    registration.waiting.postMessage({type:"SKIP_WAITING"});
  };
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // Pierwsza instalacja nie wymaga przeładowania. Zmiana aktywnej wersji już tak,
    // także jeżeli aktualizację zaakceptowano w drugiej karcie tej aplikacji.
    if ((applying || hadController) && !refreshing) { refreshing = true; location.reload(); }
  });
  const hadController = !!navigator.serviceWorker.controller;
  async function checkUpdate(remind){
    if (remind) deferred = false;
    showUpdate();
    try {
      await registration?.update();
      showUpdate();
    } catch(error) {
      console.error("Sprawdzenie aktualizacji:",error);
      // Bez połączenia użytkownik nadal może korzystać z posiadanej wersji.
    }
  }
  window.addEventListener("pageshow", () => { checkUpdate(true); });
  window.addEventListener("focus", () => { checkUpdate(true); });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkUpdate(true);
  });
  navigator.serviceWorker.register("sw.js", {updateViaCache:"none"}).then(reg => {
    registration = reg;
    showUpdate();
    reg.addEventListener("updatefound", () => {
      reg.installing?.addEventListener("statechange", () => { setTimeout(showUpdate,0); });
    });
    checkUpdate(true);
    setInterval(() => { checkUpdate(false); }, 5*60*1000);
  }).catch(console.error);
})();
