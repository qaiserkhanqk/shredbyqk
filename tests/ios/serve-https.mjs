// Small HTTPS server for testing the app on a real iPhone on the local network. No dependencies.
//   node tests/ios/serve-https.mjs <this-Mac's-local-IP> [port=8443]
// Uses the certificate from tests/ios/make-certs.sh. Listens on that local IP only, answers only devices with a
// private (local-network) address, serves only the repository folder (GET/HEAD; no dot-files such as .git or .certs),
// and logs each request to tests/ios/.run/server.log. Nothing is deployed or published. Stop it with Ctrl-C.
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const [ip, port = '8443'] = process.argv.slice(2);
if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip || '')) { console.error('usage: node tests/ios/serve-https.mjs <local-IP> [port]'); process.exit(1); }
const PRIVATE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/;
if (!PRIVATE.test(ip)) { console.error(`${ip} is not a local-network address; refusing to serve`); process.exit(1); }

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.task': 'application/octet-stream', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.txt': 'text/plain', '.md': 'text/plain; charset=utf-8', '.pem': 'application/x-pem-file' };

fs.mkdirSync(path.join(HERE, '.run'), { recursive: true, mode: 0o700 });
const log = fs.createWriteStream(path.join(HERE, '.run', 'server.log'), { flags: 'a', mode: 0o600 });
const certs = path.join(HERE, '.certs');
const server = https.createServer({ key: fs.readFileSync(path.join(certs, 'server.key')), cert: fs.readFileSync(path.join(certs, 'server.crt')) }, (req, res) => {
  const from = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  const done = (status, body = '', headers = {}) => { res.writeHead(status, headers); res.end(req.method === 'HEAD' ? undefined : body); log.write(`${new Date().toISOString()} ${from} ${req.method} ${req.url} ${status}\n`); };
  if (!PRIVATE.test(from)) return done(403, 'local network only');
  if (req.method !== 'GET' && req.method !== 'HEAD') return done(405, 'read only', { allow: 'GET, HEAD' });
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'https://x').pathname); } catch { return done(400); }
  if (p.endsWith('/')) p += 'index.html';
  if (p.split('/').some(seg => seg.startsWith('.'))) return done(404); // .git, .certs, .run, .env …
  const f = path.resolve(ROOT, '.' + p);
  if (!f.startsWith(ROOT + path.sep)) return done(404);
  fs.stat(f, (err, st) => {
    if (err || !st.isFile()) return done(404);
    fs.readFile(f, (e2, body) => e2 ? done(500) : done(200, body, { 'content-type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }));
  });
});
server.listen(Number(port), ip, () => console.log(`serving the app at https://${ip}:${port}/ (local network only; log: tests/ios/.run/server.log)`));
