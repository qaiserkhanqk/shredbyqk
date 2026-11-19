// Browser regression tests for phone-app input races reported against 21317c5: values must be captured when the user
// acts, not read from the page later inside a delayed or retried repository transaction. Saves are delayed by holding
// the same cross-tab Web Lock the app uses. Synthetic data only. Run: node tests/cycle-ui-races.cjs
const { launch } = require('./browser.cjs'); // E2E_BROWSER=chromium|firefox|webkit
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.task': 'application/octet-stream', '.webmanifest': 'application/manifest+json' };
let fails = 0, count = 0;
const check = (name, ok, detail = '') => { count++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail ? '  — ' + detail : ''}`); };
const dayStr = n => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await launch(), errs = [];
  const serve = r => { let p = new URL(r.request().url()).pathname; if (p === '/') p = '/index.html'; const f = path.join(ROOT, p);
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' }); r.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' } }); };
  const c = await b.newContext({ serviceWorkers: 'block' }); await c.route('https://shred.local/**', serve);
  await c.addInitScript(() => localStorage.setItem('shred_flags_v1', JSON.stringify({ cycleTracking: true })));
  const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  const go = async pg => { await pg.goto('https://shred.local/'); await pg.click('#welcomeBtn'); await pg.click('.tabs [data-tab=body]'); await pg.click('[data-go=cycle]'); await pg.waitForTimeout(700); };
  await go(p); await p.check('#cyAgree'); await p.click('[data-act=consent]'); await p.waitForTimeout(500);
  const uid = await p.evaluate(() => localStorage.getItem('shred_cycle_uid'));
  await p.evaluate(async () => { const S = await import('/js/cycle/store.js'), M = await import('/js/cycle/model.js');
    const repo = await S.openCycleRepo({ storage: S.indexedDbStorage(), keys: S.indexedDbKeys(), userId: localStorage.getItem('shred_cycle_uid') });
    await repo.update(s => { M.setCategory(s, 'energy', true); }); });
  await go(p);
  const state = pg => pg.evaluate(async () => { const S = await import('/js/cycle/store.js');
    const repo = await S.openCycleRepo({ storage: S.indexedDbStorage(), keys: S.indexedDbKeys(), userId: localStorage.getItem('shred_cycle_uid') }); return repo.read(); });
  // Hold the app's cross-tab lock in `pg` until release(pg) is called: the app's save waits for it.
  const hold = pg => pg.evaluate(u => new Promise(acquired => navigator.locks.request(`shred-cycle-${u}`, () => new Promise(r => { window.__release = r; acquired(); }))), uid);
  const release = pg => pg.evaluate(() => window.__release());
  const setForm = (date, energy, unwell) => p.evaluate(([d, e, u]) => {
    const set = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
    set(document.querySelector('#cyDate'), d); set(document.querySelector('[data-sym=energy]'), e); document.querySelector('#cyUnwell').checked = u;
  }, [date, energy, unwell]);

  /* ---- Edit while a save is delayed ---- */
  const D1 = dayStr(-10), D2 = dayStr(-9);
  await hold(p);
  await setForm(D1, 'low', true); await p.click('[data-act=saveDay]'); await sleep(200);
  await setForm(D2, 'high', false); // the person keeps editing while the save waits
  await release(p); await sleep(1200);
  let s = await state(p);
  check('delayed save stores the values shown when Save was pressed (date, symptom, checkbox)', s.days[D1]?.energy === 'low' && s.days[D1]?.unwell === true, JSON.stringify({ [D1]: s.days[D1], [D2]: s.days[D2] }));
  check('delayed save does not store the values typed afterwards', !s.days[D2], JSON.stringify(s.days[D2]));
  await go(p);
  const D3 = dayStr(-40), D4 = dayStr(-38);
  await hold(p);
  await p.fill('#cyDate', D3); await p.click('[data-act=logStart]'); await sleep(200);
  await p.fill('#cyDate', D4);
  await release(p); await sleep(1200);
  s = await state(p);
  check('delayed "Period started" uses the date shown when it was pressed', s.periods.some(x => x.start === D3) && !s.periods.some(x => x.start === D4), JSON.stringify(s.periods.map(x => x.start)));

  /* ---- Two rapid saves ---- */
  await go(p);
  const D5 = dayStr(-7), D6 = dayStr(-6);
  await p.evaluate(([d5, d6]) => { // both clicks in one task, as a fast double action would
    const set = (sel, v) => { const el = document.querySelector(sel); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
    set('#cyDate', d5); set('[data-sym=energy]', 'low'); document.querySelector('[data-act=saveDay]').click();
    set('#cyDate', d6); set('[data-sym=energy]', 'high'); document.querySelector('[data-act=saveDay]').click();
  }, [D5, D6]);
  await sleep(1500);
  s = await state(p);
  check('two rapid saves each store their own date and values', s.days[D5]?.energy === 'low' && s.days[D6]?.energy === 'high', JSON.stringify({ [D5]: s.days[D5], [D6]: s.days[D6] }));

  /* ---- Cross-tab contention ---- */
  await go(p);
  const p2 = await c.newPage(); p2.on('pageerror', e => errs.push(e.message)); await go(p2);
  const D7 = dayStr(-5), D8 = dayStr(-4), D9 = dayStr(-3);
  await hold(p2); // the other tab is busy saving
  await setForm(D7, 'low', false); await p.click('[data-act=saveDay]'); await sleep(200);
  await setForm(D8, 'high', true);
  await release(p2);
  await p2.evaluate(async d => { const S = await import('/js/cycle/store.js'), M = await import('/js/cycle/model.js'); const u = localStorage.getItem('shred_cycle_uid');
    const repo = await S.openCycleRepo({ storage: S.indexedDbStorage(), keys: S.indexedDbKeys(), userId: u, lock: S.webLock(`shred-cycle-${u}`) });
    await repo.update(st => { M.logDay(st, d, { energy: 'usual' }); }); }, D9); // the other tab saves at the same time
  await sleep(1500);
  s = await state(p);
  check('cross-tab contention: this tab stores the values shown when Save was pressed', s.days[D7]?.energy === 'low' && !s.days[D8], JSON.stringify({ [D7]: s.days[D7], [D8]: s.days[D8] }));
  check('cross-tab contention: the other tab\'s save is kept too (no lost update)', s.days[D9]?.energy === 'usual', JSON.stringify(s.days[D9]));
  check('no JavaScript errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
