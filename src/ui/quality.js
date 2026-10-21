import {scoreGlobal, scoreRow, LABELS} from '../lib/quality.js';
import {esc} from '../lib/util.js';
import {$} from './dom.js';
import {getMap, S} from './state.js';

// Score global affiché au-dessus des résultats ; le score de chaque ligne est stocké dans la colonne « score_qualite »
export function updateQuality(){
  const box=$('#qualityBox');if(!box)return;
  const processed=S.rows.some(r=>r.statut||r.VIES_statut);
  if(!S.rows.length||!processed){box.hidden=true;return;}
  let cols=[];try{const m=getMap();cols=[m.adr,m.cp,m.ville,m.pays].filter(Boolean);}catch{}
  S.rows.forEach(r=>{const v=scoreRow(r,cols);r.score_qualite=v===null?'':v;});
  const g=scoreGlobal(S.rows,cols);
  const dims=Object.entries(g.dims).map(([k,d])=>`<li><span>${esc(LABELS[k])}</span><span>${d.score===null?'n/a':`<b>${d.score}</b>/100 <span class="muted">(${d.n} ligne${d.n>1?'s':''})</span>`}</span></li>`).join('');
  box.innerHTML=`<div class="qs q-${g.grade}">${g.score===null?'—':g.score}<small>/100 · note ${g.grade}</small></div><ul>${dims}</ul>`
    +`<span class="muted">Score global de qualité : moyenne pondérée des dimensions évaluables (complétude 15, géocodage 40, code postal 25, TVA 20). Colonne « score_qualite » ajoutée aux exports.</span>`;
  box.hidden=false;
}
