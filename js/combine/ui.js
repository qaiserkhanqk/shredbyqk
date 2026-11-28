// Athlete Combine screen: sport and position (from athletes.js) → tests → profile and #1 limiter →
// one-phone movement checks → the athlete programme, with the limiter and fixes at the top of each day.
// Camera capture stays in app.js (startLive / finishTest); this module renders and stores results.
import * as athletes from '../athletes.js';
import { QUALITIES, TESTS, testsFor, profile, valueOf, bandName, programFocus } from './combine.js';
import { analyseHops, analyseFlyingSprint, analyseShuttle, analyseNordic, peakPowerSayers } from './tests.js';
import { SCREENS, ANALYSE, screensFor, topFixes } from './screens.js';
import { analyseJumps } from '../jump.js';

let H; // host from app.js: { $, esc, S, persist, say, toast, startTest(mode, source, file, opts), openProgram(id), lib }
const TEST_MODES = ['cmj', 'hops', 'slHop', 'fly10', 's505', 'nordic'];
export const COMBINE_MODES = [...TEST_MODES.map(m => 'c_' + m), ...Object.keys(SCREENS).map(id => 'c_chk_' + id)];
export const isCombineMode = m => COMBINE_MODES.includes(m);
export const combineModeName = (m, opts = {}) => m.startsWith('c_chk_') ? SCREENS[m.slice(6)].name : TESTS[m.slice(2)].name + (m === 'c_slHop' ? (opts.side === 'R' ? ' · right' : ' · left') : '');
export const combineMinFps = m => m.startsWith('c_chk_') ? SCREENS[m.slice(6)].minFps : m === 'c_nordic' ? 25 : 50;
// Sprints, deliveries and punches cross the frame, so a partly visible body is expected there.
export const combineMoving = m => ['c_fly10', 'c_s505', 'c_chk_bowlSide', 'c_chk_sprint', 'c_chk_punch', 'c_chk_lunge'].includes(m);
/** Cone taps a test needs on the video before timing starts. */
export const gatesFor = m => m === 'c_fly10' ? ['Tap the FIRST cone', 'Now tap the SECOND cone (10 m further)'] : m === 'c_s505' ? ['Tap the 5-metre cone line'] : [];

const C = () => H.S.combine;
const e = s => H.esc(s ?? '');

export function initCombine(host) {
  H = host;
  H.S.combine ||= { sport: H.S.athlete?.sport || null, role: H.S.athlete?.role || null, sex: H.S.profile?.sex === 'female' ? 'f' : 'm', age: '', massKg: '', ready: false, results: {}, history: {}, checks: {} };
  H.S.combine.checks ||= {};
  const root = H.$('#combineRoot');
  root.addEventListener('click', onClick);
  root.addEventListener('change', ev => {
    const i = ev.target.closest('[data-cup]'); if (!i) return;
    const f = i.files[0]; i.value = ''; if (f) H.startTest(i.dataset.cup, 'file', f, { side: i.dataset.side });
  });
}

/** Programme focus for app.js (athletes.buildProgram), from the current combine and movement checks. */
export function currentFocus() {
  const c = H?.S.combine; if (!c?.ready) return null;
  return programFocus(c, topFixes(labFor(c)));
}
const labFor = c => Object.fromEntries(screensFor(c.sport, c.role).filter(id => c.checks?.[id]).map(id => [id, c.checks[id]]));

export function renderCombine(msg = '') {
  const c = C();
  H.$('#combineRoot').innerHTML = (msg ? `<div class="card"><p style="margin:0">${e(msg)}</p></div>` : '') + (!c.ready || c.editing ? setupHTML(c) : dashHTML(c));
}

