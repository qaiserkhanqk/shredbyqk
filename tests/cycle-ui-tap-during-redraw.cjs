// Browser regression test: a tap must not be lost when another tab's save redraws this tab mid-tap.
// Found investigating the intermittent Firefox failure of the two-tab checks in tests/e2e.cjs (2026-11-27): in every
// failing run, the tab whose save was "lost" showed no message at all, because its tap never ran. The other tab's save
// redrew the page between the finger going down and coming up, so the browser never fired a click. Written BEFORE the
// fix, and made deterministic here by holding the press while the other tab saves. Synthetic data only.
// Run: node tests/cycle-ui-tap-during-redraw.cjs   (E2E_BROWSER=chromium|firefox|webkit)
const { launch, openCycle } = require('./browser.cjs');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.task': 'application/octet-stream', '.webmanifest': 'application/manifest+json' };
let fails = 0, count = 0;
const check = (name, ok, detail = '') => { count++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail ? '  — ' + detail : ''}`); };
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

(async () => {
  const b = await launch(), errs = [];
  const serve = r => { let p = new URL(r.request().url()).pathname; if (p === '/') p = '/index.html'; const f = path.join(ROOT, p);
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' }); r.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' } }); };
  const c = await b.newContext({ serviceWorkers: 'block', viewport: { width: 400, height: 860 } }); await c.route('https://shred.local/**', serve);
  await c.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, r => r.fulfill({ status: 200, body: '', headers: { 'content-type': 'text/css' } }));
  await c.addInitScript(() => localStorage.setItem('shred_flags_v1', JSON.stringify({ cycleTracking: true })));
  const open = async () => { const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto('https://shred.local/'); await openCycle(p); await p.waitForTimeout(600); return p; };
  const starts = p => p.evaluate(async () => { const S = await import('/js/cycle/store.js'); const uid = localStorage.getItem('shred_cycle_uid');
    const r = await S.openCycleRepo({ storage: S.indexedDbStorage(), keys: S.indexedDbKeys(), userId: uid }); return r.read().periods.map(x => x.start).sort(); });
  try {
    const A = await open();
    await A.check('#cyAgree'); await A.click('[data-act=consent]'); await A.waitForTimeout(600);
    const B = await open(); await B.waitForSelector('#cyLog', { timeout: 5000 });
    await A.bringToFront();
    await A.fill('#cyDate', day(-10));
    await A.$eval('[data-act=logStart]', e => e.scrollIntoView({ block: 'center' }));
    const box = await (await A.$('[data-act=logStart]')).boundingBox();
    await A.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await A.mouse.down(); // her finger is on "Period started" ...
    await B.fill('#cyDate', day(-40)); await B.click('[data-act=logStart]'); // ... when the other tab saves
    await A.waitForTimeout(900); // long enough for this tab to hear about it
    await A.mouse.up(); // ... and she lifts her finger
    await A.waitForTimeout(900);
    const got = await starts(A);
    check('a tap in progress while another tab saves is not lost (both periods are saved)', JSON.stringify(got) === JSON.stringify([day(-40), day(-10)]), JSON.stringify(got));
    check('…and after the tap, this tab shows the other tab\'s save too', /\(\d+ \w+\)/.test(await A.textContent('#cyEstimate').catch(() => '')) && (await A.$$('#cyHistory [data-pid]')).length === 2, `${(await A.$$('#cyHistory [data-pid]')).length} periods shown`);
    // Variant (the one seen in Firefox): the other tab's save is heard just BEFORE the press, and this tab's re-read of
    // storage finishes DURING the press. Made deterministic by slowing this tab's decryption by 600 ms.
    await A.evaluate(() => { const orig = SubtleCrypto.prototype.decrypt; SubtleCrypto.prototype.decrypt = function (...a) { return new Promise(r => setTimeout(r, 600)).then(() => orig.apply(this, a)); };
      window.__heard = 0; const ch = new BroadcastChannel('shred-cycle'); ch.onmessage = () => { window.__heard++; }; });
    await A.fill('#cyDate', day(-70));
    await A.$eval('[data-act=logStart]', e => e.scrollIntoView({ block: 'center' }));
    const box2 = await (await A.$('[data-act=logStart]')).boundingBox();
    await A.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
    await B.fill('#cyDate', day(-100)); await B.click('[data-act=logStart]');
    await A.waitForFunction(() => window.__heard > 0, null, { timeout: 5000 });
    await A.mouse.down(); // just after this tab heard about the other save, while it is still re-reading
    await A.waitForTimeout(1200); // the re-read finishes during the press
    await A.mouse.up();
    await A.waitForTimeout(1500);
    const got2 = await starts(A);
    check('a tap that starts while this tab is still re-reading the other tab\'s save is not lost', JSON.stringify(got2) === JSON.stringify([day(-100), day(-70), day(-40), day(-10)]), JSON.stringify(got2));
  } catch (e) { check('run completed', false, e.stack); }
  check('no JavaScript errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
})();
