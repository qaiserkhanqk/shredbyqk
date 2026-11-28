// Athlete Combine screen: setup → combine tests → profile and #1 limiter → weekly plan.
// Camera capture stays in app.js (startLive/finishTest); this module renders and stores results.
import { SPORTS, SPORT, TESTS, QUALITIES, roleOf, testsFor, profile, valueOf, bandName } from './sports.js';
import { buildPlan } from './plan.js';
import { analyseHops, analyseFlyingSprint, analyseShuttle, analyseNordic, analyseBowling, peakPowerSayers } from './tests.js';
import { analyseJumps } from '../jump.js';
import { LIB } from '../library.js';
import { SCREENS, ANALYSE, screensFor, topFixes } from './lab.js';

let H; // host helpers from app.js: { $, esc, S, persist, say, tab, startTest, toast }
export const LAB_MODES = Object.keys(SCREENS).map(id => 'lab_' + id);
export const ATHLETE_MODES = ['cmj', 'hops', 'slHop', 'fly10', 's505', 'nordic', 'bowl', ...LAB_MODES];
const modeToTest = { cmj: 'cmj', hops: 'hops', slHop: 'slHop', fly10: 'fly10', s505: 's505', nordic: 'nordic', bowl: 'bowlKnee' };

export function initAthlete(host) {
  H = host;
  H.S.athlete ||= { sport: null, role: null, action: null, sex: H.S.profile.sex === 'female' ? 'f' : 'm', age: '', massKg: '', phase: 'pre', days: 3, results: {}, history: {}, lab: {} };
  H.S.athlete.lab ||= {};
  H.$('#athleteRoot').addEventListener('click', onClick);
}
const A = () => H.S.athlete;
const e = s => H.esc(s ?? '');

export function renderAthlete(msg = '') {
  const a = A(), root = H.$('#athleteRoot');
  root.innerHTML = (msg ? `<div class="card"><p style="margin:0">${e(msg)}</p></div>` : '') + (!a.sport || !a.role || !a.ready || a.editing ? setupHTML(a) : dashHTML(a));
}

