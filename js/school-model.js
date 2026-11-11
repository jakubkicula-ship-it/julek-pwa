(function (root) {
  "use strict";
  const types = {
    homework: "Zadania domowe",
    exam: "Sprawdziany",
    quiz: "Kartkówki",
    grade: "Oceny",
    positive: "Uwagi pozytywne",
    negative: "Uwagi negatywne",
    attendance: "Frekwencja",
  };
  const upcoming = ["homework", "exam", "quiz"];
  const labels = {homework: "Zadanie domowe", exam: "Sprawdzian", quiz: "Kartkówka"};
  const providerNames = {mobidziennik: "mobiDziennik"};
  const isTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  function defaults() {
    return {
      provider: "mobidziennik",
      url: "",
      login: "",
      studentId: "",
      studentName: "",
      enabled: false,
      times: ["07:00", "20:00"],
      timeZone: "Europe/Warsaw",
      reminderTime: "15:00",
      rules: Object.fromEntries(
        Object.keys(types).map((k) => [
          k,
          {
            enabled: upcoming.includes(k),
            board: upcoming.includes(k),
            remind: upcoming.includes(k),
            audience: "both",
            mode: ["grade", "positive", "negative"].includes(k)
              ? "propose"
              : "none",
            category: "",
            item: "",
            subjectMap: {},
          },
        ]),
      ),
    };
  }
  function validate(c) {
    const fail = (m) => {
      throw Error(m);
    };
    if (!c || c.provider !== "mobidziennik")
      fail("Wybierz obsługiwany dziennik.");
    let u;
    try {
      u = new URL(c.url);
    } catch {
      fail("Wpisz pełny adres strony logowania, zaczynający się od https://.");
    }
    if (
      u.protocol !== "https:" ||
      !/^[a-z0-9-]+\.mobidziennik\.pl$/.test(u.hostname) ||
      u.port ||
      u.username ||
      u.password ||
      u.search ||
      u.hash
    )
      fail(
        "Podaj adres szkoły w domenie mobidziennik.pl, bez dodatkowych parametrów.",
      );
    if (!String(c.login || "").trim() || c.login.length > 254)
      fail("Wpisz login do dziennika.");
    if (
      !Array.isArray(c.times) ||
      !c.times.length ||
      c.times.length > 12 ||
      c.times.some((t) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) ||
      new Set(c.times).size !== c.times.length
    )
      fail("Ustaw od 1 do 12 różnych godzin sprawdzania.");
    if (c.studentId && !/^\d{1,12}$/.test(c.studentId))
      fail("Wybierz ucznia z listy po sprawdzeniu połączenia.");
    if (c.reminderTime != null && !isTime(c.reminderTime))
      fail("Wybierz godzinę przypomnień szkolnych.");
    const out = {
      ...defaults(),
      provider: c.provider,
      url: u.origin + "/dziennik",
      login: c.login.trim(),
      studentId: String(c.studentId || ""),
      studentName: String(c.studentName || "").slice(0, 100),
      enabled: c.enabled === true,
      times: c.times.slice().sort(),
      reminderTime: c.reminderTime ?? defaults().reminderTime,
      rules: {},
    };
    for (const k of Object.keys(types)) {
      const r = c.rules?.[k] || {};
      if (
        !["none", "propose", "auto"].includes(r.mode || "none") ||
        !["both", "parents", "child"].includes(r.audience || "both")
      )
        fail("Sprawdź sposób działania reguły.");
      if (upcoming.includes(k) && (r.mode || "none") !== "none")
        fail("Zadania i sprawdziany nie naliczają godzin.");
      out.rules[k] = {
        enabled: r.enabled === true,
        board: r.board === true,
        remind: upcoming.includes(k) && r.remind !== false,
        audience: r.audience || "both",
        mode: r.mode || "none",
        category: String(r.category || "").slice(0, 80),
        item: String(r.item || "").slice(0, 80),
        subjectMap: Object.fromEntries(
          Object.entries(r.subjectMap || {})
            .slice(0, 100)
            .map(([a, b]) => [String(a).slice(0, 100), String(b).slice(0, 80)]),
        ),
      };
    }
    if (out.enabled && !out.studentId)
      fail("Najpierw sprawdź połączenie i wybierz ucznia.");
    return out;
  }
  function visible(events, role, now = Date.now()) {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Warsaw",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    return Object.values(events || {})
      .filter(
        (e) =>
          e.board &&
          !e.cancelled &&
          /^\d{4}-\d{2}-\d{2}$/.test(e.dueDate || "") &&
          e.dueDate >= today &&
          (role !== "Julek" || !e.childId || e.childId === role) &&
          (e.audience === "both" ||
            (role === "Julek"
              ? e.audience === "child"
              : e.audience === "parents")),
      )
      .sort(
        (a, b) =>
          a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title),
      );
  }
  root.JulekSchool = { types, labels, providerNames, upcoming, defaults, validate, visible };
})(globalThis);
