// ./js/render.js
// TYLKO UI / DOM

/* ================== UI HELPERS ================== */
window.statusLabelForAppeal = function(o){
  if(!o) return "";
  const st = (o.status||"").toLowerCase();
  if(st==="pending") return "w toku";
  if(st==="accepted") return "zaakceptowane";
  if(st==="accepted_auto") return "zaakceptowane automatycznie";
  if(st==="rejected") return "niezaakceptowane";
  if(st==="cancelled") return "anulowane";
  return st || "";
};

window.appealClass = function(o){
  const st = (o.status||"").toLowerCase();
  if(st==="pending") return "stPending";
  if(st==="accepted" || st==="accepted_auto") return "stAccepted";
  if(st==="rejected") return "stRejected";
  if(st==="cancelled") return "stCancelled";
  return "stPending";
};

/* ================== UI HELPERS – WNIOSKI ================== */
window.statusLabelForPointRequest = function(o){
  if(!o) return "";
  const st = (o.status||"").toLowerCase();
  if(st==="pending") return "w toku";
  if(st==="accepted") return "zaakceptowane";
  if(st==="accepted_auto") return "zaakceptowane automatycznie";
  if(st==="rejected") return "odrzucone";
  return st || "";
};

window.pointRequestClass = function(o){
  const st = (o.status||"").toLowerCase();
  if(st==="pending") return "stPending";
  if(st==="accepted" || st==="accepted_auto") return "stAccepted";
  if(st==="rejected") return "stRejected";
  return "stPending";
};

/* ================== HELPERY (PR) ================== */
function prCreatedAt(o){
  return o?.createdAt ?? o?.created_at ?? 0;
}
function prIsoDate(o){
  const d = (o?.data || "").toString();
  if(d) return d;
  const ts = prCreatedAt(o);
  if(!ts) return "";
  return new Date(ts).toLocaleDateString("en-CA", { timeZone: "Europe/Warsaw" });
}
function prChildComment(o){
  return (o?.child_comment || o?.childComment || o?.komentarzDziecka || "").toString().trim();
}
function prParentComment(o){
  return (o?.komentarz || o?.parent_comment || o?.parentComment || "").toString().trim();
}

