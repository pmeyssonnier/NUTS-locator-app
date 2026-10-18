// ---- Stockage local : IndexedDB (centaines de Mo) ; repli en mémoire si indisponible (navigation privée, file:// sous Firefox…)
const DB={p:null,mem:{geo:new Map(),geocode:new Map(),session:new Map()},ok:false};
function dbOpen(){
  return DB.p??=new Promise(res=>{
    try{const q=indexedDB.open('nuts-locator',2);
      q.onupgradeneeded=()=>{const d=q.result;for(const st of ['geocode','geo','session'])if(!d.objectStoreNames.contains(st))d.createObjectStore(st);};
      q.onsuccess=()=>{DB.ok=true;res(q.result);};q.onerror=q.onblocked=()=>res(null);}
    catch(e){res(null);}
  });
}
export async function dbGet(st,k){const d=await dbOpen();if(!d)return DB.mem[st].get(k);
  return new Promise(res=>{try{const q=d.transaction(st).objectStore(st).get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>res(undefined);}catch(e){res(undefined);}});}
export async function dbPut(st,k,v){const d=await dbOpen();if(!d){DB.mem[st].set(k,v);return;}
  return new Promise(res=>{try{const t=d.transaction(st,'readwrite');t.objectStore(st).put(v,k);t.oncomplete=()=>res(true);t.onerror=t.onabort=()=>{DB.mem[st].set(k,v);res(false);};}catch(e){DB.mem[st].set(k,v);res(false);}});}
export async function dbClear(st){const d=await dbOpen();DB.mem[st].clear();if(!d)return 0;
  return new Promise(res=>{try{const t=d.transaction(st,'readwrite'),o=t.objectStore(st),c=o.count();let n=0;c.onsuccess=()=>{n=c.result;o.clear();};t.oncomplete=()=>res(n);t.onerror=()=>res(0);}catch(e){res(0);}});}
const PREF='nutsmap:';
export const prefGet=k=>{try{return localStorage.getItem(PREF+k);}catch(e){return null;}};
export const prefSet=(k,v)=>{try{localStorage.setItem(PREF+k,v);}catch(e){}};
