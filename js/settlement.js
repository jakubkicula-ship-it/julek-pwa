/* Rozliczenie w jednej transakcji: brak kasowania wpisów przy zamknięciu. */
(function (root) {
  "use strict";
  const status = value => String(value || "pending").trim().toLowerCase();
  const stamp = value => Number(value?.createdAt ?? value?.created_at ?? 0);
  const comment = value => String(value.child_comment || value.childComment || value.komentarzDziecka || "").trim().replace(/\s+/g, " ");
  const dateOf = value => value.data || (stamp(value) ? warsawDateIso(stamp(value)) : "");
  const keyOf = (date, ts) => ts ? businessWeekKeyFromTs(ts) : businessWeekKeyFromIsoDate(date);
  const accepted = value => ["accepted", "accepted_auto"].includes(status(value));

  function effectiveHours(data, date, id, log) {
    const neutralized = Object.values(data.odwolania || {}).some(a =>
      a.data === date && a.logId === id && accepted(a.status));
    return neutralized ? 0 : Number(log.h || 0);
  }

  function dueWeeks(data, now) {
    const current = businessWeekKeyFromTs(now);
    const keys = new Set([previousBusinessWeekKey(now)]);
    for (const [date, logs] of Object.entries(data.log || {})) {
      for (const log of Object.values(logs || {})) keys.add(keyOf(date, Number(log.ts || 0)));
    }
    for (const request of Object.values(data.wnioski_punkty || {})) {
      if (status(request.status) === "pending") keys.add(keyOf(dateOf(request), stamp(request)));
    }
    for (const appeal of Object.values(data.odwolania || {})) {
      if (status(appeal.status) === "pending") keys.add(keyOf(appeal.data, stamp(appeal)));
    }
    return [...keys].filter(key => key && key < current && !data.meta?.weekClosures?.[key]).sort();
  }

  function settleWeek(data, key, now, reason) {
    data.meta = data.meta || {};
    data.meta.weekClosures = data.meta.weekClosures || {};
    if (data.meta.weekClosures[key]) return false;
    const bounds = businessWeekBounds(key);
    if (!bounds || bounds.end > now) return false;
    data.log = data.log || {};

    // Najpierw decyzje dotyczące kończącego się tygodnia. Data punktu to data wniosku.
    const requests = Object.entries(data.wnioski_punkty || {}).sort((a,b) => stamp(a[1]) - stamp(b[1]) || a[0].localeCompare(b[0]));
    for (const [id, request] of requests) {
      const date = dateOf(request);
      if (keyOf(date, stamp(request)) !== key || status(request.status) !== "pending") continue;
      const day = data.log[date] = data.log[date] || {};
      const fp = request.fingerprint || `${date}|${comment(request).toLowerCase()}`;
      const existing = Object.entries(day).find(([, log]) => log.prKey === id) ||
        (request.logKey && day[request.logKey] ? [request.logKey, day[request.logKey]] : null);
      const duplicate = !existing && !request.applied && (
        Object.values(day).some(log => log.prKey !== id && log.fingerprint === fp) ||
        requests.some(([otherId, other]) => otherId !== id && dateOf(other) === date &&
          accepted(other.status) && (other.fingerprint || `${date}|${comment(other).toLowerCase()}`) === fp));
      if (request.locked && now - Number(request.lockedAt || 0) < 120000) {
        throw new Error("Trwa rozpatrywanie wniosku. Rozliczenie zostanie ponowione.");
      }
      request.status = duplicate ? "rejected" : "accepted_auto";
      request.kto = "system_weekclose";
      request.decyzjaAt = now;
      request.komentarz = duplicate ? "Duplikat wniosku – nie naliczono ponownie." : "Zamknięcie tygodnia – wniosek zaakceptowany automatycznie.";
      request.archived = true;
      request.closedAt = now;
      request.closedReason = "week_close";
      request.locked = false;
      request.lockedAt = null;
      request.lockedBy = "";
      request.fingerprint = fp;
      if (!duplicate) {
        const logId = existing?.[0] || request.logKey || `settled_${id}`;
        if (!existing) day[logId] = {
          h: 1, opis: `Wniosek Julka: ${comment(request)} (zaakceptowane automatycznie)`,
          rodzic: "system", category: "wniosek_punkt", ts: stamp(request) || warsawTimestamp(date, 12), prKey: id, fingerprint: fp
        };
        request.applied = true;
        request.logKey = logId;
        request.logDate = date;
      }
    }
    for (const appeal of Object.values(data.odwolania || {})) {
      if (status(appeal.status) !== "pending" || keyOf(appeal.data, stamp(appeal)) !== key) continue;
      Object.assign(appeal, { status: "accepted_auto", kto: "system_weekclose", decyzjaAt: now,
        komentarz: "Zamknięcie tygodnia – odwołanie zaakceptowane automatycznie." });
    }
    let sum = 0;
    const days = new Set();
    for (const [date, logs] of Object.entries(data.log)) {
      for (const [id, log] of Object.entries(logs || {})) {
        if (keyOf(date, Number(log.ts || 0)) !== key) continue;
        sum += effectiveHours(data, date, id, log);
        days.add(date);
      }
    }
    // Dzienne sumy są pomocnicze. Nie nadpisuj całego węzła dni.
    data.dni = data.dni || {};
    for (const date of days) data.dni[date] = Object.entries(data.log[date]).reduce((s, [id, log]) => s + effectiveHours(data, date, id, log), 0);
    const bonus = sum >= 0 ? root.JULEK_SETTINGS.weekendBonus : 0;
    const result = { weekKey: key, startAt: bounds.start, endAt: bounds.end, closedAt: now,
      earnedHours: sum, bonusHours: bonus, hours: sum + bonus, reason };
    data.meta.weekClosures[key] = result;
    // Wykonanie zaległego rozliczenia w poniedziałek nie przedłuża weekendu.
    if (!data.meta.weekendSettlement || data.meta.weekendSettlement.endAt <= result.endAt) {
      data.meta.weekendSettlement = result;
      data.weekend = result.hours;
      data.meta.lastCloseWeekKey = key;
      data.meta.lastCloseAt = now;
      data.meta.lastCloseReason = reason;
    }
    return true;
  }

  function purgeOldHistory(data, now) {
    const cutoff = isoDateShift(warsawDateIso(now), -(root.JULEK_SETTINGS.historyDays - 1));
    const old = date => /^\d{4}-\d{2}-\d{2}$/.test(date || "") && date < cutoff;
    for (const node of ["log", "dni", "wnioski_punkty_fplock"]) {
      for (const date of Object.keys(data[node] || {})) if (old(date)) delete data[node][date];
    }
    for (const [id, request] of Object.entries(data.wnioski_punkty || {})) {
      if (old(dateOf(request))) delete data.wnioski_punkty[id];
    }
    for (const [id, appeal] of Object.entries(data.odwolania || {})) {
      if (old(appeal.data || (stamp(appeal) ? warsawDateIso(stamp(appeal)) : ""))) delete data.odwolania[id];
    }
    data.meta = data.meta || {};
    data.meta.lastHistoryCleanupDay = warsawDateIso(now);
  }

  root.JulekSettlement = Object.freeze({ dueWeeks, settleWeek, effectiveHours, purgeOldHistory });
})(globalThis);
