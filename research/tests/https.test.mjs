// HTTPS for the research dashboard. Written BEFORE the implementation. Synthetic data only.
// Why: Safari does not keep Secure cookies on plain http (docs/browser-test-report-2026-11-25.md, finding 3), so the
// dashboard must be served over HTTPS for Safari users, without weakening the Secure cookie default.
// Run: node research/tests/https.test.mjs
import { mkdtempSync, statSync, chmodSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import https from 'node:https';
import http from 'node:http';

let fails = 0, count = 0;
const check = (n, ok, d = '') => { count++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${!ok && d ? '  — ' + d : ''}`); };
const run = async (label, fn) => { try { await fn(); } catch (e) { check(`${label} ran to the end`, false, e.stack.split('\n').slice(0, 2).join(' ')); } };
let T = {}; try { T = await import('../server/tls.js'); } catch (e) { check('module research/server/tls.js exists', false, e.message); }
const { start, settingsFromEnv } = await import('../server/server.js');
const err = async fn => { try { await fn(); return null; } catch (e) { return e.code || e.message; } };
const dir = mkdtempSync(join(tmpdir(), 'rs-tls-'));
const req = (mod, opts, body) => new Promise((res, rej) => { const r = mod.request(opts, x => { let d = ''; x.on('data', c => d += c); x.on('end', () => res({ status: x.statusCode, headers: x.headers, body: d })); }); r.on('error', rej); r.setTimeout(3000, () => r.destroy(new Error('timeout'))); if (body) r.write(body); r.end(); });

await run('local certificate', async () => {
  const c = T.makeLocalCert(dir);
  check('makes a local certificate and key for localhost, 127.0.0.1 and ::1', /BEGIN CERTIFICATE/.test(readFileSync(c.certPath, 'utf8')) && /PRIVATE KEY/.test(readFileSync(c.keyPath, 'utf8')));
  check('the private key file is readable by its owner only (0600)', (statSync(c.keyPath).mode & 0o777) === 0o600, (statSync(c.keyPath).mode & 0o777).toString(8));
  check('it refuses to overwrite an existing key', await err(() => T.makeLocalCert(dir)) === 'tls_exists');
  const san = T.certInfo?.(c.certPath) || '';
  check('the certificate names localhost and 127.0.0.1', /localhost/.test(san) && /127\.0\.0\.1/.test(san), san);
});

await run('loading', async () => {
  const c = { certPath: join(dir, 'cert.pem'), keyPath: join(dir, 'key.pem') };
  check('loads a certificate and key', !!T.loadTls(c.certPath, c.keyPath)?.cert);
  check('only one of the two: refused', await err(() => T.loadTls(c.certPath, null)) === 'tls_incomplete');
  const loose = join(dir, 'loose-key.pem'); writeFileSync(loose, readFileSync(c.keyPath)); chmodSync(loose, 0o644);
  check('a key others can read: refused (like the database key file)', await err(() => T.loadTls(c.certPath, loose)) === 'tls_key_permissions');
  const s = settingsFromEnv({ RESEARCH_DB: ':memory:', RESEARCH_TLS_CERT: c.certPath, RESEARCH_TLS_KEY: c.keyPath });
  check('RESEARCH_TLS_CERT and RESEARCH_TLS_KEY turn HTTPS on', !!s.tls?.cert && !!s.tls?.key);
  check('without them, settings have no TLS (unchanged behaviour)', !settingsFromEnv({ RESEARCH_DB: ':memory:' }).tls);
});

await run('serving', async () => {
  const c = { certPath: join(dir, 'cert.pem'), keyPath: join(dir, 'key.pem') };
  const settings = { ...settingsFromEnv({ RESEARCH_DB: ':memory:', RESEARCH_TLS_CERT: c.certPath, RESEARCH_TLS_KEY: c.keyPath }), port: 0, requireMfaRoles: [] };
  const { server, store, port, url } = await start(settings);
  try {
    check('start() reports an https:// address', /^https:\/\/127\.0\.0\.1:\d+\/$/.test(url || ''), url);
    const ca = readFileSync(c.certPath);
    const home = await req(https, { host: '127.0.0.1', port, path: '/', ca, servername: 'localhost' });
    check('the dashboard is served over HTTPS (certificate verified against the local certificate)', home.status === 200, String(home.status));
    const plain = await req(http, { host: '127.0.0.1', port, path: '/' }).then(r => r.status).catch(() => 'refused');
    check('plain http on the same port does not serve the dashboard', plain !== 200, String(plain));
    store.createUser({ username: 'researcher', password: 'synthetic-pass-123', role: 'researcher' });
    const body = JSON.stringify({ username: 'researcher', password: 'synthetic-pass-123' });
    const login = await req(https, { host: '127.0.0.1', port, path: '/api/login', method: 'POST', ca, servername: 'localhost', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body), origin: `https://127.0.0.1:${port}` } }, body);
    const cookie = String(login.headers['set-cookie'] || '');
    check('sign-in over HTTPS sets the session cookie with Secure and HttpOnly (default kept)', login.status === 200 && /rs_session=/.test(cookie) && /;\s*Secure/.test(cookie) && /HttpOnly/.test(cookie), `${login.status} ${cookie}`);
    check('HTTPS responses tell browsers to keep using HTTPS (Strict-Transport-Security)', /max-age=\d+/.test(String(login.headers['strict-transport-security'] || '')), String(login.headers['strict-transport-security']));
  } finally { await new Promise(r => server.close(r)); store.close?.(); }
});
rmSync(dir, { recursive: true, force: true });
console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
