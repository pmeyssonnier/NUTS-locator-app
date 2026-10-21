// Relais CORS pour l'API VIES (Cloudflare Worker). L'API VIES n'envoie pas d'en-têtes CORS : le navigateur ne peut pas l'appeler directement.
// Le Worker accepte le même POST JSON {countryCode, vatNumber}, le transmet à VIES et renvoie la réponse avec les en-têtes CORS.
// Variable ALLOWED_ORIGINS (wrangler.toml) : origines autorisées, séparées par des virgules. Aucun journal, aucun stockage.
const VIES = 'https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number';

export default {
  async fetch(request, env = {}) {
    const origin = request.headers.get('Origin') || '';
    const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const okOrigin = allowed.includes('*') || allowed.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': okOrigin ? (allowed.includes('*') ? '*' : origin) : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    };
    const reply = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), {status, headers: {...cors, 'Content-Type': 'application/json'}});

    if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers: cors});
    if (!okOrigin) return reply(403, {error: 'origine non autorisée'});
    if (request.method !== 'POST') return reply(405, {error: 'POST attendu'});

    let body;
    try { body = await request.json(); } catch { return reply(400, {error: 'JSON invalide'}); }
    const countryCode = String(body?.countryCode ?? '').toUpperCase(), vatNumber = String(body?.vatNumber ?? '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(countryCode) || !/^[A-Z0-9+*]{2,14}$/.test(vatNumber)) return reply(400, {error: 'countryCode / vatNumber invalides'});

    try {
      const upstream = await fetch(VIES, {
        method: 'POST', headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
        body: JSON.stringify({countryCode, vatNumber}), signal: AbortSignal.timeout(20000)
      });
      return new Response(await upstream.text(), {status: upstream.status, headers: {...cors, 'Content-Type': 'application/json'}});
    } catch (e) {
      return reply(502, {error: 'VIES injoignable', detail: String(e?.message || e)});
    }
  }
};
