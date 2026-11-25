// End-to-end test: runs the real app in Chromium (fake camera) and clicks through every flow.
// Serves the files via request interception, so no web server is needed.
// Run: node tests/e2e.cjs   (needs Playwright + Chromium; not run in CI)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.task': 'application/octet-stream', '.webmanifest': 'application/manifest+json' };
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };

(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  // Service workers are blocked: their script fetch bypasses request interception, which only exists in this test.
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, acceptDownloads: true, serviceWorkers: 'block' });
  await ctx.route('https://shred.local/**', r => {
    let p = new URL(r.request().url()).pathname; if (p === '/') p = '/index.html';
    const f = path.join(ROOT, p);
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' } });
  });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && !/favicon|fonts\.g/.test(m.text()) && errs.push(m.text()));
  // Centre an element before tapping it, so the fixed tab bar never covers it.
  const tap = async sel => { await p.$eval(sel, el => el.scrollIntoView({ block: 'center' })); await p.click(sel); };
  const go = async id => {
    if (['gait', 'scan', 'rehab', 'calm'].includes(id)) { await go('body'); await p.click(`[data-go=${id}]`); }
    else await p.click(`.tabs [data-tab=${id}]`);
  };
  await p.goto('https://shred.local/');
  check('welcome: asks for a first name', await p.isVisible('#welcomeName'));
  await p.fill('#welcomeName', 'Sara'); await p.click('#welcomeBtn');
  check('today: greets by name', /Sara/.test(await p.textContent('#hello')));
  check('navigation: 4 tabs', (await p.$$('.tabs button')).length === 4);

  // Profile height enables height-scaled bar speed.
  await go('progress'); await tap('#profileCard summary'); await p.fill('#pHeight', '178'); await p.press('#pHeight', 'Tab'); await go('today');

  // 1. Demo set through the real engine
  await go('train'); await p.click('.ex-card.feature');
  check('setup: weight field shown for a barbell lift', await p.isVisible('#loadWrap'));
  await p.fill('#loadKg', '80'); await p.click('#startDemo');
  await p.waitForSelector('#summary:not([hidden])', { timeout: 60000 });
  check('demo set: 10 reps, 7 clean', (await p.textContent('#sReps')) === '10' && /7 clean/.test(await p.textContent('#sClean')));
  check('demo set: bar speed card shown (hip thrust is horizontal → asks for plate calibration)', await p.isVisible('#vbtCard') && /Calibrate|plate/.test(await p.textContent('#vbtNote')));
  check('summary: rest timer starts by itself', (await p.textContent('#restBtn')) === 'Pause');
  check('summary: weight pre-filled from the setup', (await p.inputValue('#setKg')) === '80');
  await p.click('#repPlus');
  check('summary: rep count can be corrected', (await p.textContent('#sReps')) === '11' && /left out of your form score/.test(await p.textContent('#sCompare')));
  await p.click('#doneBtn');
  await go('train'); await p.click('.ex-card.feature');
  check('setup: shows last time\'s weight', /Last time: 80 kg × 11/.test(await p.textContent('#setupLast')));
  await p.click('#setup', { position: { x: 5, y: 5 } });

  // 2. Library + voice-guided hold
  await go('train'); await p.click('[data-muscle=Core]');
  check('library: core filter', /15 exercises/.test(await p.textContent('#exCount')));

  // 3. Live camera form check (fake camera, no person) starts without errors
  await p.click('[data-muscle=All]'); await p.click('[data-train=squat]'); await p.click('#startCam'); await p.waitForTimeout(5000);
  check('camera: live squat session starts', await p.isVisible('#live') && (await p.textContent('#status')) === '');
  check('camera: Calibrate button shown for barbell lift', await p.isVisible('#calBtn'));
  await p.click('#calBtn'); await p.click('#viewport', { position: { x: 200, y: 200 } }); await p.click('#viewport', { position: { x: 200, y: 330 } });
  check('calibration: two taps accepted', /Calibrated/.test(await p.textContent('#status')));
  check('camera: angle numbers hidden by default', !(await p.isVisible('#readout')));
  await p.click('#endLive'); await p.click('#nextSet'); await p.waitForTimeout(1500);
  check('camera: Next set restarts the camera with no setup sheet', await p.isVisible('#live') && !(await p.isVisible('#setup')));
  await p.click('#endLive'); await p.click('#doneBtn');

  // 4. Tests tab: gait demo, jump + knee test panels, live test capture starts
  await go('gait'); await p.click('#gaitDemo');
  await p.waitForSelector('#gaitResult:not([hidden])', { timeout: 30000 });
  const gait = await p.textContent('#gaitResult');
  check('gait demo: report with quality badge and hip finding', /Quality 100\/100/.test(gait) && /hip extension \(right/i.test(gait));
  // Diagnostics: shows the last session (the gait demo) and exports it for replay
  await go('progress'); await tap('#diagCard summary'); await p.waitForTimeout(300);
  check('diagnostics: last session listed ', /gait · \d+ frames/.test(await p.textContent('#diagTable')), await p.textContent('#diagTable'));
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#exportSession')]);
  const json = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  check('diagnostics: exported session replayable (meta + frames)', json.meta.kind === 'gait' && json.frames.length > 10 && Array.isArray(json.frames[0].p));

  await tap('#diagCard summary'); await go('gait');
  await p.click('[data-test=jump]');
  check('jump panel shown, demo hidden', await p.isVisible('[data-panel=jump]') && !(await p.isVisible('#gaitDemo')));
  await p.click('[data-test=sls]'); await p.click('#testLive'); await p.waitForTimeout(6000);
  check('knee test: live capture runs (camera granted)', await p.isVisible('#live') && /Single-leg/.test(await p.textContent('#liveEyebrow')) && !/blocked/.test(await p.textContent('#status')));
  await p.click('#endLive'); await p.waitForTimeout(500);
  check('knee test with no person: refuses to give a result', /No result yet/.test(await p.textContent('#gaitResult')));

  // 5. Two-view scan rejects a non-neutral pose (the sample photo is a yoga lunge)
  await go('scan');
  await p.setInputFiles('#scanFront', process.argv[2] || path.join(ROOT, 'tests/pose.jpg')).catch(() => {});
  await p.waitForSelector('#toast:not([hidden])', { timeout: 60000 }).catch(() => {});
  check('two-view scan: lunge photo rejected with advice', /knees|arms|feet|Stand/.test(await p.textContent('#toast')));

  // 6. Rehab clinic: normal path (knee pain at the front) and an emergency red-flag path (back pain)
  await go('rehab'); await p.click('[data-area=Knee]'); await p.click('[data-cond=pfp]');
  const answerAll = async (yesIndex = -1) => {
    const rows = await p.$$('#flagList .flag-q');
    for (let i = 0; i < rows.length; i++) {
      const isDx = (await rows[i].getAttribute('data-i')) === 'dx';
      await (await rows[i].$(i === yesIndex || isDx ? '[data-v="1"]' : '[data-v="0"]')).click();
    }
  };
  await p.click('#safetyGo');
  check('rehab: safety screen requires every answer', /answer every/.test(await p.textContent('#safetyMsg')));
  await answerAll(); await p.click('#safetyGo');
  await p.fill('#act0', 'Walking downstairs'); await p.click('#startPlan');
  check('rehab: programme starts at phase 1 with exercises', /Phase 1 of 3/.test(await p.textContent('#rehabActive')) && (await p.$$('#rehabActive [data-train]')).length >= 4);
  await p.click('#checkinRehab'); await p.click('#saveCheckin');
  check('rehab: check-in gives a traffic light', /On track|Hold the load|Ease off/.test(await p.textContent('#rehabActive')));
  check('rehab: phase criteria listed and not yet met', (await p.$$('#rehabActive .crit')).length >= 3 && !(await p.$('#nextPhase')));
  await p.click('#rehabActive [data-romtest=kneeFlexion]'); await p.click('#rsheetBody [data-side]'); await p.waitForTimeout(6000);
  check('rehab: camera measurement starts', await p.isVisible('#live') && /Knee bend/.test(await p.textContent('#liveEyebrow')));
  await p.click('#endLive'); await p.waitForTimeout(800);
  check('rehab: no-person measurement refused safely', await p.isVisible('#rehabActive'));
  await go('today');
  check('today: rehab card shown', await p.isVisible('#rehabToday') && /Rehab · phase 1/.test(await p.textContent('#rehabToday')));
  await p.click('#rehabToday'); await p.click('#endPlan'); await p.click('#endYes');
  await p.click('[data-area="Lower back"]'); await p.click('[data-cond=lbp]');
  await answerAll(0); await p.click('#safetyGo');
  const alertText = await p.textContent('#rsheetBody');
  check('rehab: cauda equina red flag → emergency advice with 999', /Get emergency help now/.test(alertText) && /999/.test(alertText));
  await p.click('#stopOk');

  // 7. Readiness, load and Studio
  await go('today'); await p.click('[data-feel=great]');
  check('readiness: one tap "Great" → train as planned', /Train as planned/.test(await p.textContent('#readyTitle')), await p.textContent('#readyTitle'));
  await p.click('#morningCheck');
  for (const id of ['#rdS', '#rdF', '#rdT', '#rdM']) await p.fill(id, '6');
  await p.fill('#rdH', '5'); await p.click('#rdSave');
  check('readiness: poor check-in → lighter or recovery day', /lighter|Recovery/.test(await p.textContent('#readyTitle')), await p.textContent('#readyTitle'));
  await p.click('#logSession'); await p.fill('#mins', '60'); await p.click('#loadSave');
  await go('progress'); await p.waitForTimeout(300);
  check('load: weekly load shown in Progress', /300 points/.test(await p.textContent('#loadNow')) && !!(await p.$('#loadChart svg')));
  await go('progress'); await tap('#studioCard summary'); await p.waitForTimeout(400);
  check('studio: lists coaching lines', /of \d+ lines recorded/.test(await p.textContent('#studioCount')));
  await tap('#studioList [data-act=rec]'); await p.waitForTimeout(1200); await tap('#studioList [data-act=rec]'); await p.waitForTimeout(600);
  check('studio: record with the microphone and save a clip', /1 of \d+ lines recorded/.test(await p.textContent('#studioCount')) && /recorded/.test(await p.textContent('#studioList')));

  // 8. Sukoon calm session (recitation is blocked here, so the session must fall through to the dua)
  for (const host of ['everyayah.com', 'verses.quran.com', 'verses.quran.foundation']) await ctx.route(`https://${host}/**`, r => r.fulfill({ status: 200, body: '', headers: { 'content-type': 'audio/mpeg' } }));
  await go('calm');
  check('sukoon: 9 goals listed', (await p.$$('#calmGoals [data-goal]')).length === 9);
  await p.click('[data-goal=anger]');
  check('sukoon: goal shows its surah and evidence rating', /Al Imran 3:133–134/.test(await p.textContent('#calmDetail')) && /Evidence: moderate/.test(await p.textContent('#calmSettings')));
  await p.click('[data-goal=healing]');
  check('sukoon: 432 Hz goal is labelled weak evidence', /Evidence: weak/.test(await p.textContent('#calmSettings')));
  await p.click('[data-goal=anxiety]'); await tap('#calmStart'); await p.click('#cBefore [data-v="10"]');
  check('sukoon: tension 10 → support with emergency numbers first', /Get support now/.test(await p.textContent('#calmSheetBody')) && /116 123/.test(await p.textContent('#calmSheetBody')));
  await p.click('#cCont'); await p.waitForTimeout(1500);
  check('sukoon: breathing pacer runs', await p.isVisible('#calmPacer') && /Breathe (in|out)/.test(await p.textContent('#calmWord')));
  await p.click('#calmSkip'); await p.waitForTimeout(1500);
  check('sukoon: recitation failure offers the passage on Quran.com', await p.isVisible('#calmLinks a[href="https://quran.com/94/1-8"]'));
  await p.click('#calmSkip');
  check('sukoon: dua shown with its source', await p.isVisible('#calmDua') && /Bukhari 6369/.test(await p.textContent('#calmDua')));
  await p.click('#calmSkip'); await p.click('#cAfter [data-v="6"]');
  check('sukoon: before/after saved to history', /10 → 6/.test(await p.textContent('#calmList')) && /−4/.test(await p.textContent('#calmTrend')));
  // A phone that blocks sound not started by a tap must get a Play button, not a skipped recitation.
  for (const host of ['everyayah.com', 'verses.quran.com', 'verses.quran.foundation']) { await ctx.unroute(`https://${host}/**`); await ctx.route(`https://${host}/**`, () => {}); } // audio stays loading
  await p.evaluate(() => { const real = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { return /^https:/.test(this.src) ? Promise.reject(new DOMException('blocked', 'NotAllowedError')) : real.call(this); }; });
  await tap('#calmStart'); await p.click('#cBefore [data-v="5"]'); await p.waitForTimeout(800); await p.click('#calmSkip'); await p.waitForTimeout(500);
  check('sukoon: blocked autoplay → Play recitation button', await p.isVisible('#calmPlay') && await p.isVisible('#calmVerse'));
  await p.click('#calmEnd'); await p.click('#cSave');

  // 9. You screen: weekly message to QK and backup
  await go('progress'); await tap('#sendWeek'); await p.waitForTimeout(500);
  check('send week: summary shared, copied or shown', await p.isVisible('#weekText') || /Copied/.test(await p.textContent('#toast')));
  if (await p.isVisible('#weekText')) check('send week: summary has days and form score', /Trained \d+ of \d+/.test(await p.textContent('#weekText')));

  // 10. Returning client skips the welcome; the home-screen shortcut opens Sukoon
  await p.reload(); await p.waitForTimeout(800);
  check('returning client: no welcome screen', !(await p.isVisible('#welcome')) && await p.isVisible('#today'));
  await p.goto('https://shred.local/?calm=now'); await p.waitForTimeout(800);
  check('shortcut: ?calm=now opens the Sukoon rating', await p.isVisible('#calm') && await p.isVisible('#cBefore'));

  // Map my body: demo calibration → personal body map sheet.
  await p.goto('https://shred.local/'); await go('body'); await tap('#bodyMapTile');
  check('body map: intro explains the one-minute calibration', /Map my body/.test(await p.textContent('#rsheetBody')));
  await p.click('[data-bm=demo]');
  await p.waitForFunction(() => /QK now coaches your body/.test(document.querySelector('#rsheetBody')?.textContent || '') && !document.querySelector('#rsheet').hidden, null, { timeout: 90000 });
  const bm = await p.textContent('#rsheetBody');
  check('body map: fits several movements, with reasons', /Forward lean allowed/.test(bm) && /Hinge depth/.test(bm) && /Long thighs/.test(bm) && /Tight hamstrings/.test(bm));
  await p.click('[data-bm=close]');
  check('no JavaScript errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
