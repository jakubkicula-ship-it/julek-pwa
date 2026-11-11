(function (root) {
  "use strict";
  const permissions = {
    entries: "Dodawanie i wycofywanie własnych wpisów",
    decisions: "Zatwierdzanie i odrzucanie wniosków",
    appeals: "Rozpatrywanie odwołań",
    reminders: "Wysyłanie przypomnień",
    history: "Przegląd historii",
    announcements: "Zarządzanie ogłoszeniami",
    configure: "Menu, kafelki, punktacja i rozliczenia",
    integrations: "Ręczne sprawdzanie dziennika szkolnego",
    users: "Dodawanie, usuwanie i uprawnienia użytkowników",
    backups: "Pobieranie i przywracanie kopii",
    devices: "Przypisywanie telefonu dziecka",
  };
  const isAdministrator = (role) => role === "Kuba";
  const defaults = (role) =>
    Object.fromEntries(
      Object.keys(permissions).map((k) => [
        k,
        role === "Kuba" ||
          (role === "Julek" && k === "history") ||
          (role !== "Julek" &&
            [
              "entries",
              "decisions",
              "appeals",
              "reminders",
              "history",
            ].includes(k)),
      ]),
    );
  function allowed(profiles, role, key) {
    if (isAdministrator(role)) return true;
    const p = profiles?.[role];
    return (
      p?.active !== false &&
      (p?.permissions?.[key] ?? defaults(role)[key]) === true
    );
  }
  const actions = {
    entry: "entries",
    removeLog: "entries",
    decision: "decisions",
    appealDecision: "appeals",
    reminder: "reminders",
    toggleReminder: "reminders",
    adminNote: "announcements",
    hideNote: "announcements",
    saveConfig: "configure",
    schedule: "configure",
    scheduleException: "configure",
    adminAdjust: "configure",
    guardianInvite: "users",
    usersList: "users",
    userSave: "users",
    userDelete: "users",
    schoolGet: "integrations",
    schoolReview: "integrations",
    schoolSave: "integrations",
    schoolTest: "integrations",
    schoolSync: "integrations",
    schoolDisconnect: "integrations",
    exportBackup: "backups",
    exportSafetyBackup: "backups",
    previewBackup: "backups",
    restoreBackup: "backups",
    androidBind: "devices",
    androidUnbind: "devices",
  };
  root.JulekAccess = { permissions, defaults, allowed, actions, isAdministrator };
})(globalThis);
