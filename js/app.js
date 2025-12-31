// ./js/app.js

/* ================== ZABEZPIECZENIA GLOBALI ================== */
window.logsCache = window.logsCache || {};
window.appealsByLog = window.appealsByLog || {};
window.appealsList = window.appealsList || [];
window.showWholeWeekLogs = window.showWholeWeekLogs || false;

// WNIOSKI O PUNKTY (global):
// - pointRequestsAll: pełna historia (do logów)
// - pointRequestsActive: tylko aktywne (do listy w menu rodzica)
// - pointRequests: zostawiamy kompatybilnie (jak ktoś gdzieś używa)
window.pointRequestsAll = window.pointRequestsAll || [];
window.pointRequestsActive = window.pointRequestsActive || [];
window.pointRequests = window.pointRequests || [];

if(typeof window.rodzic === "undefined") window.rodzic = "";
if(typeof window.askPinMasked !== "function"){
  window.askPinMasked = async (title)=>{
    const v = prompt(title || "PIN:");
    return (v===null) ? null : String(v);
  };
}

/* ================== HELPERS ================== */
function escapeHtml(str){
  return (str||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}
function setText(id, val){
  const el = document.getElementById(id);
  if(el) el.innerText = String(val);
}
function dateHeader(date){
  if(typeof window.dateWithDowPl === "function") return window.dateWithDowPl(date);
  return date;
}
function toggleWeekLogs(){
  showWholeWeekLogs = !showWholeWeekLogs;
  renderAll();
}
function tsToWarsaw(ts){
  if(!ts) return "";
  return new Date(ts).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" });
}
function formatHours(val){
  const n = Number(val || 0);
  if(Number.isFinite(n) && Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return String(n).replace(".", ",");
}

/* ====== RENDER-HELPERS ====== */
function sortedDates(obj){
  return Object.keys(obj||{}).sort();
}

/* ================== WERSJA ================== */
const APP_VERSION = "2.0.0";
(()=>{
  const v = document.getElementById("appVer");
  if(v) v.innerText = "v" + APP_VERSION;
})();

/* ================== FIREBASE ================== */
(function initFirebaseOnce(){
  const cfg = {
    apiKey:"AIzaSyD5asqQ2YEr_7LB9ysmyP_tZBj515-NW1o",
    authDomain:"julek-punkty.firebaseapp.com",
    databaseURL:"https://julek-punkty-default-rtdb.europe-west1.firebasedatabase.app"
  };
  if(!firebase.apps || firebase.apps.length === 0){
    firebase.initializeApp(cfg);
  }
  window.db = firebase.database();
})();
const db = window.db;

/* ================== PDF ================== */
function openPdf(file){
  const w = window.open(file, "_blank");
  if(!w) location.href = file;
}

/* ================== MENU ================== */
function toggleAppeals(){
  const sec = document.getElementById("secAppeals");
  if(!sec) return;

  const willShow = sec.classList.contains("hidden");
  sec.classList.toggle("hidden");

  if(willShow){
    if(typeof window.renderParentAppeals === "function") window.renderParentAppeals();
    if(typeof window.updateAppealsButton === "function") window.updateAppealsButton();
  }
}

/* ===================================================== */
/* ============ WNIOSKI O PUNKTY – FIREBASE ============== */
/* ===================================================== */

const PR_PATH = "wnioski_punkty";
const PR_H12 = 12 * 60 * 60 * 1000;

function isoFromTsWarsaw(ts){
  return new Date(ts).toLocaleDateString("en-CA", { timeZone: "Europe/Warsaw" });
}

// Normalizacja rekordu wniosku
function normalizePointRequest(val, key){
  const o = val || {};
  const createdAt = o.createdAt ?? o.created_at ?? 0;
  const expiresAt = o.expiresAt ?? o.expires_at ?? (createdAt ? (createdAt + PR_H12) : 0);

  return {
    ...o,
    key,
    id: o.id || key,

    createdAt,
    expiresAt,

    status: o.status || "pending",
    points: Number(o.points || 1),

    child_comment: (o.child_comment || o.childComment || o.komentarzDziecka || "").toString(),
    komentarz: (o.komentarz || o.parent_comment || o.parentComment || "").toString(),

    kto: (o.kto || o.decided_by || "").toString(),
    decyzjaAt: o.decyzjaAt ?? o.decided_at ?? null,

    applied: !!o.applied,
    logKey: o.logKey || null,
    logDate: o.logDate || null,

    data: o.data || null,

    archived: !!(o.archived || o.is_archived),
    closedAt: o.closedAt ?? o.closed_at ?? null
  };
}

// aktywne = tylko takie, gdzie realnie można jeszcze coś kliknąć/zmienić
function computeActivePointRequests(allList){
  const list = Array.isArray(allList) ? allList : [];
  const now = Date.now();
  const r = (window.rodzic || "").toString();

  return list.filter(p=>{
    if(!p) return false;
    if(p.archived || p.is_archived || p.closedAt || p.closed_at) return false;

    const st = String(p.status || "pending").toLowerCase();
    if(st === "accepted_auto") return false; // zablokowane

    const exp = Number(p.expiresAt || 0);
    if(exp && now > exp) return false; // po 12h znika z listy

    const who = (p.kto || p.decided_by || "").toString();

    // pending: tylko jeśli nikt nie kliknął i nie minęło 12h
    if(st === "pending"){
      return !who;
    }

    // accepted / rejected: tylko jeśli zdecydował TEN rodzic i nie minęło 12h
    if(st === "accepted" || st === "rejected"){
      return !!r && (who === r);
    }

    return false;
  });
}

// helper dla parent.js
window.getActivePointRequests = function(){
  return Array.isArray(window.pointRequestsActive) ? window.pointRequestsActive : [];
};

// Odczyt wniosków z Firebase → pointRequestsAll + pointRequestsActive
db.ref(PR_PATH).on("value", s=>{
  const all = [];
  s && s.forEach(ch=>{
    all.push(normalizePointRequest(ch.val(), ch.key));
  });

  // sort historii: pending na górze, potem po czasie (najnowsze na górze)
  all.sort((a,b)=>{
    const ap = String(a.status||"").toLowerCase() === "pending";
    const bp = String(b.status||"").toLowerCase() === "pending";
    if(ap !== bp) return ap ? -1 : 1;
    return (b.createdAt||0) - (a.createdAt||0);
  });

  window.pointRequestsAll = all;

  // kompatybilnie (jeśli render.js dalej bierze stąd do logów)
  window.pointRequests = all;

  // lista „do klikania”
  window.pointRequestsActive = computeActivePointRequests(all);

  // auto-akcept po 12h / piątek 18:00 (jak ktoś ma apkę otwartą)
  if(typeof window.processAutoAcceptPointRequests === "function"){
    window.processAutoAcceptPointRequests();
  }

  renderAll();
});

// Nadpisujemy addPointRequest tak, żeby Child.js nic nie musiał wiedzieć o Firebase
(function hookAddPointRequestToFirebase(){
  const oldAdd = window.addPointRequest;

  window.addPointRequest = async function(req){
    try{
      const now = Date.now();
      const createdAt = req?.created_at ?? req?.createdAt ?? now;
      const expiresAt = req?.expires_at ?? req?.expiresAt ?? (createdAt + PR_H12);

      const childComment = (req?.child_comment || req?.childComment || "").toString().trim();

      const payload = {
        createdAt,
        expiresAt,
        status: "pending",
        points: 1,
        child_comment: childComment,
        komentarz: "",
        kto: "",
        decyzjaAt: null,
        applied: false,
        logKey: null,
        logDate: null,
        data: null,
        archived: false,
        closedAt: null,
        closedReason: ""
      };

      await db.ref(PR_PATH).push(payload);
    }catch(e){
      console.error("Błąd zapisu wniosku do Firebase:", e);
      // awaryjnie: zachowaj lokalnie, żeby nie przepadło
      try{ oldAdd?.(req); }catch(_){}
      alert("Nie udało się zapisać wniosku do bazy. Spróbuj ponownie.");
    }
  };
})();

// Auto-akcept: po 12h albo piątek 18:00 (korzyść Julka)
window.processAutoAcceptPointRequests = async function(){
  const list = Array.isArray(window.pointRequestsAll) ? window.pointRequestsAll : [];
  if(list.length === 0) return;

  const now = Date.now();
  const today = (typeof todayIso === "function") ? todayIso() : "";
  const fridayAuto = (typeof isFridayAutoAcceptTime === "function") ? isFridayAutoAcceptTime() : false;

  for(const r of list){
    if(!r || String(r.status||"") !== "pending") continue;

    const exp = Number(r.expiresAt || 0);
    const shouldAuto12h = exp && now > exp;
    const shouldAutoFriday = !!fridayAuto;

    if(!shouldAuto12h && !shouldAutoFriday) continue;

    const key = r.key;
    if(!key) continue;

    // pobierz aktualny stan (żeby nie zrobić podwójnie)
    const snap = await db.ref(PR_PATH+"/"+key).once("value");
    const cur = snap.val();
    if(!cur || String(cur.status||"") !== "pending") continue;

    const createdAt = cur.createdAt ?? cur.created_at ?? 0;
    const childComment = (cur.child_comment || "").toString().trim();

    // data do zaksięgowania punktu
    const dateIso = cur.data
      || (createdAt ? isoFromTsWarsaw(createdAt) : today);

    // jeśli już zastosowane – tylko ustaw status (bez ponownego +1)
    let applied = !!cur.applied;
    let logKey = cur.logKey || null;
    let logDate = cur.logDate || dateIso;

    if(!applied){
      await db.ref("dni/"+dateIso).transaction(v => (v || 0) + 1);

      const ref = db.ref("log/"+dateIso).push();
      await ref.set({
        h: 1,
        opis: `Wniosek Julka: ${childComment} (zaakceptowane automatycznie)`,
        rodzic: "system",
        category: "wniosek_punkt",
        ts: Date.now()
      });

      applied = true;
      logKey = ref.key;
      logDate = dateIso;
    }

    const msg = shouldAutoFriday
      ? "Do godziny 18:00 w piątek rodzic nie podjął decyzji – zaakceptowano automatycznie."
      : "Po upływie 12 godzin rodzic nie podjął decyzji – zaakceptowano automatycznie.";

    await db.ref(PR_PATH+"/"+key).update({
      status: "accepted_auto",
      kto: "auto",
      decyzjaAt: Date.now(),
      komentarz: msg,
      applied,
      logKey,
      logDate,
      data: dateIso,

      // po auto-akcepcie nie ma sensu trzymać na liście „do klikania”
      archived: true,
      closedAt: Date.now(),
      closedReason: shouldAutoFriday ? "friday_18" : "after_12h"
    });
  }
};

/* ===================================================== */
/* ========== WEEK CLOSE: ZAMKNIJ WNIOSKI + UI ========= */
/* ===================================================== */

window.closePointRequestsOnWeekClose = async function(weekKey){
  try{
    const snap = await db.ref(PR_PATH).once("value");
    if(!snap.exists()) return;

    const now = Date.now();
    const today = (typeof todayIso==="function") ? todayIso() : "";
    const wk = weekKey || (today && typeof isoWeekKeyFromIsoDate==="function"
      ? isoWeekKeyFromIsoDate(today)
      : "");

    const updates = {};
    const toApply = [];

    snap.forEach(ch=>{
      const key = ch.key;
      const cur = ch.val() || {};

      // pomiń już zamknięte/archiwalne
      if(cur.archived || cur.is_archived || cur.closedAt || cur.closed_at) return;

      const createdAt = cur.createdAt ?? cur.created_at ?? 0;
      const dateIso = cur.data
        || (createdAt ? isoFromTsWarsaw(createdAt) : today);

      // zamykamy tylko bieżący tydzień
      if(wk && dateIso && typeof isoWeekKeyFromIsoDate==="function"){
        if(isoWeekKeyFromIsoDate(dateIso) !== wk) return;
      }

      const childComment = (cur.child_comment || "").toString().trim();
      const alreadyApplied = !!cur.applied;

      if(!alreadyApplied){
        toApply.push({ key, dateIso, childComment });
      }

      // zasada Kuby: po zamknięciu tygodnia WSZYSTKO na plus dla Julka
      updates[`${key}/status`] = "accepted_auto";
      updates[`${key}/kto`] = "system_weekclose";
      updates[`${key}/decyzjaAt`] = now;
      updates[`${key}/komentarz`] = "Zamknięcie tygodnia – wniosek zaliczony na plus.";
      updates[`${key}/data`] = dateIso;

      updates[`${key}/archived`] = true;
      updates[`${key}/closedAt`] = now;
      updates[`${key}/closedReason`] = "week_close";
    });

    // najpierw księgowanie +1 (żeby było w logach)
    for(const x of toApply){
      await db.ref("dni/"+x.dateIso).transaction(v => (v || 0) + 1);

      const ref = db.ref("log/"+x.dateIso).push();
      await ref.set({
        h: 1,
        opis: `Wniosek Julka: ${x.childComment} (zamknięcie tygodnia – zaliczone)`,
        rodzic: "system",
        category: "wniosek_punkt",
        ts: Date.now()
      });

      updates[`${x.key}/applied`] = true;
      updates[`${x.key}/logKey`] = ref.key;
      updates[`${x.key}/logDate`] = x.dateIso;
    }

    if(Object.keys(updates).length){
      await db.ref(PR_PATH).update(updates);
    }
  }catch(e){
    console.error("closePointRequestsOnWeekClose error:", e);
  }
};

function refreshWeekendUiEverywhere(){
  try{ window.renderAll?.(); }catch(_){}
  // różne nazwy w zależności od wersji:
  try{ window.updateWeekendInfo?.(); }catch(_){}
  try{ window.renderWeekendInfo?.(); }catch(_){}
  try{ window.updateWeekendInfoParent?.(); }catch(_){}
  try{ window.updateWeekendInfoJulek?.(); }catch(_){}
}

/* hook: zamknijTydzien() -> najpierw zamknij wnioski, potem zamknij tydzień, potem odśwież UI */
(function hookZamknijTydzien(){
  const tryHook = ()=>{
    if(typeof window.zamknijTydzien !== "function") return false;
    if(window.zamknijTydzien._hookedPointReq) return true;

    const old = window.zamknijTydzien;
    const wrapped = async function(){
      const today = (typeof todayIso==="function") ? todayIso() : "";
      const wk = (today && typeof isoWeekKeyFromIsoDate==="function")
        ? isoWeekKeyFromIsoDate(today)
        : "";

      // 1) zamknij/zaksięguj wnioski (na plus)
      await window.closePointRequestsOnWeekClose?.(wk);

      // 2) stara logika zamknięcia tygodnia
      const res = await old.apply(this, arguments);

      // 3) komunikaty i odświeżenie (rodzic + Julek)
      refreshWeekendUiEverywhere();
      return res;
    };

    wrapped._hookedPointReq = true;
    window.zamknijTydzien = wrapped;
    return true;
  };

  if(tryHook()) return;

  const t = setInterval(()=>{
    if(tryHook()) clearInterval(t);
  }, 300);

  setTimeout(()=> clearInterval(t), 15000);
})();

/* ================== PODSUMOWANIA ================== */
db.ref("dni").on("value",s=>{
  const today = todayIso();
  const wk = isoWeekKeyFromIsoDate(today);
  const todayVal = s.child(today).val() || 0;

  let weekVal = 0;
  s.forEach(d=>{
    if(d.key && isoWeekKeyFromIsoDate(d.key) === wk) weekVal += Number(d.val()||0);
  });

  setText("todayR", todayVal); setText("todayJ", todayVal);
  setText("weekR", weekVal);  setText("weekJ", weekVal);
});

/* ================== WEEKEND: licznik + komunikaty ================== */
db.ref("weekend").on("value",s=>{
  const v = Number(s.val()||0);

  const showCounter = (typeof isWeekendCounterTime==="function") ? isWeekendCounterTime() : true;
  const showMsg = (typeof isWeekendMessageTime==="function") ? isWeekendMessageTime() : false;

  // licznik weekendowy: pt/sob/niedz widoczny, od poniedziałku znika
  const spR = document.getElementById("weekendR");
  if(spR){
    const row = spR.closest("div"); // "Weekend: ..."
    if(row) row.style.display = showCounter ? "" : "none";
  }
  const spJ = document.getElementById("weekendJ");
  if(spJ){
    const kpi = spJ.closest(".julekKpi");
    if(kpi) kpi.style.display = showCounter ? "" : "none";
  }

  if(showCounter){
    setText("weekendR", formatHours(v));
    setText("weekendJ", formatHours(v));
  }

  // komunikat weekendowy: pt po 18:00 + sob + niedz
  const boxR = document.getElementById("weekendInfoParent");
  const boxJ = document.getElementById("weekendInfoJulek");
  if(boxR) boxR.classList.toggle("hidden", !showMsg);
  if(boxJ) boxJ.classList.toggle("hidden", !showMsg);

  function msgFor(val){
    if(val > 0) return `JULEK W BIEŻĄCY WEEKEND MOŻE KORZYSTAĆ Z KOMPUTERA PRZEZ ${formatHours(val)} GODZIN.`;
    if(val < 0) return `JULEK W BIEŻĄCY WEEKEND MA DO ODPRACOWANIA NA RZECZ RODZICÓW ${formatHours(Math.abs(val))} GODZIN.`;
    return `JULEK W BIEŻĄCY WEEKEND NIE MA GODZIN DO WYKORZYSTANIA.`;
  }

  if(showMsg){
    const t = msgFor(v);
    const tR = document.getElementById("weekendInfoTextParent");
    const tJ = document.getElementById("weekendInfoTextJulek");
    if(tR) tR.innerText = t;
    if(tJ) tJ.innerText = t;

    const dLine = "Obowiązuje przez ten weekend.";
    const dR = document.getElementById("weekendInfoDateParent");
    const dJ = document.getElementById("weekendInfoDateJulek");
    if(dR) dR.innerText = dLine;
    if(dJ) dJ.innerText = dLine;
  }
});

/* ================== CACHE: LOGI ================== */
db.ref("log").on("value", s=>{
  logsCache = {};
  s && s.forEach(day=>{
    logsCache[day.key] = {};
    day.forEach(item=>{
      logsCache[day.key][item.key] = item.val();
    });
  });
  renderAll();
});

/* ================== AUTO-AKCEPT ODWOŁAŃ (deadline + piątek 18:00) ================== */
window.processAutoAcceptAppeals = async function(){
  const list = Array.isArray(window.appealsList) ? window.appealsList : [];
  if(list.length === 0) return;

  const today = (typeof todayIso==="function") ? todayIso() : "";
  const fridayAuto = (typeof isFridayAutoAcceptTime==="function") ? isFridayAutoAcceptTime() : false;

  for(const o of list){
    if(!o) continue;
    if((o.status||"") !== "pending") continue;

    const deadlineDay = o.deadlineDay || "";
    const shouldByDeadline = deadlineDay && today && (today > deadlineDay);
    const shouldByFriday = !!fridayAuto;

    if(!shouldByDeadline && !shouldByFriday) continue;

    const key = o.key;
    if(!key) continue;

    // pobierz aktualny stan (żeby nie zrobić podwójnie)
    const snap = await db.ref("odwolania/"+key).once("value");
    const cur = snap.val();
    if(!cur || (cur.status||"") !== "pending") continue;

    const dateIso = cur.data || "";
    const h = Number(cur.h || 0);

    // AUTO-UZNANIE odwołania = cofnięcie wpływu wpisu na saldo (tak jak acceptAppeal)
    if(dateIso){
      await db.ref("dni/"+dateIso).transaction(x => (x||0) - h);
    }

    const msg = shouldByFriday
      ? "Do godziny 18:00 w piątek rodzic nie podjął decyzji – odwołanie zaakceptowano automatycznie."
      : "Po terminie decyzji rodzica – odwołanie zaakceptowano automatycznie.";

    await db.ref("odwolania/"+key).update({
      status: "accepted_auto",
      kto: "auto",
      decyzjaAt: Date.now(),
      komentarz: msg
    });
  }
};

/* ================== CACHE: ODWOŁANIA ================== */
db.ref("odwolania").on("value", s=>{
  appealsByLog = {};
  appealsList = [];

  s && s.forEach(ch=>{
    const o = ch.val(); if(!o) return;
    const date = o.data || "";
    const logId = o.logId || "";
    if(!date || !logId) return;

    const idx = `${date}|${logId}`;
    const prev = appealsByLog[idx];

    if(!prev || (o.createdAt||0) > (prev.createdAt||0)){
      appealsByLog[idx] = {...o, key: ch.key};
    }
    appealsList.push({...o, key: ch.key});
  });

  appealsList.sort((a,b)=>{
    const ap = a.status==="pending", bp = b.status==="pending";
    if(ap!==bp) return ap?-1:1;
    return (b.decyzjaAt||b.createdAt||0) - (a.decyzjaAt||a.createdAt||0);
  });

  // auto-akcept odwołań (deadline + piątek 18:00)
  window.processAutoAcceptAppeals?.();

  updateAppealsButton();
  renderAll();
});

/* ================== PRZYCISK ODWOŁAŃ ================== */
function updateAppealsButton(){
  const btn = document.getElementById("btnAppeals");
  const badge = document.getElementById("appealsBadge");
  if(!btn || !badge) return;

  const pending = (appealsList||[]).filter(a=>(a.status||"")==="pending").length;
  badge.innerText = String(pending);

  btn.classList.toggle("btnRed", pending>0);
  btn.classList.toggle("btnGreen", pending===0);
}

/* ================== HOOKI DLA AUTH ================== */
window.onAfterLogin = function(){
  renderAll();

  // przelicz aktywne po zalogowaniu (bo zależy od window.rodzic)
  window.pointRequestsActive = computeActivePointRequests(window.pointRequestsAll);

  window.processAutoAcceptAppeals?.();
  window.processAutoAcceptPointRequests?.();
};

/* ================== TIMER (żeby 18:00 zadziałało przy otwartej apce) ================== */
setInterval(()=>{
  try{
    window.processAutoAcceptAppeals?.();
    window.processAutoAcceptPointRequests?.();

    // odśwież aktywne (w razie zmiany rodzica / upływu czasu)
    window.pointRequestsActive = computeActivePointRequests(window.pointRequestsAll);
  }catch(e){
    console.error(e);
  }
}, 60 * 1000);

/* ================== INIT ADMIN PUBLIC (LOGIN) ================== */
window.addEventListener("load", function(){
  if(typeof window.initAdminPublicNotes === "function"){
    window.initAdminPublicNotes();
  }
});
