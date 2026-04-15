// ./js/app.js

/* ================== ZABEZPIECZENIA GLOBALI ================== */
window.logsCache = window.logsCache || {};
window.appealsByLog = window.appealsByLog || {};
window.appealsList = window.appealsList || [];
window.showWholeWeekLogs = window.showWholeWeekLogs || false;

// WNIOSKI O PUNKTY (global):
// - pointRequestsAll: pełna historia (do logów)
// - pointRequestsActive: tylko aktywne (do listy w menu rodzica)
// - pointRequests: kompatybilnie
window.pointRequestsAll = window.pointRequestsAll || [];
window.pointRequestsActive = window.pointRequestsActive || [];
window.pointRequests = window.pointRequests || [];

if (typeof window.rodzic === "undefined") window.rodzic = "";
if (typeof window.askPinMasked !== "function") {
  window.askPinMasked = async (title) => {
    const v = prompt(title || "PIN:");
    return (v === null) ? null : String(v);
  };
}

/* ================== HELPERS ================== */
function escapeHtml(str) {
  return (str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.innerText = String(val);
}
function dateHeader(date) {
  if (typeof window.dateWithDowPl === "function") return window.dateWithDowPl(date);
  return date;
}
function toggleWeekLogs() {
  showWholeWeekLogs = !showWholeWeekLogs;
  renderAll();
}
function tsToWarsaw(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" });
}
function formatHours(val) {
  const n = Number(val || 0);
  if (Number.isFinite(n) && Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
  return String(n).replace(".", ",");
}
function normStatus(st) {
  return (st || "").toString().trim().toLowerCase();
}
function normText(s) {
  return (s || "").toString().trim().replace(/\s+/g, " ");
}
function sortedDates(obj) {
  return Object.keys(obj || {}).sort();
}

/* ================== WERSJA ================== */
const APP_VERSION = "2.0.5";
(() => {
  const v = document.getElementById("appVer");
  if (v) v.innerText = "v" + APP_VERSION;
})();

/* ================== FIREBASE ================== */
(function initFirebaseOnce() {
  const cfg = {
    apiKey: "AIzaSyD5asqQ2YEr_7LB9ysmyP_tZBj515-NW1o",
    authDomain: "julek-punkty.firebaseapp.com",
    databaseURL: "https://julek-punkty-default-rtdb.europe-west1.firebasedatabase.app"
  };
  if (!firebase.apps || firebase.apps.length === 0) {
    firebase.initializeApp(cfg);
  }
  window.db = firebase.database();
})();
const db = window.db;

/* ================== PDF ================== */
function openPdf(file) {
  const w = window.open(file, "_blank");
  if (!w) location.href = file;
}

/* ================== MENU ================== */
function toggleAppeals() {
  const sec = document.getElementById("secAppeals");
  if (!sec) return;

  const willShow = sec.classList.contains("hidden");
  sec.classList.toggle("hidden");

  if (willShow) {
    if (typeof window.renderParentAppeals === "function") window.renderParentAppeals();
    if (typeof window.updateAppealsButton === "function") window.updateAppealsButton();
  }
}

/* ===================================================== */
/* ============ META: LAST CLOSE (manual/auto) =========== */
/* ===================================================== */

window._lastCloseAt = window._lastCloseAt || 0;
window._lastCloseWeekKey = window._lastCloseWeekKey || "";
window._lastCloseReason = window._lastCloseReason || "";

db.ref("meta/lastCloseAt").on("value", s => {
  window._lastCloseAt = Number(s.val() || 0);
  try { renderAll?.(); } catch (_) {}
});
db.ref("meta/lastCloseWeekKey").on("value", s => {
  window._lastCloseWeekKey = (s.val() || "").toString();
  try { renderAll?.(); } catch (_) {}
});
db.ref("meta/lastCloseReason").on("value", s => {
  window._lastCloseReason = (s.val() || "").toString();
  try { renderAll?.(); } catch (_) {}
});

/* ===================================================== */
/* ======= WYLICZANIE “DO KOŃCA NIEDZIELI” (ISO) ========= */
/* ===================================================== */

function _parseWeekKey(weekKey) {
  const m = String(weekKey || "").match(/^(\d{4})-W(\d{2})$/);
  if (!m) return null;
  return { year: Number(m[1]), week: Number(m[2]) };
}

function _isoWeekMondayDateIso(weekKey) {
  const p = _parseWeekKey(weekKey);
  if (!p) return null;

  const jan4 = new Date(Date.UTC(p.year, 0, 4, 12, 0, 0));
  const jan4Day = jan4.getUTCDay() || 7;
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));

  const monday = new Date(mondayWeek1);
  monday.setUTCDate(mondayWeek1.getUTCDate() + (p.week - 1) * 7);
  return monday.toISOString().slice(0, 10);
}

