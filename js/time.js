// ./js/time.js
// CZAS – Europe/Warsaw
// Fundament pod tydzień rozliczeniowy:
// PIĄTEK 18:00 → start nowego tygodnia
// PIĄTEK 17:59 → koniec starego tygodnia

/* ================== PODSTAWY ================== */

// zwykła data kalendarzowa YYYY-MM-DD (Warszawa)
function todayIso(){
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Europe/Warsaw"
  });
}

// aktualny czas w Warszawie
function nowWarsaw(){
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Warsaw" })
  );
}

// start dnia w Warszawie dla podanej daty JS
function startOfWarsawDay(d){
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  return new Date(y, m, day, 0, 0, 0, 0);
}

// koniec dnia w Warszawie dla podanej daty JS
function endOfWarsawDay(d){
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  return new Date(y, m, day, 23, 59, 59, 999);
}

// piątek 18:00 dla dnia zawartego w d
function friday1800OfWeekContaining(d){
  const x = new Date(d.getTime());
  const day = x.getDay(); // 0=niedz ... 5=piątek
  const diffToFriday = 5 - day;

  x.setDate(x.getDate() + diffToFriday);
  x.setHours(18, 0, 0, 0);
  return x;
}

/* ================== PRZESUWANIE DAT ================== */

// używamy południa UTC → brak problemów DST
function isoDateShift(baseIso, days){
  const dt = new Date(`${baseIso}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/* ================== DEADLINE ODWOŁAŃ ================== */

// do końca NASTĘPNEGO dnia kalendarzowego
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
  const weekNo = Math.ceil((((t - yearStart) / 86400000) + 1) / 7);

  return `${t.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// zwykły tydzień ISO dla dziś
function isoWeekKeyWarsaw(){
  return isoWeekKeyFromIsoDate(todayIso());
}

/* ===================================================== */
/* ========== TYDZIEŃ ROZLICZENIOWY: PT 18:00 =========== */
/* ===================================================== */

// klucz tygodnia rozliczeniowego dla konkretnego timestampu / daty
function businessWeekKeyFromDate(dateObj){
  if(!(dateObj instanceof Date) || isNaN(dateObj.getTime())) return "";

  const d = new Date(dateObj.getTime());
  const fridayCut = friday1800OfWeekContaining(d);

  // do piątku 17:59:59 -> stary tydzień
  // od piątku 18:00 -> nowy tydzień
  if(d < fridayCut){
    d.setDate(d.getDate() - 7);
  }

  // tydzień oznaczamy piątkiem, który OTWIERA dany tydzień rozliczeniowy
  const openFriday = friday1800OfWeekContaining(d);

  const y = openFriday.getFullYear();
  const m = String(openFriday.getMonth() + 1).padStart(2, "0");
  const day = String(openFriday.getDate()).padStart(2, "0");

  return `${y}-BW-${m}-${day}`;
}

function businessWeekKeyNow(){
  return businessWeekKeyFromDate(nowWarsaw());
}

function businessWeekKeyFromTs(ts){
  return businessWeekKeyFromDate(new Date(Number(ts || 0)));
}

// dla starych miejsc, gdzie masz tylko YYYY-MM-DD i brak godziny:
// bierzemy środek dnia. To jest poprawne dla sob/nd/pon-czw.
// Dla samego piątku bez godziny nie odróżni 17:00 od 19:00,
// więc tam lepiej zawsze używać timestampu.
function businessWeekKeyFromIsoDate(isoDate){
  if(!isoDate) return "";
  return businessWeekKeyFromDate(new Date(`${isoDate}T12:00:00`));
}

// start bieżącego tygodnia rozliczeniowego: piątek 18:00
function currentBusinessWeekStart(){
  const now = nowWarsaw();
  const cut = friday1800OfWeekContaining(now);

  if(now >= cut) return cut;

  const prev = new Date(cut.getTime());
  prev.setDate(prev.getDate() - 7);
  return prev;
}

// koniec bieżącego tygodnia rozliczeniowego: następny piątek 17:59:59.999
function currentBusinessWeekEnd(){
  const start = currentBusinessWeekStart();
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + 7);
  end.setMilliseconds(end.getMilliseconds() - 1);
  return end;
}

// start bieżącego "dnia rozliczeniowego"
// tylko w piątek po 18:00 resetujemy licznik "dziś"
function currentBusinessDayStart(){
  const now = nowWarsaw();

  if(now.getDay() === 5){ // piątek
    const cut = new Date(now.getTime());
    cut.setHours(18, 0, 0, 0);

    if(now >= cut){
      return cut;
    }
  }

  return startOfWarsawDay(now);
}

function currentBusinessDayEnd(){
  const start = currentBusinessDayStart();
  const now = nowWarsaw();

  if(now.getDay() === 5){
    const friCut = new Date(now.getTime());
    friCut.setHours(18, 0, 0, 0);

    if(now >= friCut){
      const end = new Date(friCut.getTime());
      end.setHours(23, 59, 59, 999);
      return end;
    }
  }

  return endOfWarsawDay(now);
}

function isTsInCurrentBusinessDay(ts){
  const n = Number(ts || 0);
  if(!n) return false;

  const start = currentBusinessDayStart().getTime();
  const end = currentBusinessDayEnd().getTime();
  return n >= start && n <= end;
}

function isTsInCurrentBusinessWeek(ts){
  const n = Number(ts || 0);
  if(!n) return false;

  const start = currentBusinessWeekStart().getTime();
  const end = currentBusinessWeekEnd().getTime();
  return n >= start && n <= end;
}

/* ===================================================== */
/* =============== LOGIKA PIĄTKOWA / WEEKEND ============ */
/* ===================================================== */

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

// piątek – BLOKADA 17:30–18:05
function isFridayBlocked(){
  if(!isFriday()) return false;

  const now = nowWarsaw();
  const mins = now.getHours() * 60 + now.getMinutes();

  const blockStart = 17 * 60 + 30; // 17:30
  const blockEndExcl = 18 * 60 + 5; // 18:05

  return mins >= blockStart && mins < blockEndExcl;
}

// piątek – moment automatycznego rozliczenia (od 18:00)
function isFridayAutoAcceptTime(){
  if(!isFriday()) return false;

  const now = nowWarsaw();
  const mins = now.getHours() * 60 + now.getMinutes();

  return mins >= (18 * 60);
}

// weekend komunikatowy: pt 18:00 → nd 23:59
function isWeekend(){
  const now = nowWarsaw();
  const day = now.getDay();

  if(day === 6 || day === 0) return true; // sob, niedz

  if(day === 5){
    const mins = now.getHours() * 60 + now.getMinutes();
    return mins >= (18 * 60);
  }

  return false;
}

function isMonday(){
  return nowWarsaw().getDay() === 1;
}

// licznik "Weekend" ma być widoczny tylko w pt/sob/nd
function isWeekendCounterTime(){
  const d = nowWarsaw().getDay();
  return (d === 5 || d === 6 || d === 0);
}

// komunikat weekendowy tylko od piątku 18:00 do końca niedzieli
function isWeekendMessageTime(){
  return isWeekend();
}