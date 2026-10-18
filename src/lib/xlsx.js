import {attrs, colIdx, colName, tTexts, xmlEsc, xmlUnesc} from './xml.js';
import {zipBuild, zipOpen, zipText} from './zip.js';

// Ouvre un classeur (chaînes partagées, styles, liste des feuilles) ; book.read(i) lit la feuille i sous forme de grille de chaînes
export async function readXlsxBook(buf){
  const z=zipOpen(buf);
  const ss=await zipText(z,'xl/sharedStrings.xml')||'';
  const sst=[...ss.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m=>tTexts(m[1].replace(/<rPh\b[\s\S]*?<\/rPh>/g,'')));
  const st=await zipText(z,'xl/styles.xml')||'',custom={};
  for(const m of st.matchAll(/<numFmt\b([^>]*)\/?>/g)){const a=attrs(m[1]);custom[a.numFmtId]=xmlUnesc(a.formatCode||'');}
  const xfs=(st.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)||['',''])[1];
  const isDate=[...xfs.matchAll(/<xf\b([^>]*?)\/?>/g)].map(m=>{const id=+attrs(m[1]).numFmtId||0;
    if((id>=14&&id<=22)||(id>=45&&id<=47))return true;const f=custom[id];return !!f&&/[dmyh]/i.test(f.replace(/"[^"]*"|\[[^\]]*\]|\\./g,''));});
  let d1904=0;
  const serial=v=>{const d=new Date(Math.round((+v+d1904-25569)*86400000));return isNaN(d)?v:d.toISOString().slice(0,+v%1?16:10).replace('T',' ');};
  const wb=await zipText(z,'xl/workbook.xml'),rels=await zipText(z,'xl/_rels/workbook.xml.rels');
  if(/date1904="(1|true)"/.test(wb||''))d1904=1462;
  const sheets=[];
  if(wb&&rels){
    const target={};
    for(const r of rels.matchAll(/<Relationship\b([^>]*)>/g)){const a=attrs(r[1]);target[a.Id]=a.Target.startsWith('/')?a.Target.slice(1):'xl/'+a.Target.replace(/^\.\//,'');}
    for(const m of wb.matchAll(/<sheet\b([^>]*)\/?>/g)){
      const a=attrs(m[1]),id=a['r:id']||Object.entries(a).find(([k])=>/:id$/.test(k))?.[1];
      sheets.push({name:xmlUnesc(a.name||''),hidden:!!a.state&&a.state!=='visible',path:target[id]||'xl/worksheets/sheet'+(sheets.length+1)+'.xml'});}
  }
  if(!sheets.length)sheets.push({name:'Feuille 1',hidden:false,path:'xl/worksheets/sheet1.xml'});
  sheets.forEach((sh,i)=>sh.i=i);
  async function read(i){
    const sh=sheets[i];if(!sh)throw new Error('feuille '+i+' introuvable');
    const xml=await zipText(z,sh.path);if(!xml)throw new Error('feuille « '+sh.name+' » introuvable');
    const grid=[];
    for(const m of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
      const a=attrs(m[1]),inner=m[2]||'';if(!a.r)continue;
      const [,col,rn]=a.r.match(/([A-Z]+)(\d+)/);let v='';
      if(a.t==='inlineStr')v=tTexts(inner);
      else{const vm=inner.match(/<v>([\s\S]*?)<\/v>/);if(vm){v=xmlUnesc(vm[1]);if(a.t==='s')v=sst[+v]??'';else if((!a.t||a.t==='n')&&a.s&&isDate[+a.s]&&v!=='')v=serial(v);}}
      (grid[+rn-1]??=[])[colIdx(col)]=v;
    }
    return Array.from(grid,r=>Array.from(r||[],x=>x??''));
  }
  return {sheets:sheets.map(({i,name,hidden})=>({i,name,hidden})),read};
}
// feuille par défaut : la première feuille visible (sinon la première)
export const firstVisible=sheets=>(sheets.find(sh=>!sh.hidden)||sheets[0]).i;
export async function readXlsx(buf,sheet){const b=await readXlsxBook(buf);return b.read(sheet===undefined?firstVisible(b.sheets):sheet);}
// Fusionne plusieurs feuilles : colonnes alignées par nom d'en-tête (union, dans l'ordre d'apparition), colonne « Feuille » ajoutée à la fin.
// Les feuilles vides ou réduites à un en-tête sont ignorées.
export function mergeSheets(sheets){
  const heads=[],idx=new Map(),parts=[];
  const uniq=row=>{const seen={};return row.map((h,i)=>{h=String(h??'').trim()||'Col_'+(i+1);seen[h]=(seen[h]||0)+1;return seen[h]>1?h+'_'+seen[h]:h;});};
  for(const {name,grid} of sheets){
    const rows=grid.filter(r=>r&&r.some(c=>String(c??'').trim()!==''));
    if(rows.length<2)continue;
    const hs=uniq(rows[0]);
    for(const h of hs)if(!idx.has(h)){idx.set(h,heads.length);heads.push(h);}
    parts.push({name,hs,rows:rows.slice(1)});
  }
  let sheetCol='Feuille';while(idx.has(sheetCol))sheetCol+='_';
  const out=[[...heads,sheetCol]];
  for(const p of parts)for(const r of p.rows){
    const o=new Array(heads.length+1).fill('');
    p.hs.forEach((h,i)=>{o[idx.get(h)]=r[i]??'';});o[heads.length]=p.name;out.push(o);}
  return out;
}
export function buildXlsx(headers,rows,sheet='NUTS'){
  const cell=(v,r,c,b)=>{if(v===null||v===undefined||v==='')return '';const ref=colName(c)+(r+1),s=b?' s="1"':'';
    return typeof v==='number'&&isFinite(v)?`<c r="${ref}"${s}><v>${v}</v></c>`:`<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;};
  let sd='<row r="1">'+headers.map((h,c)=>cell(h,0,c,1)).join('')+'</row>';
  rows.forEach((row,i)=>{sd+=`<row r="${i+2}">`+row.map((v,c)=>cell(v,i+1,c)).join('')+'</row>';});
  const w=headers.map((h,c)=>Math.min(60,Math.max(8,String(h).length+3,...rows.slice(0,500).map(r=>String(r[c]??'').length+2))));
  const NS='http://schemas.openxmlformats.org',H='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const last=colName(Math.max(0,headers.length-1))+(rows.length+1);
  return zipBuild([
    {name:'[Content_Types].xml',data:H+`<Types xmlns="${NS}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`},
    {name:'_rels/.rels',data:H+`<Relationships xmlns="${NS}/package/2006/relationships"><Relationship Id="rId1" Type="${NS}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`},
    {name:'xl/workbook.xml',data:H+`<workbook xmlns="${NS}/spreadsheetml/2006/main" xmlns:r="${NS}/officeDocument/2006/relationships"><sheets><sheet name="${xmlEsc(sheet)}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${xmlEsc(sheet)}'!$A$1:$${last.replace(/(\d+)$/,'$$$1')}</definedName></definedNames></workbook>`},
    {name:'xl/_rels/workbook.xml.rels',data:H+`<Relationships xmlns="${NS}/package/2006/relationships"><Relationship Id="rId1" Type="${NS}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${NS}/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
    {name:'xl/styles.xml',data:H+`<styleSheet xmlns="${NS}/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>`},
    {name:'xl/worksheets/sheet1.xml',data:H+`<worksheet xmlns="${NS}/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${w.map((x,i)=>`<col min="${i+1}" max="${i+1}" width="${x}" customWidth="1"/>`).join('')}</cols><sheetData>${sd}</sheetData><autoFilter ref="A1:${last}"/></worksheet>`}
  ]);
}
