// Phone-layout test of the app on emulated phones (iPhone SE, iPhone 13, Pixel 7 screen sizes, touch, mobile mode),
// on every main tab and on the cycle screens with synthetic data. Checks, per phone and screen:
//   • nothing is wider than the screen (no sideways scrolling);
//   • every visible control is at least 24×24 CSS px (WCAG 2.2 success criterion 2.5.8, minimum target size);
//   • text inputs and menus use at least 16 px text (iOS Safari zooms the page when a smaller field is focused);
//   • pinch-zoom is not disabled.
// Emulation runs in the browser chosen by E2E_BROWSER (default Chromium): it checks layout, not Safari's engine. Real
// iPhones and Android phones still need testing (docs/real-phone-testing.md). Synthetic data only.
// Run: node tests/mobile-layout.cjs
const { devices } = require('playwright');
const { launch } = require('./browser.cjs');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.task': 'application/octet-stream', '.webmanifest': 'application/manifest+json' };
let fails = 0, count = 0;
const check = (name, ok, detail = '') => { count++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail ? '  — ' + detail : ''}`); };
const PHONES = ['iPhone SE', 'iPhone 13', 'Pixel 7'];
const dayStr = n => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const FLAGS = { cycleTracking: true, phaseEducation: true, patternInsights: true, symptomForecast: true, quickSuggestions: true, sensorPrompts: true, temperatureResearch: true, lhTests: true, comfortSuggestions: true, midlifeMode: true, companion: true };

// Runs in the page: measures the visible screen.
function measure() {
  const W = window.innerWidth, out = { overflowPx: Math.max(0, document.scrollingElement.scrollWidth - W), wide: [], small: [], smallText: [] };
  const name = el => { const id = el.id ? `#${el.id}` : '', act = el.dataset?.act ? `[data-act=${el.dataset.act}]` : el.dataset?.tab ? `[data-tab=${el.dataset.tab}]` : el.dataset?.go ? `[data-go=${el.dataset.go}]` : '';
    const txt = (el.getAttribute('aria-label') || el.textContent || el.value || el.name || '').trim().replace(/\s+/g, ' ').slice(0, 24); return `${el.tagName.toLowerCase()}${id}${act}${txt ? ` "${txt}"` : ''}`; };
  const visible = el => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden]'); };
  const inScroller = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return true; } return false; };
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > W + 1 && !inScroller(el) && getComputedStyle(el).position !== 'fixed') out.wide.push(`${name(el)} (right edge ${Math.round(r.right)} > ${W})`);
  }
  const controls = document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button]');
  for (const el of controls) {
    if (!visible(el) || el.disabled) continue;
    // A checkbox or radio inside its label is tapped through the label, so the label is the target.
    const t = (el.type === 'checkbox' || el.type === 'radio') && el.closest('label') ? el.closest('label') : el;
    // Inline links inside a sentence are exempt in WCAG 2.5.8.
    if (el.tagName === 'A' && getComputedStyle(el).display === 'inline' && el.parentElement && /^(P|LI|SPAN|SMALL|TD)$/.test(el.parentElement.tagName)) continue;
    const r = t.getBoundingClientRect();
    if (r.width < 24 - 0.5 || r.height < 24 - 0.5) out.small.push(`${name(el)} ${Math.round(r.width)}×${Math.round(r.height)}`);
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && !['checkbox', 'radio', 'range', 'button', 'submit', 'file', 'color'].includes(el.type) && parseFloat(getComputedStyle(el).fontSize) < 16) out.smallText.push(`${name(el)} ${getComputedStyle(el).fontSize}`);
  }
  const vp = document.querySelector('meta[name=viewport]')?.content || '';
  out.zoomDisabled = /user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/.test(vp);
  out.dedupe = true; out.wide = [...new Set(out.wide)]; out.small = [...new Set(out.small)]; out.smallText = [...new Set(out.smallText)];
  return out;
}

