// Browser regression tests for the live camera screen, found 2026-11-28 while merging main's camera-accuracy update.
// Written BEFORE the fix.
//  1. Desktop Firefox shows its own "Picture-in-Picture" button over any playing video. On the camera screen that button
//     sat where the lifter taps to calibrate with the plate, so a tap popped the camera out into a separate window
//     instead of reaching the app ("This video is playing in Picture-in-Picture mode"). A live camera preview has no
//     use in a separate window, so the app turns that off for the camera video.
//  2. The new line under the rep counter ("Rep 10 · 92% range · slowing down") stayed from the previous set: a new set
//     opened showing 0 reps next to "Rep 10". It must start empty, like the rep dots.
// Run: node tests/camera-live.cjs   (E2E_BROWSER=chromium|firefox|webkit)
const { launch, finishSignUp } = require('./browser.cjs');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.task': 'application/octet-stream', '.webmanifest': 'application/manifest+json' };
let fails = 0, count = 0;
const check = (name, ok, detail = '') => { count++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail ? '  — ' + detail : ''}`); };

(async () => {
  const b = await launch({ chromiumArgs: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'], firefoxUserPrefs: { 'media.navigator.streams.fake': true, 'media.navigator.permission.disabled': true } });
  const camPerm = b.browserType().name() === 'webkit' ? { permissions: ['camera', 'microphone'] } : {};
  const c = await b.newContext({ viewport: { width: 400, height: 860 }, serviceWorkers: 'block', ...camPerm });
  await c.route('https://shred.local/**', r => { let p = new URL(r.request().url()).pathname; if (p === '/') p = '/index.html'; const f = path.join(ROOT, p);
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' }); r.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' } }); });
  await c.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, r => r.fulfill({ status: 200, body: '', headers: { 'content-type': 'text/css' } }));
  const p = await c.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
  try {
    await p.goto('https://shred.local/?demo'); await finishSignUp(p); // ?demo shows "Watch a demo set"
    check('the camera video can never be popped out into Picture-in-Picture',
      await p.$eval('#video', v => v.hasAttribute('disablepictureinpicture') && (!('disablePictureInPicture' in v) || v.disablePictureInPicture === true)));
    // A demo set fills the rep line, then a new live camera set starts.
    await p.click('.tabs [data-tab=train]'); await p.click('[data-muscle=All]'); await p.click('[data-train=squat]');
    if (await p.isVisible('#loadKg')) await p.fill('#loadKg', '80');
    await p.click('#startDemo');
    await p.waitForSelector('#summary:not([hidden])', { timeout: 60000 });
    const before = await p.textContent('#repLine');
    await p.click('#doneBtn');
    await p.click('.tabs [data-tab=train]'); await p.click('[data-muscle=All]'); await p.click('[data-train=squat]'); await p.click('#startCam'); await p.waitForTimeout(2500);
    const after = (await p.textContent('#repLine')).trim();
    check('a new set starts with an empty rep line (not the last set\'s "Rep 10 · …")', /Rep \d+/.test(before) && after === '' && (await p.textContent('#repNum')) === '0', `before: "${before}", new set: "${after}"`);
  } catch (e) { check('run completed', false, e.stack); }
  check('no JavaScript errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
})();
