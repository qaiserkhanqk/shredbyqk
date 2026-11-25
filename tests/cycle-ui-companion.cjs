// Browser test of the companion check-in (flag companion). Synthetic data only. Run: node tests/cycle-ui-companion.cjs
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
    p.go = async () => { await p.goto('https://shred.local/'); await p.click('#welcomeBtn'); await p.click('.tabs [data-tab=body]'); await p.click('[data-go=cycle]'); await p.waitForTimeout(600); };
    await p.go(); await p.check('#cyAgree'); await p.click('[data-act=consent]'); await p.waitForTimeout(500);
    await p.click('#cySettings summary'); await p.waitForTimeout(200); await p.check('[data-cat=pain]'); await p.waitForTimeout(500);
    await p.click('[data-act=logStart]'); await p.waitForTimeout(600); // a period starts today
    return { c, p };
  }
  const text = async (p, sel) => ((await p.textContent(sel).catch(() => '')) || '').replace(/\s+/g, ' ');
  try {
    {
      const { c, p } = await page({ cycleTracking: true });
      check('flag off: no companion card', (await p.$('#cyCompanion')) === null);
      await c.close();
    }
    {
      const { c, p } = await page({ cycleTracking: true, companion: true, comfortSuggestions: true });
      const card = await text(p, '#cyCompanion');
      check('day 1 of a period: Zara asks how she is feeling (renamed from QK)', /how are you feeling/i.test(card) && /Zara/.test(card) && !/QK/.test(card), card.slice(0, 160));
      check('the card says her answers stay on her phone', /stay on this phone/i.test(card));
      check('the companion card is the first card on the screen (above the estimate)', await p.evaluate(() => { const a = document.querySelector('#cyCompanion'), e = document.querySelector('#cyEstimate'); return !!a && !!e && !!(a.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING); }));
      check('it says why it is asking', /why/i.test(card));
      await p.click('#cyCompanion [data-act=companionAnswer][data-ans=cramps]'); await p.waitForTimeout(300);
      check('"Cramps" asks how strong, in one tap', (await p.$$('#cyCompanion [data-act=companionSeverity]')).length === 3);
      await p.click('#cyCompanion [data-act=companionSeverity][data-sev=moderate]'); await p.waitForTimeout(700);
      check('after answering, the check-in closes for today', (await p.$('#cyCompanion')) === null);
      check('her answer is saved in today\'s log', (await p.inputValue('[data-sym=pain]')) === 'moderate');
      check('and what helped her before is offered (comfort card)', (await p.$('#cyComfort')) !== null);
      await c.close();
    }
    {
      const { c, p } = await page({ cycleTracking: true, companion: true });
      await p.click('#cySettings summary').catch(() => {}); await p.waitForTimeout(200);
      if (!(await p.isVisible('#cyCompanionName').catch(() => false))) { await p.click('#cySettings summary'); await p.waitForTimeout(200); }
      await p.fill('#cyCompanionName', 'Amna'); await p.click('[data-act=companionName]'); await p.waitForTimeout(600);
      check('she can rename her companion in settings', /Amna/.test(await text(p, '#cyCompanion')), await text(p, '#cyCompanion'));
      await c.close();
    }
    {
      const { c, p } = await page({ cycleTracking: true, companion: true });
      await p.click('#cyCompanion [data-act=companionDismiss]'); await p.waitForTimeout(600);
      check('"Not now" hides it', (await p.$('#cyCompanion')) === null);
      await p.go();
      check('…and it stays hidden for the rest of today', (await p.$('#cyCompanion')) === null);
      await c.close();
    }
  } catch (e) { check('run completed', false, e.stack); }
  check('no JavaScript errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
})();
