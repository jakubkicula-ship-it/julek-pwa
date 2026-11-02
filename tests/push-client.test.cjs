const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
test('enable requires only system permission; no code dialog or password is used',async()=>{
  const sent=[],alerts=[],storage=new Map();let permissions=0;
  const subscription={toJSON:()=>({endpoint:'https://fcm.googleapis.com/test',keys:{}}),unsubscribe:async()=>{}};
  const context=vm.createContext({
    navigator:{userAgent:'Android',serviceWorker:{ready:Promise.resolve({pushManager:{getSubscription:async()=>null,subscribe:async()=>subscription}})}},
    Notification:{permission:'granted',requestPermission:async()=>{permissions++;return 'granted';}},PushManager:function(){},isSecureContext:true,
    document:{querySelectorAll:()=>[]},localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},
    alert:value=>alerts.push(value),askPinMasked(){throw new Error('No code dialog allowed');},
    atob:value=>Buffer.from(value,'base64').toString('binary'),Uint8Array,AbortSignal,setTimeout(){},
    fetch:async(url,options)=>{if(options.body){sent.push(JSON.parse(options.body));return {ok:true,json:async()=>({ok:true})};}return {ok:true,json:async()=>({publicKey:'AA'})};},
    JULEK_PUSH:{apiUrl:'https://worker.test/api'}
  });context.window=context;
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/push.js'),'utf8'),context);
  await context.openPushSettings();
  assert.equal(permissions,1);assert.equal(sent.length,1);assert.equal(sent[0].role,'Julek');
  assert.equal(Object.hasOwn(sent[0],'code'),false);assert.equal(storage.get('julek-push-device-role'),'Julek');
  assert.match(alerts[0],/Wysłano powiadomienie testowe/);
});
