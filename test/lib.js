'use strict';
// Charge la section « LIB » de index.html (fonctions pures, sans DOM) pour les tests Node.
// index.html reste un fichier autonome : rien n'est dupliqué, les tests exécutent le code livré.
const fs=require('node:fs'),path=require('node:path');
const file=path.join(__dirname,'..','index.html');
const html=fs.readFileSync(file,'utf8');
const a=html.indexOf('// ==== LIB'),b=html.indexOf('// ==== UI ====');
if(a<0||b<a)throw new Error('marqueurs « // ==== LIB » / « // ==== UI ==== » introuvables dans index.html');
const mod={exports:{}};
new Function('module','"use strict";\n'+html.slice(a,b))(mod);
module.exports=mod.exports;
