import {$} from './dom.js';
import {addManualRow, isManualList} from './files.js';
import {run} from './run.js';
import {goToRow, selectRow} from './select.js';
import {S} from './state.js';
import {isNum} from '../lib/util.js';

// Saisie manuelle d'une adresse : la ligne rejoint la liste « Saisie manuelle » et suit le même chemin qu'un fichier
// (géocodage ou mode sans géocodage, NUTS, contrôle par le code postal, carte, export).
const IDS=['adr','num','cp','ville','pays'];
const val=k=>$('#man_'+k).value.trim();

function add(){
  if(S.running){$('#manMsg').textContent='Un traitement est en cours : attendez la fin ou arrêtez-le.';return null;}
  const cells=IDS.map(val);
  if(!cells[0]&&!cells[2]&&!cells[3]){$('#manMsg').textContent='Indiquez au moins une adresse, un code postal ou une ville.';$('#man_adr').focus();return null;}
  if(!isManualList()&&S.rows.length&&!window.confirm(`Remplacer les ${S.rows.length} ligne(s) chargées (${S.label}) par une saisie manuelle ?`))return null;
  const r=addManualRow(cells);
  if(!r){$('#manMsg').textContent='Ajout impossible.';return null;}
  for(const k of ['adr','num','cp','ville'])$('#man_'+k).value='';       // le pays est conservé d'une saisie à l'autre
  $('#manMsg').textContent=`Adresse ajoutée : ${S.rows.length} ligne(s) dans la liste.`;
  $('#man_adr').focus();
  return r;
}
export function initManual(){
  $('#manForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const r=add();if(!r)return;
    await run([r]);
    if(S.rows.includes(r)){selectRow(r,true);if(!isNum(r.lat))goToRow(r.__i);}
    $('#manMsg').textContent=`${r.statut||'non traitée'}${r.NUTS3?` · NUTS 3 ${r.NUTS3} ${r.NUTS3_nom||''}`:''}${r.controle?` — ${r.controle}`:''}`;
  });
  $('#manAdd').onclick=()=>{add();};
}
