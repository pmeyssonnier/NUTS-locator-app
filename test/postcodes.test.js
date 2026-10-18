import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../src/lib/index.js';

// Format réel vérifié sur les tables Eurostat (voir les derniers tests) ; les premiers couvrent des variantes plausibles (autre séparateur, guillemets, sans en-tête…).

test('parseTableName : pays et millésime NUTS d\'après le nom Tercet',()=>{
  assert.deepEqual(L.parseTableName('pc2020_BE_NUTS-2021_v1.0.zip'),{iso:'BE',nutsVersion:'2021',pcYear:'2020'});
  assert.equal(L.parseTableName('pc2020_UK_NUTS-2021_v3.0.zip').iso,'GB');                  // UK → GB (comme isoOf)
  assert.equal(L.parseTableName('pc2023_EL_NUTS-2021_v1.0.csv').iso,'GR');
  assert.deepEqual(L.parseTableName('table.csv'),{iso:'',nutsVersion:'',pcYear:''});
  assert.deepEqual(L.parseTableName(null),{iso:'',nutsVersion:'',pcYear:''});
});

test('parsePostcodeTable : CSV à guillemets simples et séparateur « ; » (style Tercet)',()=>{
  const t=L.parsePostcodeTable("CODE;NUTS3\n'1000';'BE100'\n'1030';'BE100'\n'3000';'BE242'\n",'pc2020_BE_NUTS-2021_v1.0.csv');
  assert.equal(t.iso,'BE');assert.equal(t.nutsVersion,'2021');assert.equal(t.count,3);
  assert.deepEqual(t.entries,{'1000':'BE100','1030':'BE100','3000':'BE242'});
});

test('parsePostcodeTable : guillemets doubles, virgule, BOM, CRLF, casse',()=>{
  const t=L.parsePostcodeTable('﻿"postcode","nuts3"\r\n"1000","be100"\r\n"3000","BE242"\r\n','x.csv');
  assert.deepEqual(t.entries,{'1000':'BE100','3000':'BE242'});assert.equal(t.iso,'BE');      // pays déduit des codes NUTS
});

test('parsePostcodeTable : tabulation, sans en-tête, deux colonnes',()=>{
  const t=L.parsePostcodeTable('75001\tFR101\n75002\tFR101\n92400\tFR105\n');
  assert.equal(t.iso,'FR');assert.deepEqual(t.entries['92400'],'FR105');assert.equal(t.count,3);
});

test('parsePostcodeTable : colonnes supplémentaires, la colonne NUTS 3 est retrouvée par son contenu',()=>{
  const t=L.parsePostcodeTable('PC;COMMUNE;NUTS1;NUTS2;NUTS3\n1000;Bruxelles;BE1;BE10;BE100\n3000;Leuven;BE2;BE24;BE242\n');
  assert.deepEqual(t.entries,{'1000':'BE100','3000':'BE242'});
  const sansNom=L.parsePostcodeTable('1000;Bruxelles;BE1;BE10;BE100\n3000;Leuven;BE2;BE24;BE242\n');   // sans en-tête : NUTS 1 et 2 (3-4 car.) ignorés
  assert.deepEqual(sansNom.entries['3000'],'BE242');
});

test('parsePostcodeTable : code postal à plusieurs NUTS 3 (lignes répétées ou cellule multiple)',()=>{
  const t=L.parsePostcodeTable('CODE;NUTS3\n2000;BE211\n2000;BE212\n2100;BE211,BE213\n3000;BE242\n');
  assert.deepEqual(t.entries['2000'],'BE211,BE212');assert.deepEqual(t.entries['2100'],'BE211,BE213');
  assert.equal(t.multi,2);assert.equal(t.count,3);
  assert.deepEqual(L.parsePostcodeTable('CODE;NUTS3\n2000;BE211\n2000;BE211\n').entries['2000'],'BE211');   // doublons retirés
});

test('parsePostcodeTable : codes postaux normalisés (espaces, tirets, casse) et lignes inexploitables comptées',()=>{
  const t=L.parsePostcodeTables('CODE;NUTS3\n02-515;PL911\n5504 DR;nl414\nSW1Y 4PD;UKI32\n;PL911\nabc;\n');
  assert.deepEqual(t.map(x=>[x.iso,Object.keys(x.entries)]),[['GB',['SW1Y4PD']],['NL',['5504DR']],['PL',['02515']]]);assert.equal(t[0].skipped,2);
});

