// Contrôle de l'API VIES réelle (à lancer depuis un poste avec accès Internet) : node scripts/check-vies.mjs
// Vérifie : disponibilité, réponses attendues pour quelques numéros publics, en-têtes CORS (indispensables pour l'appel depuis le navigateur).
import {checkVat, VIES_ENDPOINT} from '../src/lib/vies.js';

const CASES = [
  ['DE143593636', 'VALIDE', 'SAP SE (numéro public)'],
  ['IE6388047V', 'VALIDE', 'Google Ireland (numéro public)'],
  ['DE000000000', 'INVALIDE', 'numéro inexistant, format correct'],
  ['BE0999999999', 'INVALIDE', 'numéro inexistant, format correct'],
  ['DE12345', 'FORMAT_INVALIDE', 'rejeté localement'],
  ['GB123456789', 'HORS_VIES', 'rejeté localement']
];
let ko = 0;
const t0 = Date.now();
for (const [vat, expected, label] of CASES) {
  const r = await checkVat(vat);
  const good = r.status === expected || (r.status === 'SERVICE_INDISPONIBLE' && 'indispo');
  if (good !== true) ko++;
  console.log(`${good === true ? '✔' : good ? '?' : '✘'} ${vat.padEnd(14)} attendu ${expected.padEnd(16)} obtenu ${r.status.padEnd(20)} ${r.name || r.detail || ''}  — ${label}`);
  await new Promise(res => setTimeout(res, 400));
}
console.log(`Durée : ${((Date.now() - t0) / 1000).toFixed(1)} s`);
try {
  const o = await fetch(VIES_ENDPOINT, {method: 'OPTIONS', headers: {Origin: 'https://pmeyssonnier.github.io', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type'}});
  const acao = o.headers.get('access-control-allow-origin');
  console.log(`CORS (préflight OPTIONS) : HTTP ${o.status}, Access-Control-Allow-Origin = ${acao ?? '(absent)'}`);
  if (!acao) { ko++; console.log('✘ Sans en-tête CORS, le navigateur bloquera l\'appel depuis la page : prévoir un petit proxy.'); }
} catch (e) { ko++; console.log('✘ Préflight impossible :', e.message); }
process.exit(ko ? 1 : 0);
