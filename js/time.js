// Granice okresów jako rzeczywiste timestampy w Europe/Warsaw.
const WARSAW_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
});
function warsawParts(ts = Date.now()) {
  return Object.fromEntries(WARSAW_FORMAT.formatToParts(new Date(ts)).filter(p => p.type !== "literal").map(p => [p.type, Number(p.value)]));
}
function warsawDateIso(ts = Date.now()) {
  const p = warsawParts(ts);
  return `${p.year}-${String(p.month).padStart(2,"0")}-${String(p.day).padStart(2,"0")}`;
}
function todayIso(){ return warsawDateIso(); }
// Tylko do odczytu pól lokalnego czasu, nie do porównywania timestampów.
function nowWarsaw(){ const p=warsawParts(); return new Date(p.year,p.month-1,p.day,p.hour,p.minute,p.second); }
function isoDateShift(iso, days){
  const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0,10);
}
function warsawTimestamp(iso, hour=0, minute=0, second=0){
  const [y,m,d]=iso.split("-").map(Number);
  const wall=Date.UTC(y,m-1,d,hour,minute,second); let result=wall;
  for(let i=0;i<4;i++){
    const p=warsawParts(result);
    const delta=wall-Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);
    if(!delta) break;
    result+=delta;
  }
  return result;
}
function warsawWeekday(ts=Date.now()){ return new Date(`${warsawDateIso(ts)}T12:00:00Z`).getUTCDay(); }
function businessWeekStartAt(ts=Date.now()){
  let friday=isoDateShift(warsawDateIso(ts),-((warsawWeekday(ts)+2)%7));
  if(ts < warsawTimestamp(friday,18)) friday=isoDateShift(friday,-7);
  return warsawTimestamp(friday,18);
}
function businessWeekKeyFromTs(ts){
  const n=Number(ts); if(!Number.isFinite(n)||n<=0) return "";
  const iso=warsawDateIso(businessWeekStartAt(n)); return `${iso.slice(0,4)}-BW-${iso.slice(5)}`;
}
function businessWeekKeyFromDate(date){ return businessWeekKeyFromTs(date.getTime()); }
function businessWeekKeyNow(){ return businessWeekKeyFromTs(Date.now()); }
function businessWeekKeyFromIsoDate(iso){ return iso ? businessWeekKeyFromTs(warsawTimestamp(iso,12)) : ""; }
function businessWeekBounds(key){
  const m=/^(\d{4})-BW-(\d{2}-\d{2})$/.exec(key||""); if(!m) return null;
  const date=`${m[1]}-${m[2]}`;
  return {start:warsawTimestamp(date,18),end:warsawTimestamp(isoDateShift(date,7),18)};
}
function previousBusinessWeekKey(ts=Date.now()){ return businessWeekKeyFromTs(businessWeekStartAt(ts)-1); }
function currentBusinessWeekStart(){ return new Date(businessWeekStartAt()); }
function currentBusinessWeekEnd(){ return new Date(businessWeekBounds(businessWeekKeyNow()).end-1); }
function currentBusinessDayStart(){ return new Date(warsawTimestamp(todayIso(),isFriday()&&warsawParts().hour>=18 ? 18 : 0)); }
function currentBusinessDayEnd(){ return new Date(warsawTimestamp(isoDateShift(todayIso(),1))-1); }
function isTsInCurrentBusinessDay(ts){ return Number(ts)>=currentBusinessDayStart().getTime() && Number(ts)<=currentBusinessDayEnd().getTime(); }
function isTsInCurrentBusinessWeek(ts){ return Number(ts)>=businessWeekStartAt() && Number(ts)<=currentBusinessWeekEnd().getTime(); }
function endOfNextDayDeadlineDay(){ return isoDateShift(todayIso(),1); }
function isoWeekKeyFromIsoDate(iso){
  const d=new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));
  const y=d.getUTCFullYear(); const week=Math.ceil(((d-Date.UTC(y,0,1))/86400000+1)/7);
  return `${y}-W${String(week).padStart(2,"0")}`;
}
function isoWeekKeyWarsaw(){ return isoWeekKeyFromIsoDate(todayIso()); }
function isFriday(){ return warsawWeekday()===5; }
function isFridayWarningTime(){ return isFriday() && warsawParts().hour>=12; }
function isFridayBlocked(){ const p=warsawParts(); const n=p.hour*60+p.minute; return isFriday() && n>=1050 && n<1085; }
function isFridayAutoAcceptTime(){ return isFriday() && warsawParts().hour>=18; }
function isWeekend(){ const d=warsawWeekday(); return d===6 || d===0 || (d===5 && warsawParts().hour>=18); }
function isMonday(){ return warsawWeekday()===1; }
function isWeekendCounterTime(){ return isWeekend(); }
function isWeekendMessageTime(){ return isWeekend(); }
function weekendExpiresAt(endAt){ return warsawTimestamp(isoDateShift(warsawDateIso(endAt),3)); }
function isHistoryDateVisible(date){ return !!date && date>=isoDateShift(todayIso(),-(JULEK_SETTINGS.historyDays-1)) && date<=todayIso(); }
