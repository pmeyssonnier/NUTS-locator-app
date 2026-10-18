import {normCp} from './postal.js';

// --- Tables « code postal → NUTS 3 » (Eurostat / Tercet) : PROTOTYPE ---
// Le format réel n'a pas pu être vérifié sur un fichier Eurostat : le lecteur est donc tolérant (séparateur, guillemets, en-tête,
// colonnes retrouvées par leur nom ou par leur contenu) et refuse avec un message détaillé ce qu'il ne comprend pas.

const NUTS3=/^[A-Z]{2}[0-9A-Z]{3}$/;                       // un code NUTS 3 a 5 caractères (BE100, UKG33)
const clean=s=>String(s??'').replace(/^[\s'"`]+|[\s'"`]+$/g,'').trim();
const ISO_OF_NUTS0={UK:'GB',EL:'GR'};
const isoOfNuts0=c=>ISO_OF_NUTS0[c]||c;

// nom de fichier Tercet : pc2020_BE_NUTS-2021_v1.0.zip → pays BE, millésime NUTS 2021
export function parseTableName(name){
  const m=String(name||'').match(/pc(\d{4})_([A-Za-z]{2})_NUTS-(\d{4})/i);
  return m?{iso:isoOfNuts0(m[2].toUpperCase()),nutsVersion:m[3],pcYear:m[1]}:{iso:'',nutsVersion:'',pcYear:''};
}

// Lit le texte d'une table. Renvoie {iso,nutsVersion,source,entries:{cp normalisé:[NUTS3…]},count,multi,skipped}.
export function parsePostcodeTable(text,fileName=''){
  const lines=String(text).replace(/^﻿/,'').split(/\r?\n/).filter(l=>l.trim());
  if(!lines.length)throw new Error('fichier vide');
  const head=lines[0];
  const delim=[';','\t','|',','].map(d=>[d,head.split(d).length-1]).sort((a,b)=>b[1]-a[1])[0];
  const d=delim[1]>0?delim[0]:null;
  const split=l=>(d?l.split(d):[l]).map(clean);
  const rows=lines.map(split);
  const hasNuts=r=>r.some(v=>NUTS3.test(v.toUpperCase()));
  // en-tête : aucune valeur de forme NUTS 3, ou un nom de colonne « NUTS… » (qui a lui-même 5 caractères : « NUTS3 »)
  const isHeader=!hasNuts(rows[0])||rows[0].some(v=>/^NUTS/i.test(v));
  const header=isHeader?rows.shift().map(h=>h.toUpperCase()):null;
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
  const entries={};let multi=0,skipped=0;
  for(const r of rows){
    const cp=normCp(r[ci]||'');
    const codes=String(r[ni]||'').toUpperCase().split(/[\s,;|/]+/).filter(c=>NUTS3.test(c));    // une cellule peut en contenir plusieurs
    if(!cp||!codes.length){skipped++;continue;}
    const cur=entries[cp]??=[];
    for(const c of codes)if(!cur.includes(c))cur.push(c);
  }
  const count=Object.keys(entries).length;
  if(!count)throw new Error('aucune ligne « code postal → NUTS 3 » exploitable');
  for(const v of Object.values(entries))if(v.length>1)multi++;
  // pays et millésime : d'après le nom du fichier, sinon d'après les codes NUTS (préfixe le plus fréquent)
  const named=parseTableName(fileName);
  let iso=named.iso;
  if(!iso){const c={};for(const v of Object.values(entries))for(const n of v)c[n.slice(0,2)]=(c[n.slice(0,2)]||0)+1;
    iso=isoOfNuts0(Object.entries(c).sort((a,b)=>b[1]-a[1])[0][0]);}
  return {iso,nutsVersion:named.nutsVersion,source:fileName,entries,count,multi,skipped};
}

// Candidats NUTS 3 d'un code postal (null si absent) ; NL et PT : repli sur les 4 premiers chiffres
export function lookupPostcode(table,cp,iso){
  if(!table||!cp)return null;
  const k=normCp(cp);
  return table.entries[k]||((iso==='NL'||iso==='PT')&&k.length>4?table.entries[k.slice(0,4)]:null)||null;
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
