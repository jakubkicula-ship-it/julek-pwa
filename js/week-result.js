/* Standalone weekly result screen. No database writes and no external libraries. */
(function(root,factory){
  const api=factory();
  if(typeof module === "object" && module.exports) module.exports=api;
  else root.JulekWeekScreen=api;
})(typeof window !== "undefined" ? window : globalThis,function(){
  "use strict";
  function model(summary){
    if(!summary || !/^\d{4}-BW-\d{2}-\d{2}$/.test(summary.weekKey) || !Number.isFinite(summary.earnedHours) || !Number.isFinite(summary.hours) || !Number.isFinite(summary.closedAt) || summary.closedAt <= 0) return null;
    const n=summary.earnedHours;
    return {
      id:summary.weekKey,
      kind:n>0?"success":n<0?"failure":"neutral",
      sound:n>0?"success":n<0?"failure":null,
      score:`${n>0?"+":""}${n.toLocaleString("pl-PL")} h`,
      title:n>0?"Brawo, Julek!":n<0?"Tym razem na minusie":"Tydzień na zero",
      message:n>0?"Gratulacje! Dobra robota. Oby tak dalej!":n<0?"Chyba musisz się bardziej postarać. Pilnuj codziennych obowiązków — mycia zębów i zmywarki.":"Nowy tydzień to nowa szansa. Pilnuj obowiązków i zbieraj punkty!",
      weekend:n>0?`Czas na komputer w weekend: ${summary.hours.toLocaleString("pl-PL")} h (w tym bonus ${summary.bonusHours.toLocaleString("pl-PL")} h).`:n<0?"Powodzenia, staraj się dalej! A tymczasem do roboty w weekend.":`Czas na komputer w weekend: ${summary.hours.toLocaleString("pl-PL")} h (bonus).`
    };
  }
  function shouldShow(summary,{child,mobile,seen,lastShown}){
    const m=model(summary);
    return !!(m && child && mobile && seen !== m.id && lastShown !== m.id);
  }
  function open(summary,{play=()=>Promise.resolve(),acknowledge=()=>{},onClose=()=>{}}={}){
    const m=model(summary);
    if(!m) return null;
    const dialog=document.createElement("dialog");
    dialog.className=`weekResult weekResult--${m.kind}`;
    dialog.setAttribute("aria-labelledby","weekResultTitle");
    dialog.setAttribute("aria-describedby","weekResultMessage");
    // All variable text is assigned with textContent below.
    dialog.innerHTML=`<div class="weekResult__confetti" aria-hidden="true"></div>
      <div class="weekResult__content">
        <div class="weekResult__eyebrow">PODSUMOWANIE TYGODNIA</div>
        <div class="weekResult__symbol" aria-hidden="true"></div>
        <h2 id="weekResultTitle"></h2>
        <div class="weekResult__scoreLabel">Twój wynik</div>
        <div class="weekResult__score"></div>
        <p id="weekResultMessage"></p>
        <p class="weekResult__weekend"></p>
        <button type="button" class="weekResult__sound" hidden>▶ Odtwórz dźwięk</button>
        <p class="weekResult__audioStatus" role="status" aria-live="polite"></p>
        <button type="button" class="weekResult__continue">OK</button>
      </div>`;
    dialog.querySelector("h2").textContent=m.title;
    dialog.querySelector(".weekResult__score").textContent=m.score;
    dialog.querySelector("#weekResultMessage").textContent=m.message;
    dialog.querySelector(".weekResult__weekend").textContent=m.weekend;
    const symbol=dialog.querySelector(".weekResult__symbol");
    if(m.kind === "failure") {
      symbol.innerHTML='<svg viewBox="0 0 64 64" focusable="false"><path fill="currentColor" d="M45 9h11v27H45zM39 9H20c-3 0-5 2-6 5L8 31c-1 4 2 7 6 7h12l-2 11c-1 5 3 8 7 5l11-15V13c0-2-1-4-3-4Z"/></svg>';
    } else if(m.kind === "success") {
      symbol.innerHTML='<svg viewBox="0 0 64 64" focusable="false"><path fill="currentColor" d="m32 5 8 17 19 3-14 14 3 20-16-9-17 9 3-20L4 25l20-3z"/></svg>';
      const colors=["#e6aa2c","#2d9c69","#6c65d9","#ed7596","#79bde2"];
      const field=dialog.querySelector(".weekResult__confetti");
      for(let i=0;i<72;i++){
        const piece=document.createElement("i");
        piece.style.cssText=`--x:${(i*37)%101}%;--delay:${(i%13)*.065}s;--duration:${2.6+(i%7)*.23}s;--drift:${((i*29)%180)-90}px;--turn:${360+(i%5)*140}deg;background:${colors[i%colors.length]};border-radius:${i%3===0?"50%":"1px"}`;
        field.append(piece);
      }
    } else symbol.textContent="—";
    const button=dialog.querySelector(".weekResult__sound");
    const status=dialog.querySelector(".weekResult__audioStatus");
    let closed=false, timer=null;
    async function sound(){
      clearTimeout(timer);
      status.textContent="";
      try {await play(m.sound); if(!closed) timer=setTimeout(sound, m.sound === "success" ? 1000 : 2000);}
      catch(error){
        if(closed) return;
        button.hidden=false;
        status.textContent=error?.name === "NotAllowedError" ? "Dotknij przycisku, aby usłyszeć dźwięk." : "Dźwięk jest chwilowo niedostępny.";
      }
    }
    if(m.sound){button.onclick=sound;}
    dialog.querySelector(".weekResult__continue").onclick=()=>dialog.close();
    const previousOverflow=document.body.style.overflow;
    dialog.addEventListener("close",()=>{
      closed=true;clearTimeout(timer);acknowledge(m.id);document.body.style.overflow=previousOverflow;
      onClose();dialog.remove();
    },{once:true});
    document.body.append(dialog);
    try {dialog.showModal();} catch(error){dialog.remove();throw error;}
    document.body.style.overflow="hidden";
    if(m.sound) sound();
    return dialog;
  }
  return {model,shouldShow,open};
});
