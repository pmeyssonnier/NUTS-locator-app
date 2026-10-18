import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../src/lib/index.js';

const sq=(lon,lat,d)=>[[lon-d,lat-d],[lon+d,lat-d],[lon+d,lat+d],[lon-d,lat+d],[lon-d,lat-d]];
const NUTS=L.prepNuts([
  ['BE100',4.35,50.85],['FRY40',55.45,-20.88],['UKI32',-0.14,51.50],['PL911',21.0,52.2]
].map(([id,lon,lat])=>({type:'Feature',properties:{NUTS_ID:id,NAME_LATN:id},geometry:{type:'Polygon',coordinates:[sq(lon,lat,.1)]}})));
const NAMES={BE:'Belgique',BE1:'Région bruxelloise',BE10:'Bruxelles-Capitale',BE100:'Arr. de Bruxelles',FRY40:'La Réunion',FRY:'RUP',FRY4:'La Réunion',FR:'France'};

// géocodeur simulé : file de réponses, journal des requêtes
const fake=(...answers)=>{const calls=[];const fn=async p=>{calls.push(p);return answers.shift()??null;};fn.calls=calls;return fn;};
const hit=(o={})=>({lat:50.85,lon:4.35,label:'x',postcode:'1000',cc:'BE',rank:30,atype:'building',...o});
const M={adr:'Adresse',num:'Num',cp:'CP',ville:'Ville',pays:'Pays'};
const row=(o={})=>({Adresse:'Rue Neuve',Num:'12',CP:'1000',Ville:'Bruxelles',Pays:'BE',...o});
const CFG={defPays:'BE',maxKm:3,uk:false};

test('geocodeRow : premier essai précis (bâtiment) → un seul appel',async()=>{
  const g=fake(hit());const r=await L.geocodeRow(row(),M,CFG,g);
  assert.equal(g.calls.length,1);assert.equal(r.prec,'ADRESSE');assert.equal(r.iso,'BE');assert.equal(r.cpIn,'1000');
  assert.deepEqual(g.calls[0],{street:'Rue Neuve 12',postalcode:'1000',city:'Bruxelles',countrycodes:'be'});
});

test('geocodeRow : résultat trop vague → essai suivant, on garde le meilleur',async()=>{
  const g=fake(hit({rank:16,atype:'city'}),hit({rank:30}));
  const r=await L.geocodeRow(row(),M,CFG,g);
  assert.equal(r.prec,'ADRESSE_LIBRE');assert.equal(r.rank,30);assert.equal(g.calls.length,2);
  assert.deepEqual(g.calls[1],{q:'Rue Neuve 12, 1000 Bruxelles',countrycodes:'be'});
});

test('geocodeRow : tous les essais d\'adresse vagues → le premier résultat vague est conservé, sans repli CP/ville',async()=>{
  const vague1=hit({rank:16,label:'v1'}),vague2=hit({rank:20,label:'v2'});
  const g=fake(vague1,vague2);
  const r=await L.geocodeRow(row(),M,CFG,g);
  assert.equal(r.label,'v1');assert.equal(r.prec,'ADRESSE');
});

test('geocodeRow : aucune adresse trouvée → repli code postal puis ville',async()=>{
  const g=fake(null,null,hit({rank:21,atype:'postcode'}));
  const r=await L.geocodeRow(row(),M,CFG,g);
  assert.equal(r.prec,'CODE_POSTAL');assert.deepEqual(g.calls[2],{postalcode:'1000',countrycodes:'be'});
  const g2=fake(null,null,null,hit({rank:16}));
  const r2=await L.geocodeRow(row(),M,CFG,g2);
  assert.equal(r2.prec,'VILLE');assert.deepEqual(g2.calls[3],{city:'Bruxelles',countrycodes:'be'});
});

test('geocodeRow : échec total',async()=>{
  const r=await L.geocodeRow(row(),M,CFG,fake());
  assert.equal(r.fail,true);assert.equal(r.iso,'BE');
});

test('geocodeRow : sans rue, seulement CP et ville',async()=>{
  const g=fake(hit({rank:21,atype:'postcode'}));
  const r=await L.geocodeRow(row({Adresse:'',Num:''}),M,CFG,g);
  assert.equal(r.prec,'CODE_POSTAL');assert.equal(g.calls.length,1);
});

