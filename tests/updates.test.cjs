const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const assert=require('node:assert/strict');
const base=path.resolve(__dirname,'..');
const app=fs.existsSync(path.join(base,'app')) ? path.join(base,'app') : base;
const source=fs.readFileSync(path.join(app,'js/updates.js'),'utf8');
function setup({waiting=true,controlled=true,offline=false}={}){
  const events={},swEvents={},docEvents={},timers=[];
  const classes=new Set(['hidden']);let reloads=0;let checks=0;const sent=[];
  const elements={updateBanner:{classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)}},updateNow:{disabled:false},updateLater:{disabled:false},updateMessage:{innerText:''}};
  const regEvents={};const installEvents={};
  const registration={waiting:waiting?{postMessage:message=>sent.push(message)}:null,
    installing:{addEventListener:(type,fn)=>installEvents[type]=fn},
    addEventListener:(type,fn)=>regEvents[type]=fn,
    update:async()=>{checks++;if(offline)throw new Error('offline');}};
  const context=vm.createContext({console:{error(){}},
    navigator:{serviceWorker:{controller:controlled?{}:null,addEventListener:(name,fn)=>swEvents[name]=fn,register:async(url,options)=>{assert.equal(url,'sw.js');assert.equal(options.updateViaCache,'none');return registration;}}},
    document:{hidden:false,getElementById:id=>elements[id],addEventListener:(name,fn)=>docEvents[name]=fn},
    location:{reload:()=>reloads++},setTimeout:fn=>fn(),setInterval:fn=>timers.push(fn)});
  context.window=context;context.addEventListener=(name,fn)=>events[name]=fn;
  vm.runInContext(source,context);
  return {context,events,swEvents,docEvents,timers,classes,registration,regEvents,installEvents,elements,sent,get reloads(){return reloads;},get checks(){return checks;}};
}
(async()=>{
  const state=setup();await Promise.resolve();await Promise.resolve();
  assert.equal(state.classes.has('hidden'),false);
  state.context.deferAppUpdate();assert.equal(state.classes.has('hidden'),true);
  state.timers[0]();await Promise.resolve();assert.equal(state.classes.has('hidden'),true);
  state.docEvents.visibilitychange();assert.equal(state.classes.has('hidden'),false);
  state.context.deferAppUpdate();state.events.pageshow();assert.equal(state.classes.has('hidden'),false);
  state.context.deferAppUpdate();state.events.focus();assert.equal(state.classes.has('hidden'),false);
  state.context.forceDesktopUpdate();assert.equal(state.sent[0].type,'SKIP_WAITING');
  assert.equal(state.reloads,0);assert.equal(state.elements.updateNow.disabled,true);
  state.swEvents.controllerchange();state.swEvents.controllerchange();assert.equal(state.reloads,1);
  const first=setup({waiting:false,controlled:false});await Promise.resolve();await Promise.resolve();
  first.swEvents.controllerchange();assert.equal(first.reloads,0);assert.equal(first.classes.has('hidden'),true);
  const late=setup({waiting:false});await Promise.resolve();await Promise.resolve();
  late.regEvents.updatefound();late.registration.waiting={postMessage(){}};late.installEvents.statechange();
  assert.equal(late.classes.has('hidden'),false);
  const offline=setup({offline:true});await Promise.resolve();await Promise.resolve();
  offline.context.deferAppUpdate();offline.events.focus();await Promise.resolve();
  assert.equal(offline.classes.has('hidden'),false);
  console.log('PASS aktualizacje: dwa przyciski, Później, ponowne wejście, instalacja w tle, akceptacja, pojedynczy reload, pierwsza instalacja i brak sieci');
})().catch(error=>{console.error(error);process.exitCode=1;});
