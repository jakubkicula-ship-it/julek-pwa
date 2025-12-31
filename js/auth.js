// ./js/auth.js
// GLOBAL: musi być var, żeby reszta kodu widziała
var rodzic = "";

function _showOnly(which){
  const login = document.getElementById("login");
  const r = document.getElementById("rodzic");
  const j = document.getElementById("julek");

  if(login) login.style.display = (which === "login") ? "block" : "none";
  if(r)     r.style.display     = (which === "rodzic") ? "block" : "none";
  if(j)     j.style.display     = (which === "julek") ? "block" : "none";
}

function _setRodzicUi(){
  const rn = document.getElementById("rodzicName");
  if(rn) rn.innerText = rodzic || "";

  const btnAdmin = document.getElementById("btnAdmin");
  if(btnAdmin){
    if(rodzic === "Kuba") btnAdmin.classList.remove("hidden");
    else btnAdmin.classList.add("hidden");
  }

  const secAdmin = document.getElementById("secAdmin");
  if(secAdmin && rodzic !== "Kuba") secAdmin.classList.add("hidden");
}

// GLOBAL: maskowany PIN modal
function askPinMasked(title){
  return new Promise((resolve)=>{
    const overlay = document.getElementById("pinModal");
    const input   = document.getElementById("pinInput");
    const okBtn   = document.getElementById("pinOk");
    const noBtn   = document.getElementById("pinCancel");
    const ttl     = document.getElementById("pinTitle");

    // awaryjnie (gdyby modal był usunięty)
    if(!overlay || !input || !okBtn || !noBtn){
      const v = prompt(title || "PIN:");
      resolve(v === null ? null : String(v));
      return;
    }

    let done = false;

    const close = (val)=>{
      if(done) return;
      done = true;

      overlay.classList.add("hidden");
      overlay.hidden = true;

      input.value = "";
      input.onkeydown = null;
      okBtn.onclick = null;
      noBtn.onclick = null;

      resolve(val);
    };

    if(ttl) ttl.innerText = title || "PIN";
    input.value = "";

    overlay.hidden = false;
    overlay.classList.remove("hidden");
    setTimeout(()=>input.focus(), 0);

    okBtn.onclick = ()=> close(String(input.value || ""));
    noBtn.onclick = ()=> close(null);

    input.onkeydown = (e)=>{
      if(e.key === "Enter") okBtn.click();
      if(e.key === "Escape") noBtn.click();
    };
  });
}

// GLOBAL
async function loginRodzic(){
  const pin = await askPinMasked("PIN rodzica:");
  if(pin === null) return;

  if(pin === "6978") rodzic = "Kuba";
  else if(pin === "986") rodzic = "Marlena";
  else return alert("Zły PIN");

  _showOnly("rodzic");
  _setRodzicUi();

  // dotychczasowy hook
  if(typeof window.onAfterLogin === "function") {
    window.onAfterLogin();
  }

  // NOWE: init panelu rodzica
  if(typeof window.initParentPanel === "function") {
    window.initParentPanel();
  }
}

// GLOBAL
function loginJulek(){
  rodzic = "";
  _showOnly("julek");

  // dotychczasowy hook
  if(typeof window.onAfterLogin === "function") {
    window.onAfterLogin();
  }

  // NOWE: init panelu Julka
  if(typeof window.initChildPanel === "function") {
    window.initChildPanel();
  }
}

// GLOBAL
async function openAdmin(){
  if(rodzic !== "Kuba") return;

  const pin = await askPinMasked("PIN (Zmiany administracyjne):");
  if(pin === null) return;
  if(pin !== "6978") return alert("Zły PIN");

  const sec = document.getElementById("secAdmin");
  if(sec){
    sec.classList.remove("hidden");
    sec.scrollIntoView({behavior:"smooth", block:"start"});
  }

  // dotychczasowy hook
  if(typeof window.onAdminOpened === "function") {
    window.onAdminOpened();
  }

  // NOWE: init admina
  if(typeof window.initAdminPanel === "function") {
    window.initAdminPanel();
  }
}

// start
document.addEventListener("DOMContentLoaded", ()=>{
  _showOnly("login");
  _setRodzicUi();
});
