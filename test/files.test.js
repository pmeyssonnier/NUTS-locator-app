import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';
const __dirname=path.dirname(fileURLToPath(import.meta.url));
import * as L from '../src/lib/index.js';

const buf=u8=>u8.buffer.slice(u8.byteOffset,u8.byteOffset+u8.byteLength);

test('parseCSV : séparateur détecté, guillemets, CRLF, retours à la ligne dans un champ',()=>{
  assert.deepEqual(L.parseCSV('a;b;c\r\n1;2;3\r\n'),[['a','b','c'],['1','2','3']]);
  assert.deepEqual(L.parseCSV('a,b\n1,2'),[['a','b'],['1','2']]);
  assert.deepEqual(L.parseCSV('a\tb\n1\t2'),[['a','b'],['1','2']]);
  assert.deepEqual(L.parseCSV('a;b\n"x;y";"he said ""hi"""\n'),[['a','b'],['x;y','he said "hi"']]);
  assert.deepEqual(L.parseCSV('a;b\n"l1\nl2";z\n'),[['a','b'],['l1\nl2','z']]);
});

test('decodeText : UTF-8, repli Windows-1252, BOM retiré',()=>{
  const utf8=new TextEncoder().encode('Société;Zażółć');
  assert.equal(L.decodeText(buf(utf8)),'Société;Zażółć');
  assert.equal(L.decodeText(buf(Uint8Array.from([0xEF,0xBB,0xBF,0x41]))),'A');
  assert.equal(L.decodeText(buf(Uint8Array.from([0x53,0x6F,0x63,0x69,0xE9,0x74,0xE9]))),'Société');   // latin-1 / cp1252
});

test('crc32 : valeur de référence',()=>{
  assert.equal(L.crc32(new TextEncoder().encode('123456789')),0xCBF43926);
});

test('xmlEsc / xmlUnesc : aller-retour, caractères de contrôle retirés',()=>{
  const s='A & B <c> "d" \'e\'';
  assert.equal(L.xmlUnesc(L.xmlEsc(s)),s);
  assert.equal(L.xmlEsc('a\u0001b'),'ab');
  assert.equal(L.xmlUnesc('&#x41;&#66;&amp;lt;'),'AB&lt;');
});

test('colIdx / colName : colonnes Excel',()=>{
  for(const [n,i] of [['A',0],['Z',25],['AA',26],['AZ',51],['BA',52],['ZZ',701],['AAA',702]]){
    assert.equal(L.colIdx(n),i,n);assert.equal(L.colName(i),n,String(i));
  }
});

test('buildXlsx → readXlsx : aller-retour (accents, XML, nombres, cellules vides)',async()=>{
  const headers=['Société','Adresse','N°','Note'];
  const rows=[['Ça & Co','Rue <1> "x"',12,''],['Zażółć','',3.5,'ok'],['','a\nb',0,'z']];
  const blob=L.buildXlsx(headers,rows,'Test');
  const grid=await L.readXlsx(await blob.arrayBuffer());
  assert.deepEqual(grid[0],headers);
  // les cellules vides ne sont pas écrites : une cellule vide finale disparaît (loadGrid complète avec r[i]??'')
  const pad=r=>headers.map((_,i)=>String(r[i]??''));
  assert.deepEqual(grid.slice(1).map(pad),[['Ça & Co','Rue <1> "x"','12',''],['Zażółć','','3.5','ok'],['','a\nb','0','z']]);
});

test('readXlsx : fichier d\'exemple du dépôt (27 sociétés, 7 colonnes)',async()=>{
  const f=fs.readFileSync(path.join(__dirname,'..','exemples','exemple_societes_europe.xlsx'));
  const grid=await L.readXlsx(buf(f));
  assert.deepEqual(grid[0],['Société','Nom','Prénom','Adresse','Code postal','Ville','Pays']);
  assert.equal(grid.length,28);
  assert.deepEqual(grid[1].slice(0,1).concat(grid[1].slice(4)),['AB InBev','3000','Leuven','BE']);
  assert.ok(grid.every(r=>r.length===7));
});

test('SAMPLE (exemple intégré) : cohérent avec le fichier d\'exemple du dépôt',async()=>{
  const f=fs.readFileSync(path.join(__dirname,'..','exemples','exemple_societes_europe.xlsx'));
  const grid=await L.readXlsx(buf(f));
  assert.deepEqual(grid,L.SAMPLE);
});