test('parsePostcodeTable : erreurs explicites',()=>{
  assert.throws(()=>L.parsePostcodeTable(''),/fichier vide/);
  assert.throws(()=>L.parsePostcodeTable('CODE;COMMUNE\n1000;Bruxelles\n'),/aucune colonne « NUTS 3 » reconnue/);
  assert.throws(()=>L.parsePostcodeTable('CODE;COMMUNE\n1000;Bruxelles\n'),/premières lignes/);               // le message montre ce qui a été lu
  assert.throws(()=>L.parsePostcodeTable('CODE;NUTS3\n;BE100\n'),/aucune ligne/);
});

test('parsePostcodeTable : pays UK et EL déduits des codes NUTS',()=>{
  assert.equal(L.parsePostcodeTable('CODE;NUTS3\nCV34LF;UKG33\n').iso,'GB');
  assert.equal(L.parsePostcodeTable('CODE;NUTS3\n10431;EL305\n').iso,'GR');
});

test('lookupPostcode : normalisation, repli à 4 chiffres pour NL et PT',()=>{
  const T=Object.fromEntries(L.parsePostcodeTables('CODE;NUTS3\n1000;BE100\n1096 BC;NL32B\n1096 BD;NL32B\n1097 AA;NL329\nSW1Y4PD;UKI32\n').map(x=>[x.iso,x]));
  assert.deepEqual(L.lookupPostcode(T.BE,'1000','BE'),['BE100']);
  assert.deepEqual(L.lookupPostcode(T.GB,' sw1y 4pd ','GB'),['UKI32']);
  assert.deepEqual(L.lookupPostcode(T.NL,'1096 BC','NL'),['NL32B']);                  // code complet
  assert.deepEqual(L.lookupPostcode(T.NL,'1096','NL'),['NL32B']);                     // 4 chiffres seuls : NUTS 3 des codes commençant par eux
  assert.deepEqual(L.lookupPostcode(T.NL,'1096 ZZ','NL'),['NL32B']);                  // code complet absent de la table : repli sur les 4 chiffres
  assert.equal(L.lookupPostcode(T.BE,'1096 BC','BE'),null);                           // pas de repli hors NL/PT
  assert.equal(L.lookupPostcode(T.BE,'9999','BE'),null);assert.equal(L.lookupPostcode(T.BE,'','BE'),null);assert.equal(L.lookupPostcode(null,'1000','BE'),null);
});

test('compareCpNuts : accord, même région, désaccord, millésime, absent',()=>{
  const C=L.compareCpNuts;
  assert.equal(C(['BE100'],'BE100','2021','2021'),'OUI');
  assert.equal(C(['BE211','BE212'],'BE212','2021','2021'),'OUI');                      // un code postal à plusieurs NUTS 3 : un seul suffit
  assert.equal(C(['BE211'],'BE212','2021','2021'),'MEME_NUTS2');
  assert.equal(C(['BE100'],'BE242','2021','2021'),'NON');
  assert.equal(C(['BE100'],'BE242','2021','2024'),'VERSION_DIFFERENTE');              // millésimes différents : non concluant
  assert.equal(C(['BE100'],'BE242','','2024'),'VERSION_DIFFERENTE');                  // millésime de la table inconnu : non concluant
  assert.equal(C(['NL329'],'NL329','2021','2024'),'OUI');                              // un accord reste un accord, même entre millésimes
  assert.equal(C(null,'BE100','2021','2021'),'CP_ABSENT');assert.equal(C([],'BE100','2021','2021'),'CP_ABSENT');
});

test('decide : désaccord avec la table des codes postaux → A_VERIFIER, MOYENNE au plus',()=>{
  const D=q=>L.decide({precise:true,niveau:'BATIMENT',paysKo:false,cpKo:false,exact:true,...q});
  assert.deepEqual(D({cpNutsKo:true}),{statut:'A_VERIFIER',confiance:'MOYENNE',controle_manuel:'OUI'});
  assert.equal(D({cpNutsKo:true,paysKo:true}).statut,'PAYS_INCOHERENT');
  assert.deepEqual(D({cpNutsKo:false}),{statut:'OK',confiance:'HAUTE',controle_manuel:'NON'});
});

