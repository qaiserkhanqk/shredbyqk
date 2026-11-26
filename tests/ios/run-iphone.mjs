// Real-device test of the app in iPhone Safari, driven from a Mac with Apple's safaridriver (W3C WebDriver).
// No dependencies: plain fetch calls to the WebDriver API. Synthetic data only.
//
// Before running (see docs/real-phone-results-*.md for the full steps):
//   1. bash tests/ios/make-certs.sh <Mac-IP>; install tests/ios/.certs/ca.pem on the iPhone with FULL trust.
//   2. node tests/ios/serve-https.mjs <Mac-IP>        (separate terminal)
//   3. safaridriver -p 4444                            (separate terminal; iPhone unlocked, cable connected)
//   4. node tests/ios/run-iphone.mjs https://<Mac-IP>:8443/ [log-file]
//
// Ports the key checks of tests/e2e.cjs (cycle section), cycle-ui-pregnancy.cjs, cycle-ui-companion.cjs,
// cycle-ui-adjust.cjs, privacy-check.cjs and mobile-layout.cjs, plus "data survives a full reload".
// Differences from the Playwright versions, all forced by WebDriver on a real phone, are written to the log:
//   • JavaScript errors and console output are collected by a listener added right after each page load, so an error
//     thrown during the first moments of loading would be missed.
//   • Other-server requests are listed from the page's performance resource entries (per page, read before leaving it).
//   • confirm()/alert() are answered "OK" by a stub (as Playwright's dialog.accept()), so no system dialog blocks the run.
//   • Date and menu fields are set by script (the iOS date picker cannot be driven); buttons are real WebDriver taps,
//     falling back to a script click only when Safari reports the tap target covered; each fallback is logged.
//   • The export is read from the file the app hands to the browser, not from the Files app.
// Log: every check, the device and Safari details, and notes. The terminal shows only the totals.
import fs from 'node:fs';
import path from 'node:path';