// ZIP minimal avec entrées compressées (deflate), comme le produit Excel
function zipDeflate(files){
  const parts=[],cent=[];let off=0;
  for(const [name,text] of Object.entries(files)){
    const nm=Buffer.from(name),raw=Buffer.from(text),def=zlib.deflateRawSync(raw);
    const lh=Buffer.alloc(30);lh.writeUInt32LE(0x04034b50,0);lh.writeUInt16LE(20,4);lh.writeUInt16LE(8,8);
    lh.writeUInt32LE(def.length,18);lh.writeUInt32LE(raw.length,22);lh.writeUInt16LE(nm.length,26);
    parts.push(lh,nm,def);
    const ch=Buffer.alloc(46);ch.writeUInt32LE(0x02014b50,0);ch.writeUInt16LE(8,10);
    ch.writeUInt32LE(def.length,20);ch.writeUInt32LE(raw.length,24);ch.writeUInt16LE(nm.length,28);ch.writeUInt32LE(off,42);
    cent.push(ch,nm);off+=30+nm.length+def.length;
  }
  const cd=Buffer.concat(cent),e=Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50,0);e.writeUInt16LE(Object.keys(files).length,8);e.writeUInt16LE(Object.keys(files).length,10);
  e.writeUInt32LE(cd.length,12);e.writeUInt32LE(off,16);
  return buf(Buffer.concat([...parts,cd,e]));
}

test('readXlsx : fichier compressé, chaînes partagées, dates, 2e feuille ignorée',async()=>{
  const NS='http://schemas.openxmlformats.org';
  const z=zipDeflate({
    'xl/workbook.xml':`<workbook xmlns="${NS}/spreadsheetml/2006/main" xmlns:r="${NS}/officeDocument/2006/relationships"><sheets><sheet name="A" sheetId="1" r:id="rId7"/><sheet name="B" sheetId="2" r:id="rId8"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':`<Relationships><Relationship Id="rId7" Target="worksheets/sheet3.xml"/><Relationship Id="rId8" Target="worksheets/sheet4.xml"/></Relationships>`,
    'xl/sharedStrings.xml':`<sst><si><t>Nom</t></si><si><t>Date</t></si><si><r><t>Ça </t></r><r><t>&amp; Cie</t></r></si></sst>`,
    'xl/styles.xml':`<styleSheet><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>`,
    'xl/worksheets/sheet3.xml':`<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" s="1"><v>45000</v></c><c r="D2"><v>7</v></c></row></sheetData></worksheet>`,
    'xl/worksheets/sheet4.xml':`<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>autre feuille</t></is></c></row></sheetData></worksheet>`
  });
  const grid=await L.readXlsx(z);
  assert.deepEqual(grid,[['Nom','Date'],['Ça & Cie','2023-03-15','','7']]);
});

test('readXlsx : fichier invalide',async()=>{
  await assert.rejects(()=>L.readXlsx(buf(Buffer.from('pas un zip'))),/ZIP\/XLSX invalide/);
});

test('csvCell : décimale française, formules neutralisées, guillemets',()=>{
  assert.equal(L.csvCell(50.8503),'50,8503');assert.equal(L.csvCell(0),'0');
  assert.equal(L.csvCell('=1+1'),"'=1+1");assert.equal(L.csvCell('@x'),"'@x");assert.equal(L.csvCell('+32 2 123'),"'+32 2 123");
  assert.equal(L.csvCell('-12'),'-12');assert.equal(L.csvCell('-1,5'),'-1,5');   // vrais nombres négatifs conservés
  assert.equal(L.csvCell('a;b'),'"a;b"');assert.equal(L.csvCell('il dit "oui"'),'"il dit ""oui"""');
  assert.equal(L.csvCell('l1\nl2'),'"l1\nl2"');assert.equal(L.csvCell(null),'');assert.equal(L.csvCell(undefined),'');
});

