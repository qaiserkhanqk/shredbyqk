// Browser regression test for the check-in defects reported against a531ff2. Written BEFORE the fix. Synthetic data only.
// Run: node tests/cycle-ui-checkins-a531ff2.cjs   (E2E_BROWSER=chromium|firefox|webkit)
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
  const openDetails = async (p, id) => { if (!(await p.$eval(id, d => d.open).catch(() => false))) { await p.click(`${id} > summary`); await p.waitForTimeout(150); } };
  async function editHistory(p, rowIndex, field, value) {
    await openDetails(p, '#cyHistory');
    const rows = await p.$$('#cyHistory [data-pid]'), row = rowIndex < 0 ? rows.at(rowIndex) : rows[rowIndex];
    const input = await row.$(`input[data-edit=${field}]`);
    await input.fill(value); await input.dispatchEvent('change').catch(() => {}); await p.waitForTimeout(700);
  }
  try {
    { // 2. cycles of 15, 15, 35, 15; today is her typical date
      const { c, p } = await page({ cycleTracking: true }, [day(-95), day(-80), day(-65), day(-30), day(-15)]);
      check('15, 15, 35, 15 days, on her typical date: the forecast has a range', !!(await p.$('#cyEstimate .cy-range')), await text(p, '#cyEstimate'));
      check('…and "Has your period started?" appears', !!(await p.$('#cyCheck')), await text(p, '#cyEstimate'));
      await c.close();
    }
    { // 3. 48, 48, 48, 96: "No, it was one long cycle"
      const { c, p } = await page({ cycleTracking: true }, [day(-10 - 96 - 144), day(-10 - 96 - 96), day(-10 - 96 - 48), day(-10 - 96), day(-10)]);
      check('control: the 96-day gap is asked about', /96 days/.test(await text(p, '#cyMissed')), await text(p, '#cyMissed'));
      await p.click('#cyMissed [data-act=missedNo]'); await p.waitForTimeout(700);
      const g = await text(p, '#cyGap');
      check('"No": she is told her dates are saved but the 96-day gap is not used', (await p.$('#cyMissed')) === null && /96/.test(g) && /saved/i.test(g) && /(not|isn't|is not) used/i.test(g), g || '(no #cyGap card)');
      check('…the gap is still left out (safeguard kept, history not changed)', !/Used:[^.]*96 days/.test(await text(p, '#cyEstimate')), await text(p, '#cyEstimate'));
      const review = await p.$('#cyGap [data-act=gapReview]');
      if (review) { await review.click(); await p.waitForTimeout(300); }
      check('"Review dates" opens her history', !!review && await p.$eval('#cyHistory', d => d.open).catch(() => false));
      const confirm = await p.$('#cyGap [data-act=gapConfirm]');
      if (confirm) { await confirm.click(); await p.waitForTimeout(700); }
      check('"Use this gap in my estimate": only then is the 96-day gap used, and the notice goes away', !!confirm && (await p.$('#cyGap')) === null && /Used:[^.]*96 days/.test(await text(p, '#cyEstimate')), await text(p, '#cyEstimate'));
      await c.close();
    }
    { // 1. pregnancy hides the missed-period question; history editing still works
      const { c, p } = await page({ cycleTracking: true }, [day(-3 - 56 - 84), day(-3 - 56 - 56), day(-3 - 56 - 28), day(-3 - 56), day(-3)]);
      check('control: the 56-day gap is asked about', !!(await p.$('#cyMissed')));
      await openDetails(p, '#cySituation'); await p.check('#cySituation [data-sit=pregnant]'); await p.waitForTimeout(700);
      check('while "Pregnant" is ticked: no "missed period" question', (await p.$('#cyMissed')) === null);
      await openDetails(p, '#cyHistory');
      const box = await p.$('#cyHistory [data-pid] input[data-edit=missedBefore]');
      if (box) { await box.check(); await p.waitForTimeout(700); }
      check('…her history can still be edited by hand (marking a missed log is saved)', !!box && await p.$eval('#cyHistory [data-pid] input[data-edit=missedBefore]', x => x.checked).catch(() => false));
      await c.close();
    }
    { // 4. "Another day": an unsaved date survives a redraw, or clears visibly when it becomes invalid
      const { c, p } = await page({ cycleTracking: true }, [day(-30 - 112), day(-30 - 84), day(-30 - 56), day(-30 - 28), day(-30)]);
      check('control: the check-in is shown', !!(await p.$('#cyCheck #cyCheckDate')));
      await p.fill('#cyCheckDate', day(-28));
      await editHistory(p, -1, 'end', day(-30 - 112 + 3)); // an unrelated correction redraws the page
      check('an unsaved "Another day" date survives a redraw', (await p.$eval('#cyCheckDate', x => x.value).catch(() => 'missing')) === day(-28), await p.$eval('#cyCheckDate', x => x.value).catch(() => 'missing'));
      await editHistory(p, 0, 'start', day(-27)); // her last start moves past the picked day: it is no longer possible
      const v = await p.$eval('#cyCheckDate', x => x.value).catch(() => 'missing'), note = await text(p, '#cyCheckDateNote');
      check('…and when it becomes invalid, it is cleared with a visible note (not kept, not silently dropped)', v === '' && note.length > 10 && await p.isVisible('#cyCheckDateNote').catch(() => false), `value=${v} note=${note}`);
      await c.close();
    }
  } catch (e) { check('run completed', false, e.stack); }
  check('no JavaScript errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
})();
