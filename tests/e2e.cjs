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
    if (['gait', 'scan', 'rehab'].includes(id)) { await go('body'); await p.click(`[data-go=${id}]`); }
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
  await p.click('#doneBtn');

  // 2. Library + voice-guided hold
  await go('train'); await p.click('[data-muscle=Core]');
  check('library: core filter', /15 exercises/.test(await p.textContent('#exCount')));

  // 3. Live camera form check (fake camera, no person) starts without errors
  await p.click('[data-muscle=All]'); await p.click('[data-train=squat]'); await p.click('#startCam'); await p.waitForTimeout(5000);
  check('camera: live squat session starts', await p.isVisible('#live') && (await p.textContent('#status')) === '');
  check('camera: Calibrate button shown for barbell lift', await p.isVisible('#calBtn'));
  await p.click('#calBtn'); await p.click('#viewport', { position: { x: 200, y: 200 } }); await p.click('#viewport', { position: { x: 200, y: 330 } });
  check('calibration: two taps accepted', /Calibrated/.test(await p.textContent('#status')));
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
  check('cycle: 5 cycles → estimated range with the cycles explained', /Estimated range/.test(await p.textContent('#cyHeadline')) && /between 29 and 31 days/.test(detail) && await p.isVisible('.cy-range'), detail);
  await p.fill('#cyDate', dayStr(-3)); await cy('[data-act=logSpotting]');
  check('cycle: spotting logged without changing the estimate', (await p.textContent('#cyDetail')) === detail);
  await tap('#cyHistory summary');
  await p.$eval('#cyHistory [data-pid] [data-edit=start]', (el, v) => { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, dayStr(-16)); await p.waitForTimeout(500);
  check('cycle: correcting the latest start updates the estimate', /between 25 and 31 days/.test(await p.textContent('#cyDetail')), await p.textContent('#cyDetail'));
  await tap('#cySettings summary'); await cy('#cySettings [data-cat=energy]', 500);
  await p.selectOption('#cyLog [data-sym=energy]', 'low'); await cy('[data-act=saveDay]');
  check('cycle: optional symptom (energy) logged after switching it on', /\(current\)[\s\S]*energy low/.test(await p.textContent('#cyHistory')) && /Energy: not enough data/.test(await p.textContent('#cyPatterns')));
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
  const ls = await p.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  const cyKey = Object.keys(ls).find(k => k.startsWith('shred_cycle_v1:'));
  check('cycle: stored encrypted (no dates or words in the stored value)', !!cyKey && /AES-GCM/.test(ls[cyKey]) && !/20\d\d-|spotting|energy/.test(ls[cyKey]));
  check('cycle: nothing cycle-related in the main store or error log', !/spotting|period|energy|cycle/i.test((ls.shred_qk_v1 || '') + (ls.shred_errors_v1 || '')));
  const [cdl] = await Promise.all([p.waitForEvent('download'), tap('[data-act=export]')]);
  const exp = JSON.parse(fs.readFileSync(await cdl.path(), 'utf8'));
  check('cycle: export contains the user\'s data', exp.format === 'shred-cycle-export' && exp.data.periods.length === 6);
  await cy('[data-act=deleteAll]', 800);
  const after = await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('shred_cycle_v1:')));
  check('cycle: delete all → data gone and consent asked again', await p.isVisible('#cyConsent') && after.length === 0);

  // Two tabs (audit of 9f87b83, findings 1.1 and 1.3): no lost updates, and a deletion can't be undone by another tab
  await p.check('#cyAgree'); await cy('[data-act=consent]', 600);
  const q = await ctx.newPage(); q.on('dialog', d => d.accept()); q.on('pageerror', e => errs.push('tab2: ' + e.message));
  await q.goto('https://shred.local/'); await q.click('#welcomeBtn'); await q.click('.tabs [data-tab=body]'); await q.click('[data-go=cycle]'); await q.waitForSelector('#cyLog');
  await p.fill('#cyDate', dayStr(-40)); await cy('[data-act=logStart]', 500);
  await q.fill('#cyDate', dayStr(-10)); await q.click('[data-act=logStart]'); await q.waitForTimeout(600);
  await p.waitForTimeout(400); if (!(await p.$('#cyHistory[open]'))) await tap('#cyHistory summary');
  const both = await p.$$eval('#cyHistory [data-edit=start]', els => els.map(e => e.value).sort());
  check('two tabs: entries from both tabs are kept (no lost update)', JSON.stringify(both) === JSON.stringify([dayStr(-40), dayStr(-10)].sort()), JSON.stringify(both));
  if (!(await p.$('#cySettings[open]'))) await tap('#cySettings summary');
  await cy('[data-act=deleteAll]', 800);
  await q.waitForTimeout(600);
  check('two tabs: the other tab clears itself after a delete elsewhere', await q.isVisible('#cyConsent'));
  const slotsAfter = await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('shred_cycle_v1:')).length);
  await p.reload(); await p.click('#welcomeBtn'); await p.click('.tabs [data-tab=body]'); await p.click('[data-go=cycle]'); await p.waitForTimeout(700);
  check('two tabs: after delete + reload, nothing comes back and no "can\'t unlock" error', slotsAfter === 0 && await p.isVisible('#cyConsent') && !(await p.$('#cyUnavailable')));
  await q.close();
  // Recovery path (finding 1.4): unreadable data → reset button → consent screen
  await p.evaluate(() => { const uid = localStorage.getItem('shred_cycle_uid'); localStorage.setItem('shred_cycle_v1:' + uid, JSON.stringify({ v: 2, gen: Number(localStorage.getItem('shred_cycle_gen:' + uid)) || 0, rev: 1, alg: 'AES-GCM-256', iv: 'AAAAAAAAAAAAAAAA', ct: 'AAAAAAAAAAAAAAAAAAAAAA==' })); });
  await p.reload(); await p.click('#welcomeBtn'); await p.click('.tabs [data-tab=body]'); await p.click('[data-go=cycle]'); await p.waitForTimeout(700);
  const stuck = await p.isVisible('#cyUnavailable') && await p.isVisible('[data-act=resetStorage]');
  await cy('[data-act=resetStorage]', 800);
  check('unreadable data: a reset button is offered and returns to the consent screen', stuck && await p.isVisible('#cyConsent'));

  check('no JavaScript errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
