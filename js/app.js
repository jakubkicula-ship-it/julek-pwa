// ./js/app.js

/* ================== ZABEZPIECZENIA GLOBALI ================== */
window.logsCache = window.logsCache || {};
window.appealsByLog = window.appealsByLog || {};
window.appealsList = window.appealsList || [];
window.showWholeWeekLogs = window.showWholeWeekLogs || false;

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
window.escapeHtml = escapeHtml;

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.innerText = String(val);
}
function dateHeader(date) {
  if (typeof window.dateWithDowPl === "function") return window.dateWithDowPl(date);
  return date;
}
window.dateHeader = dateHeader;

function toggleWeekLogs() {
  window.showWholeWeekLogs = !window.showWholeWeekLogs;
  renderAll();
}
window.toggleWeekLogs = toggleWeekLogs;

function tsToWarsaw(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" });
}
window.tsToWarsaw = tsToWarsaw;

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
const APP_VERSION = JULEK_SETTINGS.version;
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
window.openPdf = openPdf;

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
window.toggleAppeals = toggleAppeals;

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
/* ======= WEEKEND MESSAGE – DO KOŃCA NIEDZIELI ========= */
/* ===================================================== */

window.weekendSettlement = null;
function shouldShowWeekendMessageNow() {
  const result = window.weekendSettlement;
  return !!result && Date.now() >= result.endAt && Date.now() < weekendExpiresAt(result.endAt);
}
db.ref("meta/weekendSettlement").on("value", snapshot => {
  window.weekendSettlement = snapshot.val();
  renderWeekendInfo();
});

/* ===================================================== */
/* ================= BIZNESOWY TYDZIEŃ ================== */
/* ===================================================== */

function getBusinessWeekKeyNow() {
  if (typeof window.businessWeekKeyNow === "function") return window.businessWeekKeyNow();
  return "";
}

function getBusinessWeekKeyFromTs(ts) {
  if (typeof window.businessWeekKeyFromTs === "function") return window.businessWeekKeyFromTs(ts);
  return "";
}

function getBusinessWeekKeyFromIsoDate(isoDate) {
  if (typeof window.businessWeekKeyFromIsoDate === "function") return window.businessWeekKeyFromIsoDate(isoDate);
  return "";
}

function isTsInCurrentBusinessWeekSafe(ts) {
  if (typeof window.isTsInCurrentBusinessWeek === "function") return window.isTsInCurrentBusinessWeek(ts);
  return false;
}

function isTsInCurrentBusinessDaySafe(ts) {
  if (typeof window.isTsInCurrentBusinessDay === "function") return window.isTsInCurrentBusinessDay(ts);
  return false;
}

function businessWeekKeyForLog(dateIso, logVal) {
  const ts = Number(logVal?.ts || 0);
  if (ts) return getBusinessWeekKeyFromTs(ts);
  return getBusinessWeekKeyFromIsoDate(dateIso);
}

function businessWeekKeyForPointRequest(pr) {
  const ts = Number(pr?.createdAt ?? pr?.created_at ?? 0);
  if (ts) return getBusinessWeekKeyFromTs(ts);
  const dateIso = (pr?.data || "").toString();
  return getBusinessWeekKeyFromIsoDate(dateIso);
}

function businessWeekKeyForAppeal(o) {
  const ts = Number(o?.createdAt || 0);
  if (ts) return getBusinessWeekKeyFromTs(ts);
  const dateIso = (o?.data || "").toString();
  return getBusinessWeekKeyFromIsoDate(dateIso);
}

/* ===================================================== */
/* ======= PODSUMOWANIA Z LOGÓW (NIE Z ISO-DNI) ========= */
/* ===================================================== */

function appealNeutralizesLog(date, logId) {
  const a = window.appealsByLog?.[`${date}|${logId}`];
  if (!a) return false;
  const st = normStatus(a.status);
  return st === "accepted" || st === "accepted_auto";
}

