import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/vies-proxy.js';

const ORIGIN = 'https://pmeyssonnier.github.io', env = {ALLOWED_ORIGINS: ORIGIN + ', http://localhost:8123'};
const req = (method, body, origin = ORIGIN) => new Request('https://relay.example/', {method, headers: {Origin: origin, 'Content-Type': 'application/json'}, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)});
const withUpstream = async (impl, fn) => { const real = globalThis.fetch; globalThis.fetch = impl; try { return await fn(); } finally { globalThis.fetch = real; } };

test('préflight : 204 + en-têtes CORS', async () => {
  const r = await worker.fetch(req('OPTIONS'), env);
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('access-control-allow-origin'), ORIGIN);
  assert.match(r.headers.get('access-control-allow-headers'), /Content-Type/);
});

test('origine non autorisée : 403 sans appel VIES', async () => {
  const r = await withUpstream(async () => { throw new Error('ne doit pas être appelé'); }, () => worker.fetch(req('POST', {countryCode: 'BE', vatNumber: '0123456789'}, 'https://evil.example'), env));
  assert.equal(r.status, 403);
  assert.notEqual(r.headers.get('access-control-allow-origin'), 'https://evil.example');
});

test('POST valide : transmis à VIES, réponse + CORS', async () => {
  let seen;
  const r = await withUpstream(async (url, o) => { seen = {url, body: JSON.parse(o.body)}; return new Response(JSON.stringify({valid: true, name: 'ACME'}), {status: 200}); },
    () => worker.fetch(req('POST', {countryCode: 'be', vatNumber: '0123456789'}), env));
  assert.match(seen.url, /ec\.europa\.eu\/taxation_customs\/vies\/rest-api\/check-vat-number$/);
  assert.deepEqual(seen.body, {countryCode: 'BE', vatNumber: '0123456789'});
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('access-control-allow-origin'), ORIGIN);
  assert.deepEqual(await r.json(), {valid: true, name: 'ACME'});
});

test('entrées invalides et méthode : 400 / 405 sans appel VIES', async () => {
  const boom = async () => { throw new Error('ne doit pas être appelé'); };
  await withUpstream(boom, async () => {
    assert.equal((await worker.fetch(req('POST', 'pas du json'), env)).status, 400);
    assert.equal((await worker.fetch(req('POST', {countryCode: 'BELGIQUE', vatNumber: '1'}), env)).status, 400);
    assert.equal((await worker.fetch(req('POST', {countryCode: 'BE', vatNumber: '../x'}), env)).status, 400);
    assert.equal((await worker.fetch(req('GET'), env)).status, 405);
  });
});

test('VIES injoignable : 502 avec CORS ; erreur VIES relayée telle quelle', async () => {
  const r = await withUpstream(async () => { throw new Error('boom'); }, () => worker.fetch(req('POST', {countryCode: 'BE', vatNumber: '0123456789'}), env));
  assert.equal(r.status, 502);
  assert.equal(r.headers.get('access-control-allow-origin'), ORIGIN);
  const r2 = await withUpstream(async () => new Response('{"actionSucceed":false}', {status: 500}), () => worker.fetch(req('POST', {countryCode: 'BE', vatNumber: '0123456789'}), env));
  assert.equal(r2.status, 500);
});

test('ALLOWED_ORIGINS vide : tout refusé ; « * » : tout accepté', async () => {
  assert.equal((await worker.fetch(req('OPTIONS'), {})).headers.get('access-control-allow-origin'), 'null');
  assert.equal((await worker.fetch(req('OPTIONS'), {ALLOWED_ORIGINS: '*'})).headers.get('access-control-allow-origin'), '*');
});
