const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const assert=require('node:assert/strict');
const base=path.resolve(__dirname,'..');
const root=fs.existsSync(path.join(base,'app')) ? path.join(base,'app') : base;
const events={};const cached=new Map();let deleted=[];let added=[];let claimed=false;let skipped=false;
const cache={addAll:async files=>{added=files;},match:async request=>cached.get(request.url),put:async(request,response)=>cached.set(request.url,response)};
const context=vm.createContext({URL,console,
  caches:{open:async()=>cache,keys:async()=>['julek-pwa-old','unrelated-cache','julek-pwa-2.2.0'],delete:async key=>deleted.push(key)},
  fetch:async()=>{throw new Error('offline');},
  self:{location:{origin:'https://example.test'},registration:{scope:'https://example.test/julek-pwa/'},clients:{claim:async()=>{claimed=true;}},skipWaiting:()=>{skipped=true;},addEventListener:(type,fn)=>{events[type]=fn;}}
});
context.importScripts=file=>vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),context);
(async()=>{
  let work;events.install({waitUntil:p=>work=p});await work;
  for(const file of added)assert.ok(fs.existsSync(path.join(root,file)),file);
  events.activate({waitUntil:p=>work=p});await work;
  assert.deepEqual(deleted,['julek-pwa-old']);assert.equal(claimed,true);
  events.message({data:{type:'SKIP_WAITING'}});assert.equal(skipped,true);
  const request={method:'GET',url:'https://example.test/julek-pwa/index.html'};
  const response={ok:true};cached.set(request.url,response);
  events.fetch({request,respondWith:p=>work=p});assert.equal(await work,response);
  let intercepted=false;
  events.fetch({request:{method:'GET',url:'https://database.example.test/data.json'},respondWith:()=>{intercepted=true;}});
  assert.equal(intercepted,false);
  events.fetch({request:{method:'GET',url:'https://example.test/another-project/'},respondWith:()=>{intercepted=true;}});
  assert.equal(intercepted,false);
  console.log('PASS service worker: uruchomienie bez window, pliki cache istnieją, izolacja projektu, fallback offline, aktualizacja');
})().catch(error=>{console.error(error);process.exitCode=1;});
