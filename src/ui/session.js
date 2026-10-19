import {btns} from './controls.js';
import {$, setStatus} from './dom.js';
import {buildMap, setBook} from './files.js';
import {updateSummaries} from './folds.js';
import {ensureLevel, fit} from './map.js';
import {render} from './render.js';
import {getMap, S, summary} from './state.js';
import {dbClear, dbGet, dbPut} from './storage.js';
import {buildCols} from './table.js';

const SESS='last';
export async function saveSession(){
  if(!S.rows.length)return;
  try{await dbPut('session',SESS,{v:1,t:Date.now(),label:S.label||'',headers:S.headers,rows:S.rows,map:getMap(),
    opts:{defPays:$('#defPays').value,res:$('#res').value,withUK:$('#withUK').checked,maxKm:$('#maxKm').value,onlyMissing:$('#onlyMissing').checked}});}
  catch(e){}
}
async function restoreSession(s){
  setBook(null);
  S.headers=s.headers;S.rows=s.rows;S.label=s.label;S.sortCol=null;S.cardsMax=60;S.hidden.clear();S.selRow=null;S.rows.forEach((o,i)=>o.__i=i);
  buildMap();for(const [k,v] of Object.entries(s.map||{}))if(v&&S.headers.includes(v))$('#m_'+k).value=v;
  const o=s.opts||{};
  if(o.defPays!=null)$('#defPays').value=o.defPays;
  if(['01M','03M','10M'].includes(o.res))$('#res').value=o.res;
  $('#withUK').checked=!!o.withUK;if(o.maxKm!=null)$('#maxKm').value=o.maxKm;$('#onlyMissing').checked=!!o.onlyMissing;
  buildCols();updateSummaries();
  $('#loaded').textContent=`${s.label||'Session restaurée'} : ${S.rows.length} lignes, ${S.headers.length} colonnes.`;
  render();btns();setStatus('Session restaurée.\n'+summary());
  document.dispatchEvent(new Event('nuts:restored'));      // les tables importées sont alors appliquées aux lignes restaurées (voir ui/postcodes.js)
  await ensureLevel();fit();
}
export function initSession(){
  $('#restore').onclick=async()=>{const s=S.pending;if(!s||S.running)return;S.pending=null;$('#restoreBox').hidden=true;await restoreSession(s);};
  $('#forget').onclick=async()=>{await dbClear('session');S.pending=null;$('#restoreBox').hidden=true;setStatus('Session oubliée.');};
  dbGet('session',SESS).then(s=>{
    if(!s||!Array.isArray(s.rows)||!s.rows.length||S.rows.length)return;
    S.pending=s;const done=s.rows.filter(r=>r.statut).length;
    $('#restoreTxt').textContent=`Session précédente : ${s.label||'fichier'} — ${s.rows.length} lignes, ${done} traitées (${new Date(s.t).toLocaleString('fr-BE')}).`;
    $('#restoreBox').hidden=false;
  });
}