const APP = (process.argv[2] || '').replace(/\/?$/, '/');
const WD = process.env.WD_URL || 'http://127.0.0.1:4444';
const LOG = process.argv[3] || `docs/test-logs/ios-iphone12pro-${new Date().toISOString().slice(0, 10)}.log`;
if (!/^https:\/\//.test(APP)) { console.error('usage: node tests/ios/run-iphone.mjs https://<Mac-IP>:8443/ [log-file]'); process.exit(1); }
fs.mkdirSync(path.dirname(LOG), { recursive: true });
const out = fs.createWriteStream(LOG, { flags: 'w' });
const say = s => out.write(s + '\n');
let fails = 0, count = 0, fallbacks = [];
const results = [];
const check = (name, ok, detail = '') => { count++; if (!ok) fails++; results.push({ name, ok }); say(`${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail ? '  — ' + String(detail).slice(0, 600) : ''}`); };
const section = s => say(`\n## ${s}`);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dayStr = n => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const plus = dayStr;
const ALL = { cycleTracking: true, phaseEducation: true, patternInsights: true, symptomForecast: true, quickSuggestions: true, sensorPrompts: true, temperatureResearch: true, lhTests: true, comfortSuggestions: true, midlifeMode: true, companion: true, temperatureEstimate: true, pregnancyMode: true };
const APP_HOST = new URL(APP).host;

// ---------- WebDriver client ----------
let sid = null;
const EL = 'element-6066-11e4-a52e-4f735466cecf';
async function wd(method, url, body) {
  const r = await fetch(`${WD}${url}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || (j.value && j.value.error)) { const e = new Error(`${method} ${url}: ${j.value?.error || r.status} ${j.value?.message || ''}`.trim()); e.code = j.value?.error; throw e; }
  return j.value;
}
const s = u => `/session/${sid}${u}`;
const fnSrc = f => typeof f === 'function' ? `return (${f}).apply(null, arguments);` : f;
const run = (f, ...args) => wd('POST', s('/execute/sync'), { script: fnSrc(f), args });
const runAsync = (f, ...args) => wd('POST', s('/execute/async'), {
  script: `const cb = arguments[arguments.length - 1]; Promise.resolve().then(() => (${f}).apply(null, Array.prototype.slice.call(arguments, 0, -1))).then(v => cb({ ok: v === undefined ? null : v }), e => cb({ err: String(e && e.stack || e) }));`, args,
}).then(v => { if (v && v.err) throw new Error(v.err); return v?.ok; });

// Injected after each page load (see header): error/console collector, dialog stubs, export capture.
const HOOKS = function () {
  if (window.__qk) return;
  const q = window.__qk = { errs: [], logs: [], blobs: [] };
  addEventListener('error', e => q.errs.push(String(e.message || e)));
  addEventListener('unhandledrejection', e => q.errs.push('unhandled rejection: ' + String(e.reason && e.reason.message || e.reason)));
  for (const k of ['log', 'info', 'warn', 'error', 'debug']) { const o = console[k].bind(console); console[k] = (...a) => { try { q.logs.push(a.map(x => typeof x === 'string' ? x : (() => { try { return JSON.stringify(x); } catch { return String(x); } })()).join(' ')); } catch { /* ignore */ } o(...a); }; }
  window.confirm = () => true; window.alert = () => {}; window.prompt = () => null;
  try { performance.setResourceTimingBufferSize(5000); } catch { /* ignore */ }
  const oc = URL.createObjectURL.bind(URL);
  URL.createObjectURL = b => { try { if (b instanceof Blob) b.text().then(t => q.blobs.push(t)); } catch { /* ignore */ } return oc(b); };
};
const harvested = { errs: [], logs: [], hosts: [] };
async function harvest(label) {
  try {
    const h = await run(() => ({
      errs: (window.__qk && window.__qk.errs) || [], logs: (window.__qk && window.__qk.logs) || [],
      urls: performance.getEntriesByType('resource').map(e => e.name).concat(performance.getEntriesByType('navigation').map(e => e.name)),
    }));
    harvested.errs.push(...h.errs.map(e => `${label}: ${e}`)); harvested.logs.push(...h.logs);
    for (const u of h.urls) { if (!/^https?:/.test(u)) continue; const host = new URL(u).host; if (host !== APP_HOST) harvested.hosts.push(host); }
  } catch { /* page gone */ }
}
let pageLabel = 'start';
async function navigate(url, label = url) {
  await harvest(pageLabel); pageLabel = label;
  await wd('POST', s('/url'), { url });
  await waitFor(() => run(() => document.readyState === 'complete'), 30000);
  await run(HOOKS);
}
async function reload(label = 'reload') { await harvest(pageLabel); pageLabel = label; await wd('POST', s('/refresh'), {}); await waitFor(() => run(() => document.readyState === 'complete'), 30000); await run(HOOKS); }
async function waitFor(fn, ms = 8000, every = 150) {
  const end = Date.now() + ms; let last;
  while (Date.now() < end) { try { last = await fn(); if (last) return last; } catch { /* keep trying */ } await sleep(every); }
  return last;
}

// ---------- page helpers (Playwright equivalents) ----------
const exists = sel => run(q => !!document.querySelector(q), sel);
const visible = sel => run(q => { const el = document.querySelector(q); if (!el) return false; const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden]'); }, sel);
const text = sel => run(q => (document.querySelector(q)?.textContent || '').replace(/\s+/g, ' '), sel);
const value = sel => run(q => document.querySelector(q)?.value ?? null, sel);
const count$ = sel => run(q => document.querySelectorAll(q).length, sel);
async function tap(sel, waitMs = 350) {
  const ok = await run(q => { const el = document.querySelector(q); if (!el) return false; el.scrollIntoView({ block: 'center' }); return true; }, sel);
  if (!ok) throw new Error(`no element ${sel}`);
  await sleep(120);
  const { [EL]: id } = await wd('POST', s('/element'), { using: 'css selector', value: sel });
  try { await wd('POST', s(`/element/${id}/click`), {}); }
  catch (e) {
    if (!/intercepted|not interactable|not visible/i.test(e.message)) throw e;
    fallbacks.push(`${sel} (${e.code})`); await run(q => document.querySelector(q).click(), sel);
  }
  await sleep(waitMs);
}
async function checkBox(sel) { if (!(await run(q => document.querySelector(q)?.checked, sel))) await tap(sel, 250); }
async function fill(sel, v) {
  await run((q, val) => { const el = document.querySelector(q); el.scrollIntoView({ block: 'center' }); const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, val); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v);
  await sleep(250);
}
const selectOption = fill;

async function resetSite() {
  // Clear everything this origin stored, so each scenario starts like a fresh Playwright context.
  await navigate(APP, 'reset');
  await runAsync(async () => {
    localStorage.clear(); sessionStorage.clear();
    if (indexedDB.databases) for (const { name } of await indexedDB.databases()) await new Promise(r => { const q = indexedDB.deleteDatabase(name); q.onsuccess = q.onerror = q.onblocked = () => r(); });
    else await new Promise(r => { const q = indexedDB.deleteDatabase('shred_cycle_keys'); q.onsuccess = q.onerror = q.onblocked = () => r(); });
    if (navigator.serviceWorker) for (const reg of await navigator.serviceWorker.getRegistrations()) await reg.unregister();
    if (self.caches) for (const k of await caches.keys()) await caches.delete(k);
  });
}
async function openCycle({ flags, consent = true } = {}) {
  await resetSite();
  if (flags) await run(f => localStorage.setItem('shred_flags_v1', JSON.stringify(f)), flags);
  await navigate(APP, 'app');
  await waitFor(() => exists('#welcomeBtn'), 15000);
  await goCycle(true);
  if (consent) { await checkBox('#cyAgree'); await tap('[data-act=consent]', 500); await waitFor(() => exists('#cyLog'), 5000); }
}
async function goCycle(welcome = false) {
  if (welcome || await visible('#welcomeBtn')) await tap('#welcomeBtn', 300);
  await tap('.tabs [data-tab=body]', 300); await tap('[data-go=cycle]', 600);
}
async function reopenCycle(label) { await navigate(APP, label); await waitFor(() => exists('#welcomeBtn'), 15000); await goCycle(); await sleep(300); }

// ---------- mobile-layout measurement (copied from tests/mobile-layout.cjs; runs in the page) ----------
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
  for (const el of document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button]')) {
    if (!visible(el) || el.disabled) continue;
    const t = (el.type === 'checkbox' || el.type === 'radio') && el.closest('label') ? el.closest('label') : el;
    if (el.tagName === 'A' && getComputedStyle(el).display === 'inline' && el.parentElement && /^(P|LI|SPAN|SMALL|TD)$/.test(el.parentElement.tagName)) continue;
    const r = t.getBoundingClientRect();
    if (r.width < 24 - 0.5 || r.height < 24 - 0.5) out.small.push(`${name(el)} ${Math.round(r.width)}×${Math.round(r.height)}`);
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && !['checkbox', 'radio', 'range', 'button', 'submit', 'file', 'color'].includes(el.type) && parseFloat(getComputedStyle(el).fontSize) < 16) out.smallText.push(`${name(el)} ${getComputedStyle(el).fontSize}`);
  }
  const vp = document.querySelector('meta[name=viewport]')?.content || '';
  out.zoomDisabled = /user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/.test(vp);
  out.wide = [...new Set(out.wide)]; out.small = [...new Set(out.small)]; out.smallText = [...new Set(out.smallText)];
  return out;
}
async function layout(label) {
  await sleep(400);
  const m = await run(measure);
  check(`iPhone · ${label}: nothing wider than the screen`, m.overflowPx <= 1 && m.wide.length === 0, `${m.overflowPx}px sideways; ${m.wide.slice(0, 4).join('; ')}`);
  check(`iPhone · ${label}: every control at least 24×24 px`, m.small.length === 0, `${m.small.length}: ${m.small.slice(0, 6).join('; ')}`);
  check(`iPhone · ${label}: input text at least 16 px (no iOS zoom on focus)`, m.smallText.length === 0, m.smallText.slice(0, 6).join('; '));
  return m;
}

// ---------- scenarios ----------
async function cycleE2E() {
  section('Cycle section of tests/e2e.cjs');
  await resetSite(); await navigate(APP, 'e2e');
  await waitFor(() => exists('#welcomeName'), 15000);
  await fill('#welcomeName', 'Sara'); await tap('#welcomeBtn', 400);
  await tap('.tabs [data-tab=body]');
  check('cycle: hidden by default (flag off)', !(await visible('#cycleTile')));
  await tap('.tabs [data-tab=progress]'); await tap('#diagCard summary'); await tap('#flagCycle'); await tap('#diagCard summary');
  await tap('.tabs [data-tab=body]'); check('cycle: tile shown once the prototype flag is on', await visible('#cycleTile'));
  await tap('[data-go=cycle]', 600); await waitFor(() => exists('#cyConsent'));
  const ct = await text('#cyConsent');
  check('cycle: consent screen first, says no sharing and not contraception', /not contraception/.test(ct) && /Nothing is shared/.test(ct));
  await tap('[data-act=consent]');
  check('cycle: consent needs the box ticked', await visible('#cyConsent'));
  await checkBox('#cyAgree'); await tap('[data-act=consent]', 600); await waitFor(() => exists('#cyEstimate'));
  check('cycle: no history → "not enough data", no range', /Not enough data/.test(await text('#cyHeadline')) && !(await exists('.cy-range')));
  for (const n of [-161, -132, -101, -71, -41, -10]) { await fill('#cyDate', dayStr(n)); await tap('[data-act=logStart]'); }
  const detail = await text('#cyDetail');
  check('cycle: 5 cycles → dates from past cycles, explained, never called a prediction interval', /From your past cycles/.test(await text('#cyHeadline')) && /between 29 and 31 days/.test(detail) && await visible('.cy-range') && !/Estimated range/.test(await text('#cyEstimate')), detail);
  check('cycle: "may come earlier or later" is visible without opening any section', await visible('#cyOutside') && /earlier or later/.test(await text('#cyOutside')));
  await fill('#cyDate', dayStr(-3)); await tap('[data-act=logSpotting]');
  check('cycle: spotting logged without changing the estimate', (await text('#cyDetail')) === detail);
  await tap('#cyHistory summary');
  await fill('#cyHistory [data-pid] [data-edit=start]', dayStr(-16)); await sleep(400);
  check('cycle: correcting the latest start updates the estimate', /between 25 and 31 days/.test(await text('#cyDetail')), await text('#cyDetail'));
  await tap('#cySettings summary'); await tap('#cySettings [data-cat=energy]', 500);
  await selectOption('#cyLog [data-sym=energy]', 'low'); await tap('[data-act=saveDay]');
  check('cycle: optional symptom (energy) logged after switching it on', /\(current\)[\s\S]*energy low/.test(await text('#cyHistory')));
  check('cycle: symptom-pattern findings hidden by default (research flag off)', !(await exists('#cyPatterns')) && !(await exists('#cyInsight')));
  await tap('#cySettings [data-flag=patternInsights]', 500);
  check('cycle: research flag on → pattern card shown, labelled unvalidated', /Energy: not enough data/.test(await text('#cyPatterns')) && /unvalidated/.test(await text('#cyPatterns')));
  await tap('[data-act=remindersOn]', 500); await tap('[data-act=addRem]', 500);
  check('cycle: reminder added with its next time and reason', (await count$('#cyReminders [data-rid]')) === 1 && /You asked for a daily reminder/.test(await text('#cyReminders')));
  await tap('#cyReminders [data-act=pauseRem]', 500);
  check('cycle: reminder paused', /Resume/.test(await text('#cyReminders [data-rid]')));
  await tap('#cyReminders [data-act=delRem]', 500);
  check('cycle: reminder deleted', (await count$('#cyReminders [data-rid]')) === 0);
  await tap('[data-act=wearableOn]', 1500);
  const wtxt = await text('#cyWearable');
  check('cycle: demo wearable labelled synthetic, skin temp not core temp, DS07 unavailable', /synthetic demo/.test(wtxt) && /°C/.test(wtxt) && /Not core body temperature/.test(wtxt) && /SWL DS07 \(not available\)/.test(wtxt), wtxt.slice(0, 200));
  await tap('#cySettings [data-flag=phaseEducation]', 500);
  check('cycle: phase education (opt-in) has a "not enough data" state, no day-14 assumption', /Not enough data|Menstruation/.test(await text('#cyPhase')) && !/day 14/i.test(await text('#cyPhase')));
  const rawRecord = () => runAsync(async () => { const m = await import('/js/cycle/store.js'); return m.indexedDbStorage().snapshot(localStorage.getItem('shred_cycle_uid')); });
  const ls = await run(() => Object.fromEntries(Object.entries(localStorage)));
  const rec = await rawRecord();
  check('cycle: stored encrypted in IndexedDB (no dates or words in the stored value)', !!rec?.text && /AES-GCM/.test(rec.text) && !/20\d\d-|spotting|energy/.test(rec.text));
  check('cycle: no cycle record left in localStorage', !Object.keys(ls).some(k => k.startsWith('shred_cycle_v1:')));
  check('cycle: nothing cycle-related in the main store or error log', !/spotting|period|energy|cycle/i.test((ls.shred_qk_v1 || '') + (ls.shred_errors_v1 || '')));

  // Data survives a full reload (extra check for the real phone): reload the page and read the history back.
  const before = await run(() => [...document.querySelectorAll('#cyHistory [data-edit=start]')].map(e => e.value).sort()), detailBefore = await text('#cyDetail');
  await reload('e2e after reload');
  await waitFor(() => exists('#welcomeBtn') || exists('.tabs'), 15000); await goCycle(); await waitFor(() => exists('#cyHistory'));
  if (!(await exists('#cyHistory[open]'))) await tap('#cyHistory summary');
  const after = await run(() => [...document.querySelectorAll('#cyHistory [data-edit=start]')].map(e => e.value).sort());
  check('reload: every logged period start is still there after a full page reload', before.length === 6 && JSON.stringify(before) === JSON.stringify(after), `before ${before.length}, after ${after.length}`);
  check('reload: the logged energy symptom is still there', /energy low/.test(await text('#cyHistory')));
  check('reload: the estimate is unchanged', (await text('#cyDetail')) === detailBefore, await text('#cyDetail'));
  // A brand-new page load from the address (not a reload) too.
  await reopenCycle('e2e fresh load');
  check('reload: still there after opening the address again (new page load)', /From your past cycles/.test(await text('#cyHeadline')));

  if (!(await exists('#cySettings[open]'))) await tap('#cySettings summary');
  await run(() => { window.__qk.blobs = []; });
  await tap('[data-act=export]', 1200);
  const blob = await waitFor(() => run(() => window.__qk.blobs.find(b => b.includes('shred-cycle-export')) || null), 5000);
  let exp = null; try { exp = JSON.parse(blob); } catch { /* not JSON */ }
  check('cycle: export contains the user\'s data (file content handed to Safari)', exp?.format === 'shred-cycle-export' && exp.data.periods.length === 6, blob ? blob.slice(0, 80) : 'no export file seen');
  await tap('[data-act=deleteAll]', 900);
  const gone = await rawRecord();
  check('cycle: delete all → data gone and consent asked again', await visible('#cyConsent') && gone?.text === null);
  await reopenCycle('e2e after delete');
  check('cycle: after delete + reload, nothing comes back', await visible('#cyConsent') && !(await exists('#cyUnavailable')));

  // Recovery path: unreadable data → reset button → consent screen.
  await checkBox('#cyAgree'); await tap('[data-act=consent]', 600);
  await runAsync(async () => {
    const uid = localStorage.getItem('shred_cycle_uid'), m = await import('/js/cycle/store.js'), snap = await m.indexedDbStorage().snapshot(uid);
    await new Promise((res, rej) => { const r = indexedDB.open('shred_cycle_keys', 2); r.onsuccess = () => { const db = r.result, t = db.transaction('records', 'readwrite');
      t.objectStore('records').put(JSON.stringify({ v: 2, gen: snap.gen, rev: 1, alg: 'AES-GCM-256', iv: 'AAAAAAAAAAAAAAAA', ct: 'AAAAAAAAAAAAAAAAAAAAAA==' }), uid); t.oncomplete = () => { db.close(); res(); }; t.onerror = rej; }; r.onerror = rej; });
  });
  await reopenCycle('e2e unreadable');
  const stuck = await visible('#cyUnavailable') && await visible('[data-act=resetStorage]');
  if (stuck) await tap('[data-act=resetStorage]', 900);
  check('unreadable data: a reset button is offered and returns to the consent screen', stuck && await visible('#cyConsent'));
  say('note not ported from e2e.cjs: two-tab tests (one Safari tab per WebDriver session on iPhone) and the mood-purge export test.');
}

async function pregnancy() {
  section('tests/cycle-ui-pregnancy.cjs');
  const openSit = async () => { if (!(await visible('#cyPregDue'))) await tap('#cySituation summary', 250); };
  const startPregnancy = async due => { await openSit(); await fill('#cyPregDue', due); await tap('[data-act=pregStart]', 800); };
  await openCycle({ flags: { cycleTracking: true } });
  await tap('#cySituation summary', 250);
  check('flag off: no pregnancy mode form', !(await exists('#cyPregDue')));
  await openCycle({ flags: { cycleTracking: true, pregnancyMode: true, companion: true } });
  await startPregnancy(plus(140));
  const card = await text('#cyPregnancy');
  check('pregnancy card: weeks today from her due date', /20 weeks/.test(card), card.slice(0, 200));
  check('…trimester and due date shown, described as an estimate', /trimester/i.test(card) && /estimate/i.test(card));
  check('…urgent warning signs are one tap away', /warning signs/i.test(card) && /bleeding/i.test(await text('#cyPregWarn')));
  check('…sources shown', /ACOG/.test(card));
  check('the dates-only estimate is paused', /paused/i.test(await text('#cyEstimate')));
  check('Zara checks in on the day a new week starts', /20 weeks/.test(await text('#cyCompanion')));
  await tap('#cySettings summary', 250);
  check('pregnancy symptoms can be switched on in settings', await exists('[data-cat=nausea]'));
  // Real-phone extra: the pregnancy card survives a full reload.
  await reload('pregnancy reload'); await goCycle(); await waitFor(() => exists('#cyPregnancy'));
  check('reload: pregnancy card and due date still there after a full reload', /20 weeks/.test(await text('#cyPregnancy')));
  await fill('#cyBirthDate', plus(0)); await tap('[data-act=pregBirth]', 800);
  check('"My baby was born": the pregnancy card is replaced by the postpartum card', !(await exists('#cyPregnancy')) && await exists('#cyPostpartum'));
  const pp = await text('#cyPostpartum');
  check('postpartum card: bleeding after birth is not a period; mood; check-ups; warning signs', /not a period/i.test(pp) && /2 weeks/.test(pp) && /12 weeks/.test(pp) && /warning signs/i.test(pp), pp.slice(0, 240));
  await tap('#cyPpWarn summary', 250);
  check('iPhone: postpartum card fits the screen', (await run(() => Math.max(0, document.scrollingElement.scrollWidth - window.innerWidth))) === 0);

  await openCycle({ flags: { cycleTracking: true, pregnancyMode: true } });
  await startPregnancy(plus(200));
  await fill('#cyEndDate', plus(0)); await tap('[data-act=pregEnded]', 800);
  check('"My pregnancy ended": mode ends without asking why, and no postpartum card', !(await exists('#cyPregnancy')) && !(await exists('#cyPostpartum')));
  check('a gentle message is shown', /sorry/i.test(await text('#cyPregEnded')));

  await openCycle({ flags: { cycleTracking: true, pregnancyMode: true } });
  await openSit(); await fill('#cyPregDue', plus(400)); await tap('[data-act=pregStart]', 700);
  check('an impossible due date is refused and nothing starts', !(await exists('#cyPregnancy')));

  await openCycle({ flags: { cycleTracking: true, pregnancyMode: true, companion: true } });
  await startPregnancy(plus(140)); await tap('#cyPregWarn summary', 250);
  check('iPhone: pregnancy card (warning signs open) fits the screen', (await run(() => Math.max(0, document.scrollingElement.scrollWidth - window.innerWidth))) === 0);
}

async function companion() {
  section('tests/cycle-ui-companion.cjs');
  const setup = async flags => { await openCycle({ flags }); await tap('#cySettings summary', 250); await checkBox('[data-cat=pain]'); await sleep(400); await tap('[data-act=logStart]', 700); };
  await setup({ cycleTracking: true });
  check('flag off: no companion card', !(await exists('#cyCompanion')));
  await setup({ cycleTracking: true, companion: true, comfortSuggestions: true });
  const card = await text('#cyCompanion');
  check('day 1 of a period: Zara asks how she is feeling (renamed from QK)', /how are you feeling/i.test(card) && /Zara/.test(card) && !/QK/.test(card), card.slice(0, 160));
  check('the card says her answers stay on her phone', /stay on this phone/i.test(card));
  check('the companion card is the first card on the screen (above the estimate)', await run(() => { const a = document.querySelector('#cyCompanion'), e = document.querySelector('#cyEstimate'); return !!a && !!e && !!(a.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING); }));
  check('it says why it is asking', /why/i.test(card));
  await tap('#cyCompanion [data-act=companionAnswer][data-ans=cramps]', 350);
  check('"Cramps" asks how strong, in one tap', (await count$('#cyCompanion [data-act=companionSeverity]')) === 3);
  await tap('#cyCompanion [data-act=companionSeverity][data-sev=moderate]', 800);
  check('after answering, the check-in closes for today', !(await exists('#cyCompanion')));
  check('her answer is saved in today\'s log', (await value('[data-sym=pain]')) === 'moderate');
  check('and what helped her before is offered (comfort card)', await exists('#cyComfort'));
  await reopenCycle('companion reload');
  check('reload: the saved answer (pain moderate) is still there after reopening', (await value('[data-sym=pain]')) === 'moderate');

  await setup({ cycleTracking: true, companion: true });
  if (!(await visible('#cyCompanionName'))) await tap('#cySettings summary', 250);
  await fill('#cyCompanionName', 'Amna'); await tap('[data-act=companionName]', 700);
  check('she can rename her companion in settings', /Amna/.test(await text('#cyCompanion')), await text('#cyCompanion'));

  await setup({ cycleTracking: true, companion: true });
  await tap('#cyCompanion [data-act=companionDismiss]', 700);
  check('"Not now" hides it', !(await exists('#cyCompanion')));
  await reopenCycle('companion dismissed');
  check('…and it stays hidden for the rest of today', !(await exists('#cyCompanion')));
}

async function adjust() {
  section('tests/cycle-ui-adjust.cjs');
  await openCycle({ flags: { cycleTracking: true } }); await tap('[data-act=logStart]', 700);
  check('flag off: no band-adjusted card', !(await exists('#cyAdjusted')));
  await openCycle({ flags: { cycleTracking: true, temperatureEstimate: true } }); await tap('[data-act=logStart]', 700);
  const card = await text('#cyAdjusted');
  check('flag on: the card is labelled research', /research/i.test(card), card.slice(0, 160));
  check('with no band data it says why it cannot adjust (band not connected)', /band is not connected/i.test(card), card);
  check('it states the evidence: synthetic only, not validated', /synthetic/i.test(card) && /not been validated/i.test(card));
  check('the dates-only estimate is still shown', await exists('#cyEstimate'));
  check('it never mentions ovulation or fertility', !/ovulat|fertil/i.test(card));
  check('when neither model can estimate, the card says "Not enough data yet."', /Not enough data yet\./.test(card), card);
}

async function privacy() {
  section('tests/privacy-check.cjs (every feature on)');
  const MARK = 'Zephyrine';
  harvested.hosts.length = 0; const logsFrom = harvested.logs.length;
  await openCycle({ flags: ALL });
  await tap('#cySettings summary', 250); await checkBox('[data-cat=pain]'); await sleep(400);
  await fill('#cyCompanionName', MARK); await tap('[data-act=companionName]', 600);
  await tap('[data-act=logStart]', 700);
  await selectOption('[data-sym=pain]', 'severe');
  if (await exists('[data-act=saveDay]')) await tap('[data-act=saveDay]', 700);
  if (!(await visible('#cyPregDue'))) await tap('#cySituation summary', 250);
  const due = plus(150); await fill('#cyPregDue', due); await tap('[data-act=pregStart]', 800);
  check('flows ran: pregnancy card shown', await exists('#cyPregnancy'));
  const stored = await runAsync(async () => {
    const out = [JSON.stringify({ ...localStorage })];
    const dbs = indexedDB.databases ? await indexedDB.databases() : [{ name: 'shred_cycle_keys' }];
    for (const { name } of dbs) {
      const db = await new Promise((res, rej) => { const r = indexedDB.open(name); r.onsuccess = () => res(r.result); r.onerror = rej; });
      for (const st of db.objectStoreNames) {
        const all = await new Promise(res => { const q = db.transaction(st).objectStore(st).getAll(); q.onsuccess = () => res(q.result); q.onerror = () => res([]); });
        out.push(JSON.stringify(all, (k, v) => (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) ? `[bytes:${v.byteLength}]` : (typeof CryptoKey !== 'undefined' && v instanceof CryptoKey) ? '[CryptoKey]' : v));
      }
      db.close();
    }
    return out.join('\n');
  });
  const secrets = [MARK, 'severe', due];
  await reload('privacy reload'); await goCycle(); await sleep(500);
  if (!(await visible('#cyCompanionName'))) await tap('#cySettings summary', 250);
  check('the data was saved (read back after a full reload: pain, companion name, due date)', (await value('[data-sym=pain]')) === 'severe' && (await value('#cyCompanionName')) === MARK && await exists('#cyPregnancy'));
  check('3. nothing she logged is readable in browser storage (encrypted at rest)', secrets.every(x => !stored.includes(x)) && stored.length > 0, `found: ${secrets.filter(x => stored.includes(x)).join(', ')}`);
  await harvest(pageLabel); pageLabel = 'privacy (after harvest)';
  const hosts = [...new Set(harvested.hosts)], fonts = hosts.filter(h => /fonts\.(googleapis|gstatic)\.com$/.test(h)), other = hosts.filter(h => !fonts.includes(h));
  check('1. no requests to any other server (performance resource entries)', other.length === 0, other.join(','));
  if (fonts.length) say(`note Google Fonts requested (${fonts.join(', ')}): no health data, but it reveals the visit to Google. Self-hosting the fonts is an open decision.`);
  const leaked = harvested.logs.slice(logsFrom).filter(l => secrets.some(x => l.includes(x)));
  check('2. nothing she logged appears in the console (output after page load)', leaked.length === 0, leaked.slice(0, 3).join(' | '));
}

async function mobileLayout() {
  section('tests/mobile-layout.cjs on the real iPhone screen');
  await resetSite(); await run(f => localStorage.setItem('shred_flags_v1', JSON.stringify(f)), ALL);
  await navigate(APP, 'layout'); await waitFor(() => exists('#welcomeBtn'), 15000);
  const first = await layout('welcome');
  check('iPhone: pinch-zoom is not disabled', first.zoomDisabled === false);
  await tap('#welcomeBtn');
  for (const tab of ['today', 'train', 'progress', 'body']) { await tap(`.tabs [data-tab=${tab}]`); await layout(`${tab} tab`); }
  await tap('.tabs [data-tab=body]'); await tap('[data-go=cycle]', 600); await layout('cycle consent');
  await checkBox('#cyAgree'); await tap('[data-act=consent]', 500);
  await runAsync(async today => {
    const S = await import('/js/cycle/store.js'), M = await import('/js/cycle/model.js'), D = await import('/js/cycle/dates.js');
    const repo = await S.openCycleRepo({ storage: S.indexedDbStorage(), keys: S.indexedDbKeys(), userId: localStorage.getItem('shred_cycle_uid') });
    await repo.update(s => {
      for (const k of ['energy', 'mood', 'sleep', 'pain', 'training']) try { M.setCategory(s, k, true); } catch { /* category may not exist */ }
      const last = D.addDays(today, -12), starts = Array.from({ length: 5 }, (_, i) => D.addDays(last, -29 * (4 - i)));
      for (const st of starts) M.logPeriodStart(s, st, { today });
      starts.slice(0, 4).forEach(st => { for (let k = 1; k <= 29; k++) M.logDay(s, D.addDays(st, k - 1), { energy: k > 22 ? 'low' : 'usual' }, { today }); });
      M.logDay(s, today, { pain: 'moderate' }, { today });
      M.setSituation(s, 'perimenopause', true); for (const k of ['hotFlushes', 'focus']) M.setCategory(s, k, true);
    });
  }, dayStr(0));
  await tap('.tabs [data-tab=today]'); await tap('.tabs [data-tab=body]'); await tap('[data-go=cycle]', 700);
  await layout('cycle screen with synthetic history');
  const sumSel = await run(() => { const b = [...document.querySelectorAll('[data-act=summary]')].find(e => e.getBoundingClientRect().width > 0); if (!b) return null; b.setAttribute('data-qk-sum', '1'); return '[data-qk-sum="1"]'; });
  if (sumSel) { await tap(sumSel, 600); await layout('cycle summary'); } else say('note the summary button was not shown in this state (same as the Playwright test, which skips it)');
}

// ---------- main ----------
(async () => {
  let sessionCaps = null;
  try {
    const sess = await wd('POST', '/session', { capabilities: { alwaysMatch: { platformName: 'iOS', browserName: 'Safari' } } });
    sid = sess.sessionId; sessionCaps = sess.capabilities;
  } catch (e) { console.error(`Could not start Safari on the iPhone: ${e.message}`); say(`could not start a session: ${e.message}`); out.end(); process.exit(2); }
  try { await wd('POST', s('/timeouts'), { script: 60000, pageLoad: 60000, implicit: 0 }); } catch { /* optional */ }
  say(`# Shred by QK — real iPhone Safari run, ${new Date().toString()}`);
  say(`app: ${APP}  (served from this Mac over HTTPS on the local network; synthetic data only)`);
  say(`safaridriver session capabilities: ${JSON.stringify(sessionCaps)}`);
  const started = Date.now();
  try {
    await wd('POST', s('/url'), { url: APP });
    await waitFor(() => run(() => document.readyState === 'complete'), 30000); await run(HOOKS);
    const env = await run(() => ({ ua: navigator.userAgent, secure: window.isSecureContext, crypto: !!(window.crypto && crypto.subtle), w: innerWidth, h: innerHeight, dpr: devicePixelRatio, standalone: !!navigator.standalone, title: document.title, sw: !!navigator.serviceWorker, idb: !!window.indexedDB, notif: typeof Notification }));
    say(`device: ${JSON.stringify(env)}`);
    section('Secure context');
    check('the app loaded over HTTPS with the local certificate trusted (secure context)', env.secure === true && /Shred/i.test(env.title + (await text('body')).slice(0, 2000)), JSON.stringify(env));
    check('Web Crypto (crypto.subtle) is available', env.crypto === true);
    if (!env.secure) throw new Error('not a secure context: the certificate is not trusted on the iPhone');
    for (const [name, fn] of [['cycle e2e', cycleE2E], ['pregnancy', pregnancy], ['companion', companion], ['adjust', adjust], ['privacy', privacy], ['mobile layout', mobileLayout]]) {
      try { await fn(); } catch (e) { check(`${name}: run completed`, false, e.message); try { await wd('POST', s('/alert/accept'), {}); } catch { /* no dialog */ } }
    }
  } catch (e) { check('run completed', false, e.message); }
  await harvest(pageLabel);
  section('Whole run');
  check('no JavaScript errors (collected after each page load)', harvested.errs.length === 0, [...new Set(harvested.errs)].slice(0, 8).join(' | '));
  if (fallbacks.length) say(`note ${fallbacks.length} tap(s) used a script click because Safari reported the target covered: ${[...new Set(fallbacks)].join(', ')}`);
  else say('note every tap was a real WebDriver tap (no script-click fallbacks)');
  try { await resetSite(); } catch { /* leave nothing behind if possible */ }
  try { await wd('DELETE', s('')); } catch { /* ignore */ }
  const mins = ((Date.now() - started) / 60000).toFixed(1);
  say(`\n${fails ? `${fails} FAILED of ${count}` : `ALL PASS (${count})`} in ${mins} min`);
  out.end();
  console.log(`${count - fails} of ${count} checks passed on the iPhone (${mins} min). Log: ${LOG}`);
  if (fails) console.log('Failed: ' + results.filter(r => !r.ok).map(r => r.name).join(' | '));
  process.exit(fails ? 1 : 0);
})();
