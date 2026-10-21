// Vérification VIES indépendante du géocodage. Aucune clé API requise.
const ENDPOINT = 'https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
export function parseVat(raw) {
  const clean = String(raw ?? '').toUpperCase().replace(/[\s.\-]/g, '');
  const match = /^([A-Z]{2})([A-Z0-9]{2,14})$/.exec(clean);
  if (!match) return null;
  return { countryCode: match[1] === 'GR' ? 'EL' : match[1], vatNumber: match[2], input: clean };
}
export async function checkVat(raw, fetcher = fetch) {
  const parsed = parseVat(raw);
  if (!parsed) return {input: raw, status: 'FORMAT_INVALIDE'};
  if (parsed.countryCode === 'GB') return {input: raw, status: 'HORS_VIES', detail: 'GB hors VIES ; utiliser XI pour les cas éligibles en Irlande du Nord'};
  try {
    const response = await fetcher(ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({countryCode: parsed.countryCode, vatNumber: parsed.vatNumber}),
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) return {input: raw, status: 'SERVICE_INDISPONIBLE', detail: 'HTTP ' + response.status};
    const data = await response.json();
    if (typeof data.valid !== 'boolean') return {input: raw, status: 'INDETERMINE', detail: data.userError || data.error || 'Réponse VIES inattendue'};
    return {
      input: raw, status: data.valid ? 'VALIDE' : 'INVALIDE',
      name: data.name || '', address: data.address || '',
      checkedAt: data.requestDate || new Date().toISOString(),
      requestIdentifier: data.requestIdentifier || ''
    };
  } catch (error) {
    return {input: raw, status: 'SERVICE_INDISPONIBLE', detail: error?.message || String(error)};
  }
}
const csvCell = value => '"' + String(value ?? '').replace(/"/g, '""') + '"';
export function initVies() {
  const input = document.getElementById('vatInput');
  const button = document.getElementById('vatCheck');
  const stop = document.getElementById('vatStop');
  const status = document.getElementById('vatStatus');
  const table = document.getElementById('vatRows');
  const exportButton = document.getElementById('vatExport');
  let stopped = false, busy = false, results = [];
  button.addEventListener('click', async () => {
    if (busy) return;
    const values = [...new Set(input.value.split(/[\n;,]+/).map(s => s.trim()).filter(Boolean))].slice(0, 200);
    if (!values.length) {status.textContent = 'Saisissez au moins un numéro TVA.'; return;}
    busy = true; stopped = false; results = []; table.replaceChildren();
    button.disabled = true; stop.disabled = false; exportButton.disabled = true;
    for (const [index, value] of values.entries()) {
      if (stopped) break;
      const result = await checkVat(value);
      results.push(result);
      const tr = document.createElement('tr');
      for (const field of ['input','status','name','address','detail']) {
        const td = document.createElement('td'); td.textContent = result[field] || ''; tr.append(td);
      }
      table.append(tr);
      status.textContent = (index + 1) + '/' + values.length + ' numéros traités.';
      if (index < values.length - 1) await pause(400);
    }
    busy = false; button.disabled = false; stop.disabled = true; exportButton.disabled = !results.length;
    status.textContent += stopped ? ' Contrôle interrompu.' : ' Terminé.';
  });
  stop.addEventListener('click', () => {stopped = true; stop.disabled = true;});
  exportButton.addEventListener('click', () => {
    const fields = ['input','status','name','address','checkedAt','requestIdentifier','detail'];
    const csv = '\uFEFF' + [fields.join(';'), ...results.map(r => fields.map(f => csvCell(r[f])).join(';'))].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}));
    const a = document.createElement('a'); a.href = url; a.download = 'controle_vies.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}
