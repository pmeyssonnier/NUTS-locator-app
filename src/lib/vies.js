// Contrôle de numéros de TVA intracommunautaires via l'API REST VIES (Commission européenne). Aucune clé requise.
import {norm} from './util.js';

export const VIES_ENDPOINT = 'https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number';

// Formats nationaux (partie après le préfixe pays) : filtre local avant tout appel réseau.
export const VAT_FORMATS = {
  AT: /^U\d{8}$/, BE: /^[01]?\d{9}$/, BG: /^\d{9,10}$/, CY: /^\d{8}[A-Z]$/, CZ: /^\d{8,10}$/,
  DE: /^\d{9}$/, DK: /^\d{8}$/, EE: /^\d{9}$/, EL: /^\d{9}$/, ES: /^[A-Z0-9]\d{7}[A-Z0-9]$/,
  FI: /^\d{8}$/, FR: /^[A-Z0-9]{2}\d{9}$/, HR: /^\d{11}$/, HU: /^\d{8}$/,
  IE: /^(\d{7}[A-Z]{1,2}|\d[A-Z+*]\d{5}[A-Z])$/, IT: /^\d{11}$/, LT: /^(\d{9}|\d{12})$/, LU: /^\d{8}$/,
  LV: /^\d{11}$/, MT: /^\d{8}$/, NL: /^\d{9}B\d{2}$/, PL: /^\d{10}$/, PT: /^\d{9}$/, RO: /^\d{2,10}$/,
  SE: /^\d{12}$/, SI: /^\d{8}$/, SK: /^\d{10}$/, XI: /^(\d{9}|\d{12}|GD\d{3}|HA\d{3})$/
};

export function parseVat(raw) {
  const clean = String(raw ?? '').toUpperCase().replace(/[\s.\-]/g, '');
  const match = /^([A-Z]{2})([A-Z0-9+*]{2,14})$/.exec(clean);
  if (!match) return null;
  return {countryCode: match[1] === 'GR' ? 'EL' : match[1], vatNumber: match[2], input: clean};
}

export async function checkVat(raw, fetcher = fetch) {
  const parsed = parseVat(raw);
  if (!parsed) return {input: raw, status: 'FORMAT_INVALIDE', detail: 'préfixe pays (2 lettres) + numéro attendus'};
  if (parsed.countryCode === 'GB') return {input: raw, status: 'HORS_VIES', detail: 'GB hors VIES ; utiliser XI pour les cas éligibles en Irlande du Nord'};
  const fmt = VAT_FORMATS[parsed.countryCode];
  if (!fmt) return {input: raw, status: 'HORS_VIES', detail: 'pays ' + parsed.countryCode + ' non couvert par VIES'};
  if (!fmt.test(parsed.vatNumber)) return {input: raw, status: 'FORMAT_INVALIDE', detail: 'format incompatible avec ' + parsed.countryCode};
  try {
    const response = await fetcher(VIES_ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({countryCode: parsed.countryCode, vatNumber: parsed.vatNumber}),
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) return {input: raw, status: 'SERVICE_INDISPONIBLE', detail: 'HTTP ' + response.status};
    const data = await response.json();
    if (typeof data.valid !== 'boolean') return {input: raw, status: 'INDETERMINE', detail: data.userError || data.error || 'Réponse VIES inattendue'};
    // userError renseigné avec valid=false = erreur de service (MS_UNAVAILABLE, TIMEOUT…), pas un numéro invalide
    if (!data.valid && /UNAVAILABLE|TIMEOUT|BUSY|ERROR/i.test(data.userError || ''))
      return {input: raw, status: 'SERVICE_INDISPONIBLE', detail: data.userError};
    return {
      input: raw, status: data.valid ? 'VALIDE' : 'INVALIDE',
      name: clean(data.name), address: clean(data.address),
      checkedAt: data.requestDate || new Date().toISOString(),
      requestIdentifier: data.requestIdentifier || ''
    };
  } catch (error) {
    return {input: raw, status: 'SERVICE_INDISPONIBLE', detail: error?.message || String(error)};
  }
}
// VIES renvoie « --- » quand l'État membre ne communique pas le nom / l'adresse
const clean = v => { const s = String(v ?? '').replace(/\s+/g, ' ').trim(); return /^-+$/.test(s) ? '' : s; };

const compact = s => norm(String(s ?? '')).replace(/[^a-z0-9]/g, '');
export function compareName(a, b) {
  const x = compact(a), y = compact(b);
  if (!x || !y) return 'NON_DISPONIBLE';
  return x === y ? 'IDENTIQUE' : x.includes(y) || y.includes(x) ? 'PARTIEL' : 'DIFFERENT';
}
// pieces : valeurs saisies (rue, code postal, ville…) à retrouver dans l'adresse officielle
export function compareAddressParts(pieces, official) {
  const parts = pieces.filter(Boolean);
  if (!official || !parts.length) return 'NON_DISPONIBLE';
  const text = compact(official), hits = parts.filter(p => text.includes(compact(p))).length;
  return hits === parts.length ? 'COHERENTE' : hits ? 'PARTIELLE' : 'A_VERIFIER';
}
