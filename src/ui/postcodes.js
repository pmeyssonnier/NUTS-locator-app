import {decodeText} from '../lib/csv.js';
import {parsePostcodeTables} from '../lib/postcodes.js';
import {zipOpen, zipText} from '../lib/zip.js';
import {$, setStatus} from './dom.js';
import {render} from './render.js';
import {reapplyPostal} from './run.js';
import {refreshStorage} from './storeinfo.js';
import {S, summary} from './state.js';
import {dbGet, dbPut} from './storage.js';

// Tables « code postal → NUTS 3 » d'Eurostat (Tercet) : PROTOTYPE de contrôle croisé.
// Importées par l'utilisateur (.zip tel que téléchargé, ou .csv), conservées dans IndexedDB comme les contours.
const INDEX='pcnuts_index';

function show(){
  const t=Object.values(S.postal);
  $('#pcStatus').textContent=t.length
    ?'Tables chargées : '+t.map(x=>`${x.iso} (NUTS ${x.nutsVersion||'millésime inconnu'}, ${x.count.toLocaleString('fr-BE')} codes postaux${x.multi?`, ${x.multi} à plusieurs NUTS 3`:''})`).join(' · ')
    :'Aucune table : le NUTS 3 n\'est déterminé que par la position du point.';
  $('#pcClear').hidden=!t.length;
}
// fichiers texte à analyser : le .csv, ou les .csv/.txt d'une archive .zip
async function readTables(file){
  const buf=await file.arrayBuffer();
  if(!/\.zip$/i.test(file.name))return [{name:file.name,text:decodeText(buf)}];
  const z=zipOpen(buf),out=[];
  for(const n of Object.keys(z.files))if(/\.(csv|txt)$/i.test(n))out.push({name:n.split('/').pop(),text:await zipText(z,n)});
  if(!out.length)throw new Error('aucun fichier .csv dans l\'archive');
  return out;
}
async function save(){await dbPut('geo',INDEX,Object.keys(S.postal));}
// applique les tables (ou leur retrait) aux lignes déjà géocodées, sans nouvel appel au géocodeur
async function refresh(){
  const r=await reapplyPostal();
  if(!r)return 'Contours NUTS indisponibles : relancez « Géocoder » pour appliquer les tables aux lignes déjà traitées.';
  if(r.done)render();
  return (r.done?`${r.done} ligne(s) déjà géocodée(s) recalculée(s) avec les tables actuelles.\n${summary()}`:'')
    +(r.stale?`${r.done?'\n':''}${r.stale} ligne(s) d'une ancienne session ne peuvent pas être recalculées : relancez « Géocoder » (décochez « Seulement les lignes non OK »).`:'');
}

export function initPostcodes(){
  $('#pcFiles').addEventListener('change',async e=>{
    const ok=[],ko=[];
    for(const f of [...e.target.files]){
      try{for(const {name,text} of await readTables(f)){
        setStatus(`Analyse de ${name}… (un fichier tous pays compte plus de 800 000 lignes : quelques secondes)`);await new Promise(r=>setTimeout(r,20));
        for(const t of parsePostcodeTables(text,name)){
          S.postal[t.iso]=t;await dbPut('geo','pcnuts_'+t.iso,t);
          ok.push(`${t.iso} : ${t.count.toLocaleString('fr-BE')}${t.nutsVersion?'':' (millésime NUTS inconnu : nom de fichier non reconnu, contrôle non concluant)'}`);}
      }}catch(err){ko.push(f.name+' ('+err.message+')');}
    }
    await save();e.target.value='';show();
    const base=`Tables importées : ${ok.length} pays${ok.length?' — '+ok.join(' ; '):''}${ko.length?'\nRefusées : '+ko.join(' ; '):''}`;
    setStatus(base,ko.length>0);refreshStorage(true);
    if(ok.length){const m=await refresh();if(m)setStatus(base+'\n'+m,ko.length>0);}
  });
  $('#pcClear').onclick=async()=>{
    for(const iso of Object.keys(S.postal))await dbPut('geo','pcnuts_'+iso,null);
    S.postal={};await save();show();setStatus('Tables code postal → NUTS retirées.');
    const m=await refresh();if(m)setStatus('Tables code postal → NUTS retirées.\n'+m);
  };
  // tables conservées d'une session précédente
  dbGet('geo',INDEX).then(async idx=>{
    for(const iso of idx||[]){const t=await dbGet('geo','pcnuts_'+iso);if(t&&t.entries)S.postal[iso]=t;}
    show();
  });
  show();refreshStorage();
}
