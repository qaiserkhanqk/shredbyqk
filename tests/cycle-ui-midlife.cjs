// Browser test of perimenopause and menopause mode on the Cycle screen (flag midlifeMode). Synthetic data only.
// Run: node tests/cycle-ui-midlife.cjs
const { launch, openCycle } = require('./browser.cjs'); // E2E_BROWSER=chromium|firefox|webkit
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
    await p.goto('https://shred.local/'); await openCycle(p); await p.waitForTimeout(600);
    await p.check('#cyAgree'); await p.click('[data-act=consent]'); await p.waitForTimeout(500);
    return { c, p };
  }
  const text = async (p, sel) => ((await p.textContent(sel).catch(() => '')) || '').replace(/\s+/g, ' ');
  const tickPerimenopause = async p => { await p.click('#cySituation summary'); await p.waitForTimeout(200); await p.check('[data-sit=perimenopause]'); await p.waitForTimeout(600); };
  try {
    {
      const { c, p } = await page({ cycleTracking: true });
      await tickPerimenopause(p);
      check('flag off: no midlife card even with perimenopause ticked', (await p.$('#cyMidlife')) === null);
      await p.click('#cySettings summary'); await p.waitForTimeout(200);
      check('flag off: no midlife symptom categories in settings', (await p.$('[data-cat=hotFlushes]')) === null);
      await c.close();
    }
    {
      const { c, p } = await page({ cycleTracking: true, midlifeMode: true });
      check('flag on, perimenopause not ticked: no midlife card', (await p.$('#cyMidlife')) === null);
      await p.click('#cySettings summary'); await p.waitForTimeout(200);
      check('flag on, perimenopause not ticked: midlife categories hidden', (await p.$('[data-cat=hotFlushes]')) === null);
      await tickPerimenopause(p);
      const card = await text(p, '#cyMidlife');
      check('perimenopause ticked: the midlife card appears with its intro', /expert/i.test(card) && /vari/i.test(card), card.slice(0, 160));
      check('warning signs are listed', (await p.$$('#cyMidlifeFlags li')).length >= 5);
      check('marked as awaiting clinician review', /awaiting clinician review/i.test(card));
      check('sources link to the published papers (8 or more)', (await p.$$('#cyMidlife a[href^="https://doi.org/10."]')).length >= 8);
      await p.click('#cySettings summary').catch(() => {}); await p.waitForTimeout(200);
      if (!(await p.isVisible('[data-cat=hotFlushes]').catch(() => false))) { await p.click('#cySettings summary'); await p.waitForTimeout(200); }
      check('the midlife symptom categories appear in settings, off by default', (await p.$('[data-cat=hotFlushes]')) !== null && !(await p.isChecked('[data-cat=hotFlushes]')) && (await p.$('[data-cat=dryness]')) !== null);
      await p.check('[data-cat=hotFlushes]'); await p.waitForTimeout(600);
      check('switching one on adds it to the day log', (await p.$('[data-sym=hotFlushes]')) !== null);
      await p.selectOption('[data-sym=hotFlushes]', 'moderate'); await p.click('[data-act=saveDay]'); await p.waitForTimeout(500);
      check('it saves', (await p.inputValue('[data-sym=hotFlushes]')) === 'moderate');
      await c.close();
    }
  } catch (e) { check('run completed', false, e.stack); }
  check('no JavaScript errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
})();