/* ---------- setup ---------- */
function setupHTML(a) {
  const s = SPORT[a.sport], role = roleOf(a.sport, a.role);
  const opt = (name, v, label, on) => `<button type="button" class="mchip ${on ? 'on' : ''}" data-set="${name}" data-v="${e(v)}" aria-pressed="${on}">${e(label)}</button>`;
  return `<div class="card stack">
      <p style="margin:0">Ten minutes of tests on your phone camera. You get a profile against your position, your <b>#1 limiter</b>, and a weekly plan built around it. Retest every 4–6 weeks to see it move.</p>
    </div>
    <span class="eyebrow">Your sport</span>
    <div class="chips-scroll" role="group" aria-label="Sport">${SPORTS.map(x => opt('sport', x.id, x.name, a.sport === x.id)).join('')}</div>
    ${s ? `<span class="eyebrow">Your position</span>
    <div class="stack">${s.roles.map(r => `<button type="button" class="tile ${a.role === r.id ? 'on' : ''}" data-set="role" data-v="${r.id}" aria-pressed="${a.role === r.id}"><span><b>${e(r.name)}</b><span>${e(r.focus)}</span></span></button>`).join('')}</div>` : ''}
    ${role?.actions ? `<span class="eyebrow">Your bowling action</span><div class="chips-scroll" role="group" aria-label="Bowling action">${role.actions.map(x => opt('action', x, x, a.action === x)).join('')}</div>
      <p class="muted small" style="margin:0">Not sure? Pick "Not sure" and ask a bowling coach to check it from behind. One side-on phone can't judge hip and shoulder alignment.</p>` : ''}
    ${role ? `<div class="card stack">
      <div class="field"><span>Sex (sets the guide bands)</span><div class="mode-switch" role="group" aria-label="Sex">${[['m', 'Male'], ['f', 'Female']].map(([v, t]) => `<button type="button" data-set="sex" data-v="${v}" class="${a.sex === v ? 'on' : ''}" aria-pressed="${a.sex === v}">${t}</button>`).join('')}</div></div>
      <label class="field">Age<input id="athAge" type="number" inputmode="numeric" min="8" max="80" value="${e(a.age)}" placeholder="e.g. 22"></label>
      <label class="field">Body weight (kg, for power in watts)<input id="athMass" type="number" inputmode="decimal" value="${e(a.massKg)}" placeholder="e.g. 75"></label>
      <div class="field"><span>Season</span><div class="mode-switch three" role="group" aria-label="Season">${[['off', 'Off-season'], ['pre', 'Pre-season'], ['in', 'In season']].map(([v, t]) => `<button type="button" data-set="phase" data-v="${v}" class="${a.phase === v ? 'on' : ''}" aria-pressed="${a.phase === v}">${t}</button>`).join('')}</div></div>
      <div class="field"><span>Gym or field sessions a week, besides team training</span><div class="mode-switch" role="group" aria-label="Sessions a week">${[2, 3, 4, 5].map(v => `<button type="button" data-set="days" data-v="${v}" class="${+a.days === v ? 'on' : ''}" aria-pressed="${+a.days === v}">${v}</button>`).join('')}</div></div>
      <button class="cta" type="button" data-act="saveSetup">Start my combine</button>
    </div>` : ''}`;
}

/* ---------- dashboard ---------- */
function dashHTML(a) {
  const p = profile(a), s = SPORT[a.sport];
  const fixes = topFixes(pickLab(a));
  const plan = buildPlan({ sport: a.sport, role: a.role, limiter: p.limiter?.quality || null, next: p.next.map(q => q.quality), phase: a.phase, days: +a.days, youth: p.youth, action: a.action, fixes });
  return `<div class="card stack">
      <div class="row" style="display:flex;justify-content:space-between;align-items:center;gap:10px"><div><span class="eyebrow">${e(s.name)}${a.action && a.action !== 'Not sure' ? ' · ' + e(a.action) : ''}</span><h2 class="display h2" style="margin:4px 0 0">${e(p.role.name)}</h2></div>
      <button class="ghost" type="button" data-act="edit">Edit</button></div>
      <div class="bar" aria-label="Combine progress"><i style="width:${Math.round(p.done / p.total * 100)}%"></i></div>
      <span class="muted small">${p.done} of ${p.total} tests done${p.done < p.total ? '. Your profile gets more complete with every test.' : '. Retest in 4–6 weeks.'}</span>
    </div>
    ${limiterHTML(p)}
    ${p.done ? profileHTML(p) : ''}
    <span class="eyebrow">The combine</span>
    <div class="stack">${p.tests.map(id => testCard(id, a)).join('')}</div>
    ${labHTML(a)}
    ${planHTML(plan, p)}
    <div class="card stack"><b>Want QK to review it?</b><p class="muted small" style="margin:0">Send your profile to QK. He watches your test videos and adjusts the plan to you.</p>
      <button class="cta" type="button" data-act="share">Share my profile with QK</button></div>
    <p class="muted small" style="margin:0">Guide bands are provisional ranges from published team-sport testing, not a validated norm, and are under review by QK. This is a performance screen. It doesn't diagnose injuries or medical conditions.</p>`;
}

// Lab results only for screens that belong to the current sport and position.
const pickLab = a => Object.fromEntries(screensFor(a.sport, a.role).filter(id => a.lab?.[id]).map(id => [id, a.lab[id]]));

