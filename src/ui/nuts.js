import {cleanName, prepNuts} from '../lib/geo.js';
import {setStatus} from './dom.js';
import {lkey, S, ukOn} from './state.js';
import {dbGet, dbPut} from './storage.js';

export const GISCO='https://gisco-services.ec.europa.eu/distribution/v2/nuts/geojson/';
async function okJson(r){if(!r.ok)throw new Error('HTTP '+r.status+' '+r.url);return r.json();}
// Contours GISCO : cache local par nom de fichier (fonctionne ensuite hors ligne / derrière un pare-feu)
export async function gisco(file){
  const hit=await dbGet('geo',file);if(hit)return hit;
  let j;try{j=await fetch(GISCO+file).then(okJson);}
  catch(e){throw new Error(`${file} : téléchargement impossible (${e.message}). Téléchargez-le depuis GISCO et chargez-le avec « Importer des contours ».`);}
  await dbPut('geo',file,j);return j;
}
const NP={};
export async function addUK(feats,l,res){
  if(!ukOn()||feats.some(f=>f.id.startsWith('UK')))return feats;
  const g=await gisco(`NUTS_RG_${res}_2021_4326_LEVL_${l}.geojson`);
  const uk=prepNuts(g.features.filter(f=>String(f.properties.NUTS_ID).startsWith('UK')));
  uk.forEach(f=>{f.v='2021';S.names[f.id]=f.name;});
  return feats.concat(uk);
}
async function loadUKNames(){
  if(!ukOn()||S.ukNames)return;
  const g=await gisco('NUTS_RG_60M_2021_4326.geojson');
  for(const f of g.features){const id=f.properties.NUTS_ID;if(String(id).startsWith('UK'))S.names[id]=cleanName(f.properties.NAME_LATN);}
  S.ukNames=true;
}
// Libellés Eurostat seuls (mode sans géocodage : pas besoin des contours)
export async function loadNames(){
  if(S.names)return;
  setStatus('Téléchargement des libellés Eurostat…');
  const g=await gisco('NUTS_RG_60M_2024_4326.geojson');
  const n={};for(const f of g.features)n[f.properties.NUTS_ID]=cleanName(f.properties.NAME_LATN);
  S.names=n;
}
export function loadNuts(res){
  const k=res+'_'+(ukOn()?1:0);
  return NP[k]??=(async()=>{
    setStatus(`Téléchargement des contours NUTS 3 (${res}) et des libellés Eurostat…`);
    const [g3,gall]=await Promise.all([gisco(`NUTS_RG_${res}_2024_4326_LEVL_3.geojson`),
      S.names?null:gisco('NUTS_RG_60M_2024_4326.geojson')]);
    if(gall){S.names={};for(const f of gall.features)S.names[f.properties.NUTS_ID]=cleanName(f.properties.NAME_LATN);}
    let feats=prepNuts(g3.features);for(const f of feats)S.names[f.id]=f.name;
    if(ukOn()){setStatus('Téléchargement des zones Royaume-Uni (NUTS 2021)…');feats=await addUK(feats,3,res);await loadUKNames();}
    S.levels[lkey(3,res)]=feats;S.nuts=feats;S.nutsRes=res;
  })().catch(e=>{delete NP[k];throw e;});
}
export function resetNutsCache(){for(const k of Object.keys(NP))delete NP[k];}
