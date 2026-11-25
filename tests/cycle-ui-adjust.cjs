// Browser test of the band-adjusted estimate card (flag temperatureEstimate, research, default OFF).
// With no band data it must say plainly why it can't adjust, and the dates-only estimate must always still show.
// Synthetic data only. Run: node tests/cycle-ui-adjust.cjs
const { launch } = require('./browser.cjs'); // E2E_BROWSER=chromium|firefox|webkit
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.task': 'application/octet-stream', '.webmanifest': 'application/manifest+json' };
let fails = 0, count = 0;
const check = (name, ok, detail = '') => { count++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail ? '  — ' + detail : ''}`); };

(async () => {
  const b = await launch(), errs = [];
  const serve = r => { let p = new URL(r.request().url()).pathname; if (p === '/') p = '/index.html'; const f = path.join(ROOT, p);
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' }); r.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' } }); };
  async function page(flags) {
    const c = await b.newContext({ serviceWorkers: 'block' }); await c.route('https://shred.local/**', serve);
    await c.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, r => r.fulfill({ status: 200, body: '', headers: { 'content-type': 'text/css' } }));
    await c.addInitScript(f => localStorage.setItem('shred_flags_v1', JSON.stringify(f)), flags);
    const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto('https://shred.local/'); await p.click('#welcomeBtn'); await p.click('.tabs [data-tab=body]'); await p.click('[data-go=cycle]'); await p.waitForTimeout(600);
    await p.check('#cyAgree'); await p.click('[data-act=consent]'); await p.waitForTimeout(500);
    await p.click('[data-act=logStart]'); await p.waitForTimeout(600);
    return { c, p };
  }
  const text = async (p, sel) => ((await p.textContent(sel).catch(() => '')) || '').replace(/\s+/g, ' ');
  try {
    {
      const { c, p } = await page({ cycleTracking: true });
      check('flag off: no band-adjusted card', (await p.$('#cyAdjusted')) === null);
      await c.close();
    }
    {
      const { c, p } = await page({ cycleTracking: true, temperatureEstimate: true });
      const card = await text(p, '#cyAdjusted');
      check('flag on: the card is labelled research', /research/i.test(card), card.slice(0, 160));
      check('with no band data it says why it cannot adjust (band not connected)', /band is not connected/i.test(card), card);
      check('it states the evidence: synthetic only, not validated', /synthetic/i.test(card) && /not been validated/i.test(card));
      check('the dates-only estimate is still shown', (await p.$('#cyEstimate')) !== null);
      check('it never mentions ovulation or fertility', !/ovulat|fertil/i.test(card));
      await c.close();
    }
  } catch (e) { check('run completed', false, e.stack); }
  check('no JavaScript errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
})();
