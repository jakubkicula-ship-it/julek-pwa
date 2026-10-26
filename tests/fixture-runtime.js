/* Wyłącznie testy: lokalna baza w pamięci, bez połączeń z Firebase. */
(function(root){
  const NativeDate = Date;
  let clock = NativeDate.parse('2026-10-23T17:00:00Z');
  root.Date = class extends NativeDate {
    constructor(...args){ super(...(args.length ? args : [clock])); }
    static now(){ return clock; }
  };
  let state = {
    log:{'2026-04-16':{old:{h:8,opis:'Stary wpis – kwiecień',ts:NativeDate.parse('2026-04-16T10:00:00Z')}},
      '2026-10-23':{
        a:{h:6,opis:'Wypracowane godziny',rodzic:'Kuba',ts:NativeDate.parse('2026-10-23T14:00:00Z')},
        b:{h:-4,opis:'Punkty z odwołaniem',rodzic:'Kuba',ts:NativeDate.parse('2026-10-23T14:30:00Z')},
        next:{h:3,opis:'Punkty nowego tygodnia',rodzic:'Kuba',ts:NativeDate.parse('2026-10-23T16:30:00Z')}
      }},
    dni:{'2026-10-23':5},
    odwolania:{appeal:{data:'2026-10-23',logId:'b',h:-4,status:'pending',powod:'Testowy powód odwołania',createdAt:NativeDate.parse('2026-10-23T15:00:00Z')}},
    wnioski_punkty:{request:{data:'2026-10-23',child_comment:'Zmywarka',createdAt:NativeDate.parse('2026-10-23T15:30:00Z'),status:'pending'}}
  };
  const clone = value => value == null ? null : JSON.parse(JSON.stringify(value));
  const at = path => path ? path.split('/').filter(Boolean).reduce((value,key)=>value?.[key],state) ?? null : state;
  function set(path,value){
    if(!path){state=clone(value);return;}
    const parts=path.split('/').filter(Boolean); let parent=state;
    for(const key of parts.slice(0,-1)) parent=parent[key] ||= {};
    if(value==null) delete parent[parts.at(-1)]; else parent[parts.at(-1)]=clone(value);
  }
  const listeners=[];
  function snapshot(value,key=null){
    return {key,val:()=>clone(value),exists:()=>value!=null,
      forEach:fn=>{for(const [id,v] of Object.entries(value||{})){if(fn(snapshot(v,id))===true)break;}}};
  }
  function emit(){
    for(const listener of listeners){
      const json=JSON.stringify(at(listener.path));
      if(json===listener.previous) continue;
      listener.previous=json;
      listener.fn(snapshot(clone(at(listener.path))));
    }
  }
  function ref(path=''){
    return {key:path.split('/').at(-1),child:key=>ref(path+'/'+key),
      on:(_type,fn)=>{listeners.push({path,fn,previous:undefined});},
      once:async()=>snapshot(clone(at(path))),
      transaction:async(fn)=>{
        // Tak jak w Firebase callback może zostać uruchomiony ponownie.
        fn(clone(at(path)));
        const result=fn(clone(at(path)));
        if(result===undefined) return {committed:false,snapshot:snapshot(clone(at(path)))};
        set(path,result);emit();return {committed:true,snapshot:snapshot(clone(at(path)))};
      },
      set:async value=>{set(path,value);emit();},
      update:async values=>{for(const [key,value] of Object.entries(values))set(path?path+'/'+key:key,value);emit();},
      remove:async()=>{set(path,null);emit();},
      push:value=>{const item=ref(path+'/test_'+Math.random().toString(36).slice(2));if(value!==undefined)item.set(value);return item;}
    };
  }
  root.firebase={apps:[],initializeApp(){this.apps.push({});},database:()=>({ref})};
  root.__test={emit,getData:()=>clone(state),setTime:iso=>{clock=NativeDate.parse(iso);}};
})(globalThis);