function labHTML(a) {
  const ids = screensFor(a.sport, a.role);
  if (!ids.length) return '';
  return `<span class="eyebrow">Biomechanics lab</span>
    <div class="card"><p class="muted small" style="margin:0">Film the movement your sport depends on. The app estimates a few angles from your video and compares them with study ranges or coaching guides (each flag says which). These angles are not yet checked against lab equipment. Anything flagged gets matching training in your plan.</p></div>
    <div class="stack">${ids.map(id => labCard(id, a.lab?.[id])).join('')}</div>`;
}
function labCard(id, r) {
  const sc = SCREENS[id], badge = b => `<span class="pill ${b === 'study' ? 'cam' : 'voice'}">${b === 'study' ? 'study line' : 'coaching guide'}</span>`;
  const faults = r?.faults || [];
  return `<details class="card"><summary style="display:flex;justify-content:space-between;gap:10px;cursor:pointer;list-style:none">
      <span><b>${e(sc.name)}</b><br><span class="muted small">${sc.view === 'side' ? 'side-on' : 'front or behind'} · slow-motion</span></span>
      <span>${!r ? '<span class="pill voice">To do</span>' : faults.length ? `<span class="pill" style="color:var(--warn)">${faults.length} to fix</span>` : '<span class="pill cam">Nothing flagged</span>'}</span></summary>
    <div class="stack" style="margin-top:10px">
      ${r ? `<div class="kv">${r.metrics.map(m => `<span>${e(m.label)} ${badge(m.basis)}<br><span class="muted small">${e(m.target)}</span></span><span>${e(m.value)}${e(m.unit ? ' ' + m.unit : '')}</span>`).join('')}</div>
        ${faults.map(f => `<div class="finding"><b>${e(f.title)}</b> ${badge(f.basis)}<p>${e(f.why)}</p>${f.threshold ? `<p class="muted small">Your value: ${e(f.value)} ${e(f.unit)} · flag line: ${e(f.threshold)}</p>` : `<p class="muted small">Your value: ${e(f.value)} ${e(f.unit)}</p>`}
          <p class="small"><b>Strengthen:</b> ${e(f.muscles.join(', '))}</p><div class="fixes">${f.ex.map(([x, d]) => `<span>${e(LIB[x]?.name || x)} · ${e(d)}</span>`).join('')}</div><p class="small"><b>Cue:</b> ${e(f.cue)}</p></div>`).join('')}
        ${r.notes.map(n => `<p class="muted small" style="margin:0">${e(n)}</p>`).join('')}` : ''}
      <ol class="steps">${sc.how.map(x => `<li>${e(x)}</li>`).join('')}</ol>
      <div class="btn-row"><label class="ghost">Upload a slow-mo video<input type="file" accept="video/*" data-up="lab_${id}" hidden></label><button class="ghost" type="button" data-rec="lab_${id}">Record</button></div>
    </div></details>`;
}

function limiterHTML(p) {
  if (p.youth) return `<div class="card stack"><b>Under 16: your own progress counts</b><p class="muted small" style="margin:0">Results aren't scored against adult bands. Every retest is compared with your last one, and the plan stays technique-first.</p></div>`;
  if (!p.limiter) return p.done ? '' : `<div class="card stack"><b>Do your first test</b><p class="muted small" style="margin:0">Start with the jump: it takes 30 seconds. Every test sharpens your profile.</p></div>`;
  const q = QUALITIES[p.limiter.quality];
  return `<div class="one-thing"><span class="eyebrow" style="color:var(--warn)">Your #1 limiter</span><p><b>${e(q.name)}</b>: ${e(bandName(p.limiter.score).toLowerCase())} for a ${e(p.role.name.toLowerCase())}.</p>
    <p class="why">${e(q.why)} It's first in every session of your plan.${p.next.length ? ` Next: ${p.next.map(n => e(QUALITIES[n.quality].short)).join(', ')}.` : ''}</p></div>`;
}

function profileHTML(p) {
  const rows = p.qualities.filter(q => q.value != null).sort((x, y) => y.weight - x.weight);
  return `<div class="card stack"><span class="eyebrow">Your profile · weighted for your position</span>
    ${rows.map(q => `<div><div style="display:flex;justify-content:space-between;gap:8px"><span>${e(QUALITIES[q.quality].short)}${q.weight >= 3 ? ' <span class="pill cam">key</span>' : ''}</span><span class="data small">${fmt(q.test, q.value)} · ${q.score == null ? 'tracked' : bandName(q.score)}</span></div>
      ${q.score == null ? '' : `<div class="bar" style="margin-top:6px"><i style="width:${q.score}%"></i></div>`}</div>`).join('')}
    ${p.strengths.length ? `<span class="muted small">Strengths: ${p.strengths.map(q => e(QUALITIES[q.quality].short)).join(', ')}.</span>` : ''}</div>`;
}

function fmt(id, v) {
  if (v == null) return '–';
  const t = TESTS[id];
  if (id === 'bowlKnee') return { extender: 'Straightens', brace: 'Braced', flexor: 'Collapses' }[v] || v;
  return `${typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(id === 'hops' ? 2 : 1)) : v}${t.unit && t.unit !== 'RSI' ? ' ' + t.unit : ''}${t.unit === 'RSI' ? ' RSI' : ''}`;
}

