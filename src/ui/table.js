import {val} from '../lib/geocode.js';
import {moveIndex} from '../lib/keys.js';
import {markerStyle, markerSvg} from '../lib/markers.js';
import {cardsLimit, esc, isNum} from '../lib/util.js';
import {$} from './dom.js';
import {rowTitle} from './rows.js';
import {allCols, getMap, S, view} from './state.js';

let H={};   // actions fournies par l'orchestration : activate(r,how), sort(col)
// Petit écran : une carte par ligne (résumé + « Toutes les données ») à la place du tableau à 30 colonnes
function cardHtml(r){
  const m=getMap(),adr=[val(r,m.adr),val(r,m.num)].filter(Boolean).join(' '),loc=[val(r,m.cp),val(r,m.ville),val(r,m.pays)].filter(Boolean).join(' ');
  const st=r.statut?`<span class="rc-st st-${esc(r.statut)}">${r.statut==='CP_SEUL'?'':markerSvg(markerStyle(r.statut),12,4)}${esc(r.statut)}</span>`:'<span class="rc-st muted">non traité</span>';
  const nuts=r.NUTS3?`${esc(r.NUTS3)} — ${esc(r.NUTS3_nom)}${r.confiance?` · confiance <span class="cf-${esc(r.confiance)}">${esc(r.confiance)}</span>`:''}`:'';
  const cols=allCols().filter(c=>!S.hidden.has(c)&&r[c]!==''&&r[c]!=null);
  const sel=r===S.selRow;
  return `<li><article class="rc${sel?' sel':''}" data-i="${r.__i}" tabindex="-1"${sel?' aria-current="true"':''}>`
    +`<div class="rc-head"><span class="rc-title">${esc(rowTitle(r)||'Ligne '+(r.__i+1))}</span>${st}</div>`
    +(adr?`<div class="rc-line">${esc(adr)}</div>`:'')+(loc?`<div class="rc-line">${esc(loc)}</div>`:'')
    +(nuts?`<div class="rc-nuts">${nuts}</div>`:'')+(r.controle?`<div class="rc-note muted">${esc(r.controle)}</div>`:'')
    +(isNum(r.lat)?`<div class="rc-actions"><button data-act="map">Voir sur la carte</button></div>`:'')
    +`<details><summary>Toutes les données</summary><dl>${cols.map(c=>`<dt>${esc(c)}</dt><dd>${esc(r[c])}</dd>`).join('')}</dl></details></article></li>`;
}
function renderCards(rows){
  const idx=S.selRow?rows.indexOf(S.selRow):-1;if(idx>=0)S.cardsMax=cardsLimit(S.cardsMax,idx);
  const shown=rows.slice(0,S.cardsMax),ae=document.activeElement,keep=ae?.matches?.('#cards [data-act="map"]')?ae.closest('.rc').dataset.i:null;
  $('#thead').innerHTML='';$('#tbody').innerHTML='';
  $('#cards').innerHTML=shown.map(cardHtml).join('');$('#cards').hidden=false;$('.tablewrap').hidden=true;
  const rest=rows.length-shown.length,more=$('#more');more.hidden=rest<=0;more.textContent=`Afficher ${Math.min(60,rest)} lignes de plus (${rest} restantes)`;
  $('#count').textContent=`${rows.length} / ${S.rows.length} lignes`;
  $('#sortSel').value=S.sortCol||'';
  if(keep!==null)$('#cards').querySelector(`.rc[data-i="${keep}"] [data-act="map"]`)?.focus({preventScroll:true});
}
export function renderList(){
  const {cols,rows}=view();
  if(S.cards){renderCards(rows);return;}
  $('#cards').hidden=true;$('#more').hidden=true;$('.tablewrap').hidden=false;
  // le tableau est reconstruit : on mémorise l'élément qui a le focus pour le lui rendre ensuite
  const ae=document.activeElement,fTh=ae?.closest?.('#thead th'),fTr=ae?.closest?.('#tbody tr');
  const keepTh=fTh?fTh.dataset.col:null,keepTr=fTr?fTr.dataset.i:null;
  const tabRow=rows.includes(S.selRow)?S.selRow:rows[0];                 // une seule ligne dans l'ordre de tabulation
  $('#thead').innerHTML='<tr>'+cols.map(c=>`<th data-col="${esc(c)}" tabindex="0" aria-sort="${S.sortCol===c?(S.sortDir>0?'ascending':'descending'):'none'}">${esc(c)}${S.sortCol===c?`<span class="arr" aria-hidden="true">${S.sortDir>0?'▲':'▼'}</span>`:''}</th>`).join('')+'</tr>';
  $('#tbody').innerHTML=rows.map(r=>`<tr data-i="${r.__i}" tabindex="${r===tabRow?0:-1}"${r===S.selRow?' class="sel" aria-current="true"':''}>`+cols.map(c=>`<td${c==='statut'?` class="st-${esc(r[c])}"`:c==='confiance'?` class="cf-${esc(r[c])}"`:''}>${esc(r[c])}</td>`).join('')+'</tr>').join('');
  $('#count').textContent=`${rows.length} / ${S.rows.length} lignes`;
  S.tabTr=$('#tbody').querySelector('tr[tabindex="0"]');
  if(keepTh!==null)[...$('#thead').querySelectorAll('th')].find(t=>t.dataset.col===keepTh)?.focus();
  else if(keepTr!==null)$('#tbody').querySelector(`tr[data-i="${keepTr}"]`)?.focus({preventScroll:true});
}
export function buildCols(){
  $('#sortSel').innerHTML='<option value="">Ordre du fichier</option>'+allCols().map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
  $('#colsBox').innerHTML=allCols().map(c=>`<label><input type="checkbox" value="${esc(c)}" ${S.hidden.has(c)?'':'checked'}>${esc(c)}</label>`).join('');
}
// écouteurs du tableau et de la liste de cartes ; les actions (sélection, tri) viennent de l'orchestration
export function initTable(h){
  H=h;
  $('#thead').onclick=e=>{const th=e.target.closest('th');if(th)H.sort(th.dataset.col);};
  $('#thead').addEventListener('keydown',e=>{const th=e.target.closest('th');if(!th||(e.key!=='Enter'&&e.key!==' '))return;e.preventDefault();H.sort(th.dataset.col);});
  $('#tbody').onclick=e=>{const tr=e.target.closest('tr');if(!tr)return;H.activate(S.rows[+tr.dataset.i],'click');};
  // tableau : une seule ligne dans l'ordre de tabulation (tabindex itinérant), flèches / Début / Fin / Pages, Entrée = afficher sur la carte
  $('#tbody').addEventListener('focusin',e=>{const tr=e.target.closest('tr');if(!tr||tr===S.tabTr)return;if(S.tabTr)S.tabTr.tabIndex=-1;tr.tabIndex=0;S.tabTr=tr;});
  $('#tbody').addEventListener('keydown',e=>{
    const tr=e.target.closest('tr');if(!tr||e.target!==tr)return;
    if(e.key==='Enter'||e.key===' '){
      e.preventDefault();H.activate(S.rows[+tr.dataset.i],'key');                 // le clavier peut alors piloter la carte
      return;}
    const rows=$('#tbody').rows,ni=moveIndex(e.key,tr.sectionRowIndex,rows.length);
    if(ni===null)return;e.preventDefault();rows[ni].focus();
  });
  $('#cards').addEventListener('click',e=>{
    const b=e.target.closest('[data-act="map"]');if(!b)return;
    H.activate(S.rows[+b.closest('.rc').dataset.i],'card');
  });
}
