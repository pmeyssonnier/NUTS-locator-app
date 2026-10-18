import {val} from '../lib/geocode.js';
import {esc} from '../lib/util.js';
import {getMap, S} from './state.js';

export function rowTitle(r){const m=getMap();return S.headers.filter(h=>![m.adr,m.num,m.cp,m.ville,m.pays].includes(h)).slice(0,3).map(h=>r[h]).filter(Boolean).join(' · ');}
// texte brut d'une ligne pour l'annonce vocale
export function rowText(r){
  const m=getMap();
  return [rowTitle(r)||'Ligne '+(r.__i+1),[val(r,m.adr),val(r,m.num)].filter(Boolean).join(' '),[val(r,m.cp),val(r,m.ville),val(r,m.pays)].filter(Boolean).join(' '),
    r.NUTS3?`NUTS 3 ${r.NUTS3} ${r.NUTS3_nom}`.trim():'',r.statut?`statut ${r.statut}`:'',r.confiance?`confiance ${r.confiance}`:''].filter(Boolean).join(', ');
}
export function rowHtml(r){
  const m=getMap(),title=rowTitle(r);
  const L=(k)=>r[k]?`${esc(r[k])} — ${esc(r[k+'_nom'])}<br>`:'';
  return `<b>${esc(title||'Ligne '+(r.__i+1))}</b>${esc([val(r,m.adr),val(r,m.num)].filter(Boolean).join(' '))}<br>${esc([val(r,m.cp),val(r,m.ville),val(r,m.pays)].filter(Boolean).join(' '))}<br>`+
    `<span class="muted">${L('NUTS3')}${L('NUTS2')}${L('NUTS1')}${r.NUTS_version?'NUTS '+esc(r.NUTS_version)+'<br>':''}</span><span class="st-${esc(r.statut)}">${esc(r.statut)}</span> · ${esc(r.precision)} · confiance <span class="cf-${esc(r.confiance)}">${esc(r.confiance)}</span>${r.controle?'<br><span class="muted">'+esc(r.controle)+'</span>':''}<br><button class="pop-go" data-go="${r.__i}">Voir dans la liste</button>`;
}
