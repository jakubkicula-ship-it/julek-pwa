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

  // Przycisk ponawia zaległe rozliczenia, nie zamyka nowego tygodnia.
  window.zamknijTydzien = async function(){
    if(window.rodzic !== "Kuba") return alert("Tylko Kuba może ponowić rozliczenie.");
    try {
      const changed = await window.runDueWeekSettlements("manual_retry");
      alert(changed ? "Rozliczono zakończone tygodnie." : "Wszystkie zakończone tygodnie są już rozliczone.");
    } catch(error) {
      console.error(error);
      alert("Rozliczenie nie zostało zapisane. Sprawdź połączenie i uprawnienia bazy.");
    }
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
