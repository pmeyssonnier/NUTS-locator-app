import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {VERSION, VERSION_DATE} from '../src/version.js';

test('version : src/version.js et package.json concordent, format x.y.z et date AAAA-MM-JJ',()=>{
  const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
  assert.equal(VERSION,pkg.version);
  assert.match(VERSION,/^\d+\.\d+\.\d+$/);assert.match(VERSION_DATE,/^\d{4}-\d{2}-\d{2}$/);
});

test('version : le pied de page prévoit son emplacement',()=>{
  assert.match(readFileSync(new URL('../index.html',import.meta.url),'utf8'),/<span id="ver"><\/span>/);
});