function recomputeSummaryTiles() {
  const logs = window.logsCache || {};

  let todayVal = 0;
  let weekVal = 0;

  Object.keys(logs).forEach(date => {
    const dayObj = logs[date] || {};

    Object.keys(dayObj).forEach(logId => {
      const v = dayObj[logId];
      if (!v) return;

      if (appealNeutralizesLog(date, logId)) return;

      const ts = Number(v.ts || 0);

      if (ts) {
        if (isTsInCurrentBusinessDaySafe(ts)) todayVal += Number(v.h || 0);
        if (isTsInCurrentBusinessWeekSafe(ts)) weekVal += Number(v.h || 0);
        return;
      }

      // fallback dla starych wpisów bez ts
      const wk = businessWeekKeyForLog(date, v);
      if (wk && wk === getBusinessWeekKeyNow()) {
        weekVal += Number(v.h || 0);
      }

      if (date === todayIso()) {
        todayVal += Number(v.h || 0);
      }
    });
  });

  setText("todayR", formatHours(todayVal));
  setText("todayJ", formatHours(todayVal));
  setText("weekR", formatHours(weekVal));
  setText("weekJ", formatHours(weekVal));
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
    if (cur && cur.key === prKey) return cur;
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

    if (st0 !== "pending") {
      await unlockPointRequest(key);
      return { ok: false, reason: "not_pending" };
    }

    const createdAt = cur0.createdAt ?? cur0.created_at ?? 0;
    const childComment = normText(cur0.child_comment || cur0.childComment || cur0.komentarzDziecka || "");
    const dateIso = cur0.data || (createdAt ? isoFromTsWarsaw(createdAt) : getTodayIso());
    const fp = cur0.fingerprint || makeFingerprint(dateIso, childComment);

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

    let existingLog = await findExistingPointRequestLog(dateIso, key);

    let applied = !!cur0.applied;
    let logKey = cur0.logKey || existingLog?.logKey || null;
    let logDate = cur0.logDate || existingLog?.logDate || dateIso;

    if (existingLog) {
      applied = true;
    }

    if (!applied) {
      await db.ref("dni/" + dateIso).transaction(v => (v || 0) + 1);

      const ref = db.ref("log/" + dateIso).push();
      await ref.set({
        h: 1,
        opis: `Wniosek Julka: ${childComment} (${mode === "manual" ? "zaakceptowane" : "zaakceptowane automatycznie"})`,
        rodzic: (mode === "manual") ? (window.rodzic || by) : "system",
        category: "wniosek_punkt",
        ts: Number(createdAt) || warsawTimestamp(dateIso, 12),
        prKey: key,
        fingerprint: fp
      });

      applied = true;
      logKey = ref.key;
      logDate = dateIso;
    } else if (logKey && logDate) {
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
    const currentBW = getBusinessWeekKeyNow();
    const fridayAuto = (typeof isFridayAutoAcceptTime === "function") ? isFridayAutoAcceptTime() : false;

    for (const r of list) {
      if (!r) continue;

      const st = normStatus(r.status || "pending");
      if (st !== "pending") continue;

      const key = r.key;
      if (!key) continue;

      const reqBW = businessWeekKeyForPointRequest(r);
      // Zakończone okresy obsługuje wspólna transakcja zamknięcia tygodnia.
      if (reqBW && reqBW < currentBW) continue;
      const shouldAutoFriday = false;

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

    const targetWeek = weekKey || getBusinessWeekKeyNow();
    const jobs = [];

    snap.forEach(ch => {
      const key = ch.key;
      const cur = ch.val() || {};
      if (!key) return;

      if (normStatus(cur.status || "pending") !== "pending") return;
      if (cur.archived || cur.is_archived) return;

      const reqBW = businessWeekKeyForPointRequest(cur);
      if (targetWeek && reqBW !== targetWeek) return;

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

// Jedna transakcja zachowuje logi i zapisuje wynik każdego tygodnia dokładnie raz.
let _autoCloseRunning = false;
window._maintenanceReady = false;
window._maintenanceDue = true;
db.ref("meta").on("value", snapshot => {
  const meta = snapshot.val() || {};
  window._maintenanceReady = true;
  window._maintenanceDue = !meta.weekClosures?.[previousBusinessWeekKey()] || meta.lastHistoryCleanupDay !== todayIso();
});
window.runDueWeekSettlements = async function(reason = "auto_friday18") {
  if (_autoCloseRunning) return false;
  // Przeliczaj termin według aktualnego zegara, także bez nowego zdarzenia w bazie.
  const latest = window.weekendSettlement?.weekKey;
  if (window._maintenanceReady && !window._maintenanceDue && latest === previousBusinessWeekKey() && window._historyCleanupDay === todayIso()) return false;
  _autoCloseRunning = true;
  const now = Date.now();
  try {
    const snapshot = await db.ref().once("value");
    const initial = snapshot.val() || {};
    if (!JulekSettlement.dueWeeks(initial, now).length && initial.meta?.lastHistoryCleanupDay === todayIso()) {
      window._historyCleanupDay = todayIso();
      return false;
    }
    const result = await db.ref().transaction(data => {
      // Firebase może zacząć od pustej lokalnej pamięci. Zwrócenie undefined
      // przerywa transakcję, zamiast pobrać dane serwera i ponowić obliczenia.
      if (!data) data = {};
      const weeks = JulekSettlement.dueWeeks(data, now);
      if (!weeks.length && data.meta?.lastHistoryCleanupDay === todayIso()) return;
      for (const key of weeks) JulekSettlement.settleWeek(data, key, now, reason);
      JulekSettlement.purgeOldHistory(data, now);
      return data;
    }, undefined, false);
    if (result.committed) window._historyCleanupDay = todayIso();
    return !!result.committed;
  } finally {
    _autoCloseRunning = false;
  }
};
async function autoCloseWeekIfDue() {
  try {
    const changed = await window.runDueWeekSettlements();
    setText("settlementStatus", "Rozliczenie: piątek 18:00 (Warszawa). Przy zamkniętej aplikacji zostanie nadrobione po jej otwarciu.");
    return changed;
  } catch (error) {
    console.error("Błąd rozliczenia tygodnia:", error);
    setText("settlementStatus", "Nie udało się zapisać rozliczenia. Sprawdź połączenie; aplikacja ponowi próbę.");
  }
}

function renderWeekendInfo() {
  const result = window.weekendSettlement;
  const show = shouldShowWeekendMessageNow();
  const value = Number(result?.hours || 0);
  for (const suffix of ["R", "J"]) {
    const element = document.getElementById("weekend" + suffix);
    if (!element) continue;
    const row = element.closest(suffix === "J" ? ".julekKpi" : "div");
    if (row) row.style.display = show ? "" : "none";
    element.innerText = show ? formatHours(value) : "0";
  }
  let message = value > 0
    ? `JULEK W TEN WEEKEND MOŻE KORZYSTAĆ Z KOMPUTERA PRZEZ ${formatHours(value)} GODZIN.`
    : value < 0 ? `JULEK W TEN WEEKEND MA DO ODPRACOWANIA ${formatHours(Math.abs(value))} GODZIN.`
    : "JULEK W TEN WEEKEND NIE MA GODZIN DO WYKORZYSTANIA.";
  for (const suffix of ["Parent", "Julek"]) {
    document.getElementById("weekendInfo" + suffix)?.classList.toggle("hidden", !show);
    setText("weekendInfoText" + suffix, show ? message : "");
    setText("weekendInfoDate" + suffix, show
      ? `Wynik tygodnia: ${formatHours(result.earnedHours)} h; bonus: ${formatHours(result.bonusHours)} h. Obowiązuje do końca niedzieli.` : "");
  }
}

/* ================== CACHE: LOGI ================== */
db.ref("log").on("value", s => {
  window.logsCache = {};
  s && s.forEach(day => {
    window.logsCache[day.key] = {};
    day.forEach(item => {
      window.logsCache[day.key][item.key] = item.val();
    });
  });

  recomputeSummaryTiles();
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
    const currentBW = getBusinessWeekKeyNow();

    for (const o of list) {
      if (!o) continue;
      if (normStatus(o.status) !== "pending") continue;

      const deadlineDay = o.deadlineDay || "";
      const shouldByDeadline = deadlineDay && today && (today > deadlineDay);

      const appealBW = businessWeekKeyForAppeal(o);
      if (appealBW && appealBW < currentBW) continue;
      const shouldByFriday = false;

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
  window.appealsByLog = {};
  window.appealsList = [];

  s && s.forEach(ch => {
    const o = ch.val(); if (!o) return;
    const date = o.data || "";
    const logId = o.logId || "";
    if (!date || !logId) return;

    const idx = `${date}|${logId}`;
    const prev = window.appealsByLog[idx];

    if (!prev || (o.createdAt || 0) > (prev.createdAt || 0)) {
      window.appealsByLog[idx] = { ...o, key: ch.key };
    }
    window.appealsList.push({ ...o, key: ch.key });
  });

  window.appealsList.sort((a, b) => {
    const ap = normStatus(a.status) === "pending";
    const bp = normStatus(b.status) === "pending";
    if (ap !== bp) return ap ? -1 : 1;
    return (b.decyzjaAt || b.createdAt || 0) - (a.decyzjaAt || a.createdAt || 0);
  });

  window.processAutoAcceptAppeals?.();

  try {
    if (typeof window.updateAppealsButton === "function") window.updateAppealsButton();
  } catch (_) {}

  recomputeSummaryTiles();
  renderAll();
});

/* ================== HOOKI DLA AUTH ================== */
window.onAfterLogin = function () {
  recomputeSummaryTiles();
  renderAll();

  window.pointRequestsActive = computeActivePointRequests(window.pointRequestsAll);

  window.processAutoAcceptAppeals?.();
  window.processAutoAcceptPointRequests?.();
};

/* Zegar aktualizuje również widok bez zmiany danych i po wybudzeniu telefonu. */
async function refreshTimedState() {
  await autoCloseWeekIfDue();
  await window.processAutoAcceptAppeals?.();
  await window.processAutoAcceptPointRequests?.();
  window.pointRequestsActive = computeActivePointRequests(window.pointRequestsAll);
  recomputeSummaryTiles();
  renderWeekendInfo();
  renderAll();
}
setInterval(() => { refreshTimedState().catch(console.error); }, 15 * 1000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshTimedState().catch(console.error);
});
window.addEventListener("focus", () => { refreshTimedState().catch(console.error); });
window.addEventListener("load", () => {
  window.initAdminPublicNotes?.();
  refreshTimedState().catch(console.error);
});