/* ---------- setup ---------- */
function setupHTML(c) {
  const sp = athletes.sportById(c.sport);
  const opt = (k, v, label, on) => `<button type="button" class="mchip ${on ? 'on' : ''}" data-cset="${k}" data-v="${e(v)}" aria-pressed="${on}">${e(label)}</button>`;
  return `<div class="card stack"><p style="margin:0">Ten minutes of tests on your phone camera. You get a profile against your position, your <b>#1 limiter</b>, and your athlete programme rebuilt around it. Retest every 4–6 weeks.</p></div>
    <span class="eyebrow">Your sport</span>
    <div class="chips-scroll" role="group" aria-label="Sport">${athletes.SPORTS.map(s => opt('sport', s.id, `${s.icon} ${s.name}`, c.sport === s.id)).join('')}</div>
    ${sp ? `<span class="eyebrow">Your position or style</span>
      <div class="role-list">${sp.roles.map(r => `<button type="button" class="${c.role === r.id ? 'on' : ''}" data-cset="role" data-v="${r.id}" aria-pressed="${c.role === r.id}"><b>${e(r.name)}</b><span>${e(r.desc)}</span></button>`).join('')}</div>` : ''}
    ${c.role ? `<div class="card stack">
      <div class="field"><span>Sex (sets the guide bands)</span><div class="mode-switch" role="group" aria-label="Sex">${[['m', 'Male'], ['f', 'Female']].map(([v, t]) => `<button type="button" data-cset="sex" data-v="${v}" class="${c.sex === v ? 'on' : ''}" aria-pressed="${c.sex === v}">${t}</button>`).join('')}</div></div>
      <label class="field">Age<input id="cAge" type="number" inputmode="numeric" min="8" max="80" value="${e(c.age)}" placeholder="e.g. 22"></label>
      <label class="field">Body weight (kg, for power in watts)<input id="cMass" type="number" inputmode="decimal" value="${e(c.massKg)}" placeholder="e.g. 75"></label>
      <button class="cta" type="button" data-cact="save">Start my combine</button></div>` : ''}`;
}

/* ---------- dashboard ---------- */
function dashHTML(c) {
  const p = profile(c), sp = athletes.sportById(c.sport), r = athletes.roleOf(c.sport, c.role);
  const focus = currentFocus(), phase = H.S.athlete?.sport === c.sport && H.S.athlete?.role === c.role ? H.S.athlete.phase : 'pre';
  return `<div class="card stack">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><div><span class="eyebrow">${sp.icon} ${e(sp.name)}</span><h2 class="display h2" style="margin:4px 0 0">${e(r.name)}</h2></div>
      <button class="ghost" type="button" data-cact="edit">Edit</button></div>
      <div class="bar" aria-label="Combine progress"><i style="width:${Math.round(p.done / p.total * 100)}%"></i></div>
      <span class="muted small">${p.done} of ${p.total} tests done${p.done < p.total ? '. Your profile gets more complete with every test.' : '. Retest in 4–6 weeks.'}</span></div>
    ${limiterHTML(p, r)}
    ${p.done ? profileHTML(p) : ''}
    <label class="field">Uploading a slow-motion video? <select id="combSlow" aria-label="Upload speed">
      <option value="1">It plays at normal speed</option><option value="4">It plays slowed down (120 fps slow-mo)</option><option value="8">It plays slowed down (240 fps slow-mo)</option></select></label>
    <span class="eyebrow">The tests</span>
    <div class="stack">${p.tests.map(id => testCard(id, c)).join('')}</div>
    ${checksHTML(c)}
    <div class="card stack"><b>Your programme</b>
      <p class="muted small" style="margin:0">${focus ? `Your ${e(sp.name)} programme now opens every session with ${[focus.limiter && `work for your #1 limiter (${e(focus.limiter.name.toLowerCase())})`, focus.fixes.length && `movement work for ${e(focus.fixes.map(f => f.title.toLowerCase()).join(' and '))}`].filter(Boolean).join(', then ')}.` : 'Do a few tests and your programme will be rebuilt around what you need most.'}</p>
      <button class="cta" type="button" data-cprog="ath-${c.sport}-${c.role}-${phase}">Open my programme</button>
      <button class="ghost" type="button" data-cact="share">Share my profile with QK</button></div>
    <p class="muted small" style="margin:0">Guide bands are provisional ranges from published team-sport testing, not a validated norm, and are under review by QK. Camera readings are not yet checked against lab equipment. This is a performance screen. It doesn't diagnose injuries or medical conditions.</p>`;
}