test('geocodeRow : abréviation retirée pour un second essai, avec note',async()=>{
  const g=fake(null,null,hit({rank:30}));
  const r=await L.geocodeRow(row({Adresse:'ul. Chemików',Num:'7',Pays:'PL',CP:'09411'}),M,CFG,g);
  assert.equal(g.calls[2].street,'Chemików 7');
  assert.match(r.notes.join(' '),/sans l'abréviation/);
});

test('geocodeRow : zéro initial restauré et noté',async()=>{
  const g=fake(hit({postcode:'01000',cc:'FR'}));
  const r=await L.geocodeRow(row({Pays:'FR',CP:'1000'}),M,CFG,g);
  assert.equal(g.calls[0].postalcode,'01000');assert.match(r.notes[0],/CP 1000 complété en 01000/);
});

test('geocodeRow : numéro avant la rue et territoires d\'outre-mer pour la France',async()=>{
  const g=fake(hit({cc:'RE'}));
  await L.geocodeRow(row({Adresse:'Rue de la Paix',Num:'12',Pays:'France',CP:'97400'}),M,CFG,g);
  assert.equal(g.calls[0].street,'12 Rue de la Paix');assert.equal(g.calls[0].countrycodes,'fr,gp,mq,gf,re,yt');
});

test('geocodeRow : pays vide → pays par défaut ; pays inconnu → paramètre « country »',async()=>{
  const g=fake(hit());await L.geocodeRow(row({Pays:''}),M,{...CFG,defPays:'NL'},g);
  assert.equal(g.calls[0].countrycodes,'nl');
  const g2=fake(hit());const r2=await L.geocodeRow(row({Pays:'Atlantide'}),M,CFG,g2);
  assert.equal(g2.calls[0].country,'Atlantide');assert.equal(r2.iso,'');
});

test('geocodeRow : une erreur du géocodeur est propagée',async()=>{
  await assert.rejects(()=>L.geocodeRow(row(),M,CFG,async()=>{throw new Error('réseau');}),/réseau/);
});

// ---------- applyResult ----------
const G=(o={})=>({lat:50.85,lon:4.35,label:'adresse',postcode:'1000',cc:'BE',rank:30,atype:'building',prec:'ADRESSE',iso:'BE',cpIn:'1000',notes:[],...o});
const apply=(g,cfg=CFG)=>{const r={};L.RES.forEach(c=>r[c]='');L.applyResult(r,g,cfg,NUTS,NAMES);return r;};

test('applyResult : bâtiment dans le contour → OK / HAUTE avec les 4 niveaux NUTS',()=>{
  const r=apply(G());
  assert.equal(r.statut,'OK');assert.equal(r.confiance,'HAUTE');assert.equal(r.controle_manuel,'NON');
  assert.deepEqual([r.NUTS0,r.NUTS1,r.NUTS2,r.NUTS3],['BE','BE1','BE10','BE100']);
  assert.equal(r.NUTS3_nom,'Arr. de Bruxelles');assert.equal(r.NUTS_version,'2024');assert.equal(r.distance_nuts_km,0);
  assert.equal(r.niveau_resultat,'BATIMENT');assert.equal(r.controle,'');
});

test('applyResult : échec de géocodage',()=>{
  const r=apply({fail:true,iso:'BE',notes:['n']});
  assert.equal(r.statut,'ECHEC_GEOCODAGE');assert.equal(r.confiance,'FAIBLE');assert.match(r.controle,/aucun résultat/);
});

test('applyResult : repli ville ou code postal → A_VERIFIER, localisation approximative notée',()=>{
  const r=apply(G({prec:'VILLE',rank:16,atype:'city'}));
  assert.equal(r.statut,'A_VERIFIER');assert.match(r.controle,/centre de la ville/);
  assert.match(apply(G({prec:'CODE_POSTAL',rank:21,atype:'postcode'})).controle,/centre du code postal/);
});

test('applyResult : CP différent / voisin / non renvoyé',()=>{
  const ko=apply(G({postcode:'1210'}));assert.equal(ko.statut,'A_VERIFIER');assert.match(ko.controle,/CP trouvé 1210 ≠ CP saisi 1000/);
  const near=apply(G({iso:'ES',cc:'ES',postcode:'15142',cpIn:'15143'}));assert.match(near.controle,/CP voisin/);
  assert.match(apply(G({postcode:''})).controle,/CP non renvoyé/);
});

test('applyResult : pays trouvé différent du pays saisi → PAYS_INCOHERENT',()=>{
  const r=apply(G({cc:'NL'}));
  assert.equal(r.statut,'PAYS_INCOHERENT');assert.match(r.controle,/pays trouvé NL ≠ pays saisi BE/);
});

test('applyResult : zone NUTS d\'un autre pays que le pays saisi → PAYS_INCOHERENT',()=>{
  const r=apply(G({iso:'FR',cc:'FR',postcode:'1000',cpIn:'1000'}));   // point à Bruxelles mais pays saisi FR
  assert.equal(r.statut,'PAYS_INCOHERENT');assert.match(r.controle,/zone NUTS BE ≠ pays saisi FR/);
});

test('applyResult : La Réunion (cc « re ») n\'est pas une incohérence pour la France',()=>{
  const r=apply(G({lat:-20.88,lon:55.45,cc:'RE',iso:'FR',postcode:'97400',cpIn:'97400'}));
  assert.equal(r.statut,'OK');assert.equal(r.NUTS3,'FRY40');assert.equal(r.pays_trouve,'RE');
});

test('applyResult : point hors contour mais dans la tolérance → NUTS_PROCHE',()=>{
  const k=1/(111.32*Math.cos(50.85*Math.PI/180));
  const r=apply(G({lon:4.45+0.5*k}));
  assert.equal(r.statut,'NUTS_PROCHE');assert.ok(r.distance_nuts_km>0);assert.match(r.controle,/zone la plus proche/);
});

test('applyResult : hors de toute zone → HORS_NUTS (ou PAYS_INCOHERENT si le pays diffère)',()=>{
  const r=apply(G({lat:40,lon:9}));
  assert.equal(r.statut,'HORS_NUTS');assert.match(r.controle,/aucune zone NUTS à moins de 3 km/);
  assert.equal(apply(G({lat:40,lon:9,cc:'IT'})).statut,'PAYS_INCOHERENT');
  assert.match(apply(G({lat:40,lon:9}),{...CFG,maxKm:0}).controle,/hors de toute zone NUTS/);
});

test('applyResult : Royaume-Uni → NUTS2021 et rappel quand les contours UK ne sont pas chargés',()=>{
  const uk=L.prepNuts([{type:'Feature',properties:{NUTS_ID:'UKI32',NAME_LATN:'Westminster'},geometry:{type:'Polygon',coordinates:[sq(-0.14,51.5,.1)]}}]);
  uk[0].v='2021';
  const r={};L.RES.forEach(c=>r[c]='');
  L.applyResult(r,G({lat:51.5,lon:-0.14,iso:'GB',cc:'GB',postcode:'SW1Y 4PD',cpIn:'SW1Y 4PD'}),{...CFG,uk:true},uk,{UKI32:'Westminster'});
  assert.equal(r.NUTS0,'UK');assert.equal(r.NUTS_version,'2021');assert.equal(r.statut,'OK');
  const miss=apply(G({lat:60,lon:-5,iso:'GB',cc:'GB'}));
  assert.match(miss.controle,/Inclure le Royaume-Uni/);
});

test('applyResult : noms absents → champ vide, sans erreur',()=>{
  const r={};L.RES.forEach(c=>r[c]='');
  L.applyResult(r,G(),CFG,NUTS,null);
  assert.equal(r.NUTS3,'BE100');assert.equal(r.NUTS3_nom,'');
});

test('applyResult : réinitialise les résultats précédents',()=>{
  const r=apply(G());r.statut='ancien';
  L.applyResult(r,{fail:true,iso:'BE',notes:[]},CFG,NUTS,NAMES);
  assert.equal(r.NUTS3,'');assert.equal(r.lat,'');assert.equal(r.statut,'ECHEC_GEOCODAGE');
});

test('summarize : comptes par statut et confiance, millésimes mixtes signalés',()=>{
  const rows=[{statut:'OK',confiance:'HAUTE',NUTS_version:'2024'},{statut:'OK',confiance:'MOYENNE',NUTS_version:'2024'},{statut:'HORS_NUTS',confiance:'FAIBLE'},{}];
  assert.equal(L.summarize(rows),'OK: 2 · HORS_NUTS: 1 · NON_TRAITE: 1\nConfiance — HAUTE: 1 · MOYENNE: 1 · FAIBLE: 1');
  const mixed=L.summarize([{statut:'OK',confiance:'HAUTE',NUTS_version:'2024'},{statut:'OK',confiance:'HAUTE',NUTS_version:'2021'}]);
  assert.match(mixed,/Millésimes NUTS mixtes \(2021 \+ 2024\)/);
  assert.equal(L.summarize([]),'');
});

test('SAMPLE : lignes complètes et pays reconnus',()=>{
  const [head,...rest]=L.SAMPLE;
  assert.equal(head.length,7);
  for(const r of rest){assert.equal(r.length,7,r[0]);assert.notEqual(L.isoOf(r[6]),'',r[0]);}
});

// ---------- Complément d'adresse et ordre appris ----------
const NOT_FOUND=async()=>null;
test('geocodeRow : complément après une virgule → essai avec la rue seule',async()=>{
  const g=fake(null,null,hit({rank:30,cc:'GB',postcode:'CV3 4LF'}));
  const r=await L.geocodeRow(row({Adresse:'Abbey Road, Whitley',Num:'',Pays:'UK',CP:'CV3 4LF',Ville:'Coventry'}),M,CFG,g);
  assert.equal(g.calls.length,3);
  assert.equal(g.calls[0].street,'Abbey Road, Whitley');assert.equal(g.calls[1].q.startsWith('Abbey Road, Whitley'),true);
  assert.equal(g.calls[2].street,'Abbey Road');assert.equal(r.prec,'ADRESSE');
  assert.match(r.notes.join(' '),/sans le complément d'adresse \(« Abbey Road »\)/);
});

test('geocodeRow : variantes dédoublonnées (pas de second essai identique) et ordre abréviation puis complément',async()=>{
  const g=fake();   // tout échoue : on observe la liste des essais
  await L.geocodeRow(row({Adresse:'ul. Chemików, Płock',Num:'7',Pays:'PL',CP:'09411',Ville:'Płock'}),M,CFG,g);
  const streets=g.calls.slice(0,8).map(c=>c.street??c.q.replace(/, 09411 Płock$/,''));
  assert.deepEqual(streets,['ul. Chemików, Płock 7','ul. Chemików, Płock 7','Chemików, Płock 7','Chemików, Płock 7','ul. Chemików 7','ul. Chemików 7','Chemików 7','Chemików 7']);
  assert.equal(g.calls.length,8+2);                       // + code postal + ville
});

test('orderTries : un essai sans aucun succès après 2 échecs passe en dernier recours',()=>{
  const t=k=>({key:k});
  const list=[t('A'),t('B'),t('C')];
  assert.deepEqual(L.orderTries(list,null).map(x=>x.key),['A','B','C']);
  assert.deepEqual(L.orderTries(list,{}).map(x=>x.key),['A','B','C']);
  assert.deepEqual(L.orderTries(list,{A:{win:0,loss:1}}).map(x=>x.key),['A','B','C']);              // un seul échec : pas de conclusion
  assert.deepEqual(L.orderTries(list,{A:{win:0,loss:2}}).map(x=>x.key),['B','C','A']);
  assert.deepEqual(L.orderTries(list,{A:{win:1,loss:5}}).map(x=>x.key),['A','B','C']);              // il a déjà réussi : on le garde
  assert.deepEqual(L.orderTries(list,{A:{win:0,loss:3},B:{win:0,loss:2}}).map(x=>x.key),['C','A','B']);   // ordre relatif conservé
});

test('ordre appris : la recherche structurée qui échoue toujours pour un pays est tentée en dernier',async()=>{
  const mem={},cfg={...CFG,memory:mem};
  const onlyFree=()=>fake_(async p=>p.q?hit():null);
  const rows=[row({Pays:'NL',CP:'1096BC'}),row({Pays:'NL',CP:'1096BC'}),row({Pays:'NL',CP:'1096BC'}),row({Pays:'NL',CP:'1096BC'})];
  const counts=[];
  for(const r of rows){const g=onlyFree();await L.geocodeRow(r,M,cfg,g);counts.push(g.calls.length);}
  assert.deepEqual(counts,[2,2,1,1]);                       // 2 requêtes tant qu'on n'a pas 2 échecs, puis 1 seule
  assert.deepEqual(mem.NL['ADRESSE:raw'],{win:0,loss:2});assert.deepEqual(mem.NL['ADRESSE_LIBRE:raw'],{win:4,loss:0});
});

test('ordre appris : cas polonais, l\'essai sans abréviation passe en premier',async()=>{
  const cfg={...CFG,memory:{}};const counts=[];
  for(let i=0;i<4;i++){
    const g=fake_(async p=>p.q&&p.q.startsWith('Chemików 7')?hit():null);
    const r=await L.geocodeRow(row({Adresse:'ul. Chemików',Num:'7',Pays:'PL',CP:'09411'}),M,cfg,g);
    counts.push(g.calls.length);assert.equal(r.prec,'ADRESSE_LIBRE');
  }
  assert.deepEqual(counts,[4,4,1,1]);
});

test('ordre appris : un essai relégué redevient prioritaire s\'il réussit à nouveau',async()=>{
  const cfg={...CFG,memory:{}};
  const run=async fn=>{const g=fake_(fn);await L.geocodeRow(row({Pays:'NL'}),M,cfg,g);return g.calls.map(c=>c.q?'libre':'structurée').join('>');};
  const onlyFree=async p=>p.q?hit():null;
  assert.equal(await run(onlyFree),'structurée>libre');assert.equal(await run(onlyFree),'structurée>libre');
  assert.equal(await run(onlyFree),'libre');                                  // structurée reléguée
  assert.equal(await run(async p=>p.street?hit():null),'libre>structurée');   // la libre échoue : la structurée est reprise et réussit
  assert.equal(await run(onlyFree),'structurée>libre');                       // structurée a réussi : retour à l'ordre normal
});

test('ordre appris : mémoire séparée par pays, aucun effet sans mémoire',async()=>{
  const cfg={...CFG,memory:{}};
  for(let i=0;i<3;i++)await L.geocodeRow(row({Pays:'NL'}),M,cfg,fake_(async p=>p.q?hit():null));
  const g=fake(hit());await L.geocodeRow(row({Pays:'BE'}),M,cfg,g);
  assert.equal(g.calls.length,1);assert.ok(g.calls[0].street,'BE commence toujours par la recherche structurée');
  const calls=[];
  for(let i=0;i<4;i++){const g2=fake_(async p=>p.q?hit():null);await L.geocodeRow(row({Pays:'NL'}),M,CFG,g2);calls.push(g2.calls.length);}
  assert.deepEqual(calls,[2,2,2,2]);                                           // sans cfg.memory : toujours le même ordre
});

test('ordre appris : un résultat vague ou un échec total n\'apprend rien',async()=>{
  const cfg={...CFG,memory:{}};
  await L.geocodeRow(row({Pays:'FR'}),M,cfg,fake_(async()=>hit({rank:16,atype:'city'})));
  await L.geocodeRow(row({Pays:'FR'}),M,cfg,NOT_FOUND);
  assert.deepEqual(cfg.memory.FR,{});
});

// géocodeur simulé à comportement libre, avec journal des requêtes
function fake_(fn){const calls=[];const g=async p=>{calls.push(p);return fn(p);};g.calls=calls;return g;}

// ---------- Complément ignoré : doute sur le quartier ----------
test('geocodeRow : seuls les essais sans complément sont marqués « loose »',async()=>{
  const first=await L.geocodeRow(row({Adresse:'Abbey Road, Whitley',Num:'',Pays:'UK'}),M,CFG,fake(hit()));
  assert.equal(first.loose,false);                                              // la rue telle quelle n'est jamais loose
  const g3=fake(null,null,hit());                                               // 3e essai = « Abbey Road » (sans complément)
  const r3=await L.geocodeRow(row({Adresse:'Abbey Road, Whitley',Num:'',Pays:'UK'}),M,CFG,g3);
  assert.equal(r3.loose,true);assert.equal(g3.calls[2].street,'Abbey Road');
  const g4=fake(null,null,hit());                                               // 3e essai = variante sans abréviation : pas loose
  const r4=await L.geocodeRow(row({Adresse:'ul. Chemików',Num:'7',Pays:'PL'}),M,CFG,g4);
  assert.equal(r4.loose,false);assert.match(r4.notes.join(' '),/sans l'abréviation/);
});

test('applyResult : complément ignoré non confirmé → A_VERIFIER / MOYENNE avec une note',()=>{
  const r=apply(G({loose:true,postcode:'',notes:["trouvé sans le complément d'adresse (« Rue Neuve »)"]}));
  assert.equal(r.statut,'A_VERIFIER');assert.equal(r.confiance,'MOYENNE');assert.equal(r.controle_manuel,'OUI');
  assert.match(r.controle,/complément ignoré : quartier non confirmé par le code postal, à vérifier/);
  assert.equal(r.NUTS3,'BE100');assert.equal(r.niveau_resultat,'BATIMENT');                 // la position affinée est conservée
});

test('applyResult : le code postal saisi retrouvé à l\'identique lève le doute',()=>{
  const r=apply(G({loose:true,postcode:'1000',cpIn:'1000'}));
  assert.equal(r.statut,'OK');assert.equal(r.confiance,'HAUTE');assert.doesNotMatch(r.controle,/complément ignoré/);
  const uk=apply(G({loose:true,iso:'BE',postcode:'1000',cpIn:'1 000'}));                      // comparaison normalisée (espaces, casse)
  assert.equal(uk.statut,'OK');
  const near=apply(G({loose:true,postcode:'1040',cpIn:'1000'}));                                // code postal différent : cpKo, déjà A_VERIFIER
  assert.equal(near.statut,'A_VERIFIER');
});

test('applyResult : un essai non loose n\'est pas affecté',()=>{
  assert.equal(apply(G({loose:false})).statut,'OK');assert.equal(apply(G({})).confiance,'HAUTE');
});

test('Jaguar Land Rover (export réel) : « Abbey Road, Whitley » trouvé sans le complément → A_VERIFIER avec la rue pour position',async()=>{
  const uk=L.prepNuts([{type:'Feature',properties:{NUTS_ID:'UKG33',NAME_LATN:'Coventry'},geometry:{type:'Polygon',coordinates:[sq(-1.49,52.39,.2)]}}]);uk[0].v='2021';
  const g=fake(null,null,{lat:52.38845,lon:-1.489588,label:'Abbey Road, Lower Stoke, Coventry',postcode:'CV3 4BN',cc:'GB',rank:26,atype:'road'});
  const found=await L.geocodeRow(row({Adresse:'Abbey Road, Whitley',Num:'',CP:'CV3 4LF',Ville:'Coventry',Pays:'UK'}),M,CFG,g);
  const r={};L.RES.forEach(c=>r[c]='');
  L.applyResult(r,found,{...CFG,uk:true},uk,{UKG33:'Coventry'});
  assert.equal(r.statut,'A_VERIFIER');assert.equal(r.confiance,'MOYENNE');assert.equal(r.controle_manuel,'OUI');
  assert.equal(r.niveau_resultat,'RUE');assert.equal(r.NUTS3,'UKG33');assert.equal(r.lat,52.38845);   // la position de la rue est conservée
  assert.match(r.controle,/sans le complément d'adresse \(« Abbey Road »\)/);assert.match(r.controle,/quartier non confirmé/);
});

// ---------- Code postal voisin ----------
// zones cohérentes avec le pays saisi (Bucarest, La Corogne) : sinon le contrôle du pays prendrait le pas
const NX=L.prepNuts([['RO321',26.06,44.49],['ES111',-8.51,43.31]].map(([id,lon,lat])=>({type:'Feature',properties:{NUTS_ID:id,NAME_LATN:id},geometry:{type:'Polygon',coordinates:[sq(lon,lat,.2)]}})));
const RO=(o={})=>G({iso:'RO',cc:'RO',lat:44.49,lon:26.06,postcode:'400018',cpIn:'400027',...o});
const ES=(o={})=>G({iso:'ES',cc:'ES',lat:43.31,lon:-8.51,postcode:'15142',cpIn:'15143',...o});
const applyX=g=>{const r={};L.RES.forEach(c=>r[c]='');L.applyResult(r,g,CFG,NX,{});return r;};

test('applyResult : bâtiment exact + code postal voisin → HAUTE, la note reste visible',()=>{
  const r=applyX(RO());                                                        // Banca Transilvania (export réel)
  assert.equal(r.statut,'OK');assert.equal(r.confiance,'HAUTE');assert.equal(r.controle_manuel,'NON');
  assert.match(r.controle,/CP voisin \(trouvé 400018, saisi 400027\)/);
  assert.equal(applyX(ES()).confiance,'HAUTE');
});

test('applyResult : code postal voisin mais rue sans numéro → MOYENNE (le niveau compte, pas le code postal)',()=>{
  const r=applyX(ES({rank:26,atype:'road'}));                                  // Inditex (export réel)
  assert.equal(r.statut,'OK');assert.equal(r.confiance,'MOYENNE');assert.equal(r.controle_manuel,'OUI');
  assert.equal(r.niveau_resultat,'RUE');assert.match(r.controle,/CP voisin/);
});

test('applyResult : le code postal voisin ne masque aucun autre doute',()=>{
  const loose=applyX(RO({loose:true}));
  assert.equal(loose.statut,'A_VERIFIER');assert.equal(loose.confiance,'MOYENNE');                  // complément ignoré
  const ko=applyX(RO({postcode:'410018'}));
  assert.equal(ko.statut,'A_VERIFIER');assert.equal(ko.confiance,'MOYENNE');                        // vrai écart de code postal
  const vague=applyX(RO({prec:'VILLE',rank:16,atype:'city'}));
  assert.equal(vague.confiance,'FAIBLE');                                                           // repli sur la ville
  const km=1/(111.32*Math.cos(44.49*Math.PI/180));
  const near=applyX(RO({lon:26.26+0.5*km}));                                                        // à 0,5 km du bord de la zone
  assert.equal(near.statut,'NUTS_PROCHE');assert.equal(near.confiance,'MOYENNE');
  const pays=applyX(RO({cc:'HU'}));
  assert.equal(pays.statut,'PAYS_INCOHERENT');                                                      // le pays prime
});

test('applyResult : CP à 4 chiffres (BE) : pas de « voisin », donc inchangé',()=>{
  const r=apply(G({postcode:'1040',cpIn:'1000'}));
  assert.equal(r.statut,'A_VERIFIER');assert.doesNotMatch(r.controle,/CP voisin/);
});

// ---------- Contrôle croisé avec la table Eurostat des codes postaux (prototype) ----------
const tbl=(e,nutsVersion='2024')=>{const entries=Object.fromEntries(Object.entries(e).map(([k,v])=>[k,[].concat(v).join(',')]));return {iso:'BE',nutsVersion,source:'t.csv',entries,len:4,count:Object.keys(entries).length,multi:0,skipped:0};};
const applyP=(g,postal)=>{const r={};L.RES.forEach(c=>r[c]='');L.applyResult(r,g,CFG,NUTS,NAMES,postal);return r;};

test('RES : les deux colonnes du contrôle croisé existent, vides sans table',()=>{
  assert.ok(L.RES.includes('NUTS3_codepostal')&&L.RES.includes('controle_cp_nuts'));
  const r=applyP(G(),undefined);
  assert.equal(r.NUTS3_codepostal,'');assert.equal(r.controle_cp_nuts,'');assert.equal(r.statut,'OK');assert.doesNotMatch(r.controle,/table Eurostat/);
});

test('contrôle croisé : même NUTS 3 → confirmé, statut inchangé',()=>{
  const r=applyP(G(),{BE:tbl({'1000':['BE100']})});
  assert.equal(r.controle_cp_nuts,'OUI');assert.equal(r.NUTS3_codepostal,'BE100');
  assert.equal(r.statut,'OK');assert.equal(r.confiance,'HAUTE');assert.match(r.controle,/NUTS 3 confirmé par la table Eurostat des codes postaux/);
});

test('contrôle croisé : désaccord à millésime identique → A_VERIFIER / MOYENNE avec les deux codes',()=>{
  const r=applyP(G(),{BE:tbl({'1000':['BE242']})});                                  // le point est dans BE100
  assert.equal(r.controle_cp_nuts,'NON');assert.equal(r.statut,'A_VERIFIER');assert.equal(r.confiance,'MOYENNE');assert.equal(r.controle_manuel,'OUI');
  assert.match(r.controle,/NUTS 3 du point \(BE100\) ≠ NUTS 3 du code postal \(BE242\) : à vérifier/);
  assert.equal(r.NUTS3,'BE100');assert.equal(r.NUTS3_codepostal,'BE242');           // les deux valeurs restent visibles
});

test('contrôle croisé : point proche de la zone du code postal (≤ 10 km) → limitrophe, note seulement',()=>{
  const feat=(id,lon)=>({type:'Feature',properties:{NUTS_ID:id,NAME_LATN:id},geometry:{type:'Polygon',coordinates:[sq(lon,50.85,.1)]}});
  const N2=L.prepNuts([feat('BE100',4.35),feat('BE242',4.55),feat('BE211',5.5)]);           // BE242 à ~7 km du point, BE211 à ~60 km
  const ap=(id)=>{const r={};L.RES.forEach(c=>r[c]='');L.applyResult(r,G(),CFG,N2,NAMES,{BE:tbl({'1000':[id]})});return r;};
  const proche=ap('BE242');
  assert.equal(proche.controle_cp_nuts,'LIMITROPHE');assert.equal(proche.statut,'OK');assert.equal(proche.confiance,'HAUTE');
  assert.match(proche.controle,/à \d+(\.\d+)? km de celui-ci : code postal à cheval sur la limite/);
  assert.equal(ap('BE211').controle_cp_nuts,'NON');assert.equal(ap('BE211').statut,'A_VERIFIER');   // trop loin : toujours signalé
});

test('contrôle croisé : NUTS 3 voisin de la même région → A_VERIFIER, mention « même NUTS 2 »',()=>{
  const r=applyP(G(),{BE:tbl({'1000':['BE101']})});
  assert.equal(r.controle_cp_nuts,'MEME_NUTS2');assert.equal(r.statut,'A_VERIFIER');assert.match(r.controle,/même NUTS 2/);
});

test('contrôle croisé : millésimes différents → note seulement, le statut ne change pas',()=>{
  const r=applyP(G(),{BE:tbl({'1000':['BE242']},'2021')});
  assert.equal(r.controle_cp_nuts,'VERSION_DIFFERENTE');assert.equal(r.statut,'OK');assert.equal(r.confiance,'HAUTE');
  assert.match(r.controle,/millésimes différents, non concluant/);assert.match(r.controle,/NUTS 2024/);assert.match(r.controle,/NUTS 2021/);
  const inconnu=applyP(G(),{BE:tbl({'1000':['BE242']},'')});
  assert.equal(inconnu.statut,'OK');assert.match(inconnu.controle,/NUTS \?/);       // millésime de la table inconnu
});

test('contrôle croisé : code postal absent de la table → note, statut inchangé',()=>{
  const r=applyP(G(),{BE:tbl({'3000':['BE242']})});
  assert.equal(r.controle_cp_nuts,'CP_ABSENT');assert.equal(r.NUTS3_codepostal,'');assert.equal(r.statut,'OK');assert.match(r.controle,/absent de la table Eurostat/);
});

test('contrôle croisé : table d\'un autre pays ignorée ; le pays prime toujours',()=>{
  const autre=applyP(G(),{NL:{...tbl({'1000':['NL329']}),iso:'NL'}});
  assert.equal(autre.controle_cp_nuts,'');assert.equal(autre.statut,'OK');
  const pays=applyP(G({cc:'NL'}),{BE:tbl({'1000':['BE242']})});
  assert.equal(pays.statut,'PAYS_INCOHERENT');
});

test('contrôle croisé : repli sur le code postal trouvé quand le code saisi est absent',()=>{
  const r=applyP(G({cpIn:'1001',postcode:'1000'}),{BE:tbl({'1000':['BE100']})});
  assert.equal(r.controle_cp_nuts,'OUI');
});

test('contrôle croisé : un code postal à plusieurs NUTS 3 est confirmé si l\'un d\'eux correspond',()=>{
  const r=applyP(G(),{BE:tbl({'1000':['BE242','BE100']})});
  assert.equal(r.controle_cp_nuts,'OUI');assert.equal(r.NUTS3_codepostal,'BE242|BE100');
});

// --- mode sans géocodage : NUTS 3 déduit du code postal seul ---
const rp=(row,postal,cfg={defPays:'BE'},names=NAMES)=>{const r={...row};L.resolveByPostcode(r,M,cfg,names,postal);return r;};
const tb=(iso,entries,len=4,nutsVersion='2024')=>({iso,nutsVersion,source:'t',entries,len,count:Object.keys(entries).length,multi:0,skipped:0});

test('sans géocodage : un NUTS 3 → CP_SEUL, tous les niveaux et libellés, aucune position',()=>{
  const r=rp(row(),{BE:tb('BE',{'1000':'BE100'})});
  assert.equal(r.statut,'CP_SEUL');assert.equal(r.confiance,'MOYENNE');assert.equal(r.controle_manuel,'NON');
  assert.deepEqual([r.NUTS0,r.NUTS1,r.NUTS2,r.NUTS3],['BE','BE1','BE10','BE100']);
  assert.equal(r.NUTS3_nom,'Arr. de Bruxelles');assert.equal(r.NUTS_version,'2024');
  assert.equal(r.precision,'CODE_POSTAL_TABLE');assert.equal(r.controle_cp_nuts,'TABLE_SEULE');assert.equal(r.lat,'');
  assert.match(r.controle,/déduit du code postal seul/);
});

test('sans géocodage : plusieurs NUTS 3 → A_VERIFIER, seuls les niveaux communs sont renseignés',()=>{
  const r=rp(row(),{BE:tb('BE',{'1000':'BE211,BE212'})});
  assert.equal(r.statut,'A_VERIFIER');assert.equal(r.confiance,'FAIBLE');assert.equal(r.controle_manuel,'OUI');
  assert.deepEqual([r.NUTS0,r.NUTS1,r.NUTS2,r.NUTS3],['BE','BE2','BE21','']);assert.equal(r.NUTS3_codepostal,'BE211|BE212');
  const x=rp(row(),{BE:tb('BE',{'1000':'BE211,BE242'})});assert.deepEqual([x.NUTS1,x.NUTS2,x.NUTS3],['BE2','','']);
});

test('sans géocodage : échecs explicites (code manquant, pays inconnu, pas de table, code absent) → ECHEC_CP',()=>{
  const P={BE:tb('BE',{'1000':'BE100'})};
  assert.match(rp(row({CP:''}),P).controle,/code postal manquant/);
  assert.match(rp(row({Pays:'Atlantide'}),P).controle,/pays non reconnu/);
  assert.match(rp(row({Pays:'FR',CP:'75001'}),P).controle,/aucune table Eurostat importée pour FR/);
  assert.match(rp(row({Pays:'GB',CP:'SW1A 1AA'}),P).controle,/Royaume-Uni n'est pas dans les tables/);
  const abs=rp(row({CP:'9999'}),P);
  assert.equal(abs.statut,'ECHEC_CP');assert.equal(abs.confiance,'FAIBLE');assert.equal(abs.controle_manuel,'OUI');assert.match(abs.controle,/absent de la table/);
  assert.equal(abs.NUTS3,'');
});

test('sans géocodage : pays par défaut, code postal complété (fixCp) et repli sur les 4 chiffres (NL)',()=>{
  const nl=L.parsePostcodeTables("NUTS3;CODE\n'NL366';'3204 XD'\n").find(t=>t.iso==='NL');
  const r=rp(row({Pays:'',CP:'3204 ZZ'}),{NL:nl},{defPays:'NL'});
  assert.equal(r.statut,'CP_SEUL');assert.equal(r.NUTS3,'NL366');assert.match(r.controle,/4 premiers chiffres/);
  const fr=rp(row({Pays:'FR',CP:'1000'}),{FR:tb('FR',{'01000':'FRK21'},5)});
  assert.equal(fr.NUTS3,'FRK21');assert.match(fr.controle,/complété/);
});

test('sans géocodage : les colonnes de résultat précédentes sont effacées',()=>{
  const r=row({lat:50.8,NUTS3:'XX999',statut:'OK'});L.resolveByPostcode(r,M,{defPays:'BE'},NAMES,{BE:tb('BE',{'1000':'BE100'})});
  assert.equal(r.lat,'');assert.equal(r.NUTS3,'BE100');
});
