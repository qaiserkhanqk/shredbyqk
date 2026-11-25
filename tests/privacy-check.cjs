// Privacy check of the cycle screens (synthetic data only). Walks through the main flows with every feature on, then:
//   1. no request goes to any server other than the app itself (Google Fonts is listed separately: it is a known,
//      non-health request pending the self-hosting decision, see docs/pre-hardware-hardening.md);
//   2. nothing she logged appears in the browser console;
//   3. nothing she logged is readable in localStorage or IndexedDB (the store is encrypted).
// Run: node tests/privacy-check.cjs   (E2E_BROWSER=chromium|firefox|webkit)
const { launch } = require('./browser.cjs');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.task': 'application/octet-stream', '.webmanifest': 'application/manifest+json' };
let fails = 0, count = 0;
const check = (name, ok, detail = '') => { count++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail ? '  — ' + detail : ''}`); };
const plus = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const ALL = { cycleTracking: true, phaseEducation: true, patternInsights: true, symptomForecast: true, quickSuggestions: true, sensorPrompts: true, temperatureResearch: true, lhTests: true, comfortSuggestions: true, midlifeMode: true, companion: true, temperatureEstimate: true, pregnancyMode: true };

(async () => {
  const b = await launch(), errs = [], other = [], fonts = [], logs = [];
  const serve = r => { let p = new URL(r.request().url()).pathname; if (p === '/') p = '/index.html'; const f = path.join(ROOT, p);
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' }); r.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' } }); };
  const c = await b.newContext({ serviceWorkers: 'block' }); await c.route('https://shred.local/**', serve);
  await c.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, r => r.fulfill({ status: 200, body: '', headers: { 'content-type': 'text/css' } }));
  await c.route(u => !/^https:\/\/(shred\.local|fonts\.(googleapis|gstatic)\.com)\//.test(u.href) && !/^(data|blob):/.test(u.href), r => r.abort()); // nothing leaves the test
  await c.addInitScript(f => localStorage.setItem('shred_flags_v1', JSON.stringify(f)), ALL);
  const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  p.on('console', m => logs.push(m.text()));
  p.on('request', r => { const u = new URL(r.url()); if (/^(data|blob):/.test(r.url()) || u.hostname === 'shred.local') return; (/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname) ? fonts : other).push(u.hostname); });
  const MARK = 'Zephyrine'; // a distinctive companion name, to search for in storage and logs
  try {
    await p.goto('https://shred.local/'); await p.click('#welcomeBtn'); await p.click('.tabs [data-tab=body]'); await p.click('[data-go=cycle]'); await p.waitForTimeout(600);
    await p.check('#cyAgree'); await p.click('[data-act=consent]'); await p.waitForTimeout(500);
    await p.click('#cySettings summary'); await p.check('[data-cat=pain]'); await p.waitForTimeout(400);
    await p.fill('#cyCompanionName', MARK); await p.click('[data-act=companionName]'); await p.waitForTimeout(500);
    await p.click('[data-act=logStart]'); await p.waitForTimeout(600);
    await p.selectOption('[data-sym=pain]', 'severe'); await p.waitForTimeout(300);
    await p.click('[data-act=saveDay]').catch(() => {}); await p.waitForTimeout(600);
    if (!(await p.isVisible('#cyPregDue').catch(() => false))) { await p.click('#cySituation summary'); await p.waitForTimeout(200); }
    const due = plus(150); await p.fill('#cyPregDue', due); await p.click('[data-act=pregStart]'); await p.waitForTimeout(700);
    check('flows ran: pregnancy card shown', (await p.$('#cyPregnancy')) !== null);
    check('1. no requests to any other server', other.length === 0, [...new Set(other)].join(','));
    if (fonts.length) console.log(`note Google Fonts requested (${[...new Set(fonts)].join(', ')}): no health data, but it reveals the visit to Google. Self-hosting the fonts is an open decision.`);
    const secrets = [MARK, 'severe', due];
    const leakedLogs = logs.filter(l => secrets.some(x => l.includes(x)));
    check('2. nothing she logged appears in the console', leakedLogs.length === 0, leakedLogs.slice(0, 3).join(' | '));
    const stored = await p.evaluate(async () => {
      const out = [JSON.stringify({ ...localStorage })];
      const dbs = indexedDB.databases ? await indexedDB.databases() : [{ name: 'shred_cycle_keys' }];
      for (const { name } of dbs) {
        const db = await new Promise((res, rej) => { const r = indexedDB.open(name); r.onsuccess = () => res(r.result); r.onerror = rej; });
        for (const st of db.objectStoreNames) {
          const all = await new Promise(res => { const q = db.transaction(st).objectStore(st).getAll(); q.onsuccess = () => res(q.result); q.onerror = () => res([]); });
          out.push(JSON.stringify(all, (k, v) => (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) ? `[bytes:${v.byteLength}]` : (typeof CryptoKey !== 'undefined' && v instanceof CryptoKey) ? '[CryptoKey]' : v));
        }
        db.close();
      }
      return out.join('\n');
    });
    const found = secrets.filter(x => stored.includes(x));
    // The storage check only means something if the data really was saved: reload and read it back through the app.
    await p.reload(); await p.click('#welcomeBtn').catch(() => {}); await p.click('.tabs [data-tab=body]'); await p.click('[data-go=cycle]'); await p.waitForTimeout(800);
    await p.click('#cySettings summary').catch(() => {}); await p.waitForTimeout(200);
    check('the data was saved (read back after reload: pain, companion name, due date)', (await p.inputValue('[data-sym=pain]')) === 'severe' && (await p.inputValue('#cyCompanionName')) === MARK && (await p.$('#cyPregnancy')) !== null);
    check('3. nothing she logged is readable in browser storage (encrypted at rest)', found.length === 0 && stored.length > 0, `found: ${found.join(', ')}`);
  } catch (e) { check('run completed', false, e.stack); }
  check('no JavaScript errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
})();
