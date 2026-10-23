// Serveur statique minimal, sans dépendance : les modules ES ne se chargent pas depuis file://
// Usage : npm start [port]   (http://localhost:8000 par défaut ; si ce port est pris, le suivant libre est utilisé,
// sauf si un port est demandé explicitement : sous npm, `npm start -- 8765`)
// Option --open : ouvre le navigateur par défaut sur l'adresse utilisée (lanceur Windows : lancer-nuts.bat)
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import relay from '../worker/vies-proxy.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), openBrowser = args.includes('--open');
const asked = args.find(a => !a.startsWith('--')) || process.env.PORT;
const first = Number(asked || 8000);
const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.geojson': 'application/geo+json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.md': 'text/markdown; charset=utf-8'};

// Relais VIES local (même code que le Worker Cloudflare) : l'API VIES n'autorise pas les appels directs depuis un navigateur.
// Réservé aux appels de la page servie par ce serveur (Origin = Host).
async function viesRelay(req, res) {
  const chunks = [];
  for await (const c of req) { chunks.push(c); if (chunks.reduce((n, x) => n + x.length, 0) > 4096) { res.writeHead(413).end(); return; } }
  const origin = 'http://' + req.headers.host;
  const r = await relay.fetch(new Request(origin + '/api/vies', {method: req.method, headers: {origin: req.headers.origin || '', 'content-type': 'application/json'},
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks)}), {ALLOWED_ORIGINS: origin});
  res.writeHead(r.status, Object.fromEntries(r.headers)).end(Buffer.from(await r.arrayBuffer()));
}

const server = http.createServer((req, res) => {
  if (req.url.split('?')[0] === '/api/vies') { viesRelay(req, res).catch(() => res.writeHead(500).end()); return; }
  const url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.join(root, url.endsWith('/') ? url + 'index.html' : url);
  if (!file.startsWith(root)) { res.writeHead(403).end('Interdit'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end('Introuvable'); return; }
    res.writeHead(200, {'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache'}).end(data);
  });
});
// Un autre programme occupe peut-être déjà le port. Sous Windows, lier le port ne suffit pas à le détecter : un autre serveur
// écoutant seulement sur 127.0.0.1 laisse notre bind réussir, et « localhost » mène alors à cette autre application.
// On sonde donc d'abord le port en IPv4 et IPv6 : si quelque chose répond, on passe au suivant.
const taken = p => Promise.all(['127.0.0.1', '::1'].map(host => new Promise(resolve => {
  const sock = net.connect({port: p, host});
  const done = v => { sock.destroy(); resolve(v); };
  sock.setTimeout(400, () => done(false));
  sock.on('connect', () => done(true));
  sock.on('error', () => done(false));
}))).then(r => r.some(Boolean));
let port = first;
const busy = () => {
  if (asked || port >= first + 20) { console.error(`Le port ${port} est déjà utilisé. Choisissez-en un autre : npm start -- 8765`); process.exit(1); }
  console.log(`Le port ${port} est déjà utilisé, essai du ${port + 1}…`);
  port++;
  return start();
};
server.on('error', err => { if (err.code !== 'EADDRINUSE') throw err; busy(); });
async function start() {
  if (await taken(port)) return busy();
  server.listen(port);
}
function open(url) {
  const [cmd, argv] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  const child = spawn(cmd, argv, {stdio: 'ignore', detached: true, windowsVerbatimArguments: true});
  child.on('error', () => console.log(`Ouvrez ${url} dans votre navigateur.`));
  child.unref();
}
server.on('listening', () => { const url = `http://localhost:${port}`; console.log(`NUTS Locator : ${url}`); if (openBrowser) open(url); });
start();