function testCard(id, a) {
  const t = TESTS[id], res = a.results[id], v = valueOf(id, res), hist = a.history[id] || [];
  const prev = hist.length > 1 ? hist[hist.length - 2].v : null;
  const delta = typeof v === 'number' && typeof prev === 'number' ? v - prev : null;
  const better = delta != null && (t.higher ? delta > 0 : delta < 0);
  const extra = id === 'cmj' && v && a.massKg ? ` · about ${peakPowerSayers(v, +a.massKg)} W estimated peak power (formula, not measured)` : id === 'slHop' && res ? ` · L ${res.L ?? '–'} cm, R ${res.R ?? '–'} cm` : id === 'bowlKnee' && res ? ` · knee ${res.kneeAtContact}° at contact → ${res.kneeAtRelease}° at release` : '';
  const camBtns = id === 'slHop'
    ? `<div class="btn-row"><button class="ghost" type="button" data-rec="slHop" data-side="L">Record left</button><button class="ghost" type="button" data-rec="slHop" data-side="R">Record right</button></div>
       <div class="btn-row"><label class="ghost">Upload left<input type="file" accept="video/*" data-up="slHop" data-side="L" hidden></label><label class="ghost">Upload right<input type="file" accept="video/*" data-up="slHop" data-side="R" hidden></label></div>`
    : `<div class="btn-row">${['fly10', 's505'].includes(id) ? '' : `<button class="ghost" type="button" data-rec="${t.mode}">Record</button>`}<label class="ghost">Upload a video<input type="file" accept="video/*" data-up="${t.mode}" hidden></label></div>`;
  return `<details class="card" ${!res ? '' : ''}><summary style="display:flex;justify-content:space-between;gap:10px;cursor:pointer;list-style:none">
      <span><b>${e(t.name)}</b><br><span class="muted small">${e(QUALITIES[t.quality].short)} · ${t.kind === 'camera' ? 'camera' : 'enter result'}</span></span>
      <span class="data" style="text-align:right">${v == null ? '<span class="pill voice">To do</span>' : fmt(id, v)}${delta ? `<br><span class="small ${better ? 'ok' : 'hot'}">${delta > 0 ? '+' : ''}${+delta.toFixed(2)} vs last</span>` : ''}</span></summary>
    <div class="stack" style="margin-top:10px">
      ${extra ? `<span class="muted small">${e(extra.slice(3))}</span>` : ''}
      <ol class="steps">${t.how.map(x => `<li>${e(x)}</li>`).join('')}</ol>
      ${t.kind === 'camera' ? camBtns + (['fly10', 's505'].includes(id) ? '<p class="muted small" style="margin:0">Upload only: the runner is too far from the phone to start and stop it yourself.</p>' : '')
        : `<div class="btn-row"><input type="number" inputmode="decimal" id="man_${id}" placeholder="${e(t.unit)}" aria-label="${e(t.name)} result in ${e(t.unit)}"><button class="ghost" type="button" data-man="${id}">Save</button></div>`}
    </div></details>`;
}

function planHTML(plan, p) {
  if (!plan) return '';
  const ex = id => { const x = LIB[id]; if (!x) return e(id); return x.pattern ? `<button type="button" class="linkish" data-train="${id}">${e(x.name)} <span class="pill cam">form check</span></button>` : `<span title="${e(x.guide || '')}">${e(x.name)}</span>`; };
  return `<span class="eyebrow">Your week · ${e(plan.title)}</span>
    ${plan.sessions.map(x => `<details class="card"><summary style="cursor:pointer"><b>${e(x.label)}</b> · ${e(x.name)}</summary>
      <div class="stack" style="margin-top:10px">${x.blocks.map(b => `<div><span class="eyebrow" ${b.focus ? 'style="color:var(--warn)"' : ''}>${e(b.name)}</span>
        <div class="kv">${b.items.map(([id, d]) => `<span>${ex(id)}</span><span>${e(d)}</span>`).join('')}</div></div>`).join('')}</div></details>`).join('')}
    <div class="card stack">${plan.notes.map(n => `<p class="muted small" style="margin:0">• ${e(n)}</p>`).join('')}
      ${plan.evidence?.length ? `<details><summary class="muted small" style="cursor:pointer">Why this plan</summary>${plan.evidence.map(n => `<p class="muted small">${e(n)}</p>`).join('')}</details>` : ''}
      ${p.done ? '' : '<p class="muted small" style="margin:0">This is a starting plan for your position. It adapts once you\'ve done tests.</p>'}</div>`;
}

