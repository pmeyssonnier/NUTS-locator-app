// --- CSV ---
export function decodeText(buf){let t=new TextDecoder('utf-8').decode(buf);if(t.includes('\uFFFD'))t=new TextDecoder('windows-1252').decode(buf);return t.replace(/^\uFEFF/,'');}
export function parseCSV(t){
  const first=t.split(/\r?\n/)[0]||'';
  const d=[';','\t','|'].reduce((a,c)=>first.split(c).length>first.split(a).length?c:a,',');
  const out=[];let row=[],f='',q=false;
  for(let i=0;i<t.length;i++){const c=t[i];
    if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}
    else if(c==='"')q=true;
    else if(c===d){row.push(f);f='';}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&t[i+1]==='\n')i++;row.push(f);out.push(row);row=[];f='';}
    else f+=c;}
  if(f!==''||row.length){row.push(f);out.push(row);}
  return out;
}
// cellule CSV : décimale française pour les nombres, formules neutralisées
export const csvCell=v=>{
  if(typeof v==='number')return String(v).replace('.',',');            // décimale française (Excel FR)
  v=String(v??'');
  if(/^[=+\-@\t\r]/.test(v)&&!/^-?\d+([.,]\d+)?$/.test(v))v="'"+v;      // neutralise les formules
  return /[;"\r\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};
