// ./js/parent.js
// Logika panelu RODZICA – WERSJA STABILNA (z poprawkami: log nie znika, lista tylko aktywne 12h, pending na górze)

(function(){

  const PR_PATH = "wnioski_punkty";
  const H12 = 12 * 60 * 60 * 1000;

  function isoFromTsWarsaw(ts){
    return new Date(ts).toLocaleDateString("en-CA", { timeZone: "Europe/Warsaw" });
  }

  function prCreatedAt(o){
    return o?.createdAt ?? o?.created_at ?? 0;
  }

  function prExpiresAt(o){
    const c = prCreatedAt(o);
    return o?.expiresAt ?? o?.expires_at ?? (c ? (c + H12) : 0);
  }

  function prDateIso(o){
    const c = prCreatedAt(o);
    return o?.data || (c ? isoFromTsWarsaw(c) : (typeof todayIso==="function" ? todayIso() : ""));
  }

  function prChildComment(o){
    return (o?.child_comment || o?.komentarzDziecka || o?.child_commentary || o?.childComment || "").toString().trim();
  }

  function prParentComment(o){
    return (o?.komentarz || o?.parent_comment || o?.komentarzRodzica || "").toString().trim();
  }

  function prWho(o){
    return (o?.kto || o?.decided_by || "").toString();
  }

  function prStatus(o){
    return (o?.status || "pending").toString();
  }

  function prKey(o){
    return o?.key || o?.firebaseKey || o?.id || null;
  }

  function isExpired(o){
    const exp = prExpiresAt(o);
    return !!(exp && Date.now() > exp);
  }

  // czy ma sens pokazywać w "Wnioski o punkty" (czyli czy przyciski mogą być aktywne)
  function isActionableForList(o){
    if(!o) return false;
    const st = prStatus(o).toLowerCase();
    if(st === "accepted_auto") return false;
    if(isExpired(o)) return false;

    const who = prWho(o) || "";

    // nierozpatrzone – każdy może, dopóki nikt nie kliknął
    if(st === "pending") return !who;

    // zmiana decyzji – tylko ten sam rodzic, który decydował
    if(st === "accepted" || st === "rejected") return who === rodzic;

    return false;
  }

  async function ensureRequestLogExists(key, cur){
    // jeśli już jest logKey/logDate – OK
    if(cur?.logKey && cur?.logDate) return { logKey: cur.logKey, logDate: cur.logDate };

    const createdAt = prCreatedAt(cur) || Date.now();
    const dateIso = prDateIso(cur);
    const childC = prChildComment(cur);

    // tworzymy log "w toku" (h=0) – bez zmiany salda
    const ref = db.ref("log/"+dateIso).push();
    await ref.set({
      h: 0,
      opis: `Wniosek Julka: ${childC} (w toku)`,
      rodzic: "system",
      category: "wniosek_punkt",
      ts: createdAt
    });

    const logKey = ref.key;
    const logDate = dateIso;

    // dopinamy do rekordu wniosku (żeby potem tylko update'ować ten sam log)
    await db.ref(PR_PATH+"/"+key).update({
      logKey,
      logDate,
      data: dateIso,
      applied: !!cur?.applied
    });

    return { logKey, logDate };
  }

  async function setLogStatus(logDate, logKey, childComment, statusLabel, parentReason){
    if(!logDate || !logKey) return;

    const base = `Wniosek Julka: ${childComment}`;
    const st = statusLabel ? ` (${statusLabel})` : "";
    const reason = parentReason ? ` – powód: ${parentReason}` : "";

    await db.ref("log/"+logDate+"/"+logKey).update({
      opis: base + st + reason
    });
  }

  async function setLogHours(logDate, logKey, h){
    if(!logDate || !logKey) return;
    await db.ref("log/"+logDate+"/"+logKey).update({ h: Number(h||0) });
  }

  async function applyPointToDay(dateIso){
    await db.ref("dni/"+dateIso).transaction(v => (v || 0) + 1);
  }

  async function revertPointFromDay(dateIso){
    await db.ref("dni/"+dateIso).transaction(v => (v || 0) - 1);
  }

  /* ================== INIT ================== */
  window.initParentPanel = function(){
    window.renderParentLogs?.();
    window.renderParentAppeals?.();
    window.updateAppealsButton?.();

    window.renderParentPointRequests?.();
    window.updatePointRequestsButton?.();

    mountGrades();
  };

  /* ================== GODZINY UZNANIOWE ================== */
  window.uzn = function(h){
    const t = prompt("Za co? (wymagane)");
    if(!t || t.trim().length < 3){
      alert("Wpisz sensowny opis (min. 3 znaki).");
      return;
    }
    zapis(h, "Uznaniowe: " + t.trim(), "uzn", false);
  };

  /* ================== OBOW / ZACH ================== */
  window.obow = function(h, label, category, checkDuplicate){
    let note = prompt("Dodatkowy komentarz? (opcjonalnie)");
    note = (note || "").trim();
    const full = note ? `${label}: ${note}` : label;
    zapis(h, full, category, checkDuplicate);
  };

  /* ================== OCENY ================== */
  const oceny1 = { np:-5, 1:-5, 2:-2, 3:-0.5, 4:1, 5:2, 6:3 };
  const oceny2 = { np:-5, bs:-5, 1:-2, 2:-1, 3:-0.5, 4:1, 5:1.5, 6:2 };
  const oceny3 = { np:-5, 1:-10, 2:-5, 3:-2, 4:1, 5:5, 6:10 };

  function genGrades(containerId, subject, map){
    const el = document.getElementById(containerId);
    if(!el) return;

    el.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "row";

    for(const k in map){
      const b = document.createElement("button");
      b.innerText = k;
      b.onclick = () => {
        zapis(map[k], `${subject} – ocena ${k}`, `grade:${subject}:${k}`, true);
      };
      wrap.appendChild(b);
    }
    el.appendChild(wrap);
  }

  function mountGrades(){
    genGrades("polski","Polski",oceny1);
    genGrades("biologia","Biologia",oceny1);
    genGrades("geografia","Geografia",oceny1);

    genGrades("wf","WF",oceny2);
    genGrades("technika","Technika",oceny2);
    genGrades("muzyka","Muzyka",oceny2);
    genGrades("informatyka","Informatyka",oceny2);
    genGrades("plastyka","Plastyka",oceny2);

    genGrades("matematyka","Matematyka",oceny3);
    genGrades("angielski","Angielski",oceny3);
    genGrades("niemiecki","Niemiecki",oceny3);
    genGrades("historia","Historia",oceny3);
  }

  /* ================== ZAPIS WPISU ================== */
  // ✅ JEDYNE MIEJSCE ZMIANY SALDA (dla standardowych wpisów)
  window.zapis = async function(h, opis, category, checkDuplicate){
    if(!rodzic) return alert("Najpierw zaloguj rodzica.");
    const d = todayIso();

    if(checkDuplicate){
      const dup = await hasDuplicateToday(category);
      if(dup){
        const msg =
          `Uwaga: ${dup.v.rodzic} już dziś dodał/a:\n`+
          `${dup.v.opis} (${dup.v.h}h)\n\nDodać ponownie?`;
        if(!confirm(msg)) return;
      }
    }

    await db.ref("dni/"+d).transaction(v => (v || 0) + h);
    await db.ref("log/"+d).push({
      h,
      opis: `${opis} (${rodzic})`,
      rodzic,
      category: category || "",
      ts: Date.now()
    });
  };

  /* ================== USUWANIE WPISU (DZIŚ) ================== */
  window.usunWpisDzis = async function(date, logId, v){
    if(!rodzic) return alert("Najpierw zaloguj rodzica.");
    if(date !== todayIso()) return alert("Można usuwać tylko dzisiejsze wpisy.");
    if(v.rodzic !== rodzic) return alert("Może usunąć tylko autor wpisu.");
    if(!confirm("Usunąć ten wpis?")) return;

    const idx = `${date}|${logId}`;
    const a = appealsByLog[idx];

    const alreadyReverted =
      a && (a.status === "accepted" || a.status === "accepted_auto");

    if(!alreadyReverted){
      await db.ref("dni/"+date).transaction(x => (x||0) - (v.h||0));
    }

    await db.ref("log/"+date+"/"+logId).remove();

    if(a){
      await db.ref("odwolania/"+a.key).update({
        status: "cancelled",
        kto: rodzic,
        decyzjaAt: Date.now(),
        komentarz: "Wpis usunięty przez autora."
      });
    }
  };

  /* ================== ODWOŁANIA – DECYZJE ================== */
  window.acceptAppeal = async function(o){
    const cur = (await db.ref("odwolania/"+o.key).once("value")).val();
    if(!cur || cur.status !== "pending"){
      alert("To odwołanie już rozpatrzono.");
      return;
    }

    await db.ref("dni/"+cur.data).transaction(x => (x||0) - (cur.h||0));

    await db.ref("odwolania/"+o.key).update({
      status: "accepted",
      kto: rodzic,
      decyzjaAt: Date.now(),
      komentarz: "Zaakceptowane przez rodzica."
    });
  };

  window.rejectAppeal = async function(o){
    const comment = prompt("Dlaczego odrzucasz? (min. 10 znaków)");
    if(!comment || comment.trim().length < 10){
      alert("Komentarz za krótki.");
      return;
    }

    const cur = (await db.ref("odwolania/"+o.key).once("value")).val();
    if(!cur || cur.status !== "pending"){
      alert("To odwołanie już rozpatrzono.");
      return;
    }

    await db.ref("odwolania/"+o.key).update({
      status: "rejected",
      kto: rodzic,
      decyzjaAt: Date.now(),
      komentarz: comment.trim()
    });
  };

  /* ================== DUPLIKAT ================== */
  window.hasDuplicateToday = async function(category){
    const d = todayIso();
    const snap = await db.ref("log/"+d).once("value");
    let found = null;

    snap.forEach(ch=>{
      const v = ch.val();
      if(v && v.category === category && v.rodzic !== rodzic){
        found = { key: ch.key, v };
      }
    });

    return found;
  };

  /* ================== WNIOSKI O PUNKTY – RENDER (RODZIC) ================== */
  window.renderParentPointRequests = function(){
    const root = document.getElementById("pointReqRodzic");
    if(!root) return;
    root.innerHTML = "";

    const all = Array.isArray(window.pointRequests) ? window.pointRequests : [];

    // pokazujemy tylko aktywne (12h) i takie, gdzie są jeszcze decyzje / zmiany
    const list = all.filter(o => isActionableForList(o));

    if(list.length === 0){
      root.innerHTML = "<div class='muted'>Brak aktywnych wniosków.</div>";
      return;
    }

    // sort: pending (w toku) na górze, w ramach grupy: najnowsze na górze
    const sorted = list.slice().sort((a,b)=>{
      const ap = prStatus(a).toLowerCase()==="pending";
      const bp = prStatus(b).toLowerCase()==="pending";
      if(ap !== bp) return ap ? -1 : 1;
      return (prCreatedAt(b) - prCreatedAt(a));
    });

    sorted.forEach(o=>{
      const wrap = document.createElement("div");
      const cls = (typeof window.pointRequestClass === "function") ? window.pointRequestClass(o) : "";
      wrap.className = "box " + cls;

      const status = prStatus(o).toLowerCase();
      const who = prWho(o);
      const childC = prChildComment(o);
      const parentC = prParentComment(o);
      const dateIso = prDateIso(o);

      wrap.innerHTML = `
        <b>+1 punkt – ${window.escapeHtml?.(childC) || childC}</b>
        <div class="muted">Data: ${dateIso || "-"} · Status: ${window.statusLabelForPointRequest?.(o) || status}</div>
        ${status==="rejected" && parentC ? `<div style="margin-top:6px;" class="muted"><i>Powód:</i><br>${window.escapeHtml?.(parentC) || parentC}</div>` : ""}
        ${who ? `<div class="muted" style="margin-top:6px;">Decyzja: ${who}</div>` : ""}
      `;

      const row = document.createElement("div");
      row.className = "row";
      row.style.marginTop = "8px";

      const ok = document.createElement("button");
      ok.innerText = "Zaakceptuj";

      const no = document.createElement("button");
      no.innerText = "Odrzuć";

      // stan przycisków (to samo co filtr, ale trzymamy twardo)
      const expd = isExpired(o);
      const decidedBy = who || "";
      const canDecidePending = (status === "pending" && !decidedBy && !expd);
      const canChange = (status === "accepted" || status === "rejected") && decidedBy === rodzic && !expd;

      const blockedByOther = decidedBy && decidedBy !== rodzic;
      const lockedAuto = (status === "accepted_auto");

      if(lockedAuto || blockedByOther || expd){
        ok.disabled = true; no.disabled = true;
      } else if(canDecidePending || canChange){
        ok.onclick = ()=> window.acceptPointRequest?.(o);
        no.onclick = ()=> window.rejectPointRequest?.(o);
      } else {
        ok.disabled = true; no.disabled = true;
      }

      row.appendChild(ok);
      row.appendChild(no);
      wrap.appendChild(row);

      root.appendChild(wrap);
    });
  };

  /* ================== WNIOSKI O PUNKTY – DECYZJE (RODZIC) ================== */
  window.acceptPointRequest = async function(o){
    if(!rodzic) return alert("Najpierw zaloguj rodzica.");

    const key = prKey(o);
    if(!key) return alert("Brak ID wniosku.");

    const snap = await db.ref(PR_PATH+"/"+key).once("value");
    const cur = snap.val();
    if(!cur) return alert("Nie znaleziono wniosku w bazie. Odśwież aplikację.");

    const status = prStatus(cur).toLowerCase();
    if(status === "accepted_auto"){
      alert("Zaakceptowane automatycznie – decyzji nie można już zmieniać.");
      return;
    }

    const who = prWho(cur);
    if(who && who !== rodzic){
      alert("Ten wniosek rozpatrzył już drugi rodzic.");
      return;
    }

    const exp = prExpiresAt(cur);
    if(exp && Date.now() > exp){
      alert("Minęło 12 godzin od złożenia wniosku – decyzja jest zablokowana.");
      return;
    }

    const dateIso = prDateIso(cur);
    const childC = prChildComment(cur);

    // log musi istnieć (żeby nie znikał przy zmianach decyzji)
    const logInfo = await ensureRequestLogExists(key, cur);
    const logKey = logInfo.logKey;
    const logDate = logInfo.logDate;

    // saldo tylko, jeśli wcześniej nie było zastosowane
    const applied = !!cur.applied;
    if(!applied){
      await applyPointToDay(dateIso);
    }

    // log: h=1 i status "zaakceptowane"
    await setLogHours(logDate, logKey, 1);
    await setLogStatus(logDate, logKey, childC, "zaakceptowane", "");

    await db.ref(PR_PATH+"/"+key).update({
      status: "accepted",
      kto: rodzic,
      decyzjaAt: Date.now(),
      komentarz: "",
      applied: true,
      logKey,
      logDate,
      data: dateIso
    });
  };

  window.rejectPointRequest = async function(o){
    if(!rodzic) return alert("Najpierw zaloguj rodzica.");

    const comment = prompt("Dlaczego odrzucasz? (min. 10 znaków)");
    if(!comment || comment.trim().length < 10){
      alert("Komentarz za krótki (min. 10 znaków).");
      return;
    }

    const key = prKey(o);
    if(!key) return alert("Brak ID wniosku.");

    const snap = await db.ref(PR_PATH+"/"+key).once("value");
    const cur = snap.val();
    if(!cur) return alert("Nie znaleziono wniosku w bazie. Odśwież aplikację.");

    const status = prStatus(cur).toLowerCase();
    if(status === "accepted_auto"){
      alert("Zaakceptowane automatycznie – decyzji nie można już zmieniać.");
      return;
    }

    const who = prWho(cur);
    if(who && who !== rodzic){
      alert("Ten wniosek rozpatrzył już drugi rodzic.");
      return;
    }

    const exp = prExpiresAt(cur);
    if(exp && Date.now() > exp){
      alert("Minęło 12 godzin od złożenia wniosku – decyzja jest zablokowana.");
      return;
    }

    const dateIso = prDateIso(cur);
    const childC = prChildComment(cur);

    // log musi istnieć
    const logInfo = await ensureRequestLogExists(key, cur);
    const logKey = logInfo.logKey;
    const logDate = logInfo.logDate;

    // jeśli był zastosowany (+1), to cofamy saldo, ale LOG ZOSTAJE
    const applied = !!cur.applied;
    if(applied){
      await revertPointFromDay(dateIso);
    }

    // log: h=0 i status "odrzucone" + powód
    await setLogHours(logDate, logKey, 0);
    await setLogStatus(logDate, logKey, childC, "odrzucone", comment.trim());

    await db.ref(PR_PATH+"/"+key).update({
      status: "rejected",
      kto: rodzic,
      decyzjaAt: Date.now(),
      komentarz: comment.trim(),
      applied: false,
      logKey,
      logDate,
      data: dateIso
    });
  };

  /* ================== DOPIĘCIE DO renderAll ================== */
  (function(){
    const old = window.renderAll;
    if(typeof old === "function"){
      window.renderAll = function(){
        old?.();
        window.renderParentPointRequests?.();
        window.updatePointRequestsButton?.();
      };
    }
  })();

})();
