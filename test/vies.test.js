import test from 'node:test';
import assert from 'node:assert/strict';
import {parseVat, checkVat, compareName, compareAddressParts, VAT_FORMATS, VIES_ENDPOINT} from '../src/lib/vies.js';

const reply = (body, ok = true, status = 200) => async () => ({ok, status, json: async () => body});

test('parseVat : nettoyage, majuscules, GR → EL', () => {
  assert.deepEqual(parseVat(' be 0123.456-789 '), {countryCode: 'BE', vatNumber: '0123456789', input: 'BE0123456789'});
  assert.equal(parseVat('GR123456789').countryCode, 'EL');
  assert.equal(parseVat('1234'), null);
  assert.equal(parseVat(null), null);
  assert.equal(parseVat('B'), null);
});

test('formats nationaux : exemples valides acceptés', () => {
  const ok = {AT: 'U12345678', BE: '0123456789', DE: '123456789', FR: 'AB123456789', ES: 'A1234567B', IT: '12345678901', NL: '123456789B01',
    PL: '1234567890', IE: '1234567FA', SE: '123456789001', LU: '12345678', XI: '123456789', CY: '12345678X', PT: '123456789'};
  for (const [c, n] of Object.entries(ok)) assert.ok(VAT_FORMATS[c].test(n), c + n);
  for (const [c, n] of Object.entries({DE: '12345678', NL: '123456789A01', AT: '123456789', PL: '123'})) assert.ok(!VAT_FORMATS[c].test(n), c + n);
});

test('checkVat : filtres locaux sans appel réseau', async () => {
  const boom = async () => { throw new Error('ne doit pas être appelé'); };
  assert.equal((await checkVat('abc', boom)).status, 'FORMAT_INVALIDE');
  assert.equal((await checkVat('DE12345', boom)).status, 'FORMAT_INVALIDE');
  assert.equal((await checkVat('GB123456789', boom)).status, 'HORS_VIES');
  assert.equal((await checkVat('CH123456789', boom)).status, 'HORS_VIES');
});

test('checkVat : numéro valide, appel POST correct, « --- » nettoyé', async () => {
  let call;
  const f = async (url, opts) => { call = {url, opts}; return {ok: true, status: 200, json: async () => ({valid: true, name: 'ACME SA', address: '---', requestDate: '2026-10-21T10:00:00Z', requestIdentifier: 'WAPIAAAA'})}; };
  const r = await checkVat('BE0123456789', f);
  assert.equal(call.url, VIES_ENDPOINT);
  assert.equal(call.opts.method, 'POST');
  assert.deepEqual(JSON.parse(call.opts.body), {countryCode: 'BE', vatNumber: '0123456789'});
  assert.equal(r.status, 'VALIDE');
  assert.equal(r.name, 'ACME SA');
  assert.equal(r.address, '');
  assert.equal(r.requestIdentifier, 'WAPIAAAA');
});

test('checkVat : invalide, indisponible, indéterminé, erreur réseau', async () => {
  assert.equal((await checkVat('FR12345678901', reply({valid: false, userError: 'INVALID'}))).status, 'INVALIDE');
  assert.equal((await checkVat('FR12345678901', reply({valid: false, userError: 'MS_UNAVAILABLE'}))).status, 'SERVICE_INDISPONIBLE');
  assert.equal((await checkVat('FR12345678901', reply({}, false, 500))).status, 'SERVICE_INDISPONIBLE');
  assert.equal((await checkVat('FR12345678901', reply({error: 'x'}))).status, 'INDETERMINE');
  const r = await checkVat('FR12345678901', async () => { throw new TypeError('Failed to fetch'); });
  assert.equal(r.status, 'SERVICE_INDISPONIBLE');
  assert.match(r.detail, /Failed to fetch/);
});

test('compareName / compareAddressParts', () => {
  assert.equal(compareName('Société Générale', 'SOCIETE GENERALE'), 'IDENTIQUE');
  assert.equal(compareName('Acme', 'ACME SA'), 'PARTIEL');
  assert.equal(compareName('Acme', 'Zeta'), 'DIFFERENT');
  assert.equal(compareName('', 'Zeta'), 'NON_DISPONIBLE');
  const off = 'RUE DE LA LOI 16\n1000 BRUXELLES';
  assert.equal(compareAddressParts(['Rue de la Loi 16', '1000', 'Bruxelles'], off), 'COHERENTE');
  assert.equal(compareAddressParts(['Rue de la Loi 16', '1040', 'Bruxelles'], off), 'PARTIELLE');
  assert.equal(compareAddressParts(['Autre', '2000'], off), 'A_VERIFIER');
  assert.equal(compareAddressParts([], off), 'NON_DISPONIBLE');
  assert.equal(compareAddressParts(['x'], ''), 'NON_DISPONIBLE');
});