/* ---------- events ---------- */
function onClick(ev) {
  const a = A(), t = ev.target.closest('[data-set],[data-act],[data-rec],[data-man]'); if (!t) return;
  if (t.dataset.set) {
    const k = t.dataset.set, v = t.dataset.v;
    readInputs();
    a[k] = k === 'days' ? +v : v;
    if (k === 'sport') { a.role = null; a.action = null; }
    if (k === 'role' && !roleOf(a.sport, v)?.actions) a.action = null;
    H.persist(); return renderAthlete();
  }
  if (t.dataset.act === 'saveSetup') {
    readInputs();
    if (roleOf(a.sport, a.role)?.actions && !a.action) return renderAthlete('Pick your bowling action (or "Not sure") first.');
    if (!(a.age >= 8 && a.age <= 80)) return renderAthlete('Enter your age. Under-16s get a different, technique-first plan.');
    a.editing = false; a.ready = true; H.persist(); return renderAthlete();
  }
  if (t.dataset.act === 'edit') { a.editing = true; return renderAthlete(); }
  if (t.dataset.act === 'share') return share();
  if (t.dataset.rec) return H.startTest(t.dataset.rec, 'camera', null, { side: t.dataset.side });
  if (t.dataset.man) {
    const v = parseFloat(H.$('#man_' + t.dataset.man).value);
    if (!(v >= 0)) return H.toast('Enter a number first.');
    store(t.dataset.man, { value: v }, v); H.toast('Saved.'); return renderAthlete();
  }
}
// File inputs fire change, not click.
export function bindUploads() {
  H.$('#athleteRoot').addEventListener('change', ev => {
    const i = ev.target.closest('[data-up]'); if (!i) return;
    const f = i.files[0]; i.value = ''; if (!f) return;
    H.startTest(i.dataset.up, 'file', f, { side: i.dataset.side });
  });
}
function readInputs() {
  const a = A(), age = H.$('#athAge'), m = H.$('#athMass');
  if (age) a.age = age.value ? +age.value : '';
  if (m) a.massKg = m.value ? +m.value : '';
}
function store(testId, res, v) {
  const a = A();
  a.results[testId] = res;
  (a.history[testId] ||= []).push({ at: Date.now(), v: v ?? valueOf(testId, res) });
  H.persist();
}

/** Gate taps each camera test needs on the video (cone positions). */
export const gatesFor = mode => mode === 'fly10' ? ['Tap the FIRST cone', 'Now tap the SECOND cone (10 m further)'] : mode === 's505' ? ['Tap the 5-metre cone line'] : [];

/**
 * Analyse a finished athlete recording and store it. Returns { ok, html, say } for app.js to show.
 * @param opts { side, gates: [x...], demo }
 */
