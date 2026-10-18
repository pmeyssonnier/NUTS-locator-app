import {findNuts} from './geo.js';
import {cc, ccList, ccOf, cpMatch, decide, fixCp, isoOf, niveauOf, normCp, nuts0Of, streetOf, stripAbbr, stripLocality} from './postal.js';

// --- Géocodage d'une ligne et rattachement NUTS : fonctions pures, le géocodeur (geocode) et les contours (nuts, names) sont injectés ---
export const RES=['precision','niveau_resultat','lat','lon','adresse_geocodee','cp_trouve','pays_trouve','NUTS0','NUTS0_nom','NUTS1','NUTS1_nom','NUTS2','NUTS2_nom','NUTS3','NUTS3_nom','NUTS_version','distance_nuts_km','confiance','controle_manuel','controle','statut'];
export const val=(r,c)=>c?String(r[c]??'').trim():'';
export const NIV_TXT={RUE:'rue trouvée, pas le numéro',LOCALITE:'résultat au niveau quartier/localité',VILLE_OU_PLUS:'résultat au niveau ville ou plus large',CODE_POSTAL:'résultat au niveau code postal',INCONNU:'niveau du résultat non communiqué'};
// Variantes de la rue, de la plus fidèle à la plus simplifiée ; chacune est essayée en recherche structurée puis libre
const VARIANT_NOTES={
  abbr:s=>`trouvé sans l'abréviation (« ${s} »)`,
  comp:s=>`trouvé sans le complément d'adresse (« ${s} »)`,
  'abbr+comp':s=>`trouvé sans l'abréviation ni le complément (« ${s} »)`};