function _isoShift(iso, days) {
  if (typeof isoDateShift === "function") return isoDateShift(iso, days);
  const dt = new Date(`${iso}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function _endOfSundayWarsawTs(weekKey) {
  const monIso = _isoWeekMondayDateIso(weekKey);
  if (!monIso) return 0;
  const sunIso = _isoShift(monIso, 6);

  const d = new Date(
    new Date(`${sunIso}T23:59:59`).toLocaleString("en-US", { timeZone: "Europe/Warsaw" })
  );
  return d.getTime();
}

function shouldShowWeekendMessageNow() {
  const at = Number(window._lastCloseAt || 0);
  const wk = (window._lastCloseWeekKey || "").toString();
  if (!at || !wk) return false;

  const now = Date.now();
  if (now < at) return false;

  const endSun = _endOfSundayWarsawTs(wk);
  if (!endSun) return false;

  return now <= endSun;
}

/* ===================================================== */
/* ============ WNIOSKI O PUNKTY – FIREBASE ============== */
/* ===================================================== */

const PR_PATH = "wnioski_punkty";
const PR_H12 = 12 * 60 * 60 * 1000;
const PR_FPLOCK_PATH = "wnioski_punkty_fplock";

function isoFromTsWarsaw(ts) {
  return new Date(ts).toLocaleDateString("en-CA", { timeZone: "Europe/Warsaw" });
}
function getTodayIso() {
  return (typeof todayIso === "function") ? todayIso() : isoFromTsWarsaw(Date.now());
}
function makeFingerprint(dateIso, childComment) {
  return `${dateIso}|${normText(childComment).toLowerCase()}`;
}

function djb2Hash(str) {
  let h = 5381;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) + s.charCodeAt(i);
    h = h >>> 0;
  }
  return h.toString(36);
}
function fpLockRef(dateIso, fp) {
  const day = dateIso || getTodayIso();
  const key = djb2Hash(fp || "");
  return db.ref(`${PR_FPLOCK_PATH}/${day}/${key}`);
}

function normalizePointRequest(val, key) {
  const o = val || {};
  const createdAt = o.createdAt ?? o.created_at ?? 0;
  const expiresAt = o.expiresAt ?? o.expires_at ?? (createdAt ? (createdAt + PR_H12) : 0);

  const child_comment = (o.child_comment || o.childComment || o.komentarzDziecka || o.child_commentary || "").toString();
  const data = o.data || (createdAt ? isoFromTsWarsaw(createdAt) : null);
  const fingerprint = o.fingerprint || (data ? makeFingerprint(data, child_comment) : "");

  return {
    ...o,
    key,
    id: o.id || key,

    createdAt,
    expiresAt,

    status: o.status || "pending",
    points: Number(o.points || 1),

    child_comment,
    komentarz: (o.komentarz || o.parent_comment || o.parentComment || o.komentarzRodzica || "").toString(),

    kto: (o.kto || o.decided_by || "").toString(),
    decyzjaAt: o.decyzjaAt ?? o.decided_at ?? null,

    applied: !!o.applied,
    logKey: o.logKey || null,
    logDate: o.logDate || null,

    data,
    fingerprint,

    archived: !!(o.archived || o.is_archived),
    closedAt: o.closedAt ?? o.closed_at ?? null,
    closedReason: o.closedReason ?? o.closed_reason ?? "",

    locked: !!o.locked,
    lockedAt: o.lockedAt ?? o.locked_at ?? null,
    lockedBy: o.lockedBy ?? o.locked_by ?? ""
  };
}

function computeActivePointRequests(allList) {
  const list = Array.isArray(allList) ? allList : [];
  const now = Date.now();
  const r = (window.rodzic || "").toString();

  return list.filter(p => {
    if (!p) return false;
    if (p.archived || p.is_archived) return false;

    const st = normStatus(p.status || "pending");
    if (st === "accepted_auto") return false;

    const exp = Number(p.expiresAt || 0);
    if (exp && now > exp) return false;

    const who = (p.kto || p.decided_by || "").toString();

    if (st === "pending") return !who;
    if (st === "accepted" || st === "rejected") return !!r && (who === r);

    return false;
  });
}

window.getActivePointRequests = function () {
  return Array.isArray(window.pointRequestsActive) ? window.pointRequestsActive : [];
};

/* ====== LOCK per-wniosek ====== */
async function lockPointRequest(key, by) {
  if (!key) return { ok: false, reason: "no_key" };
  const ref = db.ref(`${PR_PATH}/${key}`);
  const now = Date.now();

  const res = await ref.transaction(cur => {
    if (!cur) return cur;
    if (cur.locked) return;
    cur.locked = true;
    cur.lockedAt = now;
    cur.lockedBy = by || "system";
    return cur;
  });

  if (!res.committed) return { ok: false, reason: "locked_or_missing" };
  return { ok: true, cur: res.snapshot.val() || {} };
}

async function unlockPointRequest(key) {
  if (!key) return;
  try {
    await db.ref(`${PR_PATH}/${key}`).update({
      locked: false,
      lockedAt: null,
      lockedBy: ""
    });
  } catch (_) {}
}

/* ====== LOCK per fingerprint ====== */
async function claimFingerprintLock(dateIso, fingerprint, prKey) {
  const fp = fingerprint || "";
  if (!dateIso || !fp || !prKey) return { ok: false, reason: "missing" };

  const ref = fpLockRef(dateIso, fp);
  const now = Date.now();

  const res = await ref.transaction(cur => {
    // już zajęte przez TEN SAM wniosek -> traktujemy jako sukces
    if (cur && cur.key === prKey) return cur;
    // zajęte przez inny -> abort
    if (cur && cur.key) return;
    return { key: prKey, ts: now, fp: fp };
  });

  if (!res.committed) {
    const v = res.snapshot.val();
    if (v && v.key === prKey) {
      return { ok: true, reused: true };
    }
    return { ok: false, reason: "taken", takenBy: v?.key || null };
  }

  const snapVal = res.snapshot.val();
  if (snapVal && snapVal.key === prKey) {
    return { ok: true, reused: !!snapVal.ts && snapVal.ts !== now };
  }

  return { ok: true };
}

async function releaseFingerprintLockIfOwned(dateIso, fingerprint, prKey) {
  try {
    const ref = fpLockRef(dateIso, fingerprint);
    const snap = await ref.once("value");
    const v = snap.val();
    if (v && v.key === prKey) {
      await ref.remove();
    }
  } catch (_) {}
}

/* ====== log helper: znajdź istniejący log po prKey ====== */
async function findExistingPointRequestLog(dateIso, prKey) {
  if (!dateIso || !prKey) return null;

  const snap = await db.ref(`log/${dateIso}`).once("value");
  if (!snap.exists()) return null;

  let found = null;
  snap.forEach(ch => {
    const v = ch.val() || {};
    if (found) return;
    if (String(v.prKey || "") === String(prKey)) {
      found = { logKey: ch.key, logDate: dateIso, value: v };
    }
  });

  return found;
}

/* ====== księgowanie +1h do dni + wpis do log ====== */
async function applyPointRequestOnce(key, mode, decidedBy, commentMsg, forceArchive) {
  const by = decidedBy || "system";
  const now = Date.now();

  const locked = await lockPointRequest(key, by);
  if (!locked.ok) return { ok: false, reason: locked.reason };

  try {
    const snap = await db.ref(`${PR_PATH}/${key}`).once("value");
    const cur0 = snap.val() || {};
    const st0 = normStatus(cur0.status || "pending");

    // jeśli już zamknięte -> nic nie rób
    if (st0 !== "pending") {
      await unlockPointRequest(key);
      return { ok: false, reason: "not_pending" };
    }

    const createdAt = cur0.createdAt ?? cur0.created_at ?? 0;
    const childComment = normText(cur0.child_comment || cur0.childComment || cur0.komentarzDziecka || "");
    const dateIso = cur0.data || (createdAt ? isoFromTsWarsaw(createdAt) : getTodayIso());
    const fp = cur0.fingerprint || makeFingerprint(dateIso, childComment);

    // twarda deduplikacja fingerprintu
    const fpClaim = await claimFingerprintLock(dateIso, fp, key);
    if (!fpClaim.ok) {
      const dupMsg = "Duplikat wniosku (ten sam komentarz w tym samym dniu) – nie naliczono punktu.";
      await db.ref(`${PR_PATH}/${key}`).update({
        status: "rejected",
        kto: "system_dedup",
        decyzjaAt: now,
        komentarz: dupMsg,
        applied: false,
        logKey: null,
        logDate: null,
        data: dateIso,
        fingerprint: fp,
        locked: false,
        lockedAt: null,
        lockedBy: "",
        archived: true,
        closedAt: now,
        closedReason: "dedup"
      });
      return { ok: false, reason: "duplicate", takenBy: fpClaim.takenBy || null };
    }

    // dodatkowe uszczelnienie: jeśli log już istnieje po prKey -> nie twórz nowego
    let existingLog = await findExistingPointRequestLog(dateIso, key);

    let applied = !!cur0.applied;
    let logKey = cur0.logKey || existingLog?.logKey || null;
    let logDate = cur0.logDate || existingLog?.logDate || dateIso;

    // jeżeli jest log po prKey, traktujemy to jako już zaksięgowane
    if (existingLog) {
      applied = true;
    }

    // jeśli nie było zaksięgowane – dodaj dokładnie raz
    if (!applied) {
      await db.ref("dni/" + dateIso).transaction(v => (v || 0) + 1);

      const ref = db.ref("log/" + dateIso).push();
      await ref.set({
        h: 1,
        opis: `Wniosek Julka: ${childComment} (${mode === "manual" ? "zaakceptowane" : "zaakceptowane automatycznie"})`,
        rodzic: (mode === "manual") ? (window.rodzic || by) : "system",
        category: "wniosek_punkt",
        ts: Date.now(),
        prKey: key,
        fingerprint: fp
      });

      applied = true;
      logKey = ref.key;
      logDate = dateIso;
    } else if (logKey && logDate) {
      // upewnij się, że log ma właściwe oznaczenia
      await db.ref(`log/${logDate}/${logKey}`).update({
        prKey: key,
        fingerprint: fp,
        h: 1
      }).catch(() => {});
    }

    const statusFinal = (mode === "manual") ? "accepted" : "accepted_auto";

    const upd = {
      status: statusFinal,
      kto: (mode === "manual") ? (window.rodzic || by) : (mode === "week_close" ? "system_weekclose" : "auto"),
      decyzjaAt: now,
      komentarz: commentMsg || "",
      applied: true,
      logKey,
      logDate,
      data: dateIso,
      fingerprint: fp,
      locked: false,
      lockedAt: null,
      lockedBy: ""
    };

    if (forceArchive) {
      upd.archived = true;
      upd.closedAt = now;
      upd.closedReason = mode;
    }

    await db.ref(`${PR_PATH}/${key}`).update(upd);
    return { ok: true, status: statusFinal, dateIso, logKey };
  } catch (e) {
    console.error("applyPointRequestOnce error:", e);
    await unlockPointRequest(key);
    return { ok: false, reason: "error" };
  }
}

/* ====== cofnięcie (gdy odrzucono, a było naliczone) ====== */
async function revertPointRequestIfApplied(key, decidedBy, reason) {
  const by = decidedBy || (window.rodzic || "system");
  const now = Date.now();

  const locked = await lockPointRequest(key, by);
  if (!locked.ok) return { ok: false, reason: locked.reason };

  try {
    const snap = await db.ref(`${PR_PATH}/${key}`).once("value");
    const cur = snap.val() || {};

    const createdAt = cur.createdAt ?? cur.created_at ?? 0;
    const childComment = normText(cur.child_comment || cur.childComment || cur.komentarzDziecka || "");
    const dateIso = cur.data || (createdAt ? isoFromTsWarsaw(createdAt) : getTodayIso());
    const fp = cur.fingerprint || makeFingerprint(dateIso, childComment);

    let wasApplied = !!cur.applied;
    let logDate = cur.logDate || dateIso;
    let logKey = cur.logKey || null;

    // jak nie ma logKey w rekordzie, spróbuj znaleźć po prKey
    if (!logKey) {
      const existingLog = await findExistingPointRequestLog(logDate, key);
      if (existingLog) {
        logKey = existingLog.logKey;
        logDate = existingLog.logDate;
        wasApplied = true;
      }
    }

    if (wasApplied) {
      let hToRevert = 1;

      if (logDate && logKey) {
        try {
          const logSnap = await db.ref(`log/${logDate}/${logKey}`).once("value");
          const lv = logSnap.val();
          if (lv && typeof lv.h !== "undefined") hToRevert = Number(lv.h || 1);
        } catch (_) {}

        if (logDate) {
          await db.ref("dni/" + logDate).transaction(v => (v || 0) - hToRevert);
        }

        await db.ref(`log/${logDate}/${logKey}`).remove().catch(() => {});
      }

      await releaseFingerprintLockIfOwned(logDate || dateIso, fp, key);
    }

    await db.ref(`${PR_PATH}/${key}`).update({
      status: "rejected",
      kto: by,
      decyzjaAt: now,
      komentarz: reason || "",
      applied: false,
      logKey: null,
      logDate: null,
      data: dateIso,
      fingerprint: fp,
      locked: false,
      lockedAt: null,
      lockedBy: ""
    });

    return { ok: true, reverted: wasApplied };
  } catch (e) {
    console.error("revertPointRequestIfApplied error:", e);
    await unlockPointRequest(key);
    return { ok: false, reason: "error" };
  }
}

/* ====== API dla UI rodzica ====== */
window.acceptPointRequest = async function (pr, parentComment) {
  const key = (typeof pr === "string") ? pr : (pr?.key || pr?.id || "");
  const msg = parentComment ? String(parentComment) : "";
  return await applyPointRequestOnce(
    key,
    "manual",
    (window.rodzic || "rodzic"),
    msg,
    false
  );
};

window.rejectPointRequest = async function (pr, parentComment) {
  const key = (typeof pr === "string") ? pr : (pr?.key || pr?.id || "");
  const msg = parentComment ? String(parentComment) : "";
  return await revertPointRequestIfApplied(
    key,
    (window.rodzic || "rodzic"),
    msg
  );
};

/* ====== Odczyt wniosków z Firebase ====== */
db.ref(PR_PATH).on("value", s => {
  const all = [];
  s && s.forEach(ch => {
    all.push(normalizePointRequest(ch.val(), ch.key));
  });

  all.sort((a, b) => {
    const ap = normStatus(a.status) === "pending";
    const bp = normStatus(b.status) === "pending";
    if (ap !== bp) return ap ? -1 : 1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  window.pointRequestsAll = all;
  window.pointRequests = all;
  window.pointRequestsActive = computeActivePointRequests(all);

  if (typeof window.processAutoAcceptPointRequests === "function") {
    window.processAutoAcceptPointRequests();
  }

  renderAll();
});

/* ===== Nadpisujemy addPointRequest -> zapis do Firebase ===== */
(function hookAddPointRequestToFirebase() {
  const oldAdd = window.addPointRequest;

  window.addPointRequest = async function (req) {
    try {
      const now = Date.now();
      const createdAt = req?.created_at ?? req?.createdAt ?? now;
      const expiresAt = req?.expires_at ?? req?.expiresAt ?? (createdAt + PR_H12);

      const childComment = normText(req?.child_comment || req?.childComment || req?.komentarzDziecka || "");
      const dateIso = isoFromTsWarsaw(createdAt);
      const fp = makeFingerprint(dateIso, childComment);

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
        data: dateIso,
        fingerprint: fp,
        archived: false,
        closedAt: null,
        closedReason: "",
        locked: false,
        lockedAt: null,
        lockedBy: ""
      };

      await db.ref(PR_PATH).push(payload);
    } catch (e) {
      console.error("Błąd zapisu wniosku do Firebase:", e);
      try { oldAdd?.(req); } catch (_) {}
      alert("Nie udało się zapisać wniosku do bazy. Spróbuj ponownie.");
    }
  };
})();

/* ===== Auto-akcept: po 12h albo piątek 18:00 ===== */
let _prAutoRunning = false;
window.processAutoAcceptPointRequests = async function () {
  if (_prAutoRunning) return;
  _prAutoRunning = true;

  try {
    const list = Array.isArray(window.pointRequestsAll) ? window.pointRequestsAll : [];
    if (list.length === 0) return;

    const now = Date.now();
    const today = getTodayIso();
    const wk = (today && typeof isoWeekKeyFromIsoDate === "function") ? isoWeekKeyFromIsoDate(today) : "";
    const fridayAuto = (typeof isFridayAutoAcceptTime === "function") ? isFridayAutoAcceptTime() : false;

    for (const r of list) {
      if (!r) continue;

      const st = normStatus(r.status || "pending");
      if (st !== "pending") continue;

      const key = r.key;
      if (!key) continue;

      const createdAt = r.createdAt || 0;
      const dateIso = r.data || (createdAt ? isoFromTsWarsaw(createdAt) : today);

      const shouldAutoFriday = !!fridayAuto && wk && dateIso && typeof isoWeekKeyFromIsoDate === "function"
        ? (isoWeekKeyFromIsoDate(dateIso) === wk)
        : !!fridayAuto;

      const exp = Number(r.expiresAt || 0);
      const shouldAuto12h = !!exp && now > exp;

      if (!shouldAuto12h && !shouldAutoFriday) continue;

      const msg = shouldAutoFriday
        ? "Do godziny 18:00 w piątek rodzic nie podjął decyzji – zaakceptowano automatycznie."
        : "Po upływie 12 godzin rodzic nie podjął decyzji – zaakceptowano automatycznie.";

      const mode = shouldAutoFriday ? "friday18" : "auto12h";

      await applyPointRequestOnce(
        key,
        mode,
        "auto",
        msg,
        true
      );
    }
  } catch (e) {
    console.error("processAutoAcceptPointRequests error:", e);
  } finally {
    _prAutoRunning = false;
  }
};

/* ===================================================== */
/* ========== WEEK CLOSE: ZAMKNIJ WNIOSKI + UI ========= */
/* ===================================================== */

window.closePointRequestsOnWeekClose = async function (weekKey) {
  try {
    const snap = await db.ref(PR_PATH).once("value");
    if (!snap.exists()) return;

    const today = getTodayIso();
    const wk = weekKey || (today && typeof isoWeekKeyFromIsoDate === "function"
      ? isoWeekKeyFromIsoDate(today)
      : "");

    const jobs = [];
    snap.forEach(ch => {
      const key = ch.key;
      const cur = ch.val() || {};
      if (!key) return;

      if (normStatus(cur.status || "pending") !== "pending") return;
      if (cur.archived || cur.is_archived) return;

      const createdAt = cur.createdAt ?? cur.created_at ?? 0;
      const dateIso = cur.data || (createdAt ? isoFromTsWarsaw(createdAt) : today);

      if (wk && dateIso && typeof isoWeekKeyFromIsoDate === "function") {
        if (isoWeekKeyFromIsoDate(dateIso) !== wk) return;
      }

      jobs.push(key);
    });

    for (const key of jobs) {
      await applyPointRequestOnce(
        key,
        "week_close",
        "system_weekclose",
        "Zamknięcie tygodnia – wniosek zaliczony na plus.",
        true
      );
    }
  } catch (e) {
    console.error("closePointRequestsOnWeekClose error:", e);
  }
};

/* ===================================================== */
/* ========= AUTO CLOSE TYGODNIA (PIĄTEK 18:00) ========= */
/* ===================================================== */

async function acquireCloseLock() {
  const lockRef = db.ref("meta/closeLock");
  const now = Date.now();
  const res = await lockRef.transaction(v => {
    if (v && v.at && (now - v.at) < 2 * 60 * 1000) return;
    return { at: now };
  });
  return !!(res && res.committed);
}

async function releaseCloseLock() {
  try { await db.ref("meta/closeLock").remove(); } catch (_) {}
}

function isSameWeek(dateIso, weekKey) {
  if (!weekKey) return true;
  if (!dateIso) return false;
  if (typeof isoWeekKeyFromIsoDate !== "function") return true;
  return isoWeekKeyFromIsoDate(dateIso) === weekKey;
}

async function closePendingAppealsOnWeekClose(weekKey) {
  const snap = await db.ref("odwolania").once("value");
  if (!snap.exists()) return;

  const now = Date.now();
  const jobs = [];

  snap.forEach(ch => {
    const o = ch.val() || {};
    if (normStatus(o.status) !== "pending") return;

    const dateIso = (o.data || "").toString();
    if (!dateIso) return;
    if (!isSameWeek(dateIso, weekKey)) return;

    jobs.push({
      key: ch.key,
      dateIso,
      h: Number(o.h || 0)
    });
  });

  for (const j of jobs) {
    const cur = (await db.ref("odwolania/" + j.key).once("value")).val();
    if (!cur || normStatus(cur.status) !== "pending") continue;

    await db.ref("dni/" + j.dateIso).transaction(x => (x || 0) - j.h);

    await db.ref("odwolania/" + j.key).update({
      status: "accepted_auto",
      kto: "system_weekclose",
      decyzjaAt: now,
      komentarz: "Zamknięcie tygodnia – odwołanie zaliczone na plus."
    });
  }
}

async function closeWeekCore(weekKey, reason) {
  const dniSnap = await db.ref("dni").once("value");

  let sum = 0;
  if (dniSnap.exists()) {
    dniSnap.forEach(d => {
      const date = d.key;
      const val = Number(d.val() || 0);
      if (!date) return;

      if (typeof isoWeekKeyFromIsoDate === "function" && weekKey) {
        if (isoWeekKeyFromIsoDate(date) === weekKey) sum += val;
      } else {
        sum += val;
      }
    });
  }

  await db.ref("weekend").set(sum);

  await db.ref("dni").remove();
  await db.ref("log").remove();

  await db.ref("meta/lastCloseWeekKey").set(weekKey || "");
  await db.ref("meta/lastCloseReason").set(reason || "");
  await db.ref("meta/lastCloseAt").set(Date.now());
}

let _autoCloseRunning = false;
async function autoCloseWeekIfDue() {
  if (_autoCloseRunning) return;
  if (typeof isFridayAutoAcceptTime !== "function") return;

  const due = isFridayAutoAcceptTime();
  if (!due) return;

  const today = getTodayIso();
  const wk = (today && typeof isoWeekKeyFromIsoDate === "function") ? isoWeekKeyFromIsoDate(today) : "";
  if (!wk) return;

  const lastWk = (window._lastCloseWeekKey || "").toString();
  if (lastWk && lastWk === wk) return;

  _autoCloseRunning = true;
  const got = await acquireCloseLock();
  if (!got) {
    _autoCloseRunning = false;
    return;
  }

  try {
    try { await window.closePointRequestsOnWeekClose?.(wk); } catch (e) { console.error(e); }
    try { await closePendingAppealsOnWeekClose(wk); } catch (e) { console.error(e); }
    await closeWeekCore(wk, "auto_friday18");
  } catch (e) {
    console.error("autoCloseWeekIfDue error:", e);
  } finally {
    await releaseCloseLock();
    _autoCloseRunning = false;
  }
}

/* ===================================================== */
/* ================== PODSUMOWANIA ================== */
db.ref("dni").on("value", s => {
  const today = todayIso();
  const wk = isoWeekKeyFromIsoDate(today);
  const todayVal = s.child(today).val() || 0;

  let weekVal = 0;
  s.forEach(d => {
    if (d.key && isoWeekKeyFromIsoDate(d.key) === wk) weekVal += Number(d.val() || 0);
  });

  setText("todayR", todayVal); setText("todayJ", todayVal);
  setText("weekR", weekVal); setText("weekJ", weekVal);
});

/* ================== WEEKEND: licznik + komunikaty ================== */
db.ref("weekend").on("value", s => {
  const v = Number(s.val() || 0);

  const showCounter = (typeof isWeekendCounterTime === "function") ? isWeekendCounterTime() : true;
  const showMsg = shouldShowWeekendMessageNow();

  const spR = document.getElementById("weekendR");
  if (spR) {
    const row = spR.closest("div");
    if (row) row.style.display = showCounter ? "" : "none";
  }

  const spJ = document.getElementById("weekendJ");
  if (spJ) {
    const kpi = spJ.closest(".julekKpi");
    if (kpi) kpi.style.display = showCounter ? "" : "none";
  }

  if (showCounter) {
    setText("weekendR", formatHours(v));
    setText("weekendJ", formatHours(v));
  }

  const boxR = document.getElementById("weekendInfoParent");
  const boxJ = document.getElementById("weekendInfoJulek");
  if (boxR) boxR.classList.toggle("hidden", !showMsg);
  if (boxJ) boxJ.classList.toggle("hidden", !showMsg);

  function msgFor(val) {
    if (val > 0) return `JULEK W BIEŻĄCY WEEKEND MOŻE KORZYSTAĆ Z KOMPUTERA PRZEZ ${formatHours(val)} GODZIN.`;
    if (val < 0) return `JULEK W BIEŻĄCY WEEKEND MA DO ODPRACOWANIA NA RZECZ RODZICÓW ${formatHours(Math.abs(val))} GODZIN.`;
    return `JULEK W BIEŻĄCY WEEKEND NIE MA GODZIN DO WYKORZYSTANIA.`;
  }

  if (showMsg) {
    const t = msgFor(v);
    const tR = document.getElementById("weekendInfoTextParent");
    const tJ = document.getElementById("weekendInfoTextJulek");
    if (tR) tR.innerText = t;
    if (tJ) tJ.innerText = t;

    const dLine = "Obowiązuje do końca niedzieli.";
    const dR = document.getElementById("weekendInfoDateParent");
    const dJ = document.getElementById("weekendInfoDateJulek");
    if (dR) dR.innerText = dLine;
    if (dJ) dJ.innerText = dLine;
  }
});

/* ================== CACHE: LOGI ================== */
db.ref("log").on("value", s => {
  logsCache = {};
  s && s.forEach(day => {
    logsCache[day.key] = {};
    day.forEach(item => {
      logsCache[day.key][item.key] = item.val();
    });
  });
  renderAll();
});

/* ================== AUTO-AKCEPT ODWOŁAŃ ================== */
let _appealsAutoRunning = false;
window.processAutoAcceptAppeals = async function () {
  if (_appealsAutoRunning) return;
  _appealsAutoRunning = true;

  try {
    const list = Array.isArray(window.appealsList) ? window.appealsList : [];
    if (list.length === 0) return;

    const today = (typeof todayIso === "function") ? todayIso() : "";
    const fridayAuto = (typeof isFridayAutoAcceptTime === "function") ? isFridayAutoAcceptTime() : false;

    for (const o of list) {
      if (!o) continue;
      if (normStatus(o.status) !== "pending") continue;

      const deadlineDay = o.deadlineDay || "";
      const shouldByDeadline = deadlineDay && today && (today > deadlineDay);
      const shouldByFriday = !!fridayAuto;

      if (!shouldByDeadline && !shouldByFriday) continue;

      const key = o.key;
      if (!key) continue;

      const snap = await db.ref("odwolania/" + key).once("value");
      const cur = snap.val();
      if (!cur || normStatus(cur.status) !== "pending") continue;

      const dateIso = cur.data || "";
      const h = Number(cur.h || 0);

      if (dateIso) {
        await db.ref("dni/" + dateIso).transaction(x => (x || 0) - h);
      }

      const msg = shouldByFriday
        ? "Do godziny 18:00 w piątek rodzic nie podjął decyzji – odwołanie zaakceptowano automatycznie."
        : "Po terminie decyzji rodzica – odwołanie zaakceptowano automatycznie.";

      await db.ref("odwolania/" + key).update({
        status: "accepted_auto",
        kto: "auto",
        decyzjaAt: Date.now(),
        komentarz: msg
      });
    }
  } catch (e) {
    console.error("processAutoAcceptAppeals error:", e);
  } finally {
    _appealsAutoRunning = false;
  }
};

/* ================== CACHE: ODWOŁANIA ================== */
db.ref("odwolania").on("value", s => {
  appealsByLog = {};
  appealsList = [];

  s && s.forEach(ch => {
    const o = ch.val(); if (!o) return;
    const date = o.data || "";
    const logId = o.logId || "";
    if (!date || !logId) return;

    const idx = `${date}|${logId}`;
    const prev = appealsByLog[idx];

    if (!prev || (o.createdAt || 0) > (prev.createdAt || 0)) {
      appealsByLog[idx] = { ...o, key: ch.key };
    }
    appealsList.push({ ...o, key: ch.key });
  });

  appealsList.sort((a, b) => {
    const ap = normStatus(a.status) === "pending";
    const bp = normStatus(b.status) === "pending";
    if (ap !== bp) return ap ? -1 : 1;
    return (b.decyzjaAt || b.createdAt || 0) - (a.decyzjaAt || a.createdAt || 0);
  });

  window.processAutoAcceptAppeals?.();

  try {
    if (typeof window.updateAppealsButton === "function") window.updateAppealsButton();
  } catch (_) {}

  renderAll();
});

/* ================== HOOKI DLA AUTH ================== */
window.onAfterLogin = function () {
  renderAll();

  window.pointRequestsActive = computeActivePointRequests(window.pointRequestsAll);

  window.processAutoAcceptAppeals?.();
  window.processAutoAcceptPointRequests?.();
};

/* ================== TIMER ================== */
setInterval(() => {
  try {
    window.processAutoAcceptAppeals?.();
    window.processAutoAcceptPointRequests?.();
    autoCloseWeekIfDue?.();
    window.pointRequestsActive = computeActivePointRequests(window.pointRequestsAll);
  } catch (e) {
    console.error(e);
  }
}, 60 * 1000);

/* ================== INIT ADMIN PUBLIC (LOGIN) ================== */
window.addEventListener("load", function () {
  if (typeof window.initAdminPublicNotes === "function") {
    window.initAdminPublicNotes();
  }

  setTimeout(() => { try { autoCloseWeekIfDue?.(); } catch (e) {} }, 1500);
});