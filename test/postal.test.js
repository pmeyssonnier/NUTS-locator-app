'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const L=require('./lib');

test('isoOf : codes ISO, alias NUTS et noms de pays',()=>{
  assert.equal(L.isoOf('BE'),'BE');assert.equal(L.isoOf(' be '),'BE');
  assert.equal(L.isoOf('UK'),'GB');assert.equal(L.isoOf('EL'),'GR');
  for(const [nom,iso] of [['Belgique','BE'],['Deutschland','DE'],['Royaume-Uni','GB'],['Tchéquie','CZ'],['République tchèque','CZ'],['Espana','ES'],['Pays-Bas','NL']])
    assert.equal(L.isoOf(nom),iso,nom);
  assert.equal(L.isoOf('Atlantide'),'');assert.equal(L.isoOf(''),'');assert.equal(L.isoOf(null),'');
});

test('nuts0Of : GB→UK et GR→EL',()=>{
  assert.equal(L.nuts0Of('GB'),'UK');assert.equal(L.nuts0Of('GR'),'EL');assert.equal(L.nuts0Of('BE'),'BE');
});

test('ccOf / ccList : territoires rattachés à leur pays NUTS0',()=>{
  for(const c of ['gp','GP','mq','gf','re','yt'])assert.equal(L.ccOf(c),'FR',c);
  assert.equal(L.ccOf('ax'),'FI');assert.equal(L.ccOf('be'),'BE');assert.equal(L.ccOf(''),'');
  assert.equal(L.ccList('FR'),'fr,gp,mq,gf,re,yt');assert.equal(L.ccList('FI'),'fi,ax');assert.equal(L.ccList('BE'),'be');
});

test('cc : paramètres pays pour Nominatim quand l\'ISO est inconnu',()=>{
  assert.deepEqual(L.cc('BE'),{countrycodes:'be'});assert.deepEqual(L.cc('uk'),{countrycodes:'gb'});assert.deepEqual(L.cc('el'),{countrycodes:'gr'});
  assert.deepEqual(L.cc('Atlantide'),{country:'Atlantide'});assert.deepEqual(L.cc(''),{});
});

test('streetOf : numéro avant la rue en FR/GB/IE/LU, après ailleurs',()=>{
  assert.equal(L.streetOf('Rue de la Paix','12','FR'),'12 Rue de la Paix');
  assert.equal(L.streetOf('Abbey Road','7','GB'),'7 Abbey Road');
  assert.equal(L.streetOf('Brouwerijplein','1','BE'),'Brouwerijplein 1');
  assert.equal(L.streetOf('Rue X','','FR'),'Rue X');assert.equal(L.streetOf('','5','BE'),'5');
});

test('fixCp : zéros initiaux perdus par Excel',()=>{
  assert.deepEqual(L.fixCp('13329','RO'),{cp:'013329',note:'CP 13329 complété en 013329'});
  assert.equal(L.fixCp('2515','PL').cp,'02-515');
  assert.equal(L.fixCp('1000','FR').cp,'01000');
  assert.deepEqual(L.fixCp('1030','BE'),{cp:'1030',note:''});     // pays sans règle
  assert.equal(L.fixCp('75001','FR').cp,'75001');                  // déjà complet
  assert.equal(L.fixCp('SW1Y','GB').cp,'SW1Y');                    // non numérique
});

test('cpMatch : identique, préfixe, voisin, différent, absent',()=>{
  assert.equal(L.cpMatch('BE','1030','1030'),true);
  assert.equal(L.cpMatch('BE','1030',''),null);assert.equal(L.cpMatch('BE','','1030'),null);
  assert.equal(L.cpMatch('BE','1030','1210'),false);
  assert.equal(L.cpMatch('BE','1030','1040'),false);              // 4 chiffres : pas de « voisin »
  assert.equal(L.cpMatch('ES','15143','15142'),'near');
  assert.equal(L.cpMatch('RO','400027','400029'),'near');
  assert.equal(L.cpMatch('GB','SW1Y 4PD','SW1Y 4LE'),true);       // même district
  assert.equal(L.cpMatch('GB','CV3 4LF','CV1 1LL'),false);
  assert.equal(L.cpMatch('GB','M1 1AA','M1 2BB'),true);
  assert.equal(L.cpMatch('NL','5504 DR','5504 XX'),true);         // NL : 4 chiffres seulement
  assert.equal(L.cpMatch('PL','02-515','02515'),true);            // séparateurs ignorés
});

test('niveauOf : niveau réel du résultat Nominatim',()=>{
  assert.equal(L.niveauOf(30,'building'),'BATIMENT');assert.equal(L.niveauOf(28,''),'BATIMENT');
  assert.equal(L.niveauOf(26,'road'),'RUE');assert.equal(L.niveauOf(27,''),'RUE');
  assert.equal(L.niveauOf(20,'suburb'),'LOCALITE');assert.equal(L.niveauOf(17,''),'LOCALITE');
  assert.equal(L.niveauOf(16,'city'),'VILLE_OU_PLUS');
  assert.equal(L.niveauOf(21,'postcode'),'CODE_POSTAL');assert.equal(L.niveauOf(0,''),'INCONNU');
});

test('stripAbbr : retire les abréviations de type de voie',()=>{
  assert.equal(L.stripAbbr('ul. Chemików 7'),'Chemików 7');
  assert.equal(L.stripAbbr('Bd. Anspach 12'),'Anspach 12');
  assert.equal(L.stripAbbr("1 St James's Square"),"1 St James's Square");
  assert.equal(L.stripAbbr('Strada Uzinei 1'),'Strada Uzinei 1');
});

test('decide : statut et confiance',()=>{
  const D=q=>L.decide({precise:true,niveau:'BATIMENT',paysKo:false,cpKo:false,cpNear:false,exact:true,...q});
  assert.deepEqual(D({}),{statut:'OK',confiance:'HAUTE',controle_manuel:'NON'});
  assert.deepEqual(D({niveau:'RUE'}),{statut:'OK',confiance:'MOYENNE',controle_manuel:'OUI'});
  assert.deepEqual(D({niveau:'INCONNU'}),{statut:'OK',confiance:'MOYENNE',controle_manuel:'OUI'});
  assert.equal(D({niveau:'VILLE_OU_PLUS'}).statut,'A_VERIFIER');
  assert.equal(D({niveau:'LOCALITE'}).confiance,'FAIBLE');
  assert.deepEqual(D({precise:false}),{statut:'A_VERIFIER',confiance:'FAIBLE',controle_manuel:'OUI'});
  assert.equal(D({cpNear:true}).confiance,'MOYENNE');
  assert.equal(D({cpKo:true}).statut,'A_VERIFIER');
  assert.equal(D({exact:false}).statut,'NUTS_PROCHE');assert.equal(D({exact:false}).confiance,'MOYENNE');
  assert.deepEqual(D({paysKo:true}),{statut:'PAYS_INCOHERENT',confiance:'FAIBLE',controle_manuel:'OUI'});
  assert.equal(D({paysKo:true,cpKo:true,exact:false}).statut,'PAYS_INCOHERENT');   // le pays prime
});
