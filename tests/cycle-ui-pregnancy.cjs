// Browser test of pregnancy and postpartum modes (flag pregnancyMode, default OFF). Written BEFORE the UI.
// Synthetic data only. Run: node tests/cycle-ui-pregnancy.cjs   (E2E_BROWSER=chromium|firefox|webkit)
const { launch } = require('./browser.cjs');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.task': 'application/octet-stream', '.webmanifest': 'application/manifest+json' };
let fails = 0, count = 0;
const check = (name, ok, detail = '') => { count++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail ? '  — ' + detail : ''}`); };
const iso = d => d.toISOString().slice(0, 10);
const plus = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

(async () => {
  const b = await launch(), errs = [], requests = [];
  const serve = r => { let p = new URL(r.request().url()).pathname; if (p === '/') p = '/index.html'; const f = path.join(ROOT, p);
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' }); r.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' } }); };
  async function page(flags) {
    const c = await b.newContext({ serviceWorkers: 'block' }); await c.route('https://shred.local/**', serve);
    await c.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, r => r.fulfill({ status: 200, body: '', headers: { 'content-type': 'text/css' } }));
    await c.addInitScript(f => localStorage.setItem('shred_flags_v1', JSON.stringify(f)), flags);
    const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    p.on('request', r => { const u = new URL(r.url()); if (u.hostname !== 'shred.local' && !/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) requests.push(u.hostname); });
    await p.goto('https://shred.local/'); await p.click('#welcomeBtn'); await p.click('.tabs [data-tab=body]'); await p.click('[data-go=cycle]'); await p.waitForTimeout(600);
    await p.check('#cyAgree'); await p.click('[data-act=consent]'); await p.waitForTimeout(500);
    return { c, p };
  }
  const text = async (p, sel) => ((await p.textContent(sel).catch(() => '')) || '').replace(/\s+/g, ' ');
  const openSit = async p => { if (!(await p.isVisible('#cyPregDue').catch(() => false))) { await p.click('#cySituation summary'); await p.waitForTimeout(200); } };
  async function startPregnancy(p, due) { await openSit(p); await p.fill('#cyPregDue', due); await p.click('[data-act=pregStart]'); await p.waitForTimeout(700); }
  try {
    {
      const { c, p } = await page({ cycleTracking: true });
      await p.click('#cySituation summary'); await p.waitForTimeout(200);
      check('flag off: no pregnancy mode form', (await p.$('#cyPregDue')) === null);
      await c.close();
    }
    {
      const { c, p } = await page({ cycleTracking: true, pregnancyMode: true, companion: true });
      await startPregnancy(p, plus(140)); // 20 weeks today
      const card = await text(p, '#cyPregnancy');
      check('pregnancy card: weeks today from her due date', /20 weeks/.test(card), card.slice(0, 200));
      check('…trimester and due date shown, described as an estimate', /trimester/i.test(card) && /estimate/i.test(card));
      check('…urgent warning signs are one tap away', /warning signs/i.test(card) && /bleeding/i.test(await text(p, '#cyPregWarn')));
      check('…sources shown', /ACOG/.test(card));
      check('the dates-only estimate is paused', /paused/i.test(await text(p, '#cyEstimate')));
      check('Zara checks in on the day a new week starts', /20 weeks/.test(await text(p, '#cyCompanion')));
      check('pregnancy symptoms can be switched on in settings', await (async () => { await p.click('#cySettings summary'); await p.waitForTimeout(200); return (await p.$('[data-cat=nausea]')) !== null; })());
      await p.fill('#cyBirthDate', plus(0)); await p.click('[data-act=pregBirth]'); await p.waitForTimeout(700);
      check('"My baby was born": the pregnancy card is replaced by the postpartum card', (await p.$('#cyPregnancy')) === null && (await p.$('#cyPostpartum')) !== null);
      const pp = await text(p, '#cyPostpartum');
      check('postpartum card: bleeding after birth is not a period; mood; check-ups; warning signs', /not a period/i.test(pp) && /2 weeks/.test(pp) && /12 weeks/.test(pp) && /warning signs/i.test(pp), pp.slice(0, 240));
      await c.close();
    }
    {
      const { c, p } = await page({ cycleTracking: true, pregnancyMode: true });
      await startPregnancy(p, plus(200));
      await p.fill('#cyEndDate', plus(0)); await p.click('[data-act=pregEnded]'); await p.waitForTimeout(700);
      check('"My pregnancy ended": mode ends without asking why, and no postpartum card', (await p.$('#cyPregnancy')) === null && (await p.$('#cyPostpartum')) === null);
      check('a gentle message is shown', /sorry/i.test(await text(p, '#cyPregEnded')));
      await c.close();
    }
    {
      const { c, p } = await page({ cycleTracking: true, pregnancyMode: true });
      await openSit(p); await p.fill('#cyPregDue', plus(400)); await p.click('[data-act=pregStart]'); await p.waitForTimeout(600);
      check('an impossible due date is refused and nothing starts', (await p.$('#cyPregnancy')) === null);
      await c.close();
    }
  } catch (e) { check('run completed', false, e.stack); }
  check('no JavaScript errors', errs.length === 0, errs.join(' | '));
  check('no requests to any other server (privacy)', requests.length === 0, [...new Set(requests)].join(','));
  await b.close();
  console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
})();
