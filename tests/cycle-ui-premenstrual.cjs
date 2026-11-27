// Browser test of premenstrual patterns and the question budget. Written BEFORE the screens. Synthetic data only.
// Run: node tests/cycle-ui-premenstrual.cjs   (E2E_BROWSER=chromium|firefox|webkit)
const { launch } = require('./browser.cjs');
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
  async function page(flags) {
    const c = await b.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } }); await c.route('https://shred.local/**', serve);
    await c.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, r => r.fulfill({ status: 200, body: '', headers: { 'content-type': 'text/css' } }));
    await c.addInitScript(f => localStorage.setItem('shred_flags_v1', JSON.stringify(f)), flags);
    const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto('https://shred.local/'); await p.click('#welcomeBtn'); await p.click('.tabs [data-tab=body]'); await p.click('[data-go=cycle]'); await p.waitForTimeout(600);
    await p.check('#cyAgree'); await p.click('[data-act=consent]'); await p.waitForTimeout(500);
    return { c, p };
  }
  /** Four 28-day cycles; strong cravings and poor sleep in the 4 days before each period, none/good on cycle days 5–12.
   *  Today is 2 days before her expected range: a day Zara would check in, so "one check-in a day" is really tested. */
  const seed = p => p.evaluate(async d => {
    const S = await import('/js/cycle/store.js'), M = await import('/js/cycle/model.js'), D = await import('/js/cycle/dates.js');
    const repo = await S.openCycleRepo({ storage: S.indexedDbStorage(), keys: S.indexedDbKeys(), userId: localStorage.getItem('shred_cycle_uid') });
    await repo.update(s => {
      for (const c of ['cravings', 'sleep', 'mood', 'pain']) M.setCategory(s, c, true);
      for (const st of d.starts) M.logPeriodStart(s, st, { today: d.today });
      for (let i = 0; i + 1 < d.starts.length; i++) {
        for (let k = 1; k <= 4; k++) M.logDay(s, D.addDays(d.starts[i + 1], -k), { cravings: 'strong', sleep: 'poor' }, { today: d.today });
        for (let k = 5; k <= 12; k++) M.logDay(s, D.addDays(d.starts[i], k - 1), { cravings: 'none', sleep: 'good' }, { today: d.today });
      }
    });
  }, { starts: [day(-24 - 112), day(-24 - 84), day(-24 - 56), day(-24 - 28), day(-24)], today: day(0) });
  const text = async (p, sel) => ((await p.textContent(sel).catch(() => '')) || '').replace(/\s+/g, ' ');
  try {
    { // flag on, with Zara
      const { c, p } = await page({ cycleTracking: true, premenstrualPatterns: true, companion: true });
      await seed(p); await p.reload(); await p.click('#welcomeBtn'); await p.click('.tabs [data-tab=body]'); await p.click('[data-go=cycle]'); await p.waitForTimeout(900);
      const card = await text(p, '#cyPremenstrual');
      check('a few days before her period: her own pattern, with the counts', /3 of your last 3 cycles/.test(card) && /cravings/.test(card) && /sleep/.test(card), card.slice(0, 300));
      check('…worded as "may", with other causes named, and no labels or diet advice', /may/.test(card) && /stress/i.test(card) && !/binge|diet|calorie/i.test(card));
      const qs = await p.$$('#cyPremenstrual [data-pmq]');
      check('…at most 3 one-tap questions', qs.length >= 1 && qs.length <= 3, String(qs.length));
      check('one check-in a day: Zara does not ask as well today', (await p.$('#cyCompanion')) === null);
      const remBefore = await p.evaluate(async () => { const S = await import('/js/cycle/store.js'); const r = await S.openCycleRepo({ storage: S.indexedDbStorage(), keys: S.indexedDbKeys(), userId: localStorage.getItem('shred_cycle_uid') }); return r.read().reminders.length; });
      check('no new reminder or notification is created for it', remBefore === 0);
      await p.selectOption('#cyPremenstrual [data-pmq=cravings]', 'some'); await p.click('#cyPremenstrual [data-act=pmSave]'); await p.waitForTimeout(700);
      const saved = await p.evaluate(async t => { const S = await import('/js/cycle/store.js'); const r = await S.openCycleRepo({ storage: S.indexedDbStorage(), keys: S.indexedDbKeys(), userId: localStorage.getItem('shred_cycle_uid') }); return r.read().days[t] || {}; }, day(0));
      check('saving keeps only what she chose, and the questions are done for today', saved.cravings === 'some' && saved.sleep == null && (await p.$('#cyPremenstrual [data-pmq]')) === null, JSON.stringify(saved));
      check('the settings ask how often Zara may ask (Light or Normal)', await p.$$eval('#cyAskLevel option', os => os.map(o => o.value).join()) === 'light,normal');
      await c.close();
    }
    { // in her range: "Has your period started?" and Zara's "your period may start soon" ask the same thing
      const { c, p } = await page({ cycleTracking: true, companion: true });
      for (const st of [day(-27 - 84), day(-27 - 56), day(-27 - 28), day(-27)]) { await p.fill('#cyDate', st); await p.click('[data-act=logStart]'); await p.waitForTimeout(300); }
      check('one check-in a day: on a day "Has your period started?" shows, Zara does not ask the same thing', !!(await p.$('#cyCheck')) && (await p.$('#cyCompanion')) === null);
      await c.close();
    }
    { // flag off: nothing
      const { c, p } = await page({ cycleTracking: true });
      await seed(p); await p.reload(); await p.click('#welcomeBtn'); await p.click('.tabs [data-tab=body]'); await p.click('[data-go=cycle]'); await p.waitForTimeout(900);
      check('with the feature off (the default), no premenstrual card', (await p.$('#cyPremenstrual')) === null);
      await c.close();
    }
  } catch (e) { check('run completed', false, e.stack); }
  check('no JavaScript errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
})();