test('format réel observé (pc2025_FR_NUTS-2024_v1.0.csv) : BOM, « NUTS3;CODE », apostrophes, NUTS en 1re colonne, fins de ligne mélangées',()=>{
  // texte reconstitué à l'image du fichier Eurostat (quelques lignes vérifiées sur le fichier réel), pas une copie du fichier
  const text="﻿NUTS3;CODE\r\n'FRF33';'57150'\r\n'FRK28';'74380'\n'FR105';'92400'\r\n'FR105';'92110'\r\n'FRJ23';'31700'\n'FRK21';'01000'\r\n'FRY40';'97400'\r\n";
  const t=L.parsePostcodeTable(text,'pc2025_FR_NUTS-2024_v1.0.csv');
  assert.equal(t.iso,'FR');assert.equal(t.nutsVersion,'2024');assert.equal(t.count,7);assert.equal(t.multi,0);assert.equal(t.skipped,0);
  assert.deepEqual(t.entries['92400'],'FR105');assert.deepEqual(t.entries['31700'],'FRJ23');
  assert.deepEqual(t.entries['01000'],'FRK21');                                   // le zéro initial est conservé (le code reste du texte)
  assert.deepEqual(L.lookupPostcode(t,'92 400','FR'),['FR105']);                    // les espaces saisis sont ignorés
  assert.equal(L.lookupPostcode(t,'1000','FR'),null);                               // « 1000 » (zéro perdu par Excel) n'est pas « 01000 » : à compléter avant (fixCp)
});

test('un code postal français complété par fixCp est retrouvé dans la table',()=>{
  const t=L.parsePostcodeTable("NUTS3;CODE\r\n'FRK21';'01000'\r\n",'pc2025_FR_NUTS-2024_v1.0.csv');
  const {cp}=L.fixCp('1000','FR');
  assert.deepEqual(L.lookupPostcode(t,cp,'FR'),['FRK21']);
});

test('fichier tous pays (PCODE_2025_NUTS-2024_v2.0) : une table par pays, d\'après le préfixe NUTS',()=>{
  const text="\uFEFFNUTS3;CODE\r\n'NL366';'3204 XD'\r\n'NL366';'3204 XE'\r\n'DE712';'60315'\r\n'LT001';'60315'\r\n'EL305';'11142'\r\n'PT170';'1000-001'\r\n'PT170';'1000-002'\r\n'IE061';'F12'\r\n'MT001';'MTP'\r\n'LV006';'LV-3124'\r\n";
  const tables=L.parsePostcodeTables(text,'PCODE_2025_NUTS-2024_v2.0.csv');
  assert.deepEqual(tables.map(t=>t.iso),['DE','GR','IE','LT','LV','MT','NL','PT']);          // EL → GR
  const T=Object.fromEntries(tables.map(t=>[t.iso,t]));
  assert.ok(tables.every(t=>t.nutsVersion==='2024'));
  assert.deepEqual(L.lookupPostcode(T.DE,'60315','DE'),['DE712']);assert.deepEqual(L.lookupPostcode(T.LT,'60315','LT'),['LT001']);   // même chaîne dans deux pays
  assert.deepEqual(L.lookupPostcode(T.NL,'3204xd','NL'),['NL366']);                          // PC6 : l'espace est ignoré
  assert.deepEqual(L.lookupPostcode(T.NL,'3204','NL'),['NL366']);
  assert.deepEqual(L.lookupPostcode(T.PT,'1000-001','PT'),['PT170']);assert.deepEqual(L.lookupPostcode(T.PT,'1000','PT'),['PT170']);   // 7 chiffres ou 4 chiffres
  assert.deepEqual(L.lookupPostcode(T.IE,'F12 X285','IE'),['IE061']);                         // Eircode → clé de routage à 3 caractères
  assert.deepEqual(L.lookupPostcode(T.MT,'MTP 1234','MT'),['MT001']);
  assert.deepEqual(L.lookupPostcode(T.LV,'LV-3124','LV'),['LV006']);assert.deepEqual(L.lookupPostcode(T.LV,'3124','LV'),null);
  assert.throws(()=>L.parsePostcodeTable(text),/plusieurs pays/);
  assert.deepEqual(L.parseTableName('PCODE_2025_NUTS-2024_v2.0.zip'),{iso:'',nutsVersion:'2024',pcYear:'2025'});
});
