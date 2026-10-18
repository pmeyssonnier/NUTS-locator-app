import {$, announce} from './dom.js';
import {render} from './render.js';
import {activateRow} from './select.js';
import {S} from './state.js';
import {buildCols, initTable} from './table.js';

function sortBy(c){
  S.cardsMax=60;
  if(S.sortCol===c){if(S.sortDir>0)S.sortDir=-1;else S.sortCol=null;}else{S.sortCol=c;S.sortDir=1;}
  render();announce(S.sortCol?`Trié par ${c}, ${S.sortDir>0?'croissant':'décroissant'}`:'Tri supprimé');
}
export function initResults(){
  initTable({activate:activateRow,sort:sortBy});
  $('#filter').oninput=e=>{S.filter=e.target.value;S.cardsMax=60;render();};
  $('#colsBox').onchange=e=>{const c=e.target.value;e.target.checked?S.hidden.delete(c):S.hidden.add(c);render();};
  $('#showAll').onclick=()=>{S.hidden.clear();buildCols();render();};
  $('#hideIn').onclick=()=>{S.headers.forEach(h=>S.hidden.add(h));buildCols();render();};
  $('#more').onclick=()=>{S.cardsMax+=60;render();};
  $('#sortSel').onchange=e=>{S.sortCol=e.target.value||null;S.sortDir=1;S.cardsMax=60;render();announce(S.sortCol?`Trié par ${S.sortCol}, croissant`:'Tri supprimé');};
  $('#sortDir').onclick=()=>{if(!S.sortCol){announce('Choisissez d\'abord une colonne de tri');return;}S.sortDir=-S.sortDir;S.cardsMax=60;render();announce(`Tri ${S.sortDir>0?'croissant':'décroissant'}`);};
}
