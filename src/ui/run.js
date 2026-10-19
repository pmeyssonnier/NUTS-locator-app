import {applyResult, geocodeRow, resolveByPostcode, RES} from '../lib/geocode.js';
import {btns} from './controls.js';
import {$, announce, setStatus} from './dom.js';
import {ensureLevel, fit} from './map.js';
import {nominatim} from './nominatim.js';
import {loadNames, loadNuts} from './nuts.js';
import {render, renderSoon} from './render.js';
import {saveSession} from './session.js';
import {getMap, lkey, S, summary, ukOn} from './state.js';

// le résultat brut du géocodeur est gardé sur la ligne (r.__g) : les tables de codes postaux peuvent ainsi être appliquées sans géocoder à nouveau
const apply=(r,g,cfg)=>{r.__g=g;applyResult(r,g,cfg,S.nuts,S.names,S.postal);};
// Recalcule les lignes déjà géocodées avec les tables actuelles. Renvoie {done, stale} (stale : lignes traitées sans résultat gardé, à relancer) ou null si les contours manquent.
export async function reapplyPostal(){
  const rows=S.rows.filter(r=>r.__g),stale=S.rows.filter(r=>r.statut&&!r.__g&&r.precision!=='CODE_POSTAL_TABLE'&&r.statut!=='ERREUR'&&r.statut!=='ECHEC_CP').length;
  if(!rows.length)return {done:0,stale};
  try{await loadNuts($('#res').value);S.nuts=S.levels[lkey(3,$('#res').value)];}catch(e){return null;}
  const cfg={maxKm:Math.max(0,+$('#maxKm').value||0),uk:ukOn()};
  for(const r of rows)apply(r,r.__g,cfg);
  await saveSession();
  return {done:rows.length,stale};
}
// Mode sans géocodage : NUTS 3 déduit du code postal par les tables Eurostat, sans position ni réseau (hors libellés)
async function runNoGeo(m,only){
  if(!m.cp){setStatus('Indiquez la colonne Code postal.',true);return;}
  if(!Object.keys(S.postal).length){setStatus('Importez d\'abord les tables Eurostat « code postal → NUTS 3 » (section 2).',true);return;}
  S.running=true;btns();
  let names=S.names;
  try{await loadNames();names=S.names;}catch(e){names={};setStatus('Libellés Eurostat indisponibles (les codes NUTS restent valides) : '+e.message,true);}
  const cfg={defPays:$('#defPays').value},rowsRef=S.rows;
  const todo=only||S.rows.filter(r=>!$('#onlyMissing').checked||r.statut!=='OK');
  for(const r of todo){if(S.rows!==rowsRef)break;delete r.__g;resolveByPostcode(r,m,cfg,names,S.postal);}
  $('#bar').style.width='100%';
  S.running=false;btns();await saveSession();
  const msg=`Terminé (sans géocodage, ${todo.length} ligne(s)). `+summary();
  setStatus(msg);announce(msg.replace(/\n/g,'. '));render();
}
// only (facultatif) : ne traiter que ces lignes (saisie manuelle) ; sans lui, toutes les lignes ou seulement celles qui ne sont pas OK
export async function run(only){
  const m=getMap();if($('#noGeo').checked)return runNoGeo(m,only);if(!m.adr&&!m.cp&&!m.ville){setStatus('Indiquez au moins la colonne Adresse, Code postal ou Ville.',true);return;}
  const cfg={nomUrl:$('#nomUrl').value,email:$('#email').value.trim(),defPays:$('#defPays').value,maxKm:Math.max(0,+$('#maxKm').value||0),uk:ukOn(),memory:S.strategy};
  S.ctrl=new AbortController();cfg.signal=S.ctrl.signal;
  S.running=true;btns();
  try{await loadNuts($('#res').value);S.nuts=S.levels[lkey(3,$('#res').value)];}catch(e){setStatus('Impossible de charger les contours NUTS : '+e.message,true);S.running=false;btns();return;}
  const todo=only||S.rows.filter(r=>!$('#onlyMissing').checked||r.statut!=='OK'),rowsRef=S.rows;
  let i=0,bad=0,halt=false;const t0=Date.now();
  for(const r of todo){
    if(!S.running||S.rows!==rowsRef)break;i++;
    try{const g=await geocodeRow(r,m,cfg,nominatim);if(cfg.signal.aborted){i--;break;}apply(r,g,cfg);bad=0;}
    catch(e){if(e.name==='AbortError'||cfg.signal.aborted){i--;break;}delete r.__g;RES.forEach(c=>r[c]='');r.statut='ERREUR';r.confiance='FAIBLE';r.controle_manuel='OUI';r.controle=e.message;
      if(++bad>=5){halt=true;break;}}
    $('#bar').style.width=(100*i/todo.length)+'%';
    const eta=Math.round((Date.now()-t0)/i*(todo.length-i)/1000);
    setStatus(`${i}/${todo.length} — reste ~${eta}s\n${summary()}`);renderSoon();
    if(i%50===0)saveSession();
  }
  S.running=false;btns();await saveSession();
  const msg=(halt?'Interrompu après 5 erreurs consécutives (réseau ou serveur indisponible). ':i<todo.length?'Arrêté. ':'Terminé. ')+summary();
  setStatus(msg,halt);announce(msg.replace(/\n/g,'. '));
  render();await ensureLevel();fit();
}
export function initRun(){
  $('#run').onclick=()=>run();
  // le libellé suit la case, y compris quand le navigateur la restaure cochée à la réouverture de la page
  $('#noGeo').checked=false;
  const label=()=>{$('#run').textContent=$('#noGeo').checked?'Déterminer le NUTS':'Géocoder';};
  $('#noGeo').onchange=label;label();addEventListener('pageshow',()=>{$('#noGeo').checked=false;label();});   // après la restauration du formulaire par le navigateur
  $('#stop').onclick=()=>{S.running=false;S.ctrl?.abort();};
}
