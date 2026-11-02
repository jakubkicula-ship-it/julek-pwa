(() => {
  "use strict";
  const key="julek-push-device-role";
  const mobile=()=>/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const supported=()=>mobile()&&window.isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
  const role=()=>window.rodzic||'Julek';
  const stored=()=>{try{return localStorage.getItem(key);}catch{return null;}};
  function remember(value){try{value?localStorage.setItem(key,value):localStorage.removeItem(key);}catch{}}
  function update(){
    document.querySelectorAll('[data-push-role]').forEach(button=>{
      button.hidden=!mobile();
      const r=button.dataset.pushRole==='parent'?window.rodzic:'Julek';
      button.textContent=stored()===r&&typeof Notification!=='undefined'&&Notification.permission==='granted'?'🔔 Powiadomienia — włączone':'🔔 Włącz powiadomienia';
    });
  }
  async function api(body){
    const response=await fetch(window.JULEK_PUSH.apiUrl,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
    const value=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(value.error||'Nie udało się połączyć. Spróbuj ponownie.');
    return value;
  }
  const publicKey=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  let busy=false;
  window.openPushSettings=async()=>{
    if(busy)return;
    if(!supported())return alert(mobile()?'Otwórz aplikację w Chrome na Androidzie. Na iPhonie dodaj ją do ekranu początkowego i uruchom z ikony.':'Powiadomienia są przeznaczone na telefony.');
    busy=true;
    try{
      const r=role();
      const registration=await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Uruchom ponownie aplikację i spróbuj jeszcze raz.')),15000))]);
      const old=await registration.pushManager.getSubscription();
      const enabled=old&&stored()===r;
      let action='enable';
      if(enabled){
        const choice=prompt('Powiadomienia są włączone. Wpisz 1, aby wysłać test, lub 2, aby je wyłączyć.','1');
        if(choice===null)return;
        if(choice!=='1'&&choice!=='2')return;
        action=choice==='2'?'disable':'test';
      }
      if(action==='disable'){
        await api({action,role:r,subscription:old.toJSON()});
        await old.unsubscribe();remember(null);update();return alert('Powiadomienia wyłączone na tym telefonie.');
      }
      if(Notification.permission==='denied')return alert('Powiadomienia są zablokowane. Zezwól na nie w ustawieniach tej strony lub aplikacji.');
      if(await Notification.requestPermission()!=='granted')return alert('Nie udzielono zgody na powiadomienia.');
      const {publicKey:serverKey}=await api();
      const subscription=old||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:publicKey(serverKey)});
      try{await api({action,role:r,subscription:subscription.toJSON()});}
      catch(error){if(!old)await subscription.unsubscribe();throw error;}
      remember(r);update();alert('Wysłano powiadomienie testowe. Sprawdź powiadomienia telefonu.');
    }catch(error){alert(error.message||'Nie udało się włączyć powiadomień.');}
    finally{busy=false;}
  };
  const afterLogin=window.onAfterLogin;
  window.onAfterLogin=function(...args){afterLogin?.apply(this,args);update();};
  update();
})();
