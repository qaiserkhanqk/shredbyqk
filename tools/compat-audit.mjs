// Browser-compatibility audit. Finds which web-platform features the app and the research dashboard use, and looks
// up the first browser versions that support them in MDN's browser-compat-data (BCD), the dataset behind MDN's
// compatibility tables. Writes docs/browser-compat.md.
//
//   npm install --no-save @mdn/browser-compat-data@8.1.9
//   node tools/compat-audit.mjs --bcd node_modules/@mdn/browser-compat-data/data.json [--out docs/browser-compat.md]
//
// A feature counts as REQUIRED unless the code checks for it first. Each optional feature names the guard the audit
// expects to find; if the guard is missing from the code, the feature is reported as required, so a removed check is
// noticed. Detection is by pattern, so the table lists what the code visibly uses, not every API a library may call.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = k => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
if (!arg('bcd')) { console.error('usage: node tools/compat-audit.mjs --bcd path/to/@mdn/browser-compat-data/data.json [--out FILE]'); process.exit(2); }
const BCD = JSON.parse(readFileSync(arg('bcd'), 'utf8'));
const BROWSERS = [['chrome', 'Chrome'], ['chrome_android', 'Chrome Android'], ['firefox', 'Firefox'], ['firefox_android', 'Firefox Android'], ['safari', 'Safari (Mac)'], ['safari_ios', 'Safari / any browser on iOS'], ['samsunginternet_android', 'Samsung Internet']];

