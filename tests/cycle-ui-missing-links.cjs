// Browser test of the "missing links" on the Cycle screen (see tests/cycle-missing-links.test.mjs for the logic):
// learning stage, band-gap honesty, night disruptors, comfort suggestions with "did it help?", training feel, and the
// Hume Band placeholder. Synthetic data only. Run: node tests/cycle-ui-missing-links.cjs
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
    p.go = async () => { await p.goto('https://shred.local/'); await openCycle(p); await p.waitForTimeout(600); };
    await p.go(); await p.check('#cyAgree'); await p.click('[data-act=consent]'); await p.waitForTimeout(500);
    return { c, p };
  }
  const text = async (p, sel) => ((await p.textContent(sel).catch(() => '')) || '').replace(/\s+/g, ' ');
  try {
    /* Learning stage and the training category (core: no extra flag) */
    {
      const { c, p } = await page({ cycleTracking: true });
      check('learning: before any period, the card says to log the first period', /first period/i.test(await text(p, '#cyLearning')), await text(p, '#cyLearning'));
      await p.click('[data-act=logStart]'); await p.waitForTimeout(500);
      check('learning: after one start, it says the first cycle is in progress', /first cycle/i.test(await text(p, '#cyLearning')), await text(p, '#cyLearning'));
      await p.click('#cySettings summary'); await p.waitForTimeout(200);
      check('training: "Training" is an optional category in settings, off by default', (await p.$('[data-cat=training]')) !== null && !(await p.isChecked('[data-cat=training]')));
      check('comfort: with its flag off there is no comfort card', (await p.$('#cyComfort')) === null);
      check('Hume Band: the wearable card lists it as not available (unverified)', /Hume Band/i.test(await text(p, '#cyWearable')) && /not verified|unverified/i.test(await text(p, '#cyWearable')));
      await c.close();
    }
    /* Comfort suggestions with "did it help?" */
    {
      const { c, p } = await page({ cycleTracking: true, comfortSuggestions: true });
      await p.click('#cySettings summary'); await p.waitForTimeout(200);
      await p.check('[data-cat=pain]'); await p.waitForTimeout(500);
      check('comfort: nothing before pain is logged', (await p.$('#cyComfort')) === null);
      await p.selectOption('[data-sym=pain]', 'moderate'); await p.click('[data-act=saveDay]'); await p.waitForTimeout(600);
      const card = await text(p, '#cyComfort');
      check('comfort: moderate pain shows the card with heat, gentle movement and a warm drink', /heat/i.test(card) && /movement|stretch|walk/i.test(card) && /warm drink/i.test(card), card.slice(0, 200));
      check('comfort: warning signs are listed', (await p.$$('#cyComfortFlags li')).length >= 5);
      check('comfort: marked as awaiting clinician review, and not a treatment', /awaiting clinician review/i.test(card) && /not (medical advice|a treatment)/i.test(card));
      check('comfort: each option links its evidence', (await p.$$('#cyComfort a[href^="https://doi.org/10."]')).length >= 3);
      await p.click('[data-act=comfortTry][data-opt=heat]'); await p.waitForTimeout(600);
      check('comfort: after "I\'ll try this", it asks "Did it help?"', /did .*heat.* help/i.test(await text(p, '#cyComfortAsk')), await text(p, '#cyComfortAsk'));
      await p.click('#cyComfortAsk [data-act=comfortAnswer][data-ans=yes]'); await p.waitForTimeout(600);
      check('comfort: her answer is recorded and shown with its denominator', /1 of 1/.test(await text(p, '#cyComfort')) && (await p.$('#cyComfortAsk')) === null, await text(p, '#cyComfort'));
      await p.go();
      check('comfort: the answer survives a reload (saved encrypted with her data)', /1 of 1/.test(await text(p, '#cyComfort')));
      await p.click('#cySettings summary'); await p.waitForTimeout(200);
      await p.click('[data-act=deleteComfort]'); await p.waitForTimeout(600);
      check('comfort: "Delete my comfort records" removes them', !/1 of 1/.test(await text(p, '#cyComfort')));
      await c.close();
    }
    /* Night disruptors (only shown when a wearable is on) */
    {
      const { c, p } = await page({ cycleTracking: true, temperatureResearch: true });
      check('nights: without a wearable, the night questions are not shown', (await p.$('#cyAlcohol')) === null);
      await p.click('[data-act=wearableOn]'); await p.waitForTimeout(900);
      check('nights: with the demo wearable on, alcohol / late night / hot or cold room appear', (await p.$('#cyAlcohol')) && (await p.$('#cyLateNight')) && (await p.$('#cyRoomTemp')));
      check('nights: the learning card shows band nights and is honest about gaps', /nights/i.test(await text(p, '#cyLearning')) && /filled in/i.test(await text(p, '#cyLearning')), await text(p, '#cyLearning'));
      await p.check('#cyRoomTemp'); await p.check('#cyAlcohol'); await p.click('[data-act=saveDay]'); await p.waitForTimeout(600);
      await p.go();
      check('nights: the entries are saved', (await p.isChecked('#cyRoomTemp')) && (await p.isChecked('#cyAlcohol')) && !(await p.isChecked('#cyLateNight')));
      await c.close();
    }
  } catch (e) { check('run completed', false, e.stack); }
  check('no JavaScript errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
})();
