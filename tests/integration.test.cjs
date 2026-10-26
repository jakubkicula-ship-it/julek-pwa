const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const app=fs.existsSync(path.join(root,'app')) ? path.join(root,'app') : root;
const ids=new Map();
function element(){
  const classes=new Set();
  return {innerText:'',innerHTML:'',textContent:'',children:[],style:{},dataset:{},
    classList:{toggle(name,force){if(force===undefined)force=!classes.has(name);force?classes.add(name):classes.delete(name);},add:name=>classes.add(name),remove:name=>classes.delete(name),contains:name=>classes.has(name)},
    appendChild(item){this.children.push(item);},closest(){return this;},addEventListener(){},focus(){},scrollIntoView(){}};
}
const document={hidden:false,addEventListener(){},getElementById(id){if(!ids.has(id))ids.set(id,element());return ids.get(id);},createElement:element,createTextNode:text=>({textContent:text})};
const context=vm.createContext({document,Intl,console,setInterval(){},setTimeout(){},alert(){},prompt(){return null;},confirm(){return true;},location:{reload(){}},navigator:{}});
context.window=context;context.addEventListener=()=>{};
vm.runInContext(fs.readFileSync(path.join(__dirname,'fixture-runtime.js'),'utf8'),context);
const files=['settings','time','settlement','auth','state','render','app','parent','child','admin','updates'];
for(const file of files)vm.runInContext(fs.readFileSync(path.join(app,'js',file+'.js'),'utf8'),context,{filename:file+'.js'});
const run=code=>vm.runInContext(code,context);
(async()=>{
  context.__test.emit();
  await run('refreshTimedState()');
  assert.equal(context.__test.getData().weekend,9);
  assert.equal(document.getElementById('weekJ').innerText,'3');
  assert.equal(document.getElementById('weekendJ').innerText,'9');
  assert.ok(document.getElementById('weekendInfoTextJulek').innerText.includes('9 GODZIN'));
  assert.equal(document.getElementById('weekendInfoJulek').classList.contains('hidden'),false);
  const before=JSON.stringify(context.__test.getData());
  await Promise.all([run('runDueWeekSettlements()'),run('runDueWeekSettlements()')]);
  assert.equal(JSON.stringify(context.__test.getData()),before);
  context.__test.setTime('2026-10-25T22:59:59Z');
  await run('refreshTimedState()');
  assert.equal(document.getElementById('weekendInfoJulek').classList.contains('hidden'),false);
  context.__test.setTime('2026-10-25T23:00:00Z');
  await run('refreshTimedState()');
  assert.equal(document.getElementById('weekendInfoJulek').classList.contains('hidden'),true);
  assert.equal(document.getElementById('weekendInfoParent').classList.contains('hidden'),true);
  assert.equal(document.getElementById('weekendJ').innerText,'0');
  context.__test.setTime('2026-10-30T16:59:59Z');
  await run('refreshTimedState()');
  assert.equal(document.getElementById('weekendInfoJulek').classList.contains('hidden'),true);
  context.__test.setTime('2026-10-30T17:00:00Z');
  await run('refreshTimedState()');
  assert.equal(document.getElementById('weekJ').innerText,'0');
  assert.equal(document.getElementById('weekendJ').innerText,'5');
  assert.equal(document.getElementById('weekendInfoJulek').classList.contains('hidden'),false);
  assert.equal(context.__test.getData().log['2026-04-16'],undefined);
  assert.ok(context.__test.getData().meta.weekClosures['2026-BW-04-10']);
  console.log('PASS pełna aplikacja: rozliczenie, oba panele, ponowienie, niedziela/północ, następny piątek; bez sieci');
})().catch(error=>{console.error(error);process.exitCode=1;});