// [name, BCD path, pattern, guard (the code checks before use; `true` = harmless when unsupported), note]
const FEATURES = [
  ['ES modules', 'html.elements.script.type.module', /type=["']module["']/],
  ['Dynamic import()', 'javascript.operators.import', /\bimport\(\s*['"`/]/],
  ['Optional chaining ?.', 'javascript.operators.optional_chaining', /[\w\])]\?\.[\w$([]/],
  ['Nullish coalescing ??', 'javascript.operators.nullish_coalescing', /[\w\])'"]\s*\?\?\s*[^=]/],
  ['Logical assignment ||= &&= ??=', 'javascript.operators.logical_or_assignment', /(\|\||&&|\?\?)=/],
  ['Array.prototype.at()', 'javascript.builtins.Array.at', /\.at\(\s*-?\d/],
  ['structuredClone()', 'api.structuredClone', /\bstructuredClone\(/],
  ['crypto.randomUUID()', 'api.Crypto.randomUUID', /\brandomUUID\(/],
  ['Web Crypto AES-GCM', 'api.SubtleCrypto.encrypt', /\bsubtle\(?\)?\.(en|de)crypt\(|subtle\(\)\.encrypt/],
  ['IndexedDB', 'api.IDBFactory', /\bindexedDB\b/],
  ['Web Locks', 'api.LockManager', /navigator\??\.locks/, /navigator\?\.locks\s*\?/, 'Optional: only reduces cross-tab conflicts; writes stay atomic without it.'],
  ['BroadcastChannel', 'api.BroadcastChannel', /new BroadcastChannel\(/, /typeof BroadcastChannel !== 'undefined'/, 'Optional: other tabs also refresh through the storage event.'],
  ['Notifications', 'api.Notification', /\bNotification\.(permission|requestPermission)/, /typeof Notification === 'undefined'/, 'Optional. On iPhone, web notifications work only for an app added to the Home Screen (iOS 16.4+).'],
  ['Service worker (offline)', 'api.ServiceWorkerContainer', /navigator\.serviceWorker\.register/, /'serviceWorker' in navigator/, 'Optional: the app works online without it.'],
  ['Camera and microphone (getUserMedia)', 'api.MediaDevices.getUserMedia', /getUserMedia\(/, /navigator\.mediaDevices\?\.getUserMedia\b/, 'Optional. Needs HTTPS and permission; camera and recording features show a message without it.'],
  ['MediaRecorder', 'api.MediaRecorder', /new MediaRecorder\(/, /window\.MediaRecorder/, 'Optional: recording is skipped without it.'],
  ['Speech synthesis (coach voice)', 'api.SpeechSynthesis', /\bspeechSynthesis\b/, /'speechSynthesis' in window/, 'Optional: the coach falls back to text.'],
  ['CSS env() safe-area insets', 'css.types.env', /env\(safe-area/],
  ['CSS inset', 'css.properties.inset', /\binset:/],
  ['CSS gap in flexbox', 'css.properties.gap.flex_context', /\bgap:/],
  ['CSS grid', 'css.properties.display.grid', /display:\s*grid/],
  ['CSS aspect-ratio', 'css.properties.aspect-ratio', /aspect-ratio:/],
  ['CSS backdrop-filter', 'css.properties.backdrop-filter', /(^|[^-])backdrop-filter:/m, /-webkit-backdrop-filter:/, 'Cosmetic (blur behind sheets); older Safari needs the -webkit- prefix, which the stylesheet includes.'],
  ['CSS :focus-visible', 'css.selectors.focus-visible', /:focus-visible/, true, 'Harmless when unsupported: the browser\'s default focus outline is shown instead.'],
  ['CSS color-mix()', 'css.types.color.color-mix', /color-mix\(/],
  ['Web Bluetooth', 'api.Bluetooth', /navigator\.bluetooth/, null, 'Not used. Listed because a Bluetooth band route matters: see the note below the table.'],
];

const SCOPES = [['Phone app', ['index.html', 'sw.js', 'js', 'css'], ['js/vendor']], ['Research dashboard', ['research/web'], []]];
function files(paths, exclude) {
  const out = [];
  const walk = p => { const abs = join(ROOT, p); if (exclude.some(x => p.startsWith(x))) return; const st = statSync(abs);
    if (st.isDirectory()) for (const f of readdirSync(abs)) walk(join(p, f)); else if (/\.(m?js|css|html)$/.test(p)) out.push(p); };
  for (const p of paths) { try { walk(p); } catch { /* missing path */ } }
  return out;
}
const get = path => path.split('.').reduce((o, k) => o?.[k], BCD)?.__compat;
function support(c, b) {
  const s = c?.support?.[b]; if (!s) return { v: null, text: '?' };
  const x = (Array.isArray(s) ? s : [s]).find(e => !e.flags && !e.prefix && !e.alternative_name) || (Array.isArray(s) ? s[0] : s);
  if (x.version_added === false || x.flags) return { v: Infinity, text: 'no' };
  const v = String(x.version_added).replace(/^≤/, ''), n = parseFloat(v);
  return { v: Number.isFinite(n) ? n : null, text: `${x.version_added}${x.partial_implementation ? ' (partial)' : ''}${x.version_removed ? ` (removed ${x.version_removed})` : ''}` };
}

const md = [`# Browser compatibility (generated)`, '',
  `Generated by \`tools/compat-audit.mjs\` from MDN browser-compat-data ${BCD.__meta?.version ?? '?'} (${BCD.__meta?.timestamp?.slice(0, 10) ?? 'date unknown'}). Regenerate after code changes. The table lists features the code visibly uses, found by pattern.`, '',
  '**How to read it:**',
  '- A **required** feature is used without a check. A browser older than its version cannot run that part of the app.',
  '- An **optional** feature is checked for first, and the app works without it.',
  '- Every browser on iPhone and iPad uses Safari\'s engine, so the iOS column applies to Chrome and Firefox on iOS too.', ''];
for (const [scope, paths, exclude] of SCOPES) {
  const fs = files(paths, exclude), text = Object.fromEntries(fs.map(f => [f, readFileSync(join(ROOT, f), 'utf8')]));
  const rows = [];
  for (const [name, path, re, guard, note] of FEATURES) {
    const used = fs.filter(f => re.test(text[f])); if (!used.length && path !== 'api.Bluetooth') continue;
    if (!used.length) { rows.push({ name, path, used, kind: 'not used', note }); continue; }
    const guarded = guard === true || (guard ? used.every(f => guard.test(text[f])) || (path.startsWith('css.') && fs.some(f => guard.test(text[f]))) : false);
    rows.push({ name, path, used, kind: guarded ? 'optional' : 'required', note: guard && !guarded ? `${note || ''} **Expected guard not found: treated as required.**`.trim() : note });
  }
  md.push(`## ${scope}`, '', `| Feature | Use | ${BROWSERS.map(b => b[1]).join(' | ')} | Where | Note |`, `|---|---|${BROWSERS.map(() => '---').join('|')}|---|---|`);
  const min = Object.fromEntries(BROWSERS.map(([b]) => [b, { v: 0, by: [] }]));
  for (const r of rows) {
    const c = get(r.path), cells = BROWSERS.map(([b]) => { const s = support(c, b);
      if (r.kind === 'required' && s.v != null) { if (s.v > min[b].v) min[b] = { v: s.v, by: [r.name] }; else if (s.v === min[b].v) min[b].by.push(r.name); }
      return c ? s.text : 'not in BCD'; });
    md.push(`| ${r.name} | ${r.kind} | ${cells.join(' | ')} | ${r.used.slice(0, 3).map(f => `\`${relative('.', f)}\``).join(', ')}${r.used.length > 3 ? ` +${r.used.length - 3}` : ''} | ${r.note || ''} |`);
  }
  md.push('', `**Oldest versions that can run the required parts of the ${scope.toLowerCase()}:**`, '',
    ...BROWSERS.map(([b, label]) => `- ${label}: ${min[b].v === Infinity ? 'not supported' : min[b].v || 'any'}${min[b].by.length ? ` (because of ${[...new Set(min[b].by)].join(', ')})` : ''}`), '');
}
md.push('## Notes for the band integration', '',
  '- **Web Bluetooth is not available in Safari, on any iPhone or iPad, or in Firefox.** A band that connects over Bluetooth therefore needs one of two routes on iPhone:',
  '  - a native app or wrapper using the supplier\'s SDK;',
  '  - a server or cloud route that the supplier provides.',
  '- Ask the supplier which routes they support. This is `platform_route` in the acceptance test.',
  '- These are version numbers from a public dataset, not test results. Real-phone testing is still needed: see `docs/real-phone-testing.md`.');
const out = arg('out') || join(ROOT, 'docs', 'browser-compat.md');
writeFileSync(out, md.join('\n') + '\n');
console.log(`Wrote ${relative(ROOT, out)}`);