export function finishAthlete(mode, frames, q, opts = {}) {
  const a = A();
  if (mode.startsWith('lab_')) {
    const id = mode.slice(4), res = ANALYSE[id](frames, { heightCm: H.S.profile.heightCm, sex: a.sex });
    if (!res.ok) return fail(res.issues[0]);
    a.lab[id] = { at: Date.now(), fps: res.fps, metrics: res.metrics, faults: res.faults.map(({ id: fid, title, basis, severity, why, muscles, ex, cue, value, unit, threshold }) => ({ id: fid, title, basis, severity, why, muscles, ex, cue, value, unit, threshold })), notes: res.notes };
    H.persist(); renderAthlete();
    const n = res.faults.length;
    return { ok: true, say: n ? `${SCREENS[id].name} done. ${n} thing${n > 1 ? 's' : ''} to fix. The main one: ${res.faults[0].title}. I've added matching training to your plan.` : `${SCREENS[id].name} done. Nothing flagged in what the camera could see.`,
      html: `<div class="card stack"><span class="eyebrow">${e(SCREENS[id].name)}</span><b>${n ? `${n} to fix: ${e(res.faults.map(f => f.title).join(', '))}` : 'Nothing flagged'}</b><span class="muted small">Details are in the Biomechanics lab below. Not yet checked against lab equipment.</span></div>` };
  }
  const testId = modeToTest[mode];
  let r, v, html, line;
  if (mode === 'cmj' || mode === 'slHop') {
    r = analyseJumps(frames, {});
    if (!r.ok) return fail(r.issues[0] || 'No jump detected. Keep your feet in view.');
    v = r.best.heightCm;
    if (mode === 'slHop') {
      const side = opts.side === 'R' ? 'R' : 'L';
      const res = { ...(a.results.slHop || {}), [side]: v };
      a.results.slHop = res;
      if (res.L && res.R) store('slHop', res); else H.persist();
      line = `${side === 'L' ? 'Left' : 'Right'} leg: ${Math.round(v)} centimetres.${res.L && res.R ? ` The gap between legs is ${valueOf('slHop', res)} percent.` : ' Now the other leg.'}`;
    } else { store('cmj', { value: v }); line = `Best jump ${Math.round(v)} centimetres.`; }
    html = `${v.toFixed(1)} cm · reading steady to about ${r.precisionCm} cm at ${r.fps} fps`;
  } else if (mode === 'hops') {
    r = analyseHops(frames); if (!r.ok) return fail(r.issues[0]);
    store('hops', { value: r.rsi }); line = `Reactive strength index ${r.rsi}. Ground contact ${r.contactMs} milliseconds.`;
    html = `RSI ${r.rsi} · contact ${r.contactMs} ms · hop ${r.heightCm} cm · ${r.hops.length} hops at ${r.fps} fps`;
  } else if (mode === 'fly10') {
    r = analyseFlyingSprint(frames, { gateA: opts.gates?.[0], gateB: opts.gates?.[1], distanceM: 10 }); if (!r.ok) return fail(r.issues[0]);
    store('fly10', { value: r.kmh }); line = `Top speed ${r.kmh} kilometres an hour.`;
    html = `${r.kmh} km/h (${r.mps} m/s) · 10 m in ${r.timeS} s · reading steady to about ${r.precisionKmh} km/h at ${r.fps} fps`;
  } else if (mode === 's505') {
    r = analyseShuttle(frames, { gate: opts.gates?.[0] }); if (!r.ok) return fail(r.issues[0]);
    store('s505', { value: r.timeS }); line = `5-0-5 time ${r.timeS} seconds.`;
    html = `${r.timeS} s · reading steady to about ${r.precisionS} s at ${r.fps} fps`;
  } else if (mode === 'nordic') {
    r = analyseNordic(frames); if (!r.ok) return fail(r.issues[0]);
    store('nordic', { value: r.breakDeg }); line = r.reachedFloor ? 'You controlled the lower all the way to the floor. Strong hamstrings.' : `You lost control at ${r.breakDeg} degrees.`;
    html = `Break point ${r.breakDeg}° from upright · controlled for ${r.lowerS} s`;
  } else if (mode === 'bowl') {
    r = analyseBowling(frames); if (!r.ok) return fail(r.issues[0]);
    store('bowlKnee', { pattern: r.pattern, kneeAtContact: r.kneeAtContact, kneeAtRelease: r.kneeAtRelease });
    const say = { extender: 'Your front knee straightens through release. That pattern is linked with faster bowling in studies.', brace: 'Your front knee stays braced through release.', flexor: 'Your front knee bends through release. Front-leg strength is a focus.' };
    line = say[r.pattern]; html = `Front knee ${r.kneeAtContact}° at contact → ${r.kneeAtRelease}° at release (${r.change > 0 ? '+' : ''}${r.change}°) · ${r.contactToReleaseMs} ms`;
  }
  const warn = [...(r.issues || []), ...(q?.issues || [])].slice(0, 2);
  renderAthlete();
  return { ok: true, say: line, html: `<div class="card stack"><span class="eyebrow">${e(TESTS[testId].name)}</span><b>${e(html)}</b><span class="muted small">Not yet checked against lab equipment.</span>${warn.length ? `<ul class="issues">${warn.map(w => `<li>${e(w)}</li>`).join('')}</ul>` : ''}</div>` };
}
function fail(msg) { return { ok: false, say: msg, html: `<div class="card"><b>No result yet</b><p class="muted small" style="margin:6px 0 0">${e(msg)}</p></div>` }; }

function share() {
  const a = A(), p = profile(a);
  const lines = [`Athlete Combine · ${SPORT[a.sport].name} · ${p.role.name}${a.action ? ' (' + a.action + ')' : ''}`, a.age ? `Age ${a.age}` : '',
    ...p.qualities.filter(q => q.value != null).map(q => `${TESTS[q.test].name}: ${fmt(q.test, q.value)}${q.score != null ? ' (' + bandName(q.score) + ')' : ''}`),
    p.limiter ? `#1 limiter: ${QUALITIES[p.limiter.quality].name}` : 'No limiter yet'].filter(Boolean);
  const text = lines.join('\n');
  if (navigator.share) navigator.share({ title: 'My Athlete Combine', text }).catch(() => {});
  else navigator.clipboard?.writeText(text).then(() => H.toast('Copied. Paste it in a message to QK.'), () => H.toast('Couldn\'t copy.'));
}
