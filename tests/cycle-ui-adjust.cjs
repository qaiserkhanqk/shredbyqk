// Browser test of the band-adjusted estimate card (flag temperatureEstimate, research, default OFF).
// With no band data it must say plainly why it can't adjust, and the dates-only estimate must always still show.
// Synthetic data only. Run: node tests/cycle-ui-adjust.cjs
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
  async function page(flags, { logStart = true } = {}) {
    const c = await b.newContext({ serviceWorkers: 'block' }); await c.route('https://shred.local/**', serve);
    await c.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, r => r.fulfill({ status: 200, body: '', headers: { 'content-type': 'text/css' } }));
    await c.addInitScript(f => localStorage.setItem('shred_flags_v1', JSON.stringify(f)), flags);
    const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto('https://shred.local/'); await p.click('#welcomeBtn'); await p.click('.tabs [data-tab=body]'); await p.click('[data-go=cycle]'); await p.waitForTimeout(600);
    await p.check('#cyAgree'); await p.click('[data-act=consent]'); await p.waitForTimeout(500);
    if (logStart) { await p.click('[data-act=logStart]'); await p.waitForTimeout(600); }
    return { c, p };
  }
  // Synthetic history written through the app's own store, with dates relative to the page's today. Starts are
  // `starts` days before today; nights run from the first start to `lastNight` days before today; 33.5 °C, +0.4 from
  // 14 nights before each next start and 14 nights into the current cycle. Then the cycle screen is opened again.
  async function seed(p, { starts, lastNight }) {
    await p.evaluate(async ({ starts, lastNight }) => {
      const S = await import('/js/cycle/store.js'), M = await import('/js/cycle/model.js'), D = await import('/js/cycle/dates.js');
      const now = new Date(), today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const repo = await S.openCycleRepo({ storage: S.indexedDbStorage(), keys: S.indexedDbKeys(), userId: localStorage.getItem('shred_cycle_uid') });
      await repo.update(s => {
        M.setScopeConsent(s, 'wearable', true);
        const st = starts.map(n => D.addDays(today, -n)).sort();
        for (const d of st) M.logPeriodStart(s, d, { today });
        const end = D.addDays(today, -lastNight), nights = [];
        for (let d = st[0]; d <= end; d = D.addDays(d, 1)) {
          const i = st.filter(x => x <= d).length - 1, next = st[i + 1], high = next ? d >= D.addDays(next, -14) : d >= D.addDays(st[i], 14);
          nights.push({ night: d, deviceId: 'd1', model: 'SYN', firmware: '1', metric: 'skin_temp', kind: 'raw', status: 'ok', value: 33.5 + (high ? 0.4 : 0), flags: [], coverageMin: 480, samples: 48, sleepSessionId: `d1-${d}`, syncedAt: new Date().toISOString() });
        }
        s.wearable.nights = nights; s.wearable.devices = [{ deviceId: 'd1', model: 'SYN', firmware: '1', adapter: 'mock', verified: false, connectedAt: today }];
      });
    }, { starts, lastNight });
    await p.click('.tabs [data-tab=today]'); await p.click('.tabs [data-tab=body]'); await p.click('[data-go=cycle]'); await p.waitForTimeout(700);
  }
  const text = async (p, sel) => ((await p.textContent(sel).catch(() => '')) || '').replace(/\s+/g, ' ');
  try {
    {
      const { c, p } = await page({ cycleTracking: true });
      check('flag off: no band-adjusted card', (await p.$('#cyAdjusted')) === null);
      await c.close();
    }
    {
      const { c, p } = await page({ cycleTracking: true, temperatureEstimate: true });
      const card = await text(p, '#cyAdjusted');
      check('flag on: the card is labelled research', /research/i.test(card), card.slice(0, 160));
      check('with no band data it says why it cannot adjust (band not connected)', /band is not connected/i.test(card), card);
      check('it states the evidence: synthetic only, not validated', /synthetic/i.test(card) && /not been validated/i.test(card));
      check('the dates-only estimate is still shown', (await p.$('#cyEstimate')) !== null);
      check('it never mentions ovulation or fertility', !/ovulat|fertil/i.test(card));
      // Added with the aee2de8 eligibility fixes: one logged period, so neither model can estimate.
      check('when neither model can estimate, the card says "Not enough data yet."', /Not enough data yet\./.test(card), card);
      await c.close();
    }
    // Stale band data (the 12 Apr → 19 May report, as days before today): last usable night 37 days ago.
    {
      const { c, p } = await page({ cycleTracking: true, temperatureEstimate: true }, { logStart: false });
      await seed(p, { starts: [138, 110, 82, 54], lastNight: 37 });
      const card = await text(p, '#cyAdjusted');
      check('stale band data: no band-adjusted date on the card', (await p.$('#cyAdjusted .cy-range')) === null, card);
      check('…it says "No recent usable band data. This estimate is based on your logged periods."', /No recent usable band data\. This estimate is based on your logged periods\./.test(card), card);
      check('…it shows the date of the last usable overnight reading', /Last usable overnight band reading: the night of \d{1,2} \w{3}/.test(await text(p, '#cyAdjustedLastNight')), card);
      check('…the dates-only fallback says overdue and asks her to log or confirm', /overdue/i.test(await text(p, '#cyAdjustedFallback')) && /confirm/i.test(await text(p, '#cyAdjustedFallback')), card);
      check('…and the dates-only estimate card is still shown', (await p.$('#cyEstimate')) !== null);
      await c.close();
    }
    // Recent band data, but the band-adjusted date has passed with no new period: shown, marked overdue, not moved.
    {
      const { c, p } = await page({ cycleTracking: true, temperatureEstimate: true }, { logStart: false });
      await seed(p, { starts: [145, 117, 89, 61, 33], lastNight: 1 });
      const card = await text(p, '#cyAdjusted');
      check('recent data, date passed: the band-adjusted date is still shown', (await p.$('#cyAdjusted .cy-range')) !== null, card);
      check('…the card is marked overdue and asks her to log or confirm her period', /overdue/i.test(card) && /log it/i.test(await text(p, '#cyAdjustedOverdue')) && /confirm/i.test(await text(p, '#cyAdjustedOverdue')), card);
      check('…and shows last night as the last usable reading', /Last usable overnight band reading/.test(await text(p, '#cyAdjustedLastNight')), card);
      await c.close();
    }
  } catch (e) { check('run completed', false, e.stack); }
  check('no JavaScript errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
})();
