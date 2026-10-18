import {csvCell} from '../lib/csv.js';
import {isNum} from '../lib/util.js';
import {buildXlsx} from '../lib/xlsx.js';
import {$, download, setStatus} from './dom.js';
import {allCols, S, view} from './state.js';

const stampNow=()=>new Date().toISOString().slice(0,16).replace(/[-:T]/g,'');
function exportRows(rows,cols,sheet,prefix){
  const cpCol=$('#m_cp').value,txt=new Set([cpCol,'cp_trouve','NUTS0','NUTS1','NUTS2','NUTS3']);
  const num=(c,v)=>!txt.has(c)&&S.headers.includes(c)&&typeof v==='string'&&/^-?(0|[1-9]\d{0,14})(\.\d+)?$/.test(v)?+v:v;
  const stamp=new Date().toISOString().slice(0,16).replace(/[-:T]/g,'');
  download(buildXlsx(cols,rows.map(r=>cols.map(c=>num(c,r[c]))),sheet),`${prefix}_${stamp}.xlsx`);
}
export function initExports(){
  $('#expCsv').onclick=()=>{
    const {cols,rows}=view(),out=$('#expVisible').checked?cols:allCols();
    const q=csvCell;
    const csv='\uFEFF'+[out.map(q).join(';'),...rows.map(r=>out.map(c=>q(r[c])).join(';'))].join('\r\n')+'\r\n';
    download(new Blob([csv],{type:'text/csv;charset=utf-8'}),`nuts_resultat_${stampNow()}.csv`);
  };
  $('#expGeo').onclick=()=>{
    const {cols,rows}=view(),out=($('#expVisible').checked?cols:allCols()).filter(c=>c!=='lat'&&c!=='lon');
    const feats=rows.filter(r=>isNum(r.lat)&&isNum(r.lon)).map(r=>({type:'Feature',geometry:{type:'Point',coordinates:[r.lon,r.lat]},
      properties:Object.fromEntries(out.map(c=>[c,r[c]===''?null:r[c]]))}));
    if(!feats.length){setStatus('Aucune ligne géocodée à exporter.',true);return;}
    download(new Blob([JSON.stringify({type:'FeatureCollection',name:'nuts_resultat',features:feats})],{type:'application/geo+json'}),`nuts_resultat_${stampNow()}.geojson`);
    setStatus(`${feats.length} point(s) exporté(s) en GeoJSON (WGS84, EPSG:4326)${feats.length<rows.length?` ; ${rows.length-feats.length} ligne(s) sans coordonnées ignorée(s)`:''}.`);
  };
  $('#expAno').onclick=()=>{
    const {cols}=view(),out=$('#expVisible').checked?cols:allCols();
    const ano=S.rows.filter(r=>r.statut&&r.controle_manuel==='OUI');
    if(!ano.length){setStatus('Aucune ligne à contrôler.');return;}
    exportRows(ano,out,'A_controler','nuts_a_controler');setStatus(`${ano.length} ligne(s) à contrôler exportée(s) (filtre ignoré).`);
  };
  $('#exp').onclick=()=>{
    const {cols,rows}=view();exportRows(rows,$('#expVisible').checked?cols:allCols(),'NUTS','nuts_resultat');
  };
}
