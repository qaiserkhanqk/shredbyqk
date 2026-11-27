// Accessibility audit of the cycle screens with axe-core (WCAG 2.0/2.1 A and AA rules). Synthetic data only.
// Needs axe-core:  npm install --no-save axe-core@4.10.2   (or set AXE_PATH to axe.min.js)
// If axe-core is missing the run FAILS (exit 1) and says so; it never reports a skipped audit as passed.
// Critical and serious violations fail; moderate and minor ones are listed. Run: node tests/a11y.cjs
const { launch, openCycle } = require('./browser.cjs');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.task': 'application/octet-stream', '.webmanifest': 'application/manifest+json' };
let fails = 0, count = 0;
const check = (name, ok, detail = '') => { count++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail ? '  — ' + detail : ''}`); };
let AXE = process.env.AXE_PATH; try { AXE ||= require.resolve('axe-core/axe.min.js'); } catch { /* reported below */ }
if (!AXE || !fs.existsSync(AXE)) { console.log('FAIL axe-core is not installed. Install it with: npm install --no-save axe-core@4.10.2 (or set AXE_PATH)'); console.log('1 FAILED of 1'); process.exit(1); }
const plus = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const ALL = { cycleTracking: true, phaseEducation: true, patternInsights: true, symptomForecast: true, quickSuggestions: true, sensorPrompts: true, temperatureResearch: true, lhTests: true, comfortSuggestions: true, midlifeMode: true, companion: true, temperatureEstimate: true };

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
    return { c, p };
  }
  async function audit(p, label) {
    await p.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; })); // audit hidden sections too
    if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ path: AXE });
    const r = await p.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
    const bad = r.violations.filter(v => ['critical', 'serious'].includes(v.impact)), soft = r.violations.filter(v => !['critical', 'serious'].includes(v.impact));
    const fmt = vs => vs.map(v => `${v.id} (${v.impact}, ${v.nodes.length}): ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`).join(' ;; ');
    check(`${label}: no critical or serious WCAG A/AA violations (${r.passes.length} rules passed)`, bad.length === 0, fmt(bad));
    if (soft.length) console.log(`note ${label}: moderate/minor: ${fmt(soft)}`);
  }
  try {
    { // Self-check: the audit must catch a planted error (an image without a text alternative), or it proves nothing.
      const { c, p } = await page(ALL); await p.addScriptTag({ path: AXE });
      const v = await p.evaluate(async () => { const i = document.createElement('img'); i.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACw='; document.body.append(i); const r = await axe.run(document, { runOnly: ['image-alt'] }); i.remove(); return r.violations.map(x => x.id); });
      check('self-check: the audit detects a planted image without alt text', v.includes('image-alt'), v.join(','));
      await c.close();
    }
    { const { c, p } = await page(ALL); await audit(p, 'consent screen'); await c.close(); }
    {
      const { c, p } = await page(ALL);
      await p.check('#cyAgree'); await p.click('[data-act=consent]'); await p.waitForTimeout(500);
      await p.click('#cySettings summary'); await p.check('[data-cat=pain]'); await p.waitForTimeout(400);
      await p.click('[data-act=logStart]'); await p.waitForTimeout(600);
      await audit(p, 'cycle screen, every feature on');
      await c.close();
    }
    {
      const { c, p } = await page({ cycleTracking: true, pregnancyMode: true, companion: true });
      await p.check('#cyAgree'); await p.click('[data-act=consent]'); await p.waitForTimeout(500);
      await p.click('#cySituation summary'); await p.fill('#cyPregDue', plus(140)); await p.click('[data-act=pregStart]'); await p.waitForTimeout(700);
      await audit(p, 'pregnancy mode');
      await p.fill('#cyBirthDate', plus(0)); await p.click('[data-act=pregBirth]'); await p.waitForTimeout(700);
      await audit(p, 'postpartum mode');
      await c.close();
    }
  } catch (e) { check('run completed', false, e.stack); }
  check('no JavaScript errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
})();
