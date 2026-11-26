// Food screen end to end: targets, search → sheet → log, and a photo with a mocked recognition server.
// Run: node tests/food.e2e.cjs [screenshot-dir]   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), SHOTS = process.argv[2];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.jpg': 'image/jpeg' };
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };
const num = s => +String(s).replace(/[^\d]/g, '');

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  let visionCalls = 0;
  await ctx.route('https://shred.local/**', r => {
    let p = new URL(r.request().url()).pathname; if (p === '/') p = '/index.html';
    if (p === '/food-vision') { // stands in for tools/food-vision-server.mjs: three samples that mostly agree
      visionCalls++;
      const it = (dish, servings, extra = {}) => ({ dish, servings, meat_share: 'normal', oil: 'normal', confidence: 0.9, other_name: '', ...extra });
      const samples = [[it('chicken_karahi', 1, { oil: 'oily' }), it('naan', 1)], [it('chicken_karahi', 1.5, { oil: 'oily' }), it('naan', 1)], [it('chicken_karahi', 1), it('naan', 1), it('raita', 1)]]
        .map(items => ({ items, setting: 'restaurant' }));
      return r.fulfill({ status: 200, body: JSON.stringify({ samples }), headers: { 'content-type': 'application/json' } });
    }
    const f = path.join(ROOT, p);
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' } });
  });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  const shot = async n => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n + '.png') }); };
  const sheetKcal = async () => num(await p.textContent('#fsResult .kbig'));

  await p.goto('https://shred.local/');
  await p.fill('#welcomeName', 'Sara'); await p.click('#welcomeBtn'); await p.click('[data-focus=train]');
  await p.click('[data-goal=muscle]'); await p.click('[data-exp=trained]');
  await p.click('#obDays [data-day="1"]'); await p.click('#obDone');
  await p.click('.tabs [data-tab=progress]'); await p.click('#profileCard summary');
  await p.fill('#pHeight', '178'); await p.dispatchEvent('#pHeight', 'change');

  await p.click('.tabs [data-tab=food]');
  check('food tab opens', await p.isVisible('#food'));
  check('no targets yet → asks for weight and age', /weight and age/.test(await p.textContent('#foodToday')));
  await p.click('#foodTargets summary');
  await p.fill('#tWeight', '80'); await p.dispatchEvent('#tWeight', 'change');
  await p.fill('#tAge', '30'); await p.dispatchEvent('#tAge', 'change');
  check('targets shown once weight, age and height are known (sign-up goal: build muscle → +10%)', /of 3,010/.test(await p.textContent('#foodToday')), await p.textContent('#tSummary'));

  await p.fill('#foodSearch', 'karahi');
  check('search shows desi models first', /Desi model/.test(await p.textContent('#foodResults .row'))); await shot('1-search');
  await p.click('#foodResults [data-ref*="chicken_karahi"]');
  check('sheet asks who cooked it', await p.isVisible('#foodSheet [data-key=style]'));
  const home = await sheetKcal();
  await p.click('#foodSheet [data-key=style] [data-v=restaurant]');
  const rest = await sheetKcal();
  check('restaurant karahi shows more calories than home', rest > home, `${home} → ${rest}`);
  await p.click('#foodSheet [data-step="0.5"]');
  check('portion stepper shows grams', /1½ katori \(≈300 g\)/.test(await p.textContent('#fsServe')), await p.textContent('#fsServe'));
  const one5 = await sheetKcal(); await shot('2-sheet');
  await p.click('#fsSave');
  check('logged entry appears', /Chicken karahi/.test(await p.textContent('#foodLog')));
  check('today total equals the sheet', num(await p.textContent('#foodToday .kbig')) === one5, `${one5}`);

  await p.fill('#foodSearch', 'karahi'); await p.click('#foodResults [data-ref*="chicken_karahi"]');
  check('remembers restaurant for karahi next time', await p.getAttribute('#foodSheet [data-key=style] [data-v=restaurant]', 'aria-pressed') === 'true');
  await p.click('#foodSheet', { position: { x: 10, y: 10 } });
  await p.fill('#foodSearch', '');  await p.dispatchEvent('#foodSearch', 'input');

  // Photo, through the same consensus and cache as the real server.
  await p.evaluate(async () => { (await import('/js/foodphoto.js')).PHOTO_CONFIG.endpoint = '/food-vision'; });
  await p.setInputFiles('#foodPhoto', path.join(ROOT, 'tests/pose.jpg'));
  await p.waitForSelector('#photoAddAll', { timeout: 8000 });
  const names = await p.$$eval('#foodPhotoBox .row b', els => els.map(e => e.textContent));
  check('photo: consensus keeps karahi and naan, drops the one-off raita', names.join() === 'Chicken karahi,Naan', names.join());
  check('photo: remembered style used for karahi', /1 katori \(≈200 g\) · restaurant/.test(await p.textContent('#foodPhotoBox')));
  await shot('3-photo');
  const k1 = await p.textContent('#foodPhotoBox .kbig');
  await p.click('#photoCancel');
  await p.setInputFiles('#foodPhoto', path.join(ROOT, 'tests/pose.jpg'));
  await p.waitForSelector('#photoAddAll');
  check('same photo again → same calories, from cache (no new call)', (await p.textContent('#foodPhotoBox .kbig')) === k1 && visionCalls === 1, `${k1}, calls ${visionCalls}`);
  await p.click('#foodPhotoBox [data-pedit="1"]');
  check('photo item opens the same sheet', await p.isVisible('#fsSave') && /Naan/.test(await p.textContent('#foodSheetBody h2')));
  await p.click('#fsTop'); await p.click('#fsSave');
  check('editing a photo item updates it', /Naan/.test(await p.textContent('#foodPhotoBox')));
  await p.click('#photoAddAll');
  check('photo items added to the log', /Naan/.test(await p.textContent('#foodLog')) && (await p.$$('#foodLog .row')).length === 3);
  await p.click('#foodLog [data-del]');
  check('remove an entry', (await p.$$('#foodLog .row')).length === 2);
  await p.evaluate(() => window.scrollTo(0, 0)); await shot('4-today');
  check('no page errors', !errs.length, errs.join(' | '));
  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nfood e2e passed');
  process.exit(fails ? 1 : 0);
})();
