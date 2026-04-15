// ./js/child.js
// Logika panelu JULKA

(function(){

  function showFridayInfoOnEveryEntry(){
    if(typeof isFridayWarningTime !== "function") return;
    if(!isFridayWarningTime()) return;

    alert(
      "UWAGA!\n\n" +
      "DZIŚ DODAWANIE PUNKTÓW I ODWOŁAŃ MOŻLIWE JEST TYLKO DO GODZINY 17:30.\n\n" +
      "OD 17:30 DO 18:05 TRWA ZLICZANIE PUNKTÓW.\n" +
      "PO 18:05 DODAWANIE DOTYCZY JUŻ NOWEGO TYGODNIA."
    );
  }

  function checkFridayBlocked(msg){
    if(typeof isFridayBlocked !== "function") return false;
    if(!isFridayBlocked()) return false;

    alert(
      "TRWA ZLICZANIE PUNKTÓW TYGODNIA (17:30–18:05).\n\n" +
      (msg || "SPRÓBUJ PONOWNIE PO GODZINIE 18:05.")
    );
    return true;
  }

  function isTodayCalendarDate(dateIso){
    return dateIso === todayIso();
  }

  /* ================== INIT PANELU JULKA ================== */
  window.initChildPanel = function(){
    window.renderJulekLogs?.();

    // jeśli kiedyś dodasz osobną ramkę wniosków Julka, to hook zostaje
    window.renderJulekPointRequests?.();

    showFridayInfoOnEveryEntry();
  };

  /* ================== WNIOSEK O +1 PUNKT (JULEK) ================== */
  window.wniosekOPunkt = async function(){

    // blokada piątkowa 17:30–18:05
    if(checkFridayBlocked()) return;

    const txt =
      "Za jaki wykonany obowiązek chcesz zawnioskować o 1 punkt?\n\n" +
      "Przykłady:\n" +
      "- zmywarka rano\n" +
      "- śmieci po południu\n" +
      "- karmienie świnki rano\n" +
      "- obowiązki dodatkowe zadane przez rodziców\n\n" +
      "Wpisz krótki komentarz (min. 5 znaków):";

    const comment = prompt(txt);

    if(!comment || comment.trim().length < 5){
      alert("Musisz wpisać komentarz (minimum 5 znaków). Punkt nie został zapisany.");
      return;
    }

    const req = createPointRequest(comment.trim());

    try{
      await addPointRequest(req);
    }catch(e){
      console.error(e);
      alert("Nie udało się zapisać wniosku. Spróbuj ponownie.");
      return;
    }

    alert("Wniosek o 1 punkt został zapisany i czeka na decyzję rodzica.");

    window.renderJulekPointRequests?.();
  };

  /* ================== ODWOŁANIE (JULEK) ================== */
  window.odwolanie = async function(date, logId, v){

    // blokada piątkowa także dla odwołań
    if(checkFridayBlocked("ODWOŁANIA BĘDZIE MOŻNA DODAĆ PO GODZINIE 18:05.")) return;

    // odwołanie tylko od wpisu z dzisiaj kalendarzowo
    if(!isTodayCalendarDate(date)){
      alert("Odwołanie tylko w dniu przyznania punktów.");
      return;
    }

    if(Number(v?.h || 0) >= 0){
      alert("Od dodatnich punktów nie ma sensu się odwoływać.");
      return;
    }

    if(appealsByLog[`${date}|${logId}`]){
      alert("Odwołanie już jest złożone (tylko raz).");
      return;
    }

    const why = prompt("Dlaczego się nie zgadzasz? (min. 20 znaków)");
    if(!why || why.trim().length < 20){
      alert("Za krótko. Minimum 20 znaków.");
      return;
    }

    await db.ref("odwolania").push({
      data: date,
      logId: logId,
      h: Number(v.h || 0),
      opis: v.opis || "",
      powod: why.trim(),
      status: "pending",
      createdAt: Date.now(),
      deadlineDay: endOfNextDayDeadlineDay(),
      autorRodzic: v.rodzic || ""
    });

    alert("Odwołanie zapisane.");
  };

})();