(async () => {
  const b = await launch(), errs = [];
  const serve = r => { let p = new URL(r.request().url()).pathname; if (p === '/') p = '/index.html'; const f = path.join(ROOT, p);
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' }); r.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' } }); };
  const isFirefox = b.browserType().name() === 'firefox';
  for (const phone of PHONES) {
    const d = { ...devices[phone] }; delete d.defaultBrowserType; if (isFirefox) delete d.isMobile; // Firefox has no mobile mode
    const c = await b.newContext({ ...d, serviceWorkers: 'block' });
    await c.route('https://shred.local/**', serve);
    await c.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, r => r.fulfill({ status: 200, body: '', headers: { 'content-type': 'text/css' } })); // no network in tests
    await c.addInitScript(f => localStorage.setItem('shred_flags_v1', JSON.stringify(f)), FLAGS);
    const p = await c.newPage(); p.on('pageerror', e => errs.push(`${phone}: ${e.message}`)); p.on('dialog', x => x.accept());
    const screen = async label => {
      await p.waitForTimeout(350);
      const m = await p.evaluate(measure);
      check(`${phone} · ${label}: nothing wider than the screen`, m.overflowPx <= 1 && m.wide.length === 0, `${m.overflowPx}px sideways; ${m.wide.slice(0, 4).join('; ')}`);
      check(`${phone} · ${label}: every control at least 24×24 px`, m.small.length === 0, `${m.small.length}: ${m.small.slice(0, 6).join('; ')}`);
      check(`${phone} · ${label}: input text at least 16 px (no iOS zoom on focus)`, m.smallText.length === 0, m.smallText.slice(0, 6).join('; '));
      return m;
    };
    await p.goto('https://shred.local/'); await p.waitForTimeout(400);
    const first = await screen('welcome');
    check(`${phone}: pinch-zoom is not disabled`, first.zoomDisabled === false);
    await p.tap('#welcomeBtn');
    for (const tab of ['today', 'train', 'progress', 'body']) { await p.tap(`.tabs [data-tab=${tab}]`); await screen(`${tab} tab`); }
    await p.tap('.tabs [data-tab=body]'); await p.tap('[data-go=cycle]'); await screen('cycle consent');
    await p.check('#cyAgree'); await p.tap('[data-act=consent]'); await p.waitForTimeout(400);
    await p.evaluate(async today => {
      const S = await import('/js/cycle/store.js'), M = await import('/js/cycle/model.js'), D = await import('/js/cycle/dates.js');
      const repo = await S.openCycleRepo({ storage: S.indexedDbStorage(), keys: S.indexedDbKeys(), userId: localStorage.getItem('shred_cycle_uid') });
      await repo.update(s => {
        for (const k of ['energy', 'mood', 'sleep', 'pain', 'training']) try { M.setCategory(s, k, true); } catch { /* category may not exist */ }
        const last = D.addDays(today, -12), starts = Array.from({ length: 5 }, (_, i) => D.addDays(last, -29 * (4 - i)));
        for (const st of starts) M.logPeriodStart(s, st, { today });
        starts.slice(0, 4).forEach(st => { for (let k = 1; k <= 29; k++) M.logDay(s, D.addDays(st, k - 1), { energy: k > 22 ? 'low' : 'usual' }, { today }); });
        M.logDay(s, today, { pain: 'moderate' }, { today }); // so the comfort card (flag comfortSuggestions) is on screen too
        M.setSituation(s, 'perimenopause', true); for (const k of ['hotFlushes', 'focus']) M.setCategory(s, k, true); // midlife card and its symptoms on screen too
      });
    }, dayStr(0));
    await p.tap('.tabs [data-tab=today]'); await p.tap('.tabs [data-tab=body]'); await p.tap('[data-go=cycle]');
    await screen('cycle screen with synthetic history');
    const sum = p.locator('[data-act=summary]:visible').first();
    // The summary button is only shown in some states.
    if (await sum.count()) { await sum.scrollIntoViewIfNeeded(); await p.waitForTimeout(300); await sum.tap({ timeout: 10000 }); await screen('cycle summary'); }
    await c.close();
  }
  check('no JavaScript errors on any phone', errs.length === 0, errs.slice(0, 5).join(' | '));
  await b.close();
  console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