function limiterHTML(p, r) {
  if (p.youth) return `<div class="card stack"><b>Under 16: your own progress counts</b><p class="muted small" style="margin:0">Results aren't scored against adult bands. Every retest is compared with your last one, and your programme stays technique-first.</p></div>`;
  if (!p.limiter) return p.done ? '' : `<div class="card stack"><b>Do your first test</b><p class="muted small" style="margin:0">Start with the jump: it takes 30 seconds.</p></div>`;
  const q = QUALITIES[p.limiter.quality];
  return `<div class="one-thing"><span class="eyebrow" style="color:var(--warn)">Your #1 limiter</span><p><b>${e(q.name)}</b>: ${e(bandName(p.limiter.score).toLowerCase())} for a ${e(r.name.toLowerCase())}.</p>
    <p class="why">${e(q.why)} Its work now opens every session of your programme.${p.next.length ? ` Next: ${p.next.map(n => e(QUALITIES[n.quality].short)).join(', ')}.` : ''}</p></div>`;
}

function profileHTML(p) {
  const rows = p.qualities.filter(q => q.value != null).sort((a, b) => b.weight - a.weight);
  return `<div class="card stack"><span class="eyebrow">Your profile · weighted for your position</span>
    ${rows.map(q => `<div><div style="display:flex;justify-content:space-between;gap:8px"><span>${e(QUALITIES[q.quality].short)}${q.weight >= 3 ? ' <span class="pill cam">key</span>' : ''}</span><span class="small">${fmt(q.test, q.value)} · ${q.score == null ? 'tracked' : bandName(q.score)}</span></div>
      ${q.score == null ? '' : `<div class="bar" style="margin-top:6px"><i style="width:${q.score}%"></i></div>`}</div>`).join('')}
    ${p.strengths.length ? `<span class="muted small">Strengths: ${p.strengths.map(q => e(QUALITIES[q.quality].short)).join(', ')}.</span>` : ''}</div>`;
}

function fmt(id, v) {
  if (v == null) return '–';
  const t = TESTS[id], n = Number.isInteger(v) ? v : v.toFixed(id === 'hops' ? 2 : 1);
  return t.unit === 'RSI' ? `${n} RSI` : `${n} ${t.unit}`;
}

