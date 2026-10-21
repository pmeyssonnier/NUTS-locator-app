// Contrôle de l'API VIES réelle (à lancer depuis un poste avec accès Internet) : node scripts/check-vies.mjs
// Vérifie : disponibilité, réponses attendues pour quelques numéros publics, en-têtes CORS (indispensables pour l'appel depuis le navigateur).
import {checkVat, VIES_ENDPOINT} from '../src/lib/vies.js';

// Pour tester un relais : node scripts/check-vies.mjs https://nuts-vies-proxy.xxx.workers.dev
const ENDPOINT = process.argv[2] || VIES_ENDPOINT;

const CASES = [
  ['IE6388047V', 'VALIDE', 'Google Ireland (numéro public)'],
  ['DE000000000', 'INVALIDE', 'numéro inexistant, format correct'],
  ['BE0999999999', 'INVALIDE', 'numéro inexistant, format correct'],
  ['DE12345', 'FORMAT_INVALIDE', 'rejeté localement'],
  ['GB123456789', 'HORS_VIES', 'rejeté localement']
];
let ko = 0;
const t0 = Date.now();
for (const [vat, expected, label] of CASES) {
  const r = await checkVat(vat, fetch, ENDPOINT);
  const good = r.status === expected || (r.status === 'SERVICE_INDISPONIBLE' && 'indispo');
  if (good !== true) ko++;
  console.log(`${good === true ? '✔' : good ? '?' : '✘'} ${vat.padEnd(14)} attendu ${expected.padEnd(16)} obtenu ${r.status.padEnd(20)} ${r.name || r.detail || ''}  — ${label}`);
  await new Promise(res => setTimeout(res, 400));
}
console.log(`Durée : ${((Date.now() - t0) / 1000).toFixed(1)} s`);
try {
  // requête réelle avec Origin : ce que voit le navigateur après le préflight
  const origin = 'https://pmeyssonnier.github.io', h = {Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type'};
  const o = await fetch(ENDPOINT, {method: 'OPTIONS', headers: h});
  const p = await fetch(ENDPOINT, {method: 'POST', headers: {Origin: origin, 'Content-Type': 'application/json'}, body: JSON.stringify({countryCode: 'IE', vatNumber: '6388047V'})});
  const a1 = o.headers.get('access-control-allow-origin'), a2 = p.headers.get('access-control-allow-origin');
  console.log(`CORS préflight OPTIONS : HTTP ${o.status}, Allow-Origin = ${a1 ?? '(absent)'}\nCORS réponse POST      : HTTP ${p.status}, Allow-Origin = ${a2 ?? '(absent)'}`);
  if (!a1 || !a2) { ko++; console.log("✘ Sans en-tête CORS, le navigateur bloquera l'appel : utiliser le relais (dossier worker/)."); }
} catch (e) { ko++; console.log('✘ Test CORS impossible :', e.message); }
process.exit(ko ? 1 : 0);
