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
