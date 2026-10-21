import {checkVat, parseVat} from './vies.js';
import {S} from './state.js';
import {buildCols} from './table.js';
import {render} from './render.js';
import {$} from './dom.js';
import {norm} from '../lib/util.js';

export const VAT_COLUMNS=['TVA_VIES','VIES_statut','VIES_nom','VIES_adresse','VIES_date','VIES_identifiant','VIES_coherence_nom','VIES_coherence_adresse','VIES_detail'];
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const normalized=s=>norm(String(s??'')).replace(/[^a-z0-9]/g,'');
export function detectVatColumn(headers) {
  return headers.find(h=>/^(tva|vat|vat.?number|numero.?tva|n.?tva|btw.?nummer|ust.?id|partita.?iva|nif.?iva|nif.?intracommunautaire)$/i.test(normalized(h))) ||
    headers.find(h=>/tva|vat|btw|ustid|partitaiva/i.test(normalized(h))) || '';
}
export function compareName(a,b){
  if(!a||!b)return 'NON_DISPONIBLE';
  const x=normalized(a),y=normalized(b);
  if(!x||!y)return 'NON_DISPONIBLE';
  return x===y?'IDENTIQUE':x.includes(y)||y.includes(x)?'PARTIEL':'DIFFERENT';
}
export function compareAddress(row,official) {
  if(!official)return 'NON_DISPONIBLE';
  const pieces=[/^(adresse|address|rue|street|straat)/i,/^(code.?postal|postcode|postal|zip|plz|cp)$/i,/^(ville|city|localite|commune|gemeente|stadt)/i]
    .map(re=>S.headers.find(h=>re.test(h))||'').filter(Boolean).map(h=>row[h]).filter(Boolean);
  if(!pieces.length)return 'NON_DISPONIBLE';
  const text=normalized(official);
  const hits=pieces.filter(p=>text.includes(normalized(p))).length;
  return hits===pieces.length?'COHERENTE':hits?'PARTIELLE':'A_VERIFIER';
}
export function initViesExcel(){
  const select=$('#vatColumn'),button=$('#vatRunExcel'),stop=$('#vatStopExcel'),status=$('#vatExcelStatus');
  let cancelled=false,busy=false;
  function refresh(){
    const previous=select.value;
    select.replaceChildren(new Option('— Choisir une colonne —',''));
    S.headers.forEach(h=>select.add(new Option(h,h)));
    select.value=S.headers.includes(previous)?previous:detectVatColumn(S.headers);
    button.disabled=!S.rows.length||!select.value||busy;
  }
  $('#vatDetectExcel').addEventListener('click',refresh);
  select.addEventListener('change',()=>{button.disabled=!S.rows.length||!select.value||busy;});
  stop.addEventListener('click',()=>{cancelled=true;stop.disabled=true;});
  button.addEventListener('click',async()=>{
    if(busy||!S.rows.length||!select.value)return;
    busy=true;cancelled=false;button.disabled=true;stop.disabled=false;
    const col=select.value;
    const nameCol=S.headers.find(h=>/^(societe|société|company|entreprise|raison.?sociale|denomination|dénomination)$/i.test(h))||'';
    const targets=S.rows.filter(r=>String(r[col]??'').trim());
    if(!targets.length){status.textContent='Aucun numéro TVA dans cette colonne.';busy=false;stop.disabled=true;refresh();return;}
    const cache=new Map();let done=0;
    for(const row of targets){
      if(cancelled)break;
      const vat=String(row[col]).trim(),key=parseVat(vat)?.input||vat;
      if(!cache.has(key)){
        cache.set(key,await checkVat(vat));
        if(done && !cancelled)await delay(400);
      }
      const result=cache.get(key);
      Object.assign(row,{
        TVA_VIES:vat,VIES_statut:result.status,VIES_nom:result.name||'',
        VIES_adresse:result.address||'',VIES_date:result.checkedAt||'',
        VIES_identifiant:result.requestIdentifier||'',
        VIES_coherence_nom:result.status==='VALIDE'?compareName(nameCol?row[nameCol]:'',result.name):'NON_EVALUE',
        VIES_coherence_adresse:result.status==='VALIDE'?compareAddress(row,result.address):'NON_EVALUE',
        VIES_detail:result.detail||''
      });
      done++;status.textContent=done+' / '+targets.length+' lignes contrôlées';
      if(done%10===0){buildCols();render();}
    }
    busy=false;stop.disabled=true;refresh();buildCols();render();
    status.textContent=done+' / '+targets.length+' lignes traitées'+(cancelled?' (interrompu)':'')+'. Résultats inclus dans les exports Excel/CSV.';
  });
  return {refresh};
}
