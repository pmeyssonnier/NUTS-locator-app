// Vérification VIES indépendante du géocodage (interface). Logique réseau dans lib/vies.js.
import {checkVat, parseVat} from '../lib/vies.js';
export {checkVat, parseVat};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
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
    const seen = new Set();   // doublons repérés sur le numéro normalisé (« BE 0123.456.789 » = « BE0123456789 »)
    const values = input.value.split(/[\n;,]+/).map(s => s.trim()).filter(Boolean)
      .filter(v => { const k = parseVat(v)?.input || v.toUpperCase(); return seen.has(k) ? false : (seen.add(k), true); }).slice(0, 200);
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
