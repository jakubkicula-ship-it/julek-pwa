// ./js/state.js
// Centralny stan aplikacji (bezpieczny adapter)

(function(){

  // główny obiekt stanu
  window.state = window.state || {};

  /* ================== AUTH ================== */
  window.state.auth = window.state.auth || {
    rodzic: (typeof window.rodzic === "string") ? window.rodzic : ""
  };

  /* ================== UI ================== */
  window.state.ui = window.state.ui || {
    showWholeWeekLogs: (typeof window.showWholeWeekLogs === "boolean")
      ? window.showWholeWeekLogs
      : false
  };

  /* ================== DANE ================== */
  window.state.data = window.state.data || {
    logsCache: window.logsCache || {},
    appealsByLog: window.appealsByLog || {},
    appealsList: window.appealsList || [],
    pointRequests: []   // <<< NOWE: wnioski o punkty
  };

  /* ================== ADAPTERY (TYLKO JEŚLI NIE ISTNIEJĄ) ================== */

  // rodzic
  if(!Object.getOwnPropertyDescriptor(window, "rodzic")){
    Object.defineProperty(window, "rodzic", {
      configurable: true,
      get(){ return window.state.auth.rodzic; },
      set(v){ window.state.auth.rodzic = v || ""; }
    });
  }

  // showWholeWeekLogs
  if(!Object.getOwnPropertyDescriptor(window, "showWholeWeekLogs")){
    Object.defineProperty(window, "showWholeWeekLogs", {
      configurable: true,
      get(){ return window.state.ui.showWholeWeekLogs; },
      set(v){ window.state.ui.showWholeWeekLogs = !!v; }
    });
  }

  // logsCache
  if(!Object.getOwnPropertyDescriptor(window, "logsCache")){
    Object.defineProperty(window, "logsCache", {
      configurable: true,
      get(){ return window.state.data.logsCache; },
      set(v){ window.state.data.logsCache = v || {}; }
    });
  }

  // appealsByLog
  if(!Object.getOwnPropertyDescriptor(window, "appealsByLog")){
    Object.defineProperty(window, "appealsByLog", {
      configurable: true,
      get(){ return window.state.data.appealsByLog; },
      set(v){ window.state.data.appealsByLog = v || {}; }
    });
  }

  // appealsList
  if(!Object.getOwnPropertyDescriptor(window, "appealsList")){
    Object.defineProperty(window, "appealsList", {
      configurable: true,
      get(){ return window.state.data.appealsList; },
      set(v){ window.state.data.appealsList = Array.isArray(v) ? v : []; }
    });
  }

  // pointRequests
  if(!Object.getOwnPropertyDescriptor(window, "pointRequests")){
    Object.defineProperty(window, "pointRequests", {
      configurable: true,
      get(){ return window.state.data.pointRequests; },
      set(v){ window.state.data.pointRequests = Array.isArray(v) ? v : []; }
    });
  }

  /* ================== WNIOSKI O PUNKTY (JULEK) ================== */

  // generator ID wniosku
  window.genPointRequestId = function(){
    return "pr_" + Date.now() + "_" + Math.random().toString(36).slice(2,8);
  };

  // fabryka nowego wniosku Julka
  window.createPointRequest = function(childComment){
    const now = Date.now();
    return {
      id: genPointRequestId(),
      created_at: now,
      expires_at: now + 12 * 60 * 60 * 1000, // +12h

      status: "pending",        // pending | accepted | accepted_auto | rejected
      points: 1,

      child_comment: childComment, // min 5 – walidacja później
      parent_comment: null,        // wymagany przy rejected (min 10)

      decided_by: null,            // "rodzic1" | "rodzic2"
      decided_at: null,

      applied: false               // czy punkt faktycznie doliczony
    };
  };

  // dodanie wniosku do stanu
  window.addPointRequest = function(req){
    window.state.data.pointRequests.push(req);
  };

  // selektory pomocnicze
  window.getPendingPointRequests = function(){
    return window.state.data.pointRequests.filter(r => r.status === "pending");
  };

  window.getPointRequestById = function(id){
    return window.state.data.pointRequests.find(r => r.id === id) || null;
  };

})();
