import {stepIndex} from '../lib/keys.js';
import {isNum} from '../lib/util.js';
import {$, announce, smooth} from './dom.js';
import {clearMapSelection, focusMap, focusRow, scrollToMap} from './map.js';
import {render} from './render.js';
import {rowText} from './rows.js';
import {S, view} from './state.js';

export function selectRow(r,fly){
  S.selRow=r;focusRow(r,fly);
  render();announce(rowText(r)+(isNum(r.lat)?'':', non géocodée'));
}
// point suivant / précédent parmi les lignes affichées qui ont des coordonnées
export function stepPoint(dir){
  const pts=view().rows.filter(r=>isNum(r.lat)),i=stepIndex(pts.indexOf(S.selRow),pts.length,dir);
  if(i<0){announce('Aucun point géocodé');return;}
  selectRow(pts[i],true);
}
export function clearSelection(){S.selRow=null;clearMapSelection();render();}
// retrouver une ligne dans la liste (cartes ou tableau)
export function goToRow(i){
  const el=S.cards?$(`#cards .rc[data-i="${i}"]`):$(`#tbody tr[data-i="${i}"]`);
  if(!el)return;el.scrollIntoView({behavior:smooth(),block:'center'});el.focus({preventScroll:true});
}
// activation d'une ligne depuis le tableau ou une carte : affiche sur la carte ; au clavier le focus passe à la carte
export function activateRow(r,how){
  selectRow(r,true);
  if(how==='key'){if(isNum(r.lat))focusMap();}
  else scrollToMap(how==='card'?'center':'nearest');
}
