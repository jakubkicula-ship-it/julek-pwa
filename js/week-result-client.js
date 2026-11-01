/* Presentation only: existing settlement data remains the source of truth. */
(() => {
  "use strict";
  let summary, activeDialog, lastShown = "", audio, finishAudio;
  const seenKey = "julek-week-summary-seen";
  const mobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const child = () => document.getElementById("julek")?.style.display === "block" && !window.rodzic;
  const readSeen = () => { try { return localStorage.getItem(seenKey); } catch (_) { return null; } };

  function stopAudio() {
    if (audio) { audio.pause(); audio.currentTime = 0; }
    if (finishAudio) finishAudio();
    finishAudio = null;
  }
  function play(kind) {
    stopAudio();
    audio = new Audio(kind === "success" ? "./tada.mp3" : "./sad-trombone.mp3");
    audio.volume = .7;
    return new Promise((resolve, reject) => {
      finishAudio = resolve;
      audio.onended = () => { finishAudio = null; resolve(); };
      audio.onerror = () => { finishAudio = null; reject(new Error("Audio unavailable")); };
      audio.play().catch(error => { finishAudio = null; reject(error); });
    });
  }
  function showSummary() {
    if (activeDialog || document.visibilityState === "hidden") return;
    // Never replay older archived weeks when the app catches up after a long break.
    if (!summary || summary.weekKey !== previousBusinessWeekKey() || Date.now() < summary.endAt) return;
    if (!JulekWeekScreen.shouldShow(summary, {child: child(), mobile: mobile(), seen: readSeen(), lastShown})) return;
    activeDialog = JulekWeekScreen.open(summary, {
      play,
      acknowledge: id => { try { localStorage.setItem(seenKey, id); } catch (_) {} },
      onClose: () => { stopAudio(); activeDialog = null; }
    });
    if (activeDialog) lastShown = summary.weekKey;
  }
  const afterLogin = window.onAfterLogin;
  window.onAfterLogin = function (...args) {
    afterLogin?.apply(this, args);
    if (!child() && activeDialog) activeDialog.close();
    showSummary();
  };
  db.ref("meta/weekendSettlement").on("value", snapshot => {
    summary = snapshot.val(); showSummary();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      // Silence the result when the phone is locked or another app is opened.
      if (activeDialog) activeDialog.close();
    } else showSummary();
  });
})();