const isAddrKey=k=>k.startsWith('ADRESSE');
// Ordre appris : un essai qui n'a jamais réussi pour ce pays après 2 échecs passe en dernier recours (il reste tenté s'il le faut)
export function orderTries(tries,mem){
  const bad=t=>{const k=mem?.[t.key];return !!k&&k.win===0&&k.loss>=2;};
  return [...tries.filter(t=>!bad(t)),...tries.filter(bad)];
}
// cfg.memory (facultatif) : {[pays]: {[essai]: {win,loss}}}, alimenté au fil des lignes ; sans lui, l'ordre est toujours le même
export async function geocodeRow(r,m,cfg,geocode){
  const pays=val(r,m.pays)||cfg.defPays,iso=isoOf(pays),fx=fixCp(val(r,m.cp),iso),cp=fx.cp;
  const adr=val(r,m.adr),num=val(r,m.num),city=val(r,m.ville);
  const c=iso?{countrycodes:ccList(iso)}:cc(pays),notes=fx.note?[fx.note]:[];
  const free=s=>({q:[s,[cp,city].filter(Boolean).join(' '),c.country].filter(Boolean).join(', '),countrycodes:c.countrycodes});
  // le complément est retiré de la rue avant d'y ajouter le numéro (sinon « Abbey Road, Whitley 7 » perdrait son numéro)
  const base=streetOf(adr,num,iso),short=streetOf(stripLocality(adr),num,iso);
  const addr=[],seen=new Set();
  for(const [id,s] of [['raw',base],['abbr',stripAbbr(base)],['comp',short],['abbr+comp',stripAbbr(short)]]){
    if(!s||seen.has(s))continue;seen.add(s);
    const note=VARIANT_NOTES[id]?VARIANT_NOTES[id](s):'';
    const loose=id.includes('comp');                                    // le complément ignoré peut désigner un autre quartier
    addr.push({key:'ADRESSE:'+id,prec:'ADRESSE',params:{street:s,postalcode:cp,city,...c},note,loose},
              {key:'ADRESSE_LIBRE:'+id,prec:'ADRESSE_LIBRE',params:free(s),note,loose});
  }
  const mem=cfg.memory?(cfg.memory[iso||'?']??={}):null;
  const tries=[...orderTries(addr,mem)];
  if(cp)tries.push({key:'CODE_POSTAL',prec:'CODE_POSTAL',params:{postalcode:cp,...c},note:''});
  if(city)tries.push({key:'VILLE',prec:'VILLE',params:{city,...c},note:''});
  // on garde le meilleur résultat : une adresse trop vague n'interrompt pas les essais suivants
  let fallback=null;const failed=[];
  for(const t of tries){
    const g=await geocode(t.params,cfg);if(!g){failed.push(t.key);continue;}
    const res={...g,prec:t.prec,iso,cpIn:cp,loose:!!t.loose,notes:t.note?notes.concat(t.note):notes};
    if(!isAddrKey(t.key))return fallback||res;                          // repli CP/ville : seulement si aucune adresse
    if(g.rank===0||g.rank>=26){                                         // rue ou bâtiment : on apprend quels essais marchent
      if(mem){(mem[t.key]??={win:0,loss:0}).win++;for(const k of failed)(mem[k]??={win:0,loss:0}).loss++;}
      return res;}
    fallback??=res;
  }
  return fallback||{fail:true,iso,notes};
}
export function applyResult(r,g,cfg,nuts,names){
  RES.forEach(c=>r[c]='');
  const notes=[...(g.notes||[])];
  const done=d=>{Object.assign(r,d);r.controle=notes.join(' ; ');};
  if(g.fail){notes.push('aucun résultat de géocodage');return done({statut:'ECHEC_GEOCODAGE',confiance:'FAIBLE',controle_manuel:'OUI'});}
  r.precision=g.prec;r.niveau_resultat=niveauOf(g.rank,g.atype);
  r.lat=+g.lat.toFixed(6);r.lon=+g.lon.toFixed(6);r.adresse_geocodee=g.label;r.cp_trouve=g.postcode;r.pays_trouve=g.cc;
  const precise=g.prec==='ADRESSE'||g.prec==='ADRESSE_LIBRE';
  if(!precise)notes.push(g.prec==='VILLE'?'localisé au centre de la ville seulement':'localisé au centre du code postal seulement');
  else if(r.niveau_resultat!=='BATIMENT')notes.push(NIV_TXT[r.niveau_resultat]);
  let paysKo=false,cpKo=false,cpNear=false;
  if(g.iso&&g.cc&&ccOf(g.cc)!==g.iso){paysKo=true;notes.push(`pays trouvé ${g.cc} ≠ pays saisi ${g.iso}`);}
  const cm=cpMatch(g.iso,g.cpIn,g.postcode);
  if(cm===false){cpKo=true;notes.push(`CP trouvé ${g.postcode} ≠ CP saisi ${g.cpIn}`);}
  else if(cm==='near'){cpNear=true;notes.push(`CP voisin (trouvé ${g.postcode}, saisi ${g.cpIn})`);}
  else if(cm===null&&g.cpIn&&precise)notes.push('CP non renvoyé par le géocodeur');
  // complément ignoré : doute sur le quartier, levé si le code postal saisi est retrouvé à l'identique
  const cpSame=!!normCp(g.cpIn)&&normCp(g.cpIn)===normCp(g.postcode);
  const loose=!!g.loose&&!cpSame;
  if(loose)notes.push('complément ignoré : quartier non confirmé par le code postal, à vérifier');
  const n=findNuts(nuts,g.lon,g.lat,cfg.maxKm);
  if(!n){
    notes.push(cfg.maxKm?`aucune zone NUTS à moins de ${cfg.maxKm} km`:'point hors de toute zone NUTS');
    if(g.iso==='GB'&&!cfg.uk)notes.push('Royaume-Uni : cochez « Inclure le Royaume-Uni (NUTS 2021) »');
    return done({statut:paysKo?'PAYS_INCOHERENT':'HORS_NUTS',confiance:'FAIBLE',controle_manuel:'OUI'});
  }
  [['NUTS0',2],['NUTS1',3],['NUTS2',4],['NUTS3',5]].forEach(([k,l])=>{const code=n.id.slice(0,l);r[k]=code;r[k+'_nom']=(names||{})[code]||'';});
  r.NUTS_version=n.v||'2024';r.distance_nuts_km=n.km;
  if(g.iso&&r.NUTS0!==nuts0Of(g.iso)&&!paysKo){paysKo=true;notes.push(`zone NUTS ${r.NUTS0} ≠ pays saisi ${g.iso}`);}
  if(!n.exact)notes.push(`point hors contour, zone la plus proche à ${n.km} km`);
  done(decide({precise,niveau:r.niveau_resultat,paysKo,cpKo,cpNear,loose,exact:n.exact}));
}
export function summarize(rows){
  const c={},f={},v=new Set();rows.forEach(r=>{const k=r.statut||'NON_TRAITE';c[k]=(c[k]||0)+1;if(r.confiance)f[r.confiance]=(f[r.confiance]||0)+1;if(r.NUTS_version)v.add(r.NUTS_version);});
  const fmt=o=>Object.entries(o).map(([k,n])=>`${k}: ${n}`).join(' · ');
  return fmt(c)+(Object.keys(f).length?`\nConfiance — ${fmt(f)}`:'')+(v.size>1?`\n⚠ Millésimes NUTS mixtes (${[...v].sort().join(' + ')}) : à signaler pour toute agrégation multi-pays.`:'');
}
