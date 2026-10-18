import {normCp} from './postal.js';

// --- Tables « code postal → NUTS 3 » (Eurostat / Tercet, « Postal codes and NUTS ») ---
// Fichier vérifié sur les tables publiées : colonnes « NUTS3;CODE », valeurs entre apostrophes, BOM UTF-8, fins de ligne CRLF.
// Un fichier par pays (pc2025_FR_NUTS-2024_v1.0) ou un fichier tous pays (PCODE_2025_NUTS-2024_v2.0) : les lignes sont
// donc réparties par pays d'après le préfixe du code NUTS 3. Le lecteur reste tolérant (séparateur, guillemets, en-tête,
// colonnes retrouvées par leur nom ou par leur contenu) et refuse avec un message détaillé ce qu'il ne comprend pas.
// Méthode Eurostat : un code postal = un seul NUTS 3, celui où tombe le centroïde du code postal (donc approximatif près des
// limites) ; les codes non géographiques (cases postales, grands destinataires) ne sont pas dans les tables.

const NUTS3=/^[A-Z]{2}[0-9A-Z]{3}$/;                       // un code NUTS 3 a 5 caractères (BE100, UKG33)
const clean=s=>String(s??'').replace(/^[\s'"`]+|[\s'"`]+$/g,'').trim();
const ISO_OF_NUTS0={UK:'GB',EL:'GR'};
const isoOfNuts0=c=>ISO_OF_NUTS0[c]||c;

// nom de fichier Tercet : pc2020_BE_NUTS-2021_v1.0.zip (pays BE) ou PCODE_2025_NUTS-2024_v2.0.zip (tous pays), millésime NUTS 2021 / 2024
export function parseTableName(name){
  const m=String(name||'').match(/(?:pc|pcode_)(\d{4})_(?:([A-Za-z]{2})_)?NUTS-(\d{4})/i);
  return m?{iso:m[2]?isoOfNuts0(m[2].toUpperCase()):'',nutsVersion:m[3],pcYear:m[1]}:{iso:'',nutsVersion:'',pcYear:''};
}

// Lit le texte d'un fichier et renvoie une table par pays :
// [{iso,nutsVersion,source,entries:{cp normalisé:'NUTS3' ou 'NUTS3,NUTS3'},count,multi,len,short?}] + {skipped}
export function parsePostcodeTables(text,fileName=''){
  const lines=String(text).replace(/^\uFEFF/,'').split(/\r?\n/).filter(l=>l.trim());
  if(!lines.length)throw new Error('fichier vide');
  const head=lines[0];
  const delim=[';','\t','|',','].map(d=>[d,head.split(d).length-1]).sort((a,b)=>b[1]-a[1])[0];
  const d=delim[1]>0?delim[0]:null;
  const split=l=>(d?l.split(d):[l]).map(clean);
  const rows=lines.slice(0,501).map(split);                  // échantillon pour reconnaître les colonnes ; le reste est lu ligne à ligne (fichier tous pays : 830 000 lignes)
  const hasNuts=r=>r.some(v=>NUTS3.test(v.toUpperCase()));
  // en-tête : aucune valeur de forme NUTS 3, ou un nom de colonne « NUTS… » (qui a lui-même 5 caractères : « NUTS3 »)
  const isHeader=!hasNuts(rows[0])||rows[0].some(v=>/^NUTS/i.test(v));
  const header=isHeader?rows.shift().map(h=>h.toUpperCase()):null;
  const first=isHeader?1:0;
  const width=Math.max(...rows.slice(0,200).map(r=>r.length),0);
  const nutsShare=i=>rows.slice(0,500).filter(r=>NUTS3.test((r[i]||'').toUpperCase())).length/Math.max(1,Math.min(500,rows.length));
  // colonne NUTS 3 : par son nom (NUTS3, NUTS_3…), sinon celle dont les valeurs ont la forme d'un code NUTS 3
  let ni=header?header.findIndex(h=>/NUTS/.test(h)&&/3/.test(h)):-1;
  if(ni<0)ni=[...Array(width).keys()].map(i=>[i,nutsShare(i)]).filter(x=>x[1]>=0.5).sort((a,b)=>b[1]-a[1])[0]?.[0]??-1;
  if(ni<0)throw new Error(`aucune colonne « NUTS 3 » reconnue (colonnes : ${(header||rows[0]||[]).join(' | ')} ; premières lignes : ${lines.slice(0,3).join(' // ')})`);
  // colonne code postal : par son nom, sinon la première autre colonne
  let ci=header?header.findIndex((h,i)=>i!==ni&&/(CODE|POST|^PC$|ZIP|PLZ)/.test(h)&&!/NUTS/.test(h)):-1;
  if(ci<0)ci=[...Array(width).keys()].find(i=>i!==ni&&!/NUTS/.test(header?.[i]||''))??-1;
  if(ci<0)throw new Error('colonne « code postal » introuvable');
  const byIso={};let skipped=0;
  for(let li=first;li<lines.length;li++){
    const r=split(lines[li]);
    const cp=normCp(r[ci]||'');
    const codes=String(r[ni]||'').toUpperCase().split(/[\s,;|/]+/).filter(c=>NUTS3.test(c));    // une cellule peut en contenir plusieurs
    if(!cp||!codes.length){skipped++;continue;}
    const e=byIso[isoOfNuts0(codes[0].slice(0,2))]??={};                                         // un pays par préfixe NUTS 0
    const cur=e[cp];
    if(cur===undefined&&codes.length===1)e[cp]=codes[0];
    else{const l=cur?cur.split(','):[];for(const c of codes)if(!l.includes(c))l.push(c);e[cp]=l.join(',');}
  }
  const named=parseTableName(fileName);
  const tables=Object.entries(byIso).map(([iso,entries])=>{
    const keys=Object.keys(entries),lens={};let multi=0;
    for(const k of keys){lens[k.length]=(lens[k.length]||0)+1;if(entries[k].includes(','))multi++;}
    const len=+Object.entries(lens).sort((a,b)=>b[1]-a[1])[0][0];
    const t={iso,nutsVersion:named.nutsVersion,source:fileName,entries,count:keys.length,multi,skipped,len};
    // NL (6 caractères) et PT (7 chiffres) : index des 4 premiers chiffres, pour les adresses qui n'ont que cette partie
    if((iso==='NL'||iso==='PT')&&len>4){
      const sh={};
      for(const k of keys){const p=k.slice(0,4),c=sh[p]?.split(',')||[];for(const n of entries[k].split(','))if(!c.includes(n))c.push(n);sh[p]=c.join(',');}
      t.short=sh;
    }
    return t;
  }).sort((a,b)=>a.iso<b.iso?-1:1);
  if(!tables.length)throw new Error('aucune ligne « code postal → NUTS 3 » exploitable');
  return tables;
}

// Fichier d'un seul pays (rétro-compatibilité des appels) : refuse un fichier qui en contient plusieurs
export function parsePostcodeTable(text,fileName=''){
  const t=parsePostcodeTables(text,fileName);
  if(t.length>1)throw new Error(`plusieurs pays dans ce fichier (${t.map(x=>x.iso).join(', ')}) : utiliser parsePostcodeTables`);
  return t[0];
}

// Candidats NUTS 3 d'un code postal (null si absent). Au-delà de la table : Eircode irlandais / code maltais tronqués à 3 caractères ;
// NL et PT : code complet absent ou 4 chiffres seuls → NUTS 3 des codes commençant par ces 4 chiffres
export function lookupPostcode(table,cp,iso){
  if(!table||!cp)return null;
  const k=normCp(cp);if(!k)return null;
  const split=v=>v?v.split(','):null;
  const hit=split(table.entries[k]);if(hit)return hit;
  if(table.len===3&&k.length>3)return split(table.entries[k.slice(0,3)]);
  if(table.short&&/^\d{4}/.test(k))return split(table.short[k.slice(0,4)]);
  return null;
}

// Compare le NUTS 3 du point à ceux du code postal :
//  OUI : même NUTS 3 ; MEME_NUTS2 : NUTS 3 voisin dans la même région ; NON : désaccord ;
//  VERSION_DIFFERENTE : désaccord mais millésimes NUTS différents (ou inconnu), donc non concluant ; CP_ABSENT : code postal absent de la table
export function compareCpNuts(candidates,nuts3,tableVersion,pointVersion){
  if(!candidates||!candidates.length)return 'CP_ABSENT';
  if(candidates.includes(nuts3))return 'OUI';
  if(!tableVersion||!pointVersion||String(tableVersion)!==String(pointVersion))return 'VERSION_DIFFERENTE';
  return candidates.some(c=>c.slice(0,4)===nuts3.slice(0,4))?'MEME_NUTS2':'NON';
}
