// Wersjonowane granice rozliczeń; starych okresów nie zmieniamy.
let JULEK_SCHEDULE_VERSIONS=[];
const legacyWeekStart=businessWeekStartAt,legacyWeekKey=businessWeekKeyFromTs,legacyBounds=businessWeekBounds;
function configureCalendar(versions){JULEK_SCHEDULE_VERSIONS=Array.isArray(versions)?versions.slice().sort((a,b)=>a.effectiveAt-b.effectiveAt):[];}
function nextScheduledBoundary(ts,day,time){const [h,m]=time.split(':').map(Number);let date=isoDateShift(warsawDateIso(ts),(day-warsawWeekday(ts)+7)%7);let value=warsawTimestamp(date,h,m);if(value<=ts)value=warsawTimestamp(isoDateShift(date,7),h,m);return value;}
function scheduleAt(ts){return JULEK_SCHEDULE_VERSIONS.filter(v=>v.effectiveAt<=ts).at(-1);}
businessWeekStartAt=function(ts=Date.now()){const v=scheduleAt(ts);if(!v)return legacyWeekStart(ts);let first=nextScheduledBoundary(v.effectiveAt,v.day,v.time);if(ts<first)return v.effectiveAt;const [h,m]=v.time.split(':').map(Number);let date=isoDateShift(warsawDateIso(ts),-((warsawWeekday(ts)-v.day+7)%7));let at=warsawTimestamp(date,h,m);if(at>ts)at=warsawTimestamp(isoDateShift(date,-7),h,m);return Math.max(v.effectiveAt,at);};
businessWeekKeyFromTs=function(ts){const n=Number(ts);if(!Number.isFinite(n)||n<=0)return '';return scheduleAt(n)?'V3-'+businessWeekStartAt(n):legacyWeekKey(n);};
businessWeekBounds=function(key){if(!String(key).startsWith('V3-'))return legacyBounds(key);const start=Number(key.slice(3)),v=scheduleAt(start);if(!v)return null;let end=nextScheduledBoundary(start,v.day,v.time);const next=JULEK_SCHEDULE_VERSIONS.find(x=>x.effectiveAt>start&&x.effectiveAt<end);if(next)end=next.effectiveAt;return {start,end};};
