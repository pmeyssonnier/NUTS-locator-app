// Serveur statique minimal, sans dépendance : les modules ES ne se chargent pas depuis file://
// Usage : npm start [port]   (http://localhost:8000 par défaut ; si ce port est pris, le suivant libre est utilisé,
// sauf si un port est demandé explicitement : sous npm, `npm start -- 8765`)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const asked = process.argv[2] || process.env.PORT;
const first = Number(asked || 8000);
const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.geojson': 'application/geo+json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.md': 'text/markdown; charset=utf-8'};

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.join(root, url.endsWith('/') ? url + 'index.html' : url);
  if (!file.startsWith(root)) { res.writeHead(403).end('Interdit'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end('Introuvable'); return; }
    res.writeHead(200, {'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache'}).end(data);
  });
});
// Un autre programme occupe peut-être déjà le port (d'où une autre application à l'adresse attendue) : on essaie les suivants
let port = first;
server.on('error', err => {
  if (err.code !== 'EADDRINUSE') throw err;
  if (asked || port >= first + 20) { console.error(`Le port ${port} est déjà utilisé. Choisissez-en un autre : npm start -- 8765`); process.exit(1); }
  console.log(`Le port ${port} est déjà utilisé, essai du ${port + 1}…`);
  server.listen(++port);
});
server.on('listening', () => console.log(`NUTS Locator : http://localhost:${port}`));
server.listen(port);
