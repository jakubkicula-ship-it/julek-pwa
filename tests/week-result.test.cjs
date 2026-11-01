const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const screen=require('../js/week-result.js');
const result={weekKey:'2026-BW-10-23',earnedHours:6,bonusHours:2,hours:8,closedAt:1793380000000};
test('earned hours select outcome; existing bonus remains included in computer time',()=>{
  assert.equal(screen.model(result).sound,'success');
  assert.match(screen.model(result).weekend,/8 h/);
  assert.equal(screen.model({...result,earnedHours:-3,bonusHours:0,hours:-3}).sound,'failure');
  const zero=screen.model({...result,earnedHours:0,hours:2});
  assert.equal(zero.sound,null);assert.match(zero.weekend,/2 h/);
  assert.equal(screen.model({...result,hours:NaN}),null);
});
test('first child visit shows once on mobile; parents and desktop remain unchanged',()=>{
  const state={child:true,mobile:true};
  assert.equal(screen.shouldShow(result,state),true);
  assert.equal(screen.shouldShow(result,{...state,seen:result.weekKey}),false);
  assert.equal(screen.shouldShow(result,{...state,lastShown:result.weekKey}),false);
  assert.equal(screen.shouldShow(result,{...state,child:false}),false);
  assert.equal(screen.shouldShow(result,{...state,mobile:false}),false);
});
for(const [hours,gap] of [[6,1000],[-3,2000],[0,null]]) test(`audio loop ${hours}: wait until recording ends, pause ${gap}, stop on OK`,async()=>{
  let resolveAudio,plays=0,ack=null,stopped=false;
  const timers=new Map();let nextTimer=0;
  function element(){
    const nodes=new Map(),events={};
    return {style:{},hidden:true,textContent:'',innerHTML:'',className:'',
      setAttribute(){},append(){},remove(){},showModal(){},
      querySelector(selector){if(!nodes.has(selector))nodes.set(selector,element());return nodes.get(selector);},
      addEventListener(name,fn){events[name]=fn;},close(){events.close();}};
  }
  const document={body:{style:{overflow:'auto'},append(){}},createElement:element};
  const context=vm.createContext({document,console,setTimeout(fn,ms){const id=++nextTimer;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/week-result.js'),'utf8'),context);
  const dialog=context.JulekWeekScreen.open({...result,earnedHours:hours,hours:hours<0?hours:hours+2},{
    play(){plays++;return new Promise(resolve=>{resolveAudio=resolve;});},
    acknowledge:id=>ack=id,onClose:()=>stopped=true
  });
  assert.equal(plays,hours===0?0:1);assert.equal(timers.size,0);assert.equal(ack,null);
  if(hours!==0){resolveAudio();await new Promise(setImmediate);assert.equal([...timers.values()][0].ms,gap);}
  dialog.querySelector('.weekResult__continue').onclick();
  assert.equal(timers.size,0);assert.equal(stopped,true);assert.equal(ack,result.weekKey);assert.equal(document.body.style.overflow,'auto');
});
