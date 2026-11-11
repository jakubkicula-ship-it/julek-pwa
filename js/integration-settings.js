"use strict";
const can = (key) =>
  !!state.role && JulekAccess.allowed(state.data.usersV3, state.role, key);
let schoolDraft = null,
  schoolInfo = null,
  schoolPassword = "",
  schoolLoading = false,
  schoolSubmission = null,
  userRows = null,
  userDraft = null,
  settingsOwner = "";
const managesSchool = () => JulekAccess.isAdministrator(state.role);
const integrationSettingsBase = settings,
  integrationRenderBase = render,
  integrationLoginBase = loginView,
  integrationRequestCard = requestCard;
function schoolOption(value, label, selected) {
  return `<option value="${esc(value)}" ${value === selected ? "selected" : ""}>${esc(label)}</option>`;
}
function schoolInput(label, key, value, type = "text", extra = "") {
  return field(
    label,
    `<input data-school="${key}" type="${type}" value="${esc(value || "")}" ${extra}>`,
  );
}
settings = function () {
  let html = integrationSettingsBase();
  const rows =
    (!admin() && can("backups")
      ? row("Kopie danych", "Pobierz, sprawdź i przywróć", "history", "backups")
      : "") +
    (!admin() && can("devices")
      ? row(
          "Telefon dziecka",
          "Przypisanie urządzenia",
          "bell",
          "phone-binding",
        )
      : "") +
    (!admin() && can("announcements")
      ? row("Ogłoszenia", "Komunikaty dla rodziny", "book", "announcements")
      : "") +
    (can("users") && state.legacyServer === false
      ? row(
          "Użytkownicy i uprawnienia",
          "Dodawanie, usuwanie i przełączniki dostępu",
          "heart",
          "users",
        )
      : "") +
    (state.role
      ? row(
          "Synchronizacja z mobiDziennikiem",
          "Dane logowania i zakres pobierania",
          "book",
          "school",
        )
      : "");
  if (state.legacyServer === false) html = html.replace(
    row(
      "Opiekunowie",
      "Dodaj opiekuna przez zaproszenie e-mail",
      "heart",
      "guardians",
    ),
    "",
  );
  return html.replace(
    '<div class="section-label">TWOJE USTAWIENIA</div>',
    rows + '<div class="section-label">TWOJE USTAWIENIA</div>',
  );
};
loginView = function () {
  const template = document.createElement("template");
  template.innerHTML = integrationLoginBase();
  for (const b of template.content.querySelectorAll("[data-login]")) {
    const p = state.data.usersV3?.[b.dataset.login];
    if (p?.active === false) b.remove();
    else if (p?.name)
      b.textContent =
        p.name + (b.dataset.login === "Kuba" ? " – administrator" : "");
  }
  if (state.legacyServer === false) template.content.querySelector("[data-add-guardian]")?.remove();
  return template.innerHTML;
};
function schoolCredentials(placeholder, submitted = false) {
  const c = schoolDraft;
  return schoolInput("Adres dziennika szkoły", "url", c.url, "url",
    'placeholder="https://twojaszkola.mobidziennik.pl/dziennik" autocomplete="url"') +
    schoolInput("Login lub e-mail", "login", c.login, "text", 'maxlength="254"') +
    field("Hasło do dziennika",
      `<input data-school-password type="password" autocomplete="new-password" placeholder="${esc(placeholder)}">`,
      submitted ? "Hasło trafia do zaszyfrowanego zgłoszenia. Administrator może sprawdzić połączenie bez podglądu hasła."
        : "Hasło jest szyfrowane na serwerze.");
}
function schoolSwitch(type, label, key, checked) {
  return `<label class="switch-row"><span>${esc(label)}</span><input type="checkbox" role="switch" data-school-rule="${type}" data-key="${key}" ${checked ? "checked" : ""}></label>`;
}
function schoolSubmissionView() {
  const info = schoolInfo || {};
  return `${title("Synchronizacja z mobiDziennikiem", "settings")}
    <p>${info.active ? "Regularne sprawdzanie jest włączone." : "Regularne sprawdzanie jest wyłączone."}${info.lastSuccessAt ? " Ostatni odczyt: " + dateText(info.lastSuccessAt) + ", " + timeText(info.lastSuccessAt) + "." : ""}</p>
    ${info.submittedAt ? '<p role="status">Dane przekazano administratorowi. Czekają na sprawdzenie.</p>' : ""}
    <p>Wpisz dane logowania i zaznacz, co pobierać. Administrator sprawdzi połączenie i wybierze ucznia.</p>
    ${info.active && can("integrations") ? '<button class="secondary-button" data-school-action="sync" data-save-action>Sprawdź dziennik teraz</button>' : ""}
    <form autocomplete="off" onsubmit="return false">
      ${schoolCredentials("Wpisz hasło", true)}
      <h2>Co pobierać?</h2>
      ${Object.entries(JulekSchool.types).filter(([type]) => type !== "grade").map(([type, label]) =>
        schoolSwitch(type, label, "enabled", schoolDraft.rules[type].enabled)).join("")}
      <button type="button" class="primary-button" data-school-action="submit" data-save-action>Przekaż dane administratorowi</button>
      <p class="form-error" id="school-error" role="alert"></p>
    </form>`;
}
function schoolView() {
  if (state.legacyServer !== false)
    return title("Synchronizacja z mobiDziennikiem", "settings") +
      '<p class="notice">Synchronizacja czeka na aktualizację serwera i chroniony dostęp do danych.</p>';
  if (!schoolDraft) {
    if (!schoolLoading) loadSchoolSettings();
    return (
      title("Dziennik szkolny", "settings") + "<p>Wczytuję ustawienia…</p>"
    );
  }
  if (schoolInfo?.blocked)
    return title("Synchronizacja z mobiDziennikiem", "settings") +
      `<p class="notice" role="status">${esc(schoolInfo.blocked)}</p>` +
      (managesSchool() ? '<button class="secondary-button" data-go="users">Użytkownicy i uprawnienia</button>' : "");
  if (!managesSchool()) return schoolSubmissionView();
  const c = schoolDraft,
    s = schoolInfo?.status || {},
    students = s.students || [],
    count = c.times.length;
  return `${title("Synchronizacja z mobiDziennikiem", "settings")}${(schoolInfo.submissions || []).map(draft =>
    `<p>${esc(roleLabel(draft.role))} przekazał(a) dane ${dateText(draft.at)}. <button class="text-button" data-school-review="${esc(draft.role)}" data-school-submission="${esc(draft.id)}" data-save-action>Wczytaj zgłoszenie</button></p>`
  ).join("")}<p class="notice">Integracja testowa: układ dziennika może wymagać dostosowania adaptera. Po wpisaniu danych sprawdź połączenie i wynik odczytu, zanim włączysz automatyczne godziny.</p><p class="page-intro">Podaj dane tutaj. Sprawdzanie wykonuje usługa, również gdy telefon i komputer są wyłączone.</p><form autocomplete="off" onsubmit="return false"><h2>Połączenie</h2>${field("Dziennik", `<select data-school="provider">${schoolOption("mobidziennik", "mobiDziennik", c.provider)}</select>`, "Kolejni dostawcy wymagają osobnego adaptera; nie trzeba zmieniać reguł aplikacji.")}${schoolCredentials(schoolSubmission ? "Hasło przekazane przez użytkownika" : schoolInfo.hasPassword ? "Zapisane — wpisz tylko, aby zmienić" : "Wpisz hasło")}<button type="button" class="secondary-button" data-school-action="test" data-save-action>${schoolSubmission ? "Sprawdź zgłoszone połączenie" : "Zapisz dane i sprawdź połączenie"}</button>${field("Uczeń w dzienniku", `<select data-school="studentId"><option value="">Najpierw sprawdź połączenie</option>${students.map((p) => schoolOption(p.id, p.name, c.studentId)).join("")}</select>`, "Wpisy dotyczą wyłącznie wybranego ucznia.")}<h2>Kiedy sprawdzać?</h2>${field("Liczba sprawdzeń dziennie", `<select data-school-count>${Array.from({ length: 12 }, (_, i) => schoolOption(String(i + 1), String(i + 1), String(count))).join("")}</select>`)}<div class="school-times">${c.times.map((t, i) => field("Sprawdzenie " + (i + 1), `<input type="time" data-school-time="${i}" value="${esc(t)}">`)).join("")}</div><p class="annotation">Godziny według strefy Polska (Europe/Warsaw), ze zmianą czasu letniego i zimowego. W razie przerwy usługa ponowi sprawdzenie przy kolejnym terminie.</p><h2>Przypomnienia szkolne</h2>${schoolInput("Godzina codziennych przypomnień", "reminderTime", c.reminderTime ?? "15:00", "time")}<p class="annotation">Przypomnienia dla dziecka działają do dnia terminu włącznie. Wybierz poniżej, których wydarzeń mają dotyczyć.</p><h2>Co sprawdzać i jak reagować?</h2><p>Każdy rodzaj informacji włącz osobno. Zdarzenia z terminem są widoczne do końca tego dnia. Pierwszy odczyt zapisuje dotychczasowe oceny i uwagi jako stan początkowy, bez naliczania godzin.</p>${Object.entries(
    JulekSchool.types,
  )
    .map(([k, name]) => schoolRuleView(k, name, c.rules[k]))
    .join(
      "",
    )}<label class="switch-row"><span>Włącz regularne sprawdzanie</span><input type="checkbox" data-school="enabled" ${c.enabled ? "checked" : ""}><i></i></label><button type="button" class="primary-button" data-school-action="save" data-save-action>Zapisz ustawienia integracji</button><button type="button" class="secondary-button" data-school-action="sync" data-save-action>Sprawdź dziennik teraz</button>${Object.values(
    state.data.schoolWarningsV3 || {},
  )
    .slice(-10)
    .map((w) => '<p class="notice">' + esc(w.text) + "</p>")
    .join(
      "",
    )}<p class="notice" role="status">${esc(s.lastMessage || "Połączenie nie zostało jeszcze sprawdzone.")}${s.lastSuccessAt ? "<br>Ostatni pełny odczyt: " + dateText(s.lastSuccessAt) + ", " + timeText(s.lastSuccessAt) : ""}</p><button type="button" class="text-button" data-school-action="disconnect">Odłącz dziennik i usuń dane logowania</button><p class="form-error" id="school-error" role="alert"></p></form>`;
}
function schoolRuleView(k, name, r) {
  const future = JulekSchool.upcoming.includes(k),
    config = cfg(),
    categories = config.categories.filter(
      (c) =>
        c.visible !== false &&
        (k === "grade" ? c.format === "grades" : c.format === "single"),
    ),
    cat = config.categories.find((c) => c.id === r.category);
  const control = schoolSwitch(k, "Pobieraj: " + name.toLowerCase(), "enabled", r.enabled);
  if (!r.enabled) return control;
  const details = `${
    future
      ? `<label class="switch-row"><span>Przypominaj dziecku</span><input type="checkbox" data-school-rule="${k}" data-key="remind" ${r.remind !== false ? "checked" : ""}><i></i></label><label class="switch-row"><span>Pokazuj na tablicy ogłoszeń do dnia terminu</span><input type="checkbox" data-school-rule="${k}" data-key="board" ${r.board ? "checked" : ""}><i></i></label>${field(
          "Dla kogo widoczne?",
          `<select data-school-rule="${k}" data-key="audience">${[
            ["both", "Dziecko i rodzice"],
            ["parents", "Tylko rodzice"],
            ["child", "Tylko dziecko"],
          ]
            .map(([v, l]) => schoolOption(v, l, r.audience))
            .join("")}</select>`,
        )}`
      : `${k === "grade"
        ? schoolSwitch(k, "Naliczaj automatycznie punkty za oceny", "autoGrade", r.mode === "auto") +
          (r.mode === "auto" ? "" : schoolSwitch(k, "Przekazuj propozycje punktów do zatwierdzenia", "proposeGrade", r.mode === "propose"))
        : field(
          "Wpływ na godziny",
          `<select data-school-rule="${k}" data-key="mode">${[
            ["none", "Tylko odczyt — bez godzin"],
            ["propose", "Wniosek systemowy — rodzic zatwierdza"],
            ["auto", "Naliczaj automatycznie według kafelka"],
          ]
            .map(([v, l]) => schoolOption(v, l, r.mode))
            .join("")}</select>`,
        )}${
          r.mode !== "none"
            ? `${r.mode === "auto" ? '<p class="notice">Nowe wpisy tego rodzaju będą zmieniały bilans bez zatwierdzenia rodzica.</p>' : ""}${field("Powiąż z kategorią menu", `<select data-school-rule="${k}" data-key="category"><option value="">Wybierz kategorię</option>${categories.map((c) => schoolOption(c.id, c.name, r.category)).join("")}</select>`)}${
                k === "grade"
                  ? `<p class="annotation">Godziny wynikają z ocen i grup przedmiotów w Menu i kafelki. Dokładnie przypisz nazwy przedmiotów z dziennika; oceny z +/− bez odpowiednika wymagają ręcznego rozpatrzenia.</p>${Object.entries(
                      r.subjectMap || {},
                    )
                      .map(
                        ([source, id]) =>
                          `<div class="subject-mapping"><strong>${esc(source)}</strong><select data-school-subject="${esc(source)}"><option value="">Bez powiązania</option>${config.subjects
                            .filter((s) => s.visible !== false)
                            .map((s) => schoolOption(s.id, s.name, id))
                            .join(
                              "",
                            )}</select><button type="button" class="text-button" data-remove-school-subject="${esc(source)}">Usuń</button></div>`,
                      )
                      .join(
                        "",
                      )}${field("Nazwa przedmiotu w dzienniku", '<input id="school-subject-name" placeholder="np. język polski" maxlength="100">')}<button type="button" class="secondary-button" data-add-school-subject>Dodaj powiązanie przedmiotu</button>`
                  : field(
                      "Kafelek i punktacja",
                      `<select data-school-rule="${k}" data-key="item"><option value="">Wybierz kafelek</option>${(
                        cat?.items || []
                      )
                        .filter((i) => i.visible !== false)
                        .map((i) =>
                          schoolOption(
                            i.id,
                            i.name + " · " + hours(i.h),
                            r.item,
                          ),
                        )
                        .join("")}</select>`,
                    )
              }`
            : ""
        }`
  }`;
  if (k === "grade") return control + '<div class="school-grade-options">' + details + "</div>";
  return control + `<details class="fold school-rule" data-fold="school-rule-${k}">
    <summary>Ustawienia: ${esc(name.toLowerCase())}</summary>${details}</details>`;
}
async function loadSchoolSettings() {
  const owner = state.role;
  schoolLoading = true;
  try {
    const administrator = managesSchool();
    const result = await request({ action: administrator ? "schoolGet" : "schoolOverview" });
    if (owner !== state.role) return;
    schoolInfo = result;
    schoolDraft = structuredClone(administrator ? result.config : JulekSchool.defaults());
    schoolSubmission = null;
    schoolPassword = "";
  } catch (e) {
    if (owner !== state.role) return;
    schoolInfo = {
      config: JulekSchool.defaults(),
      hasPassword: false,
      status: { lastMessage: e.message },
    };
    schoolDraft = structuredClone(schoolInfo.config);
    toast(e.message);
  } finally {
    schoolLoading = false;
    if (state.view === "school" && schoolDraft) render();
  }
}
function usersView() {
  if (!can("users"))
    return "<p>Nie masz uprawnienia do zarządzania użytkownikami.</p>";
  if (!userRows) {
    loadUsers();
    return title("Użytkownicy", "settings") + "<p>Wczytuję użytkowników…</p>";
  }
  if (userDraft) return userEditView();
  return `${title("Użytkownicy i uprawnienia", "settings")}<p>Usunięcie odbiera dostęp. Wcześniejsze wpisy i historia pozostają zachowane.</p>${userRows.map((u) => `<article class="user-card"><strong>${esc(u.name)}${u.id === "Kuba" ? " – administrator" : ""}</strong><small>${u.active === false ? "Dostęp usunięty" : u.id === "Kuba" ? "Pełne uprawnienia" : "Aktywny użytkownik"}</small>${u.id !== "Kuba" ? `<button class="secondary-button" data-edit-user="${u.id}">Uprawnienia i dane</button>${u.active !== false ? `<button class="text-button" data-delete-user="${u.id}">Usuń dostęp</button>` : ""}` : ""}</article>`).join("")}<button class="primary-button" data-new-user>Dodaj użytkownika</button><p class="annotation">Dodatkowy użytkownik otrzymuje własny PIN i wybrane uprawnienia. Kuba – administrator ma zawsze pełny dostęp.</p>`;
}
function userEditView() {
  const u = userDraft;
  return `${title(u.id ? "Uprawnienia użytkownika" : "Dodaj użytkownika", "users")}<form onsubmit="return false">${field("Nazwa", '<input data-user-field="name" maxlength="40" value="' + esc(u.name) + '">')}${field(u.id ? "Nowy PIN (pozostaw puste, aby zachować)" : "PIN użytkownika", '<input data-user-field="pin" type="password" inputmode="numeric" autocomplete="new-password" maxlength="8" value="' + esc(u.pin || "") + '">', "Od 4 do 8 cyfr. Przekaż PIN użytkownikowi osobiście.")}<label class="switch-row"><span>Dostęp do aplikacji</span><input type="checkbox" data-user-field="active" ${u.active ? "checked" : ""}><i></i></label><h2>Uprawnienia</h2>${Object.entries(
    JulekAccess.permissions,
  )
    .map(
      ([k, name]) =>
        `<label class="switch-row"><span>${esc(name)}</span><input type="checkbox" data-user-permission="${k}" ${u.id === "Julek" && k !== "history" ? "disabled" : ""} ${u.permissions[k] ? "checked" : ""}><i></i></label>`,
    )
    .join(
      "",
    )}<button type="button" class="primary-button" data-save-user data-save-action>Zapisz użytkownika</button><button type="button" class="text-button" data-cancel-user>Anuluj</button><p class="form-error" id="user-error" role="alert"></p></form>`;
}
async function loadUsers() {
  if (state.usersLoading) return;
  state.usersLoading = true;
  try {
    const r = await request({ action: "usersList" });
    userRows = r.users;
    render();
  } catch (e) {
    toast(e.message);
  } finally {
    state.usersLoading = false;
  }
}
requestCard = function (r) {
  return integrationRequestCard(r).replace(
    "Wnioski Julka",
    "Wnioski o godziny",
  );
};
render = function () {
  const openFolds = new Set(
      [...document.querySelectorAll("details[data-fold][open]")].map(
        (e) => e.dataset.fold,
      ),
    ),
    scrollTop = $("#screen")?.scrollTop || 0;
  if (settingsOwner !== state.role) {
    settingsOwner = state.role;
    schoolDraft = null;
    schoolInfo = null;
    schoolSubmission = null;
    schoolPassword = "";
    userRows = null;
    userDraft = null;
  }
  integrationRenderBase();
  if (!state.role) return;
  const profile = state.data.usersV3?.[state.role];
  if (profile?.active === false) {
    state.role = "";
    state.token = "";
    store("session", {});
    integrationRenderBase();
    return;
  }
  if (state.view === "school") {
    $("#screen").innerHTML = schoolView();
    const passwordInput = $("[data-school-password]");
    if (passwordInput) passwordInput.value = schoolPassword;
  }
  if (state.view === "users") $("#screen").innerHTML = usersView();
  if (state.view === "history" && !can("history"))
    $("#screen").innerHTML =
      title("Historia") + "<p>Administrator wyłączył dostęp do historii.</p>";
  if (state.view === "announcements")
    $("#screen").innerHTML = can("announcements")
      ? title("Ogłoszenia", "settings") +
        field("Treść", '<textarea id="admin-note"></textarea>') +
        '<button class="primary-button" data-admin-note>Dodaj ogłoszenie</button>'
      : settings();
  if (state.view === "backups" && can("backups"))
    $("#screen").innerHTML = backupView().replace(
      "Tylko Kuba",
      "Administrator",
    );
  for (const f of document.querySelectorAll("details[data-fold]"))
    if (openFolds.has(f.dataset.fold)) f.open = true;
  if (["school", "users"].includes(state.view))
    $("#screen").scrollTop = scrollTop;
  for (const b of document.querySelectorAll(
    "[data-go],[data-approve],[data-reject],[data-change],[data-submit-entry],[data-retract]",
  )) {
    const d = b.dataset,
      v = d.go || "";
    const required =
      "approve" in d || "reject" in d || "change" in d
        ? "decisions"
        : ("retract" in d || "submitEntry" in d) && isParent()
          ? "entries"
          : v === "reminders"
            ? "reminders"
            : v === "history"
              ? "history"
              : v === "backups"
                ? "backups"
                : v === "phone-binding"
                  ? "devices"
                  : null;
    if (required && !can(required)) b.hidden = true;
  }
};
document.addEventListener("input", (e) => {
  const t = e.target;
  if (t.hasAttribute("data-school-password")) schoolPassword = t.value;
  if (t.dataset.school && !["enabled", "studentId"].includes(t.dataset.school))
    schoolDraft[t.dataset.school] = t.value;
  if (
    t.dataset.userField &&
    !["active"].includes(t.dataset.userField) &&
    userDraft
  )
    userDraft[t.dataset.userField] = t.value;
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.school && schoolDraft) {
    const key = t.dataset.school;
    if (key === "studentId" && !schoolDraft.studentId && t.value) schoolDraft.enabled = true;
    schoolDraft[key] = t.type === "checkbox" ? t.checked : t.value;
    if (key === "studentId") render();
  }
  if (t.hasAttribute("data-school-count")) {
    const n = Number(t.value);
    schoolDraft.times = Array.from(
      { length: n },
      (_, i) =>
        schoolDraft.times[i] ||
        String(Math.floor((24 * i) / n)).padStart(2, "0") + ":00",
    );
    render();
  }
  if (t.hasAttribute("data-school-time"))
    schoolDraft.times[Number(t.dataset.schoolTime)] = t.value;
  if (t.dataset.schoolRule) {
    const r = schoolDraft.rules[t.dataset.schoolRule], key = t.dataset.key;
    if (key === "autoGrade") r.mode = t.checked ? "auto" : "propose";
    else if (key === "proposeGrade") r.mode = t.checked ? "propose" : "none";
    else r[key] = t.type === "checkbox" ? t.checked : t.value;
    if (key === "category") r.item = "";
    if (t.dataset.schoolRule === "grade" && r.mode !== "none" && !r.category)
      r.category = cfg().categories.find(c => c.format === "grades" && c.visible !== false)?.id || "";
    if (managesSchool() && ["enabled", "mode", "category", "autoGrade", "proposeGrade"].includes(key)) render();
  }
  if (t.dataset.schoolSubject)
    schoolDraft.rules.grade.subjectMap[t.dataset.schoolSubject] = t.value;
  if (t.dataset.userPermission && userDraft)
    userDraft.permissions[t.dataset.userPermission] = t.checked;
  if (t.dataset.userField === "active" && userDraft)
    userDraft.active = t.checked;
});
document.addEventListener(
  "click",
  async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const d = b.dataset;
    try {
      if (d.go === "users" && userDraft) {
        userDraft = null;
        render();
        return;
      }
      if (d.go === "school" && state.legacyServer === false && !schoolDraft && !schoolLoading) {
        loadSchoolSettings();
        return;
      }
      if ("newUser" in d) {
        userDraft = {
          name: "",
          pin: "",
          active: true,
          permissions: Object.fromEntries(
            Object.keys(JulekAccess.permissions).map((k) => [k, false]),
          ),
        };
        render();
      }
      if (d.editUser) {
        userDraft = {
          ...structuredClone(userRows.find((u) => u.id === d.editUser)),
          pin: "",
        };
        render();
      }
      if ("cancelUser" in d) {
        userDraft = null;
        render();
      }
      if ("saveUser" in d) {
        await request({ action: "userSave", ...userDraft });
        userDraft = null;
        userRows = null;
        await loadData();
        await loadUsers();
        toast("Użytkownik i uprawnienia zapisane.");
      }
      if (d.deleteUser) {
        const u = userRows.find((u) => u.id === d.deleteUser);
        modal(
          `<h2>Usunąć dostęp: ${esc(u.name)}?</h2><p>Użytkownik nie będzie mógł korzystać z panelu. Jego wcześniejsze wpisy zostaną w historii.</p><button class="primary-button" data-confirm-delete-user="${u.id}">Usuń dostęp</button><button class="text-button" data-close>Anuluj</button>`,
        );
      }
      if (d.confirmDeleteUser) {
        await request({ action: "userDelete", id: d.confirmDeleteUser });
        closeModal();
        userRows = null;
        await loadData();
        await loadUsers();
        toast("Dostęp użytkownika usunięty.");
      }
      if ("addSchoolSubject" in d) {
        const name = $("#school-subject-name").value.trim();
        if (!name) throw Error("Wpisz nazwę przedmiotu z dziennika.");
        schoolDraft.rules.grade.subjectMap[name] = "";
        render();
      }
      if (d.removeSchoolSubject) {
        delete schoolDraft.rules.grade.subjectMap[d.removeSchoolSubject];
        render();
      }
      if (d.schoolReview && managesSchool()) {
        const submission = {role:d.schoolReview, id:d.schoolSubmission};
        const result = await request({action:"schoolReview", submission});
        schoolDraft = result.config;
        schoolInfo = {...schoolInfo, ...result};
        schoolSubmission = submission;
        schoolPassword = "";
        render();
        return;
      }
      if (d.schoolAction === "submit" && !managesSchool()) {
        await request({action:"schoolSubmit", config:schoolDraft, password:schoolPassword});
        schoolPassword = "";
        await loadSchoolSettings();
        toast("Dane przekazano administratorowi.");
        return;
      }
      if (d.schoolAction === "sync" && !managesSchool() && can("integrations")) {
        const result = await request({action:"schoolSync"});
        await loadSchoolSettings();
        await loadData();
        toast(result.busy ? "Sprawdzanie już trwa." : "Zakończono sprawdzanie dziennika.");
        return;
      }
      if (d.schoolAction === "test" && schoolSubmission && managesSchool()) {
        const result = await request({action:"schoolTest", submission:schoolSubmission,
          config:schoolDraft, password:schoolPassword});
        schoolInfo.status = {...schoolInfo.status, students:result.students, lastMessage:"Połączenie sprawdzone. Wybierz ucznia."};
        render();
        return;
      }
      if (d.schoolAction && managesSchool()) {
        if (d.schoolAction === "disconnect") {
          modal(
            '<h2>Odłączyć dziennik?</h2><p>Usunę zapisane dane logowania i zatrzymam sprawdzanie. Wcześniej naliczone godziny i decyzje pozostaną w historii.</p><button class="primary-button" data-school-disconnect>Odłącz i usuń dane logowania</button><button class="text-button" data-close>Anuluj</button>',
          );
          return;
        }
        if (["save", "test"].includes(d.schoolAction)) {
          const config = {
            ...schoolDraft,
            enabled: d.schoolAction === "test" ? false : schoolDraft.enabled,
          };
          await request({
            action: "schoolSave",
            config,
            password: schoolPassword,
            ...(schoolSubmission ? {submission:schoolSubmission} : {}),
          });
          schoolPassword = "";
          schoolSubmission = null;
        }
        if (d.schoolAction === "test") await request({ action: "schoolTest" });
        if (d.schoolAction === "sync") {
          const result = await request({ action: "schoolSync" });
          if (result.busy) {
            toast("Sprawdzanie już trwa. Odśwież status za chwilę.");
            return;
          }
        }
        await loadSchoolSettings();
        await loadData();
        toast(
          d.schoolAction === "save"
            ? "Ustawienia zapisane."
            : d.schoolAction === "test"
              ? "Połączenie sprawdzone. Wybierz ucznia."
              : "Zakończono sprawdzanie dziennika.",
        );
      }
      if ("schoolDisconnect" in d) {
        await request({ action: "schoolDisconnect" });
        closeModal();
        schoolDraft = null;
        await loadSchoolSettings();
        await loadData();
        toast("Odłączono dziennik.");
      }
    } catch (err) {
      const target = $("#school-error") || $("#user-error");
      if (target) target.textContent = err.message;
      toast(err.message);
    }
  },
  true,
);
// Public identity list carries no PINs, credentials or permission grants.
request({ action: "userProfiles" }, false)
  .then((r) => {
    state.data.usersV3 ||= {};
    for (const p of r.profiles)
      state.data.usersV3[p.id] = {
        ...state.data.usersV3[p.id],
        name: p.name,
        active: true,
      };
    if (!state.role) render();
  })
  .catch(() => {});
render();