function testCard(id, c) {
  const t = TESTS[id], res = c.results[id], v = valueOf(id, res), hist = c.history[id] || [];
  const prev = hist.length > 1 ? hist[hist.length - 2].v : null, delta = typeof v === 'number' && typeof prev === 'number' ? v - prev : null;
  const better = delta != null && (t.higher ? delta > 0 : delta < 0);
  const extra = id === 'cmj' && v && c.massKg ? `About ${peakPowerSayers(v, +c.massKg)} W estimated peak power (formula, not measured).` : id === 'slHop' && res ? `Left ${res.L ?? '–'} cm, right ${res.R ?? '–'} cm.` : '';
  const up = (side = '') => `<label class="ghost">Upload${side ? ' ' + (side === 'L' ? 'left' : 'right') : ' a video'}<input type="file" accept="video/*" data-cup="c_${id}" ${side ? `data-side="${side}"` : ''} hidden></label>`;
  const rec = (side = '') => `<button class="ghost" type="button" data-crec="c_${id}" ${side ? `data-side="${side}"` : ''}>Record${side ? ' ' + (side === 'L' ? 'left' : 'right') : ''}</button>`;
  const btns = t.kind === 'manual' ? `<div class="btn-row"><input type="number" inputmode="decimal" id="cman_${id}" placeholder="${e(t.unit)}" aria-label="${e(t.name)} in ${e(t.unit)}"><button class="ghost" type="button" data-cman="${id}">Save</button></div>`
    : t.sides ? `<div class="btn-row">${rec('L')}${rec('R')}</div><div class="btn-row">${up('L')}${up('R')}</div>`
    : `<div class="btn-row">${t.upload ? '' : rec()}${up()}</div>${t.upload ? '<p class="muted small" style="margin:0">Upload only: the runner is too far from the phone to start and stop it yourself.</p>' : ''}`;
  return `<details class="card"><summary style="display:flex;justify-content:space-between;gap:10px;cursor:pointer;list-style:none">
      <span><b>${e(t.name)}</b><br><span class="muted small">${e(QUALITIES[t.quality].short)} · ${t.kind === 'camera' ? 'camera' : 'enter result'}</span></span>
      <span style="text-align:right">${v == null ? '<span class="pill voice">To do</span>' : fmt(id, v)}${delta ? `<br><span class="small ${better ? 'ok' : 'hot'}">${delta > 0 ? '+' : ''}${+delta.toFixed(2)} vs last</span>` : ''}</span></summary>
    <div class="stack" style="margin-top:10px">${extra ? `<span class="muted small">${e(extra)}</span>` : ''}
      <ol class="steps">${t.how.map(x => `<li>${e(x)}</li>`).join('')}</ol>${btns}</div></details>`;
}

function checksHTML(c) {
  const ids = screensFor(c.sport, c.role); if (!ids.length) return '';
  return `<span class="eyebrow">Movement checks · one phone</span>
    <div class="card"><p class="muted small" style="margin:0">Film the movement your sport depends on. The app estimates a few angles from your video and compares them with study ranges or coaching guides (each flag says which). These angles are not yet checked against lab equipment. Anything flagged gets matching training in your programme. For a two-camera 3D analysis, use the Biomechanics Lab in Tools.</p></div>
    <div class="stack">${ids.map(id => checkCard(id, c.checks[id])).join('')}</div>`;
}
function checkCard(id, r) {
  const sc = SCREENS[id], badge = b => `<span class="pill ${b === 'study' ? 'cam' : 'voice'}">${b === 'study' ? 'study line' : 'coaching guide'}</span>`, faults = r?.faults || [];
  const name = x => H.lib[x]?.name || x;
  return `<details class="card"><summary style="display:flex;justify-content:space-between;gap:10px;cursor:pointer;list-style:none">
      <span><b>${e(sc.name)}</b><br><span class="muted small">side-on · slow-motion</span></span>
      <span>${!r ? '<span class="pill voice">To do</span>' : faults.length ? `<span class="pill" style="color:var(--warn)">${faults.length} to work on</span>` : '<span class="pill cam">Nothing flagged</span>'}</span></summary>
    <div class="stack" style="margin-top:10px">
      ${r ? `<div class="kv">${r.metrics.map(m => `<span>${e(m.label)} ${badge(m.basis)}<br><span class="muted small">${e(m.target)}</span></span><span>${e(m.value)}${e(m.unit ? ' ' + m.unit : '')}</span>`).join('')}</div>
        ${faults.map(f => `<div class="finding"><b>${e(f.title)}</b> ${badge(f.basis)}<p>${e(f.why)}</p><p class="muted small">Your value: ${e(f.value)} ${e(f.unit)}${f.threshold ? ` · flag line: ${e(f.threshold)}` : ''}</p>
          <p class="small"><b>Strengthen:</b> ${e(f.muscles.join(', '))}</p><div class="fixes">${f.ex.map(([x, d]) => `<span>${e(name(x))} · ${e(d)}</span>`).join('')}</div><p class="small"><b>Cue:</b> ${e(f.cue)}</p></div>`).join('')}
        ${r.notes.map(n => `<p class="muted small" style="margin:0">${e(n)}</p>`).join('')}` : ''}
      <ol class="steps">${sc.how.map(x => `<li>${e(x)}</li>`).join('')}</ol>
      <div class="btn-row"><label class="ghost">Upload a slow-mo video<input type="file" accept="video/*" data-cup="c_chk_${id}" hidden></label><button class="ghost" type="button" data-crec="c_chk_${id}">Record</button></div>
    </div></details>`;
}

