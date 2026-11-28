// Checks the whole camera path in a real browser: fake camera video (tools/make-pulse-video.py) → app → result.
// Usage: node tests/camera-pulse.cjs VIDEO.y4m [hr|hrv]   (needs Playwright + Chromium; not part of npm test)
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), VID = process.argv[2], MODE = process.argv[3] || 'hr';
const T = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json' };
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${VID}`] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.route('https://shred.local/**', r => { let p = new URL(r.request().url()).pathname; if (p === '/') p = '/index.html'; const f = path.join(ROOT, p);
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' }); r.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': T[path.extname(f)] || 'application/octet-stream' } }); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('https://shred.local/'); await p.fill('#welcomeName', 'T'); await p.click('#welcomeBtn'); await p.click('#aboutNext'); /* merge 2026-11-27: skip the optional "about you" step */ await p.click('[data-focus=train]'); await p.click('#obSkip');
  await p.click('#today [data-go=body]'); await p.click('#body [data-go=vitals]');
  await p.click(MODE === 'hrv' ? '#vHrv' : '#vHr');
  const ok = await p.waitForSelector('#mResult:not([hidden])', { timeout: MODE === 'hrv' ? 90000 : 40000 }).then(() => true).catch(() => false);
  const st = await p.evaluate(() => { const s = window.__shredLastPulse || []; const dt = s.slice(1).map((x, i) => (x.t - s[i].t) * 1000); const dup = s.slice(1).filter((x, i) => x.v === s[i].v).length; dt.sort((a, b) => a - b); return { n: s.length, fps: (s.length / ((s.at(-1)?.t - s[0]?.t) || 1)).toFixed(1), dtMin: dt[0]?.toFixed(1), dtMed: dt[dt.length >> 1]?.toFixed(1), dtMax: dt.at(-1)?.toFixed(1), dup }; }); console.log(JSON.stringify(st)); if (process.env.DUMP) fs.writeFileSync(process.env.DUMP, JSON.stringify(await p.evaluate(() => window.__shredLastPulse)));
  console.log(MODE, ok ? 'RESULT ' + await p.textContent('#mValue') : 'NO RESULT: ' + await p.textContent('#mStatus'), errs.join('|'));
  if (process.argv[4]) await p.screenshot({ path: process.argv[4] });
  await b.close();
})();
