// Browser test: the band-adjusted card must stop using stale band data (flag temperatureEstimate, default OFF).
// Uses the app's own demo band and a fixed browser clock: sync on day 0, then view the app 10 days later without new
// band data, then sync again. Written BEFORE the fix. Synthetic data only.
// Run: node tests/cycle-ui-adjust-freshness.cjs   (E2E_BROWSER=chromium|firefox|webkit)
const { launch, openCycle } = require('./browser.cjs');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.task': 'application/octet-stream', '.webmanifest': 'application/manifest+json' };
let fails = 0, count = 0;
const check = (name, ok, detail = '') => { count++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail ? '  — ' + detail : ''}`); };
const DAY0 = new Date('2026-05-01T10:00:00'), LATER = new Date('2026-05-11T10:00:00');

(async () => {
  const b = await launch(), errs = [];
  const serve = r => { let p = new URL(r.request().url()).pathname; if (p === '/') p = '/index.html'; const f = path.join(ROOT, p);
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' }); r.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' } }); };
  const c = await b.newContext({ serviceWorkers: 'block' }); await c.route('https://shred.local/**', serve);
  await c.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, r => r.fulfill({ status: 200, body: '', headers: { 'content-type': 'text/css' } }));
  await c.addInitScript(() => localStorage.setItem('shred_flags_v1', JSON.stringify({ cycleTracking: true, temperatureEstimate: true })));
  const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  const text = async sel => ((await p.textContent(sel).catch(() => '')) || '').replace(/\s+/g, ' ');
  const open = async () => { await p.goto('https://shred.local/'); await openCycle(p); await p.waitForTimeout(700); };
  const lastReading = async () => ((await text('#cyAdjusted')).match(/Last usable overnight band reading: ([^.]+)\./) || [])[1] || null;
  try {
    await p.clock.setFixedTime(DAY0);
    await open();
    await p.check('#cyAgree'); await p.click('[data-act=consent]'); await p.waitForTimeout(500);
    await p.click('[data-act=logStart]'); await p.waitForTimeout(500);
    await p.click('[data-act=wearableOn]'); await p.waitForTimeout(1200);
    const first = await lastReading();
    check('day 0, just synced: the card shows the date of the last usable overnight reading', !!first, await text('#cyAdjusted'));
    check('…and does not say the band data is stale', !/No recent usable band data/.test(await text('#cyAdjusted')));
    await p.clock.setFixedTime(LATER); await open();
    const card = await text('#cyAdjusted');
    check('10 days later with no new band data: "No recent usable band data"', /No recent usable band data/.test(card), card);
    check('…the last usable reading date is unchanged', (await lastReading()) === first, `${await lastReading()} vs ${first}`);
    check('…one logged period only: "Not enough data yet." and no date', /Not enough data yet\./.test(card) && !(await p.$('#cyAdjusted .cy-range')));
    await p.click('[data-act=syncWearable]'); await p.waitForTimeout(1200);
    check('after a sync with new usable nights, the band data is fresh again', !/No recent usable band data/.test(await text('#cyAdjusted')), await text('#cyAdjusted'));
    check('…and the last usable reading date moved forward', (await lastReading()) !== first && !!(await lastReading()), `${await lastReading()}`);
  } catch (e) { check('run completed', false, e.stack); }
  check('no JavaScript errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
})();