/* ---------- events ---------- */
function readInputs() {
  const c = C(), a = H.$('#cAge'), m = H.$('#cMass');
  if (a) c.age = a.value ? +a.value : '';
  if (m) c.massKg = m.value ? +m.value : '';
}
function onClick(ev) {
  const c = C(), t = ev.target.closest('[data-cset],[data-cact],[data-crec],[data-cman],[data-cprog]'); if (!t) return;
  if (t.dataset.cset) {
    readInputs(); const k = t.dataset.cset; c[k] = t.dataset.v;
    if (k === 'sport') c.role = null;
    H.persist(); return renderCombine();
  }
  if (t.dataset.cact === 'save') {
    readInputs();
    if (!(c.age >= 8 && c.age <= 80)) return renderCombine('Enter your age. Under-16s get a different, technique-first plan.');
    c.ready = true; c.editing = false; H.persist(); return renderCombine();
  }
  if (t.dataset.cact === 'edit') { c.editing = true; return renderCombine(); }
  if (t.dataset.cact === 'share') return share();
  if (t.dataset.cprog) return H.openProgram(t.dataset.cprog);
  if (t.dataset.crec) return H.startTest(t.dataset.crec, 'camera', null, { side: t.dataset.side });
  if (t.dataset.cman) {
    const v = parseFloat(H.$('#cman_' + t.dataset.cman).value);
    if (!(v >= 0)) return H.toast('Enter a number first.');
    store(t.dataset.cman, { value: v }); H.toast('Saved.'); return renderCombine();
  }
}
function store(testId, res) {
  const c = C();
  c.results[testId] = res;
  (c.history[testId] ||= []).push({ at: Date.now(), v: valueOf(testId, res) });
  H.persist();
}

