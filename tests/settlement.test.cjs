const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const app = fs.existsSync(path.join(root,'app')) ? path.join(root,'app') : root;
let now = Date.parse('2026-10-23T15:59:59Z');
class Clock extends Date { constructor(...args){ super(...(args.length ? args : [now])); } static now(){return now;} }
const ctx = vm.createContext({Date:Clock, Intl, console});
for(const file of ['settings.js','time.js','settlement.js']) vm.runInContext(fs.readFileSync(path.join(app,'js',file),'utf8'),ctx,{filename:file});
const run = code => vm.runInContext(code,ctx);
const ts = iso => Date.parse(iso);
const test = (name,fn) => { fn(); console.log('PASS',name); };

test('piątek przed 18:00 i od 18:00',()=>{
  assert.equal(run('businessWeekKeyNow()'),'2026-BW-10-16');
  now=ts('2026-10-23T16:00:00Z');
  assert.equal(run('businessWeekKeyNow()'),'2026-BW-10-23');
  assert.equal(run('previousBusinessWeekKey()'),'2026-BW-10-16');
});
test('niedziela należy do tego samego tygodnia co sobota',()=>{
  for(const date of ['2026-10-24T12:00:00Z','2026-10-25T12:00:00Z','2026-10-26T12:00:00Z']){
    now=ts(date); assert.equal(run('businessWeekKeyNow()'),'2026-BW-10-23');
  }
});
test('zmiana czasu: tydzień może mieć 169 lub 167 godzin',()=>{
  assert.equal(run('(businessWeekBounds("2026-BW-10-23").end-businessWeekBounds("2026-BW-10-23").start)/3600000'),169);
  assert.equal(run('(businessWeekBounds("2026-BW-03-27").end-businessWeekBounds("2026-BW-03-27").start)/3600000'),167);
});
test('granica roku i moment dzienny po piątku 18:00',()=>{
  now=ts('2027-01-01T17:00:00Z');
  assert.equal(run('businessWeekKeyNow()'),'2027-BW-01-01');
  assert.equal(run('previousBusinessWeekKey()'),'2026-BW-12-25');
  assert.equal(run('isTsInCurrentBusinessDay(Date.parse("2027-01-01T16:59:59Z"))'),false);
});

