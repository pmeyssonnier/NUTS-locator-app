// Score global de qualité des données (0–100) : moyenne pondérée de quatre dimensions.
// Une dimension sans ligne évaluable est ignorée et les poids restants sont renormalisés.
export const WEIGHTS = {completude: 15, geocodage: 40, codepostal: 25, tva: 20};
export const LABELS = {completude: 'Complétude des adresses', geocodage: 'Géocodage / NUTS', codepostal: 'Cohérence code postal ↔ NUTS', tva: 'Numéros de TVA (VIES)'};

const GEO = {OK: 1, CP_SEUL: .9, NUTS_PROCHE: .8, A_VERIFIER: .5, PAYS_INCOHERENT: .25};
const CP = {OUI: 1, LIMITROPHE: .8, MEME_NUTS2: .6, VERSION_DIFFERENTE: .6, NON: 0, CP_ABSENT: 0};
const COH = {DIFFERENT: .3, A_VERIFIER: .2, PARTIEL: .1, PARTIELLE: .1};

const has = v => v !== undefined && v !== null && String(v).trim() !== '';
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;

// Chaque fonction renvoie un nombre 0..1, ou null si la ligne n'est pas évaluable pour cette dimension.
export const scoreCompletude = (r, cols) => { const c = cols.filter(Boolean); return c.length ? c.filter(k => has(r[k])).length / c.length : null; };
export const scoreGeocodage = r => has(r.statut) ? (GEO[r.statut] ?? 0) : null;
export const scoreCodePostal = r => has(r.controle_cp_nuts) && r.controle_cp_nuts in CP ? CP[r.controle_cp_nuts] : null;
export function scoreTva(r) {
  const s = r.VIES_statut;
  if (s === 'VALIDE') return Math.max(0, Math.round(100 * (1 - (COH[r.VIES_coherence_nom] || 0) - (COH[r.VIES_coherence_adresse] || 0))) / 100);
  if (s === 'INVALIDE' || s === 'FORMAT_INVALIDE') return 0;
  return null;   // service indisponible, hors VIES, non contrôlé : n'entre pas dans le score
}

export function scoreRow(r, cols = []) {
  const parts = {completude: scoreCompletude(r, cols), geocodage: scoreGeocodage(r), codepostal: scoreCodePostal(r), tva: scoreTva(r)};
  let num = 0, den = 0;
  for (const k in parts) if (parts[k] !== null) { num += parts[k] * WEIGHTS[k]; den += WEIGHTS[k]; }
  return den ? Math.round(100 * num / den) : null;
}

export function scoreGlobal(rows, cols = []) {
  const dims = {};
  for (const [k, fn] of [['completude', r => scoreCompletude(r, cols)], ['geocodage', scoreGeocodage], ['codepostal', scoreCodePostal], ['tva', scoreTva]]) {
    const vals = rows.map(fn).filter(v => v !== null), m = mean(vals);
    dims[k] = {score: m === null ? null : Math.round(100 * m), n: vals.length, weight: WEIGHTS[k]};
  }
  let num = 0, den = 0;
  for (const k in dims) if (dims[k].score !== null) { num += dims[k].score * dims[k].weight; den += dims[k].weight; }
  const score = den ? Math.round(num / den) : null;
  return {score, grade: grade(score), dims, n: rows.length};
}
export const grade = s => s === null ? '—' : s >= 90 ? 'A' : s >= 75 ? 'B' : s >= 60 ? 'C' : s >= 40 ? 'D' : 'E';
