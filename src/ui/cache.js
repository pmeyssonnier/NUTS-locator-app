import {$, setStatus} from './dom.js';
import {refreshStorage} from './storeinfo.js';
import {ensureLevel} from './map.js';
import {resetNutsCache} from './nuts.js';
import {S} from './state.js';
import {dbClear, dbPut} from './storage.js';

export function initCache(){
  $('#clearCache').onclick=async()=>{
    let old=0;try{for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k&&k.startsWith('nutsgeo')){localStorage.removeItem(k);old++;}}}catch(e){}
    const n=await dbClear('geocode');
    setStatus(`Cache de géocodage vidé (${n} entrées${old?` + ${old} anciennes entrées v2–v7`:''}). Les contours NUTS restent en cache.`);};
  $('#geoFiles').addEventListener('change',async e=>{
    const fs=[...e.target.files];let ok=[],ko=[];
    for(const f of fs){
      try{if(!/^NUTS_RG_\w+_(2021|2024)_4326(_LEVL_\d)?\.geojson$/i.test(f.name))throw new Error('nom de fichier GISCO attendu');
        const j=JSON.parse(await f.text());if(!Array.isArray(j.features))throw new Error('pas un GeoJSON');
        await dbPut('geo',f.name,j);ok.push(f.name);}catch(err){ko.push(f.name+' ('+err.message+')');}
    }
    refreshStorage(true);resetNutsCache();S.levels={};S.names=null;S.ukNames=false;
    e.target.value='';await ensureLevel();
    setStatus(`Contours importés : ${ok.length}${ok.length?' — '+ok.join(', '):''}${ko.length?'\nRefusés : '+ko.join(' ; '):''}`,ko.length>0);
  });
}
