import test from 'node:test';
import assert from 'node:assert/strict';
import {mapPngName} from '../src/lib/mapmath.js';

const rows = [{NUTS3: 'BE100', NUTS2: 'BE10'}, {NUTS3: 'BE100', NUTS2: 'BE10'}];

test('zone sélectionnée : code complet dans le nom', () => assert.equal(mapPngName('BE100', null, rows, 3), 'carte_nuts_BE100.png'));
test('zone en minuscules / niveau 0-2', () => { assert.equal(mapPngName('be10', null, [], 2), 'carte_nuts_BE10.png'); assert.equal(mapPngName('BE', null, [], 0), 'carte_nuts_BE.png'); });
test('ligne sélectionnée : NUTS du niveau affiché', () => {
  assert.equal(mapPngName(null, {NUTS3: 'FR101', NUTS2: 'FR10'}, rows, 3), 'carte_nuts_FR101.png');
  assert.equal(mapPngName(null, {NUTS3: 'FR101', NUTS2: 'FR10'}, rows, 2), 'carte_nuts_FR10.png');
  assert.equal(mapPngName(null, {NUTS3: 'FR101'}, rows, 0), 'carte_nuts_FR101.png');   // pas de contours : NUTS 3
});
test('sans sélection : code unique commun aux lignes affichées', () => assert.equal(mapPngName(null, null, rows, 3), 'carte_nuts_BE100.png'));
test('plusieurs codes ou aucun : nom par défaut', () => {
  assert.equal(mapPngName(null, null, [{NUTS3: 'BE100'}, {NUTS3: 'FR101'}], 3), 'carte_nuts.png');
  assert.equal(mapPngName(null, null, [], 3), 'carte_nuts.png');
  assert.equal(mapPngName(undefined, undefined, undefined, undefined), 'carte_nuts.png');
});
test('caractères inattendus refusés (nom de fichier sûr)', () => assert.equal(mapPngName('../x', null, [], 3), 'carte_nuts.png'));