// ---------- Feuilles multiples ----------
const NSX='http://schemas.openxmlformats.org';
const sheetXml=rows=>`<worksheet><sheetData>${rows.map((r,i)=>`<row r="${i+1}">${r.map((v,c)=>v===''?'':`<c r="${L.colName(c)}${i+1}" t="inlineStr"><is><t>${L.xmlEsc(v)}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`;
// classeur de test : [{name, rows, state?}]
function workbook(sheets){
  const files={
    'xl/workbook.xml':`<workbook xmlns="${NSX}/spreadsheetml/2006/main" xmlns:r="${NSX}/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${L.xmlEsc(s.name)}" sheetId="${i+1}"${s.state?` state="${s.state}"`:''} r:id="rId${i+10}"/>`).join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':`<Relationships>${sheets.map((s,i)=>`<Relationship Id="rId${i+10}" Target="worksheets/s${i+1}.xml"/>`).join('')}</Relationships>`
  };
  sheets.forEach((s,i)=>{files[`xl/worksheets/s${i+1}.xml`]=sheetXml(s.rows);});
  return zipDeflate(files);
}

test('readXlsxBook : liste des feuilles, état masqué, noms avec caractères spéciaux',async()=>{
  const book=await L.readXlsxBook(workbook([
    {name:'Clients & Cie',rows:[['A'],['1']]},{name:'Archive',state:'hidden',rows:[['A'],['2']]},{name:'Très caché',state:'veryHidden',rows:[['A'],['3']]},{name:'Avril 2026',rows:[['A'],['4']]}
  ]));
  assert.deepEqual(book.sheets,[
    {i:0,name:'Clients & Cie',hidden:false},{i:1,name:'Archive',hidden:true},{i:2,name:'Très caché',hidden:true},{i:3,name:'Avril 2026',hidden:false}]);
  assert.equal(L.firstVisible(book.sheets),0);
});

test('readXlsxBook.read : chaque feuille se lit par son index',async()=>{
  const book=await L.readXlsxBook(workbook([
    {name:'S1',rows:[['Nom','Ville'],['Peeters','Leuven']]},{name:'S2',rows:[['Nom','Ville'],['Dubois','Bruxelles'],['Janssens','Gent']]}]));
  assert.deepEqual(await book.read(0),[['Nom','Ville'],['Peeters','Leuven']]);
  assert.equal((await book.read(1)).length,3);
  await assert.rejects(()=>book.read(5),/feuille 5 introuvable/);
});

test('readXlsx : sans index, première feuille visible (une feuille masquée en tête est sautée)',async()=>{
  const z=workbook([{name:'Calculs',state:'hidden',rows:[['x'],['cachée']]},{name:'Données',rows:[['y'],['visible']]}]);
  assert.deepEqual(await L.readXlsx(z),[['y'],['visible']]);
  assert.deepEqual(await L.readXlsx(z,0),[['x'],['cachée']]);       // lecture explicite d'une feuille masquée
  assert.equal(L.firstVisible([{i:0,hidden:true},{i:1,hidden:true}]),0);   // tout masqué : la première
});

test('readXlsxBook : feuille déclarée mais absente du fichier',async()=>{
  const z=zipDeflate({
    'xl/workbook.xml':`<workbook xmlns:r="${NSX}/officeDocument/2006/relationships"><sheets><sheet name="Fantôme" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':`<Relationships><Relationship Id="rId1" Target="worksheets/absente.xml"/></Relationships>`});
  const book=await L.readXlsxBook(z);
  await assert.rejects(()=>book.read(0),/feuille « Fantôme » introuvable/);
});

test('mergeSheets : colonnes alignées par nom, union, colonne « Feuille » à la fin',()=>{
  const out=L.mergeSheets([
    {name:'BE',grid:[['Société','Ville'],['AB InBev','Leuven']]},
    {name:'FR',grid:[['Ville','Société','Pays'],['Paris','Airbus','FR'],['Lyon','Sanofi','FR']]}]);
  assert.deepEqual(out,[
    ['Société','Ville','Pays','Feuille'],
    ['AB InBev','Leuven','','BE'],
    ['Airbus','Paris','FR','FR'],
    ['Sanofi','Lyon','FR','FR']]);
});

test('mergeSheets : feuilles vides ou sans données ignorées, lignes vides retirées',()=>{
  const out=L.mergeSheets([
    {name:'Vide',grid:[]},{name:'Entête seul',grid:[['A','B']]},{name:'Blanc',grid:[['',''],['','']]},
    {name:'OK',grid:[['A','B'],['',''],['1','2']]}]);
  assert.deepEqual(out,[['A','B','Feuille'],['1','2','OK']]);
  assert.deepEqual(L.mergeSheets([]),[['Feuille']]);
});

test('mergeSheets : en-têtes en double, en-tête vide et collision avec « Feuille »',()=>{
  const out=L.mergeSheets([{name:'X',grid:[['Nom','Nom','','Feuille'],['a','b','c','d']]}]);
  assert.deepEqual(out,[['Nom','Nom_2','Col_3','Feuille','Feuille_'],['a','b','c','d','X']]);
});

test('mergeSheets : valeurs numériques conservées, cellules absentes vides',()=>{
  const out=L.mergeSheets([{name:'N',grid:[['Code','Montant'],['1000']]}]);
  assert.deepEqual(out,[['Code','Montant','Feuille'],['1000','','N']]);
});

test('exemple multi-feuilles du dépôt : 3 feuilles dont une masquée, fusion des 2 visibles',async()=>{
  const f=fs.readFileSync(path.join(__dirname,'..','exemples','exemple_multi_feuilles.xlsx'));
  const book=await L.readXlsxBook(buf(f));
  assert.deepEqual(book.sheets.map(s=>[s.name,s.hidden]),[['Belgique',false],['France & DOM',false],['Brouillon',true]]);
  const merged=L.mergeSheets(await Promise.all(book.sheets.filter(s=>!s.hidden).map(async s=>({name:s.name,grid:await book.read(s.i)}))));
  assert.deepEqual(merged[0],['Société','Adresse','Code postal','Ville','Pays','Feuille']);
  assert.equal(merged.length,6);
  assert.deepEqual(merged[3],['TotalEnergies','2 Place Jean Millier','92400','Courbevoie','FR','France & DOM']);
});
