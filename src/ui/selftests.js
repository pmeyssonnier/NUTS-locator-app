import {findNuts, prepNuts} from '../lib/geo.js';
import {ccList, ccOf, cpMatch, decide, fixCp, isoOf, niveauOf, streetOf, stripAbbr} from '../lib/postal.js';
import {setStatus} from './dom.js';

export function runSelfTests(){
  const out=[];const T=(c,m)=>out.push((c?'✔ ':'✘ ')+m);
  T(cpMatch('BE','1030','1030')===true,'CP identique');T(cpMatch('ES','15143','15142')==='near','CP voisin ES');
  T(cpMatch('BE','1030','1210')===false,'CP différent');T(cpMatch('GB','SW1Y 4PD','SW1Y 4LE')===true,'UK même district');
  T(cpMatch('GB','CV3 4LF','CV1 1LL')===false,'UK district différent');T(cpMatch('BE','1030','')===null,'CP absent');
  T(isoOf('Belgique')==='BE'&&isoOf('Deutschland')==='DE'&&isoOf('Royaume-Uni')==='GB'&&isoOf('Tchéquie')==='CZ','pays en toutes lettres');
  T(isoOf('uk')==='GB'&&isoOf('EL')==='GR'&&isoOf('Atlantide')==='','codes ISO / pays inconnu');
  T(streetOf('Rue de la Paix','12','FR')==='12 Rue de la Paix'&&streetOf('Brouwerijplein','1','BE')==='Brouwerijplein 1'&&streetOf('Rue X','','FR')==='Rue X','numéro avant/après la rue');
  T(ccOf('re')==='FR'&&ccOf('GP')==='FR'&&ccOf('ax')==='FI'&&ccOf('be')==='BE','outre-mer rattaché au pays');
  T(ccList('FR')==='fr,gp,mq,gf,re,yt'&&ccList('BE')==='be','countrycodes avec territoires');
  T(cpMatch('BE','1030','1040')===false,'BE : CP à 4 chiffres, pas de « voisin »');T(cpMatch('RO','400027','400029')==='near','RO : CP voisin');
  T(fixCp('13329','RO').cp==='013329','zéro initial RO');T(fixCp('2515','PL').cp==='02-515','zéro initial PL');T(fixCp('1030','BE').cp==='1030','BE inchangé');
  T(stripAbbr('ul. Chemików 7')==='Chemików 7','abréviation ul.');T(stripAbbr("1 St James's Square")==="1 St James's Square",'pas de faux positif');
  T(niveauOf(30,'building')==='BATIMENT','niveau bâtiment');T(niveauOf(26,'road')==='RUE','niveau rue');
  T(niveauOf(16,'city')==='VILLE_OU_PLUS','niveau ville');T(niveauOf(21,'postcode')==='CODE_POSTAL','niveau CP');
  const sq=(lon,lat,d)=>[[lon-d,lat-d],[lon+d,lat-d],[lon+d,lat+d],[lon-d,lat+d],[lon-d,lat-d]];
  const N=prepNuts([{type:'Feature',properties:{NUTS_ID:'BE100',NAME_LATN:'x'},geometry:{type:'Polygon',coordinates:[sq(4.35,50.85,0.1),sq(4.35,50.85,0.025)]}},
    {type:'Feature',properties:{NUTS_ID:'BE241',NAME_LATN:'y'},geometry:{type:'MultiPolygon',coordinates:[[sq(5.0,50.85,0.05)],[sq(5.3,50.85,0.05)]]}}]);
  const km=1/(111.32*Math.cos(50.85*Math.PI/180));
  T(findNuts(N,4.30,50.80)?.id==='BE100','point dans le polygone');
  T(findNuts(N,4.35,50.85,1)===null,'point dans un trou, tolérance 1 km : aucun');
  T(findNuts(N,5.3,50.85)?.id==='BE241','multipolygone, 2e partie');
  const p0=findNuts(N,4.45+0.5*km,50.85,3);T(p0&&!p0.exact&&Math.abs(p0.km-0.5)<0.05,'0,5 km hors bord : proche');
  T(findNuts(N,4.45+2.9*km,50.85,3)?.km<3,'2,9 km : dans la tolérance de 3 km');
  T(findNuts(N,4.45+3.1*km,50.85,3)===null,'3,1 km : hors tolérance de 3 km');
  T(findNuts(N,4.45+0.5*km,50.85,0)===null,'tolérance 0 : aucun rattachement forcé');
  const D=q=>decide(Object.assign({precise:true,niveau:'BATIMENT',paysKo:false,cpKo:false,exact:true},q));
  T(D({}).statut==='OK'&&D({}).confiance==='HAUTE'&&D({}).controle_manuel==='NON','bâtiment exact : OK/HAUTE');
  T(D({niveau:'RUE'}).statut==='OK'&&D({niveau:'RUE'}).confiance==='MOYENNE','rue sans numéro : OK/MOYENNE');
  T(D({niveau:'VILLE_OU_PLUS'}).statut==='A_VERIFIER','réponse de niveau ville : A_VERIFIER');
  T(D({precise:false}).statut==='A_VERIFIER'&&D({precise:false}).confiance==='FAIBLE','repli CP/ville : A_VERIFIER/FAIBLE');
  T(D({cpKo:true}).statut==='A_VERIFIER','CP différent : A_VERIFIER');T(D({paysKo:true}).statut==='PAYS_INCOHERENT','pays incohérent');
  T(D({exact:false}).statut==='NUTS_PROCHE','hors contour : NUTS_PROCHE');
  const ko=out.filter(x=>x.startsWith('✘')).length;
  setStatus(`Auto-tests : ${out.length-ko}/${out.length} réussis\n`+out.join('\n'),ko>0);
  return {total:out.length,ko};
}
