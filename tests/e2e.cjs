// End-to-end test: runs the real app in Chromium (fake camera) and clicks through every flow.
// Serves the files via request interception, so no web server is needed.
// Run: node tests/e2e.cjs   (needs Playwright + Chromium; not run in CI)
const { launch, openCycle: openCycleScreen } = require('./browser.cjs'); // E2E_BROWSER=chromium|firefox|webkit
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.task': 'application/octet-stream', '.webmanifest': 'application/manifest+json' };
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };

(async () => {
  const b = await launch({ chromiumArgs: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'], firefoxUserPrefs: { 'media.navigator.streams.fake': true, 'media.navigator.permission.disabled': true } });
  // Service workers are blocked: their script fetch bypasses request interception, which only exists in this test.
  // WebKit has no fake-camera switch: grant camera access the way a person taps "Allow" (Chromium and Firefox do this
  // through their fake-media options above). Without it the app correctly shows "Camera blocked".
  const camPerm = b.browserType().name() === 'webkit' ? { permissions: ['camera', 'microphone'] } : {};
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, acceptDownloads: true, serviceWorkers: 'block', ...camPerm });
  const serve = r => {
    let p = new URL(r.request().url()).pathname; if (p === '/') p = '/index.html';
    const f = path.join(ROOT, p);
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' } });
  };
  await ctx.route('https://shred.local/**', serve);
  // Simulated demo lifters are hidden in the app; this switch turns them on for the test run only.
  await ctx.addInitScript(() => { try { localStorage.setItem('qk_demo', '1'); } catch {} });
  // Quick log (weight, reps, how it felt) is the app's default. Most checks below exercise the camera flow, so they
  // run with camera logging chosen; the quick-log block switches back to the default and checks it.
  await ctx.addInitScript(() => { try { const k = 'shred_qk_v1', S = JSON.parse(localStorage.getItem(k) || '{}'); S.prefs ||= {}; if (!S.prefs.logMode) { S.prefs.logMode = 'camera'; localStorage.setItem(k, JSON.stringify(S)); } } catch {} });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && !/favicon|fonts\.g/.test(m.text()) && errs.push(m.text()));
  // Centre an element before tapping it, so the fixed tab bar never covers it.
  const tap = async sel => { await p.$eval(sel, el => el.scrollIntoView({ block: 'center' })); await p.click(sel); };
  const go = async id => {
    if (id === 'body') { await go('today'); await p.click('#today [data-go=body]'); }
    else if (['gait', 'scan', 'rehab', 'calm', 'vitals', 'reader'].includes(id)) { await go('body'); await p.click(`#body [data-go=${id}]`); }
    else await p.click(`.tabs [data-tab=${id}]`);
  };
  await p.goto('https://shred.local/');
  // The pose features need WebGL. Headless Firefox here has none, so in that case the honest message is checked
  // instead, and the log says the pose analysis itself was NOT tested in this browser.
  const webgl = await p.evaluate(() => { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); });
  if (!webgl) console.log('note: this browser has no WebGL here, so camera and photo pose analysis were NOT tested; the no-WebGL message was checked instead');
  check('welcome: asks for a first name', await p.isVisible('#welcomeName'));
  await p.fill('#welcomeName', 'Sara'); await p.click('#welcomeBtn');
  // Merge 2026-11-27: our optional "about you" step (js/onboarding.js) comes right after the name; skipped here.
  check('first run: an optional "which best describes you?" step', await p.isVisible('#obAbout') && /describes you/i.test(await p.textContent('#obAbout')));
  await p.click('#aboutNext');
  check('first run: asks what they want help with', await p.isVisible('[data-focus=train]') && await p.isVisible('[data-focus=recover]') && await p.isVisible('[data-focus=calm]'));
  await p.click('[data-focus=train]');
  check('first run: asks their goal', await p.isVisible('#obGoals') && (await p.$$('#obGoals [data-goal]')).length >= 10);
  await p.click('[data-goal=muscle]');
  check('first run: asks how long they have been lifting', await p.isVisible('[data-exp=new]'));
  await p.click('[data-exp=trained]');
  check('first run: picks the program and suggests days', /Hypertrophy Lab/.test(await p.textContent('#obDaysNote')), await p.textContent('#obDaysNote'));
  check('first run: training → asks which days', await p.isVisible('#obDays'));
  await p.click('#obDays [data-day="1"]'); await p.click('#obDays [data-day="3"]'); await p.click('#obDone');
  check('today: greets by name', /Sara/.test(await p.textContent('#hello')));
  // Merge 2026-11-27: the bar also holds a Cycle tab, hidden unless she chose to track her periods, so this counts the
  // visible tabs and checks the Cycle tab stays hidden for this user.
  check('navigation: 4 tabs (Today, Train, Food, Me); the Cycle tab stays hidden', (await p.$$('.tabs button:not([hidden])')).length === 4 && /Food/.test(await p.textContent('.tabs')) && await p.$eval('.tabs [data-tab=cycle]', b => b.hidden));
  check('today: one next step with one main button', await p.isVisible('#nextCard') && (await p.textContent('#nextCta')).length > 0, await p.textContent('#nextTitle'));
  check('today: quick buttons for calm, brain and all tools', await p.isVisible('#today [data-go=calm-now]') && await p.isVisible('#today [data-go=brain]') && await p.isVisible('#today [data-go=body]'));
  await p.click('[data-feel=great]');
  check('today: after the check-in the feel buttons fold away', !(await p.isVisible('[data-feel=ok]')) && await p.isVisible('#readyChange'));

  // Profile height enables height-scaled bar speed.
  await go('progress'); await tap('#profileCard summary'); await p.fill('#pHeight', '178'); await p.press('#pHeight', 'Tab'); await go('today');

  // 1. Demo set through the real engine
  await go('train'); await tap('#exOpen'); await p.click('.ex-card.feature');
  check('setup: weight field shown for a barbell lift', await p.isVisible('#loadWrap'));
  await p.fill('#loadKg', '80'); await p.click('#startDemo');
  await p.waitForSelector('#summary:not([hidden])', { timeout: 60000 });
  check('demo set: 10 reps, 7 clean', (await p.textContent('#sReps')) === '10' && /7 clean/.test(await p.textContent('#sClean')));
  check('accuracy: after a camera set, "Was QK right?" with one-tap answers', await p.isVisible('#wasRight') && (await p.$$('#wasRight [data-wr]')).length === 3);
  await p.click('#wasRight [data-wr="right"]'); await p.waitForTimeout(100);
  check('accuracy: the answer is saved as a label (numbers only)', await p.evaluate(() => { const l = (JSON.parse(localStorage.getItem('shred_qk_v1')).labels || []); return l.length === 0 || (l[0].verdict === 'right' && !('video' in l[0])); }));
  check('demo set: bar speed card shown (hip thrust is horizontal → asks for plate calibration)', await p.isVisible('#vbtCard') && /Calibrate|plate/.test(await p.textContent('#vbtNote')));
  check('summary: rest timer starts by itself', (await p.textContent('#restBtn')) === 'Pause');
  check('summary: weight pre-filled from the setup', (await p.inputValue('#setKg')) === '80');
  check('first time on a lift: "How many more reps could you have done?"', await p.isVisible('#rirBox'));
  await p.click('#rirSeg [data-rir="3.5"]'); await p.waitForTimeout(100);
  check('first time: the answer sets the next set\'s weight', /Next set: \d+(\.\d+)? (kg|lb)/.test(await p.textContent('#rirNote')), await p.textContent('#rirNote'));
  await p.click('#repPlus');
  check('summary: rep count can be corrected', (await p.textContent('#sReps')) === '11' && /left out of your form score/.test(await p.textContent('#sCompare')));
  await p.click('#doneBtn');
  await go('train'); await p.click('.ex-card.feature');
  check('setup: shows last time\'s weight', /Last time: 80 kg × 11/.test(await p.textContent('#setupLast')));
  await p.click('#setup', { position: { x: 5, y: 5 } });

  // 2. Library + voice-guided hold
  await go('train'); await p.click('[data-muscle=Core]');
  const coreN = await p.evaluate(async () => (await import('/js/library.js')).LIBRARY.filter(x => !x.rehab && x.muscles.includes('Core')).length);
  check('library: core filter', new RegExp(`^${coreN} exercises`).test(await p.textContent('#exCount')) && coreN > 15, `${coreN}`);

  // 3. Live camera form check (fake camera, no person) starts without errors
  await p.click('[data-muscle=All]'); await p.click('[data-train=squat]'); await p.click('#startCam'); await p.waitForTimeout(5000);
  if (webgl) check('camera: live squat session starts', await p.isVisible('#live') && (await p.textContent('#status')) === '');
  else check('camera: no WebGL → says the browser needs graphics acceleration (WebGL)', /WebGL/.test(await p.textContent('#status')), await p.textContent('#status'));
  check('camera: Calibrate button shown for barbell lift', await p.isVisible('#calBtn'));
  await p.click('#calBtn'); await p.click('#viewport', { position: { x: 200, y: 200 } }); await p.click('#viewport', { position: { x: 200, y: 330 } });
  { const st = await p.textContent('#status'); check('calibration: two taps accepted', /Calibrated/.test(st), st); }
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

  // Sports screens: landing test and bowling action.
  await p.click('[data-test=land]');
  check('landing test: panel shown', await p.isVisible('[data-panel=land]') && /Record 3 landings/.test(await p.textContent('#testLiveLbl')));
  await p.click('#testLive'); await p.waitForTimeout(5000);
  check('landing test: live capture runs', await p.isVisible('#live') && /Landing test/.test(await p.textContent('#liveEyebrow')));
  await p.click('#endLive'); await p.waitForTimeout(500);
  check('landing test with no person: no result', /No result yet/.test(await p.textContent('#gaitResult')));
  await p.click('[data-test=bowl]');
  check('bowling check: arm and camera choices, slow-motion advice', await p.isVisible('#bowlArm') && await p.isVisible('#bowlView') && /slow motion/.test(await p.textContent('[data-panel=bowl]')));

  // 5. Two-view scan rejects a non-neutral pose (the sample photo is a yoga lunge)
  await go('scan');
  await p.setInputFiles('#scanFront', process.argv[2] || path.join(ROOT, 'tests/pose.jpg')).catch(() => {});
  await p.waitForSelector('#toast:not([hidden])', { timeout: 60000 }).catch(() => {});
  if (webgl) check('two-view scan: lunge photo rejected with advice', /knees|arms|feet|Stand/.test(await p.textContent('#toast')), await p.textContent('#toast'));
  else check('two-view scan: no WebGL → says the browser needs graphics acceleration (WebGL)', /WebGL/.test(await p.textContent('#toast')), await p.textContent('#toast'));

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
  check('rehab: assessment step follows the safety check', /Step 2 of 3/.test(await p.textContent('#rsheetBody')));
  await p.fill('#act0', 'Walking downstairs');
  await p.click('#aSettle [data-v=nextDay]'); await p.click('#seePlan');
  const planText = await p.textContent('#rsheetBody');
  check('rehab: plan shows a gentle start for pain lasting to the next day', /Step 3 of 3/.test(planText) && /Gentle start/.test(planText) && /2\/10/.test(planText), planText.slice(0, 200));
  check('rehab: plan never promises a cure and says no clinician checked it', !/cure|guarantee/i.test(planText) && /no clinician has checked it/.test(planText));
  await p.click('#startPlan');
  check('rehab: programme starts at phase 1 with exercises', /phase 1 of 3/i.test(await p.textContent('#rehabActive')) && (await p.$$('#rehabActive [data-train]')).length >= 4);
  check('rehab: gentle start takes a set off (wall sit 5×30 s → 4×30 s)', /4×30 s/.test(await p.textContent('#rehabActive')));
  await p.click('#checkinRehab'); await p.click('#saveCheckin');
  check('rehab: check-in gives a traffic light', /On track|Hold the load|Ease off/.test(await p.textContent('#rehabActive')));
  check("rehab: second check-in the same day updates instead of adding", /Update today's check-in/.test(await p.textContent('#checkinRehab')));
  await p.click('#checkinRehab'); await p.click('#saveCheckin');
  check('rehab: two check-ins in one day count as one day', /1\/3 days checked in/.test(await p.textContent('#rehabActive')));
  check('rehab: programme log records the start', /Start:/.test(await p.textContent('#rehabActive')));
  check('rehab: a diagnosed condition is not held in phase 1', !/stays in phase 1/.test(await p.textContent('#rehabActive')));
  check('rehab: no clinic wording on the programme screen', !/clinic notes|patient file|care plan|treatment/i.test(await p.textContent('#rehabActive')));
  check('rehab: phase criteria listed and not yet met', (await p.$$('#rehabActive .crit')).length >= 3 && !(await p.$('#nextPhase')));
  await p.click('#rehabActive [data-romtest=kneeFlexion]'); await p.click('#rsheetBody [data-side]'); await p.waitForTimeout(6000);
  check('rehab: camera measurement starts', await p.isVisible('#live') && /Knee bend/.test(await p.textContent('#liveEyebrow')));
  await p.click('#endLive'); await p.waitForTimeout(800);
  check('rehab: no-person measurement refused safely', await p.isVisible('#rehabActive'));
  check('rehab: failed measurement asks camera or movement', /Was it the camera, or the movement\?/.test(await p.textContent('#rsheetBody')));
  await p.click('#rfCant');
  check("rehab: \"couldn't do it\" is written to the programme log", /couldn't do the movement/.test(await p.textContent('#rehabActive')));
  await go('today');
  check('today: next step is the rehab session', /Rehab · phase 1/.test(await p.textContent('#nextEyebrow')) && /Start rehab/.test(await p.textContent('#nextCta')), await p.textContent('#nextEyebrow'));
  await p.click('#nextBtn'); await p.click('#endPlan'); await p.click('#endYes');
  // 6b. Camera movement check (knee): every step skipped, so the plan shows what was skipped and starts the general programme.
  await p.click('[data-area=Knee]'); await p.click('[data-screen=Knee]');
  check('movement check: safety screen has no "diagnosed?" question', !(await p.$('#flagList [data-i=dx]')));
  await answerAll(); await p.click('#safetyGo');
  check('movement check: 4 steps', /Step 2 of 4/.test(await p.textContent('#rsheetBody')));
  await p.click('#actHints [data-hint=Stairs]');
  check('movement check: tapping an activity fills it in', (await p.inputValue('#act0')) === 'Stairs');
  await p.click('#seePlan');
  check('movement check: first test is the left knee bend', /1 of 5/.test(await p.textContent('#rsheetBody')) && /Knee bend · left/.test(await p.textContent('#rsheetBody')));
  await p.click('#scrPain'); for (let i = 0; i < 4; i++) await p.click('#scrCant');
  const scrPlan = await p.textContent('#rsheetBody');
  check('movement check: plan lists what could not be done and names no diagnosis', /Step 4 of 4/.test(scrPlan) && /too painful to do/.test(scrPlan) && /couldn't get into position/.test(scrPlan) && !/ACL|meniscus|patellofemoral|tear/i.test(scrPlan));
  check("movement check: tests not done → gentle start and physio advised", /Gentle start/.test(scrPlan) && /See a physio before going further/.test(scrPlan));
  await p.click('#startPlan');
  check('movement check: general knee programme starts', /Knee pain \(movement check\)/.test(await p.textContent('#rehabTitle')) && /phase 1 of 3/i.test(await p.textContent('#rehabActive')));

  check('movement check: held in phase 1 until a physio has assessed', /until a physio has assessed you/.test(await p.textContent('#rehabActive')));

  // Phone on the limb: fake the motion sensor. Thigh flat (90° from vertical), shin 30° behind vertical → 120° knee bend.
  await p.click('#rehabActive [data-romtest=kneeFlexion]');
  check('sensor: phone-on-limb is offered first for the knee bend, with no accuracy claim', await p.isVisible('#romSensor') && /phone on your leg/.test(await p.textContent('#romSensor')) && !/accurate/i.test(await p.textContent('#rsheetBody')));
  // Answer the motion-sensor prompt "Allow" inside the page. (context.grantPermissions would replace the page's other
  // permissions and break the camera checks that follow.)
  await p.evaluate(() => { if (window.DeviceMotionEvent) DeviceMotionEvent.requestPermission = async () => 'granted'; });
  await p.click('#romSensor'); await p.click('#snGo');
  await p.evaluate(async () => {
    const g = 9.81, r = d => d * Math.PI / 180, wait = ms => new Promise(res => setTimeout(res, ms));
    const emit = async (deg, ms, wobble = 0) => { const end = performance.now() + ms; let i = 0; while (performance.now() < end) { const d = deg + (wobble ? Math.sin(i++) * wobble : 0); window.dispatchEvent(new DeviceMotionEvent('devicemotion', { accelerationIncludingGravity: { x: 0, y: g * Math.cos(r(d)), z: g * Math.sin(r(d)) } })); await wait(16); } };
    for (let t = 0; t < 3; t++) { await emit(90, 2300); await emit(30, 400, 40); await emit(-30 - t, 2300); await emit(30, 400, 40); }
  });
  await p.waitForTimeout(400);
  const sensorLog = await p.textContent('#rehabActive');
  check('sensor: three tries saved as a phone-on-limb knee bend of about 120°', /Knee bend: 12[0-2](\.\d)? degrees( \(left\))?, phone on limb/.test(sensorLog), (sensorLog.match(/Knee bend:[^.]*\./) || [''])[0] + ' | sheet: ' + (await p.isVisible('#snStatus') ? await p.textContent('#snTry') + ' / ' + await p.textContent('#snStatus') : 'closed'));
  check('sensor: measurement row says phone on limb', /phone on limb/.test(sensorLog));

  // Strength check and overall rating.
  await p.click('#rehabActive [data-strength=slSitToStand]'); await p.fill('#stReps', '8'); await p.click('#stSave');
  check('strength: single-leg sit-to-stand saved for the injured side', /L 8 · R – reps/.test(await p.textContent('#rehabActive')));
  await p.click('#rateOverall'); await p.evaluate(() => { const s = document.querySelector('#sane'); s.value = '60'; s.dispatchEvent(new Event('input')); }); await p.click('#rateSave');
  check('rating: overall rating shows 60% of normal', /60%/.test(await p.textContent('#rehabActive')));

  // Clinician mode: set up a PIN, confirm a diagnosis, check it is logged and on the report.
  await p.click('#clinicianBtn');
  await p.fill('#cName', 'Sara Ahmed'); await p.fill('#cPin', '4829'); await p.fill('#cPin2', '4829'); await p.click('#cSave');
  check('clinician: panel opens after setup', /Clinician mode · Sara Ahmed/.test(await p.textContent('#rsheetBody')));
  await p.fill('#clDynL', '18'); await p.fill('#clDynR', '25'); await p.click('#clDynSave');
  check('clinician: dynamometer reading saved', /Dynamometer reading saved/.test(await p.textContent('#rsheetBody')));
  await p.fill('#clValRef', '118'); await p.click('#clValSave');
  check('clinician: goniometer pair saved; no summary or study export below 5 pairs', /Pair saved/.test(await p.textContent('#rsheetBody')) && /summary appears after 5 pairs/.test(await p.textContent('#rsheetBody')) && !(await p.$('#clValCsv')));
  await p.selectOption('#clCond', 'pfp'); await p.click('#clDx');
  check('clinician: confirming a diagnosis switches the programme', /front of the knee/.test(await p.textContent('#rehabTitle')));
  await p.click('#clPh');
  check('clinician: setting a phase without a reason is refused', /reason/i.test(await p.textContent('#clMsg')));
  await p.click('#clDone');
  check('clinician: programme shows who confirmed it', /confirmed by Sara Ahmed/i.test(await p.textContent('#rehabActive')));
  await p.click('#clinicianBtn'); await p.fill('#cPin', '0000'); await p.click('#cOpen');
  check('clinician: wrong PIN refused', /Wrong PIN/.test(await p.textContent('#cMsg')));
  await p.click('#rsheet', { position: { x: 5, y: 5 } }).catch(() => {});
  await p.evaluate(() => { document.querySelector('#rsheet').hidden = true; });
  await p.click('#shareReport');
  const rep = await p.textContent('#rsheetBody');
  check('report: shows the programme, the clinician and the disclaimer', /Progress report/.test(rep) && /Sara Ahmed/.test(rep) && /not a diagnosis/i.test(rep));
  check('report: shows the method and strength, and says accuracy is not yet tested', /phone on limb/.test(rep) && /Strength/.test(rep) && /not yet been tested/.test(rep));
  await p.evaluate(() => { document.querySelector('#rsheet').hidden = true; });
  await p.click('#endPlan'); await p.click('#endYes');
  await p.click('[data-area="Lower back"]'); await p.click('[data-cond=lbp]');
  await answerAll(0); await p.click('#safetyGo');
  const alertText = await p.textContent('#rsheetBody');
  check('rehab: cauda equina red flag → emergency advice with the local number', /Get emergency help now/.test(alertText) && /998|999|911/.test(alertText));
  await p.click('#stopOk');

  // 7. Readiness, load and Studio
  await go('today'); if (await p.isVisible('#readyChange')) await p.click('#readyChange'); await p.click('[data-feel=great]');
  check('readiness: one tap "Great" → train as planned', /Train as planned/.test(await p.textContent('#readyTitle')), await p.textContent('#readyTitle'));
  await p.click('#readyChange'); await p.click('#morningCheck');
  for (const id of ['#rdS', '#rdF', '#rdT', '#rdM']) await p.fill(id, '6');
  await p.fill('#rdH', '5'); await p.click('#rdSave');
  check('readiness: poor check-in → lighter or recovery day', /lighter|Recovery/.test(await p.textContent('#readyTitle')), await p.textContent('#readyTitle'));
  await p.click('#logSession'); await p.fill('#mins', '60'); await p.click('#loadSave');
  await go('progress'); await p.waitForTimeout(300);
  check('load: weekly load shown in Progress', /300 points/.test(await p.textContent('#loadNow')) && !!(await p.$('#loadChart svg')));
  await go('progress'); await tap('#studioCard summary'); await p.waitForTimeout(400);
  check('studio: lists coaching lines', /of \d+ lines recorded/.test(await p.textContent('#studioCount')));
  if (!(await p.evaluate(() => !!window.MediaRecorder))) {
    // Playwright's Linux WebKit build has no MediaRecorder (Safari has had it since 14.1). Recording itself can't be
    // tested in that browser, so check the honest message instead and say so in the log.
    console.log('note studio: this browser build has no MediaRecorder, so recording itself was NOT tested here');
    await tap('#studioList [data-act=rec]'); await p.waitForTimeout(400);
    check('studio: a browser that can\'t record says so (not "allow microphone")', /can't record audio/.test(await p.textContent('#toast')), await p.textContent('#toast'));
  } else {
  await tap('#studioList [data-act=rec]'); await p.waitForTimeout(1200); await tap('#studioList [data-act=rec]'); await p.waitForTimeout(600);
  check('studio: record with the microphone and save a clip', /1 of \d+ lines recorded/.test(await p.textContent('#studioCount')) && /recorded/.test(await p.textContent('#studioList')));
  }

  // 8. Cycle tracking prototype (synthetic data): off by default, consent-gated, encrypted, deletable
  p.on('dialog', d => d.accept());
  const dayStr = n => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const cy = async (sel, ms = 350) => { await tap(sel); await p.waitForTimeout(ms); };
  await go('body');
  check('cycle: hidden by default (flag off)', !(await p.isVisible('#cycleTile')));
  await go('progress'); await tap('#diagCard summary'); await tap('#flagCycle'); await tap('#diagCard summary');
  await go('body'); check('cycle: tile shown once the prototype flag is on', await p.isVisible('#cycleTile'));
  await p.click('[data-go=cycle]'); await p.waitForSelector('#cyConsent');
  check('cycle: consent screen first, says no sharing and not contraception', /not contraception/.test(await p.textContent('#cyConsent')) && /Nothing is shared/.test(await p.textContent('#cyConsent')));
  await cy('[data-act=consent]');
  check('cycle: consent needs the box ticked', await p.isVisible('#cyConsent'));
  await p.check('#cyAgree'); await cy('[data-act=consent]', 600); await p.waitForSelector('#cyEstimate');
  check('cycle: no history → "not enough data", no range', /Not enough data/.test(await p.textContent('#cyHeadline')) && !(await p.$('.cy-range')));
  for (const n of [-161, -132, -101, -71, -41, -10]) { await p.fill('#cyDate', dayStr(n)); await cy('[data-act=logStart]'); }
  const detail = await p.textContent('#cyDetail');
  check('cycle: 5 cycles → dates from past cycles, explained, never called a prediction interval', /From your past cycles/.test(await p.textContent('#cyHeadline')) && /between 29 and 31 days/.test(detail) && await p.isVisible('.cy-range') && !/Estimated range/.test(await p.textContent('#cyEstimate')), detail);
  check('cycle: "may come earlier or later" is visible without opening any section', await p.isVisible('#cyOutside') && /earlier or later/.test(await p.textContent('#cyOutside')));
  await p.fill('#cyDate', dayStr(-3)); await cy('[data-act=logSpotting]');
  check('cycle: spotting logged without changing the estimate', (await p.textContent('#cyDetail')) === detail);
  await tap('#cyHistory summary');
  await p.$eval('#cyHistory [data-pid] [data-edit=start]', (el, v) => { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, dayStr(-16)); await p.waitForTimeout(500);
  check('cycle: correcting the latest start updates the estimate', /between 25 and 31 days/.test(await p.textContent('#cyDetail')), await p.textContent('#cyDetail'));
  await tap('#cySettings summary'); await cy('#cySettings [data-cat=energy]', 500);
  await p.selectOption('#cyLog [data-sym=energy]', 'low'); await cy('[data-act=saveDay]');
  check('cycle: optional symptom (energy) logged after switching it on', /\(current\)[\s\S]*energy low/.test(await p.textContent('#cyHistory')));
  check('cycle: symptom-pattern findings hidden by default (research flag off)', !(await p.$('#cyPatterns')) && !(await p.$('#cyInsight')));
  await cy('#cySettings [data-flag=patternInsights]', 500);
  check('cycle: research flag on → pattern card shown, labelled unvalidated', /Energy: not enough data/.test(await p.textContent('#cyPatterns')) && /unvalidated/.test(await p.textContent('#cyPatterns')));
  await cy('[data-act=remindersOn]', 500); await cy('[data-act=addRem]', 500);
  check('cycle: reminder added with its next time and reason', (await p.$$('#cyReminders [data-rid]')).length === 1 && /You asked for a daily reminder/.test(await p.textContent('#cyReminders')));
  await cy('#cyReminders [data-act=pauseRem]', 500);
  check('cycle: reminder paused', /Resume/.test(await p.textContent('#cyReminders [data-rid]')));
  await cy('#cyReminders [data-act=delRem]', 500);
  check('cycle: reminder deleted', (await p.$$('#cyReminders [data-rid]')).length === 0);
  await cy('[data-act=wearableOn]', 1500);
  const wtxt = await p.textContent('#cyWearable');
  check('cycle: demo wearable labelled synthetic, skin temp not core temp, DS07 unavailable', /synthetic demo/.test(wtxt) && /°C/.test(wtxt) && /Not core body temperature/.test(wtxt) && /SWL DS07 \(not available\)/.test(wtxt), wtxt.slice(0, 200));
  await cy('#cySettings [data-flag=phaseEducation]', 500);
  check('cycle: phase education (opt-in) has a "not enough data" state, no day-14 assumption', /Not enough data|Menstruation/.test(await p.textContent('#cyPhase')) && !/day 14/i.test(await p.textContent('#cyPhase')));
  // Encrypted record now lives in IndexedDB (transactional store); read it raw, as an attacker with storage access would.
  const rawRecord = pg => pg.evaluate(async () => { const m = await import('/js/cycle/store.js'); return m.indexedDbStorage().snapshot(localStorage.getItem('shred_cycle_uid')); });
  const ls = await p.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  const rec = await rawRecord(p);
  check('cycle: stored encrypted in IndexedDB (no dates or words in the stored value)', !!rec.text && /AES-GCM/.test(rec.text) && !/20\d\d-|spotting|energy/.test(rec.text));
  check('cycle: no cycle record left in localStorage', !Object.keys(ls).some(k => k.startsWith('shred_cycle_v1:')));
  check('cycle: nothing cycle-related in the main store or error log', !/spotting|period|energy|cycle/i.test((ls.shred_qk_v1 || '') + (ls.shred_errors_v1 || '')));
  const [cdl] = await Promise.all([p.waitForEvent('download'), tap('[data-act=export]')]);
  const exp = JSON.parse(fs.readFileSync(await cdl.path(), 'utf8'));
  check('cycle: export contains the user\'s data', exp.format === 'shred-cycle-export' && exp.data.periods.length === 6);
  await cy('[data-act=deleteAll]', 800);
  const after = await rawRecord(p);
  check('cycle: delete all → data gone and consent asked again', await p.isVisible('#cyConsent') && after.text === null);

  // Two tabs (audit of 9f87b83, findings 1.1 and 1.3): no lost updates, and a deletion can't be undone by another tab
  await p.check('#cyAgree'); await cy('[data-act=consent]', 600);
  const q = await ctx.newPage(); q.on('dialog', d => d.accept()); q.on('pageerror', e => errs.push('tab2: ' + e.message));
  await q.goto('https://shred.local/'); await openCycleScreen(q); await q.waitForSelector('#cyLog');
  await p.fill('#cyDate', dayStr(-40)); await cy('[data-act=logStart]', 500);
  await q.fill('#cyDate', dayStr(-10)); await q.click('[data-act=logStart]'); await q.waitForTimeout(600);
  await p.waitForTimeout(400); if (!(await p.$('#cyHistory[open]'))) await tap('#cyHistory summary');
  const both = await p.$$eval('#cyHistory [data-edit=start]', els => els.map(e => e.value).sort());
  check('two tabs: entries from both tabs are kept (no lost update)', JSON.stringify(both) === JSON.stringify([dayStr(-40), dayStr(-10)].sort()), JSON.stringify(both));
  if (!(await p.$('#cySettings[open]'))) await tap('#cySettings summary');
  await cy('[data-act=deleteAll]', 800);
  await q.waitForTimeout(600);
  check('two tabs: the other tab clears itself after a delete elsewhere', await q.isVisible('#cyConsent'));
  const slotsAfter = (await rawRecord(p)).text === null ? 0 : 1;
  await p.reload(); await openCycleScreen(p); await p.waitForTimeout(700);
  check('two tabs: after delete + reload, nothing comes back and no "can\'t unlock" error', slotsAfter === 0 && await p.isVisible('#cyConsent') && !(await p.$('#cyUnavailable')));
  await q.close();
  // Recovery path (finding 1.4): unreadable data → reset button → consent screen
  await p.evaluate(async () => { // write an unreadable record straight into IndexedDB
    const uid = localStorage.getItem('shred_cycle_uid'), m = await import('/js/cycle/store.js'), snap = await m.indexedDbStorage().snapshot(uid);
    await new Promise((res, rej) => { const r = indexedDB.open('shred_cycle_keys', 2); r.onsuccess = () => { const db = r.result, t = db.transaction('records', 'readwrite');
      t.objectStore('records').put(JSON.stringify({ v: 2, gen: snap.gen, rev: 1, alg: 'AES-GCM-256', iv: 'AAAAAAAAAAAAAAAA', ct: 'AAAAAAAAAAAAAAAAAAAAAA==' }), uid); t.oncomplete = () => { db.close(); res(); }; t.onerror = rej; }; r.onerror = rej; });
  });
  await p.reload(); await openCycleScreen(p); await p.waitForTimeout(700);
  const stuck = await p.isVisible('#cyUnavailable') && await p.isVisible('[data-act=resetStorage]');
  await cy('[data-act=resetStorage]', 800);
  check('unreadable data: a reset button is offered and returns to the consent screen', stuck && await p.isVisible('#cyConsent'));


  // Purge in the real UI (issue 3 reproduced in 0f26696): a mood pattern reminder and its text disappear from the
  // reminders list, the due list and the export when mood history is purged.
  await p.check('#cyAgree'); await cy('[data-act=consent]', 600);
  await p.evaluate(async (d) => {
    const S = await import('/js/cycle/store.js'), M = await import('/js/cycle/model.js'), R = await import('/js/cycle/reminders.js');
    const uid = localStorage.getItem('shred_cycle_uid');
    const repo = await S.openCycleRepo({ storage: S.indexedDbStorage(), keys: S.indexedDbKeys(), userId: uid });
    await repo.update(s => { s.settings.quietHours = { start: '00:00', end: '00:00' }; // no quiet hours, so the 00:00 reminder is due now
      M.setCategory(s, 'mood', true); M.setScopeConsent(s, 'reminders', true); M.logPeriodStart(s, d.start, { today: d.today });
      M.logDay(s, d.yday, { mood: 'irritable' }, { today: d.today });
      R.addReminder(s, { kind: 'pattern', time: '00:00', cycleDay: 3, category: 'mood', origin: 'You logged low, anxious or irritable mood around cycle days 2–4 in 3 of your last 3 recorded cycles.' }); });
  }, { start: dayStr(-2), yday: dayStr(-1), today: dayStr(0) });
  await p.reload(); await openCycleScreen(p); await p.waitForTimeout(800);
  const seeded = /one of your patterns/.test(await p.textContent('#cyReminders')) && await p.isVisible('#cyDue');
  if (!(await p.$('#cySettings[open]'))) await tap('#cySettings summary');
  await cy('#cySettings [data-cat=mood]', 900); // untick → confirm (accepted) = stop and delete
  const remText = await p.textContent('#cyReminders');
  const [pdl] = await Promise.all([p.waitForEvent('download'), tap('[data-act=export]')]);
  const pexp = fs.readFileSync(await pdl.path(), 'utf8');
  check('purge (browser): mood pattern reminder shown before purge, gone from reminders, due list and export after',
    seeded && !/one of your patterns/.test(remText) && !(await p.$('#cyDue')) && !/irritable/.test(pexp) && !/"category":\s*"mood"/.test(pexp), JSON.stringify({ seeded }));

  // Fresh contexts for concurrency tests (synthetic data only)
  const newCtx = async ({ noLocks = false } = {}) => {
    const c = await b.newContext({ viewport: { width: 400, height: 860 }, acceptDownloads: true, serviceWorkers: 'block' });
    await c.route('https://shred.local/**', serve);
    await c.addInitScript(() => localStorage.setItem('shred_flags_v1', JSON.stringify({ cycleTracking: true })));
    if (noLocks) await c.addInitScript(() => Object.defineProperty(Navigator.prototype, 'locks', { get: () => undefined, configurable: true }));
    return c;
  };
  const openCycle = async c => { const pg = await c.newPage(); pg.on('dialog', d => d.accept()); pg.on('pageerror', e => errs.push('ctx: ' + e.message));
    await pg.goto('https://shred.local/'); await openCycleScreen(pg); await pg.waitForTimeout(500); return pg; };
  const starts = pg => pg.evaluate(async () => { const S = await import('/js/cycle/store.js'); const uid = localStorage.getItem('shred_cycle_uid');
    const r = await S.openCycleRepo({ storage: S.indexedDbStorage(), keys: S.indexedDbKeys(), userId: uid }); return r.read().periods.map(x => x.start).sort(); });

  // Simultaneous first opens (issue 2 reproduced in 0f26696): two tabs open cycle tracking for the first time at once
  for (const noLocks of [false, true]) {
    const tag = noLocks ? '(Web Locks removed)' : '(Web Locks available)';
    const c = await newCtx({ noLocks });
    const [A, B] = await Promise.all([openCycle(c), openCycle(c)]);
    const ids = await Promise.all([A, B].map(pg => pg.evaluate(() => localStorage.getItem('shred_cycle_uid'))));
    await A.check('#cyAgree'); await A.click('[data-act=consent]'); await A.waitForTimeout(700);
    await B.waitForSelector('#cyLog', { timeout: 5000 }).catch(() => {});
    await B.fill('#cyDate', dayStr(-20)); await B.click('[data-act=logStart]'); await B.waitForTimeout(600);
    await A.reload(); await openCycleScreen(A); await A.waitForTimeout(700);
    check(`simultaneous first opens ${tag}: one user ID, one key; a save from the second tab decrypts after reload`,
      ids[0] === ids[1] && !(await A.$('#cyUnavailable')) && JSON.stringify(await starts(A)) === JSON.stringify([dayStr(-20)]), JSON.stringify(ids));
    // Simultaneous saves (issue 1): both tabs press "Period started" at the same moment
    await A.fill('#cyDate', dayStr(-80)); await B.fill('#cyDate', dayStr(-50));
    await Promise.all([A.click('[data-act=logStart]'), B.click('[data-act=logStart]')]); await A.waitForTimeout(900);
    const got = await starts(A);
    check(`simultaneous saves ${tag}: neither period is lost`, JSON.stringify(got) === JSON.stringify([dayStr(-80), dayStr(-50), dayStr(-20)].sort()), JSON.stringify(got));
    // A redraw caused by the other tab must not change what this tab has typed but not saved (defect found here)
    await B.fill('#cyDate', dayStr(-95)); await A.fill('#cyDate', dayStr(-3)); await A.click('[data-act=logSpotting]'); await B.waitForTimeout(900);
    check(`other tab saves while this tab is typing ${tag}: the typed date is kept`, (await B.inputValue('#cyDate')) === dayStr(-95), await B.inputValue('#cyDate'));
    // Simultaneous save + delete: deletion wins, nothing written back
    await B.fill('#cyDate', dayStr(-110));
    if (!(await A.$('#cySettings[open]'))) { await A.$eval('#cySettings summary', e => e.scrollIntoView({ block: 'center' })); await A.click('#cySettings summary'); }
    await Promise.all([A.click('[data-act=deleteAll]'), B.click('[data-act=logStart]')]); await A.waitForTimeout(900);
    const rec2 = await rawRecord(A);
    await B.reload(); await openCycleScreen(B); await B.waitForTimeout(700);
    check(`simultaneous save + delete ${tag}: nothing survives, both tabs ask for consent again`, rec2.text === null && await B.isVisible('#cyConsent') && !(await B.$('#cyUnavailable')));
    await c.close();
  }
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
  await p.click('#calmSkip');
  // 2026-11-28: waits up to 10 s, not a fixed 1.5 s. Chromium and WebKit report the failed audio at once; Firefox
  // reports nothing, so the link comes from the 8 s safety net (STALL_MS in js/calm.js; see tests/sukoon-fallback.cjs).
  await p.waitForSelector('#calmLinks a[href="https://quran.com/94/1-8"]', { timeout: 10000 }).catch(() => {});
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

  // Imported exercises are searchable and open a camera form check.
  await p.goto('https://shred.local/'); await go('train'); await p.fill('#exSearch', 'zercher');
  check('library: imported exercise found by search', /Zercher Squat/.test(await p.textContent('#exGrid')));
  await p.click('[data-train=xZercherSquat]');
  check('library: imported exercise opens a camera form check', await p.isVisible('#startCam'));
  await p.click('#setup', { position: { x: 5, y: 5 } }); await p.fill('#exSearch', '');

  // Map my body: demo calibration → personal body map sheet.
  await p.goto('https://shred.local/'); await go('body'); await tap('#bodyMapTile');
  check('body map: intro explains the one-minute calibration', /Map my body/.test(await p.textContent('#rsheetBody')));
  await p.click('[data-bm=demo]');
  await p.waitForFunction(() => /QK now coaches your body/.test(document.querySelector('#rsheetBody')?.textContent || '') && !document.querySelector('#rsheet').hidden, null, { timeout: 90000 });
  const bm = await p.textContent('#rsheetBody');
  check('body map: fits several movements, with reasons', /Forward lean allowed/.test(bm) && /Hinge depth/.test(bm) && /Long thighs/.test(bm) && /Tight hamstrings/.test(bm));
  await p.click('[data-bm=close]');

  // Brain: score, Speed Flash (shortened), Memory Grid, Quran practice and spaced review, a lesson.
  await p.goto('https://shred.local/'); await p.waitForTimeout(600);
  await go('today'); await tap('#today [data-go=brain]'); await p.waitForTimeout(500);
  check('brain: score waits for a first drill, next step is Speed Flash 1 of 10', /Not started/.test(await p.textContent('.brain-score')) && /session 1 of 10/.test(await p.textContent('.next-brain')));
  check('brain: seven games (three reflex) and ten lessons', (await p.$$('.game-card')).length === 7 && (await p.$$('#reflexGames .game-card')).length === 3 && (await p.$$('.lesson-row')).length === 10);
  await p.evaluate(() => { window.__shredSpeedTrials = 3; });
  await tap('[data-brain=speed]'); await p.click('#sfGo');
  for (let i = 0; i < 3; i++) { await p.waitForSelector('#sfVeh:not([hidden])', { timeout: 10000 }); await p.click('#sfVeh [data-v="0"]'); await p.waitForSelector('#sfArena.answer'); await p.click('.sf-spot[data-pos="0"]', { force: true }); }
  await p.waitForSelector('#sfDone:not([hidden])', { timeout: 10000 });
  check('speed flash: result shows a speed level and the block progress', /Speed level \d+/.test(await p.textContent('#sfDone')) && /1 of 10 sessions/.test(await p.textContent('#sfDone')));
  await p.click('#sfFin');
  check('brain: score appears after the first drill', /\d/.test(await p.textContent('.brain-score .sc-ring .num')));
  await tap('[data-brain=grid]'); await p.click('#mgGo'); await p.waitForSelector('#mgGrid:not(.watch)', { timeout: 10000 });
  check('memory grid: lights a pattern then hands over to you', /Your turn/.test(await p.textContent('#mgMsg')));
  await p.click('#bpClose');
  // Reflex games: Lights Out (one jump start, then clean starts), Reaction Wall (short), Tracker (one round).
  await tap('[data-brain=lights]');
  await p.click('#loPad'); await p.waitForTimeout(1300); await p.click('#loPad'); // tapped while lights were coming on
  check('lights out: tapping before lights out is a jump start', /Jump start/.test(await p.textContent('#loTimes')));
  for (let i = 0; i < 4; i++) {
    await p.click('#loPad');
    await p.waitForFunction(() => document.querySelectorAll('.lo-pod.on').length === 5, null, { timeout: 8000 });
    await p.waitForFunction(() => document.querySelectorAll('.lo-pod.on').length === 0, null, { timeout: 8000 });
    await p.waitForTimeout(180); await p.click('#loPad'); await p.waitForTimeout(300);
  }
  check('lights out: 5 starts → average and best reaction time', await p.isVisible('#loFin') && /Average/.test(await p.textContent('#loEnd')), await p.textContent('#loEnd'));
  await p.click('#loFin');
  await p.evaluate(() => { window.__shredBatakSeconds = 3; window.__shredTrackRounds = 1; window.__shredTrackSeconds = 1; });
  await tap('[data-brain=batak]'); await p.click('#bkGo');
  for (let i = 0; i < 5; i++) await p.click('.bk-l.on');
  await p.waitForSelector('#bkFin', { timeout: 8000 });
  check('reaction wall: counts hits', /5 hits/.test(await p.textContent('#bkEnd')));
  await p.click('#bkFin');
  await tap('[data-brain=track]'); await p.click('#tkGo'); await p.waitForSelector('#tkBox.pick', { timeout: 10000 });
  // The balls may overlap: click the exact element, not a screen point (a point can land on another ball).
  for (const i of [0, 1, 2]) await p.$eval(`.tk-b[data-b="${i}"]`, el => el.click());
  await p.waitForSelector('#tkFin', { timeout: 8000 });
  check('tracker: picking the 3 followed balls gives a tracking level', /Tracking level \d+/.test(await p.textContent('#tkEnd')) && /1 of 1 rounds perfect/.test(await p.textContent('#tkEnd')));
  await p.click('#tkFin');

  await tap('[data-brain=quran]'); await p.waitForTimeout(400);
  check('quran: 23 surahs and passages to learn', (await p.$$('.q-row')).length === 23);
  await p.click('[data-brain="set:s112"]');
  check('quran: Al-Ikhlas shows 4 verses in Arabic with translation', (await p.$$('.ayah-card')).length === 4 && /He is Allah/.test(await p.textContent('#quranMain')));
  await p.click('[data-brain="learn:s112"]');
  for (let n = 0; n < 6 && await p.isVisible('#prBox'); n++) {
    if (await p.isVisible('#prFin')) break;
    while (await p.isVisible('#prNext')) await p.click('#prNext');
    await p.click('#prCheck'); await p.click('[data-g=good]');
  }
  check('quran practice: finishes and schedules review', await p.isVisible('#prFin'));
  await p.click('#prFin');
  check('quran: practised verses marked as learning', /Learning/.test(await p.textContent('#quranMain')));
  const due = await p.evaluate(() => { const S = JSON.parse(localStorage.getItem('shred_qk_v1')); for (const c of Object.values(S.brain.quran)) c.due = Date.now() - 1000; localStorage.setItem('shred_qk_v1', JSON.stringify(S)); return Object.keys(S.brain.quran).length; });
  await p.goto('https://shred.local/'); await p.waitForTimeout(500); await go('today'); await tap('#today [data-go=brain]'); await p.waitForTimeout(400);
  check('brain: due verses become the next step', new RegExp(`Review ${due} verse`).test(await p.textContent('.next-brain')), await p.textContent('.next-brain'));
  await tap('[data-brain="lesson:plastic"]'); await p.click('[data-q="1"]');
  check('lesson: quiz marks the right answer', await p.isVisible('#lqBox .right'));
  await p.click('#lsDone');

  // Quran reader: all 114 surahs, search, a long surah, bookmark, continue reading, memorise any verse.
  await p.goto('https://shred.local/'); await p.waitForTimeout(500);
  await go('body'); await p.click('#body [data-go=reader]'); await p.waitForTimeout(600);
  check('reader: lists all 114 surahs', (await p.$$('#rdList .q-row')).length === 114);
  await p.fill('#rdSearch', 'cave');
  check('reader: search by meaning finds Al-Kahf', (await p.$$('#rdList .q-row')).length === 1 && /Al-Kahf/.test(await p.textContent('#rdList')));
  await p.click('#rdList [data-rd="open:18"]'); await p.waitForTimeout(600);
  check('reader: Al-Kahf shows 110 verses with the Basmala heading', (await p.$$('.rd-v')).length === 110 && await p.isVisible('.rd-basmala'));
  await tap('[data-rd="mark:10"]');
  await p.$eval('#rv-30', el => el.scrollIntoView({ block: 'start' })); await p.waitForTimeout(1600);
  await tap('[data-rd="tr"]');
  check('reader: translation can be hidden', !(await p.isVisible('#rv-30 .rd-en')));
  await tap('[data-rd="tr"]');
  await tap('[data-rd="learn:30"]');
  check('reader: Memorise opens practice for that verse', /Al-Kahf · verse 30/.test(await p.textContent('#prBox')));
  await p.click('#prNext'); await p.click('#prNext'); await p.click('#prNext'); await p.click('#prCheck'); await p.click('[data-g=good]');
  await p.click('#prFin');
  await p.click('#readerMain [data-rd=list]'); await p.waitForTimeout(400);
  check('reader: continue reading where you left off, and the bookmark', /Al-Kahf · verse 3\d/.test(await p.textContent('.rd-continue')) && /18:10/.test(await p.textContent('.rd-marks')), await p.textContent('.rd-continue'));
  await p.fill('#rdSearch', ''); await p.click('#rdList [data-rd="open:9"]'); await p.waitForTimeout(500);
  check('reader: At-Tawbah has no Basmala heading', (await p.$$('.rd-basmala')).length === 0 && (await p.$$('.rd-v')).length === 129);
  await go('today'); await tap('#today [data-go=brain]'); await tap('[data-brain=quran]'); await p.waitForTimeout(500);
  check('quran memory: a verse memorised from the reader shows under Also learning', /Also learning/.test(await p.textContent('#quranMain')) && /Al-Kahf/.test(await p.textContent('#quranMain')));

  // 11. Body check: alertness test (shortened for the test run) and camera pulse with no finger
  await p.goto('https://shred.local/'); await p.waitForTimeout(600);
  await go('vitals');
  check('body check: three measurements offered', await p.isVisible('#vHr') && await p.isVisible('#vHrv') && await p.isVisible('#vPvt'));
  check('body check: 1- and 2-minute HRV options', await p.isVisible('#vHrv2'));
  await tap('#valCard summary'); await p.click('#valOn');
  check('strap comparison: mode on → shows how many comparisons are still needed', /10 more HRV comparisons/.test(await p.textContent('#valNeed')));
  await p.click('#valOn'); await tap('#valCard summary');
  await p.evaluate(() => { window.__shredPvtSeconds = 9; });
  await tap('#vPvt'); await p.click('#pvtStart');
  await p.click('#pvtArea', { position: { x: 60, y: 60 } }); // too early: counted as a false start
  // Tap every number that appears until the test ends. The delays are random (2–5 s), so how many
  // numbers fit in 9 s varies: a fixed number of taps leaves the last one unanswered on fast draws, and
  // the app then waits up to 30 s for it. ".go" marks a live number; the last result lingers 0.3 s
  // after a tap and must not be tapped again (that would count as an early tap).
  const pvtDeadline = Date.now() + 30000;
  while (Date.now() < pvtDeadline && !(await p.isVisible('#pvtResult'))) {
    const live = await p.waitForFunction(() => document.querySelector('#pvtArea').classList.contains('go') || !document.querySelector('#pvtResult').hidden, null, { timeout: 7000 }).then(() => true).catch(() => false);
    if (!live || await p.isVisible('#pvtResult')) continue;
    await p.waitForTimeout(220); await p.click('#pvtArea', { position: { x: 80, y: 80 } });
  }
  const pvtTxt = await p.textContent('#pvtSummary');
  check('alertness: result shows average reaction and early taps', /Average reaction\s*\d+ ms/.test(pvtTxt) && /Early taps\s*[1-9]/.test(pvtTxt), pvtTxt.replace(/\s+/g, ' ').slice(0, 120));
  check('alertness: reaction times plausible (about 200–400 ms)', (() => { const m = pvtTxt.match(/Average reaction\s*(\d+)/); return m && +m[1] > 150 && +m[1] < 500; })());
  await p.click('#pvtDone');
  check('alertness: saved and shown on Body check', /\d+ ms/.test(await p.textContent('#vPvtLast')));
  await tap('#vHr'); await p.waitForTimeout(2500);
  check('camera pulse: asks for a fingertip when none is on the camera', await p.isVisible('#measure') && /fingertip|camera/i.test(await p.textContent('#mStatus')), await p.textContent('#mStatus'));
  await p.waitForSelector('#mTap:not([hidden])', { timeout: 12000 }).catch(() => {});
  check('camera pulse: after 8 s with no finger, explains and offers tap-along', await p.isVisible('#mTap') && /finger|dark/i.test(await p.textContent('#mStatus')), await p.textContent('#mStatus'));
  await p.click('#mTap');
  // 2026-11-28: the browser's own tap times are recorded, because the gap between taps is the 750 ms wait PLUS the
  // time each click takes, which is longer in WebKit and Firefox (the old check expected 80 bpm and failed there with
  // a correct 76). The app must match the pulse those taps really give, to within 1 bpm, and the taps must really
  // have been about 750 ms apart (70-82 bpm).
  await p.evaluate(() => { window.__taps = []; document.querySelector('#tpArea').addEventListener('pointerdown', e => window.__taps.push(e.timeStamp), true); });
  for (let i = 0; i < 12; i++) { await p.click('#tpArea'); await p.waitForTimeout(750); }
  await p.waitForSelector('#tpDone:not([hidden])', { timeout: 12000 }).catch(() => {});
  const tapBpm = parseInt(await p.textContent('#tpCount'));
  const expectBpm = await p.evaluate(() => { const t = window.__taps, g = t.slice(1).map((x, i) => x - t[i]).sort((a, b) => a - b); return Math.round(60000 / g[g.length >> 1]); });
  check('tap-along pulse: 12 taps about 750 ms apart → the pulse those taps give (±1 bpm)', Math.abs(tapBpm - expectBpm) <= 1 && expectBpm >= 70 && expectBpm <= 82, `app ${tapBpm}, taps ${expectBpm}`);
  await p.click('#tpDone');
  check('tap-along pulse: saved to Body check', /\d+ bpm/.test(await p.textContent('#vHrLast')));
  await tap('#vHr'); await p.waitForTimeout(1500); await p.click('#mCancel');
  check('camera pulse: cancel closes it', !(await p.isVisible('#measure')));

  // 12. Sukoon: cyclic sighing style
  await go('calm'); await tap('#calmSettings'.replace('#calmSettings', 'details.card:has(#calmSettings) summary'));
  await p.selectOption('#cBreath', 'sigh');
  await tap('#calmNow'); await p.click('#cBefore [data-v="4"]'); await p.waitForTimeout(400);
  check('cyclic sighing: pacer says breathe in through the nose', /through your nose/.test(await p.textContent('#calmWord')), await p.textContent('#calmWord'));
  await p.waitForTimeout(2300);
  check('cyclic sighing: then the top-up breath', /Top up/.test(await p.textContent('#calmWord')), await p.textContent('#calmWord'));
  await p.click('#calmEnd'); await p.click('#cSave');

  // Camera coach: one tap, QK recognises the exercise, coaches it, and follows a switch to another one.
  // A simulated lifter stands in for the camera: curls with a body swing, then squats.
  await p.goto('https://shred.local/'); await p.waitForTimeout(500);
  check('camera coach: one tap from Today', await p.isVisible('#camCoach'));
  await p.evaluate(async () => {
    const { frameAt } = await import('/tests/synth.mjs'); let t0 = null;
    window.__qkFeed = now => { t0 ??= now; const t = (now - t0) / 1000;
      return t < 9 ? frameAt('curl', t, { extra: (tt, k) => (tt > 3 && tt < 8 ? { t: -18 * Math.sin(Math.PI * k) } : {}) }) : frameAt('squat', t - 9); };
  });
  await tap('#camCoach');
  check('camera coach: opens straight into the camera, looking for the exercise', await p.isVisible('#live') && /recognise/.test(await p.textContent('#detectTxt')));
  await p.waitForFunction(() => /Biceps curls/.test(document.querySelector('#detectTxt').textContent), null, { timeout: 8000 }).catch(() => {});
  check('camera coach: LIVE chip shows QK has locked on and is tracking', /Live · \d+ points · \d+ fps/.test(await p.textContent('#trackChip')), await p.textContent('#trackChip'));
  check('camera coach: recognises curls within a rep or two', /Biceps curls/.test(await p.textContent('#detectTxt')), await p.textContent('#detectTxt'));
  await p.waitForFunction(() => /Swinging your body/.test(document.querySelector('#faultBanner')?.textContent || ''), null, { timeout: 9000 }).catch(() => {});
  check('camera coach: catches the body swing live ("Swinging your body")', /Swinging your body/.test(await p.textContent('#faultBanner')));
  await p.waitForFunction(() => /Squats ✓/.test(document.querySelector('#detectTxt').textContent), null, { timeout: 12000 }).catch(() => {});
  check('camera coach: follows the switch to squats', /Squats ✓/.test(await p.textContent('#detectTxt')) && /Squat/.test(await p.textContent('#liveEyebrow')));
  await p.waitForTimeout(5000); await p.click('#endLive'); await p.waitForTimeout(600);
  check('camera coach: both exercises saved', /Also saved this session: Dumbbell Curl \d+/.test(await p.textContent('#sCompare')) && +(await p.textContent('#sReps')) >= 1, (await p.textContent('#sCompare')).trim());
  await p.click('#doneBtn');
  await p.evaluate(() => { delete window.__qkFeed; });

  // New training types: filters, a HYROX stopwatch and running intervals.
  await p.goto('https://shred.local/'); await go('train');
  await p.click('[data-muscle="HYROX"]');
  check('library: HYROX filter lists the run and 8 stations', /^9 exercises/.test(await p.textContent('#exCount')), await p.textContent('#exCount'));
  await tap('[data-train=hyroxSki]');
  check('HYROX station: stopwatch coaching', /QK times you/.test(await p.textContent('#setupTitle')));
  await p.click('#startGuided'); await p.waitForTimeout(14000); await p.click('#endLive'); await p.waitForTimeout(400);
  check('HYROX station: time saved', /^0:1\d$/.test(await p.textContent('#sReps')), await p.textContent('#sReps'));
  await p.click('#doneBtn'); await go('train'); await p.click('[data-muscle="Running"]');
  await tap('[data-train=runSprints]'); await p.click('#startGuided'); await p.waitForTimeout(6500);
  check('running intervals: "Go" with the time left, round 1 of 8', /Go \d:\d\d/.test(await p.textContent('#tempoWord')) && /of 8 rounds/.test(await p.textContent('#repLbl')), await p.textContent('#tempoWord'));
  await p.click('#endLive'); await p.waitForTimeout(300); await p.click('#doneBtn');
  const kindCounts = [];
  for (const k of ['Plyometrics', 'Olympic', 'Stretching', 'Cardio', 'Pilates']) { await go('train'); await p.click(`[data-muscle="${k}"]`); kindCounts.push(parseInt(await p.textContent('#exCount'))); }
  check('library: plyometrics, Olympic, stretching, cardio and Pilates filters all list exercises', kindCounts.every(n => n > 0), kindCounts.join(','));

  // Setup is one short line; QK says the coaching commands out loud when the set starts.
  await p.goto('https://shred.local/'); await go('train'); await p.fill('#exSearch', 'deadlift');
  await tap('[data-train=deadlift]');
  check('setup: one short instruction, no wall of text', (await p.$$('#setupSteps li')).length === 1);
  check('progression: first weighted set asks for a starting weight', /First time/.test(await p.textContent('#rxLine')), await p.textContent('#rxLine'));
  await p.click('#startCam'); await p.waitForTimeout(1500);
  const spoken = await p.textContent('[data-coach-caption]');
  // 2026-11-28: needs WebGL, like the other camera checks (the camera coaching can't start without it; see the note above).
  if (webgl) check('set start: QK tells you what to do ("Bar close to your shins ... Brace, and go.")', /Bar close to your shins/.test(spoken) && /Brace, and go/.test(spoken), spoken);
  check('no "NSCA" anywhere on screen', !/NSCA/.test(await p.textContent('body')));
  await p.click('#endLive'); await p.waitForTimeout(400);
  if (await p.isVisible('#doneBtn')) await p.click('#doneBtn');

  // Programs: pick one on the Train tab and its first day becomes today's workout.
  await p.goto('https://shred.local/'); await go('train');
  check('programs: 10+ programs on the Train tab', (await p.$$('#progStrip [data-prog]')).length >= 10);
  await tap('[data-prog=powerPump]'); await p.click('[data-progstart=powerPump]'); await p.waitForTimeout(300);
  check('programs: starting one shows it as active', /On Power & Pump/.test(await p.textContent('#progActive')), await p.textContent('#progActive'));
  // Train tab, program first: the hero shows the month, today's session and every session in order.
  // This lifter already trains Tue/Fri/Sat, so the program starts on 3 days (re-packed from 4).
  check('train: program hero with month, week, days a week and today\'s session', /Month 1 · week 1 of 4 · 3 days a week/.test(await p.textContent('#progHero')) && /about \d+ min/.test(await p.textContent('#progHero .hero-next')), await p.textContent('#progHero'));
  check('train: all 3 sessions listed, the next one marked', (await p.$$('#progHero [data-pday]')).length === 3 && /Next/.test(await p.textContent('#progHero .hero-day.next')));
  check('train: the active program leaves the switch list', !(await p.$('#progStrip [data-prog=powerPump]')));
  await tap('#progHero [data-pday="1"]'); await p.waitForTimeout(150);
  check('train: a session opens with its exercises', /session 2 of 3/.test(await p.textContent('#rsheetBody')) && (await p.$$('#rsheetBody .prog-day li')).length >= 4);
  await p.evaluate(() => { document.querySelector('#rsheet').hidden = true; });
  await p.click('#collChips [data-coll=muscle]'); await p.waitForTimeout(100);
  check('train: collections filter (Build muscle: Mass Monster, Elite Physique)', /Mass Monster/.test(await p.textContent('#progStrip')) && /Elite Physique/.test(await p.textContent('#progStrip')) && !/Platform Prep/.test(await p.textContent('#progStrip')));
  await p.click('#collChips [data-coll=all]');
  check('train: single exercises start folded away', !(await p.isVisible('#exGrid')) && await p.isVisible('#exOpen'));
  await tap('#exOpen'); await p.waitForTimeout(100);
  check('train: "Browse all exercises" opens the library', await p.isVisible('#exGrid') && /exercises/.test(await p.textContent('#exCount')));
  await tap('#heroStart'); await p.waitForTimeout(600);
  check('train: Start workout runs the whole session (warm-up offer, then the sets)', /Before you lift/.test(await p.textContent('#rsheetBody')) || await p.isVisible('#setup') || await p.isVisible('#live'));
  await p.evaluate(() => { document.querySelector('#rsheet').hidden = true; });
  await go('today');
  check("programs: day 1 is today's workout", /Barbell Bench Press[\s\S]*4×4-6/.test(await p.textContent('#todayList')));
  check('workout length: Today shows how long the workout takes', /About \d+ min/.test(await p.textContent('#planMins')), await p.textContent('#planMins'));
  await p.click('#planTime [data-cap="30"]'); await p.waitForTimeout(200);
  check('short on time: 30 minutes pairs extras into supersets first, then trims; main lifts kept', /supersets/.test(await p.textContent('#planCut')) && /trimmed from/.test(await p.textContent('#planMins')) && /Main lifts stay/.test(await p.textContent('#planCut')) && /Barbell Bench Press/.test(await p.textContent('#todayList')), await p.textContent('#planCut'));
  await p.click('#planTime [data-cap="30"]'); await p.waitForTimeout(150);
  check("QK's plan: today's lifts are listed with what to do", await p.isVisible('#qkPlan') && /Power & Pump · month 1 · week 1 of 4/.test(await p.textContent('#planEyebrow')) && /Barbell Bench Press/.test(await p.textContent('#planRows')), await p.textContent('#qkPlan'));
  await go('train'); await tap('[data-prog=powerPump]'); await p.click('[data-progstop]'); await p.waitForTimeout(200);

  // One-tap workout: Start workout opens the first exercise's setup with its target filled in.
  await p.goto('https://shred.local/'); await p.waitForTimeout(400);
  await p.$eval('#planStart', el => el.scrollIntoView({ block: 'center' })); await p.click('#planStart'); await p.waitForTimeout(300);
  check('workout mode: offers warm-up drills picked for today first', /warm-up drills/.test(await p.textContent('#rsheetTitle')), await p.textContent('#rsheetTitle'));
  await p.click('#drillSkip'); await p.waitForTimeout(300);
  check('workout mode: Start workout opens the next exercise to do (resumes if some sets are done)', await p.isVisible('#setup') && /set \d/.test(await p.textContent('#setupEyebrow')) && await p.isVisible('#rxBox'), await p.textContent('#setupEyebrow'));
  await p.evaluate(() => { document.querySelector('#setup').hidden = true; });
  // Training-day reminders: a calendar file for the planned days.
  await go('progress'); await p.click('#planCard summary').catch(() => {});
  const [icsDl] = await Promise.all([p.waitForEvent('download', { timeout: 4000 }).catch(() => null), p.click('#remindCal')]);
  const ics = icsDl ? fs.readFileSync(await icsDl.path(), 'utf8') : '';
  check('reminders: calendar file repeats on the training days', /RRULE:FREQ=WEEKLY;BYDAY=TU,FR,SA/.test(ics), ics.slice(0, 80));

  // Days a week: pick 3, 4 or 5 on an adjustable program; QK re-packs it and judges the pattern itself.
  await p.goto('https://shred.local/'); await go('train'); await tap('#progStrip [data-prog=massMonster]'); await p.waitForTimeout(150);
  check('days: Mass Monster starts on the 3 days this lifter already trains, with a 3–6 choice', (await p.$$('#rsheetBody [data-pdays]')).length === 4 && /3 days a week/.test(await p.textContent('#rsheetBody .data')), await p.textContent('#rsheetBody .data'));
  await p.click('[data-pdays="5"]'); await p.waitForTimeout(150);
  check('days: 5 days gives 5 sessions', (await p.$$('#rsheetBody .prog-day')).length === 5 && /5 days a week/.test(await p.textContent('#rsheetBody .data')));
  await p.click('[data-pdays="3"]'); await p.waitForTimeout(150);
  check('days: 3 days re-packs into 3 sessions, same weekly sets', (await p.$$('#rsheetBody .prog-day')).length === 3 && /same weekly sets/.test(await p.textContent('#daysWhy')));
  await p.click('[data-progstart=massMonster]'); await p.waitForTimeout(300);
  check('days: started on 3 days', /3 days a week/.test(await p.textContent('#progHero .eyebrow')) && (await p.$$('#progHero [data-pday]')).length === 3);
  check('days: circuits keep their own days (no choice on Shred Circuit)', await (async () => { await tap('#progStrip [data-prog=shredCircuit]'); await p.waitForTimeout(100); const n = (await p.$$('#rsheetBody [data-pdays]')).length; await p.evaluate(() => { document.querySelector('#rsheet').hidden = true; }); return n === 0; })());
  // Three full weeks of 3 sessions on a 5-day plan: QK moves to 3 days, says why, and can be undone.
  await p.evaluate(() => {
    const S = JSON.parse(localStorage.getItem('shred_qk_v1')), DAY = 864e5, mon = new Date(); mon.setHours(10, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    const log = []; for (let w = 4; w >= 1; w--) for (const k of (w === 4 ? [0, 1, 2, 3, 4] : [0, 2, 4])) log.push({ day: log.length % 5, at: mon.getTime() - w * 7 * DAY + k * DAY });
    Object.assign(S.program, { days: 5, start: mon.getTime() - 5 * 7 * DAY, daysSince: undefined, restartAt: 0, log, daysNote: undefined, daysHold: 0 });
    localStorage.setItem('shred_qk_v1', JSON.stringify(S));
  });
  await p.reload(); await p.waitForTimeout(600);
  check('days: QK spots 3 sessions a week for 3 weeks and moves to 3 days, saying why', await p.isVisible('#daysNews') && /3, 3, 3 days the last 3 weeks/.test(await p.textContent('#daysNews')), await p.textContent('#daysNews'));
  await go('train');
  check('days: the program now has 3 sessions', /3 days a week/.test(await p.textContent('#progHero .eyebrow')) && (await p.$$('#progHero [data-pday]')).length === 3);
  await tap('#progHero [data-daysundo]'); await p.waitForTimeout(200);
  check('days: one tap keeps 5 days', /5 days a week/.test(await p.textContent('#progHero .eyebrow')) && !(await p.isVisible('#heroDaysNews')));
  await p.reload(); await p.waitForTimeout(500); await go('train');
  check('days: after keeping 5, QK does not change it again straight away', /5 days a week/.test(await p.textContent('#progHero .eyebrow')) && !(await p.isVisible('#daysNews')));
  await tap('#progHero [data-prog]'); await p.click('[data-progstop]'); await p.waitForTimeout(200);

  // Make it yours: equipment, pain, check-in, machine taken, skip, voice, weak points, time per day, reminder link.
  await p.goto('https://shred.local/'); await go('train'); await tap('#progStrip [data-prog=massMonster]'); await p.waitForTimeout(150);
  await p.click('[data-progstart=massMonster]'); await p.waitForTimeout(300);
  await go('progress'); await tap('#meCard summary'); await p.waitForTimeout(150);
  await tap('[data-eq=dumbbells]'); await tap('[data-eq=bench]'); await go('today'); await p.waitForTimeout(200);
  const eqOk = await p.evaluate(async () => { const { LIB } = await import('/js/library.js'); return [...document.querySelectorAll('#todayList [data-train]')].every(b => !['Barbell', 'Machine', 'Cable', 'EZ bar'].includes(LIB[b.dataset.train].equipment)); });
  check('my gym: dumbbells + bench → nothing needing a barbell, machine or cable today; QK says what it swapped', eqOk && /your equipment/.test(await p.textContent('#swapNote')), await p.textContent('#todayList'));
  await go('progress'); await tap('[data-painarea=shoulder]'); await go('today'); await p.waitForTimeout(200);
  const shOk = await p.evaluate(async () => { const { LIB } = await import('/js/library.js'); const ids = [...document.querySelectorAll('#todayList [data-train]')].map(b => b.dataset.train); return ids[0] === 'bandER' && ids[1] === 'bandPullApart' && !ids.some(id => ['press', 'dip'].includes(LIB[id].pattern)); });
  check('pain: shoulder → two rehab moves first, no overhead pressing or dips', shOk, await p.textContent('#todayList'));
  // Check-in: clear today's morning answer, then Start workout asks three questions and lightens a rough day.
  await p.evaluate(() => { const S = JSON.parse(localStorage.getItem('shred_qk_v1')); S.readiness = []; delete S.checkin; localStorage.setItem('shred_qk_v1', JSON.stringify(S)); });
  await p.reload(); await p.waitForTimeout(500); await go('today');
  await tap('#planStart'); await p.waitForTimeout(250);
  check('check-in: Start workout asks how you are (sleep, soreness, energy)', /How are you today/.test(await p.textContent('#rsheetBody')) && (await p.$$('#rsheetBody [data-rq]')).length === 9);
  await p.click('[data-rq="sleep:bad"]'); await p.click('[data-rq="sore:very"]'); await p.click('[data-rq="energy:low"]'); await p.waitForTimeout(100);
  check('check-in: a rough day → lighter, with a recovery option', /10% less weight/.test(await p.textContent('#rsheetBody')) && await p.isVisible('#rqRecover'));
  await p.click('#rqGo'); await p.waitForTimeout(300); await p.evaluate(() => { document.querySelector('#rsheet').hidden = true; }); await go('today');
  check('check-in: Today shows why it is lighter', await p.isVisible('#readyNote') && /lighter/.test(await p.textContent('#readyNote')));
  // Machine taken and voice on a dumbbell lift.
  const dbLift = await p.evaluate(async () => { const { LIB } = await import('/js/library.js'); return [...document.querySelectorAll('#todayList [data-train]')].map(b => b.dataset.train).find(id => /^Dumbbells?$/.test(LIB[id].equipment) && !/Rehab/.test(id)); });
  // (After a rough check-in Today leads with recovery and folds the list away, so open the exercise directly.)
  await p.evaluate(k => document.querySelector(`#todayList [data-train=${k}]`).click(), dbLift); await p.waitForTimeout(200);
  check('setup: Machine taken and This hurts buttons on program exercises', await p.isVisible('#busyBtn') && await p.isVisible('#painBtn'));
  await p.evaluate(() => window.__qkVoice('sixty two and a half kilos')); await p.waitForTimeout(150);
  check('voice: "sixty two and a half kilos" sets 62.5 kg', await p.evaluate(k => JSON.parse(localStorage.getItem('shred_qk_v1')).prog.override[k].kg === 62.5, dbLift), dbLift);
  check('voice: random talk is ignored', await p.evaluate(() => window.__qkVoice('what a nice day')) === null);
  await p.click('#busyBtn'); await p.waitForTimeout(150);
  const busyTo = await p.getAttribute('#rsheetBody [data-busyto]', 'data-busyto'); await p.click('#rsheetBody [data-busyto]'); await p.waitForTimeout(250);
  await p.evaluate(() => { document.querySelector('#setup').hidden = true; }); await go('today');
  check('machine taken: today uses the alternative, says so, and only today', /machine taken/.test(await p.textContent('#swapNote')) && !!(await p.$(`#todayList [data-train=${busyTo}]`)) && await p.evaluate(() => JSON.parse(localStorage.getItem('shred_qk_v1')).todaySwap.day === new Date().toDateString()));
  // Time per training day: today's budget trims the session.
  await p.evaluate(() => { const S = JSON.parse(localStorage.getItem('shred_qk_v1')); S.plan.minutes = { [new Date().getDay()]: 30 }; if (!S.plan.days.includes(new Date().getDay())) S.plan.days.push(new Date().getDay()); localStorage.setItem('shred_qk_v1', JSON.stringify(S)); });
  await p.reload(); await p.waitForTimeout(500); await go('today');
  check('time per day: a 30-minute day is trimmed, main lifts kept', /trimmed from/.test(await p.textContent('#planMins')), await p.textContent('#planMins'));
  await go('progress');
  check('weak points: card on Progress', await p.isVisible('#weakCard') && /Weak points/.test(await p.textContent('#weakCard')));
  // Reminder link / app-icon shortcut: straight into today's workout.
  await p.goto('https://shred.local/?start=today'); await p.waitForTimeout(1000);
  check('reminder link: opens straight into today\'s workout', await p.isVisible('#rsheet') || await p.isVisible('#setup') || await p.isVisible('#live'));
  check('app-icon shortcut: "Start today\'s workout"', JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8')).shortcuts.some(x => x.url === './?start=today'));

  // QK remembers: a sore shoulder 4 days ago → "How's your shoulder?"; Better brings the moves back at 80%.
  const setS = f => p.evaluate(src => { const S = JSON.parse(localStorage.getItem('shred_qk_v1')); new Function('S', src)(S); localStorage.setItem('shred_qk_v1', JSON.stringify(S)); }, f);
  await setS(`S.profile.equip = []; S.profile.pain = ['shoulder']; S.profile.painSince = { shoulder: Date.now() - 4 * 864e5 }; delete S.plan.minutes; S.memory = { done: {} };`);
  await p.goto('https://shred.local/'); await p.waitForTimeout(600); await go('today');
  check('remembers: "How\'s your shoulder?" 4 days after it was marked sore', await p.isVisible('#memCard') && /How's your shoulder/.test(await p.textContent('#memCard')) && /You told me it hurt on/.test(await p.textContent('#memCard')), await p.textContent('#memCard'));
  await tap('#memCard [data-mem="pain:shoulder:better"]'); await p.waitForTimeout(250);
  const cleared = await p.evaluate(() => JSON.parse(localStorage.getItem('shred_qk_v1')).profile);
  check('remembers: "Better" clears it and starts the 2-week 80% return', !cleared.pain.includes('shoulder') && cleared.painCleared.shoulder > 0 && !(await p.isVisible('#memCard')));
  // A rough day yesterday → asked the next day.
  await setS(`S.checkinLog = [{ at: Date.now() - 864e5, level: 'rest' }];`);
  await p.goto('https://shred.local/'); await p.waitForTimeout(500); await go('today');
  check('remembers: rough day yesterday → "Feeling better today?"', /Feeling better today/.test(await p.textContent('#memCard')));
  await tap('#memCard [data-mem="rough:tired"]'); await p.waitForTimeout(200);
  check('remembers: "Still tired" → today is lighter', await p.isVisible('#readyNote') && /lighter|5% off/.test(await p.textContent('#readyNote')), await p.textContent('#readyNote'));
  // Three rough days this week → an early light week offer.
  await setS(`S.checkinLog = [0, 1, 2].map(d => ({ at: Date.now() - d * 864e5 - 3600e3, level: 'easy' })); S.memory.done = Object.fromEntries([0,1,2,3].map(d => { const x = new Date(Date.now() - d * 864e5); x.setHours(0,0,0,0); return ['rough:' + x.getTime(), 1]; })); (S.prog ||= {}).lightAt = 0; S.prog.lightOfferAt = 0;`);
  await p.goto('https://shred.local/'); await p.waitForTimeout(500);
  await p.evaluate(async () => { const { followUps } = await import('/js/memory.js'); const { LIB } = await import('/js/library.js'); const S = JSON.parse(localStorage.getItem('shred_qk_v1')); S.memory ||= { done: {} }; S.memory.done ||= {}; for (const f of followUps(S, { lib: LIB })) S.memory.done[f.id] = 1; localStorage.setItem('shred_qk_v1', JSON.stringify(S)); });
  await p.reload(); await p.waitForTimeout(500); await go('today');
  check('fatigue: 3 rough days this week → "Take a light week" offered', await p.isVisible('#lightNews') && /rough days this week/.test(await p.textContent('#lightNews')));
  await tap('#lightNews [data-lw=yes]'); await p.waitForTimeout(200);
  check('fatigue: one tap starts the light week', await p.evaluate(() => JSON.parse(localStorage.getItem('shred_qk_v1')).prog.lightAt > 0) && !(await p.isVisible('#lightNews')));
  // Make it yours extras: dumbbell ceiling, travel, Ramadan.
  await go('progress'); await tap('#meCard summary'); await p.waitForTimeout(150);
  await tap('#moreOpts summary'); await p.waitForTimeout(100);
  check('settings: essentials first, the rest under "More options"', await p.isVisible('#painChips') && await p.isVisible('#pLogMode'));
  await p.fill('#pMaxDb', '20'); await p.press('#pMaxDb', 'Tab');
  await p.selectOption('#pTravel', 'none'); await p.waitForTimeout(150);
  check('travel: "No equipment" for a week, ends by itself', /until/.test(await p.textContent('#travelNote')) && await p.evaluate(() => JSON.parse(localStorage.getItem('shred_qk_v1')).profile.travel.until > Date.now() + 6 * 864e5));
  await p.selectOption('#pTravel', ''); await p.click('#pRamadan'); await p.waitForTimeout(150);
  check('Ramadan mode: on for 30 days, with the iftar tip', /45 minutes/.test(await p.textContent('#ramadanNote')) && await p.evaluate(() => JSON.parse(localStorage.getItem('shred_qk_v1')).profile.ramadan.until > Date.now() + 29 * 864e5));
  await p.click('#pRamadan');
  // Knee pain → classes default to no jumping.
  await setS(`S.profile.pain = ['knee']; S.profile.painSince = { knee: Date.now() };`);
  await p.goto('https://shred.local/'); await p.waitForTimeout(500); await go('train'); await tap('#classStrip [data-class=ignite20]'); await p.waitForTimeout(150);
  check('classes: knee marked sore → quiet mode (no jumping) is on', await p.isChecked('#classQuiet') && /on for your knee/.test(await p.textContent('#rsheetBody')));
  await p.evaluate(() => { document.querySelector('#rsheet').hidden = true; });
  await p.evaluate(() => { const S = JSON.parse(localStorage.getItem('shred_qk_v1')); S.profile.equip = []; S.profile.pain = []; S.profile.travel = null; delete S.profile.maxKg; delete S.plan.minutes; S.program = null; localStorage.setItem('shred_qk_v1', JSON.stringify(S)); });

  // Quick log (the default): weight and reps pre-filled, one tap on how it felt logs the set, QK rests and moves on.
  await setS(`S.prefs.logMode = 'quick'; S.prog ||= {}; S.prog.skipDrills = true; S.checkin = { day: new Date().toDateString(), r: null }; S.program = { id: 'strengthBuilder', start: Date.now(), blockStart: Date.now(), block: 1, log: [], days: 4 }; S.profile.pain = []; S.profile.equip = [];`);
  await p.goto('https://shred.local/'); await p.waitForTimeout(500); await go('today');
  await tap('#planStart'); await p.waitForTimeout(500);
  check('quick log: Start workout opens the quick log, camera is the second option', await p.isVisible('#qlog') && /Check my form with the camera/.test(await p.textContent('#startCam')) && !(await p.isVisible('#setupSteps')));
  const qlEx = await p.evaluate(() => document.querySelector('#setupEyebrow').textContent.split(' · ')[0]);
  check('quick log: weight and reps already filled in', +(await p.inputValue('#qlReps')) > 0 && (await p.isHidden('#qlKgRow') || +(await p.inputValue('#qlKg')) > 0));
  const setNo = async () => +((await p.textContent('#qlSet')).match(/Set (\d+)/) || [])[1];
  const before = await setNo();
  await p.click('#qlFeel [data-qlog="2.5"]'); await p.waitForTimeout(250);
  const ql1 = await p.evaluate(() => JSON.parse(localStorage.getItem('shred_qk_v1')).sessions.filter(s => s.manual).pop());
  check('quick log: one tap logs the set with how it felt; the rest timer starts', ql1?.rir === 2.5 && ql1.reps > 0 && await p.isVisible('#qlRest') && /Logged ✓/.test(await p.textContent('#qlNote')), JSON.stringify(ql1));
  await p.click('#qlRestSkip'); await p.waitForTimeout(400);
  check('quick log: after the rest, the next set is ready (same exercise, still quick log)', (await setNo()) === before + 1 && (await p.textContent('#setupEyebrow')).startsWith(qlEx) && await p.isVisible('#qlog'), `${before} → ${await setNo()}`);
  await p.evaluate(() => window.__qkVoice('done')); await p.waitForTimeout(250);
  check('quick log: saying "done" logs the set too', await p.evaluate(() => JSON.parse(localStorage.getItem('shred_qk_v1')).sessions.filter(s => s.manual).length) >= 2);
  check('quick log: hand-logged sets never count as camera clean reps', await p.evaluate(async () => { const { lifetimeClean } = await import('/js/rewards.js'); const S = JSON.parse(localStorage.getItem('shred_qk_v1')); return lifetimeClean(S.sessions.filter(s => s.manual)) === 0; }));
  await p.evaluate(() => { document.querySelector('#setup').hidden = true; });
  await go('progress'); await tap('#meCard summary'); await p.waitForTimeout(100);
  check('quick log: "How I log sets" setting, quick tap by default', (await p.inputValue('#pLogMode')) === 'quick');
  await setS(`S.prefs.logMode = 'camera'; S.program = null; delete S.checkin;`);

  // Workout builder: build a two-exercise program, save it, start it; day 1 becomes today's workout.
  await p.goto('https://shred.local/'); await go('train'); await tap('#buildNew');
  await p.fill('#bdName', 'QK Signature'); await p.click('[data-add="0"]'); await p.fill('#bdQ', 'bench press'); await p.waitForTimeout(150);
  await p.click('#bdResults [data-pick=benchPress]'); await p.click('#bdSearchClose'); await p.click('#bdSave'); await p.waitForTimeout(300);
  check('builder: a saved program opens ready to start', /QK Signature/.test(await p.textContent('#rsheetBody')) && await p.isVisible('[data-progstart]'));
  await p.click('[data-progstart]'); await p.waitForTimeout(300);
  await go('train'); await tap('#progStrip [data-prog=powerPump]'); await p.waitForTimeout(150);
  check('supersets: programs show A1/A2 pairs', /A1 Triceps Pushdown[\s\S]*A2 Hammer Curl/.test(await p.textContent('#rsheetBody')));
  await p.evaluate(() => { document.querySelector('#rsheet').hidden = true; });
  check('builder: your program runs like any other', /On QK Signature/.test(await p.textContent('#progActive')), await p.textContent('#progActive'));

  // Athletes: sport → position → season builds a programme; mixed-action bowlers get a warning.
  await p.goto('https://shred.local/'); await go('train'); await tap('#athleteBtn');
  check('athletes: 8 sports to choose from', (await p.$$('#rsheetBody [data-sport]')).length === 8);
  await p.click('[data-sport=cricket]'); await p.click('[data-role=fastMixed]'); await p.click('[data-phase=off]'); await p.waitForTimeout(200);
  check('athletes: mixed-action fast bowler programme, with the back-injury warning', /Fast bowler: mixed action/.test(await p.textContent('#rsheetBody')) && /lumbar stress/.test(await p.textContent('#rsheetBody')) && /Trap-Bar Deadlift/.test(await p.textContent('#rsheetBody')));
  await p.click('[data-progstart]'); await p.waitForTimeout(200);
  check('athletes: it runs like any programme', /On Cricket/.test(await p.textContent('#athleteSub')), await p.textContent('#athleteSub'));
  await tap('#progHero [data-prog]'); await p.waitForTimeout(200);
  check('athletes: fast bowler sheet links the bowling check', await p.isVisible('#rsheetBody [data-screen=bowl]'));
  await p.click('#rsheetBody [data-screen=bowl]'); await p.waitForTimeout(300);
  check('athletes: link opens the bowling check', await p.isVisible('[data-panel=bowl]'));
  await go('train'); await tap('#progHero [data-prog]'); await p.click('[data-progstop]'); await p.waitForTimeout(200);

  // Warm up, stretch & recover: today's drills and cool-down, plus recovery routines, run by QK.
  await p.goto('https://shred.local/'); await go('train');
  check('recover: drills, cool-down and 6 recovery routines on the Train tab', (await p.$$('#recoverStrip [data-routine]')).length === 8);
  await tap('[data-routine=today-stretch]'); await p.waitForTimeout(3200);
  check('recover: QK runs the cool-down stretch', await p.isVisible('#classPlayer') && /Hold/.test(await p.textContent('#cpKind')), await p.textContent('#cpKind'));
  await p.click('#cpEnd'); await p.waitForTimeout(200);

  // QK classes: start a HIIT class, QK runs it, the finisher is scored and saved.
  await p.goto('https://shred.local/'); await go('train');
  check('classes: HIIT classes on the Train tab', (await p.$$('#classStrip [data-class]')).length >= 6);
  check('home: an At home row with home programs and home sessions', (await p.$$('#homeStrip [data-prog]')).length >= 3 && (await p.$$('#homeStrip [data-class]')).length >= 5);
  await tap('[data-class=ignite20]'); await p.click('[data-classstart]'); await p.waitForTimeout(3200);
  check('classes: the player runs the warm-up', await p.isVisible('#classPlayer') && /Warm-up/.test(await p.textContent('#cpBlock')), await p.textContent('#cpBlock'));
  for (let i = 0; i < 80 && await p.isVisible('#classPlayer'); i++) { await p.click('#cpSkip'); await p.waitForTimeout(30); }
  await p.waitForTimeout(300);
  check('classes: finished class asks how hard it was', await p.isVisible('#classSave'));
  await p.click('#classSave'); await p.waitForTimeout(200);
  check('classes: the class is saved', /done 1×/.test(await p.textContent('[data-class=ignite20] .meta')));
  // Fitness Age: waist, resting heart rate, activity → one number and what would make you younger.
  await p.goto('https://shred.local/'); await p.waitForTimeout(400);
  await setS(`S.profile.age = 40; S.profile.sex = 'male'; S.vitals = [...(S.vitals || []), { at: Date.now() - 864e5, kind: 'hr', bpm: 72, source: 'camera' }];`);
  await p.reload(); await p.waitForTimeout(500); await go('body'); await tap('[data-go=fitage]'); await p.waitForTimeout(200);
  check('fitness age: resting heart rate filled from the camera reading', (await p.inputValue('#faRhr')) === '72', await p.inputValue('#faRhr'));
  await p.fill('#faWaist', '100'); await tap('[data-faact=no]'); await tap('#faGo'); await p.waitForTimeout(200);
  const faTxt = await p.textContent('#faResult');
  check('fitness age: a number, compared with their age, plus levers', /older than your age|younger than your age|Right on your age/.test(faTxt) && /What would make you younger/.test(faTxt) && /150 minutes/.test(faTxt), faTxt.slice(0, 200));
  check('fitness age: no medical disclaimer on the screen', !/not a medical|medical test|not medically|diagnos/i.test(await p.textContent('#fitage')));
  // Mind check: two rough mornings → QK asks; "Struggling" → support and a person to talk to.
  await setS(`S.readiness = [{ at: Date.now() - 864e5, feel: 'rough', sleepQ: 6, fatigue: 6, stress: 5, soreness: 6 }, { at: Date.now() - 2 * 864e5, feel: 'rough', sleepQ: 6, fatigue: 6, stress: 5, soreness: 6 }]; S.memory = { done: {} }; S.profile.pain = []; S.mind = [];`);
  await p.reload(); await p.waitForTimeout(600); await go('today'); await p.waitForTimeout(300);
  check('mind: after rough nights QK asks how they are, honestly', await p.isVisible('#memCard') && /How are you doing, honestly/.test(await p.textContent('#memCard')), await p.textContent('#memCard').catch(() => ''));
  await p.click('#memCard [data-mem="mind:struggling"]'); await p.waitForTimeout(300);
  const mt = await p.textContent('#memCard');
  check('mind: "struggling" → reassurance, talk to someone, helpline and "Let QK know"', /talk to someone/i.test(mt) && /Find a helpline/.test(mt) && /Let QK know/.test(mt), mt.slice(0, 160));
  await p.click('#memCard [data-mem="mindshare"]'); await p.waitForTimeout(200);
  check('mind: sharing tells the coach only "asked for support"', await p.evaluate(async () => { const { careSummary, careChips } = await import('/js/dash.js'); return careChips(careSummary(JSON.parse(localStorage.getItem('shred_qk_v1')))).includes('Asked for support'); }));
  // Fitness Age slips after two weeks without training.
  await setS(`S.memory = { done: {} }; S.readiness = []; S.checkinLog = []; S.checkin = null; S.mindReply = null; S.fitage = [{ at: Date.now() - 40 * 864e5, sex: 'male', age: 40, waist: 90, rhr: 62, active: true, fitnessAge: 36 }]; S.sessions = S.sessions.map(x => ({ ...x, at: Math.min(x.at, Date.now() - 18 * 864e5) })); S.classes = [];`);
  await p.reload(); await p.waitForTimeout(600); await go('today'); await p.waitForTimeout(300);
  check('lapse: "Your Fitness Age has gone up" after 18 days off', /Your Fitness Age has gone up to \d+/.test(await p.textContent('#memCard')), await p.textContent('#memCard').catch(() => ''));
  // Leaderboard: the score card on Progress opens the board with points, parts and how to earn more.
  await go('progress'); await p.waitForTimeout(200);
  check('leaderboard: card on Progress shows this week\'s points', /points/.test(await p.textContent('.b-card[data-go=board]')));
  await tap('.b-card[data-go=board]'); await p.waitForTimeout(300);
  const bt = await p.textContent('#board');
  check('leaderboard: own score, the five parts and tips to earn more', /points this week/.test(bt) && /Training/.test(bt) && /Sleep/.test(bt) && /Earn more this week/.test(bt), bt.slice(0, 200));
  await tap('#board details summary'); await p.fill('#bNick', 'Beast Mode'); await p.press('#bNick', 'Tab');
  check('leaderboard: nickname saved', await p.evaluate(() => JSON.parse(localStorage.getItem('shred_qk_v1')).profile.nickname) === 'Beast Mode');
  // Workout complete: the celebration screen with kg lifted, personal bests and a fun comparison.
  await setS(`S.memory = { done: {} }; const t = Date.now(); S.sessions.push({ at: t - 8 * 864e5, ex: 'squat', name: 'Back Squat', kg: 60, reps: 8 }, { at: t - 30 * 60e3, ex: 'squat', name: 'Back Squat', kg: 80, reps: 8, good: 8 }, { at: t - 20 * 60e3, ex: 'squat', name: 'Back Squat', kg: 80, reps: 8, good: 8 }); S.totals = null;`);
  await p.reload(); await p.waitForTimeout(600);
  await p.evaluate(async () => { const m = await import('/js/done-ui.js'); m.showDone({ then: () => { window.__afterDone = true; } }); });
  await p.waitForTimeout(1300);
  const dt = await p.textContent('#done');
  check('workout complete: full-screen celebration with kg lifted (counted up)', await p.isVisible('#done') && +(await p.textContent('#doneKg')).replace(/,/g, '') >= 1280, dt.slice(0, 160));
  check('workout complete: personal best with a medal, and a fun comparison', /Personal bests/.test(dt) && /Heaviest ever: 80 kg/.test(dt) && /That's about/.test(dt), dt.slice(0, 300));
  check('workout complete: confetti only because there was a real PR', await p.evaluate(() => document.querySelector('#done').classList.contains('big')));
  await p.click('#doneClose'); await p.waitForTimeout(150);
  check('workout complete: Continue closes it and moves on (cool-down offer)', !(await p.isVisible('#done')) && await p.evaluate(() => window.__afterDone === true));
  check('workout complete: saved to workout history', await p.evaluate(() => (JSON.parse(localStorage.getItem('shred_qk_v1')).workouts || []).length >= 1));
  // Weekly report: training, kg lifted, health scores, sleep and mind, one focus.
  await go('progress'); await p.waitForTimeout(150); await tap('[data-go=report]'); await p.waitForTimeout(300);
  await p.click('[data-rweek=this]'); await p.waitForTimeout(200);
  const rt = await p.textContent('#report');
  check('weekly report: wins, training with kg lifted, health, sleep & mind, one focus', /Wins/.test(rt) && /kg lifted|tonnes lifted/.test(rt) && /Your health/.test(rt) && /Sleep & mind/.test(rt) && /Next week, one thing/.test(rt), rt.slice(0, 300));
  // 3D Lab: the demo athlete filmed by two cameras → synced, 3D skeleton, measurements and flags.
  await go('body'); await tap('[data-go=lab]'); await p.waitForTimeout(200);
  check('3D lab: filming guide, four camera slots, and "four separate videos are not 3D"', (await p.$$('.lab-cams input[type=file]')).length === 4 && /not 3D/.test(await p.textContent('#lab')));
  await tap('#labDemo'); await p.waitForTimeout(800);
  const lt = await p.textContent('#labResult');
  check('3D lab: demo → synced, 3D measurements and flags', await p.isVisible('#labResult') && /4 cameras\. Synced by the movement \(Front \+0\.50 s/.test(lt) && /Knee bend, left/.test(lt) && /Knees moving in/.test(lt), lt.slice(0, 300));
  check('3D lab: skeleton drawn and turnable', await p.evaluate(() => { const c = document.querySelector('#labCanvas'); return c.width > 0 && c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some(x => x); }));
  check('3D lab: saved to the athlete history (no video)', await p.evaluate(() => { const l = JSON.parse(localStorage.getItem('shred_qk_v1')).lab || []; return l.length >= 1 && !('frames' in l[l.length - 1]); }));
  // Coach dashboard demo: this phone's training is the first client.
  await p.goto('https://shred.local/coach.html'); await p.waitForTimeout(700);
  check('dashboard demo: your own training is the first client, with sample clients', /\(this phone\)/.test(await p.textContent('.cd-row')) && (await p.$$('.cd-row')).length >= 7, (await p.textContent('.cd-row')).replace(/\s+/g, ' '));
  check('dashboard: the coach sees what to know (Bilal: sore knee, rough days)', /Sore: knee/.test(await p.textContent('#cdList')) && /2 rough days/.test(await p.textContent('#cdList')));

  // Dashboard: broadcast with the Dr. Doom template, preview with a name, and the board with prizes.
  check('dashboard: broadcast templates ready', (await p.$$('[data-bctpl]')).length >= 6);
  await p.click('[data-bctpl="0"]'); await p.waitForTimeout(100);
  check('dashboard: broadcast preview fills in the name', /Dr\. Doom aa gaya lekin tum gym nahi aaye, \w+/.test(await p.textContent('#bcPreview')), await p.textContent('#bcPreview'));
  await p.selectOption('#bcAud', 'notrain'); await p.selectOption('#bcAway', '3'); await p.waitForTimeout(100);
  const away = await p.$$('#bcWho [data-bcwho]:not([data-bcwho="*"])');
  check('dashboard: "hasn\'t trained for 3 days" lists who, with how long they\'ve been away', away.length >= 1 && /trained .* ago|trained never/.test(await p.textContent('#bcWho')), await p.textContent('#bcWho'));
  const cntBefore = await p.textContent('#bcCount');
  await p.click('#bcWho .bc-who input >> nth=0'); await p.waitForTimeout(100);
  check('dashboard: untick someone → one fewer selected', /^(\d+) of (\d+)/.exec(await p.textContent('#bcCount'))[1] === String(+/^(\d+)/.exec(cntBefore)[1] - 1), `${cntBefore} → ${await p.textContent('#bcCount')}`);
  await p.selectOption('#bcAud', 'noopen'); await p.selectOption('#bcAway', '90'); await p.waitForTimeout(100);
  check('dashboard: "hasn\'t opened the app for 3 months" works too', /selected/.test(await p.textContent('#bcCount')));
  check('dashboard: opens on the month board (the prize one), QK can record the top 3 (ties share a place)', (await p.$$('#cbList .b-row')).length >= 5 && await p.evaluate(() => { const rows = [...document.querySelectorAll('#cbList .b-row')]; const top = rows.filter(r => /🥇|🥈|🥉/.test(r.querySelector('.b-rank').textContent)); return top.length >= 3 && top.every(r => r.querySelector('[data-award]')) && rows.filter(r => r.querySelector('[data-award]')).length === top.length; }), await p.textContent('#cbList'));
  await p.click('[data-cbrange=week]'); await p.waitForTimeout(100);
  check('dashboard: week view offers a weekly MVP shout-out', await p.isVisible('#cbMvp'));
  await p.click('#cbMvp'); await p.waitForTimeout(150);
  check('dashboard: MVP shout-out fills the notification', /MVP is .+ with \d+ points/.test(await p.inputValue('#bcBody')), await p.inputValue('#bcBody'));
  // Squad dashboard: sample squad + this phone's 3D Lab tests; trends, squad comparison, add an athlete.
  await p.waitForTimeout(300);
  check('squad: roster with tests and flags (flagged athletes first)', (await p.$$('#sqList [data-ath]')).length >= 6 && /flag/.test(await p.textContent('#sqList')), await p.textContent('#sqCount'));
  check('squad: this phone\'s 3D Lab test appears as an athlete', /\(this phone\)/.test(await p.textContent('#sqList')));
  await p.click('#sqList [data-ath="a1"]'); await p.waitForTimeout(150);
  const sd = await p.textContent('#sqDetail');
  check('squad: athlete trend and squad comparison for their movement', /over time/.test(sd) && /Squad comparison/.test(sd) && /Squad average/.test(sd) && (await p.$$('#sqDetail .sq-chart')).length === 1, sd.slice(0, 200));
  await p.click('#cdSquad details summary'); await p.fill('#sqName', 'New Bowler'); await p.fill('#sqTeamIn', 'U19'); await p.click('#sqAdd'); await p.waitForTimeout(150);
  check('squad: add an athlete', /New Bowler/.test(await p.textContent('#sqList')));
  check('no JavaScript errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
