import {applyResult, geocodeRow, RES} from '../lib/geocode.js';
import {btns} from './controls.js';
import {$, announce, setStatus} from './dom.js';
import {ensureLevel, fit} from './map.js';
import {nominatim} from './nominatim.js';
import {loadNuts} from './nuts.js';
import {render, renderSoon} from './render.js';
import {saveSession} from './session.js';
import {getMap, lkey, S, summary, ukOn} from './state.js';

const apply=(r,g,cfg)=>applyResult(r,g,cfg,S.nuts,S.names,S.postal);
export async function run(){
  const m=getMap();if(!m.adr&&!m.cp&&!m.ville){setStatus('Indiquez au moins la colonne Adresse, Code postal ou Ville.',true);return;}
  const cfg={nomUrl:$('#nomUrl').value,email:$('#email').value.trim(),defPays:$('#defPays').value,maxKm:Math.max(0,+$('#maxKm').value||0),uk:ukOn(),memory:S.strategy};
  S.ctrl=new AbortController();cfg.signal=S.ctrl.signal;
  S.running=true;btns();
  try{await loadNuts($('#res').value);S.nuts=S.levels[lkey(3,$('#res').value)];}catch(e){setStatus('Impossible de charger les contours NUTS : '+e.message,true);S.running=false;btns();return;}
  const todo=S.rows.filter(r=>!$('#onlyMissing').checked||r.statut!=='OK'),rowsRef=S.rows;
  let i=0,bad=0,halt=false;const t0=Date.now();
  for(const r of todo){
    if(!S.running||S.rows!==rowsRef)break;i++;
    try{const g=await geocodeRow(r,m,cfg,nominatim);if(cfg.signal.aborted){i--;break;}apply(r,g,cfg);bad=0;}
    catch(e){if(e.name==='AbortError'||cfg.signal.aborted){i--;break;}RES.forEach(c=>r[c]='');r.statut='ERREUR';r.confiance='FAIBLE';r.controle_manuel='OUI';r.controle=e.message;
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
  $('#run').onclick=run;
  $('#stop').onclick=()=>{S.running=false;S.ctrl?.abort();};
}