/* dopasowanie wniosku do wpisu w logu */
function findPointRequestForLog(date, logId, v){
  const list = Array.isArray(window.pointRequests) ? window.pointRequests : [];
  if(list.length === 0) return null;

  // 1) twarde dopasowanie po logKey/logDate
  let hit = list.find(p => (p?.logDate === date) && (p?.logKey === logId));
  if(hit) return hit;

  // 2) fallback: wyciągnij komentarz z opisu "Wniosek Julka: ... (....)"
  if(v?.category !== "wniosek_punkt") return null;

  const opis = (v?.opis || "").toString();
  const m = opis.match(/Wniosek Julka:\s*(.*?)(\s*\(|$)/i);
  const extracted = (m && m[1]) ? m[1].trim() : "";

  if(extracted){
    hit = list.find(p => prIsoDate(p) === date && prChildComment(p) === extracted);
    if(hit) return hit;
  }

  return null;
}

/* ================== SEKCJE ================== */
window.showSection = function(id){
  ["secUzn","secOceny","secObow","secPointReq"].forEach(x=>{
    const el = document.getElementById(x);
    if(el) el.classList.add("hidden");
  });
  if(id){
    const el = document.getElementById(id);
    if(el) el.classList.remove("hidden");
  }
};

/* ================== PRZYCISK: ODWOŁANIA ================== */
window.updateAppealsButton = function(){
  const btn = document.getElementById("btnAppeals");
  const badge = document.getElementById("appealsBadge");
  if(!btn) return;

  const pending = (window.appealsList||[]).filter(a=>(a.status||"")==="pending").length;
  if(badge) badge.innerText = String(pending);

  btn.classList.toggle("btnRed", pending>0);
  btn.classList.toggle("btnGreen", pending===0);
};

/* ================== PRZYCISK: WNIOSKI O PUNKTY ================== */
window.updatePointRequestsButton = function(){
  const btn = document.getElementById("btnPointRequests");
  if(!btn) return;

  const list = Array.isArray(window.pointRequests) ? window.pointRequests : [];
  const pending = list.filter(p => (p?.status||"") === "pending").length;

  btn.innerText = pending>0 ? `Wnioski o punkty (${pending})` : "Wnioski o punkty";
  btn.classList.toggle("btnRed", pending>0);
  btn.classList.toggle("btnGreen", pending===0);
};

/* ================== LOGI (RODZIC) ================== */
window.renderParentLogs = function(){
  const ul = document.getElementById("logR");
  if(!ul) return;
  ul.innerHTML = "";

  const dates = Object.keys(window.logsCache||{}).sort();
  if(dates.length === 0){
    ul.innerHTML = "<li>Brak wpisów w aktualnym tygodniu.</li>";
    return;
  }

  const today = (typeof window.todayIso === "function") ? window.todayIso() : "";

  dates.forEach(date=>{
    if(!window.showWholeWeekLogs && date !== today) return;

    const dayObj = window.logsCache[date] || {};
    const keys = Object.keys(dayObj).sort((a,b)=>(dayObj[a]?.ts||0)-(dayObj[b]?.ts||0));
    if(keys.length === 0) return;

    const header = document.createElement("li");
    header.innerHTML = `<b>${typeof window.dateHeader==="function" ? window.dateHeader(date) : date}</b>`;
    ul.appendChild(header);

    const inner = document.createElement("ul");
    inner.style.paddingLeft = "18px";

    keys.forEach(logId=>{
      const v = dayObj[logId];
      if(!v) return;

      const sign = v.h > 0 ? "+" : "";
      const li = document.createElement("li");
      li.appendChild(document.createTextNode(`${v.opis} (${sign}${v.h}h) `));

      const del = document.createElement("button");
      del.className = "smallbtn";
      del.innerText = "Usuń";

      if(!window.rodzic || date !== today || v.rodzic !== window.rodzic){
        del.disabled = true;
      } else {
        del.onclick = ()=> window.usunWpisDzis?.(date, logId, v);
      }

      li.appendChild(del);
      inner.appendChild(li);
    });

    ul.appendChild(inner);
  });
};

/* ================== LOGI (JULEK) – WNIOSKI + KOLORY ================== */
window.renderJulekLogs = function(){
  const ul = document.getElementById("logJ");
  if(!ul) return;
  ul.innerHTML = "";

  const today = (typeof window.todayIso === "function") ? window.todayIso() : "";
  const dates = Object.keys(window.logsCache||{}).sort();

  const allPR = Array.isArray(window.pointRequests) ? window.pointRequests : [];
  const pendingPR = allPR.filter(p => ((p?.status||"pending").toLowerCase() === "pending"));

  // zrób listę dni: logi + dni z pending wnioskami + dzisiaj
  const loop = new Set(dates);
  pendingPR.forEach(p => { const d = prIsoDate(p); if(d) loop.add(d); });
  if(today) loop.add(today);
  const loopDates = Array.from(loop).sort();

  if(loopDates.length === 0){
    ul.innerHTML = "<li>Brak wpisów w aktualnym tygodniu.</li>";
    return;
  }

  loopDates.forEach(date=>{
    if(!window.showWholeWeekLogs && date !== today) return;

    const dayObj = window.logsCache[date] || {};
    const logKeys = Object.keys(dayObj).sort((a,b)=>(dayObj[a]?.ts||0)-(dayObj[b]?.ts||0));

    const prsForDatePending = pendingPR.filter(p => prIsoDate(p) === date);

    if(logKeys.length === 0 && prsForDatePending.length === 0) return;

    const header = document.createElement("li");
    header.innerHTML = `<b>${typeof window.dateHeader==="function" ? window.dateHeader(date) : date}</b>`;
    ul.appendChild(header);

    const inner = document.createElement("ul");
    inner.style.paddingLeft = "18px";

    // oś czasu: logi + pending wnioski
    const events = [];

    logKeys.forEach(logId=>{
      const v = dayObj[logId];
      if(!v) return;
      events.push({ kind:"log", ts:(v.ts||0), logId, v });
    });

    prsForDatePending.forEach(p=>{
      events.push({ kind:"pr_pending", ts: prCreatedAt(p), p });
    });

    events.sort((a,b)=>(a.ts||0)-(b.ts||0));

    events.forEach(ev=>{
      // wpis z logu
      if(ev.kind === "log"){
        const { logId, v } = ev;

        const sign = v.h > 0 ? "+" : "";
        const li = document.createElement("li");
        li.appendChild(document.createTextNode(`${v.opis} (${sign}${v.h}h) `));

        // ✅ jeśli to wpis z wniosku – dołóż kolor/status z pointRequests
        if(v?.category === "wniosek_punkt"){
          const pr = findPointRequestForLog(date, logId, v);
          if(pr){
            const tag = document.createElement("span");
            tag.className = "tag " + (window.pointRequestClass?.(pr) || "");
            tag.innerText = `Wniosek: ${window.statusLabelForPointRequest?.(pr) || (pr.status||"")}`;
            li.appendChild(tag);

            const st = (pr.status||"").toLowerCase();
            const parentC = prParentComment(pr);
            if(st === "rejected" && parentC){
              const comm = document.createElement("div");
              comm.className = "muted";
              comm.style.marginTop = "4px";
              comm.innerText = "Powód rodzica: " + parentC;
              li.appendChild(comm);
            }
          }
        }

        // odwołania jak było
        const appeal = window.appealsByLog?.[`${date}|${logId}`];
        if(appeal){
          const tag2 = document.createElement("span");
          tag2.className = "tag " + (window.appealClass?.(appeal) || "");
          tag2.innerText = `Odwołanie: ${window.statusLabelForAppeal?.(appeal) || (appeal.status||"")}`;
          li.appendChild(tag2);

          const st = (appeal.status||"").toLowerCase();
          const commTxt = (appeal.komentarz || "").trim();
          if(st === "rejected" && commTxt){
            const comm = document.createElement("div");
            comm.className = "muted";
            comm.style.marginTop = "4px";
            comm.innerText = "Komentarz rodzica: " + commTxt;
            li.appendChild(comm);
          }
        }

        // przycisk odwołania tylko od ujemnych i tylko dziś
        if(v.h < 0 && !appeal){
          const btn = document.createElement("button");
          btn.className = "smallbtn";
          btn.innerText = "Nie zgadzam się";
          btn.disabled = date !== today;
          if(!btn.disabled){
            btn.onclick = ()=> window.odwolanie?.(date, logId, v);
          }
          li.appendChild(document.createTextNode(" "));
          li.appendChild(btn);
        }

        inner.appendChild(li);
        return;
      }

      // pending wniosek jako wpis w logu (żółty)
      if(ev.kind === "pr_pending"){
        const p = ev.p;
        if(!p) return;

        const li = document.createElement("li");
        li.appendChild(document.createTextNode(`Wniosek o punkt: ${prChildComment(p)} (+1h) `));

        const tag = document.createElement("span");
        tag.className = "tag " + (window.pointRequestClass?.(p) || "");
        tag.innerText = `Wniosek: ${window.statusLabelForPointRequest?.(p) || "w toku"}`;
        li.appendChild(tag);

        const ts = prCreatedAt(p);
        if(ts && typeof window.tsToWarsaw === "function"){
          const t = document.createElement("span");
          t.className = "muted";
          t.style.marginLeft = "8px";
          t.innerText = "· " + window.tsToWarsaw(ts);
          li.appendChild(t);
        }

        inner.appendChild(li);
      }
    });

    ul.appendChild(inner);
  });
};

/* ================== ODWOŁANIA (RODZIC) ================== */
window.renderParentAppeals = function(){
  const root = document.getElementById("odwolaniaRodzic");
  if(!root) return;
  root.innerHTML = "";

  const list = Array.isArray(window.appealsList) ? window.appealsList : [];
  if(list.length === 0){
    root.innerHTML = "<div class='muted'>Brak odwołań.</div>";
    return;
  }

  const today = (typeof window.todayIso==="function") ? window.todayIso() : "";

  list.forEach(o=>{
    const wrap = document.createElement("div");
    wrap.className = "box " + (window.appealClass?.(o) || "");

    wrap.innerHTML = `
      <b>${(o.opis||"")}</b>
      <div class="muted">Wartość: ${o.h} h · Data: ${o.data}</div>
      <div style="margin-top:6px;"><i>Powód:</i><br>${(o.powod||"")}</div>
    `;

    if((o.status||"")==="pending"){
      const row = document.createElement("div");
      row.className = "row";
      row.style.marginTop = "8px";

      const ok = document.createElement("button");
      ok.innerText = "Uznaj";

      const no = document.createElement("button");
      no.innerText = "Odrzuć";

      const can = window.rodzic && (!o.deadlineDay || today <= o.deadlineDay);

      if(can){
        ok.onclick = ()=> window.acceptAppeal?.(o);
        no.onclick = ()=> window.rejectAppeal?.(o);
      } else {
        ok.disabled = true;
        no.disabled = true;
      }

      row.appendChild(ok);
      row.appendChild(no);
      wrap.appendChild(row);
    }

    root.appendChild(wrap);
  });
};

/* ================== RENDER ALL (GŁÓWNY) ================== */
window.renderAll = function(){
  window.renderParentLogs?.();
  window.renderJulekLogs?.();
  window.renderParentAppeals?.();
  window.updateAppealsButton?.();
  window.updatePointRequestsButton?.();
};
