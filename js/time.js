// ./js/time.js
// CZAS – Europe/Warsaw
// TYLKO logika dat i tygodni
// ZGODNE z istniejącymi danymi w Firebase

/* ================== DZISIAJ ================== */
// ZAWSZE YYYY-MM-DD (zgodne z dotychczasową bazą)
function todayIso(){
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Europe/Warsaw"
  });
}

/* ================== PRZESUWANIE DAT ================== */
// używamy południa UTC → brak problemów DST
function isoDateShift(baseIso, days){
  const dt = new Date(`${baseIso}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0,10);
}

/* ================== DEADLINE ODWOŁAŃ ================== */
// do końca NASTĘPNEGO dnia
function endOfNextDayDeadlineDay(){
  return isoDateShift(todayIso(), 1);
}

/* ================== TYDZIEŃ ISO ================== */
// pełna i poprawna implementacja ISO-8601
function isoWeekKeyFromIsoDate(isoDate){
  const base = new Date(`${isoDate}T12:00:00Z`);
  const t = new Date(Date.UTC(
    base.getUTCFullYear(),
    base.getUTCMonth(),
    base.getUTCDate()
  ));

  const dayNum = t.getUTCDay() || 7; // pon=1 … niedz=7
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);

  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    (((t - yearStart) / 86400000) + 1) / 7
  );

  return `${t.getUTCFullYear()}-W${String(weekNo).padStart(2,"0")}`;
}

/* ================== TYDZIEŃ BIEŻĄCY ================== */
function isoWeekKeyWarsaw(){
  return isoWeekKeyFromIsoDate(todayIso());
}

/* ===================================================== */
/* =============== NOWA LOGIKA PIĄTKOWA ================= */
/* ===================================================== */

// aktualny czas w Warszawie (bez DST-krzaków)
function nowWarsaw(){
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Warsaw" })
  );
}

// czy dziś piątek
function isFriday(){
  return nowWarsaw().getDay() === 5; // 0=niedz, 5=pt
}

// piątek – komunikat informacyjny od 12:00
function isFridayWarningTime(){
  if(!isFriday()) return false;
  const h = nowWarsaw().getHours();
  return h >= 12;
}

// piątek – BLOKADA 17:30–18:05 (po 18:05 ma już działać)
function isFridayBlocked(){
  if(!isFriday()) return false;

  const now = nowWarsaw();
  const mins = now.getHours() * 60 + now.getMinutes();

  const blockStart = 17 * 60 + 30; // 17:30
  const blockEndExcl = 18 * 60 + 5; // 18:05 (WYŁĄCZNIE)

  return mins >= blockStart && mins < blockEndExcl;
}

// piątek – moment automatycznego rozliczenia (od 18:00)
function isFridayAutoAcceptTime(){
  if(!isFriday()) return false;

  const now = nowWarsaw();
  const mins = now.getHours() * 60 + now.getMinutes();

  return mins >= (18 * 60);
}

// czy weekend (pt 18:00 → nd 23:59)
function isWeekend(){
  const now = nowWarsaw();
  const day = now.getDay(); // 0=niedz

  if(day === 6 || day === 0) return true; // sob, niedz

  if(day === 5){ // piątek
    const mins = now.getHours() * 60 + now.getMinutes();
    return mins >= (18 * 60);
  }

  return false;
}

// poniedziałek
function isMonday(){
  return nowWarsaw().getDay() === 1;
}

// pomocnicze: czy to czas, kiedy MA BYĆ widoczny licznik weekendowy (pt/sob/nd)
function isWeekendCounterTime(){
  const d = nowWarsaw().getDay();
  return (d === 5 || d === 6 || d === 0); // pt/sob/niedz
}

// pomocnicze: czy to czas, kiedy MA BYĆ wyświetlany komunikat weekendowy
function isWeekendMessageTime(){
  return isWeekend(); // pt po 18:00 + sob + niedz
}
