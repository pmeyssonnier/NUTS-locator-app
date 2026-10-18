import {decodeText, parseCSV} from '../lib/csv.js';
import {RES, val} from '../lib/geocode.js';
import {SAMPLE} from '../lib/sample.js';
import {esc, norm} from '../lib/util.js';
import {buildXlsx, firstVisible, mergeSheets, readXlsxBook} from '../lib/xlsx.js';
import {btns} from './controls.js';
import {$, download, setStatus} from './dom.js';
import {render} from './render.js';
import {FIELDS, S} from './state.js';
import {buildCols} from './table.js';

export function buildMap(){
  $('#mapBox').innerHTML=FIELDS.map(([k,l])=>`<label>${l}<select id="m_${k}"><option value="">—</option>${S.headers.map(h=>`<option>${esc(h)}</option>`).join('')}</select></label>`).join('');
  for(const [k,,re] of FIELDS){const h=S.headers.find(h=>re.test(norm(h)));if(h)$('#m_'+k).value=h;}
}
function loadGrid(grid,label){
  if(S.running){setStatus('Géocodage en cours : arrêtez-le avant de charger un autre fichier.',true);return;}
  grid=grid.filter(r=>r&&r.some(c=>String(c).trim()!==''));
  if(grid.length<2){setStatus('Fichier vide ou sans données.',true);return;}
  const seen={};S.headers=grid[0].map((h,i)=>{h=String(h||'').trim()||'Col_'+(i+1);if(RES.includes(h))h+='_src';if(seen[h])h+='_'+(++seen[h]);else seen[h]=1;return h;});
  S.rows=grid.slice(1).map(r=>{const o={};S.headers.forEach((h,i)=>o[h]=String(r[i]??'').trim());RES.forEach(c=>o[c]='');return o;});
  S.sortCol=null;S.cardsMax=60;S.hidden.clear();S.rows.forEach((o,i)=>o.__i=i);S.selRow=null;S.label=label;$('#restoreBox').hidden=true;
  $('#loaded').textContent=`${label} : ${S.rows.length} lignes, ${S.headers.length} colonnes.`;
  buildMap();buildCols();
  const pc=$('#m_pays').value;if(pc&&S.rows.some(r=>/^(uk|gb|united kingdom|royaume-uni|great britain)$/i.test(val(r,pc))))$('#withUK').checked=true;
  render();btns();setStatus('Vérifiez le mappage des colonnes puis cliquez sur « Géocoder ».');
}
// Classeur XLSX ouvert : s'il a plusieurs feuilles, la liste « Feuille » permet d'en choisir une ou de toutes les fusionner
export function setBook(book,name){
  S.book=book;S.bookName=name;
  const sel=$('#sheet'),multi=!!book&&book.sheets.length>1;
  $('#lblSheet').hidden=!multi;sel.innerHTML='';
  if(!multi)return;
  const vis=book.sheets.filter(s=>!s.hidden);
  sel.innerHTML=book.sheets.map(s=>`<option value="${s.i}">${esc(s.name||'Feuille '+(s.i+1))}${s.hidden?' (masquée)':''}</option>`).join('')
    +(vis.length>1?'<option value="all">Toutes les feuilles (colonne « Feuille » ajoutée)</option>':'');
  sel.value=String(firstVisible(book.sheets));
}
async function loadSheet(){
  const book=S.book;if(!book)return;const v=$('#sheet').value,n=book.sheets.length;
  try{
    let grid,label,what;
    if(v==='all'){
      const vis=book.sheets.filter(s=>!s.hidden),parts=[];
      for(const s of vis)parts.push({name:s.name,grid:await book.read(s.i)});
      grid=mergeSheets(parts);label=`${S.bookName} — toutes les feuilles (${vis.length})`;what=`les ${vis.length} feuilles visibles sont fusionnées`;
    }else{
      const s=book.sheets[+v];grid=await book.read(s.i);
      label=n>1?`${S.bookName} — feuille « ${s.name} »`:S.bookName;what=`feuille « ${s.name} » chargée`;
    }
    loadGrid(grid,label);
    if(n>1&&S.label===label)setStatus(`Classeur de ${n} feuilles : ${what}. Changez de feuille avec la liste « Feuille ». Vérifiez le mappage des colonnes puis cliquez sur « Géocoder ».`);
  }catch(err){setStatus('Erreur de lecture : '+err.message,true);}
}
export function initFiles(){
  $('#sheet').onchange=loadSheet;
  $('#file').addEventListener('change',async e=>{
    const f=e.target.files[0];if(!f)return;
    try{const buf=await f.arrayBuffer();
      if(/\.xls$/i.test(f.name))throw new Error('format .xls (Excel 97-2003) non supporté : enregistrez en .xlsx ou .csv');
      if(/\.xlsx$/i.test(f.name)){setBook(await readXlsxBook(buf),f.name);await loadSheet();}
      else{setBook(null);loadGrid(parseCSV(decodeText(buf)),f.name);}}
    catch(err){setStatus('Erreur de lecture : '+err.message,true);}
    e.target.value='';
  });
  $('#sample').onclick=()=>{setBook(null);loadGrid(SAMPLE.map(r=>[...r]),'Exemple intégré');};
  $('#sampleDl').onclick=()=>download(buildXlsx(SAMPLE[0],SAMPLE.slice(1),'Societes'),'exemple_societes_europe.xlsx');
}
