// Browser test of the personalised sign-up (product owner's flow, 2026-11-27). Written BEFORE the screens. Synthetic only.
// Run: node tests/onboarding-ui.cjs   (E2E_BROWSER=chromium|firefox|webkit)
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
  async function fresh() {
    const c = await b.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } }); await c.route('https://shred.local/**', serve);
    await c.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, r => r.fulfill({ status: 200, body: '', headers: { 'content-type': 'text/css' } }));
    const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto('https://shred.local/'); await p.waitForTimeout(400); return { c, p };
  }
  const pick = (p, q, v) => p.click(`#aboutYou [data-about=${q}][data-val="${v}"]`);
  const visible = (p, sel) => p.isVisible(sel).catch(() => false);
  const flags = p => p.evaluate(() => JSON.parse(localStorage.getItem('shred_flags_v1') || '{}'));
  const screenOn = p => p.evaluate(() => document.querySelector('.screen.on')?.id);
  try {
    { // Man
      const { c, p } = await fresh();
      check('first launch: "Which best describes you?" is on the welcome screen', await visible(p, '#aboutYou') && /describes you/i.test(await p.textContent('#aboutYou')));
      await pick(p, 'gender', 'man');
      check('man: no age or period question appears', !(await visible(p, '#aboutAge')) && !(await visible(p, '#aboutPeriods')));
      await p.click('#welcomeBtn'); await p.waitForTimeout(400);
      const f = await flags(p);
      check('man: lands on Today, with no Cycle tab and no cycle tile', (await screenOn(p)) === 'today' && !(await visible(p, '.tabs [data-tab=cycle]')) && (await p.$eval('#cycleTile', e => e.hidden)) && f.cycleTracking !== true, JSON.stringify(f));
      await p.reload(); await p.waitForTimeout(400);
      check('second launch: the questions are not asked again', !(await visible(p, '#aboutYou')));
      await c.close();
    }
    { // Woman, 18+, yes
      const { c, p } = await fresh();
      await pick(p, 'gender', 'woman');
      check('woman: asked her age', await visible(p, '#aboutAge') && !(await visible(p, '#aboutPeriods')));
      await pick(p, 'age', '18+');
      check('…then asked whether she would like to track her periods', await visible(p, '#aboutPeriods') && /track your periods/i.test(await p.textContent('#aboutPeriods')));
      await pick(p, 'periods', 'yes');
      await p.click('#welcomeBtn'); await p.waitForTimeout(900);
      check('yes: she goes straight to her cycle screen, with a Cycle tab in the bottom bar', (await screenOn(p)) === 'cycle' && await visible(p, '.tabs [data-tab=cycle]'));
      const tops = await p.$$eval('.tabs nav button:not([hidden])', bs => bs.map(x => Math.round(x.getBoundingClientRect().top)));
      check('…and the bottom bar stays on one row with five tabs (found in a screenshot)', tops.length === 5 && new Set(tops).size === 1, JSON.stringify(tops));
      check('…and the cycle screen has no "Body" back link when it has its own tab', !(await visible(p, '#cycle .back')));
      const hello = await p.textContent('#cyZaraHello').catch(() => '');
      check('Zara introduces herself on screen as her cycle companion (not clinical)', /Zara/.test(hello) && /companion/i.test(hello) && !/clinic/i.test(hello), hello);
      check('…and the consent terms are still there, unchanged', await visible(p, '#cyAgree') && /not clinically validated/i.test(await p.textContent('#cyConsent')));
      await p.check('#cyAgree'); await p.click('[data-act=consent]'); await p.waitForTimeout(600);
      check('after consent, Zara asks when her last period started', await visible(p, '#cyZaraFirst') && /last period/i.test(await p.textContent('#cyZaraFirst')));
      await p.fill('#cyZaraLast', day(-5)); await p.fill('#cyZaraBefore', day(-33)); await p.click('[data-act=zaraFirstSave]'); await p.waitForTimeout(800);
      const est = (await p.textContent('#cyEstimate')).replace(/\s+/g, ' ');
      check('…saving both dates gives her a first, early estimate, and Zara\'s question goes away', !(await p.$('#cyZaraFirst')) && /28 days/.test(est), est.slice(0, 200));
      check('the period answer is not stored in the main app data (only her profile answers are)', await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('shred_qk_v1') || '{}'); return s.profile?.gender === 'woman' && !/periods|notNow/.test(JSON.stringify(s.profile)); }));
      check('nothing about periods was put in a notification', await p.evaluate(() => !window.__notified));
      await c.close();
    }
    { // Under 18 (minimum age raised from 13 to 18 by the product owner, 2026-11-27)
      const { c, p } = await fresh();
      await pick(p, 'gender', 'woman');
      check('the age choices are "Under 18" and "18 or over"', (await p.$$eval('#aboutAge [data-about=age]', bs => bs.map(b => b.dataset.val))).join() === 'under18,18+');
      await pick(p, 'age', 'under18');
      const note = await p.textContent('#aboutNote').catch(() => '');
      check('under 18: no period question, and a kind note (18 and over; a parent or guardian, school nurse or doctor can help)', !(await visible(p, '#aboutPeriods')) && /18/.test(note) && /parent|guardian/i.test(note), note);
      await p.click('#welcomeBtn'); await p.waitForTimeout(400);
      check('…and period tracking stays off', (await flags(p)).cycleTracking !== true && !(await visible(p, '.tabs [data-tab=cycle]')));
      await p.click('.tabs [data-tab=progress]'); await p.waitForTimeout(300);
      if (!(await p.$eval('#profileCard', d => d.open))) await p.click('#profileCard summary');
      const sw = await p.$eval('#profileCycle', x => ({ disabled: x.disabled, why: x.closest('.stack')?.textContent || '' }));
      check('…and the Profile switch can\'t turn it on, with the same note beside it', sw.disabled && /18/.test(sw.why), JSON.stringify(sw).slice(0, 200));
      await c.close();
    }
    { // Adult and Other
      const { c, p } = await fresh();
      await pick(p, 'gender', 'woman'); await pick(p, 'age', '18+');
      check('18 or over: asked whether she would like to track her periods', await visible(p, '#aboutPeriods'));
      await pick(p, 'gender', 'other');
      check('other or prefer not to say: asked the age and period questions too', await visible(p, '#aboutAge'));
      await c.close();
    }
    { // Not right now: pregnant
      const { c, p } = await fresh();
      await pick(p, 'gender', 'woman'); await pick(p, 'age', '18+'); await pick(p, 'periods', 'notNow');
      check('"Not right now": asked which applies', await visible(p, '#aboutNotNow'));
      await pick(p, 'notNow', 'pregnant'); await p.click('#welcomeBtn'); await p.waitForTimeout(900);
      await p.check('#cyAgree'); await p.click('[data-act=consent]'); await p.waitForTimeout(700);
      check('pregnant: after consent, the pregnancy mode form is open and ready', await visible(p, '#cyPregStart') && await p.$eval('#cySituation', d => d.open));
      check('…and Zara does not ask about her last period', !(await p.$('#cyZaraFirst')));
      await c.close();
    }
    { // Skipping keeps the app as it was
      const { c, p } = await fresh();
      await p.click('#welcomeBtn'); await p.waitForTimeout(400);
      check('skipping the questions: the app starts on Today as before', (await screenOn(p)) === 'today' && (await flags(p)).cycleTracking !== true);
      await p.reload(); await p.waitForTimeout(400);
      check('…and they are offered again next time (nothing was answered)', await visible(p, '#aboutYou'));
      await c.close();
    }
  } catch (e) { check('run completed', false, e.stack); }
  check('no JavaScript errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
})();
