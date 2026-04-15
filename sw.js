// ./js/admin.js
// Logika panelu ADMINA (panel + narzędzia administracyjne)

(function(){
  "use strict";

  const mustDb = () => {
    if(!window.db) throw new Error("Brak window.db (Firebase). Sprawdź kolejność ładowania skryptów.");
    return window.db;
  };

  const getNotesRef = () => mustDb().ref("meta/adminNotes");

  /* ================== HELPERS ================== */
  function normStatus(st){
    return (st || "").toString().trim().toLowerCase();
  }

  function getBusinessWeekKeyNowSafe(){
    if(typeof window.businessWeekKeyNow === "function") return window.businessWeekKeyNow();
    return "";
  }

  function getBusinessWeekKeyFromTsSafe(ts){
    if(typeof window.businessWeekKeyFromTs === "function") return window.businessWeekKeyFromTs(ts);
    return "";
  }

  function getBusinessWeekKeyFromIsoDateSafe(isoDate){
    if(typeof window.businessWeekKeyFromIsoDate === "function") return window.businessWeekKeyFromIsoDate(isoDate);
    return "";
  }

  function isSameBusinessWeek(dateIso, ts, weekKey){
    if(!weekKey) return true;
    if(ts) return getBusinessWeekKeyFromTsSafe(ts) === weekKey;
    if(dateIso) return getBusinessWeekKeyFromIsoDateSafe(dateIso) === weekKey;
    return false;
  }

  /* ================== RĘCZNA KOREKTA GODZIN (UI + zapis) ================== */
  let adminAdjVal = 0;

  function fmtHours(v){
    const n = Number(v || 0);
    const sign = n > 0 ? "+" : "";
    return `${sign}${n} h`;
  }

  function renderAdminAdj(){
    const el = document.getElementById("adminAdjValue");
    if(!el) return;
    el.textContent = fmtHours(adminAdjVal);
  }

  async function commitAdminAdj(){
    if(window.rodzic !== "Kuba") return alert("Tylko Kuba może robić korekty.");
    if(!adminAdjVal) return alert("Ustaw najpierw liczbę godzin (+/−).");

    if(typeof window.zapis !== "function"){
      alert("Brak funkcji zapisu (window.zapis). Sprawdź czy parent.js ładuje się przed admin.js.");
      return;
    }

    const comment = prompt("Uzasadnienie korekty (min. 3 znaki):", "Korekta administracyjna");
    if(comment === null) return;
    if(!comment.trim() || comment.trim().length < 3){
      alert("Komentarz za krótki.");
      return;
    }

    const h = adminAdjVal;
    const opis = `Korekta admin: ${comment.trim()}`;
    const category = "admin_adjust";

    try{
      await window.zapis(h, opis, category, false);

      adminAdjVal = 0;
      renderAdminAdj();
      alert("Korekta zapisana.");
    }catch(e){
      console.error(e);
      alert("Błąd zapisu korekty. Zobacz konsolę.");
    }
  }

  window.initAdminAdjustUI = function(){
    const minusBtn = document.getElementById("adminAdjMinus");
    const plusBtn  = document.getElementById("adminAdjPlus");
    const okBtn    = document.getElementById("adminAdjConfirm");
    const valBox   = document.getElementById("adminAdjValue");

    if(!minusBtn || !plusBtn || !okBtn || !valBox) return;

    if(valBox.dataset.bound === "1") return;
    valBox.dataset.bound = "1";

    minusBtn.addEventListener("click", () => {
      adminAdjVal -= 1;
      renderAdminAdj();
    });

    plusBtn.addEventListener("click", () => {
      adminAdjVal += 1;
      renderAdminAdj();
    });

    okBtn.addEventListener("click", commitAdminAdj);

    renderAdminAdj();
  };

  /* ================== INIT ================== */
  window.initAdminPanel = function(){
    if(window.rodzic === "Kuba"){
      if(typeof window.renderAdminNotes === "function"){
        window.renderAdminNotes();
      }
      window.initAdminAdjustUI();
    }
  };

  /* ================== NOTATKI ADMINA (PANEL) ================== */
  window.renderAdminNotes = function(){
    const box = document.getElementById("adminNotesAdmin");
    if(!box) return;

    const notesRef = getNotesRef();

    notesRef.once("value", snap=>{
      box.innerHTML = "";

      if(!snap.exists()){
        box.innerHTML = "<div class='muted'>Brak notatek.</div>";
        return;
      }

      snap.forEach(ch=>{
        const v = ch.val() || {};
        const wrap = document.createElement("div");
        wrap.className = "box";

        wrap.innerHTML = `
          <div>${(typeof window.escapeHtml==="function" ? window.escapeHtml(v.text || "") : (v.text || ""))}</div>
          <div class="muted">Dodano: ${(typeof window.tsToWarsaw==="function" ? window.tsToWarsaw(v.ts) : "")}</div>
        `;

        const btn = document.createElement("button");
        btn.className = "btnRed smallbtn";
        btn.innerText = "Usuń";
        btn.onclick = () =>
          notesRef.child(ch.key).remove().then(window.renderAdminNotes);

        wrap.appendChild(btn);
        box.appendChild(wrap);
      });
    });
  };

  window.addAdminNote = function(){
    if(window.rodzic !== "Kuba"){
      alert("Tylko Kuba może dodawać notatki.");
      return;
    }

    const ta = document.getElementById("adminNoteInput");
    if(!ta || !ta.value.trim()){
      alert("Treść jest pusta.");
      return;
    }

    const notesRef = getNotesRef();

    notesRef.push({
      text: ta.value.trim(),
      ts: Date.now(),
      by: window.rodzic
    });

    ta.value = "";
    window.renderAdminNotes();
  };

  /* ================== ZAPISZ I ZAMKNIJ ADMINA ================== */
  window.saveAndCloseAdmin = function(){
    const sec = document.getElementById("secAdmin");
    if(sec) sec.classList.add("hidden");

    const ta = document.getElementById("adminNoteInput");
    if(ta) ta.value = "";

    adminAdjVal = 0;
    renderAdminAdj();

    if(typeof window.clearAdminAuth === "function"){
      window.clearAdminAuth();
    }

    alert("Zmiany administracyjne zapisane. Panel zamknięty.");
  };

  /* ================== NOTATKI ADMINA – PUBLIC (LOGIN) ================== */
  window.initAdminPublicNotes = function(){
    const notesRef = getNotesRef();

    notesRef.on("value", snap=>{
      const box = document.getElementById("adminNotesPublic");
      if(!box) return;

      box.innerHTML = "";
      if(!snap.exists()){
        box.innerText = "Brak aktualnych notatek.";
        return;
      }

      snap.forEach(ch=>{
        const v = ch.val() || {};
        const div = document.createElement("div");
        div.className = "box";
        div.innerHTML = `
          <div>${(typeof window.escapeHtml==="function" ? window.escapeHtml(v.text || "") : (v.text || ""))}</div>
          <div class="muted">Dodano: ${(typeof window.tsToWarsaw==="function" ? window.tsToWarsaw(v.ts) : "")}</div>
        `;
        box.appendChild(div);
      });
    });
  };

  /* ===================================================== */
  /* ============ ZAMYKANIE „WISZĄCYCH” ODWOŁAŃ ============ */
  /* ===================================================== */
  async function closePendingAppealsOnWeekClose(db, weekKey){
    const snap = await db.ref("odwolania").once("value");
    if(!snap.exists()) return;

    const now = Date.now();
    const jobs = [];

    snap.forEach(ch=>{
      const o = ch.val() || {};
      if(normStatus(o.status) !== "pending") return;

      const dateIso = (o.data || "").toString();
      const ts = Number(o.createdAt || 0);

      if(!isSameBusinessWeek(dateIso, ts, weekKey)) return;

      jobs.push({
        key: ch.key,
        dateIso,
        h: Number(o.h || 0)
      });
    });

    for(const j of jobs){
      const cur = (await db.ref("odwolania/"+j.key).once("value")).val();
      if(!cur || normStatus(cur.status) !== "pending") continue;

      if(j.dateIso){
        await db.ref("dni/"+j.dateIso).transaction(x => (x||0) - j.h);
      }

      await db.ref("odwolania/"+j.key).update({
        status: "accepted_auto",
        kto: "system_weekclose",
        decyzjaAt: now,
        komentarz: "Zamknięcie tygodnia – odwołanie zaliczone na plus."
      });
    }
  }

  /* ================== ZAMKNIĘCIE TYGODNIA (LOCK) ================== */
  async function acquireCloseLock(db){
    const lockRef = db.ref("meta/closeLock");
    const now = Date.now();
    const res = await lockRef.transaction(v=>{
      if(v && v.at && (now - v.at) < 2*60*1000) return;
      return { at: now };
    });
    return !!(res && res.committed);
  }

  async function releaseCloseLock(db){
    try{ await db.ref("meta/closeLock").remove(); }catch(_){}
  }

  async function rebuildDniFromLogsSnapshot(db, logSnap){
    const map = {};

    if(logSnap.exists()){
      logSnap.forEach(day=>{
        const date = day.key;
        let sum = 0;

        day.forEach(item=>{
          const v = item.val() || {};
          sum += Number(v.h || 0);
        });

        if(sum !== 0){
          map[date] = sum;
        }
      });
    }

    await db.ref("dni").set(map);
  }

  async function closeWeek(db, weekKey, reason){
    const got = await acquireCloseLock(db);
    if(!got) return alert("Ktoś właśnie zamyka tydzień. Spróbuj za chwilę.");

    try{
      const logSnap = await db.ref("log").once("value");

      let sum = 0;
      const toDelete = [];

      if(logSnap.exists()){
        logSnap.forEach(day=>{
          const date = day.key;

          day.forEach(item=>{
            const v = item.val() || {};
            const ts = Number(v.ts || 0);

            if(isSameBusinessWeek(date, ts, weekKey)){
              sum += Number(v.h || 0);
              toDelete.push({ date, key: item.key });
            }
          });
        });
      }

      await db.ref("weekend").set(sum);

      for(const row of toDelete){
        await db.ref(`log/${row.date}/${row.key}`).remove();
      }

      const logSnapAfter = await db.ref("log").once("value");
      if(logSnapAfter.exists()){
        for(const date of Object.keys(logSnapAfter.val() || {})){
          const one = await db.ref(`log/${date}`).once("value");
          if(!one.exists()){
            await db.ref(`log/${date}`).remove().catch(()=>{});
          }
        }
      }

      const logSnapRemain = await db.ref("log").once("value");
      await rebuildDniFromLogsSnapshot(db, logSnapRemain);

      await db.ref("meta/lastCloseWeekKey").set(weekKey || "");
      await db.ref("meta/lastCloseReason").set(reason || "");
      await db.ref("meta/lastCloseAt").set(Date.now());

    } finally {
      await releaseCloseLock(db);
    }
  }

  /* ================== ZAMKNIĘCIE TYGODNIA (PRZYCISK) ================== */
  window.zamknijTydzien = async function(){
    if(window.rodzic !== "Kuba") return alert("Tylko Kuba może zamknąć tydzień.");
    if(!confirm("Zamknąć tydzień? To przepisze wynik na 'Weekend' i zamknie tylko bieżący tydzień rozliczeniowy.")) return;

    const wk = getBusinessWeekKeyNowSafe();
    const db = mustDb();

    try{
      await window.closePointRequestsOnWeekClose?.(wk);
    }catch(e){
      console.error("closePointRequestsOnWeekClose error:", e);
    }

    try{
      await closePendingAppealsOnWeekClose(db, wk);
    }catch(e){
      console.error("closePendingAppealsOnWeekClose error:", e);
    }

    await closeWeek(db, wk, "manual");
    alert("Tydzień zamknięty.");
  };

  /* ================== RESET (PRZYCISK) ================== */
  window.resetAllDataFromAdmin = async function(){
    if(window.rodzic !== "Kuba") return;

    if(!confirm("RESET: wyczyści CAŁĄ bazę. Na pewno?")) return;

    const askPin = (typeof window.askPinMasked === "function")
      ? window.askPinMasked
      : async (t)=>prompt(t);

    const expected = (typeof window.expectedPinForRodzic === "function")
      ? window.expectedPinForRodzic()
      : "6978";

    const pin = await askPin("PIN (RESET wszystkich danych):");
    if(pin === null) return;
    if(String(pin) !== String(expected)) return alert("Zły PIN. Reset anulowany.");

    const db = mustDb();
    await db.ref("dni").remove();
    await db.ref("log").remove();
    await db.ref("odwolania").remove();
    await db.ref("weekend").remove();
    await db.ref("meta").remove();

    await db.ref("wnioski_punkty").remove().catch(()=>{});
    await db.ref("wnioski_punkty_fplock").remove().catch(()=>{});

    alert("Wyczyszczone. Odświeżam aplikację.");
    location.reload();
  };

  setTimeout(()=>{ try{ window.initAdminAdjustUI(); }catch(e){} }, 0);

})();