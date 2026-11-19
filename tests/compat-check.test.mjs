// The old-browser notice (js/compat-check.js): silent on a current browser, a plain message when a required feature
// is missing, and written in old JavaScript so it can run where the app's modules cannot.
// Run: node tests/compat-check.test.mjs
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(ROOT, 'js', 'compat-check.js'), 'utf8');
let fails = 0, count = 0;
const check = (n, ok, d = '') => { count++; if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${!ok && d ? '  — ' + d : ''}`); };

function run(win) {
  const inserted = [];
  const doc = { body: { firstChild: null, insertBefore: el => inserted.push(el) }, createElement: tag => (tag === 'script' ? { noModule: false } : { tag, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } }), addEventListener() {} };
  const w = { document: doc, ...win };
  vm.runInNewContext(src, { window: w, Array: { prototype: win.arrayAt === false ? {} : { at() {} } } });
  return { w, inserted };
}
const modern = { structuredClone() {}, crypto: { randomUUID() {}, subtle: {} }, indexedDB: {} };
const ok = run(modern);
check('a current browser: no notice, nothing missing', ok.inserted.length === 0 && ok.w.__shredCompat.ok === true);
for (const [label, win] of [['no structuredClone (iOS 15.3 and older)', { ...modern, structuredClone: undefined }], ['no crypto.randomUUID', { ...modern, crypto: { subtle: {} } }], ['no IndexedDB', { ...modern, indexedDB: undefined }], ['no Array.prototype.at', { ...modern, arrayAt: false }]]) {
  const r = run(win);
  check(`${label}: a plain notice is shown, as an alert`, r.inserted.length === 1 && r.inserted[0].attrs.role === 'alert' && /too old/.test(r.inserted[0].textContent) && /iOS 15\.4/.test(r.inserted[0].textContent) && r.w.__shredCompat.ok === false);
}
check('written in old JavaScript (no arrow functions, let/const, classes, template strings, ?. or ??)', !/=>|\blet\b|\bconst\b|\bclass\b|`|\?\.|\?\?/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')));
check('it sends nothing (no fetch, XHR, beacon or storage)', !/fetch|XMLHttpRequest|sendBeacon|localStorage|indexedDB\.open/.test(src));
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
check('index.html loads it as a classic script before the app module', html.indexOf('<script src="js/compat-check.js"></script>') > -1 && html.indexOf('js/compat-check.js') < html.indexOf('type="module" src="js/app.js"'));
const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
check('the offline cache includes it (and its version was bumped)', /'js\/compat-check\.js'/.test(sw) && !/shred-qk-v7'/.test(sw));
console.log(fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`); process.exit(fails ? 1 : 0);