function fixture(){ return {
  log:{'2026-10-23':{
    a:{h:6,ts:ts('2026-10-23T14:00:00Z')},
    b:{h:-4,ts:ts('2026-10-23T14:30:00Z')},
    next:{h:3,ts:ts('2026-10-23T17:00:00Z')}
  }},
  dni:{'2026-10-23':5},
  odwolania:{appeal:{data:'2026-10-23',logId:'b',h:-4,status:'pending',createdAt:ts('2026-10-23T15:00:00Z')}},
  wnioski_punkty:{one:{data:'2026-10-23',child_comment:'Zmywarka',createdAt:ts('2026-10-23T15:30:00Z'),status:'pending'},
    two:{data:'2026-10-23',child_comment:'Zmywarka',createdAt:ts('2026-10-23T15:31:00Z'),status:'pending'}}
}; }
now=ts('2026-10-23T17:30:00Z');
test('rozlicza poprzedni tydzień z odwołaniem i jednym punktem z duplikatów; nowy pozostaje',()=>{
  ctx.data=fixture();
  assert.equal(run('JulekSettlement.settleWeek(data,"2026-BW-10-16",Date.now(),"test")'),true);
  assert.equal(ctx.data.meta.weekendSettlement.earnedHours,7);
  assert.equal(ctx.data.weekend,9);
  assert.equal(ctx.data.wnioski_punkty.two.status,'rejected');
  assert.equal(ctx.data.log['2026-10-23'].next.h,3);
  assert.equal(Object.keys(ctx.data.log['2026-10-23']).length,4);
  assert.equal(run('businessWeekKeyFromTs(data.log["2026-10-23"].settled_one.ts)'),'2026-BW-10-16');
  assert.equal(run('JulekSettlement.effectiveHours(data,"2026-10-23","b",data.log["2026-10-23"].b)'),0);
  assert.equal(run('Object.values(data.log["2026-10-23"]).filter(log=>isTsInCurrentBusinessWeek(log.ts)).reduce((sum,log)=>sum+log.h,0)'),3);
});
test('ponowienie i dwa urządzenia nie zerują wyniku ani nie dopisują bonusu',()=>{
  const before=JSON.stringify(ctx.data);
  assert.equal(run('JulekSettlement.settleWeek(data,"2026-BW-10-16",Date.now(),"retry")'),false);
  assert.equal(JSON.stringify(ctx.data),before);
});
test('nie zamyka rozpoczętego tygodnia',()=>{
  ctx.data=fixture();
  assert.equal(run('JulekSettlement.settleWeek(data,"2026-BW-10-23",Date.now(),"test")'),false);
  assert.equal(ctx.data.weekend,undefined);
});
test('bonus tylko dla sumy zero lub dodatniej',()=>{
  for(const [sum,expected] of [[0,2],[4,6],[-3,-3]]){
    ctx.data={log:{'2026-10-22':{a:{h:sum,ts:ts('2026-10-22T12:00:00Z')}}}};
    run('JulekSettlement.settleWeek(data,"2026-BW-10-16",Date.now(),"test")');
    assert.equal(ctx.data.weekend,expected);
  }
});
test('zaległe rozliczenie w poniedziałek, bez otwartej aplikacji w piątek',()=>{
  now=ts('2026-10-26T10:00:00Z');ctx.data=fixture();
  assert.equal(run('JulekSettlement.dueWeeks(data,Date.now()).includes("2026-BW-10-16")'),true);
  run('JulekSettlement.settleWeek(data,"2026-BW-10-16",Date.now(),"catchup")');
  assert.equal(ctx.data.weekend,9);
  assert.equal(run('Date.now()<weekendExpiresAt(data.meta.weekendSettlement.endAt)'),false);
});
test('komunikat wygasa o północy w Warszawie mimo zmiany czasu',()=>{
  assert.equal(run('weekendExpiresAt(businessWeekBounds("2026-BW-10-16").end)'),ts('2026-10-25T23:00:00Z'));
});
test('historia obejmuje 14 dni kalendarzowych',()=>{
  now=ts('2026-10-26T10:00:00Z');
  assert.equal(run('isHistoryDateVisible("2026-10-13")'),true);
  assert.equal(run('isHistoryDateVisible("2026-10-12")'),false);
  assert.equal(run('isHistoryDateVisible("2026-04-16")'),false);
});
test('pierwsze uruchomienie po wielu tygodniach rozlicza chronologicznie',()=>{
  ctx.data={log:{'2026-04-10':{a:{h:5,ts:ts('2026-04-10T12:00:00Z')}},'2026-10-22':{b:{h:3,ts:ts('2026-10-22T12:00:00Z')}}}};
  run('for(const key of JulekSettlement.dueWeeks(data,Date.now())) JulekSettlement.settleWeek(data,key,Date.now(),"catchup")');
  assert.equal(ctx.data.weekend,5);
  assert.equal(ctx.data.meta.weekendSettlement.weekKey,'2026-BW-10-16');
  assert.ok(ctx.data.log['2026-04-10']);
});
if(fs.existsSync(path.join(root,'original/js/app.js'))) test('oryginał odtwarza błąd: o 18:00 wskazuje nowy tydzień do zamknięcia',()=>{
  now=ts('2026-10-23T16:00:00Z');
  const old=vm.createContext({Date:Clock,Intl});
  vm.runInContext(fs.readFileSync(path.join(root,'original/js/time.js'),'utf8'),old);
  assert.equal(vm.runInContext('businessWeekKeyNow()',old),'2026-BW-10-23');
  const source=fs.readFileSync(path.join(root,'original/js/app.js'),'utf8');
  assert.ok(source.includes('const wk = getBusinessWeekKeyNow();'));
  assert.ok(source.includes('await closeWeekCore(wk, "auto_friday18")'));
});
test('czyszczenie usuwa stare logi, dni, wnioski, odwołania i blokady, zachowując wyniki i notatki',()=>{
  now=ts('2026-10-26T10:00:00Z');
  ctx.data={log:{'2026-10-12':{a:{h:3}},'2026-10-13':{b:{h:2}}},dni:{'2026-10-12':3,'2026-10-13':2},
    wnioski_punkty:{old:{data:'2026-10-12'},keep:{data:'2026-10-13'}},
    odwolania:{old:{data:'2026-10-12'},keep:{data:'2026-10-13'}},wnioski_punkty_fplock:{'2026-10-12':{},'2026-10-13':{}},
    meta:{weekClosures:{'2026-BW-10-02':{hours:7}},adminNotes:{a:{text:'Notatka'}}}};
  run('JulekSettlement.purgeOldHistory(data,Date.now())');
  for(const node of ['log','dni','wnioski_punkty_fplock']){
    assert.equal(ctx.data[node]['2026-10-12'],undefined); assert.ok(ctx.data[node]['2026-10-13']!==undefined);
  }
  assert.equal(ctx.data.wnioski_punkty.old,undefined);
  assert.equal(ctx.data.odwolania.old,undefined);
  assert.equal(ctx.data.meta.weekClosures['2026-BW-10-02'].hours,7);
  assert.ok(ctx.data.meta.adminNotes.a);
});
console.log('Timezone:',Intl.DateTimeFormat().resolvedOptions().timeZone);
