const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
test('background push is visible, has a stable tag, and click remains within app scope',async()=>{
  const handlers={};let notification,opened,focused=false;
  const context=vm.createContext({URL,importScripts(){},JULEK_SETTINGS:{version:'2.4.0'},
    self:{registration:{scope:'https://example.test/julek-pwa/',showNotification:async(title,opts)=>{notification={title,...opts};}},location:{origin:'https://example.test'},addEventListener:(name,fn)=>handlers[name]=fn,
      clients:{matchAll:async()=>[],openWindow:async url=>opened=url}},
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),context);
  let task;
  handlers.push({data:{json:()=>({title:'Wniosek',body:'Decyzja',id:'test',url:'https://evil.test/'})},waitUntil:p=>task=p});await task;
  assert.equal(notification.title,'Wniosek');assert.equal(notification.tag,'test');assert.equal(notification.data.url,'https://example.test/julek-pwa/');
  handlers.notificationclick({notification:{close(){},data:{url:'https://evil.test/'}},waitUntil:p=>task=p});await task;
  assert.equal(opened,'https://example.test/julek-pwa/');
  context.self.clients.matchAll=async()=>[{url:'https://example.test/julek-pwa/',focus:async()=>focused=true}];
  opened=null;handlers.notificationclick({notification:{close(){}},waitUntil:p=>task=p});await task;
  assert.equal(focused,true);assert.equal(opened,null);
});
