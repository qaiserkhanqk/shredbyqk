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
  await p.goto('https://shred.local/'); await p.click('#welcomeBtn');

  // Profile height enables height-scaled bar speed.
  await p.click('#today details.card:not(#diagCard) summary'); await p.fill('#pHeight', '178'); await p.press('#pHeight', 'Tab');

  // 1. Demo set through the real engine
  await p.click('.tabs [data-tab=train]'); await p.click('.ex-card.feature');
  check('setup: weight field shown for a barbell lift', await p.isVisible('#loadWrap'));
  await p.fill('#loadKg', '80'); await p.click('#startDemo');
  await p.waitForSelector('#summary:not([hidden])', { timeout: 60000 });
  check('demo set: 10 reps, 7 clean', (await p.textContent('#sReps')) === '10' && /7 clean/.test(await p.textContent('#sClean')));
  check('demo set: bar speed card shown (hip thrust is horizontal → asks for plate calibration)', await p.isVisible('#vbtCard') && /Calibrate|plate/.test(await p.textContent('#vbtNote')));
  await p.click('#doneBtn');

  // 2. Library + voice-guided hold
  await p.click('.tabs [data-tab=train]'); await p.click('[data-muscle=Core]');
  check('library: core filter', /15 exercises/.test(await p.textContent('#exCount')));

  // 3. Live camera form check (fake camera, no person) starts without errors
  await p.click('[data-muscle=All]'); await p.click('[data-train=squat]'); await p.click('#startCam'); await p.waitForTimeout(5000);
  check('camera: live squat session starts', await p.isVisible('#live') && (await p.textContent('#status')) === '');
  check('camera: Calibrate button shown for barbell lift', await p.isVisible('#calBtn'));
  await p.click('#calBtn'); await p.click('#viewport', { position: { x: 200, y: 200 } }); await p.click('#viewport', { position: { x: 200, y: 330 } });
  check('calibration: two taps accepted', /Calibrated/.test(await p.textContent('#status')));
  await p.click('#endLive'); await p.click('#doneBtn');

  // 4. Tests tab: gait demo, jump + knee test panels, live test capture starts
  await p.click('.tabs [data-tab=gait]'); await p.click('#gaitDemo');
  await p.waitForSelector('#gaitResult:not([hidden])', { timeout: 30000 });
  const gait = await p.textContent('#gaitResult');
  check('gait demo: report with quality badge and hip finding', /Quality 100\/100/.test(gait) && /hip extension \(right/i.test(gait));
  // Diagnostics: shows the last session (the gait demo) and exports it for replay
  await p.click('.tabs [data-tab=today]'); await p.click('#diagCard summary'); await p.waitForTimeout(300);
  check('diagnostics: last session listed ', /gait · \d+ frames/.test(await p.textContent('#diagTable')), await p.textContent('#diagTable'));
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#exportSession')]);
  const json = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  check('diagnostics: exported session replayable (meta + frames)', json.meta.kind === 'gait' && json.frames.length > 10 && Array.isArray(json.frames[0].p));

  await p.click('#diagCard summary'); await p.click('.tabs [data-tab=gait]');
  await p.click('[data-test=jump]');
  check('jump panel shown, demo hidden', await p.isVisible('[data-panel=jump]') && !(await p.isVisible('#gaitDemo')));
  await p.click('[data-test=sls]'); await p.click('#testLive'); await p.waitForTimeout(6000);
  check('knee test: live capture runs (camera granted)', await p.isVisible('#live') && /Single-leg/.test(await p.textContent('#liveEyebrow')) && !/blocked/.test(await p.textContent('#status')));
  await p.click('#endLive'); await p.waitForTimeout(500);
  check('knee test with no person: refuses to give a result', /No result yet/.test(await p.textContent('#gaitResult')));

  // 5. Two-view scan rejects a non-neutral pose (the sample photo is a yoga lunge)
  await p.click('.tabs [data-tab=scan]');
  await p.setInputFiles('#scanFront', process.argv[2] || path.join(ROOT, 'tests/pose.jpg')).catch(() => {});
  await p.waitForSelector('#toast:not([hidden])', { timeout: 60000 }).catch(() => {});
  check('two-view scan: lunge photo rejected with advice', /knees|arms|feet|Stand/.test(await p.textContent('#toast')));

  check('no JavaScript errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