/** Analyse a finished combine recording, store it, and return { ok, say, html } for app.js to show. */
export function finishCombine(mode, frames, q, opts = {}) {
  const c = C(), fail = msg => ({ ok: false, say: msg, html: `<div class="card"><b>No result yet</b><p class="muted small" style="margin:6px 0 0">${e(msg)}</p></div>` });
  if (mode.startsWith('c_chk_')) {
    const id = mode.slice(6), res = ANALYSE[id](frames, { heightCm: H.S.profile?.heightCm, sex: c.sex });
    if (!res.ok) return fail(res.issues[0]);
    c.checks[id] = { at: Date.now(), fps: res.fps, metrics: res.metrics, notes: res.notes,
      faults: res.faults.map(({ id: fid, title, basis, severity, why, muscles, ex, cue, value, unit, threshold }) => ({ id: fid, title, basis, severity, why, muscles, ex, cue, value, unit, threshold })) };
    H.persist(); renderCombine();
    const n = res.faults.length;
    return { ok: true, say: n ? `${SCREENS[id].name} done. ${n} thing${n > 1 ? 's' : ''} to work on. The main one: ${res.faults[0].title}. I've added matching training to your programme.` : `${SCREENS[id].name} done. Nothing flagged in what the camera could see.`,
      html: `<div class="card stack"><span class="eyebrow">${e(SCREENS[id].name)}</span><b>${n ? `${n} to work on: ${e(res.faults.map(f => f.title).join(', '))}` : 'Nothing flagged'}</b><span class="muted small">Details are under Movement checks below. Not yet checked against lab equipment.</span></div>` };
  }
  const test = mode.slice(2);
  let r, line, html;
  if (test === 'cmj' || test === 'slHop') {
    r = analyseJumps(frames, {}); if (!r.ok) return fail(r.issues[0] || 'No jump detected. Keep your feet in view.');
    const v = r.best.heightCm;
    if (test === 'slHop') {
      const side = opts.side === 'R' ? 'R' : 'L', res = { ...(c.results.slHop || {}), [side]: v };
      if (res.L && res.R) store('slHop', res); else { c.results.slHop = res; H.persist(); }
      line = `${side === 'L' ? 'Left' : 'Right'} leg: ${Math.round(v)} centimetres.${res.L && res.R ? ` The gap between legs is ${valueOf('slHop', res)} percent.` : ' Now the other leg.'}`;
    } else { store('cmj', { value: v }); line = `Best jump ${Math.round(v)} centimetres.`; }
    html = `${v.toFixed(1)} cm · reading steady to about ${r.precisionCm} cm at ${r.fps} fps`;
  } else if (test === 'hops') {
    r = analyseHops(frames); if (!r.ok) return fail(r.issues[0]);
    store('hops', { value: r.rsi }); line = `Reactive strength index ${r.rsi}. Ground contact ${r.contactMs} milliseconds.`;
    html = `RSI ${r.rsi} · contact ${r.contactMs} ms · hop ${r.heightCm} cm · ${r.hops.length} hops at ${r.fps} fps`;
  } else if (test === 'fly10') {
    r = analyseFlyingSprint(frames, { gateA: opts.gates?.[0], gateB: opts.gates?.[1], distanceM: 10 }); if (!r.ok) return fail(r.issues[0]);
    store('fly10', { value: r.kmh }); line = `Top speed ${r.kmh} kilometres an hour.`;
    html = `${r.kmh} km/h (${r.mps} m/s) · 10 m in ${r.timeS} s · reading steady to about ${r.precisionKmh} km/h at ${r.fps} fps`;
  } else if (test === 's505') {
    r = analyseShuttle(frames, { gate: opts.gates?.[0] }); if (!r.ok) return fail(r.issues[0]);
    store('s505', { value: r.timeS }); line = `5-0-5 time ${r.timeS} seconds.`;
    html = `${r.timeS} s · reading steady to about ${r.precisionS} s at ${r.fps} fps`;
  } else if (test === 'nordic') {
    r = analyseNordic(frames); if (!r.ok) return fail(r.issues[0]);
    store('nordic', { value: r.breakDeg }); line = r.reachedFloor ? 'You controlled the lower all the way to the floor.' : `You lost control at ${r.breakDeg} degrees.`;
    html = `Break point ${r.breakDeg}° from upright · controlled for ${r.lowerS} s`;
  }
  renderCombine();
  const warn = [...(r.issues || []), ...(q?.issues || [])].slice(0, 2);
  return { ok: true, say: line, html: `<div class="card stack"><span class="eyebrow">${e(TESTS[test].name)}</span><b>${e(html)}</b><span class="muted small">Not yet checked against lab equipment.</span>${warn.length ? `<ul class="issues">${warn.map(w => `<li>${e(w)}</li>`).join('')}</ul>` : ''}</div>` };
}

function share() {
  const c = C(), p = profile(c), sp = athletes.sportById(c.sport), r = athletes.roleOf(c.sport, c.role);
  const text = [`Athlete Combine · ${sp.name} · ${r.name}`, ...p.qualities.filter(q => q.value != null).map(q => `${TESTS[q.test].name}: ${fmt(q.test, q.value)}${q.score != null ? ` (${bandName(q.score)})` : ''}`),
    p.limiter ? `#1 limiter: ${QUALITIES[p.limiter.quality].name}` : 'No limiter yet'].join('\n');
  if (navigator.share) navigator.share({ title: 'My Athlete Combine', text }).catch(() => {});
  else navigator.clipboard?.writeText(text).then(() => H.toast('Copied. Paste it in a message to QK.'), () => H.toast('Couldn\'t copy.'));
}
