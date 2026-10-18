import {RES, summarize} from '../lib/geocode.js';
import {norm} from '../lib/util.js';
import {$} from './dom.js';

export const S={headers:[],rows:[],hidden:new Set(),sortCol:null,sortDir:1,filter:'',running:false,nuts:null,nutsRes:null,names:null,last:0,levels:{},selRow:null,strategy:{},cards:matchMedia('(max-width:720px)').matches,cardsMax:60};
export const FIELDS=[['adr','Adresse (rue)',/^(adresse|address|rue|street|straat|strasse|via|calle|indirizzo)/],
 ['num','Numéro (optionnel)',/^(n°|no|num|numero|nr|huisnummer|hausnummer)\.?$/],
 ['cp','Code postal',/(code.?postal|postcode|postal|zip|plz|^cp$|^npa$)/],
 ['ville','Ville',/^(ville|city|localite|commune|gemeente|ort|stadt|citta|ciudad|town)/],
 ['pays','Pays',/^(pays|country|land|cntr|iso|nation)/]];
export const allCols=()=>[...S.headers,...RES];
export const getMap=()=>Object.fromEntries(FIELDS.map(([k])=>[k,$('#m_'+k).value]));
export const ukOn=()=>$('#withUK').checked;
export const lkey=(l,res)=>`${l}_${res}_${ukOn()?1:0}`;
export function view(){
  const cols=allCols().filter(c=>!S.hidden.has(c));let rows=S.rows;const f=norm(S.filter);
  if(f)rows=rows.filter(r=>allCols().some(c=>norm(r[c]??'').includes(f)));
  if(S.sortCol){const c=S.sortCol,d=S.sortDir;rows=[...rows].sort((a,b)=>{const x=a[c],y=b[c],ex=x===''||x==null,ey=y===''||y==null;
    if(ex||ey)return ex===ey?0:ex?1:-1;const nx=Number(x),ny=Number(y);
    return d*(!isNaN(nx)&&!isNaN(ny)?nx-ny:String(x).localeCompare(String(y),'fr',{numeric:true,sensitivity:'base'}));});}
  return {cols,rows};
}
export const summary=()=>summarize(S.rows);
