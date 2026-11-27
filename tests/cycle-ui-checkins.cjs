// Browser test of the smarter period-start check-ins (js/cycle/checkins.js). Written BEFORE the UI. Synthetic data only.
// Run: node tests/cycle-ui-checkins.cjs   (E2E_BROWSER=chromium|firefox|webkit)
const { launch } = require('./browser.cjs');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.task': 'application/octet-stream', '.webmanifest': 'application/manifest+json' };
let fails = 0, count = 0;
const check = (name, ok, detail = '') => { count++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail ? '  — ' + detail : ''}`); };
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const human = s => { const [, m, d] = s.split('-'); return `${+d} ${MONTHS[+m - 1]}`; };

(async () => {
  const b = await launch(), errs = [];
  const serve = r => { let p = new URL(r.request().url()).pathname; if (p === '/') p = '/index.html'; const f = path.join(ROOT, p);
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' }); r.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' } }); };
  async function page(flags, starts) {
    const c = await b.newContext({ serviceWorkers: 'block' }); await c.route('https://shred.local/**', serve);
    await c.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, r => r.fulfill({ status: 200, body: '', headers: { 'content-type': 'text/css' } }));
    await c.addInitScript(f => localStorage.setItem('shred_flags_v1', JSON.stringify(f)), flags);
    const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto('https://shred.local/'); await p.click('#welcomeBtn'); await p.click('.tabs [data-tab=body]'); await p.click('[data-go=cycle]'); await p.waitForTimeout(600);
    await p.check('#cyAgree'); await p.click('[data-act=consent]'); await p.waitForTimeout(500);
    for (const st of starts) { await p.fill('#cyDate', st); await p.click('[data-act=logStart]'); await p.waitForTimeout(350); }
    return { c, p };
  }
  const text = async (p, sel) => ((await p.textContent(sel).catch(() => '')) || '').replace(/\s+/g, ' ');
  try {
    { // four 28-day cycles; today is day 28 of the current one (inside her range)
      const starts = [day(-27 - 112), day(-27 - 84), day(-27 - 56), day(-27 - 28), day(-27)];
      const { c, p } = await page({ cycleTracking: true }, starts);
      const card = await text(p, '#cyCheck');
      check('in her range: "Has your period started?" with today / yesterday / 2 days ago / another day', /started/i.test(card) && (await p.$$('#cyCheck [data-act=logStartOn]')).length === 3 && !!(await p.$('#cyCheck #cyCheckDate')), card.slice(0, 200));
      await p.click(`#cyCheck [data-act=logStartOn][data-date="${day(-1)}"]`); await p.waitForTimeout(700);
      check('"Yesterday" saves yesterday as the start (the real day, not today)', (await text(p, '#cyEstimate')).includes(`(${human(day(-1))})`), await text(p, '#cyEstimate'));
      check('…and the check-in goes away', (await p.$('#cyCheck')) === null);
      await c.close();
    }
    { // a 56-day gap after three 28-day cycles: did she miss logging one?
      const starts = [day(-3 - 56 - 84), day(-3 - 56 - 56), day(-3 - 56 - 28), day(-3 - 56), day(-3)];
      const { c, p } = await page({ cycleTracking: true }, starts);
      const card = await text(p, '#cyMissed');
      check('a gap of about two of her cycles: asks if she missed logging a period (does not assume)', /56 days/.test(card) && /didn't log|missed/i.test(card), card);
      await p.click('#cyMissed [data-act=missedYes]'); await p.waitForTimeout(700);
      check('"Yes": the question goes away and the long gap is no longer used as a cycle', (await p.$('#cyMissed')) === null && !/Used:[^.]*56 days/.test(await text(p, '#cyEstimate')), await text(p, '#cyEstimate'));
      await c.close();
    }
    { // the companion's "My period started" also asks which day
      // 2026-11-27: one check-in a day (product owner). On days "Has your period started?" shows, Zara no longer asks
      // the same thing, so this runs 2 days before her range (a Zara day without the check-in), not inside it.
      const starts = [day(-24 - 112), day(-24 - 84), day(-24 - 56), day(-24 - 28), day(-24)];
      const { c, p } = await page({ cycleTracking: true, companion: true }, starts);
      await p.click('#cyCompanion [data-act=companionAnswer][data-ans=periodStarted]'); await p.waitForTimeout(300);
      check('Zara: "My period started" asks which day', (await p.$$('#cyCompanionStart [data-act=companionStartOn]')).length === 3);
      await p.click(`#cyCompanionStart [data-act=companionStartOn][data-date="${day(-2)}"]`); await p.waitForTimeout(700);
      check('…and saves the chosen day (2 days ago)', (await text(p, '#cyEstimate')).includes(`(${human(day(-2))})`), await text(p, '#cyEstimate'));
      await c.close();
    }
  } catch (e) { check('run completed', false, e.stack); }
  check('no JavaScript errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
})();
