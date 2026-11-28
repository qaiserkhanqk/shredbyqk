// Browser regression test: Sukoon must never leave her in silence when the recitation can't play.
// Found 2026-11-27 (browser report, merged app): in Firefox an undecodable recitation never fires the audio element's
// "error" event, so the screen stayed on "Bismillah" in silence with no Quran.com link. Written BEFORE the fix. To make
// it the same in every browser, the audio element is replaced so it neither plays nor reports an error.
// Run: node tests/sukoon-fallback.cjs   (E2E_BROWSER=chromium|firefox|webkit)
const { launch, finishSignUp } = require('./browser.cjs');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.task': 'application/octet-stream', '.webmanifest': 'application/manifest+json' };
let fails = 0, count = 0;
const check = (name, ok, detail = '') => { count++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail ? '  — ' + detail : ''}`); };

(async () => {
  const b = await launch(), errs = [];
  const serve = r => { let p = new URL(r.request().url()).pathname; if (p === '/') p = '/index.html'; const f = path.join(ROOT, p);
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' }); r.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' } }); };
  /** behaviour: 'silent' (play() resolves, then nothing: no "playing", no "error"), 'playing' (it really plays),
   *  'blocked' (the phone refuses to start sound without a tap). */
  async function session(behaviour) {
    const c = await b.newContext({ serviceWorkers: 'block', viewport: { width: 400, height: 860 } });
    await c.route('https://shred.local/**', serve);
    await c.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, r => r.fulfill({ status: 200, body: '', headers: { 'content-type': 'text/css' } }));
    await c.route(/^https?:\/\/(everyayah\.com|verses\.quran\.com|verses\.quran\.foundation)\//, r => r.fulfill({ status: 200, body: '', headers: { 'content-type': 'audio/mpeg' } }));
    await c.addInitScript(mode => {
      const M = HTMLMediaElement.prototype;
      M.load = function () {};
      M.play = function () {
        if (mode === 'blocked') return Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }));
        if (mode === 'playing') setTimeout(() => { this.dispatchEvent(new Event('playing')); this.dispatchEvent(new Event('timeupdate')); }, 300);
        return Promise.resolve(); // 'silent': nothing else ever happens
      };
      // No real decoding at all, so a browser's own "error" event can't decide the result.
      Object.defineProperty(M, 'src', { set(v) { this._src = v; }, get() { return this._src || ''; }, configurable: true });
    }, behaviour);
    const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto('https://shred.local/'); await finishSignUp(p);
    await p.click('.tabs [data-tab=today]'); await p.click('#today [data-go=body]'); await p.click('#body [data-go=calm]');
    await p.click('[data-goal=anxiety]'); await p.click('#calmStart'); await p.click('#cBefore [data-v="3"]').catch(() => {});
    await p.click('#cCont').catch(() => {}); await p.waitForTimeout(1200);
    await p.click('#calmSkip'); // breathing → listen
    return { c, p };
  }
  const links = p => p.$$eval('#calmLinks a[href^="https://quran.com/"]', as => as.length).catch(() => 0);
  try {
    { const { c, p } = await session('silent');
      await p.waitForTimeout(12000);
      const msg = await p.textContent('#calmAyah').catch(() => '');
      check('recitation never starts and never reports an error: within 12 s she is offered the passage on Quran.com', (await links(p)) > 0, msg);
      check('…with a plain message saying it could not load', /Couldn.t load the recitation/.test(msg), msg);
      await c.close(); }
    { const { c, p } = await session('playing');
      await p.waitForTimeout(12000);
      check('control: when the recitation is playing, no fallback appears (no false alarm)', (await links(p)) === 0, await p.textContent('#calmAyah').catch(() => ''));
      await c.close(); }
    { const { c, p } = await session('blocked');
      await p.waitForTimeout(12000);
      check('control: when the phone needs a tap to start sound, the "Play recitation" button stays (no fallback over it)', !!(await p.$('#calmPlay')) && (await links(p)) === 0);
      await c.close(); }
  } catch (e) { check('run completed', false, e.stack); }
  check('no JavaScript errors', errs.length === 0, errs.join(' | '));
  await b.close();
  console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
})();
