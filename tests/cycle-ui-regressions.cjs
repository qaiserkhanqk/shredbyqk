// Browser regression test for issue 5 reproduced in 29780c5: symptom-pattern findings must not be displayed unless the
// separate research flag is on. Synthetic data only. Run: node tests/cycle-ui-regressions.cjs
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.task': 'application/octet-stream', '.webmanifest': 'application/manifest+json' };
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };
const dayStr = n => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

(async () => {
  const b = await chromium.launch(); const errs = [];
  const serve = r => { let p = new URL(r.request().url()).pathname; if (p === '/') p = '/index.html'; const f = path.join(ROOT, p);
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' }); r.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' } }); };
  async function run(flags) {
    const c = await b.newContext({ serviceWorkers: 'block' }); await c.route('https://shred.local/**', serve);
    await c.addInitScript(f => localStorage.setItem('shred_flags_v1', JSON.stringify(f)), flags);
    const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    const go = async () => { await p.goto('https://shred.local/'); await p.click('#welcomeBtn'); await p.click('.tabs [data-tab=body]'); await p.click('[data-go=cycle]'); await p.waitForTimeout(700); };
    await go(); await p.check('#cyAgree'); await p.click('[data-act=consent]'); await p.waitForTimeout(500);
    // Seed 6 complete synthetic cycles with "lower energy" on cycle days 24–25 and usual energy otherwise, so the
    // pattern rule finds something, and put today on cycle day 24 of the current cycle.
    await p.evaluate(async (d) => {
      const S = await import('/js/cycle/store.js'), M = await import('/js/cycle/model.js'), D = await import('/js/cycle/dates.js');
      const uid = localStorage.getItem('shred_cycle_uid');
      const repo = await S.openCycleRepo({ storage: S.indexedDbStorage(), keys: S.indexedDbKeys(), userId: uid });
      await repo.update(s => {
        M.setCategory(s, 'energy', true);
        const last = D.addDays(d.today, -23), starts = Array.from({ length: 7 }, (_, i) => D.addDays(last, -30 * (6 - i)));
        for (const st of starts) M.logPeriodStart(s, st, { today: d.today });
        starts.slice(0, 6).forEach(st => { for (let k = 1; k <= 30; k++) M.logDay(s, D.addDays(st, k - 1), { energy: k === 24 || k === 25 ? 'low' : 'usual' }, { today: d.today }); });
      });
    }, { today: dayStr(0) });
    await go();
    const html = await p.content(); await c.close(); return html;
  }
  const off = await run({ cycleTracking: true });
  check('5 cycle tracking on, research flag off: no symptom-pattern finding is displayed', !/You logged lower energy around/.test(off) && !/id="cyPatterns"/.test(off) && !/id="cyInsight"/.test(off));
  const on = await run({ cycleTracking: true, patternInsights: true });
  check('5 research flag on: the pattern card is shown, marked as unvalidated research', /id="cyPatterns"/.test(on) && /You logged lower energy around/.test(on) && /research/i.test(on));
  check('no JavaScript errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
