// The research dashboard over HTTPS in a browser, with the DEFAULT Secure cookie. Written BEFORE the implementation.
// Over plain http, Safari/WebKit drops Secure cookies, so sign-in fails there (docs/browser-test-report-2026-11-25.md,
// finding 3). Over HTTPS it must work in every browser without weakening the cookie.
// The certificate is a fresh local self-signed one; the test browser is told to accept it (a person would accept the
// warning once, or install a locally trusted certificate, see research/docs/security-operations.md).
// Synthetic data only. Run: node research/tests/e2e-https.cjs   (E2E_BROWSER=chromium|firefox|webkit)
const { launch } = require('../../tests/browser.cjs');
const fs = require('fs'), os = require('os'), path = require('path');
let fails = 0, count = 0;
const check = (name, ok, detail = '') => { count++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail ? '  — ' + detail : ''}`); };

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-e2e-tls-'));
  let server, b;
  try {
    const { openStore } = await import('../server/store.js');
    const { createApp } = await import('../server/server.js');
    const { makeLocalCert, loadTls } = await import('../server/tls.js');
    const { seedDemo } = await import('../tools/seed.mjs');
    const https = require('https');
    const c = makeLocalCert(dir), tls = loadTls(c.certPath, c.keyPath);
    const store = openStore(':memory:'), PW = 'synthetic-pass-123';
    const rid = store.createUser({ username: 'researcher', password: PW, role: 'researcher' });
    seedDemo(store, { researcherId: rid });
    server = https.createServer({ cert: tls.cert, key: tls.key }, createApp({ store, settings: { secureCookies: true, tls, idleMs: 30 * 60e3, absoluteMs: 8 * 36e5 }, log: () => {} }));
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const BASE = `https://127.0.0.1:${server.address().port}`;
    b = await launch(); const errs = [];
    const ctx = await b.newContext({ ignoreHTTPSErrors: true }), p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/'); await p.waitForSelector('#login');
    check('the dashboard loads over HTTPS', p.url().startsWith('https://'));
    await p.fill('#u', 'researcher'); await p.fill('#p', PW); await p.click('#login button'); await p.waitForTimeout(600);
    const ck = (await ctx.cookies()).find(x => x.name === 'rs_session');
    check('sign-in keeps the DEFAULT session cookie: Secure, HttpOnly, SameSite=Strict', !!ck && ck.secure && ck.httpOnly && ck.sameSite === 'Strict', JSON.stringify(ck));
    await p.waitForSelector('[data-ref=P-DEMO-A]', { timeout: 10000 }).catch(() => {});
    check('signed in: the synthetic participants are shown', (await p.$('[data-ref=P-DEMO-A]')) !== null);
    await p.reload(); await p.waitForTimeout(600);
    check('the session survives a reload (the browser kept the Secure cookie)', (await p.$('[data-ref=P-DEMO-A]')) !== null && (await p.$('#login:not([hidden])')) === null);
    check('no JavaScript errors', errs.length === 0, errs.join(' | '));
  } catch (e) { check('run completed', false, e.stack); }
  if (b) await b.close(); if (server) await new Promise(r => server.close(r)); fs.rmSync(dir, { recursive: true, force: true });
  console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
})();
