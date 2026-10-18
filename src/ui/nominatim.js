import {S} from './state.js';
import {dbGet, dbPut} from './storage.js';

const sleep2=(ms,sig)=>new Promise((res,rej)=>{const t=setTimeout(res,ms);sig?.addEventListener('abort',()=>{clearTimeout(t);rej(new DOMException('Arrêt','AbortError'));},{once:true});});
export async function nominatim(params,cfg){
  const u=new URL(cfg.nomUrl.replace(/\/+$/,'')+'/search');
  for(const [k,v] of Object.entries(params))if(v)u.searchParams.set(k,v);
  u.searchParams.set('format','jsonv2');u.searchParams.set('limit','1');u.searchParams.set('addressdetails','1');
  const key=u.toString();
  const hit=await dbGet('geocode',key);if(hit)return hit;
  if(cfg.email)u.searchParams.set('email',cfg.email);
  for(let a=0;a<3;a++){
    const w=1100-(Date.now()-S.last);if(w>0)await sleep2(w,cfg.signal);S.last=Date.now();
    const r=await fetch(u,{signal:AbortSignal.any([cfg.signal,AbortSignal.timeout(20000)])});
    if(r.status===429||r.status>=500){await sleep2(5000*(a+1),cfg.signal);continue;}
    if(!r.ok)throw new Error('Nominatim HTTP '+r.status);
    const j=await r.json();if(!j[0])return null;            // échec : jamais mis en cache
    const ad=j[0].address||{},res={lat:+j[0].lat,lon:+j[0].lon,label:j[0].display_name,postcode:ad.postcode||'',
      cc:String(ad.country_code||'').toUpperCase(),rank:+j[0].place_rank||0,atype:j[0].addresstype||'',t:Date.now()};
    await dbPut('geocode',key,res);
    return res;
  }
  throw new Error('Nominatim indisponible (trop de requêtes)');
}
