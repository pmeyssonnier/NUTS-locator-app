import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreRow, scoreGlobal, scoreTva, grade, WEIGHTS} from '../src/lib/quality.js';

const COLS = ['adr', 'cp', 'ville', 'pays'];
const full = {adr: 'x', cp: '1', ville: 'v', pays: 'BE'};

test('poids : somme 100', () => assert.equal(Object.values(WEIGHTS).reduce((a, b) => a + b), 100));

test('ligne parfaite = 100', () => {
  assert.equal(scoreRow({...full, statut: 'OK', controle_cp_nuts: 'OUI', VIES_statut: 'VALIDE', VIES_coherence_nom: 'IDENTIQUE', VIES_coherence_adresse: 'COHERENTE'}, COLS), 100);
});

test('ligne en échec = 0 sur géocodage, CP et TVA', () => {
  assert.equal(scoreRow({adr: '', cp: '', ville: '', pays: '', statut: 'ECHEC_GEOCODAGE', controle_cp_nuts: 'NON', VIES_statut: 'INVALIDE'}, COLS), 0);
});

test('dimensions non évaluables ignorées et poids renormalisés', () => {
  assert.equal(scoreRow({...full, statut: 'OK'}, COLS), 100);                       // ni CP ni TVA
  assert.equal(scoreRow({...full, statut: 'A_VERIFIER'}, COLS), Math.round((15 + 40 * .5) / 55 * 100));
  assert.equal(scoreRow({}, []), null);                                              // rien d'évaluable
  assert.equal(scoreRow({...full, controle_cp_nuts: 'SANS_TABLE'}, COLS), 100);     // SANS_TABLE ignoré
});

test('TVA : incohérences pénalisent, indisponibilité ignorée', () => {
  assert.equal(scoreTva({VIES_statut: 'VALIDE', VIES_coherence_nom: 'DIFFERENT', VIES_coherence_adresse: 'A_VERIFIER'}), 0.5);
  assert.equal(scoreTva({VIES_statut: 'VALIDE', VIES_coherence_nom: 'NON_DISPONIBLE'}), 1);
  assert.equal(scoreTva({VIES_statut: 'SERVICE_INDISPONIBLE'}), null);
  assert.equal(scoreTva({VIES_statut: 'HORS_VIES'}), null);
  assert.equal(scoreTva({VIES_statut: 'FORMAT_INVALIDE'}), 0);
});

test('score global : moyenne par dimension puis pondération', () => {
  const rows = [
    {...full, statut: 'OK', controle_cp_nuts: 'OUI', VIES_statut: 'VALIDE'},
    {...full, statut: 'ECHEC_GEOCODAGE', controle_cp_nuts: 'NON', VIES_statut: 'INVALIDE'}
  ];
  const g = scoreGlobal(rows, COLS);
  assert.deepEqual([g.dims.completude.score, g.dims.geocodage.score, g.dims.codepostal.score, g.dims.tva.score], [100, 50, 50, 50]);
  assert.equal(g.score, Math.round((100 * 15 + 50 * 40 + 50 * 25 + 50 * 20) / 100));
  assert.equal(g.score, 58);
  assert.equal(g.grade, 'D');
  assert.equal(g.n, 2);
});

test('score global vide et notes', () => {
  assert.equal(scoreGlobal([], COLS).score, null);
  assert.deepEqual([95, 80, 65, 45, 10, null].map(grade), ['A', 'B', 'C', 'D', 'E', '—']);
});
