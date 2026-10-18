// --- Codes postaux : zéros initiaux perdus par Excel, comparaison
export const CP_LEN={DE:5,FR:5,IT:5,ES:5,FI:5,LT:5,RO:6,NO:4,PL:5};
export const COUNTRY_ALIASES={
  belgique:'BE',belgie:'BE',belgium:'BE',belgien:'BE',
  allemagne:'DE',germany:'DE',deutschland:'DE',
  france:'FR',frankreich:'FR',
  'pays-bas':'NL',netherlands:'NL',nederland:'NL',
  luxembourg:'LU',luxemburg:'LU',
  espagne:'ES',spain:'ES',espana:'ES',
  italie:'IT',italy:'IT',italia:'IT',
  suisse:'CH',switzerland:'CH',schweiz:'CH',
  pologne:'PL',poland:'PL',polska:'PL',
  roumanie:'RO',romania:'RO',
  tchequie:'CZ','republique tcheque':'CZ',czechia:'CZ','czech republic':'CZ',
  danemark:'DK',denmark:'DK',
  'royaume-uni':'GB','united kingdom':'GB','great britain':'GB','grande-bretagne':'GB',
  grece:'GR',greece:'GR',portugal:'PT',autriche:'AT',austria:'AT',irlande:'IE',ireland:'IE'
};
export const isoOf=p=>{
  p=String(p||'').trim();const u=p.toUpperCase();
  if(/^[A-Z]{2}$/.test(u))return u==='UK'?'GB':u==='EL'?'GR':u;
  return COUNTRY_ALIASES[p.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()]||'';
};
export const nuts0Of=iso=>iso==='GB'?'UK':iso==='GR'?'EL':iso;
// Territoires que Nominatim renvoie sous leur propre code pays mais qui relèvent du NUTS0 d'un autre pays (outre-mer français, Åland)
export const CC_GROUP={gp:'FR',mq:'FR',gf:'FR',re:'FR',yt:'FR',ax:'FI'};
export const ccOf=code=>CC_GROUP[String(code||'').toLowerCase()]||String(code||'').toUpperCase();
export const ccList=iso=>[iso.toLowerCase(),...Object.entries(CC_GROUP).filter(([,v])=>v===iso).map(([k])=>k)].join(',');
// Ordre numéro/rue attendu par Nominatim : numéro d'abord en FR, GB, IE, LU
export const NUM_FIRST=new Set(['FR','GB','IE','LU']);
export const streetOf=(adr,num,iso)=>(NUM_FIRST.has(iso)?[num,adr]:[adr,num]).filter(Boolean).join(' ');
export const normCp=s=>String(s||'').toUpperCase().replace(/[\s.\-]/g,'');
export function fixCp(cp,iso){
  const n=CP_LEN[iso];if(!n||!/^\d+$/.test(cp)||cp.length>=n)return {cp,note:''};
  let f=cp.padStart(n,'0');if(iso==='PL')f=f.slice(0,2)+'-'+f.slice(2);
  return {cp:f,note:`CP ${cp} complété en ${f}`};
}
export function cpMatch(iso,a,b){
  a=normCp(a);b=normCp(b);if(!a||!b)return null;
  const cut=s=>iso==='GB'&&s.length>=5?s.slice(0,-3):(iso==='NL'||iso==='PT')?s.slice(0,4):s;
  a=cut(a);b=cut(b);
  if(a===b||(b.length>=3&&a.startsWith(b))||(a.length>=3&&b.startsWith(a)))return true;
  // même longueur (≥5), seuls les 2 derniers caractères diffèrent : CP voisin (codes par rue, RO/ES…) ; pas pour les CP à 4 chiffres (BE, CH, DK, AT…)
  if(a.length===b.length&&a.length>=5&&a.slice(0,-2)===b.slice(0,-2))return 'near';
  return false;
}
// niveau réel du résultat Nominatim (place_rank / addresstype), indépendant de la stratégie de requête
export function niveauOf(rank,atype){
  if(atype==='postcode')return 'CODE_POSTAL';
  if(!(rank>0))return 'INCONNU';
  return rank>=28?'BATIMENT':rank>=26?'RUE':rank>=17?'LOCALITE':'VILLE_OU_PLUS';
}
// RÈGLE MÉTIER (v7) — statut = fiabilité du code NUTS ; confiance = précision de la localisation
//  PAYS_INCOHERENT : pays trouvé ou NUTS0 ≠ pays saisi
//  A_VERIFIER      : repli CP/ville, résultat de niveau localité/ville/CP, ou CP franchement différent
//  NUTS_PROCHE     : point hors contour mais dans la tolérance
//  OK              : sinon. Confiance HAUTE seulement si bâtiment trouvé, CP identique ou voisin, point dans le contour ;
//                    MOYENNE si rue sans numéro, zone proche ou complément ignoré. controle_manuel = OUI dès que confiance ≠ HAUTE.
//                    Un CP voisin (2 derniers caractères) n'abaisse pas la confiance : avec un bâtiment exact, c'est le CP d'OpenStreetMap qui diffère.
export function decide(q){
  const fine=q.precise&&(q.niveau==='BATIMENT'||q.niveau==='RUE'||q.niveau==='INCONNU');
  // q.cpNutsKo : le NUTS 3 du point diffère de celui de la table Eurostat des codes postaux (millésimes identiques)
  // q.loose : adresse trouvée après avoir ignoré un complément (« Whitley ») qui pouvait désigner un autre quartier
  const statut=q.paysKo?'PAYS_INCOHERENT':(!fine||q.cpKo||q.loose||q.cpNutsKo)?'A_VERIFIER':!q.exact?'NUTS_PROCHE':'OK';
  const confiance=(q.paysKo||!fine)?'FAIBLE':(q.cpKo||q.loose||q.cpNutsKo||!q.exact||q.niveau!=='BATIMENT')?'MOYENNE':'HAUTE';
  return {statut,confiance,controle_manuel:confiance==='HAUTE'?'NON':'OUI'};
}
// abréviations de type de voie retirées pour un second essai (ul., al., pl., os., str., tř., nám., bd.)
// complément d'adresse après une virgule (« Abbey Road, Whitley ») : on ne garde que la rue, à condition qu'elle contienne des lettres
// (pas « 12, rue X ») et que ce qui suit ne commence pas par un chiffre (pas « Rue X, 12 », le numéro serait perdu)
export const stripLocality=s=>{
  const i=s.indexOf(',');if(i<0)return s;
  const a=s.slice(0,i).trim(),rest=s.slice(i+1).trim();
  return /\p{L}/u.test(a)&&rest&&!/^\d/.test(rest)?a:s;
};
export const stripAbbr=s=>s.replace(/(^|[\s,])(ul|al|pl|os|str|tř|nám|bd|bld)\.\s*/giu,'$1').replace(/\s{2,}/g,' ').trim();
export function cc(p){p=(p||'').trim();if(/^[A-Za-z]{2}$/.test(p)){p=p.toLowerCase();return {countrycodes:p==='el'?'gr':p==='uk'?'gb':p};}return p?{country:p}:{};}
