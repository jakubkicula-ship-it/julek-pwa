const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const model=require('../js/week-result.js');
const summary={weekKey:'2026-BW-10-23',earnedHours:3,bonusHours:2,hours:5,endAt:100,closedAt:101};
function setup(mobile=true){
  const storage=new Map(),events={};let callback,options,opens=0,closes=0;
  const child={style:{display:'none'}};
  const context=vm.createContext({navigator:{userAgent:mobile?'Android':'Desktop'},
    document:{visibilityState:'visible',getElementById:()=>child,addEventListener:(name,fn)=>events[name]=fn},
    localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},
    previousBusinessWeekKey:()=>summary.weekKey,
    db:{ref(p){assert.equal(p,'meta/weekendSettlement');return {on(type,fn){callback=fn;}};}},
    JulekWeekScreen:{shouldShow:model.shouldShow,open(value,opts){opens++;options=opts;return {close(){closes++;opts.acknowledge(value.weekKey);opts.onClose();}};}}
  });context.window=context;
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/week-result-client.js'),'utf8'),context);
  return {context,storage,child,events,emit:value=>callback({val:()=>value}),get opens(){return opens;},get closes(){return closes;}};
}
test('live summary waits for child login, shows once and hides when phone locks',()=>{
  const state=setup();state.emit(summary);assert.equal(state.opens,0);
  state.child.style.display='block';state.context.onAfterLogin();assert.equal(state.opens,1);
  state.emit(summary);assert.equal(state.opens,1);
  state.context.document.visibilityState='hidden';state.events.visibilitychange();assert.equal(state.closes,1);
  state.context.document.visibilityState='visible';state.events.visibilitychange();assert.equal(state.opens,1);
  assert.equal(state.storage.get('julek-week-summary-seen'),summary.weekKey);
});
test('no desktop, parent or historical results; no writes to Firebase',()=>{
  const desktop=setup(false);desktop.child.style.display='block';desktop.emit(summary);assert.equal(desktop.opens,0);
  const state=setup();state.child.style.display='block';state.context.rodzic='Kuba';state.emit(summary);assert.equal(state.opens,0);
  state.context.rodzic='';state.emit({...summary,weekKey:'2026-BW-10-16'});assert.equal(state.opens,0);
  state.emit(summary);assert.equal(state.opens,1);
});
