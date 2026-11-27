// Food screen end to end: targets, search → sheet → log, bread families, places and "Add a place",
// water, one-tap photo (mocked recognition server), and QK's weekly report.
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
  let visionCalls = 0, lastVision = null;
  await ctx.route('https://shred.local/**', r => {
    let p = new URL(r.request().url()).pathname; if (p === '/') p = '/index.html';
    if (p === '/food-vision') { // stands in for tools/food-vision-server.mjs: three samples that mostly agree
      visionCalls++;
      const body = JSON.parse(r.request().postData() || '{}'); lastVision = body;
      const it = (dish, servings, extra = {}) => ({ dish, servings, meat_share: 'normal', oil: 'normal', confidence: 0.9, other_name: '', alternative: 'none', ...extra });
      // With a note saying "2 naan", the stand-in model counts two.
      const naan = /2 naan/.test(body.hint || '') ? 2 : 1;
      const samples = [[it('chicken_karahi', 1, { oil: 'oily' }), it('naan', naan, { alternative: 'roghni_naan' })], [it('chicken_karahi', 1.5, { oil: 'oily' }), it('naan', naan, { alternative: 'roghni_naan' })], [it('chicken_karahi', 1), it('naan', naan), it('raita', 1)]]
        .map(items => ({ items, setting: 'unsure', scene: 'plate' }));
      if (/table/.test(body.hint || '')) samples.forEach(x => { x.scene = 'shared'; x.items = [it('chicken_karahi', 4)]; });
      if (/stall/.test(body.hint || '')) samples.forEach(x => { x.scene = 'cooking_or_display'; x.items = [it('naan', 15)]; });
      return r.fulfill({ status: 200, body: JSON.stringify({ samples }), headers: { 'content-type': 'application/json' } });
    }
    const f = path.join(ROOT, p);
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' } });
  });
  // Open Food Facts stand-in: one made-up product.
  await ctx.route('https://world.openfoodfacts.org/**', r => r.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    body: JSON.stringify({ status: 1, product: { product_name: 'Test Biscuit', brands: 'Brand A', serving_quantity: '25', serving_size: '1 pack (25 g)', nutriments: { 'energy-kcal_100g': 480, proteins_100g: 6.5, carbohydrates_100g: 68, fat_100g: 20 } } }) }));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  const shot = async n => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n + '.png') }); };
  const sheetKcal = async () => num(await p.textContent('#fsResult .kbig'));
  const rows = () => p.$$('#foodLog .row');

  await p.goto('https://shred.local/');
  await p.fill('#welcomeName', 'Sara'); await p.click('#welcomeBtn'); await p.click('[data-focus=train]');
  await p.click('[data-goal=muscle]'); await p.click('[data-exp=trained]');
  await p.click('#obDays [data-day="1"]'); await p.click('#obDone');
  check('today: "Snap meal" quick button', await p.isVisible('#snapMeal'));
  await p.click('.tabs [data-tab=progress]'); await p.click('#profileCard summary');
  await p.fill('#pHeight', '178'); await p.dispatchEvent('#pHeight', 'change');

  await p.click('.tabs [data-tab=food]');
  check('food tab opens', await p.isVisible('#food'));
  check('no targets yet → asks for weight and age', /weight and age/.test(await p.textContent('#foodToday')));
  await p.click('#foodTargets summary');
  await p.fill('#tWeight', '80'); await p.dispatchEvent('#tWeight', 'change');
  await p.fill('#tAge', '30'); await p.dispatchEvent('#tAge', 'change');
  check('targets shown (sign-up goal: build muscle → +10%)', /\/ 3,010/.test(await p.textContent('#foodToday')), await p.textContent('#tSummary'));

  // Search → sheet → log
  await p.fill('#foodSearch', 'karahi');
  check('search shows desi models', /Desi model/.test(await p.textContent('#foodResults')));
  await p.click('#foodResults [data-ref*="chicken_karahi"]');
  const home = await sheetKcal();
  await p.click('#foodSheet [data-key=style] [data-v=restaurant]');
  const rest = await sheetKcal();
  check('restaurant karahi shows more calories than home', rest > home, `${home} → ${rest}`);
  await p.click('#foodSheet [data-step="0.5"]');
  check('portion stepper shows grams', /1½ katori \(≈300 g\)/.test(await p.textContent('#fsServe')));
  await p.click('#fsSave');
  check('logged entry appears', /Chicken karahi/.test(await p.textContent('#foodLog')));

  // "Roti" can be any bread: one tap to say which one.
  await p.fill('#foodSearch', 'roti'); await p.click('#foodResults [data-ref*=\'"roti"\']');
  check('bread sheet shows the bread family', (await p.$$('#foodSheet [data-fam]')).length >= 10);
  const roti = await sheetKcal();
  await p.click('#foodSheet [data-fam=roghni_naan]');
  check('switching roti → roghni naan changes the title and calories', /Roghni naan/.test(await p.textContent('#foodSheetBody h2')) && await sheetKcal() > roti * 2, `${roti} → ${await sheetKcal()}`);
  await p.click('#foodSheet [data-step="0.5"]'); await shot('2-family');
  await p.click('#fsSave');
  check('roghni naan logged', /Roghni naan/.test(await p.textContent('#foodLog')));

  // Places: chains and carts
  await p.fill('#foodSearch', 'kfc zinger');
  check('"kfc zinger" finds the KFC menu item', /Zinger Burger/.test(await p.textContent('#foodResults')) && /KFC/.test(await p.textContent('#foodResults .ftag.place')));
  await shot('1-search');
  await p.click('#foodResults [data-menu^="kfc|"]');
  check('menu item sheet is labelled with the place', /KFC/.test(await p.textContent('#foodSheetBody .eyebrow')));
  await p.click('#fsSave');
  check('menu item logged with the place name', /KFC · Zinger Burger/.test(await p.textContent('#foodLog')));
  await p.fill('#foodSearch', 'gol gappay');
  check('street cart items are searchable', /Chaat and gol gappay cart/.test(await p.textContent('#foodResults')));

  // Add a place
  await p.fill('#foodSearch', 'chicken cheese burger');
  await p.click('#addPlaceBtn');
  await p.fill('#plName', 'Ali Burger Cart');
  await p.dispatchEvent('#plItem', 'input');
  check('add a place suggests the closest dishes', (await p.$$('#plSuggest [data-pick]')).length >= 2, await p.textContent('#plSuggest'));
  await p.click('#plSuggest [data-pick=chicken_burger]'); await p.click('#plNext');
  check('then the normal portion sheet', await p.isVisible('#fsSave') && /Ali Burger Cart/.test(await p.textContent('#foodSheetBody h2')));
  await p.click('#fsSave');
  check('added and logged', /Ali Burger Cart · chicken cheese burger/i.test(await p.textContent('#foodLog')));
  await p.fill('#foodSearch', 'ali burger');
  check('the new place is searchable next time', /Ali Burger Cart/.test(await p.textContent('#foodResults')));
  await p.fill('#foodSearch', ''); await p.dispatchEvent('#foodSearch', 'input');

  // Water
  await p.click('#foodToday [data-water="1"]'); await p.click('#foodToday [data-water="1"]');
  check('water taps count glasses', /2 \/ 11 glasses/.test(await p.textContent('#foodToday')));


  // Type (or say) the whole meal
  await p.fill('#foodSearch', 'do roti aur kfc zinger');
  check('typed meal → one "Log this meal" card', await p.isVisible('#mealAddAll') && /KFC · Zinger Burger/.test(await p.textContent('#foodResults .meal-card')));
  await p.click('#mealAddAll');
  check('Add all logs every item', /KFC · Zinger Burger/.test(await p.textContent('#foodLog')) && /Roti \/ chapati/.test(await p.textContent('#foodLog')));
  check('voice button is there (falls back to typing without speech support)', await p.isVisible('#foodVoice'));

  // Official chain values
  await p.fill('#foodSearch', 'big mac');
  await p.click('#foodResults [data-menu^="mcdonalds|"]');
  check('official values are labelled with their country', /official values \(McDonald's Singapore\)/.test(await p.textContent('#foodSheetBody .eyebrow')) && await sheetKcal() === 558);
  await p.click('#foodSheet [data-step="0.5"]');
  check('menu items count in items ("1½ × Big Mac" = 837 kcal)', /1½ × Big Mac/.test(await p.textContent('#fsServe')) && await sheetKcal() === 837, `${await p.textContent('#fsServe')} ${await sheetKcal()}`);
  await p.click('#foodSheet', { position: { x: 10, y: 10 } });

  // Barcode (typed, since headless Chrome has no barcode camera)
  await p.click('#foodScan');
  await p.fill('#scanCode', '8964000000001'); await p.click('#scanLook');
  await p.waitForSelector('#fsSave');
  check('barcode → product sheet with label values', /Brand A · Test Biscuit/.test(await p.textContent('#foodSheetBody h2')) && await sheetKcal() === 120);
  await p.click('#fsSave');
  check('packaged food logged', /Test Biscuit/.test(await p.textContent('#foodLog')));
  await p.fill('#foodSearch', 'biscuit');
  check('scanned products are searchable afterwards', /Barcode/.test(await p.textContent('#foodResults')));
  await p.fill('#foodSearch', ''); await p.dispatchEvent('#foodSearch', 'input');

  // Steps
  await p.fill('#stepsToday', '6500'); await p.dispatchEvent('#stepsToday', 'change');
  check('steps typed in are saved', await p.evaluate(() => Object.values(JSON.parse(localStorage.getItem('shred_qk_v1')).food.steps).includes(6500)));

  // Urdu
  await p.click('#foodLang');
  check('Urdu: heading and direction switch', (await p.textContent('#food h1')) === 'آپ نے کیا کھایا؟' && (await p.getAttribute('#food', 'dir')) === 'rtl');
  check('Urdu: today card labels', /آج کھایا/.test(await p.textContent('#foodToday')));
  await shot('5-urdu');
  await p.click('#foodLang');
  check('back to English', (await p.textContent('#food h1')) === 'What did you eat?');

  // One-tap photo: added straight away, no review step
  const before = (await rows()).length;
  await p.evaluate(async () => { (await import('/js/foodphoto.js')).PHOTO_CONFIG.endpoint = '/food-vision'; });
  await p.setInputFiles('#foodPhoto', path.join(ROOT, 'tests/pose.jpg'));
  await p.waitForSelector('#snapUndo', { timeout: 8000 });
  check('photo: meal added to the log immediately', (await rows()).length === before + 2, `${before} → ${(await rows()).length}`);
  const names = await p.$$eval('#foodPhotoBox .row b', els => els.map(e => e.textContent));
  check('photo: consensus keeps karahi and naan, drops the one-off raita', names.join() === 'Chicken karahi,Naan', names.join());
  check('photo: remembered style used for karahi (restaurant)', /1 katori \(≈200 g\) · restaurant/.test(await p.textContent('#foodPhotoBox')));
  check('photo: asks once who usually cooks', await p.isVisible('[data-usual=home]'));
  await shot('3-snap');
  await p.click('[data-usual=home]');
  check('…and never asks again', !(await p.isVisible('[data-usual=home]')));
  await p.click('#foodPhotoBox [data-sedit]:nth-of-type(1)');
  check('tap a photo dish → same sheet to fix it', await p.isVisible('#fsSave'));
  check('photo meals can be weighed (optional)', await p.isVisible('#fsWeighed'));
  await p.fill('#fsWeighed', '260'); await p.dispatchEvent('#fsWeighed', 'input');
  await p.click('#fsSave');
  check('weighed meal shows in "Your portions"', /1 weighed photo meal/.test(await p.textContent('#calInfo')), await p.textContent('#calInfo'));
  await p.click('#snapUndo');
  check('photo sent with the client\'s usual dishes', Array.isArray(lastVision.usual) && lastVision.usual.length > 0, JSON.stringify(lastVision.usual?.slice(0, 3)));
  check('undo removes the photo meal', (await rows()).length === before);
  await p.setInputFiles('#foodPhoto', path.join(ROOT, 'tests/pose.jpg'));
  await p.waitForSelector('#snapUndo');
  check('same photo again → from cache, no new server call', visionCalls === 1, `calls ${visionCalls}`);
  check('"or Roghni naan?" chip offered for the naan', /or Roghni naan\?/.test(await p.textContent('#foodPhotoBox')));
  await p.click('#foodPhotoBox [data-salt]');
  check('one tap swaps naan → roghni naan, and offers naan back', /Roghni naan/.test(await p.textContent('#foodPhotoBox .list')) && /or Naan\?/.test(await p.textContent('#foodPhotoBox')));
  const rowsBefore = (await rows()).length;
  await p.fill('#snapHint', 'restaurant karahi, 2 naan'); await p.click('#snapReread');
  await p.waitForFunction(() => /2 naans/.test(document.querySelector('#foodPhotoBox')?.textContent || ''), null, { timeout: 8000 });
  check('a note re-reads the photo and replaces the first try', lastVision.hint === 'restaurant karahi, 2 naan' && (await rows()).length === rowsBefore, `${rowsBefore} → ${(await rows()).length}`);
  // A whole pan for the table: logged, but asks whose share it is.
  await p.fill('#snapHint', 'whole pan for the table'); await p.click('#snapReread');
  await p.waitForSelector('[data-share="0.5"]', { timeout: 8000 });
  check('shared dish → "Is all of this yours?"', /Is all of this yours/.test(await p.textContent('#foodPhotoBox')));
  await p.click('[data-share="0.5"]');
  check('"Half" scales the pan to 2 katori', /2 katori/.test(await p.textContent('#foodPhotoBox .list')) && !(await p.isVisible('[data-share]')), await p.textContent('#foodPhotoBox .list'));
  // A stall's stack of naan: not logged unless the person says so.
  const beforeStall = (await rows()).length;
  await p.fill('#snapHint', 'naan stall'); await p.click('#snapReread');
  await p.waitForSelector('#snapForce', { timeout: 8000 });
  check('cooking/display photo is not logged automatically', /cooked or on display/.test(await p.textContent('#foodPhotoBox')));
  await p.click('#snapCancel');
  check('…and nothing was added', (await rows()).length <= beforeStall);
  await p.evaluate(() => { document.querySelector('#foodTargets').open = true; });
  await p.selectOption('#tPlate', '28');
  check('usual plate size is saved', await p.evaluate(() => JSON.parse(localStorage.getItem('shred_qk_v1')).food.plateCm === '28'));

  // Weekly report: seed a week of meals and weigh-ins, then reload.
  await p.evaluate(async () => {
    const N = await import('/js/nutrition.js');
    const s = JSON.parse(localStorage.getItem('shred_qk_v1')), DAY = 864e5, now = Date.now();
    const E = (d, id, o, meal) => ({ id: Math.random().toString(36).slice(2), at: now - d * DAY, ref: { t: 'dish', id }, opts: o, meal, name: N.DISH[id].name, label: '', ...N.estimate({ t: 'dish', id }, o) });
    for (let d = 1; d < 7; d++) s.food.log.push(E(d, 'paratha', {}, 'Breakfast'), E(d, 'chai', {}, 'Breakfast'), E(d, 'chicken_karahi', { style: 'restaurant' }, 'Lunch'), E(d, 'roti', { servings: 2 }, 'Lunch'), E(d, 'chicken_biryani', {}, 'Dinner'));
    s.food.weights = [0, 7, 14].map(d => ({ at: now - d * DAY, kg: 80 + d * 0.04 }));
    localStorage.setItem('shred_qk_v1', JSON.stringify(s));
  });
  await p.reload(); await p.click('.tabs [data-tab=food]');
  const wk = await p.textContent('#foodWeek');
  check('weekly report appears', /QK's food report/.test(wk) && /days logged/.test(wk));
  check('report opens with what went well', (await p.$$('#foodWeek .wins li')).length >= 1);
  check('report gives at most two things for next week', (await p.$$('#foodWeek .focus')).length <= 2 && (await p.$$('#foodWeek .focus')).length >= 1);
  check('report suggests more veg with the nutrients it brings', /colour/.test(wk) && /Vitamin C/.test(wk));
  check('report tone has no blaming words', !/\b(bad|fail|poor|deficien|too much|junk)/i.test(wk));
  await p.$eval('#foodWeek', el => el.scrollIntoView()); await shot('4-week');
  await p.fill('#wkKg', '79.6'); await p.click('#wkSave');
  check('weigh-in saved and updates the target weight', (await p.inputValue('#tWeight')) === '79.6');
  // UAE: calories printed on the menu become that item's numbers, now and next time.
  await p.fill('#foodSearch', 'bait al mandi'); await p.waitForTimeout(200);
  await p.click('#foodResults [data-menu]');
  check('a UAE place item offers "Menu shows calories?"', !!(await p.$('#fsMenuKcal')));
  await p.fill('#fsMenuKcal', '820');
  check('the menu number replaces the estimate', (await sheetKcal()) === 820, String(await sheetKcal()));
  await p.click('#fsSave');
  await p.fill('#foodSearch', 'bait al mandi'); await p.waitForTimeout(200);
  await p.click('#foodResults [data-menu]');
  check('next time it remembers the menu calories', (await sheetKcal()) === 820 && (await p.inputValue('#fsMenuKcal')) === '820');
  await p.click('#foodSheet .grab').catch(() => {}); await p.evaluate(() => { document.querySelector('#foodSheet').hidden = true; });
  await p.fill('#foodSearch', '');
  check('reminders default to just the essentials', (await p.inputValue('#tNotify')) === 'essential');
  // Diet plan: QK's questionnaire → exact amounts → one tap logs a meal.
  check('diet plan card offers the questionnaire', /Breakfast you like/.test(await p.textContent('#foodPlan')));
  await p.click('#foodPlan [data-pdiet=nobeef]');
  await p.click('#foodPlan [data-plike="breakfast|cornflakes"]');
  for (const k of ['paratha', 'bread', 'peanutButter']) await p.click(`#foodPlan [data-plike="breakfast|${k}"]`); // untick: cereal, eggs and roti mornings
  await p.click('#foodPlan [data-plan=make]');
  const plan = await p.textContent('#foodPlan');
  check('plan has 4 meals with options', (await p.$$('#foodPlan .plan-meal')).length === 4 && (await p.$$('#foodPlan .plan-opt')).length >= 6);
  check('plan gives exact amounts (grams, rotis)', /\d+ g raw/.test(plan) && /\d rotis?/.test(plan), plan.slice(0, 200));
  check('plan includes the cereal they asked for', /Cereal and milk/.test(plan));
  check('no beef when they said no beef', !/Beef/.test(plan));
  check('plan shows the target it was built for', /Target 3,010 kcal/.test(plan));
  await p.$eval('#foodPlan', el => el.scrollIntoView()); await shot('5-plan');
  const planBefore = (await rows()).length;
  await p.click('#foodPlan [data-plan=log]');
  check('"I ate this" logs every food in that option', (await rows()).length > planBefore + 1, `${planBefore} → ${(await rows()).length}`);
  await p.click('#foodPlan [data-plan=new]');
  check('"Show me other options" keeps the plan', (await p.$$('#foodPlan .plan-meal')).length === 4);
  await p.click('#foodPlan [data-plan=edit]');
  check('answers can be changed', /Meals a day/.test(await p.textContent('#foodPlan')) && (await p.$eval('#foodPlan [data-pdiet=nobeef]', el => el.classList.contains('on'))));
  await p.click('#foodPlan [data-plan=cancel]');
  // Weight graph over years, and the two-weekly check-in.
  await p.evaluate(() => {
    const k = 'shred_qk_v1', S = JSON.parse(localStorage.getItem(k)), D = 864e5, now = Date.now();
    // 18 months of weigh-ins from 92 kg down, then a flat last fortnight (a plateau).
    S.food.weights = Array.from({ length: 50 }, (_, i) => ({ at: now - (540 - i * 10.5) * D, kg: +(92 - i * 0.2).toFixed(1) }))
      .concat([{ at: now - 13 * D, kg: 82.2 }, { at: now - 9 * D, kg: 82.0 }, { at: now - 5 * D, kg: 82.3 }]);
    S.profile.dietGoal = 'lose'; S.profile.job = 'desk'; S.profile.trainDays = 4;
    S.food.adapt = { lastAt: now - 15 * D };
    localStorage.setItem(k, JSON.stringify(S));
  });
  await p.reload(); await p.click('.tabs [data-tab=food]');
  check('weight card shows a graph', !!(await p.$('#foodWeight svg.wchart')));
  await p.click('#foodWeight [data-range=all]');
  const wAll = await p.textContent('#foodWeight');
  check('"All" range spans the whole history', /in 5\d\d days/.test(wAll), wAll.match(/[−+-]?[\d.]+ kg in \d+ days/)?.[0]);
  check('check-in day is announced', /Check-in day/.test(wAll));
  await p.fill('#wkKg', '82.1'); await p.click('#wkSave');
  const ci = await p.textContent('#foodWeight');
  check('plateau while cutting → kind message, steps offered first', /paused/.test(ci) && /more steps a day/.test(await p.textContent('#foodWeight [data-choice]')), ci.slice(0, 160));
  const tk = async () => +(await p.textContent('#tSummary')).match(/([\d,]+) kcal/)[1].replace(/,/g, '');
  const kcalBefore = await tk();
  await p.click('#foodWeight [data-choice=kcal]');
  const kcalAfter = await tk();
  check('choosing "eat 150 less" lowers the target by 150', kcalBefore - kcalAfter === 150, `${kcalBefore} → ${kcalAfter}`);
  check('next check-in is in two weeks', /Next check-in in 1[34] days/.test(await p.textContent('#foodWeight')));
  await p.$eval('#foodWeight', el => el.scrollIntoView()); await shot('7-weight');
  // Scores on Today: shown with what unlocks them; tapping one explains it.
  await p.click('.tabs [data-tab=today]'); await p.waitForTimeout(200);
  const sc = await p.textContent('#scoreCard');
  check('Today shows the score card (health, fitness age, four scores)', /Health score/.test(sc) && /Fitness age/.test(sc) && /Nutrition/.test(sc) && /Workout/.test(sc), sc.slice(0, 160));
  await p.click('#scoreCard [data-score=nutrition]');
  check('tapping a score shows why and the next step', /Next step:|Fix first:/.test(await p.textContent('#scoreCard')));
  await p.$eval('#scoreCard', el => el.scrollIntoView()); await shot('8-scores');
  await p.click('.tabs [data-tab=food]');
  // Coach dashboard (sample mode): this phone's food shows on its card.
  await p.goto('https://shred.local/coach.html'); await p.waitForTimeout(700);
  await p.click('.cd-row'); await p.waitForTimeout(200);
  check('coach dashboard shows the client\'s food week', /Food · last 7 days/.test(await p.textContent('#cdDetail')) && /QK suggested/.test(await p.textContent('#cdDetail')));
  check('coach dashboard shows the client\'s scores', /Health/.test(await p.textContent('#cdDetail .cd-scores')));
  check('coach dashboard shows the client\'s diet plan', /Diet plan\s*[\d,]+ kcal/.test(await p.textContent('#cdDetail')), (await p.textContent('#cdDetail')).match(/Diet plan.{0,60}/)?.[0]);
  // QK edits the plan on the dashboard → the client's app shows it.
  check('dashboard shows the plan editor', !!(await p.$('#cdDetail .cd-plan input[data-amt]')));
  const firstOpt = async () => (await p.textContent('#cdDetail .cdp-opt .cdp-head')).match(/([\d,]+) kcal/)[1];
  const kBefore = await firstOpt();
  const amt = await p.$('#cdDetail .cd-plan input[data-amt]');
  const v = +(await amt.inputValue());
  await amt.fill(String(v * 2)); await amt.dispatchEvent('change');
  check('changing an amount updates the totals', (await firstOpt()) !== kBefore, `${kBefore} → ${await firstOpt()}`);
  check('save is enabled after an edit', !(await p.$eval('#cdPlanSave', b => b.disabled)));
  await p.click('#cdDetail .cdp-x');
  await p.fill('#cdPlanNote', 'More protein at breakfast');
  await p.click('#cdPlanSave');
  check('saved plan is marked as edited by QK', /edited by you/.test(await p.textContent('#cdDetail .cd-plan')));
  await p.goto('https://shred.local/'); await p.click('.tabs [data-tab=food]'); await p.waitForTimeout(300);
  const fp = await p.textContent('#foodPlan');
  check('client app shows QK\'s plan and note', /Edited by QK/.test(fp) && /More protein at breakfast/.test(fp), fp.slice(0, 120));
  await p.goto('https://shred.local/coach.html'); await p.waitForTimeout(700); await p.click('.cd-row'); await p.waitForTimeout(200);
  await shot('6-coach');
  check('no page errors', !errs.length, errs.join(' | '));
  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nfood e2e passed');
  process.exit(fails ? 1 : 0);
})();
