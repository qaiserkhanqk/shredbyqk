import * as store from './store.js';
import { say, registerAvatar, setMuted, greeting, CONFIG } from './coach.js';
import { EXERCISES, RepEngine, allRules, estimateRIR, TIPS, BREATHING } from './exercises.js';
import { FeedbackCoach, restSeconds } from './feedback.js';
import { getVideoLandmarker, drawPose, liveModelName } from './pose.js';
import { toPx, viewOf, Smoother, bestSide, angle } from './angles.js';
import { MotionTracker, romSummary, torsoLen } from './motion.js';
import { analyseGait } from './gait.js';
import { analyseJumps, jumpReadiness } from './jump.js';
import { analyseSingleLegSquat } from './kneetest.js';
import { BarTracker, estimate1RM, velocityZone } from './vbt.js';
import { scaleFromPlate, scaleFromHeight, assessQuality, measuredFps } from './measure.js';
import { CONDITIONS, COND, AREAS, GENERAL_FLAGS, FLAG_ADVICE, triage, painLight, evaluatePhase, psfsScore } from './rehab.js';
import { ROM_TESTS, runRomTest } from './rom.js';
import { readiness, recommendToday, sessionLoad, weekStats, loadSpike, dayKey } from './load.js';
import { cueList, saveClip, getClip, deleteClip, listClipIds, startRecording, exportClips } from './studio.js';
import { SessionRecorder, ErrorLog, downloadJSON, APP_VERSION } from './diagnostics.js';
import { LIBRARY, LIB, MUSCLES, KINDS, exFor } from './library.js';
import { HipThrustDemo, SquatDemo, BenchDemo, WalkDemo, BodyMapDemo, BODYMAP_SECS, BODYMAP_DEMO_STEPS, DEMO_W, DEMO_H } from './demo.js';
import { analyseBodyMap, personalFor, explainBodyMap, fitLines } from './bodymap.js';
import { FormFX, drawDepthArc } from './fx.js';
import { TrackHUD } from './hud.js';
import * as rewards from './rewards.js';
import * as prog from './progression.js';
import * as brief from './brief.js';
import { icsFor, dueToday } from './reminders.js';
import * as refresh from './refresh.js';
import { CLOUD, cloudOn } from './cloud-config.js';
import * as classes from './classes.js';
import { Cloud, pushAll } from './sync.js';
import { PROGRAMS, scheme as progScheme, weeklySets, currentDay, byId as builtinById, GOALS, pickProgram, defaultDays } from './programs.js';
import * as builder from './builder.js';
import * as SS from './supersets.js';
import * as warm from './warmup.js';
import { ExerciseDetector, PICK_LIST } from './detect.js';
import { initCalm, renderCalm, startCalmNow } from './calm.js';
import { WEIGHTED, lastLoad, weekSummary } from './share.js';
import { initVitals, renderVitals } from './vitals.js';
import { vitalNotes } from './hr.js';
import { nextStep } from './today.js';
import { initFood, renderFood } from './food.js';
import { landmarksFrom, analyse, render, navyBodyFat, bfCategory, stanceProblem } from './bodyscan.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let S = store.load();
S.gaits ||= [];
let persistAsked = false;
const persist = () => {
  store.save(S);
  // Ask once for storage the browser won't clear on its own (Safari can wipe site data after 7 days unused).
  if (!persistAsked) { persistAsked = true; navigator.storage?.persist?.().catch(() => {}); }
};
ErrorLog.install();
initCalm({ S, persist: () => persist(), toast: m => toast(m) });
initVitals({ S, persist: () => persist(), toast: m => toast(m) });
initFood({ S, persist: () => persist(), toast: m => toast(m), rehab: () => !!S.rehab?.active });
const recorder2 = new SessionRecorder();
const bar = new BarTracker();
const VBT_EQUIP = ['Barbell', 'Dumbbell', 'Dumbbells', 'EZ bar', 'Kettlebell'];
// The height-based scale assumes an upright body, so only standing lifts may use it; others need the plate.
const STANDING_LIFTS = ['squat', 'rdl', 'press', 'curl', 'lunge', 'raise'];
const vbtOn = () => { const it = LIB[exKey]; return !!it?.pattern && VBT_EQUIP.includes(it.equipment) && it.pattern !== 'plank'; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let toastTimer;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, 2600); }

/* ---------- Coach avatar ---------- */
function mountOrbs() {
  $$('.orb-slot').forEach(slot => {
    slot.innerHTML = '';
    const el = $('#orb-tpl').content.firstElementChild.cloneNode(true);
    el.style.setProperty('--s', (slot.dataset.size || 84) + 'px');
    if (S.coachPhoto) { const img = el.querySelector('img'); img.src = S.coachPhoto; img.hidden = false; el.querySelector('.mono').hidden = true; }
    slot.appendChild(el); registerAvatar(el);
  });
  $('#heroOrb .orb').onclick = () => say(nudgeLine(), { id: 'nudge_' + Date.now(), priority: 'high' });
  $('#liveOrb .orb').onclick = () => { if (fb) { const l = fb.onRequest(); say(l.text, l); } };
}

/* ---------- Navigation ---------- */
function tab(id) {
  $$('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  const tabFor = ['body', 'gait', 'scan', 'rehab', 'calm', 'vitals'].includes(id) ? 'today' : id; // tools live under Today
  $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tabFor));
  if (id === 'today') renderToday();
  if (id === 'progress') { renderProgress(); renderLoad(); renderToday(); $('#youName').textContent = S.profile.name || 'You'; }
  if (id === 'rehab') renderRehab();
  if (id === 'calm') renderCalm();
  if (id === 'vitals') renderVitals();
  if (id === 'food') renderFood();
  if (id === 'scan') $('#hipWrap').hidden = S.profile.sex === 'male';
  if (id === 'body') { const first = { recover: 'rehab', calm: 'calm' }[S.profile.focus]; const t = first && $(`#body [data-go=${first}]`); if (t) $('#body .page-head').after(t); }
  window.scrollTo(0, 0);
}
$$('.tabs button').forEach(b => b.onclick = () => tab(b.dataset.tab));
document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]');
  if (g) { if (g.dataset.go === 'calm-now') { tab('calm'); return startCalmNow(); } return tab(g.dataset.go); }
  if (e.target.closest('[data-back]')) tab('body');
  if (e.target.closest('[data-home]')) tab('today');
});

/* ---------- Today ---------- */
const TODAY_DEFAULT = [['hipThrust', '4×10'], ['rdl', '3×10'], ['lunge', '3×12'], ['bandedWalk', '2×20']];
// Today's workout: the next day of the active program, or the starter glute session.
const activeProgram = () => { const d = S.program?.id ? programById(S.program.id) : null; return d && S.program.plan ? { ...d, plan: S.program.plan } : d; };
const programDay = () => { const p = activeProgram(); return p ? currentDay(p, S.program) : null; };
const capToday = () => (S.timeCap?.day === new Date().toDateString() ? S.timeCap.mins : null);
// Rough count of warm-up sets for a day (heavy barbell lifts get about three).
const warmCount = items => items.reduce((a, it) => a + ((prog.liftClass(LIB[it[0]]) || '').startsWith('big') ? 3 : prog.liftClass(LIB[it[0]]) === 'mid' ? 1 : 0), 0);
const dayItemsRaw = () => programDay()?.day?.items || null;
const dayItems = () => { const raw = dayItemsRaw(); if (!raw) return null; const cap = capToday(); return cap ? warm.fitTo(raw, cap, warmCount(raw)).items : raw; };
const todayItems = () => { const items = dayItems(); return items ? items.map(it => [it[0], `${it[1]}×${it[2]}`]) : TODAY_DEFAULT; };
const todayName = () => { const p = activeProgram(), d = programDay(); return p && d ? `${p.name}: ${d.day.name}` : 'Glute Builder'; };
const ICONS = {
  hipThrust: '<path d="M6 20h9l8-5 8 3M23 15l3 11M6 28h14"/><circle cx="23" cy="13" r="3.5"/>',
  squat: '<circle cx="18" cy="6" r="3.5"/><path d="M18 10l2 10-8 4 2 10M20 20l6 6-2 8"/>',
  rdl: '<circle cx="15" cy="8" r="3.5"/><path d="M16 12l10 8M16 12l-2 12 2 10M14 24l8 10"/>',
  pushUp: '<circle cx="8" cy="18" r="3.5"/><path d="M12 20l24 4M14 21v8M34 24v6"/>',
  lunge: '<circle cx="20" cy="7" r="3.5"/><path d="M20 11v12M20 23l-8 4v7M20 23l8 6 1 5"/>',
  curl: '<circle cx="20" cy="7" r="3.5"/><path d="M20 11v16M20 27l-5 9M20 27l5 9M20 14l-6 8 4-10M20 14l6 8"/>',
  press: '<circle cx="20" cy="12" r="3.5"/><path d="M20 16v12M20 28l-5 8M20 28l5 8M20 18l-7-4V4M20 18l7-4V4M10 4h20"/>',
  band: '<path d="M8 30c4-10 20-10 24 0M14 30v-6M26 30v-6"/>',
};
const icon = (k, cls = '') => `<svg class="${cls}" viewBox="0 0 40 40" fill="none" stroke="url(#zoneStroke)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${ICONS[k] || ICONS.band}</svg>`;

function nudgeLine() {
  const since = store.daysSinceLast(S), st = store.streak(S), wk = store.thisWeek(S), goal = S.profile.weeklyGoal || 4;
  const plan = S.plan || {}, planned = (plan.days || []).includes(new Date().getDay());
  const when = plan.time ? ` at ${plan.time}` : '', where = plan.place ? ` at ${plan.place}` : '';
  if (since === null) return plan.days?.length ? 'Your plan is set. First session today, and I\'ll be right here with you.' : 'Tap Train with QK and let\'s do your first session together. You can set your training days under You.';
  if (since === 0) return st > 1 ? `${st} days on plan. This is who you are now.` : 'Session done today. That\'s a vote for the person you\'re becoming.';
  if (planned) return `Today's a training day${when}${where}. You planned it, so let's keep that promise to yourself.`;
  if (since === 1) return wk >= goal ? 'Weekly goal hit. Recovery is where the muscle is built.' : `${goal - wk} more session${goal - wk > 1 ? 's' : ''} this week gets you to your goal.`;
  if (since === 2) return 'Missing one day is normal. The rule is never miss twice. Even ten minutes counts today.';
  return `It's been ${since} days. No guilt, just restart. One short session today and we're back.`;
}

function formScoreOf(list) {
  list = list.filter(s => !s.guided && !s.edited); // hand-corrected counts have no camera form data for the extra reps
  const r = list.reduce((a, s) => a + s.reps, 0), g = list.reduce((a, s) => a + s.good, 0);
  return r ? Math.round(g / r * 100) : null;
}

function setRing(id, frac) {
  const c = $(id), L = 2 * Math.PI * c.r.baseVal.value;
  c.style.strokeDasharray = L;
  if (!c.dataset.init) { c.style.strokeDashoffset = L; c.dataset.init = 1; }
  requestAnimationFrame(() => requestAnimationFrame(() => { c.style.strokeDashoffset = L * (1 - Math.max(0, Math.min(1, frac))); }));
}

function renderToday() {
  if (typeof renderRehabToday === 'function' && S.rehab) renderRehabToday();
  if (S.readiness) renderReady(); else renderNext(null);
  const now = new Date();
  $('#dateLine').textContent = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const part = now.getHours() < 12 ? 'Morning' : now.getHours() < 18 ? 'Afternoon' : 'Evening';
  $('#hello').textContent = `${part}${S.profile.name ? ', ' + S.profile.name : ''}.`;
  $('#nudge').textContent = nudgeLine();

  const goal = S.profile.weeklyGoal || 4, wk = store.thisWeek(S), st = store.streak(S);
  const weekStart = new Date(); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekSessions = S.sessions.filter(s => s.at >= weekStart.getTime());
  const fs = formScoreOf(weekSessions.length ? weekSessions : S.sessions.slice(-5));
  setRing('#ring1', wk / goal); setRing('#ring2', (fs ?? 0) / 100); setRing('#ring3', Math.min(st, 14) / 14);
  $('#lgSessions').textContent = `${wk}/${goal}`;
  $('#lgForm').textContent = fs == null ? '–' : fs + '%';
  $('#lgFormL').textContent = fs == null ? 'form score after your first set' : 'form score';
  $('#lgStreak').textContent = `${st} day${st === 1 ? '' : 's'}`;
  $('#weekTitle').textContent = wk >= goal ? 'Goal hit' : wk ? 'On track' : 'Let\'s start';
  $('#ringsSvg').setAttribute('aria-label', `Sessions ${wk} of ${goal}, form score ${fs ?? 'not yet measured'}, plan kept ${st} days`);

  const p = S.plan || {};
  $('#sessionMeta').textContent = [p.time, p.place].filter(Boolean).join(' · ');
  rollMonth();
  const plan = planToday(), tgt = Object.fromEntries(plan.map(r => [r.id, r]));
  $('#todayList').innerHTML = todayItems().map(([k, sets]) => `<button type="button" class="ex-row" data-train="${k}" style="width:100%;background:none;border-left:0;border-right:0;border-bottom:0;text-align:left;cursor:pointer;padding-inline:0"><span class="pic">${icon(iconKey(k))}</span>
    <div><b>${esc(LIB[k].name)}</b>${LIB[k].pattern ? '<span class="tag">QK checks your form</span>' : '<span class="tag" style="color:var(--z3)">QK coaches your tempo</span>'}</div>
    <span class="sets">${tgt[k]?.rx ? esc(tgt[k].line) : sets}</span></button>`).join('');
  renderPlan(plan);

  // Focus: the most frequent fault, and how often it's been clean recently.
  const tally = {};
  S.sessions.forEach(s => Object.entries(s.faults || {}).forEach(([id, n]) => { tally[id] = (tally[id] || 0) + n; }));
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
  $('#focusCard').hidden = !top;
  if (top) {
    const rule = Object.values(EXERCISES).flatMap(allRules).find(r => r.id === top[0]);
    const recent = S.sessions.filter(s => s.faults && exFor(s.ex) && allRules(exFor(s.ex)).some(r => r.id === top[0])).slice(-6);
    const clean = recent.filter(s => !s.faults[top[0]]).length;
    $('#focusTitle').textContent = rule?.cue || top[0];
    $('#focusNum').textContent = `${clean}/${recent.length} sets clean`;
    $('#focusBar').style.width = (recent.length ? clean / recent.length * 100 : 0) + '%';
    $('#focusWhy').textContent = rule?.why || '';
  }

  const items = [
    ...S.sessions.map(s => ({ at: s.at, icon: 'good', t: `${esc(s.name)}: ${s.reps} reps, ${s.good} clean` })),
    ...S.checkins.map(c => ({ at: c.at, icon: 'good', t: 'Trained (logged without camera)' })),
    ...S.scans.map(c => ({ at: c.at, icon: 'z1', t: c.bf ? `Body fat ${c.bf.toFixed(1)}%` : 'Posture scan' })),
    ...S.gaits.map(g => ({ at: g.at, icon: 'z1', t: `Gait check: ${Math.round(g.cadence)} steps/min` })),
  ].sort((a, b) => b.at - a.at).slice(0, 5);
  $('#recent').innerHTML = items.length ? items.map(i => `<div class="row"><span class="badge"><svg viewBox="0 0 24 24" fill="none" stroke="var(--${i.icon})" stroke-width="2.4" stroke-linecap="round"><path d="${i.icon === 'good' ? 'M5 12l5 5 9-10' : 'M4 18 10 12l4 4 6-8'}"/></svg></span><div>${i.t}</div><time>${new Date(i.at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</time></div>`).join('') : '<p class="empty">Your sessions, scans and wins will show up here.</p>';
}

$('#listenBtn').onclick = () => say($('#nudge').textContent, { id: 'nudge_' + Date.now(), priority: 'high' });
$('#checkinBtn').onclick = () => {
  S.checkins.push({ at: Date.now() }); persist(); renderToday();
  const st = store.streak(S);
  say(`Logged. That's ${st} day${st > 1 ? 's' : ''} on plan. Keep showing up.`, { id: 'checkin', priority: 'high' });
  toast('Session logged');
};

/* Implementation intentions (Gollwitzer & Sheeran 2006). */
function bindPlan() {
  S.plan ||= { days: [], time: '', place: '' };
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], order = [1, 2, 3, 4, 5, 6, 0];
  const draw = () => {
    $('#planDays').innerHTML = order.map(d => `<button type="button" class="day ${S.plan.days.includes(d) ? 'on' : ''}" data-day="${d}" aria-pressed="${S.plan.days.includes(d)}">${names[d]}</button>`).join('');
    const ds = order.filter(d => S.plan.days.includes(d)).map(d => names[d]);
    $('#planLine').textContent = ds.length ? `"On ${ds.join(', ')}${S.plan.time ? ' at ' + S.plan.time : ''}, I train${S.plan.place ? ' at ' + S.plan.place : ''}."` : '';
  };
  $('#planDays').onclick = e => {
    const b = e.target.closest('[data-day]'); if (!b) return;
    const d = +b.dataset.day, i = S.plan.days.indexOf(d);
    i >= 0 ? S.plan.days.splice(i, 1) : S.plan.days.push(d);
    if (S.plan.days.length) S.profile.weeklyGoal = S.plan.days.length;
    persist(); draw(); renderToday();
  };
  $('#planTime').value = S.plan.time; $('#planPlace').value = S.plan.place;
  $('#planTime').onchange = e => { S.plan.time = e.target.value; persist(); draw(); renderToday(); };
  $('#planPlace').onchange = e => { S.plan.place = e.target.value.trim(); persist(); draw(); renderToday(); };
  draw();
}

function bindProfile() {
  const p = S.profile;
  $('#pName').value = p.name || ''; $('#pSex').value = p.sex || 'male'; $('#pHeight').value = p.heightCm || '';
  $('#pName').onchange = e => { p.name = e.target.value.trim(); persist(); renderToday(); };
  $('#pSex').onchange = e => { p.sex = e.target.value; persist(); };
  $('#pHeight').onchange = e => { p.heightCm = +e.target.value; persist(); };
  $('#pUnit').value = p.unit || 'kg';
  $('#pUnit').onchange = e => { p.unit = e.target.value; persist(); unitLabels(); };
  setTimeout(unitLabels);
  $('#coachPhoto').onchange = async e => { const f = e.target.files[0]; if (!f) return; S.coachPhoto = await downscale(f, 320); persist(); mountOrbs(); toast('Coach photo updated'); };
  const fill = () => {
    const vs = speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));
    let saved = null; try { saved = localStorage.getItem('qk_voice'); } catch {}
    $('#voiceSel').innerHTML = '<option value="">Automatic</option>' + vs.map(v => `<option ${v.name === saved ? 'selected' : ''}>${esc(v.name)}</option>`).join('');
  };
  if ('speechSynthesis' in window) { fill(); speechSynthesis.onvoiceschanged = fill; }
  $('#voiceSel').onchange = e => { try { localStorage.setItem('qk_voice', e.target.value); } catch {} };
  $('#testVoice').onclick = () => say('Right, let\'s go. Feet planted, brace your core, and give me ten good reps.', { id: 'test_' + Date.now(), priority: 'high' });
}

function downscale(file, max) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => { const s = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = img.width * s; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', .82)); };
    img.src = URL.createObjectURL(file);
  });
}

let muted = false;
try { muted = localStorage.getItem('qk_muted') === '1'; } catch {}
const applyMute = () => { setMuted(muted); $('#spk').style.opacity = muted ? .35 : 1; $('#muteBtn').setAttribute('aria-label', muted ? 'Unmute coach voice' : 'Mute coach voice'); };
$('#muteBtn').onclick = () => { muted = !muted; try { localStorage.setItem('qk_muted', muted ? '1' : '0'); } catch {} applyMute(); toast(muted ? 'Coach muted. Captions still show.' : 'Coach voice on'); };

/* ---------- Train picker + setup ---------- */
const WATCH = { squat: 'Depth, chest, knees', hipThrust: 'Foot position, lockout, back arch', pushUp: 'Depth, body line', rdl: 'Hinge, lockout, bar path', lunge: 'Depth, torso', curl: 'Elbow swing, range', press: 'Lockout, evenness',
  row: 'Full pull, full reach', vPull: 'Full range, even pull', bench: 'Depth, lockout', dip: 'Safe depth, lockout', fly: 'Elbow shape', triExt: 'Lockout', raise: 'Height, no swinging',
  calf: 'Full height, pause', torsoCurl: 'Full crunch', legRaise: 'Leg height', kneeExt: 'Full squeeze', kneeFlex: 'Full curl, full stretch', plank: 'Hip height, time held' };
const PATTERN_ICON = { bench: 'pushUp', dip: 'press', fly: 'press', row: 'rdl', vPull: 'press', triExt: 'curl', raise: 'press', calf: 'lunge', torsoCurl: 'pushUp', legRaise: 'pushUp', kneeExt: 'squat', kneeFlex: 'lunge', plank: 'pushUp' };
const iconKey = id => { const p = LIB[id]?.pattern; return p ? (ICONS[p] ? p : PATTERN_ICON[p]) : 'band'; };
// How QK coaches an exercise the camera can't judge. Each mode has a label for the card, a setup title
// and a line saying what QK will do.
const mmss = sec => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
const coachOf = x => x.coach && x.coach !== 'camera' ? x.coach : x.hold ? 'hold' : 'tempo';
const COACH = {
  tempo: { pill: 'Tempo coach', title: 'QK coaches your tempo', how: () => 'QK calls out a controlled tempo: three seconds down, a pause, then up.' },
  hold: { pill: 'Hold timer', title: 'QK times your hold', how: x => `QK times a ${x.hold}-second hold and counts you down.` },
  explosive: { pill: 'Rep pacer', title: 'QK paces your reps', how: x => `${x.reps || 6} reps. QK says "Set" and "Go" for each one, with ${x.gap || 5} seconds to reset in between.` },
  mobility: { pill: 'Rep pacer', title: 'QK paces your reps', how: x => `${x.reps || 10} slow reps. QK counts them with you.` },
  timer: { pill: 'Timer', title: 'QK times your session', how: x => `${x.mins || 20} minutes. QK tells you the time left as you go.` },
  intervals: { pill: 'Intervals', title: 'QK runs your intervals', how: x => `${x.rounds} rounds of ${mmss(x.work)} work and ${mmss(x.rest)} rest. QK calls "Go" and "Rest" for you.` },
  stopwatch: { pill: 'Stopwatch', title: 'QK times you', how: () => 'Tap End when you finish. QK saves your time so you can see your progress.' },
};
COACH.tempo.note = COACH.hold.note = 'A camera can\'t judge this movement reliably, so there\'s no form score. QK still coaches every rep with you.';

let muscleFilter = 'All', searchQ = '';
function renderTrain() {
  renderPrograms(); renderClasses(); renderHome();
  $('#muscleChips').innerHTML = ['All', ...Object.keys(KINDS), ...MUSCLES, 'Rehab'].map(m => `<button type="button" class="mchip ${m === muscleFilter ? 'on' : ''}" data-muscle="${m}" aria-pressed="${m === muscleFilter}">${m}</button>`).join('');
  const q = searchQ.trim().toLowerCase();
  // Physio exercises live under their own Rehab filter so they don't clutter the gym library.
  const kind = KINDS[muscleFilter];
  const list = LIBRARY.filter(x => (muscleFilter === 'Rehab' ? x.rehab : !x.rehab && (muscleFilter === 'All' || (kind ? x.kind === kind : x.muscles.includes(muscleFilter)))) && (!q || `${x.name} ${x.muscles.join(' ')} ${x.equipment}`.toLowerCase().includes(q)));
  const cam = list.filter(x => x.pattern).length;
  $('#exSearch').placeholder = `Search ${LIBRARY.filter(x => !x.rehab).length} exercises, e.g. row, box jump, sled`;
  $('#exCount').textContent = `${list.length} exercise${list.length === 1 ? '' : 's'} · ${cam} with camera form check`;
  $('#exGrid').innerHTML = list.map(x => x.id === 'hipThrust' && muscleFilter === 'All' && !q
    ? `<button type="button" class="ex-card feature" data-train="${x.id}"><div><span class="eyebrow" style="color:var(--z1)">Live form check</span><h2 class="display h2" style="margin:8px 0 6px">${x.name}</h2><span class="watch">QK watches: ${WATCH[x.pattern]}</span></div>${icon('hipThrust', 'fig')}</button>`
    : `<button type="button" class="ex-card" data-train="${x.id}">${icon(iconKey(x.id), 'fig')}<b>${esc(x.name)}</b>
        <span class="watch">${esc(x.muscles.slice(0, 2).join(' · '))} · ${esc(x.equipment)}</span>
        <span class="meta">${x.pattern ? '<span class="pill cam">Form check</span>' : `<span class="pill voice">${COACH[coachOf(x)].pill}</span>`}</span></button>`).join('') || '<p class="empty">No exercises match. Try another word.</p>';
}
$('#muscleChips').onclick = e => { const b = e.target.closest('[data-muscle]'); if (!b) return; muscleFilter = b.dataset.muscle; renderTrain(); };
$('#exSearch').oninput = e => { searchQ = e.target.value; renderTrain(); };
document.addEventListener('click', e => { const b = e.target.closest('[data-train]'); if (b) openSetup(b.dataset.train); });

let exKey = 'hipThrust';
// Simulated demo lifters are for automated tests only: hidden unless ?demo or localStorage qk_demo=1.
const DEMO = (() => { try { return /[?&]demo\b/.test(location.search) || localStorage.getItem('qk_demo') === '1'; } catch { return false; } })();
const curEx = () => exFor(exKey);
const isHoldId = id => !!exFor(id)?.hold;
function openSetup(k) {
  exKey = k; const item = LIB[k], ex = exFor(k);
  $('#setupEyebrow').textContent = `${item.name} · set ${setsToday(k) + 1}`;
  if (ex) {
    $('#setupTitle').textContent = 'Set up your phone';
    // One line on screen; everything else QK says out loud when the set starts.
    $('#setupSteps').innerHTML = `<li>${esc(ex.setup)}</li>`;
  } else {
    const c = COACH[coachOf(item)];
    $('#setupTitle').textContent = c.title;
    $('#setupSteps').innerHTML = [item.guide, c.how(item), ...(c.note ? [c.note] : [])].map(s => `<li>${esc(s)}</li>`).join('');
  }
  $('#startCam').hidden = !ex; $('#videoFile').parentElement.hidden = !ex; $('#recordChk').parentElement.hidden = !ex;
  $('#startGuided').hidden = !!ex;
  $('#formTestBtn').hidden = !item.formTest;
  $('#startDemo').hidden = !DEMO || !['hipThrust', 'squat', 'benchPress'].includes(k);
  const fit = !!ex, mapped = S.profile.body?.ok, lines = mapped && ex ? fitLines(ex.patternKey, S.profile.body) : [];
  $('#fitNote').hidden = !fit; $('#fitNote').classList.toggle('on', !!mapped);
  $('#fitNote').innerHTML = mapped ? `<span><b>✓ Fit to your body.</b> ${lines.length ? esc(lines.join('. ')) + '.' : 'Your body matches the standard limits for this one.'}</span><button class="ghost" type="button" id="fitView">View</button>`
    : `<span>QK uses standard limits until it maps your body (1 min).</span><button class="ghost" type="button" id="fitMap">Map my body</button>`;
  $('#fitView')?.addEventListener('click', () => { $('#setup').hidden = true; showBodyMap(S.profile.body); });
  $('#fitMap')?.addEventListener('click', () => { $('#setup').hidden = true; showBodyMapIntro(); });
  $('#loadWrap').hidden = !vbtOn();
  const ll = lastLoad(S.sessions, k);
  $('#setupLast').textContent = ll ? `Last time: ${prog.fmtW(ll.kg, unit())} × ${ll.reps}` : '';
  showRx(k);
  $('#setup').hidden = false;
}
const setsToday = k => { const d = new Date(); d.setHours(0, 0, 0, 0); return S.sessions.filter(s => s.ex === k && s.at >= d.getTime()).length; };
$('#setup').onclick = e => { if (e.target.id === 'setup') $('#setup').hidden = true; };
$('#startCam').onclick = () => startLive({ mode: 'form', source: 'camera' });
$('#startDemo').onclick = () => startLive({ mode: 'form', source: 'demo' });
$('#startGuided').onclick = () => startGuided();
$('#formTestBtn').onclick = () => { $('#setup').hidden = true; gaitMode = 'run'; startLive({ mode: 'gait', source: 'camera' }); };
$('#videoFile').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) startLive({ mode: 'form', source: 'file', file: f }); };

/* ---------- Live session (form check + gait capture) ---------- */
let live = null, fb = null, engine = null, stream = null, recorder = null, chunks = [], facing = 'user', raf = 0;
const smooth = new Smoother(0.55);
const fx = new FormFX();
// Visible tracking: lock-on scan, body brackets, rep read-out and the LIVE chip (see hud.js).
const hud = new TrackHUD();
let chipT = 0;
function hudFrame(ctx, px, s, t, seen) {
  const mirror = $('#viewport').classList.contains('mirror');
  hud.draw(ctx, px, s, t, { mirror, seen });
  if (t - chipT > 500) {
    chipT = t; const el = $('#trackChip');
    el.classList.toggle('on', hud.locked);
    el.innerHTML = hud.locked ? `<i></i>Live · ${hud.points(px)} points · ${hud.fps()} fps` : '<i></i>Finding you…';
  }
}
const motion = new MotionTracker();

// Keep the screen on during a set and the rest after it, so the phone doesn't lock mid-session.
let wake = null;
async function keepAwake(on) {
  if (!on) { try { await wake?.release(); } catch {} wake = null; return; }
  if (wake && !wake.released) return;
  try { wake = await navigator.wakeLock?.request('screen'); } catch {}
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && (!$('#live').hidden || !$('#summary').hidden)) keepAwake(true); });
let lastSource = null, lastSet = null;

async function startLive({ mode, source, file, auto = false }) {
  keepAwake(true);
  $('#setup').hidden = true; $('#summary').hidden = true; $('#live').hidden = false;
  $('#tempoRing').hidden = true;
  if (auto) exKey = null;
  const ex = mode === 'form' && !auto ? curEx() : null;
  const rx = mode === 'form' && !auto ? curRx : null;
  live = { rx, mode, source, frames: [], t0: null, lost: 0, wrong: 0, demo: null, done: false, steps: 0, mPerPx: null, standFrames: [], times: [],
    auto, det: auto ? new ExerciseDetector() : null, buf: [], sets: [], lastRepT: 0 };
  bar.reset(); recorder2.start({ kind: mode, exercise: mode === 'form' && !auto ? exKey : undefined, gaitMode: mode === 'gait' ? gaitMode : undefined, source, loadKg: mode === 'form' ? parseFloat($('#loadKg').value) || null : undefined });
  engine = null; fb = null; smooth.reset(); motion.reset(); fx.reset(); hud.reset(); comp = null; recorder = null; $('#trackChip').innerHTML = '<i></i>Finding you…'; $('#trackChip').classList.remove('on'); $('#faultBanner').hidden = true;
  $('#formMeters').hidden = mode !== 'form'; $('#gaitMeters').hidden = mode === 'form';
  $('#repBig').hidden = mode !== 'form'; $('#trackChip').hidden = mode !== 'form'; $('#cueHint').hidden = mode !== 'form';
  $('#repNum').textContent = '0'; $('#repLbl').textContent = ex?.hold ? 'seconds' : 'reps'; $('#dots').innerHTML = ''; $('#cleanCt').textContent = '0 clean'; $('#vlKnob').style.left = '0%'; $('#vlTxt').textContent = 'fresh';
  $('#gSteps').textContent = '0'; $('#gProg').style.width = '0'; $('#gStepsLbl').textContent = mode === 'gait' ? 'Steps seen' : 'Time';
  const testName = { rom: TEST.rom?.label || 'Measurement', gait: `Gait · ${gaitMode === 'run' ? 'running' : 'walking'}`, jump: 'Jump test', sls: 'Single-leg squat knee test', bodymap: 'Map my body' };
  $('#detectChip').hidden = !auto; $('#detectChip').classList.remove('found'); $('#detectAlt').hidden = true; $('#detectChange').hidden = true;
  $('#detectTxt').textContent = 'Start your exercise. I\'ll recognise it.';
  $('#liveEyebrow').textContent = auto ? 'Camera coach' : mode === 'form' ? ex.name : testName[mode];
  $('#liveTitle').textContent = auto ? 'Start moving' : mode === 'form' ? `Set ${setsToday(exKey) + 1}${source === 'demo' ? ' · demo' : ''}` : (mode === 'bodymap' ? 'Stand still, side-on' : source === 'demo' ? 'Demo walker' : source === 'file' ? 'Analysing your video (precise mode)' : mode === 'gait' ? 'Walk naturally for 10 seconds' : mode === 'jump' ? 'Up to 3 jumps' : mode === 'rom' ? `${TEST.rom.secs} seconds` : 'Left leg first, then right');
  $('#endLive').textContent = mode === 'form' ? 'End set' : 'Stop';
  $('#flipCam').hidden = source !== 'camera';
  $('#calBtn').hidden = !(mode === 'form' && vbtOn() && source !== 'demo');
  $('#viewport').classList.remove('calibrating');
  $('#readout').innerHTML = ''; $('#recBadge').hidden = true;
  const video = $('#video'), canvas = $('#overlay');
  $('#viewport').classList.remove('mirror');
  $('#status').textContent = source === 'demo' ? '' : 'Loading coach vision…';

  try {
    if (source === 'demo') {
      video.hidden = true; live.demo = auto && window.__qkFeed ? { frame: now => window.__qkFeed(now), drawScene() {} } : mode === 'bodymap' ? new BodyMapDemo() : mode !== 'form' ? new WalkDemo() : ex.patternKey === 'squat' ? new SquatDemo() : ex.patternKey === 'bench' ? new BenchDemo() : new HipThrustDemo();
      canvas.width = DEMO_W; canvas.height = DEMO_H;
    } else {
      video.hidden = false;
      if (source === 'file') { video.srcObject = null; video.src = URL.createObjectURL(file); video.loop = false; video.playbackRate = 1; }
      else {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('nocam');
        // Tests ask for 60 fps: event timing (jump flight, foot contacts) gets twice as precise.
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: mode === 'form' ? 30 : 60 } }, audio: false });
        video.removeAttribute('src'); video.srcObject = stream;
        $('#viewport').classList.toggle('mirror', facing === 'user');

      }
      await video.play();
      // Uploaded videos don't need real-time speed, so they use the most precise model.
      live.model = source === 'file' ? 'heavy' : mode === 'form' ? liveModelName() : 'full';
      live.lm = await getVideoLandmarker(live.model);
      $('#status').textContent = '';
    }
    if (mode === 'form' && source !== 'file' && $('#recordChk').checked) startComposite(source === 'demo' ? canvas : video);
  } catch (err) {
    console.warn(err);
    $('#status').textContent = source === 'file' ? 'That video couldn\'t be played. Try an MP4 or MOV.' : 'Camera blocked. Allow camera access for this site in your browser settings, then try again.';
    return;
  }

  if (auto) say('Camera coach. Step back so I can see your whole body, then start your exercise. I\'ll recognise it in a rep or two.', { id: 'auto_intro', priority: 'high' });
  else if (mode === 'form') say(setupLine(ex), { id: `setup_${exKey}`, priority: 'high' });
  else if (source !== 'file') { say(TEST[mode].intro(), { id: mode + '_intro', priority: 'high' }); await countdown(3); }
  live.t0 = performance.now();
  cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
}

function countdown(n) {
  return new Promise(res => {
    const el = $('#countdown'); el.hidden = false;
    const step = () => { if (!live) return res(); if (n === 0) { el.hidden = true; return res(); } el.textContent = n--; setTimeout(step, 900); };
    step();
  });
}

/* Recording: the camera image with the skeleton and coaching graphics burned in, so the replay
   shows exactly what QK saw and said. Recorded from a canvas, so it never leaves the phone. */
let comp = null;
function startComposite(src) {
  const c = document.createElement('canvas'), sw = src.videoWidth || src.width, sh = src.videoHeight || src.height;
  const k = Math.min(1, 720 / Math.max(sw, sh)); c.width = Math.round(sw * k); c.height = Math.round(sh * k);
  if (!window.MediaRecorder || !c.captureStream) return;
  try {
    chunks = []; recorder = new MediaRecorder(c.captureStream(30));
    recorder.ondataavailable = e => e.data.size && chunks.push(e.data); recorder.start(1000);
    comp = { c, ctx: c.getContext('2d'), src, mirror: $('#viewport').classList.contains('mirror') };
    live.recT0 = performance.now(); live.marks = []; $('#recBadge').hidden = false;
  } catch (e) { console.warn(e); recorder = null; comp = null; }
}
function drawComposite() {
  if (!comp || !recorder || recorder.state !== 'recording') return;
  const { c, ctx, src, mirror } = comp, ov = $('#overlay');
  ctx.save(); if (mirror) { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
  if (src.tagName === 'VIDEO') ctx.drawImage(src, 0, 0, c.width, c.height); else { ctx.fillStyle = '#07090f'; ctx.fillRect(0, 0, c.width, c.height); }
  ctx.drawImage(ov, 0, 0, c.width, c.height); ctx.restore();
}
// Every correction is marked on the recording so the lifter can jump straight to it afterwards.
function markFault(rule, fixed) {
  if (!live?.marks || !rule) return;
  live.marks.push({ t: (performance.now() - live.recT0) / 1000, label: fixed ? (rule.yes || `Fixed: ${rule.tag || rule.cue}`) : (rule.wrong || rule.cue), fix: fixed ? '' : (rule.tag || ''), ok: !!fixed });
}

let bannerT;
function showBanner(rule, fixed) {
  const el = $('#faultBanner'); if (!rule) return;
  $('#fbWrong').textContent = fixed ? (rule.yes || 'Fixed') : (rule.wrong || rule.tag || 'Check your form');
  $('#fbFix').textContent = fixed ? '' : (rule.tag || rule.cue);
  $('#fbFix').hidden = fixed;
  el.classList.toggle('fixed', !!fixed); el.hidden = false;
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  clearTimeout(bannerT); bannerT = setTimeout(() => { el.hidden = true; }, fixed ? 1800 : 2600);
  if (!fixed && live) live.badUntil = performance.now() + 1500;
}

let lastTs = -1;
function loop(now) {
  if (!live || live.done) return;
  const video = $('#video'), canvas = $('#overlay'), ctx = canvas.getContext('2d');
  let px = null, t = now;
  if (live.demo) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    px = live.demo.frame(now); live.demo.drawScene(ctx);
  } else if (video.readyState >= 2 && video.videoWidth) {
    if (canvas.width !== video.videoWidth) { canvas.width = video.videoWidth; canvas.height = video.videoHeight; }
    const ts = live.source === 'file' ? video.currentTime * 1000 : now;
    if (ts > lastTs || live.source === 'camera') {
      lastTs = ts; t = live.source === 'file' ? ts : now;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const res = live.lm.detectForVideo(video, performance.now());
      const raw = res.landmarks?.[0];
      if (raw) px = toPx(raw, canvas.width, canvas.height);
      else if (++live.lost === 45) say('I can\'t see you. Step back so your whole body is in the frame.', { id: 'not_visible', priority: 'high' });
    }
  }
  if (px) { live.times.push(t); live.mode === 'form' ? formFrame(px, ctx, t) : testFrame(px, ctx, t); }
  drawComposite();
  if (!live || live.done) return;
  if (live.source === 'file' && video.ended) return live.mode === 'form' ? endSet() : finishTest();
  if (live.demo?.done && live.mode === 'form' && !live.ending) { live.ending = true; setTimeout(() => live && endSet(), 1500); }
  raf = requestAnimationFrame(loop);
}

const fmtA = v => (v == null || Number.isNaN(v) ? '–' : Math.round(v) + '°');
function formFrame(px, ctx, t) {
  if (live.auto && !live.replaying && autoFrame(px, ctx, t)) return;
  const ex = curEx(), view = viewOf(px), quiet = live.replaying;
  const speak = (...a) => { if (!quiet) say(...a); };
  if (!engine) {
    // Every camera exercise is judged against the lifter's own body map (not the demo athlete's).
    live.P = live.source !== 'demo' ? personalFor(ex.patternKey, S.profile.body) : null;
    // NSCA (TSAC Report 80): with a painful or unstable shoulder, avoid full arm extension in pulldowns.
    const shoulderRehab = S.rehab?.active && COND[S.rehab.active.cond]?.area === 'Shoulder';
    if (shoulderRehab && ex.patternKey === 'vPull') live.P = { ...(live.P || {}), lockElbow: Math.min(live.P?.lockElbow ?? 155, 140), upT: Math.min(live.P?.upT ?? 150, 135) };
    engine = new RepEngine(ex, ex.view === 'either' ? view : ex.view, live.P); fb = new FeedbackCoach();
    live.cleanBase = rewards.lifetimeClean(S.sessions, isHoldId); // reward milestones count from here
  }
  const raw = ex.metrics(px, engine.view), m = { ...raw };
  for (const k of ['knee', 'hip', 'elbow', 'torsoLean', 'heelLift', 'shY', 'hipY']) if (raw[k] != null) m[k] = smooth.push(k, raw[k]);

  // Confidence gate: low-confidence landmarks give wrong angles, so stay quiet instead.
  if (raw.s.conf < 0.55) {
    if (++live.lost === 45) speak('Move back a little. I need to see your whole body.', { id: 'not_visible', priority: 'high' });
    drawPose(ctx, px, { color: 'rgba(237,240,246,.35)' }); if (!quiet) hudFrame(ctx, px, raw.s, t, false); return;
  }
  live.lost = 0;
  if (ex.view !== 'either' && view !== ex.view) { if (++live.wrong === 60) speak(ex.view === 'side' ? 'Turn side-on to the camera for this one.' : 'Face the camera for this one.', { id: 'wrong_view', priority: 'high' }); }
  else live.wrong = 0;

  motion.push(raw.s[ex.track], torsoLen(px));
  if (!quiet) recorder2.push(t, px);
  // Bar speed: scale from the plate (if calibrated) or, for standing lifts, from the lifter's height.
  if (vbtOn()) {
    if (!live.mPerPx && live.standFrames.length < 20) { live.standFrames.push({ px }); if (live.standFrames.length === 20 && STANDING_LIFTS.includes(ex.patternKey)) live.mPerPx = scaleFromHeight(live.standFrames, (S.profile.heightCm || 0) / 100); }
    const p = ex.patternKey === 'squat' ? { y: (px[11].y + px[12].y) / 2 } : raw.s.wr;
    if (p) bar.push(t, p.y, live.mPerPx);
  }
  // Holds (plank): time in position, and time in GOOD position, instead of reps.
  if (ex.hold) {
    const dt = live.lastT ? Math.min(0.2, (t - live.lastT) / 1000) : 0; live.lastT = t;
    const bad = (ex.always || []).some(r => r.test(m));
    live.held = (live.held || 0) + dt; if (!bad) live.goodHeld = (live.goodHeld || 0) + dt;
    const sec = Math.floor(live.held);
    if (sec !== live.lastSec) { live.lastSec = sec; $('#repNum').textContent = sec; if (sec && sec % 10 === 0) speak(`${sec} seconds.${bad ? '' : ' Solid.'}`, { priority: 'low' }); }
    $('#cleanCt').textContent = `${Math.floor(live.goodHeld || 0)} s good`;
  }
  let flagged = false;
  for (const ev of engine.update(m, t)) {
    if (ev.type === 'rep') {
      live.lastRepT = t;
      ev.drift = motion.endRep();
      $('#repNum').textContent = engine.reps;
      flash(ev.faults.length ? 'bad' : 'good');
      const dot = document.createElement('i'); if (ev.faults.length) dot.className = 'f'; $('#dots').appendChild(dot);
      $('#cleanCt').textContent = `${engine.goodReps} clean`;
      $('#vlKnob').style.left = Math.min(100, ev.vl / .5 * 100) + '%';
      $('#vlTxt').textContent = ev.vl < .1 ? 'fresh' : ev.vl < .25 ? `−${Math.round(ev.vl * 100)}%` : `−${Math.round(ev.vl * 100)}% · near failure`;
      if (vbtOn() && live.mPerPx) { const v = bar.closeRep(); if (v) { live.lastV = v; $('#vlTxt').textContent = `${v.mcv.toFixed(2)} m/s`; } }
    }
    if (quiet) continue; // replaying the reps seen while recognising the exercise: count them, don't re-coach
    if (ev.faults.length && ev.type !== 'rep') flagged = true;
    const awaiting = fb.awaitingFix;
    const line = ev.type === 'live' ? fb.onLive(ev.faults[0]) : ev.type === 'rep' ? fb.onRep(ev) : fb.onContinuousFault(ev.faults[0]);
    if (line) say(line.text, line);
    if (ev.type === 'rep') {
      // Rep read-out on the body and a shout at clean-streak milestones. No vibration: the phone is
      // propped up or on the floor, and a buzz can shift it out of position.
      const streak = hud.rep(t, engine.reps, !ev.faults.length);
      const tier = !ev.faults.length && live.source !== 'demo' ? rewards.crossed(live.cleanBase + engine.goodReps - 1, live.cleanBase + engine.goodReps) : null;
      if (tier) { hud.celebrate(t, `${tier.n} clean reps`, tier.name); say(rewards.cheer(tier, S.profile.name), { id: 'tier_' + tier.n, priority: 'now' }); }
      else if (!line && [5, 10, 15, 20].includes(streak)) say(`${streak} clean in a row. That's how it's done.`, { id: 'streak_' + streak, priority: 'low' });
      else if (!line && streak === 3) hud.celebrate(t, '3 clean in a row', 'On fire');
    }
    // On screen, at the same moment as the voice: what's wrong, what to do, and the graphic on the body.
    const cued = line?.id && ev.faults.find(f => line.id === f.id || line.id === f.id + '_short');
    if (line?.id?.startsWith('yes_')) { fx.fixed(awaiting, t); showBanner(awaiting, true); markFault(awaiting, true); }
    else if (cued) { fx.cue(cued, t); showBanner(cued); markFault(cued); }
    else if (ev.type === 'rep' && !ev.faults.length) fx.clean(t);
  }
  if (quiet) return;
  motion.draw(ctx);
  const s = raw.s;
  if (live.badUntil > performance.now()) flagged = true; // skeleton stays red while the fault is on screen
  drawPose(ctx, px, { color: flagged ? '#E46E66' : '#9FD0B6', labels: [{ at: s.kn, value: m.knee }, { at: s.hip, value: m.hip }, ...(ex.primary === 'elbow' ? [{ at: s.el, value: m.elbow }] : [])] });
  if (ex.primary === 'knee') drawDepthArc(ctx, s.kn, s.hip, s.an, m.knee, { start: ex.upT + 10, target: 100 });
  else if (ex.primary === 'elbow') drawDepthArc(ctx, s.el, s.sh, s.wr, m.elbow, { start: ex.upT + 15, target: 95 });
  fx.draw(ctx, px, s, t, { mirror: $('#viewport').classList.contains('mirror') });
  hudFrame(ctx, px, s, t, true);
  const keys = ex.primary === 'elbow' ? ['elbow', 'hip'] : ['hip', 'knee'];
  $('#readout').innerHTML = keys.map(k => `<span>${k} ${fmtA(m[k])}</span>`).join('') + (live.lastV ? `<span>${live.lastV.mcv.toFixed(2)} m/s</span>` : '') + `<span class="muted">${engine.view} view</span>` + (live.P ? '<span class="fit">fit to your body</span>' : '');
}

// What QK says as a set starts: where to put the phone, two short commands, and how to breathe.
// The breathing safety note is said once per app session, the first time a heavy lift starts.
let saidBreathSafety = false;
const LOADED = ['squat', 'rdl', 'lunge', 'bench', 'press', 'row', 'vPull', 'hipThrust', 'dip'];
function setupLine(ex) {
  if (ex.hold) return `${ex.name}. Get into position and hold.`;
  const row = ex.libId ? brief.planRows([ex.libId], { lib: LIB, sets: S.sessions, unit: unit(), light: lightWeek(), schemeFor: programScheme })[0] : null;
  let target = row?.rx ? ' ' + brief.spokenTarget(row, unit()) : '';
  if (row?.rx && !setsToday(ex.libId)) { const wu = warm.warmupSpeech(warm.warmupSets(LIB[ex.libId], row.rx.kg, unit()), unit()); if (wu) target += ' ' + wu; }
  const wk = brief.weekOf(Date.now()), P = (S.prog ||= {});
  if (target && P.briefWeek !== wk) { const sum = brief.summary(planToday().filter(r => r.rx)); if (sum) target = ` New week. ${sum}` + target; P.briefWeek = wk; persist(); }
  const tips = (TIPS[ex.patternKey] || []).map(t => t[0]).join(' ');
  const heavy = LOADED.includes(ex.patternKey);
  const safety = heavy && !saidBreathSafety ? (saidBreathSafety = true, ' ' + BREATHING.safety) : '';
  return `${ex.name}.${target} ${ex.setup} ${tips}${safety} ${heavy ? BREATHING.cue : 'Start when you\'re ready.'}`.replace(/\s+/g, ' ');
}

/* ---------- Camera coach: recognise the exercise, then coach it ---------- */
// While no exercise is known: draw the skeleton with joint angles, feed the detector, keep ~4 s of frames.
// Once recognised: adopt it and replay those frames so the first reps count. Afterwards keep watching:
// if the lifter clearly switches to another exercise (no rep for 5 s and a confident new match), the
// finished set is saved and QK moves on with them.
function autoFrame(px, ctx, t) {
  live.lastFrameT = t; live.ctx = ctx;
  const res = live.det.push(px, t);
  // Always keep the last ~4 s: when the exercise is recognised (or changes), these frames are replayed
  // into the new coach so the reps already done still count.
  live.buf.push({ px, t }); while (live.buf.length && t - live.buf[0].t > 4000) live.buf.shift();
  if (!exKey) {
    recorder2.push(t, px);
    const s = bestSide(px), seen = s.conf >= 0.55;
    drawPose(ctx, px, { color: seen ? '#9FD0B6' : 'rgba(237,240,246,.35)', labels: seen ? [{ at: s.kn, value: angle(s.hip, s.kn, s.an) }, { at: s.hip, value: angle(s.sh, s.hip, s.kn) }, { at: s.el, value: angle(s.sh, s.el, s.wr) }] : [] });
    hudFrame(ctx, px, s, t, seen);
    if (!seen) { if (++live.lost === 45) say('Step back so I can see your whole body, head to feet.', { id: 'not_visible', priority: 'high' }); }
    else live.lost = 0;
    live.searchT ??= t;
    if (t - live.searchT > 10000 && !live.hinted) {
      live.hinted = true; $('#detectTxt').textContent = 'Not sure yet. Try side-on, with a slow full rep.';
      say('I can\'t tell which exercise yet. Turn side-on to the camera and do one slow, full rep. Or tap Change to pick it.', { id: 'det_hint', priority: 'high' });
      $('#detectChange').hidden = false;
    }
    if (res) adoptExercise(res, t, true);
    return true;
  }
  // Switching exercise: as soon as a different exercise is seen with confidence, stop coaching the old
  // one (its rules would misread the new movement), and switch once the old one has had no rep for 3 s.
  if (res) live.other = res.key !== live.detected?.key && res.confidence >= 0.8 ? (live.other?.key === res.key ? live.other : { ...res, since: t }) : null;
  if (live.other) {
    if (t - live.lastRepT > 3000 && t - live.other.since > 600) { const next = live.other; live.other = null; saveQuietSet(); adoptExercise(next, t, true); return true; }
    const s = bestSide(px);
    drawPose(ctx, px, { color: '#9FD0B6', labels: [{ at: s.kn, value: angle(s.hip, s.kn, s.an) }, { at: s.el, value: angle(s.sh, s.el, s.wr) }] });
    $('#detectTxt').textContent = `${live.other.label}?`;
    return true;
  }
  return false;
}

function adoptExercise(res, t, replay) {
  exKey = res.id; live.detected = res; live.lastRepT = t;
  engine = null; fb = null; smooth.reset(); motion.reset(); fx.reset(); hud.streak = 0;
  live.held = 0; live.goodHeld = 0; live.lastT = null; live.lastSec = null; live.wrong = 0;
  const ex = curEx();
  $('#liveEyebrow').textContent = ex.name; $('#liveTitle').textContent = `Set ${setsToday(exKey) + 1}`;
  $('#repLbl').textContent = ex.hold ? 'seconds' : 'reps'; $('#repNum').textContent = '0'; $('#dots').innerHTML = ''; $('#cleanCt').textContent = '0 clean';
  $('#detectChip').classList.add('found'); $('#detectTxt').textContent = `${res.label} ✓`; $('#faultBanner').hidden = true; live.badUntil = 0;
  $('#detectAlt').hidden = !res.alt; if (res.alt) $('#detectAlt').textContent = `Or ${res.alt.label.toLowerCase()}?`;
  $('#detectChange').hidden = false;
  const tip = (TIPS[ex.patternKey] || []).map(t => t[0]).slice(0, 1).join(' ');
  say(`${res.label}. Got it. ${tip} Keep going.`.replace(/\s+/g, ' '), { id: 'det_' + res.key, priority: 'now' });
  if (replay && live.buf.length) {
    const buf = live.buf.slice(); live.replaying = true;
    try { for (const b of buf) formFrame(b.px, live.ctx, b.t); } finally { live.replaying = false; }
  }
}

function saveQuietSet() {
  if (!engine?.reps || !exKey) return;
  const ex = curEx(), reps = engine.reps;
  S.sessions.push({ at: Date.now(), ex: exKey, name: ex.name, reps, good: engine.goodReps, faults: engine.faultTally, vl: engine.velocityLoss(), tempo: engine.tempo, roms: engine.roms.map(r => Math.round(r.rom)), auto: true });
  persist(); live.sets.push(`${ex.name} ${reps}`); toast(`${ex.name}: ${reps} reps saved`);
}

function pickExercise(id) {
  if (!live) return;
  const r = PICK_LIST.find(x => x.id === id) || { key: id, id, label: LIB[id]?.name || id };
  saveQuietSet(); live.det.reset(); adoptExercise(r, live.lastFrameT || 0, false);
}
$('#detectAlt').onclick = () => live?.detected?.alt && pickExercise(live.detected.alt.id);
$('#detectChange').onclick = () => openSheet(`<div><span class="eyebrow">Camera coach</span><h2 class="display h2" id="rsheetTitle" style="margin-top:6px;font-size:1.3rem">Which exercise?</h2></div>
  <div class="pick-grid">${PICK_LIST.map(x => `<button type="button" class="ghost" data-pick="${x.id}">${esc(x.label)}</button>`).join('')}</div>`);
$('#rsheetBody').addEventListener('click', e => { const b = e.target.closest('[data-pick]'); if (!b) return; closeSheet(); pickExercise(b.dataset.pick); });
const startAuto = () => startLive({ mode: 'form', source: DEMO && window.__qkFeed ? 'demo' : 'camera', auto: true });
$('#camCoach').onclick = startAuto; $('#camCoach2').onclick = startAuto;

// A border flash per rep: green clean, red fault. Readable from across the room, unlike numbers.
let flashT;
function flash(kind) { const v = $('#viewport'); v.classList.remove('flash-good', 'flash-bad'); void v.offsetWidth; v.classList.add('flash-' + kind); clearTimeout(flashT); flashT = setTimeout(() => v.classList.remove('flash-' + kind), 450); }

function endSet() {
  if (!live) return;
  if (live.mode === 'guided') return endGuided();
  if (live.auto && !exKey) {
    stopLive(); $('#live').hidden = true; keepAwake(false); live = null;
    return toast('No exercise recognised. Next time stand side-on, whole body in view, and do a slow full rep.');
  }
  const wasRec = recorder && recorder.state !== 'inactive';
  lastSource = live.source;
  const hold = curEx().hold, held = Math.round(live.held || 0), goodHeld = Math.round(live.goodHeld || 0);
  stopLive();
  $('#live').hidden = true; $('#summary').hidden = false;
  $('#scoreRing').parentElement.hidden = false; $('#sTable').hidden = false; $('#romBars').parentElement.hidden = !!hold;
  const ex = curEx(), reps = hold ? held : (engine?.reps || 0), good = hold ? goodHeld : (engine?.goodReps || 0), tally = engine?.faultTally || {};
  const rules = allRules(ex);
  const faults = Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ n, rule: rules.find(r => r.id === id) })).filter(f => f.rule);
  const tempo = engine?.tempo || [], vl = engine?.velocityLoss() || 0, roms = engine?.roms || [];
  const avg = k => tempo.length ? (tempo.reduce((a, t) => a + t[k], 0) / tempo.length).toFixed(1) : '–';
  const prev = [...S.sessions].reverse().find(x => x.ex === exKey);
  const score = reps ? Math.round(good / reps * 100) : 0, prevScore = prev?.reps ? Math.round(prev.good / prev.reps * 100) : null;
  const rs = romSummary(roms), drift = motion.drifts.length ? Math.max(...motion.drifts) : 0;

  $('#sumEyebrow').textContent = `${ex.name} · set ${setsToday(exKey) + 1}`;
  $('#scoreRing').hidden = false;
  $('#sReps').textContent = hold ? `${reps} s` : reps; $('#sClean').textContent = hold ? `${good} s in good position` : `${good} clean`;
  $('#sCompare').textContent = !reps ? 'No reps counted. Check the camera angle in the setup tips.' : prevScore == null ? 'First set logged. Next time you\'ll see your progress here.' : score > prevScore ? `Up from ${prevScore}% last time.` : `Last time: ${prevScore}%.`;
  if (live?.sets?.length) $('#sCompare').textContent += ` Also saved this session: ${live.sets.join(', ')} reps.`;
  const L = 2 * Math.PI * 50;
  $('#scoreRing').innerHTML = `<circle cx="60" cy="60" r="50" fill="none" style="stroke:var(--surface-2)" stroke-width="11"/><circle cx="60" cy="60" r="50" fill="none" stroke="url(#zoneStroke)" stroke-width="11" stroke-linecap="round" stroke-dasharray="${L}" stroke-dashoffset="${L * (1 - score / 100)}" transform="rotate(-90 60 60)"/><text x="60" y="64" text-anchor="middle" style="fill:var(--text)" font-family="Archivo, sans-serif" font-weight="800" font-size="26">${score}%</text><text x="60" y="81" text-anchor="middle" style="fill:var(--muted)" font-family="Figtree, sans-serif" font-size="10">form score</text>`;
  $('#scoreRing').setAttribute('aria-label', `Form score ${score} percent`);
  const top = faults[0]?.rule;
  $('#sFocusBox').hidden = !reps;
  $('#sFocus').textContent = top ? top.cue : 'Nothing to fix. Same again next set.';
  $('#sWhy').textContent = top ? top.why : '';
  $('#romBars').innerHTML = roms.map(r => `<i class="${r.clean ? '' : 'f'}" style="height:${rs.best ? Math.max(6, r.rom / rs.best * 100) : 0}%" title="${Math.round(r.rom)}°"></i>`).join('');
  $('#romNote').textContent = roms.length ? (rs.partial ? `${rs.partial} rep${rs.partial > 1 ? 's were' : ' was'} short of your full range (under 85% of your best ${Math.round(rs.best)}°).` : `Every rep hit full range. Best ${Math.round(rs.best)}°.`) : 'No reps yet.';
  const driftTxt = ['squat', 'rdl'].includes(ex.patternKey) ? `<span>Bar / hip path drift</span><span class="${drift > .25 ? 'hot' : 'ok'}">${Math.round(drift * 100)}% of torso</span>` : '';
  $('#sTable').innerHTML = `<span>Lowering time</span><span>${avg('ecc')} s</span><span>Lifting time</span><span>${avg('con')} s</span>
    <span>Slowing down by the end</span><span class="${vl >= .3 ? 'hot' : ''}">${Math.round(vl * 100)}%</span><span>Reps left in the tank</span><span>${tempo.length >= 3 ? estimateRIR(vl) : '–'}</span>${driftTxt}`;
  renderVBT(ex, reps);
  renderSetReward({ reps, good, hold, demo: live?.source === 'demo' });
  recorder2.finish({ reps, good, faults: tally });
  const rest = restSeconds(ex.patternKey, vl); restLeft = rest; restTotal = rest; drawRest();
  $('#restWhy').textContent = vl >= .3 ? 'Longer, because you went close to failure' : 'Recovery for the next set';
  $('#restCard').hidden = !reps;

  lastSet = null;
  const weighted = WEIGHTED.includes(LIB[exKey]?.equipment), last = lastLoad(S.sessions, exKey);
  $('#repFix').hidden = !reps || !!hold;
  $('#kgWrap').hidden = !reps || !weighted;
  const preKg = parseFloat($('#loadKg').value) ? prog.fromUnit(parseFloat($('#loadKg').value), unit()) : live?.rx?.kg || last?.kg;
  $('#setKg').value = preKg ? +prog.toUnit(preKg, unit()).toFixed(2) : '';
  $('#sNext').hidden = true;
  $('#sLast').textContent = last ? `Last time: ${prog.fmtW(last.kg, unit())} × ${last.reps}` : '';
  if (reps) {
    const kg = weighted && parseFloat($('#setKg').value) > 0 ? prog.fromUnit(parseFloat($('#setKg').value), unit()) : undefined;
    const rx = live?.rx;
    S.sessions.push(lastSet = { at: Date.now(), ex: exKey, name: ex.name, reps, good, faults: tally, vl, tempo, roms: roms.map(r => Math.round(r.rom)), kg, demo: live?.source === 'demo' || undefined,
      ...(rx ? { target: rx.reps, mode: rx.mode === 'wave' ? 'wave' : undefined, wave: rx.day, rxKg: rx.kg } : {}) });
    logProgramDay(exKey);
    showNext(); setTimeout(() => syncNow?.(), 2000);
    persist();
    const better = prevScore != null && score > prevScore ? ` Your form score is up from ${prevScore} to ${score} percent.` : '';
    say(`Set done. ${reps} reps, ${good} clean.${better} ${top ? 'One thing for next set: ' + top.cue : 'Great form. Keep it up.'}`, { id: 'summary_' + Date.now(), priority: 'high' });
  }
  if (reps) { stopRest(); $('#restBtn').click(); } // rest starts by itself
  showFlowNext();
  const pb = $('#playback'); pb.hidden = true;
  const marks = live?.marks || [], fm = $('#faultMarks'); fm.hidden = true;
  if (wasRec) setTimeout(() => {
    if (!chunks.length) return; pb.src = URL.createObjectURL(new Blob(chunks, { type: chunks[0].type || 'video/webm' })); pb.hidden = false;
    if (marks.length) {
      const mmss = x => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}`;
      fm.innerHTML = `<span class="eyebrow">Watch it back · ${marks.filter(m => !m.ok).length} correction${marks.filter(m => !m.ok).length === 1 ? '' : 's'}</span>` +
        marks.map(m => `<button type="button" class="${m.ok ? 'ok' : ''}" data-seek="${m.t}"><span class="data">${mmss(m.t)}</span><span><b>${esc(m.label)}</b>${m.fix ? `<br><span class="muted small">${esc(m.fix)}</span>` : ''}</span></button>`).join('');
      fm.hidden = false;
      fm.onclick = e => { const b = e.target.closest('[data-seek]'); if (!b) return; pb.currentTime = Math.max(0, +b.dataset.seek - 1.5); pb.play(); pb.scrollIntoView({ block: 'center', behavior: 'smooth' }); };
    }
  }, 400);
  live = null;
}

function stopLive() {
  cancelAnimationFrame(raf);
  if (recorder && recorder.state !== 'inactive') recorder.stop();
  stream?.getTracks().forEach(t => t.stop()); stream = null;
  const v = $('#video'); v.pause();
  $('#countdown').hidden = true;
  if (live) live.done = true;
}

const showAngles = () => { try { return localStorage.getItem('qk_angles') === '1'; } catch { return false; } };
$('#readout').hidden = !showAngles();
$('#anglesBtn').onclick = () => { const on = !showAngles(); try { localStorage.setItem('qk_angles', on ? '1' : '0'); } catch {} $('#readout').hidden = !on; $('#anglesBtn').textContent = on ? 'Hide angles' : 'Angles'; };
$('#anglesBtn').textContent = showAngles() ? 'Hide angles' : 'Angles';
$('#endLive').onclick = () => { if (!live) return; ['gait', 'jump', 'sls', 'rom'].includes(live.mode) ? finishTest() : endSet(); };
$('#flipCam').onclick = () => { const m = live?.mode || 'form'; live && (live.done = true); facing = facing === 'user' ? 'environment' : 'user'; stopLive(); live = null; startLive({ mode: m, source: 'camera' }); };
$('#doneBtn').onclick = () => { flow = null; stopRest(); keepAwake(false); $('#summary').hidden = true; tab('today'); };
// After a camera set the phone is already placed, so the next set starts straight away.
$('#nextSet').onclick = () => { if (flow) return nextInFlow(); stopRest(); $('#summary').hidden = true; if (lastSource === 'camera' && curEx()) startLive({ mode: 'form', source: 'camera' }); else openSetup(exKey); };
// Fix a miscount. The form score then leaves this set out, because the camera didn't see the added reps.
function fixReps(d) {
  if (!lastSet) return;
  lastSet.reps = Math.max(1, lastSet.reps + d); lastSet.good = Math.min(lastSet.good, lastSet.reps); lastSet.edited = true;
  $('#sReps').textContent = lastSet.reps; $('#sCompare').textContent = 'Count corrected. This set is left out of your form score.';
  persist();
}
$('#repMinus').onclick = () => fixReps(-1);
$('#repPlus').onclick = () => fixReps(1);
$('#setKg').onchange = e => { if (!lastSet) return; const v = parseFloat(e.target.value); lastSet.kg = v > 0 ? prog.fromUnit(v, unit()) : undefined; persist(); showNext(); };

let restLeft = 120, restTotal = 120, restTimer = null;
function drawRest() { $('#restClock').textContent = `${Math.floor(restLeft / 60)}:${String(restLeft % 60).padStart(2, '0')}`; $('#restArc').style.strokeDashoffset = 201 * (1 - restLeft / restTotal); }
function stopRest() { clearInterval(restTimer); restTimer = null; $('#restBtn').textContent = 'Start'; }
$('#restBtn').onclick = () => {
  if (restTimer) return stopRest();
  $('#restBtn').textContent = 'Pause';
  restTimer = setInterval(() => {
    restLeft = Math.max(0, restLeft - 1); drawRest();
    if (restLeft === 10) say('Ten seconds. Get set up.', { id: 'rest10_' + Date.now(), priority: 'high' });
    if (restLeft === 0) { stopRest(); restLeft = restTotal; if (flow && !$('#summary').hidden) return nextInFlow(); say('Rest over. Let\'s go again.', { id: 'rest0_' + Date.now(), priority: 'high' }); }
  }, 1000);
};

/* ---------- Tempo coach (voice-only, no camera) ---------- */
// Used where a phone camera can't judge the movement. QK paces a controlled tempo
// (3 s lowering, 1 s pause, 1 s lifting) or times a hold — no form score is invented.
function startGuided() {
  const item = LIB[exKey], mode = coachOf(item);
  const target = mode === 'hold' ? item.hold || 10 : mode === 'timer' ? (item.mins || 20) * 60 : mode === 'intervals' ? item.rounds : mode === 'stopwatch' ? 0 : item.reps || 10;
  $('#setup').hidden = true; $('#summary').hidden = true; $('#live').hidden = false;
  live = { mode: 'guided', coach: mode, source: 'voice', done: false, reps: 0, secs: 0, timers: [], target };
  $('#formMeters').hidden = true; $('#gaitMeters').hidden = true; $('#repBig').hidden = false; $('#cueHint').hidden = true; $('#detectChip').hidden = true;
  $('#flipCam').hidden = true; $('#readout').innerHTML = ''; $('#status').textContent = ''; $('#recBadge').hidden = true;
  $('#video').hidden = true; const c = $('#overlay'); c.getContext('2d').clearRect(0, 0, c.width, c.height);
  $('#tempoRing').hidden = false; $('#tempoWord').textContent = 'Get set';
  $('#liveEyebrow').textContent = item.name; $('#liveTitle').textContent = COACH[mode].title;
  $('#endLive').textContent = mode === 'stopwatch' ? 'Finish' : 'End';
  say(`${item.name}. ${item.guide}`, { id: 'guide_' + Date.now(), priority: 'high' });
  const T = (fn, ms) => live.timers.push(setTimeout(() => { if (live && !live.done) fn(); }, ms));
  const word = w => { $('#tempoWord').textContent = w; };
  const big = (v, lbl) => { $('#repNum').textContent = v; $('#repLbl').textContent = lbl; };

  if (mode === 'hold') {
    let left = target; big(target, 'seconds left');
    T(function tick() {
      if (left === target) { word('Hold'); say('Go. Hold it.', { id: 'hold_go', priority: 'high' }); }
      $('#repNum').textContent = left; live.reps = target - left;
      if (left === Math.floor(target / 2)) say('Halfway. Breathe.', { id: 'hold_half', priority: 'high' });
      if (left === 10 && target > 15) say('Ten seconds left.', { id: 'hold_10', priority: 'high' });
      if (left <= 3 && left > 0) say(String(left), { priority: 'low' });
      if (left === 0) { live.reps = target; return endGuided(); }
      left--; T(tick, 1000);
    }, 5000);
  } else if (mode === 'timer') {
    // A session timer: time left on screen, a voice update every 5 minutes and for the last minute.
    let left = target; big(mmss(left), 'left');
    T(function tick() {
      if (left === target) { word('Go'); say('Go. Settle into your pace.', { id: 'timer_go', priority: 'high' }); }
      $('#repNum').textContent = mmss(left); live.secs = target - left;
      const m = left / 60;
      if (left !== target && left % 300 === 0 && left > 60) say(`${m} minutes left.`, { id: 'timer_' + left, priority: 'high' });
      if (left === Math.floor(target / 2) && target >= 600) say('Halfway.', { id: 'timer_half', priority: 'high' });
      if (left === 60) say('Last minute.', { id: 'timer_60', priority: 'high' });
      if (left === 0) { live.secs = target; return endGuided(); }
      left--; T(tick, 1000);
    }, 4000);
  } else if (mode === 'intervals') {
    // Work / rest rounds, with "Go", "Rest" and a 3-2-1 before each switch.
    let round = 0, phase = 'rest', left = 4; big('1', `of ${target} rounds`);
    T(function tick() {
      if (left <= 3 && left > 0) say(String(left), { priority: 'low' });
      if (left === 0) {
        if (phase === 'rest') {
          if (round >= target) { live.reps = round; return endGuided(); }
          round++; phase = 'work'; left = item.work; word('Go'); say(round === target ? 'Last round. Go!' : 'Go!', { id: 'int_go_' + round, priority: 'now' });
        } else {
          phase = 'rest'; left = item.rest; word('Rest'); live.reps = round;
          if (round >= target) { left = 0; return endGuided(); }
          say(`Rest. ${target - round} to go.`, { id: 'int_rest_' + round, priority: 'now' });
        }
        $('#repNum').textContent = round;
      }
      $('#tempoWord').textContent = `${phase === 'work' ? 'Go' : 'Rest'} ${mmss(left)}`;
      live.secs += phase === 'work' ? 1 : 0; left--; T(tick, 1000);
    }, 1000);
  } else if (mode === 'stopwatch') {
    // Counts up until the lifter taps Finish; the time is what gets saved.
    big('0:00', 'time');
    T(() => { word('Go'); say('Three, two, one, go!', { id: 'sw_go', priority: 'now' }); live.t0 = performance.now();
      T(function tick() { live.secs = Math.round((performance.now() - live.t0) / 1000); $('#repNum').textContent = mmss(live.secs);
        if (live.secs && live.secs % 60 === 0) say(`${live.secs / 60} minute${live.secs > 60 ? 's' : ''}.`, { id: 'sw_' + live.secs, priority: 'low' });
        T(tick, 1000); }, 1000); }, 3000);
  } else if (mode === 'explosive' || mode === 'mobility') {
    // Explosive: "Set", then "Go", with time to reset fully between reps. Mobility: slow counted reps.
    const gap = (item.gap || (mode === 'mobility' ? 3 : 5)) * 1000; big(0, `of ${target} reps`);
    const rep = () => {
      if (mode === 'explosive') { word('Set'); T(() => { word('Go!'); say('Go!', { priority: 'now' }); }, 1200); }
      else word(item.kind === 'pilates' ? 'Control' : 'Reach');
      T(() => {
        live.reps++; $('#repNum').textContent = live.reps;
        if (mode === 'mobility') say(String(live.reps), { priority: 'low' });
        if (live.reps >= target) T(endGuided, 900); else { word('Reset'); T(rep, mode === 'explosive' ? gap - 1200 : 400); }
      }, mode === 'explosive' ? 1700 : gap);
    };
    T(rep, 4000);
  } else {
    big(0, `of ${target} reps`);
    const rep = () => {
      word('Down'); say('Down', { priority: 'low' });
      T(() => word('2'), 1000); T(() => word('3'), 2000);
      T(() => word('Pause'), 3000);
      T(() => { word('Up'); say('Up', { priority: 'low' }); }, 4000);
      T(() => {
        live.reps++; $('#repNum').textContent = live.reps;
        say(live.reps === target - 2 ? 'Two more. Stay controlled.' : String(live.reps), { priority: live.reps === target - 2 ? 'high' : 'low' });
        if (live.reps >= target) T(endGuided, 900); else T(rep, 1000);
      }, 5000);
    };
    T(rep, 5000);
  }
}

function endGuided() {
  if (!live) return;
  live.timers.forEach(clearTimeout);
  const item = LIB[exKey], reps = live.reps, secs = live.secs, mode = live.coach, hold = mode === 'hold', timed = mode === 'timer' || mode === 'stopwatch';
  stopLive(); live = null;
  $('#live').hidden = true; $('#tempoRing').hidden = true; $('#summary').hidden = false;
  $('#sumEyebrow').textContent = `${item.name} · set ${setsToday(exKey) + 1}`;
  $('#scoreRing').hidden = true; $('#romBars').parentElement.hidden = true; $('#sTable').hidden = true;
  $('#sReps').textContent = timed ? mmss(secs) : hold ? `${reps} s` : reps;
  $('#sClean').textContent = timed ? (mode === 'stopwatch' ? 'your time' : 'time done') : mode === 'intervals' ? `rounds · ${mmss(secs)} of work` : 'coached by voice';
  const prevTime = mode === 'stopwatch' ? [...S.sessions].reverse().find(x => x.ex === exKey && x.secs) : null;
  $('#sCompare').textContent = prevTime ? (secs < prevTime.secs ? `${mmss(prevTime.secs - secs)} faster than last time (${mmss(prevTime.secs)}).` : `Last time: ${mmss(prevTime.secs)}.`) : 'Voice-coached. No camera form score for this one.';
  $('#sFocusBox').hidden = false; $('#sFocus').textContent = item.guide; $('#sWhy').textContent = '';
  restLeft = restTotal = item.muscles.includes('Full body') || ['Quads', 'Hamstrings', 'Back', 'Chest'].includes(item.muscles[0]) ? 120 : 75; drawRest();
  $('#restWhy').textContent = 'Recovery for the next set'; $('#restCard').hidden = !reps || timed || mode === 'intervals';
  $('#playback').hidden = true;
  const done = timed ? secs >= 10 : reps > 0;
  if (done) { S.sessions.push({ at: Date.now(), ex: exKey, name: item.name, reps: timed ? 0 : reps, secs: secs || undefined, good: 0, guided: true, kind: item.kind }); persist(); logProgramDay(exKey); }
  say(!done ? 'Ended.' : timed ? `Done. ${Math.floor(secs / 60)} minutes ${secs % 60} seconds.` : mode === 'intervals' ? `Done. ${reps} rounds. Great work.` : `Set done. ${hold ? reps + ' seconds' : reps + ' reps'}. Nice work.`, { id: 'gsum_' + Date.now(), priority: 'high' });
  // In a workout, rest runs by itself (when there's rest) and QK moves on; otherwise show what's next.
  if (flow) { showFlowNext(); if (done && !$('#restCard').hidden) { stopRest(); $('#restBtn').click(); } }
}

/* ---------- Movement tests: gait, jump, single-leg squat ---------- */
let gaitMode = 'walk', testMode = 'gait';
// What QK says and shows for each body-map step.
const BM_STEP = {
  stand: ['', 'Stand still, side-on'],
  toes: ['Rise up onto your toes as high as you can, and hold.', 'Up on your toes'],
  squat: ['Now three slow squats. As deep as is comfortable, heels down.', '3 slow squats'],
  reach: ['Stand tall and reach both arms straight up, as high as you can.', 'Arms overhead'],
  hinge: ['Soft knees. Slide your hands down your thighs as far as you can with a flat back, then stand. Twice.', '2 slow hinges'],
  face: ['Now turn and face me. Stand still.', 'Face the camera'],
  arms: ['Raise your arms out to the sides and up, as high as you can.', 'Arms out and up'],
  fsquat: ['Two more slow squats, facing me.', '2 slow squats, facing me'],
};
const TEST = {
  gait: { secs: 10, label: 'Record 10 seconds', minFps: 25, view: null, intro: () => gaitMode === 'run' ? 'Start running at an easy pace. Recording starts after the countdown.' : 'Walk naturally. Recording starts after the countdown.' },
  jump: { secs: 15, label: 'Record jumps (15 s)', minFps: 50, view: 'side', intro: () => 'Hands on hips. Stand still for a second, then jump as high as you can. Three jumps with a short rest.' },
  bodymap: { secs: 62, label: 'Map my body', minFps: 15, view: null, intro: () => 'Let\'s map your body. Stand side-on to me, whole body in view, arms by your sides, and stay still.',
    // [seconds, step]. The demo athlete runs a faster timeline (BODYMAP_DEMO_STEPS in demo.js).
    steps: demo => demo ? BODYMAP_DEMO_STEPS : [[0, 'stand'], [5, 'toes'], [10, 'squat'], [25, 'reach'], [31, 'hinge'], [41, 'face'], [45, 'arms'], [51, 'fsquat']] },
  sls: { secs: 30, label: 'Record knee test (30 s)', minFps: 25, view: 'front', intro: () => 'Stand on your left leg and do five slow squats.' },
};
$$('[data-gmode]').forEach(b => b.onclick = () => { gaitMode = b.dataset.gmode; $$('[data-gmode]').forEach(x => x.classList.toggle('on', x === b)); });
$$('[data-test]').forEach(b => b.onclick = () => {
  testMode = b.dataset.test;
  $$('[data-test]').forEach(x => x.classList.toggle('on', x === b));
  $$('[data-panel]').forEach(p => p.hidden = p.dataset.panel !== testMode);
  $('#testLiveLbl').textContent = TEST[testMode].label;
  $('#gaitDemo').hidden = !DEMO || testMode !== 'gait';
  $('#gaitResult').hidden = true; renderTestHistory();
});
/* ---------- Map my body ---------- */
$('#bodyMapTile').onclick = () => S.profile.body?.ok ? showBodyMap(S.profile.body) : showBodyMapIntro();
function showBodyMapIntro() {
  openSheet(`<div><span class="eyebrow">1 minute · on camera</span><h2 class="display h2" id="rsheetTitle" style="margin-top:6px;font-size:1.3rem">Map my body</h2></div>
    <p class="muted" style="margin:0">Everyone's built differently. Long thighs need more forward lean, tight hamstrings limit a hinge, and some elbows never fully straighten. QK measures yours, then judges every exercise against <b>your</b> body instead of one textbook number.</p>
    <ol class="steps"><li>Phone at hip height, 2–3 metres away. Whole body in view.</li><li>Side-on: stand still, rise onto your toes, 3 slow squats, reach overhead, 2 slow hinges.</li><li>Facing the camera: stand still, arms out and up, 2 slow squats. QK talks you through each step.</li></ol>
    <button class="cta" type="button" data-bm="start">Start (1 min)</button>
    <div class="btn-row">${DEMO ? '<button class="ghost" type="button" data-bm="demo">Watch a demo</button>' : ''}<button class="ghost" type="button" data-bm="close">Not now</button></div>`);
}
function startBodyMap(demo) { closeSheet(); $('#setup').hidden = true; startLive({ mode: 'bodymap', source: demo ? 'demo' : 'camera' }); }
function renderBodyMapTile() {
  const b = S.profile.body;
  $('#bodyMapTitle').textContent = b?.ok ? 'Your body map' : 'Map my body';
  $('#bodyMapSub').textContent = b?.ok ? (b.v >= 2 ? `Mapped ${new Date(b.at).toLocaleDateString()}. Every exercise is judged against your proportions and mobility.` : 'Re-map (1 min) so QK can fit every exercise to you, not just squats.') : 'One minute on camera. QK learns your proportions and mobility, then judges every exercise against your body, not a textbook.';
}
function finishBodyMap(frames, demo) {
  const b = analyseBodyMap(frames);
  tab('body');
  if (!b.ok) {
    say(b.issues[0], { id: 'bm_fail_' + Date.now(), priority: 'high' });
    return openSheet(`<div><span class="eyebrow">Map my body</span><h2 class="display h2" id="rsheetTitle" style="margin-top:6px;font-size:1.3rem">Let's try that again</h2></div><p class="muted" style="margin:0">${esc(b.issues[0])}</p><div class="btn-row"><button class="ghost" type="button" data-bm="close">Not now</button><button class="cta" type="button" data-bm="again">Try again</button></div>`);
  }
  b.demo = demo || undefined;
  if (!demo) { S.profile.body = b; persist(); renderBodyMapTile(); }
  const P = personalFor('squat', b), fixes = explainBodyMap(b).filter(x => x.fix);
  say(`Body mapped. ${demo ? 'This is a demo lifter. ' : ''}From now on I'll judge every exercise against your own body. ${P.sqLean > 50 ? 'You have long thighs, so leaning forward more is normal for you.' : ''} ${fixes.length ? 'One thing to work on: ' + fixes[0].title.toLowerCase() + '.' : ''}`, { id: 'bm_done_' + Date.now(), priority: 'high' });
  showBodyMap(b);
}
function showBodyMap(b) {
  const P = personalFor('squat', b), find = explainBodyMap(b);
  // Which exercises it changed, grouped by movement, so the lifter sees it applies everywhere.
  const GROUPS = [['squat', 'Squats'], ['lunge', 'Lunges'], ['rdl', 'Hinges'], ['bench', 'Bench'], ['pushUp', 'Push-ups'], ['press', 'Overhead press'], ['dip', 'Dips'], ['triExt', 'Triceps'], ['curl', 'Curls'], ['row', 'Rows'], ['vPull', 'Pull-downs'], ['raise', 'Raises'], ['calf', 'Calf raises'], ['legRaise', 'Leg raises'], ['kneeExt', 'Leg extension'], ['kneeFlex', 'Leg curl'], ['hipThrust', 'Hip thrust'], ['plank', 'Plank']];
  const changed = GROUPS.map(([k, n]) => [n, fitLines(k, b)]).filter(([, l]) => l.length);
  openSheet(`<div><span class="eyebrow">${b.demo ? 'Demo lifter · not saved' : 'Your body map'}</span><h2 class="display h2" id="rsheetTitle" style="margin-top:6px;font-size:1.3rem">QK now coaches your body</h2></div>
    <div class="bm-grid">
      <div><span class="num">${b.femurTorso}</span><small>thigh : torso</small></div>
      <div><span class="num">${b.kneeMin}°</span><small>your best depth</small></div>
      <div><span class="num">${b.shinAtDepth}°</span><small>ankle bend</small></div>
      ${b.hingeMin != null ? `<div><span class="num">${b.hingeMin}°</span><small>hinge</small></div>` : ''}
      ${b.shoulderFlex != null ? `<div><span class="num">${b.shoulderFlex}°</span><small>overhead reach</small></div>` : ''}
      ${b.elbowStraight != null ? `<div><span class="num">${b.elbowStraight}°</span><small>elbow straight</small></div>` : ''}
    </div>
    <div class="card stack" style="padding:12px 14px;gap:8px"><span class="eyebrow">Fitted to you · ${changed.length} movement${changed.length === 1 ? '' : 's'}</span>${changed.map(([n, l]) => `<div><b class="small">${esc(n)}</b>${l.map(x => `<div class="muted small">${esc(x)}</div>`).join('')}</div>`).join('') || '<span class="muted small">Your body matches the standard limits for every movement.</span>'}<span class="muted small">Every other limit stays at the standard, which already suits your body.</span></div>
    ${find.map(f => `<div class="bm-find ${f.fix ? 'fix' : ''}"><b>${esc(f.title)}</b><span class="muted small">${esc(f.detail)}</span></div>`).join('')}
    <p class="muted small" style="margin:0">Re-map every few weeks: as your mobility improves, QK raises the bar with you.</p>
    <div class="btn-row"><button class="ghost" type="button" data-bm="again">${b.demo ? 'Map my body' : 'Re-map'}</button><button class="cta" type="button" data-bm="close">Done</button></div>`);
}
$('#rsheetBody').addEventListener('click', e => { const b = e.target.closest('[data-bm]'); if (!b) return; const a = b.dataset.bm; if (a === 'again') showBodyMapIntro(); else if (a === 'start') startBodyMap(); else if (a === 'demo') startBodyMap(true); else closeSheet(); });
renderBodyMapTile();

$('#testLive').onclick = () => startLive({ mode: testMode, source: 'camera' });
$('#gaitDemo').onclick = () => startLive({ mode: 'gait', source: 'demo' });
$('#gaitFile').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) startLive({ mode: testMode, source: 'file', file: f }); };
const footTrails = { L: new MotionTracker(40), R: new MotionTracker(40) };

function testFrame(px, ctx, t) {
  live.frames.push({ t, px }); recorder2.push(t, px);
  if (live.mode === 'gait') { footTrails.L.push(px[31], 1); footTrails.R.push(px[32], 1); footTrails.L.draw(ctx); footTrails.R.draw(ctx); }
  drawPose(ctx, px, { color: '#9FD0B6' });
  const cfg = TEST[live.mode], el = (t - (live.source === 'file' ? 0 : live.t0)) / 1000;
  if (live.mode === 'bodymap' && live.source !== 'file') {
    const steps = cfg.steps(live.source === 'demo'), i = steps.filter(x => el >= x[0]).length - 1, [line, label] = BM_STEP[steps[i][1]];
    if (i !== live.step) { live.step = i; $('#liveTitle').textContent = `Step ${i + 1} of ${steps.length} · ${label}`; if (line) say(line, { id: 'bm_' + steps[i][1], priority: 'now' }); }
    $('#gProg').style.width = Math.min(100, el / (live.source === 'demo' ? BODYMAP_SECS : cfg.secs) * 100) + '%';
    if (el >= (live.source === 'demo' ? BODYMAP_SECS : cfg.secs)) return finishTest();
    $('#gSteps').textContent = Math.round(el) + ' s';
    return;
  }
  if (live.source !== 'file') {
    $('#gProg').style.width = Math.min(100, el / cfg.secs * 100) + '%';
    if (live.mode === 'sls' && el >= cfg.secs / 2 && !live.switched) { live.switched = true; say('Switch. Now your right leg, five slow squats.', { id: 'sls_switch', priority: 'high' }); }
    if (el >= cfg.secs) return finishTest();
  } else { const v = $('#video'); $('#gProg').style.width = (v.duration ? v.currentTime / v.duration * 100 : 0) + '%'; }
  if (live.mode === 'gait') {
    const sg = Math.sign(px[27].x - px[28].x);
    if (live.lastSign && sg && sg !== live.lastSign) $('#gSteps').textContent = ++live.steps;
    if (sg) live.lastSign = sg;
  } else $('#gSteps').textContent = Math.round(el) + ' s';
}

function finishTest() {
  if (!live) return;
  const { frames, mode, source } = live, demo = source === 'demo';
  const w = $('#overlay').width, h = $('#overlay').height;
  stopLive(); $('#live').hidden = true; live = null;
  footTrails.L.reset(); footTrails.R.reset();
  const cfg = TEST[mode];
  // Quality gate first: a bad recording gives a bad answer, so say what to fix instead.
  const q = demo ? { ok: true, score: 100, issues: [], fps: 30 } : assessQuality(frames, { w, h, minFps: cfg.minFps, view: cfg.view, viewOf, joints: mode === 'jump' ? [23, 24, 25, 26, 27, 28, 29, 30, 31, 32] : undefined });
  if (mode === 'rom') { recorder2.finish({ mode, quality: q }); return finishRom(frames, q); }
  if (mode === 'bodymap') { recorder2.finish({ mode, quality: q }); return finishBodyMap(frames, demo); }
  const mPerPx = scaleFromHeight(frames.slice(0, 20), (S.profile.heightCm || 0) / 100);
  const r = mode === 'gait' ? analyseGait(frames, { mode: gaitMode }) : mode === 'jump' ? analyseJumps(frames, { mPerPx }) : analyseSingleLegSquat(frames);
  recorder2.finish({ mode, quality: q, result: summarise(mode, r) });
  const box = $('#gaitResult'); box.hidden = false;
  const qHTML = qualityHTML(q);
  const fail = msg => { box.innerHTML = `${qHTML}<div class="card"><b>No result yet</b><p class="muted small" style="margin:6px 0 0">${esc(msg)}</p></div>`; say(msg, { id: 'test_fail_' + Date.now(), priority: 'high' }); tab('gait'); };
  if (q.score < 40) return fail('The recording quality was too low for an accurate result. ' + (q.issues[0] || ''));
  if (mode === 'gait') {
    if (!r.ok) return fail(r.reason);
    const speed = parseFloat($('#tmSpeed').value);
    if (speed > 0 && r.cadence) r.strideCm = Math.round((speed / 3.6) / (r.cadence / 120) * 100); // stride length = speed ÷ strides per second
    if (!demo) { S.gaits.push({ at: Date.now(), mode: r.mode, view: r.view, cadence: r.cadence, strideCm: r.strideCm, findings: r.findings.map(f => f.title), quality: q.score }); persist(); }
    box.innerHTML = qHTML + gaitHTML(r, demo);
    const issues = r.findings.filter(f => !f.ok);
    say(issues.length ? `Gait check done. ${Math.round(r.cadence)} steps a minute. The main thing I noticed: ${issues[0].title}. Your fixes are below.` : `Gait check done. ${Math.round(r.cadence)} steps a minute, and your left and right sides are well matched.`, { id: 'gait_done_' + Date.now(), priority: 'high' });
  } else if (mode === 'jump') {
    if (!r.ok) return fail(r.issues[0] || 'No jump detected.');
    S.jumps ||= [];
    const hist = S.jumps.map(j => j.cm), ready = jumpReadiness(r.best.heightCm, hist);
    if (!demo) { S.jumps.push({ at: Date.now(), cm: r.best.heightCm, fps: r.fps, quality: q.score }); persist(); }
    box.innerHTML = qHTML + jumpHTML(r, ready);
    say(`Best jump ${Math.round(r.best.heightCm)} centimetres.${ready ? ready.status === 'ready' ? ' You\'re ready to train hard today.' : ` That's ${Math.abs(ready.pct)} percent below your usual, so keep today lighter.` : ''}`, { id: 'jump_done_' + Date.now(), priority: 'high' });
  } else {
    if (!r.ok) return fail(r.issues[0] || 'No single-leg squats found.');
    S.knees ||= [];
    if (!demo) { const kt = { at: Date.now(), L: r.legs.L?.meanFppa ?? null, R: r.legs.R?.meanFppa ?? null, quality: q.score }; S.knees.push(kt); if (S.rehab?.active) S.rehab.active.kneeTests.push(kt); persist(); }
    box.innerHTML = qHTML + slsHTML(r);
    const issues = r.findings.filter(f => !f.ok);
    say(issues.length ? `Knee test done. ${issues[0].title}. I've added the fixes below.` : 'Knee test done. Good knee control on both legs.', { id: 'sls_done_' + Date.now(), priority: 'high' });
  }
  tab('gait'); renderTestHistory(); box.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const summarise = (mode, r) => mode === 'gait' ? { cadence: r.cadence, findings: r.findings?.map(f => f.title) } : mode === 'jump' ? { best: r.best, n: r.jumps?.length } : { legs: r.legs, asymmetry: r.asymmetry };
function qualityHTML(q) {
  const cls = q.score >= 80 ? '' : q.score >= 60 ? 'mid' : 'low';
  return `<div class="card stack"><div class="quality"><span class="q ${cls}">Quality ${q.score}/100</span><span class="muted">${q.fps ? q.fps + ' fps · ' : ''}${q.issues.length ? 'see tips below' : 'good recording'}</span></div>${q.issues.length ? `<ul class="issues">${q.issues.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}</div>`;
}
const findingsHTML = fs => `<div class="stack">${fs.map(f => `<div class="finding ${f.ok ? 'ok' : ''}"><b>${esc(f.title)}</b><p>${esc(f.why)}</p>${f.fix.length ? `<div class="fixes">${f.fix.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : ''}</div>`).join('')}</div>`;
function jumpHTML(r, ready) {
  return `<div class="card stack"><span class="eyebrow">Best jump · ${r.jumps.length} jump${r.jumps.length > 1 ? 's' : ''} · ${r.fps} fps</span>
    <div class="big-result">${r.best.heightCm.toFixed(1)}<small>cm</small></div>
    <span class="muted small">Precision about ±${r.precisionCm} cm at this frame rate${r.fps < 100 ? '. Film in slow-motion for ±1 cm.' : '.'}</span>
    <div class="kv">${r.jumps.map((j, i) => `<span>Jump ${i + 1}</span><span>${j.heightCm.toFixed(1)} cm · ${j.flightMs} ms${j.flagged ? ' ⚠' : ''}</span>`).join('')}
    ${ready ? `<span>Readiness vs your usual</span><span class="${ready.status === 'ready' ? 'ok' : 'hot'}">${ready.pct > 0 ? '+' : ''}${ready.pct}% · ${ready.status}</span>` : ''}</div>
    ${r.jumps.some(j => j.flagged) ? `<p class="muted small" style="margin:0">⚠ ${esc(r.jumps.find(j => j.flagged).flagged)}</p>` : ''}
    ${r.issues.length ? `<ul class="issues">${r.issues.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}</div>`;
}
function slsHTML(r) {
  const leg = (n, d) => d ? `<div class="metric ${d.meanFppa > 10 ? 'warn' : ''}"><small>${n} knee</small><span class="num">${d.meanFppa}°</span><small>inward drift · ${d.reps} reps · hip drop ${d.pelvicDrop}°</small></div>` : `<div class="metric warn"><small>${n} knee</small><span class="num">–</span><small>not recorded</small></div>`;
  return `<div class="card stack"><span class="eyebrow">Single-leg squat · front view</span>
    <div class="metric-grid">${leg('Left', r.legs.L)}${leg('Right', r.legs.R)}</div>
    ${r.asymmetry != null ? `<span class="muted small">Left/right difference ${r.asymmetry}°. Screening thresholds: drift over 10° or a difference over 5°.</span>` : ''}</div>
    ${findingsHTML(r.findings)}<p class="muted small" style="margin:0">A screen, not a diagnosis. Pain or a past knee injury? See a physio.</p>`;
}
function renderTestHistory() {
  const rows = testMode === 'gait' ? (S.gaits || []).map(g => [g.at, `${Math.round(g.cadence)} steps/min${g.strideCm ? ` · stride ${g.strideCm} cm` : ''}`])
    : testMode === 'jump' ? (S.jumps || []).map(j => [j.at, `${j.cm.toFixed(1)} cm`])
    : (S.knees || []).map(k => [k.at, `L ${k.L ?? '–'}° · R ${k.R ?? '–'}°`]);
  $('#testHistory').hidden = !rows.length;
  $('#testHistoryList').innerHTML = rows.slice(-6).reverse().map(([at, t]) => `<div class="row"><div>${t}</div><time>${new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</time></div>`).join('');
}

function gaitHTML(r, demo) {
  const metric = m => `<div class="metric ${m.ok ? '' : 'warn'}"><small>${esc(m.label)}</small><span class="num">${esc(m.value)}</span><small>${esc(m.unit)} · typical ${esc(m.norm)}</small></div>`;
  return `<div class="card stack">
      <div class="card-head" style="margin:0"><div><span class="eyebrow">${r.view === 'side' ? 'Side view' : 'Front view'} · ${r.mode === 'run' ? 'running' : 'walking'}${demo ? ' · demo' : ''}</span><h2 class="display h2">${Math.round(r.cadence)} steps/min</h2>${r.strideCm ? `<span class="muted small">Stride length ${r.strideCm} cm (from treadmill speed)</span>` : ''}</div><span class="chip-note">${r.steps} steps</span></div>
      <div class="metric-grid">${r.metrics.map(metric).join('')}</div>
    </div>
    ${r.curves?.L?.length ? `<div class="card gait-chart stack"><span class="eyebrow">Knee bend through one stride</span>${kneeChart(r.curves, r.mode)}
      <div class="legend-inline"><span><i style="background:var(--z1)"></i>Left</span><span><i style="background:var(--z3)"></i>Right</span><span><i style="background:rgba(var(--z2-rgb),.35);height:8px"></i>Typical range</span></div></div>` : ''}
    <div class="stack">${r.findings.map(f => `<div class="finding ${f.ok ? 'ok' : ''}"><b>${esc(f.title)}</b><p>${esc(f.why)}</p>${f.fix.length ? `<div class="fixes">${f.fix.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : ''}</div>`).join('')}</div>
    <p class="muted small" style="margin:0">A movement screen, not a clinical gait lab. Pain or a recent injury? See a physio.</p>`;
}

function kneeChart(curves, mode) {
  const W = 360, H = 170, l = 30, r = 10, t = 10, b = 24, max = mode === 'run' ? 130 : 80;
  const X = i => l + i / 50 * (W - l - r), Y = v => t + (1 - v / max) * (H - t - b);
  // Typical walking knee pattern (Perry): ~5° at contact, ~15–20° loading, ~60° peak in swing.
  const norm = mode === 'run' ? [[20, 45], [40, 25], [55, 60], [80, 120]] : [[0, 8], [15, 22], [40, 8], [60, 40], [73, 62], [90, 25], [100, 5]];
  const ny = x => { for (let i = 1; i < norm.length; i++) if (x <= norm[i][0]) { const [x0, y0] = norm[i - 1], [x1, y1] = norm[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); } return norm[norm.length - 1][1]; };
  const band = Array.from({ length: 51 }, (_, i) => ny(i * 2));
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Knee angle through the gait cycle, left and right">`;
  for (let v = 0; v <= max; v += mode === 'run' ? 40 : 20) s += `<line x1="${l}" x2="${W - r}" y1="${Y(v)}" y2="${Y(v)}" style="stroke:var(--line)"/><text x="${l - 6}" y="${Y(v) + 4}" text-anchor="end" style="fill:var(--muted)" font-size="10" font-family="IBM Plex Mono, monospace">${v}°</text>`;
  [0, 25, 50, 75, 100].forEach(p => { s += `<text x="${X(p / 2)}" y="${H - 6}" text-anchor="middle" style="fill:var(--muted)" font-size="10" font-family="IBM Plex Mono, monospace">${p}%</text>`; });
  s += `<path d="${band.map((v, i) => `${i ? 'L' : 'M'}${X(i)} ${Y(Math.min(max, v + 8))}`).join(' ')} ${band.map((v, i) => `L${X(50 - i)} ${Y(Math.max(0, band[50 - i] - 8))}`).join(' ')} Z" style="fill:rgba(var(--z2-rgb),.2)"/>`;
  const line = (c, col) => c.length ? `<path d="${c.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(Math.max(0, Math.min(max, v))).toFixed(1)}`).join(' ')}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` : '';
  s += line(curves.L, '#5FB39D') + line(curves.R, '#D99A5B') + '</svg>';
  return s;
}

/* ---------- Body scan ---------- */
async function runScan(file) {
  if (!file) return;
  $('#scanStatus').textContent = 'Analysing your posture…'; $('#scanResult').hidden = true;
  try {
    const { source, w, h, lms } = await landmarksFrom(file);
    if (!lms) { $('#scanStatus').textContent = 'I couldn\'t find a full body. Stand further back, in good light.'; return; }
    const px = toPx(lms, w, h);
    const problem = stanceProblem(px, viewOf(px));
    if (problem) { $('#scanStatus').textContent = problem; say(problem, { id: 'stance', priority: 'high' }); return; }
    const r = analyse(px);
    render($('#scanCanvas'), source, w, h, px, r.labels, r.view);
    $('#scanWhen').textContent = `${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · ${r.view} view`;
    $('#scanMetrics').innerHTML = r.metrics.map(([k, v, bad]) => `<span>${esc(k)}</span><span class="${bad ? 'hot' : 'ok'}">${esc(v)}</span>`).join('');
    $('#scanFindings').innerHTML = r.findings.map(f => `<div class="finding ${f.good ? 'ok' : ''}"><b>${esc(f.title)}</b><p>${esc(f.why)}</p>${f.fix.length ? `<div class="fixes">${f.fix.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : ''}</div>`).join('');
    $('#scanResult').hidden = false; $('#scanStatus').textContent = '';
    S.scans.push({ at: Date.now(), view: r.view, findings: r.findings.map(f => f.title) }); persist();
    const issues = r.findings.filter(f => !f.good);
    say(issues.length ? `Scan done. I spotted ${issues.length} thing${issues.length > 1 ? 's' : ''} to work on. The main one: ${issues[0].title}.` : 'Scan done. Your alignment looks good.', { id: 'scan_' + Date.now(), priority: 'high' });
  } catch (e) { console.error(e); $('#scanStatus').textContent = 'That file couldn\'t be read. Try a JPG photo instead.'; }
}
$('#scanFile').onchange = e => { runScan(e.target.files[0]); e.target.value = ''; };
$('#scanFile2').onchange = e => { runScan(e.target.files[0]); e.target.value = ''; };

$('#calcBf').onclick = () => {
  const p = S.profile, v = id => parseFloat($(id).value);
  if (!p.heightCm) { $('#bfOut').innerHTML = '<p class="muted small">Add your height under Today → Profile &amp; coach first.</p>'; return; }
  const bf = navyBodyFat({ sex: p.sex, heightCm: p.heightCm, neckCm: v('#bNeck'), waistCm: v('#bWaist'), hipCm: v('#bHip') });
  if (Number.isNaN(bf)) { $('#bfOut').innerHTML = `<p class="muted small">Check your neck and waist${p.sex === 'female' ? ' and hip' : ''} measurements.</p>`; return; }
  const wt = v('#bWeight'), lean = wt ? wt * (1 - bf / 100) : null;
  S.scans.push({ at: Date.now(), bf, weight: wt || null, lean, water: v('#bWater') || null, muscle: v('#bMuscle') || null }); persist();
  const prev = S.scans.filter(s => s.bf).slice(-2, -1)[0];
  const off = 176 * (1 - Math.min(40, bf) / 40);
  $('#bfOut').innerHTML = `<div class="gauge"><svg viewBox="0 0 132 80" role="img" aria-label="Body fat ${bf.toFixed(1)} percent"><path d="M10 72a56 56 0 0 1 112 0" fill="none" style="stroke:var(--surface-2)" stroke-width="12" stroke-linecap="round"/><path d="M10 72a56 56 0 0 1 112 0" fill="none" stroke="url(#zoneStroke)" stroke-width="12" stroke-linecap="round" stroke-dasharray="176" stroke-dashoffset="${off}"/><text x="66" y="62" text-anchor="middle" style="fill:var(--text)" font-family="Archivo, sans-serif" font-weight="800" font-size="24">${bf.toFixed(1)}%</text><text x="66" y="76" text-anchor="middle" style="fill:var(--muted)" font-family="Figtree, sans-serif" font-size="9">body fat</text></svg>
    <span class="small"><b>${bfCategory(bf, p.sex)}</b><br><span class="muted">${prev ? `${bf < prev.bf ? 'Down' : 'Up'} ${Math.abs(bf - prev.bf).toFixed(1)}% since last time.` : 'Re-measure every two weeks, same time of day.'}</span></span></div>
    ${lean ? `<div class="comp" style="margin-top:12px"><div><span class="num">${lean.toFixed(1)}</span><small>lean kg</small></div><div><span class="num">${(wt - lean).toFixed(1)}</span><small>fat kg</small></div><div><span class="num">${v('#bWater') || '–'}</span><small>water % · scale</small></div></div>` : ''}`;
  say(`Body fat is about ${Math.round(bf)} percent, in the ${bfCategory(bf, p.sex).toLowerCase()} range.`, { id: 'bf_' + Date.now(), priority: 'high' });
};

/* ---------- Progression: QK's next weight, units, strength chart ---------- */
const unit = () => S.profile.unit || 'kg';
function unitLabels() {
  const u = unit();
  $('#setKgLbl').textContent = `Weight used (${u})`; $('#loadKgLbl').textContent = `Weight (${u})`;
  if (!$('#progress').hidden) renderStrength();
}
// Light week: starts by itself when due (every ~7 training weeks, or after 2 lifts backed off) and lasts 7 days.
function lightWeek() {
  const P = (S.prog ||= {}), now = Date.now(), W = 7 * 864e5;
  if (P.lightAt && now - P.lightAt < W) return true;
  if (prog.lightWeekDue(S.sessions, { now, lastLight: P.lightAt || 0, resets: P.resets || [] })) { P.lightAt = now; persist(); return true; }
  return false;
}
// The prescription for an exercise, with a coach/lifter override if one was set since the last session.
function rxFor(k) {
  const item = LIB[k]; if (!item) return null;
  const r = prog.nextFor(item, S.sessions, { unit: unit(), light: lightWeek(), scheme: programScheme(k) });
  const o = S.prog?.override?.[k], lastAt = Math.max(0, ...S.sessions.filter(s => s.ex === k).map(s => s.at));
  if (o && o.at > lastAt) {
    const base = r || { reps: prog.liftClass(item) === 'small' || prog.liftClass(item) === 'mid' ? prog.RANGE.lo : 8, sets: 3, mode: 'linear', cls: prog.liftClass(item) };
    return { ...base, kg: o.kg, action: 'set', why: 'Weight set by you.' };
  }
  if (r?.action === 'reset') { const P = (S.prog ||= {}); P.resets ||= []; if (!P.resets.some(x => x.ex === k && Date.now() - x.at < 3 * 864e5)) { P.resets.push({ ex: k, at: Date.now() }); persist(); } }
  return r;
}
const rxLine = r => `${r.sets} × ${r.reps} at ${prog.fmtW(r.kg, unit())}${r.day ? ` · ${r.day} day` : ''}`;
let curRx = null;
function showRx(k) {
  const item = LIB[k], cls = prog.liftClass(item); curRx = null;
  $('#rxEditWrap').hidden = true;
  $('#swapBtn').hidden = !inPlan(k);
  if (!cls) { $('#rxBox').hidden = !inPlan(k); if (inPlan(k)) { $('#rxLine').textContent = LIB[k].name; $('#rxWhy').textContent = 'Part of your program. Not for you? Swap it.'; $('#rxEyebrow').textContent = 'In your program'; $('#rxPlates').hidden = true; $('#rxEdit').hidden = true; } return; }
  $('#rxEdit').hidden = false;
  const r = rxFor(k); curRx = r;
  $('#rxBox').hidden = false; $('#rxBox').classList.toggle('lightwk', r?.action === 'light');
  $('#rxEyebrow').textContent = r?.action === 'light' ? 'Light week' : 'QK\'s target today';
  const sc = programScheme(k);
  $('#rxLine').textContent = r ? rxLine(r) : sc ? `First time: ${sc.sets} × ${sc.lo === sc.hi ? sc.lo : sc.lo + '–' + sc.hi}, pick a weight you can do with good form` : 'First time: pick a weight you can lift 8 times with good form';
  $('#rxWhy').textContent = r ? r.why : 'Log the weight after your set and QK plans the next one from how it went.';
  const pl = r && cls.startsWith('big') ? prog.plates(r.kg, unit()) : null;
  $('#rxPlates').hidden = !pl; $('#rxPlates').textContent = pl ? pl.text : '';
  const wu = r && !setsToday(k) ? warm.warmupSets(LIB[k], r.kg, unit()) : [];
  $('#rxWarm').hidden = !wu.length; $('#rxWarm').textContent = wu.length ? `Warm-up first: ${warm.warmupLine(wu, unit())}` : '';
  $('#rxEditLbl').textContent = `Weight (${unit()})`; $('#rxKg').value = r ? +prog.toUnit(r.kg, unit()).toFixed(2) : '';
  $('#loadKg').value = r ? +prog.toUnit(r.kg, unit()).toFixed(2) : $('#loadKg').value;
}
$('#rxEdit').onclick = () => { $('#rxEditWrap').hidden = !$('#rxEditWrap').hidden; if (!$('#rxEditWrap').hidden) $('#rxKg').focus(); };
$('#rxSave').onclick = () => {
  const v = parseFloat($('#rxKg').value); if (!(v > 0) || !exKey) return;
  const P = (S.prog ||= {}); P.override ||= {}; P.override[exKey] = { kg: prog.fromUnit(v, unit()), at: Date.now() };
  persist(); showRx(exKey); toast('Saved. QK will build from this weight.');
};
// After a set: what QK will ask for next time, and why.
function showNext() {
  const item = LIB[exKey], box = $('#sNext');
  if (!lastSet?.kg || !prog.liftClass(item)) { box.hidden = true; return; }
  const r = prog.nextFor(item, S.sessions, { unit: unit(), scheme: programScheme(exKey) });
  if (!r) { box.hidden = true; return; }
  box.hidden = false; $('#sNextLine').textContent = rxLine(r); $('#sNextWhy').textContent = r.why;
}
// Lines for the weekly message to the coach: what QK changed and why, so the coach can step in.
function progressionLines() {
  const W = 7 * 864e5, ids = [...new Set(S.sessions.filter(s => s.kg > 0 && !s.demo && Date.now() - s.at < W).map(s => s.ex))];
  const lines = ids.map(k => { const r = prog.nextFor(LIB[k], S.sessions, { unit: unit() }); return r && LIB[k] ? `${LIB[k].name}: ${rxLine(r)} (${r.why})` : null; }).filter(Boolean);
  return lines.length ? '\nNext session targets:\n' + lines.join('\n') : '';
}
let stRange = '3M';
function renderStrength() {
  // Lifts with logged weights, most-trained first; the chart opens on the main one.
  const n = {}; for (const x of S.sessions) if (x.kg > 0 && !x.demo && !x.guided && LIB[x.ex]) n[x.ex] = (n[x.ex] || 0) + 1;
  const lifts = Object.keys(n).sort((a, b) => n[b] - n[a]);
  const sel = $('#stLift'), cur = lifts.includes(sel.value) ? sel.value : lifts[0];
  sel.innerHTML = lifts.map(k => `<option value="${k}" ${k === cur ? 'selected' : ''}>${esc(LIB[k].name)}</option>`).join('');
  const u = unit(), vol = prog.weeklyVolume(S.sessions, 8);
  const vmax = Math.max(1, ...vol);
  $('#volChart').innerHTML = `<div class="vol-bars" role="img" aria-label="Weekly volume, last 8 weeks">${vol.map((v, i) => `<i class="${i === 7 ? 'now' : ''}" style="height:${Math.max(4, v / vmax * 100)}%" title="${Math.round(prog.toUnit(v, u)).toLocaleString()} ${u}"></i>`).join('')}</div><p class="muted small" style="margin:6px 0 0">This week: ${Math.round(prog.toUnit(vol[7], u)).toLocaleString()} ${u}${vol[6] ? ` · last week ${Math.round(prog.toUnit(vol[6], u)).toLocaleString()} ${u}` : ''}</p>`;
  if (!cur) { $('#stChart').innerHTML = '<p class="empty">Log the weight after a set and your strength chart starts here.</p>'; $('#stNote').textContent = ''; $('#stDelta').textContent = ''; return; }
  const { points, change } = prog.strengthSeries(S.sessions, cur, stRange);
  $('#stTitle').textContent = LIB[cur].name;
  $('#stDelta').textContent = change == null ? '' : `${change >= 0 ? '+' : ''}${Math.round(change * 100)}%`;
  $('#stDelta').style.color = change > 0 ? 'var(--good)' : 'var(--muted)';
  const vals = points.map(p => prog.toUnit(p.e1rm, u));
  const fmtD = t => new Date(t).toLocaleDateString(undefined, stRange === '1M' || stRange === '3M' ? { day: 'numeric', month: 'short' } : { month: 'short' });
  $('#stChart').innerHTML = vals.length >= 2 ? lineChart(vals, { min: Math.floor(Math.min(...vals) * 0.95), max: Math.ceil(Math.max(...vals) * 1.03), labels: points.map(p => fmtD(p.t)), marks: points.map(p => p.pr) })
    : `<p class="empty">${vals.length ? 'One session so far in this range. Train it again to see the line.' : 'No sets of this lift in this range.'}</p>`;
  const best = Math.max(0, ...points.map(p => p.e1rm)), prs = points.filter(p => p.pr).length;
  $('#stNote').textContent = vals.length ? `Estimated 1-rep max, best ${prog.fmtW(best, u)}${prs ? ` · ${prs} personal best${prs > 1 ? 's' : ''} (gold dots)` : ''}.` : '';
}
$('#stLift').onchange = renderStrength;
$('#stRange').onclick = e => { const b = e.target.closest('[data-r]'); if (!b) return; stRange = b.dataset.r; $('#stRange').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); renderStrength(); };

/* ---------- QK's plan: every weight decided before the lifter asks ---------- */
const planToday = () => brief.planRows(todayItems().map(x => x[0]), { lib: LIB, sets: S.sessions, unit: unit(), light: lightWeek(), schemeFor: programScheme });
function renderPlan(rows) {
  // With a program, every item of the day is listed (runs and stations too); without one, only weighted lifts.
  const sets = Object.fromEntries(todayItems()), prg = !!activeProgram();
  const lifts = rows.filter(r => r.change !== 'none' || prg).map(r => (r.change === 'none' ? { ...r, line: (sets[r.id] || '').replace('×', ' × '), why: LIB[r.id]?.pattern ? 'QK counts your reps and checks your form.' : 'QK coaches you through it by voice.', tag: '' } : r));
  const card = $('#qkPlan');
  if (!lifts.length) { card.hidden = true; return; }
  card.hidden = false;
  const p = activeProgram(), newWeek = (S.prog?.briefWeek ?? -1) !== brief.weekOf(Date.now());
  const mw = p ? Math.min(4, Math.floor((Date.now() - (S.program.blockStart || S.program.start)) / (7 * 864e5)) + 1) : 0, pw = null;
  $('#planEyebrow').textContent = p ? `${p.name} · month ${S.program.block || 1} · week ${mw} of 4` : 'QK\'s plan for today';
  renderNews();
  const known = lifts.filter(r => r.rx), needW = lifts.some(r => r.change === 'new');
  $('#planTitle').textContent = known.length ? (newWeek ? 'New week. Your weights are set.' : 'Your weights are set') : needW ? 'Pick your starting weights' : `Today: ${programDay()?.day?.name || 'your workout'}`;
  $('#planSummary').textContent = (brief.summary(known) + (known.length ? ' Based on how your last session went. Just follow the numbers.' : needW ? ' Do your first set and QK plans every one after it.' : ' Tap Start workout and follow QK.')).trim();
  const dItems = dayItems() || [], lab = Object.fromEntries(SS.labels(dItems).map((l, i) => [dItems[i][0], l]));
  const raw = dayItemsRaw(), cap = capToday();
  $('#planTime').hidden = !raw;
  if (raw) {
    const shown = dayItems(), mins = warm.dayMinutes(shown, warmCount(shown)), full = warm.dayMinutes(raw, warmCount(raw));
    $('#planMins').textContent = cap ? `About ${mins} min (trimmed from ${full})` : `About ${mins} min`;
    $('#planTime').querySelectorAll('[data-cap]').forEach(b => { b.classList.toggle('on', +b.dataset.cap === cap); b.hidden = +b.dataset.cap >= full && +b.dataset.cap !== cap; });
    // One line per exercise: if it was cut down and then skipped, just say skipped.
    const cut = cap ? Object.values(Object.fromEntries(warm.fitTo(raw, cap, warmCount(raw)).cut.map(c => [c.id, c]))) : [];
    $('#planCut').hidden = !cut.length;
    $('#planCut').textContent = cut.length ? 'QK trimmed: ' + cut.map(c => c.to ? `${LIB[c.id]?.name} ${c.from}→${c.to} sets` : `skipped ${LIB[c.id]?.name}`).join(', ') + '. Main lifts stay.' : '';
  }
  $('#planRows').innerHTML = lifts.map(r => `<button type="button" class="plan-row ${r.change}" data-train="${r.id}"><b>${lab[r.id] ? `<span class="ss">${lab[r.id]}</span> ` : ''}${esc(r.name)}</b><span class="tgt">${esc(r.line)}</span><span class="why">${esc(r.why)}</span><span class="chg">${esc(r.tag || '')}</span>${platesFor(r)}</button>`).join('');
}
const platesFor = r => { const pl = r.rx && r.rx.cls?.startsWith('big') ? prog.plates(r.rx.kg, unit()) : null; return pl ? `<span class="plates">${esc(pl.text)}</span>` : ''; };
// The plan, out loud: the weekly summary then each lift's target.
function planSpeech() {
  const rows = planToday().filter(r => r.rx);
  if (!rows.length) return '';
  return `${brief.summary(rows)} ${rows.map(r => `${r.name}: ${brief.spokenTarget(r, unit()).replace(/^Today: /, '')}`).join(' ')}`;
}
$('#planTime').onclick = e => {
  const b = e.target.closest('[data-cap]'); if (!b) return;
  const m = +b.dataset.cap, today = new Date().toDateString();
  S.timeCap = capToday() === m ? null : { day: today, mins: m }; persist(); renderToday();
  if (S.timeCap) say(`Got it. ${m} minutes. I've trimmed today's workout and kept your main lifts.`, { priority: 'high' });
};
$('#planListen').onclick = () => { const t = planSpeech(); if (t) say(t, { id: 'plan_' + Date.now(), priority: 'now' }); };

/* ---------- One-tap workout: QK walks the lifter through every set ---------- */
// Start once. After each set the rest timer runs by itself; when it ends, the next set starts (same
// exercise: the camera reopens straight away) or the next exercise's setup opens. The weights are already
// filled in, so the lifter only lifts.
let flow = null;
function plannedSets(k) {
  const row = planToday().find(r => r.id === k); if (row?.rx) return row.rx.sets;
  const it = todayItems().find(x => x[0] === k); return parseInt(it?.[1], 10) || 3;
}
// The next exercise, following supersets and circuits (A1 → A2 → rest → A1 …).
const flowStep = () => {
  if (!flow) return null;
  const items = dayItems() || todayItems().map(([k, s]) => [k, parseInt(s, 10) || 3]);
  const its = items.filter(it => flow.items.includes(it[0]));
  return SS.nextUp(its, Object.fromEntries(its.map(it => [it[0], setsToday(it[0])])), Object.fromEntries(its.map(it => [it[0], plannedSets(it[0])])), exKey);
};
const flowNextId = () => flowStep()?.id;
function startFlow() {
  flow = { items: todayItems().map(x => x[0]) };
  say(`Let's go. ${flow.items.length} exercises today. I'll take you through every set.`, { id: 'flow_start', priority: 'high' });
  nextInFlow(true);
}
function nextInFlow(first) {
  if (!flow) return;
  const k = flowNextId();
  stopRest(); $('#summary').hidden = true; $('#flowNext').hidden = true;
  if (!k) {
    flow = null; keepAwake(false); tab('today'); renderToday();
    say('Workout done. Every set is logged and your next session is already planned.', { id: 'flow_done', priority: 'high' });
    return toast('Workout done ✓ Next session is planned.');
  }
  const n = setsToday(k) + 1, of = plannedSets(k);
  if (!first && k === exKey && lastSource === 'camera' && exFor(k)) {
    say(`Set ${n} of ${of}.`, { id: 'flow_set_' + Date.now(), priority: 'high' });
    return startLive({ mode: 'form', source: 'camera' });
  }
  if (!first) tab('today');
  openSetup(k);
}
function showFlowNext() {
  const st = flowStep(), k = st?.id, box = $('#flowNext');
  // Superset partner next: a short switch-over instead of the full rest.
  if (flow && st && !st.rest && k !== exKey) { stopRest(); restLeft = restTotal = 15; drawRest(); $('#restWhy').textContent = 'Superset: straight to the next exercise'; $('#restCard').hidden = false; $('#restBtn').click(); }
  if (!flow) { box.hidden = true; return; }
  box.hidden = false;
  if (!k) { $('#flowNextLine').textContent = 'That was the last set'; $('#flowNextSub').textContent = 'Tap Go now to finish. Everything is saved.'; return; }
  const row = planToday().find(r => r.id === k), n = setsToday(k) + 1, of = plannedSets(k);
  $('#flowNextLine').textContent = k === exKey ? `Set ${n} of ${of}` : `${LIB[k].name}`;
  $('#flowNextSub').textContent = k === exKey ? `${LIB[k].name}${row?.rx ? ' · ' + row.line : ''}` : `${of} sets${row?.rx ? ' · ' + row.line : ''}. Set up your phone for it while you rest.`;
}
$('#flowGo').onclick = () => nextInFlow();
$('#planStart').onclick = () => startFlow();

/* ---------- Training-day reminders ---------- */
$('#remindCal').onclick = () => {
  const text = icsFor(S.plan, { name: S.profile.name, url: location.href.split('#')[0].split('?')[0] });
  if (!text) return toast('Pick your training days first.');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar' }));
  const a = document.createElement('a'); a.href = url; a.download = 'shred-qk-training.ics'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('Open the file to add it to your calendar.');
};
$('#remindNotify').onclick = async () => {
  if (!('Notification' in window)) return toast('This phone doesn\'t support app notifications. Use the calendar reminders.');
  const p = await Notification.requestPermission();
  S.profile.remind = p === 'granted'; persist();
  toast(p === 'granted' ? 'Done. QK will remind you on training days.' : 'Notifications are off. The calendar reminders still work.');
  checkReminder();
};
// When the app is open on a training day and it's nearly time, show today's plan as a notification.
async function checkReminder() {
  if (!S.profile.remind || !('Notification' in window) || Notification.permission !== 'granted') return;
  const trainedToday = S.sessions.some(x => new Date(x.at).toDateString() === new Date().toDateString());
  if (!dueToday(S.plan, { trainedToday, notifiedOn: S.prog?.notifiedOn })) return;
  const rows = planToday().filter(r => r.rx);
  const body = rows.length ? rows.slice(0, 4).map(r => `${r.name}: ${r.line}`).join('\n') : `${todayName()}: ${todayItems().length} exercises. Your weights are set.`;
  const title = `Time to train${S.profile.name ? ', ' + S.profile.name : ''}`;
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    reg ? reg.showNotification(title, { body, icon: 'icons/icon.svg', tag: 'qk-train' }) : new Notification(title, { body, tag: 'qk-train' });
    (S.prog ||= {}).notifiedOn = new Date().toDateString(); persist();
  } catch {}
}
setInterval(checkReminder, 5 * 60e3); document.addEventListener('visibilitychange', () => { if (!document.hidden) checkReminder(); });

/* ---------- Monthly refresh: new month, same formula ---------- */
const MONTH = 28 * 864e5;
const inPlan = k => !!activeProgram()?.plan.some(d => d.items.some(it => it[0] === k));
// Reps done cleanly in the last 4 weeks (form quality for the volume decision).
const cleanRate = () => { const from = Date.now() - MONTH, xs = S.sessions.filter(x => x.at >= from && !x.demo && !x.guided && x.reps); const r = xs.reduce((a, x) => a + x.reps, 0); return r ? xs.reduce((a, x) => a + Math.min(x.good || 0, x.reps), 0) / r : 1; };
function rollMonth() {
  const P = S.program, def = P?.id && programById(P.id); if (!def) return;
  P.blockStart ||= P.start; P.block ||= 1;
  if (Date.now() - P.blockStart < MONTH) return;
  const nb = refresh.nextBlock(def, { block: P.block, plan: P.plan || def.plan }, { lib: LIB, avoid: S.prefs?.avoid || [], compliance: refresh.compliance(P, def.days), clean: cleanRate() });
  Object.assign(P, { block: nb.block, plan: nb.plan, blockStart: Date.now(), news: { block: nb.block, changes: nb.changes, note: nb.note, seen: false } });
  persist();
  say(`Month ${nb.block} of ${def.name} is ready. ${nb.changes.length} new exercises, same formula. ${nb.note}`, { id: 'month_' + nb.block, priority: 'high' });
}
function renderNews() {
  const n = S.program?.news, box = $('#planNews');
  if (!n || n.seen) { box.hidden = true; return; }
  box.hidden = false;
  $('#newsTitle').textContent = `Month ${n.block} is ready: new exercises, same formula`;
  $('#newsNote').textContent = n.note;
  $('#newsList').innerHTML = n.changes.slice(0, 6).map(c => `<li>${esc(LIB[c.from]?.name || c.from)} → <b>${esc(LIB[c.to]?.name || c.to)}</b></li>`).join('') + (n.changes.length > 6 ? `<li class="muted">and ${n.changes.length - 6} more</li>` : '');
}
$('#newsOk').onclick = () => { if (S.program?.news) { S.program.news.seen = true; persist(); renderNews(); } };
// Swap an exercise the lifter doesn't like: similar options, and it never comes back in later months.
$('#swapBtn').onclick = () => {
  const k = exKey, plan = activeProgram()?.plan; if (!plan) return;
  const exclude = plan.flatMap(d => d.items.map(it => it[0]));
  const opts = refresh.alternatives(k, LIB, { avoid: S.prefs?.avoid || [], exclude });
  if (!opts.length) return toast('No close alternatives for this one.');
  $('#setup').hidden = true;
  openSheet(`<div><span class="eyebrow">Swap exercise</span><h2 class="display h2" id="rsheetTitle" style="margin-top:6px;font-size:1.3rem">Instead of ${esc(LIB[k].name)}</h2></div>
    <p class="muted small" style="margin:0">Same muscles, same sets and reps. QK won't bring ${esc(LIB[k].name)} back in later months.</p>
    <div class="swap-list">${opts.map(id => `<button type="button" class="ghost" data-swapto="${id}"><b>${esc(LIB[id].name)}</b><span>${esc(LIB[id].muscles.slice(0, 3).join(' · '))} · ${esc(LIB[id].equipment)}${LIB[id].pattern ? ' · form check' : ''}</span></button>`).join('')}</div>`);
  $('#rsheetBody').dataset.swapFrom = k;
};
$('#rsheetBody').addEventListener('click', e => {
  const b = e.target.closest('[data-swapto]'); if (!b) return;
  const from = $('#rsheetBody').dataset.swapFrom, to = b.dataset.swapto, plan = activeProgram()?.plan; if (!from || !plan) return;
  S.program.plan = refresh.swapIn(plan, from, to);
  (S.prefs ||= {}).avoid = [...new Set([...(S.prefs.avoid || []), from])];
  persist(); closeSheet(); renderToday(); renderPrograms();
  toast(`Swapped. ${LIB[to].name} from now on.`);
  openSetup(to);
});

/* ---------- Coach connection: sync numbers, hear the coach's messages ---------- */
// Off unless the server is configured (js/cloud-config.js). Everything works offline; sync catches up later.
const cloud = cloudOn() ? new Cloud({ url: CLOUD.url, anonKey: CLOUD.anonKey, session: S.cloud?.session || null, onSession: s => { (S.cloud ||= {}).session = s; persist(); } }) : null;
let syncing = false;
async function syncNow() {
  if (!cloud?.signedIn || !S.cloud?.coach || syncing || !navigator.onLine) return;
  syncing = true;
  try {
    S.cloud.mark = await pushAll(cloud, S, S.cloud.mark || {}); persist();
    const msgs = await cloud.unread();
    if (msgs.length) {
      const from = S.cloud.coach || 'Your coach';
      msgs.forEach((m, i) => setTimeout(() => { say(`Message from ${from}. ${m.body}`, { id: 'coachmsg_' + m.id, priority: 'high' }); toast(`${from}: ${m.body}`); }, 1500 + i * 6000));
      await cloud.markRead(msgs.map(m => m.id));
    }
  } catch (e) { if (e.status === 401) { S.cloud.session = null; persist(); renderCoachLink(); } }
  finally { syncing = false; }
}
function renderCoachLink() {
  const card = $('#coachLink'); card.hidden = !cloud; if (!cloud) return;
  const signed = cloud.signedIn, coach = S.cloud?.coach;
  $('#clStep1').hidden = signed; $('#clStep2').hidden = true; $('#clStep3').hidden = !signed || !!coach; $('#clOut').hidden = !signed;
  $('#clStatus').textContent = coach ? `Connected to ${coach} ✓ Your sessions sync automatically. Only numbers are shared; your videos never leave your phone.`
    : signed ? 'Signed in. Now enter your coach\'s invite code.' : 'Connect to your coach so they can see your training and cheer you on. Only numbers are shared (sets, reps, weights, form scores). Your videos never leave your phone.';
}
// Demo (no server yet): messages sent to "this phone" from the dashboard demo are read out here.
function demoInbox() {
  if (cloud) return;
  let msgs = []; try { msgs = JSON.parse(localStorage.getItem('qk_demo_inbox') || '[]'); localStorage.removeItem('qk_demo_inbox'); } catch {}
  msgs.forEach((m, i) => setTimeout(() => { say(`Message from your coach. ${m.body}`, { id: 'demomsg_' + m.id, priority: 'high' }); toast(`Coach: ${m.body}`); }, 1500 + i * 6000));
}
if (!cloud) { demoInbox(); document.addEventListener('visibilitychange', () => { if (!document.hidden) demoInbox(); }); }
if (cloud) {
  $('#clSend').onclick = async () => { const e = $('#clEmail').value.trim(); if (!e) return; try { await cloud.sendCode(e); $('#clStep2').hidden = false; toast('Code sent. Check your email.'); } catch (err) { toast(err.message); } };
  $('#clVerify').onclick = async () => { try { await cloud.verify($('#clEmail').value, $('#clCode').value); renderCoachLink(); } catch (err) { toast(err.message); } };
  $('#clJoin').onclick = async () => {
    try { const name = await cloud.joinCoach($('#clInvite').value.trim()); (S.cloud ||= {}).coach = name || 'your coach'; persist(); renderCoachLink(); toast(`Connected to ${S.cloud.coach} ✓`); say(`You're connected to ${S.cloud.coach}. They'll see your training and cheer you on.`, { priority: 'high' }); await cloud.opened(); syncNow(); }
    catch (err) { toast(/No coach/.test(err.message) ? 'That invite code didn\'t match. Check it with your coach.' : err.message); }
  };
  $('#clOut').onclick = () => { cloud.signOut(); S.cloud = {}; persist(); renderCoachLink(); };
  renderCoachLink();
  // An app open counts as "logged in today" for the coach; then sync anything new.
  if (cloud.signedIn && S.cloud?.coach) cloud.opened().catch(() => {}).finally(syncNow);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNow(); });
  addEventListener('online', syncNow); setInterval(syncNow, 5 * 60e3);
}

/* ---------- QK classes: on-demand classes run by voice ---------- */
function renderClasses() {
  S.classes ||= [];
  $('#classStrip').innerHTML = classes.CLASSES.map(c => { const best = classes.bestScore(S.classes, c.id), done = S.classes.filter(r => r.class === c.id).length;
    return `<button type="button" role="listitem" class="prog-card class-card" data-class="${c.id}"><span class="pgoal">${classes.minutes(c)} min · ${esc(c.level)}</span><b>${esc(c.name)}</b><p>${esc(c.tagline)}</p>
      <span class="meta">${esc(classes.format(c))}${c.equipment === 'dumbbells' ? ' · dumbbells' : ' · no equipment'}${done ? ` · done ${done}×${best ? `, best ${best} rounds` : ''}` : ''}</span></button>`; }).join('');
}
function showClass(id) {
  const c = classes.byId(id); if (!c) return;
  const t = classes.timeline(c), best = classes.bestScore(S.classes || [], id);
  const blocks = c.blocks.map(b => `<div class="prog-day"><h3>${esc(b.name)} <span class="muted small">· ${b.type === 'intervals' ? `${b.rounds} rounds, ${b.work} s on / ${b.rest} s off` : b.type === 'tabata' ? '8 × 20 s on / 10 s off' : b.type === 'emom' ? `${b.minutes} minutes, every minute` : `${b.secs / 60} minutes, as many rounds as possible`}</span></h3>
    <ol>${(b.moves || []).map(m => { const [id2, reps] = Array.isArray(m) ? m : [m]; return `<li>${esc(classes.MOVES[id2].name)}${reps ? ` <span>${reps} reps</span>` : ''}</li>`; }).join('')}</ol></div>`).join('');
  openSheet(`<div><span class="eyebrow">QK class · ${classes.minutes(c)} min · ${esc(c.level)}</span><h2 class="display h2" id="rsheetTitle" style="margin-top:6px;font-size:1.4rem">${esc(c.name)}</h2></div>
    <p style="margin:0">${esc(c.tagline)}</p>
    <p class="muted small" style="margin:0">QK calls every move and counts you down. Warm-up and cool-down included. Prop your phone up where you can see it.${best ? ` Your best finisher: ${best} rounds.` : ''}</p>
    ${c.quiet ? '' : '<label class="check"><input type="checkbox" id="classQuiet"> Quiet mode: no jumping (apartments, sore knees)</label>'}
    ${blocks}
    <button class="cta" type="button" data-classstart="${c.id}">Start class · ${Math.round(t.total / 60)} min</button>`);
}
$('#classStrip').onclick = e => { const b = e.target.closest('[data-class]'); if (b) showClass(b.dataset.class); };
// At home: home programs and the home-friendly classes in one row.
const HOME_EQ = { none: 'no equipment', dumbbells: 'dumbbells', bands: 'bands' };
function renderHome() {
  const act = activeProgram();
  const progs = PROGRAMS.filter(p => p.home).map(p => `<button type="button" role="listitem" class="prog-card ${p.id === act?.id ? 'on' : ''}" data-prog="${p.id}"><span class="pgoal">Program · ${HOME_EQ[p.home]}</span><b>${esc(p.name)}</b><p>${esc(p.tagline)}</p><span class="meta">${p.days} days/week · ${p.weeks} weeks · ${esc(p.level)}</span></button>`);
  const sess = classes.CLASSES.filter(c => c.home).map(c => `<button type="button" role="listitem" class="prog-card class-card" data-class="${c.id}"><span class="pgoal">${classes.minutes(c)} min · ${c.equipment === 'dumbbells' ? 'dumbbells' : 'no equipment'}</span><b>${esc(c.name)}</b><p>${esc(c.tagline)}</p><span class="meta">${esc(classes.format(c))}${c.quiet ? ' · no jumping' : ''}</span></button>`);
  $('#homeStrip').innerHTML = [...sess, ...progs].join('');
}
$('#homeStrip').onclick = e => { const c = e.target.closest('[data-class]'), p = e.target.closest('[data-prog]'); if (c) showClass(c.dataset.class); else if (p) showProgram(p.dataset.prog); };
$('#rsheetBody').addEventListener('click', e => { const b = e.target.closest('[data-classstart]'); if (b) { const quiet = !!$('#classQuiet')?.checked; closeSheet(); startClass(b.dataset.classstart, { quiet }); } });

let cls = null;
function startClass(id, { quiet = false } = {}) {
  const c = classes.byId(id), { segs, total } = classes.timeline(c, { quiet: quiet || c.quiet });
  cls = { c, segs, total, i: -1, left: 0, done: 0, paused: false, score: 0, t0: Date.now(), last: Date.now(), timer: null };
  $('#classPlayer').hidden = false; keepAwake(true);
  say(`${c.name}. ${Math.round(total / 60)} minutes. Let's warm up.`, { id: 'class_start', priority: 'now' });
  setTimeout(() => { if (cls) { nextSeg(); cls.timer = setInterval(tickClass, 250); } }, 2500);
}
function nextSeg() {
  if (!cls) return;
  cls.i++;
  if (cls.i >= cls.segs.length) return finishClass(true);
  const s = cls.segs[cls.i], nx = cls.segs[cls.i + 1];
  cls.left = s.secs; cls.half = false; cls.counted = 0;
  const rest = s.kind === 'rest';
  $('#classPlayer').classList.toggle('rest', rest);
  $('#cpBlock').textContent = `${s.block}${s.round ? ` · ${s.kind === 'emom' ? 'minute' : 'round'} ${s.round} of ${s.of}` : ''}`;
  $('#cpKind').textContent = { warmup: 'Warm-up', work: 'Work', rest: s.label, emom: `${s.reps} reps`, amrap: 'Finisher · as many rounds as you can', cooldown: 'Cool-down' }[s.kind];
  const name = m => classes.MOVES[m]?.name || m;
  $('#cpMove').innerHTML = rest ? 'Rest' : s.kind === 'amrap' ? s.moves.map(([m, r]) => `<span>${r} ${esc(name(m))}</span>`).join('') : esc(name(s.move));
  $('#cpMove').classList.toggle('list', s.kind === 'amrap');
  $('#cpCue').textContent = rest ? '' : s.kind === 'amrap' ? 'Tap +1 after every full round.' : (classes.MOVES[s.move]?.cue || '');
  $('#cpNext').textContent = nx ? `Next: ${nx.kind === 'rest' ? 'rest' : nx.kind === 'amrap' ? 'finisher' : name(nx.move)}` : 'Last one!';
  $('#cpRound').hidden = s.kind !== 'amrap'; $('#cpScore').textContent = cls.score;
  say(classes.callout(s, nx), { id: 'cls_' + cls.i + '_' + Date.now(), priority: 'now' });
  drawClass();
}
function tickClass() {
  if (!cls || cls.paused) { if (cls) cls.last = Date.now(); return; }
  const now = Date.now(), dt = (now - cls.last) / 1000; cls.last = now;
  cls.left -= dt; cls.done += dt;
  const s = cls.segs[cls.i], sec = Math.ceil(cls.left);
  if (s && s.kind !== 'rest' && sec <= 3 && sec >= 1 && cls.counted !== sec) { cls.counted = sec; say(String(sec), { id: 'cd_' + cls.i + '_' + sec, priority: 'now' }); }
  if (s && s.kind === 'work' && s.secs >= 40 && !cls.half && cls.left <= s.secs / 2) { cls.half = true; say('Halfway. Keep pushing!', { id: 'half_' + cls.i, priority: 'low' }); }
  if (cls.left <= 0) return nextSeg();
  drawClass();
}
function drawClass() {
  const s = cls.segs[cls.i]; if (!s) return;
  const left = Math.max(0, Math.ceil(cls.left));
  $('#cpTime').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  $('#cpArc').style.strokeDashoffset = 327 * (1 - Math.max(0, cls.left) / s.secs);
  $('#cpBar').style.width = Math.min(100, cls.done / cls.total * 100) + '%';
}
function finishClass(complete) {
  if (!cls) return;
  clearInterval(cls.timer); keepAwake(false);
  const c = cls.c, mins = Math.max(1, Math.round((Date.now() - cls.t0) / 60000)), hadAmrap = cls.segs.some(s => s.kind === 'amrap');
  const best = classes.bestScore(S.classes || [], c.id), score = hadAmrap ? cls.score : null;
  $('#classPlayer').hidden = true;
  const done = complete || cls.done >= cls.total * 0.5;
  cls = null;
  if (!done) { toast('Class ended early. No worries, come back to it.'); return; }
  const beat = score != null && best && score > best;
  say(`${c.name} done! ${mins} minutes.${score != null ? ` ${score} rounds on the finisher.${beat ? ' New best!' : best ? ` Your best is ${best}.` : ''}` : ''} How hard was that?`, { id: 'class_done', priority: 'now' });
  openSheet(`<div><span class="eyebrow">Class done</span><h2 class="display h2" id="rsheetTitle" style="margin-top:6px;font-size:1.4rem">${esc(c.name)} ✓</h2></div>
    <p style="margin:0">${mins} minutes${score != null ? ` · finisher <b>${score} rounds</b>${beat ? ' · new best!' : best ? ` (best ${best})` : ''}` : ''}</p>
    <label class="field slider">How hard was it? <span class="val" id="crpeV">7</span><input type="range" min="1" max="10" value="7" id="crpe"></label>
    <button class="cta" type="button" id="classSave">Save</button>`);
  $('#crpe').oninput = e => ($('#crpeV').textContent = e.target.value);
  $('#classSave').onclick = () => {
    const rpe = +$('#crpe').value, at = Date.now();
    (S.classes ||= []).push({ at, class: c.id, name: c.name, minutes: mins, score, rpe });
    S.loads.push({ at, rpe, minutes: mins });
    persist(); closeSheet(); renderClasses(); renderToday(); toast(`Saved. ${mins} minutes${score != null ? `, ${score} rounds` : ''}.`);
  };
}
$('#cpPause').onclick = () => { if (!cls) return; cls.paused = !cls.paused; $('#cpPause').textContent = cls.paused ? 'Resume' : 'Pause'; say(cls.paused ? 'Paused.' : 'And go!', { priority: 'now' }); };
$('#cpSkip').onclick = () => { if (cls) { cls.done += Math.max(0, cls.left); nextSeg(); } };
$('#cpEnd').onclick = () => finishClass(false);
$('#cpRound').onclick = () => { if (!cls) return; cls.score++; $('#cpScore').textContent = cls.score; say(String(cls.score), { id: 'rnd_' + cls.score, priority: 'now' }); };

/* ---------- Workout builder ---------- */
// Built programs live in S.customPrograms and behave exactly like the built-in ones.
const programById = id => builtinById(id) || (S.customPrograms || []).find(p => p.id === id) || null;
let bd = null, bdDay = 0;
function openBuilder(p) {
  bd = p ? JSON.parse(JSON.stringify(p)) : builder.blank();
  $('#bdName').value = bd.name; $('#bdTag').value = bd.tagline || ''; $('#bdErr').hidden = true;
  $('#builder').hidden = false; drawBuilder();
}
function drawBuilder() {
  $('#bdDays').innerHTML = bd.plan.map((d, di) => `<div class="bd-day" data-day="${di}">
    <div class="bd-day-head"><input data-dname="${di}" value="${esc(d.name)}" aria-label="Day name"><button type="button" data-ddel="${di}" aria-label="Remove day" title="Remove day">✕</button></div>
    ${d.items.length ? '<div class="bd-cols"><span>Exercise</span><span>Sets</span><span>Reps</span><span>Rest s</span><span></span></div>' : ''}
    ${d.items.map((it, ii) => `<div class="bd-item"><b>${SS.labels(d.items)[ii] ? `<span class="ss">${SS.labels(d.items)[ii]}</span> ` : ''}${esc(LIB[it[0]]?.name || it[0])}</b>
      <input data-f="1" data-d="${di}" data-i="${ii}" value="${it[1]}" inputmode="numeric" aria-label="Sets">
      <input data-f="2" data-d="${di}" data-i="${ii}" value="${esc(it[2])}" aria-label="Reps">
      <input data-f="3" data-d="${di}" data-i="${ii}" value="${it[3]}" inputmode="numeric" aria-label="Rest seconds">
      <span class="bd-btns">${ii < d.items.length - 1 ? `<button type="button" data-link="${di}:${ii}" aria-label="Superset with the next exercise" title="Superset with the next exercise" class="${SS.groupOf(it) && SS.groupOf(it) === SS.groupOf(d.items[ii + 1]) ? 'on' : ''}">⛓</button>` : ''}<button type="button" data-up="${di}:${ii}" aria-label="Move up">↑</button><button type="button" data-down="${di}:${ii}" aria-label="Move down">↓</button><button type="button" data-rm="${di}:${ii}" aria-label="Remove">✕</button></span></div>`).join('')}
    <button class="ghost" type="button" data-add="${di}">+ Add exercise</button></div>`).join('');
}
$('#builder').addEventListener('input', () => { $('#bdErr').hidden = true; });
$('#bdDays').addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.dname != null) bd.plan[+t.dataset.dname].name = t.value;
  if (t.dataset.f) bd.plan[+t.dataset.d].items[+t.dataset.i][+t.dataset.f] = t.value;
});
$('#bdDays').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const [di, ii] = (b.dataset.up || b.dataset.down || b.dataset.rm || b.dataset.link || '').split(':').map(Number);
  if (b.dataset.link) bd.plan[di].items = SS.toggleLink(bd.plan[di].items, ii);
  else if (b.dataset.up) bd.plan[di].items = builder.move(bd.plan[di].items, ii, -1);
  else if (b.dataset.down) bd.plan[di].items = builder.move(bd.plan[di].items, ii, 1);
  else if (b.dataset.rm) bd.plan[di].items.splice(ii, 1);
  else if (b.dataset.ddel) { if (bd.plan.length > 1) bd.plan.splice(+b.dataset.ddel, 1); }
  else if (b.dataset.add) { bdDay = +b.dataset.add; $('#bdSearchTitle').textContent = `Add to ${bd.plan[bdDay].name || 'this day'}`; $('#bdQ').value = ''; $('#bdSearch').hidden = false; drawSearch(); $('#bdQ').focus(); return; }
  drawBuilder();
});
function drawSearch() {
  const q = $('#bdQ').value.trim(), inDay = bd.plan[bdDay].items.map(it => it[0]);
  const hits = q ? builder.search(LIB, q) : builder.search(LIB, '', { limit: 0 });
  $('#bdResults').innerHTML = q ? (hits.map(x => `<button type="button" data-pick="${x.id}" class="${inDay.includes(x.id) ? 'added' : ''}"><b>${esc(x.name)}</b><span>${esc((x.muscles || []).slice(0, 2).join(' · '))} · ${esc(x.equipment)}${x.pattern ? ' · form check' : ''}${inDay.includes(x.id) ? ' · added ✓' : ''}</span></button>`).join('') || '<p class="empty">Nothing matches. Try another word.</p>') : '<p class="empty">Type an exercise, muscle or piece of equipment.</p>';
}
$('#bdQ').oninput = drawSearch;
$('#bdResults').onclick = e => { const b = e.target.closest('[data-pick]'); if (!b) return; const id = b.dataset.pick; if (!bd.plan[bdDay].items.some(it => it[0] === id)) { bd.plan[bdDay].items.push([id, ...builder.defaults(LIB[id])]); drawSearch(); toast(`Added ${LIB[id].name}`); } };
$('#bdSearchClose').onclick = () => { $('#bdSearch').hidden = true; drawBuilder(); };
$('#bdAddDay').onclick = () => { bd.plan.push({ name: `Day ${bd.plan.length + 1}`, focus: '', items: [] }); drawBuilder(); };
$('#bdCancel').onclick = () => { bd = null; $('#builder').hidden = true; };
$('#bdSave').onclick = () => {
  bd.name = $('#bdName').value; bd.tagline = $('#bdTag').value;
  const errs = builder.validate(bd, LIB);
  if (errs.length) { $('#bdErr').textContent = errs.slice(0, 3).join(' '); $('#bdErr').hidden = false; return; }
  const p = builder.finalize(bd), list = (S.customPrograms ||= []), i = list.findIndex(x => x.id === p.id);
  i >= 0 ? (list[i] = p) : list.unshift(p);
  // Editing the program you're on updates this month's plan too.
  if (S.program?.id === p.id) S.program.plan = p.plan;
  persist(); bd = null; $('#builder').hidden = true; renderPrograms(); renderToday(); toast(`Saved "${p.name}". Tap it to start.`);
  showProgram(p.id);
};
$('#buildNew').onclick = () => openBuilder();
$('#rsheetBody').addEventListener('click', e => {
  const ed = e.target.closest('[data-progedit]'), del = e.target.closest('[data-progdel]');
  if (ed) { const p = programById(ed.dataset.progedit); closeSheet(); openBuilder(p.custom ? p : builder.fromTemplate(p)); }
  if (del) { S.customPrograms = (S.customPrograms || []).filter(p => p.id !== del.dataset.progdel); persist(); closeSheet(); renderPrograms(); toast('Program deleted.'); }
});

/* ---------- Programs ---------- */
// The program's rep target for an exercise on today's program day (feeds the progression engine).
function programScheme(k) {
  const it = (dayItems() || []).find(x => x[0] === k);
  return it ? progScheme(it[1], it[2]) : undefined;
}
// A program day counts as trained when a set of one of its exercises is saved.
function logProgramDay(k) {
  const d = programDay(); if (!d || d.doneToday || !d.day.items.some(x => x[0] === k)) return;
  (S.program.log ||= []).push({ day: d.index, at: Date.now() }); persist();
}
function renderPrograms() {
  const act = activeProgram(), d = programDay();
  $('#progActive').textContent = act ? `On ${act.name} · ${d.doneToday ? 'today done ✓' : 'next: ' + d.day.name}` : '';
  const all = [...(S.customPrograms || []), ...PROGRAMS];
  const list = act ? [act, ...all.filter(p => p.id !== act.id)] : all;
  $('#progStrip').innerHTML = list.map(p => `<button type="button" role="listitem" class="prog-card ${p.id === act?.id ? 'on' : ''}" data-prog="${p.id}">
    <span class="pgoal">${p.custom ? 'Yours' : esc(p.goal)}${p.id === act?.id ? ` · month ${S.program.block || 1}` : ''}</span><b>${esc(p.name)}</b><p>${esc(p.tagline)}</p>
    <span class="meta">${p.days} days/week · ${p.weeks} weeks · ~${Math.round(weeklySets(p))} sets/week · ${esc(p.level)}</span></button>`).join('');
}
function showProgram(id) {
  const on = S.program?.id === id, p = on ? activeProgram() : programById(id); if (!p) return;
  openSheet(`<div><span class="eyebrow">${esc(p.goal)} · ${esc(p.level)}</span><h2 class="display h2" id="rsheetTitle" style="margin-top:6px;font-size:1.4rem">${esc(p.name)}</h2></div>
    <p style="margin:0">${esc(p.tagline)}</p>
    <p class="muted small" style="margin:0"><b>How it works:</b> ${esc(p.method)} QK picks your weights from how each session went.</p>
    <p class="data small" style="margin:0">${p.days} days a week · ${p.weeks} weeks · about ${Math.round(weeklySets(p))} working sets a week</p>
    ${p.plan.map(dd => { const lb = SS.labels(dd.items); return `<div class="prog-day"><h3>${esc(dd.name)} <span class="muted small">· ${esc(dd.focus)}</span></h3><ol>${dd.items.map((it, ix) => `<li>${lb[ix] ? `<span class="ss">${lb[ix]}</span> ` : ''}${esc(LIB[it[0]]?.name || it[0])} <span>${it[1]} × ${esc(it[2])}${it[3] ? ` · rest ${it[3] < 120 ? it[3] + ' s' : it[3] / 60 + ' min'}` : ''}</span>${it[4] ? `<br><span class="muted small">${esc(it[4])}</span>` : ''}</li>`).join('')}</ol></div>`; }).join('')}
    <div class="btn-row"><button class="ghost" type="button" data-progedit="${p.id}">${p.custom ? 'Edit' : 'Copy and edit'}</button>${p.custom && !on ? `<button class="ghost" type="button" data-progdel="${p.id}">Delete</button>` : ''}${on ? '<button class="ghost" type="button" data-progstop>Stop this program</button>' : ''}<button class="cta" type="button" data-progstart="${p.id}">${on ? 'Restart from day 1' : 'Start this program'}</button></div>`);
}
$('#progStrip').onclick = e => { const b = e.target.closest('[data-prog]'); if (b) showProgram(b.dataset.prog); };
$('#rsheetBody').addEventListener('click', e => {
  const st = e.target.closest('[data-progstart]'), sp = e.target.closest('[data-progstop]');
  if (st) { S.program = { id: st.dataset.progstart, start: Date.now(), blockStart: Date.now(), block: 1, log: [] }; persist(); closeSheet(); renderPrograms(); renderToday(); const p = activeProgram(); toast(`${p.name} started. Day 1 is on your Today screen.`); say(`${p.name}. Let's go. Day one is ready on your Today screen.`, { priority: 'high' }); }
  if (sp) { S.program = null; persist(); closeSheet(); renderPrograms(); renderToday(); toast('Program stopped.'); }
});

/* ---------- Progress ---------- */
function lineChart(vals, { min, max, suffix = '', labels, marks }) {
  const W = 360, H = 150, l = 34, r = 12, t = 14, b = 24, n = vals.length;
  const X = i => l + (n === 1 ? 0 : i * (W - l - r) / (n - 1)), Y = v => t + (1 - (v - min) / (max - min || 1)) * (H - t - b);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img"><defs><linearGradient id="fillG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--z2)" stop-opacity=".35"/><stop offset="1" style="stop-color:var(--z2)" stop-opacity="0"/></linearGradient></defs>`;
  const ticks = 3; for (let k = 0; k <= ticks; k++) { const v = min + (max - min) * k / ticks; s += `<line x1="${l}" x2="${W - r}" y1="${Y(v)}" y2="${Y(v)}" style="stroke:var(--line)"/><text x="${l - 8}" y="${Y(v) + 4}" text-anchor="end" style="fill:var(--muted)" font-size="10" font-family="IBM Plex Mono, monospace">${Math.round(v)}${suffix}</text>`; }
  labels.forEach((lb, i) => { if (n <= 8 || i % Math.ceil(n / 6) === 0 || i === n - 1) s += `<text x="${X(i)}" y="${H - 6}" text-anchor="middle" style="fill:var(--muted)" font-size="10" font-family="IBM Plex Mono, monospace">${lb}</text>`; });
  const path = vals.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');
  s += `<path d="${path} L${X(n - 1)} ${H - b} L${X(0)} ${H - b} Z" fill="url(#fillG)"/><path d="${path}" fill="none" stroke="url(#zoneStroke)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (marks) vals.forEach((v, i) => { if (marks[i]) s += `<circle cx="${X(i)}" cy="${Y(v)}" r="4" fill="#E5A84C"/>`; });
  s += `<circle cx="${X(n - 1)}" cy="${Y(vals[n - 1])}" r="9" style="fill:var(--z3)" fill-opacity=".25"/><circle cx="${X(n - 1)}" cy="${Y(vals[n - 1])}" r="4.5" style="fill:var(--text)"/></svg>`;
  return s;
}

// The reward line on the set summary: a milestone passed in this set, a perfect set, or how close
// the next milestone is. The clean-rep total doesn't include this set yet (it's saved after this).
function renderSetReward({ reps, good, hold, demo }) {
  const box = $('#sReward');
  if (!reps || hold || demo) { box.hidden = true; return; }
  const before = rewards.lifetimeClean(S.sessions, isHoldId), after = before + Math.min(good, reps);
  const tier = rewards.crossed(before, after), perfect = rewards.isPerfect(reps, good), pr = rewards.progress(after);
  box.hidden = false; box.classList.toggle('won', !!(tier || perfect));
  $('#sMedal').textContent = tier || perfect ? '★' : '↑';
  $('#sRewardTitle').textContent = tier ? `${tier.name} unlocked: ${tier.n} clean reps` : perfect ? `Perfect set: all ${reps} reps clean` : `+${Math.min(good, reps)} clean reps`;
  $('#sRewardSub').textContent = pr.next ? `${pr.left} more clean rep${pr.left === 1 ? '' : 's'} to ${pr.next.name} (${pr.next.n}).` : `${after} clean reps. Every medal earned.`;
  $('#sRewardBar').style.width = Math.round(pr.frac * 100) + '%';
  if (perfect && !tier) say(`Perfect set. All ${reps} reps clean.`, { id: 'perfect', priority: 'high' });
}

function renderRewards() {
  const total = rewards.lifetimeClean(S.sessions, isHoldId), pr = rewards.progress(total), perfect = rewards.perfectSets(S.sessions, isHoldId);
  $('#rwTotal').textContent = total;
  $('#rwTitle').textContent = pr.earned.length ? pr.earned[pr.earned.length - 1].name : 'Clean reps';
  $('#rwNext').textContent = pr.next ? `${pr.left} more clean rep${pr.left === 1 ? '' : 's'} to ${pr.next.name}. Only reps with good form count.` : 'Every medal earned. Legend.';
  $('#rwBar').style.width = Math.round(pr.frac * 100) + '%';
  $('#rwMedals').innerHTML = rewards.TIERS.map(t => `<div class="${total >= t.n ? 'on ' + t.medal : ''}"><span>${t.n >= 1000 ? t.n / 1000 + 'k' : t.n}</span>${esc(t.name)}</div>`).join('');
  $('#rwPerfect').textContent = perfect ? `${perfect} perfect set${perfect === 1 ? '' : 's'} (5+ reps, every one clean).` : 'Perfect set: 5 or more reps, every one clean.';
}

function renderProgress() {
  renderRewards(); renderStrength();
  const sets = S.sessions.filter(s => s.reps && !s.guided).slice(-12);
  const scores = sets.map(s => Math.round(s.good / s.reps * 100));
  $('#pfScore').textContent = scores.length ? scores[scores.length - 1] + '%' : '–';
  $('#pfDelta').textContent = scores.length >= 2 ? `${scores[scores.length - 1] - scores[0] >= 0 ? '+' : ''}${scores[scores.length - 1] - scores[0]} pts` : '';
  $('#pfDelta').style.color = scores.length >= 2 && scores[scores.length - 1] >= scores[0] ? 'var(--good)' : 'var(--muted)';
  $('#formChart').innerHTML = scores.length >= 2 ? lineChart(scores, { min: Math.max(0, Math.min(...scores) - 10), max: 100, suffix: '%', labels: sets.map((s, i) => `S${i + 1}`) }) : '<p class="empty">Train with the camera twice to see your form trend.</p>';

  const days = store.activeDays(S), cells = [], today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today); start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - 7 * 11);
  const dk = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const repsOn = {}; S.sessions.forEach(s => { const k = dk(new Date(s.at)); repsOn[k] = (repsOn[k] || 0) + s.reps; });
  for (let d = 0; d < 7; d++) for (let w = 0; w < 12; w++) {
    const x = new Date(start); x.setDate(start.getDate() + w * 7 + d); const k = dk(x);
    const lvl = !days.has(k) ? 0 : (repsOn[k] || 0) >= 30 ? 3 : (repsOn[k] || 0) >= 10 ? 2 : 1;
    cells.push(`<i class="${lvl ? 'l' + lvl : ''} ${x > today ? 'future' : ''}" title="${x.toLocaleDateString()}"></i>`);
  }
  $('#heat').innerHTML = cells.join('');
  $('#consTitle').textContent = days.size ? `${days.size} training day${days.size > 1 ? 's' : ''} logged` : 'Every session counts';

  const bfs = S.scans.filter(s => s.bf);
  $('#bfNow').textContent = bfs.length ? bfs[bfs.length - 1].bf.toFixed(1) + '%' : '–';
  $('#bfChart').innerHTML = bfs.length >= 2 ? lineChart(bfs.map(s => s.bf), { min: Math.floor(Math.min(...bfs.map(s => s.bf)) - 1), max: Math.ceil(Math.max(...bfs.map(s => s.bf)) + 1), suffix: '%', labels: bfs.map(s => new Date(s.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })) }) : '<p class="empty">Log two measurements to see your trend.</p>';

  const rules = Object.values(EXERCISES).flatMap(allRules), first = {}, last = {};
  const half = Math.floor(S.sessions.length / 2);
  S.sessions.forEach((s, i) => Object.entries(s.faults || {}).forEach(([id, n]) => { (i < half ? first : last)[id] = ((i < half ? first : last)[id] || 0) + n; }));
  const ids = [...new Set([...Object.keys(first), ...Object.keys(last)])].sort((a, b) => ((first[b] || 0) + (last[b] || 0)) - ((first[a] || 0) + (last[a] || 0))).slice(0, 5);
  $('#faultList').innerHTML = ids.length ? ids.map(id => { const r = rules.find(x => x.id === id); return `<div class="row"><div><b class="small">${esc(r?.cue || id)}</b><br><span class="muted small">${esc(r?.why || '')}</span></div><span class="r data">${first[id] || 0} → ${last[id] || 0}</span></div>`; }).join('') : '<p class="empty">Form faults from your sets will show here, and fade as you fix them.</p>';
}

/* ---------- Bar speed summary ---------- */
function renderVBT(ex, reps) {
  const card = $('#vbtCard'), vr = bar.reps;
  card.hidden = !(vbtOn() && reps);
  if (card.hidden) return;
  if (!vr.length) {
    $('#vbtBest').textContent = '–'; $('#vbtZone').textContent = ''; $('#vbtBars').innerHTML = ''; $('#vbtTable').innerHTML = '';
    $('#vbtNote').textContent = S.profile.heightCm ? 'Bar speed needs a 45 cm plate in view: tap Calibrate during your next set.' : 'Add your height in Profile, or tap Calibrate during the set and mark a 45 cm plate, to see bar speed.';
    return;
  }
  const best = Math.max(...vr.map(r => r.mcv)), loss = bar.velocityLoss(), load = parseFloat($('#loadKg').value) || null;
  $('#vbtBest').textContent = `${best.toFixed(2)} m/s`; $('#vbtZone').textContent = velocityZone(best);
  $('#vbtBars').innerHTML = vr.map(r => `<i style="height:${Math.max(6, r.mcv / best * 100)}%" title="${r.mcv.toFixed(2)} m/s"></i>`).join('');
  const lift = ex.patternKey === 'squat' ? 'squat' : ex.patternKey === 'bench' ? 'bench' : ex.patternKey === 'rdl' ? 'deadlift' : ex.patternKey === 'press' ? 'press' : ex.patternKey === 'row' ? 'row' : 'default';
  S.vbt ||= [];
  if (load && live?.source !== 'demo') { S.vbt.push({ at: Date.now(), ex: exKey, loadKg: load, mcv: best }); persist(); }
  const month = Date.now() - 30 * 864e5, sets = S.vbt.filter(v => v.ex === exKey && v.at > month);
  const e = estimate1RM(sets, lift);
  $('#vbtTable').innerHTML = `<span>Mean speed, first rep</span><span>${vr[0].mcv.toFixed(2)} m/s</span><span>Peak speed</span><span>${Math.max(...vr.map(r => r.peak)).toFixed(2)} m/s</span>
    <span>Bar travel</span><span>${Math.round(vr[0].romM * 100)} cm</span><span>Speed loss in the set</span><span class="${loss >= .3 ? 'hot' : ''}">${Math.round(loss * 100)}%</span>
    ${e ? `<span>Estimated 1-rep max</span><span class="${e.reliable ? 'ok' : 'hot'}">${Math.round(e.e1rm)} kg${e.reliable ? '' : ' (rough)'}</span>` : ''}`;
  $('#vbtNote').textContent = (live?.mPerPx && live.calibrated ? 'Calibrated with the plate. ' : 'Scaled from your height (±5%). Calibrate with the plate for exact speed. ')
    + (e ? (e.reliable ? '' : 'Log sets at 3+ different weights, at least 20% apart, for a reliable 1-rep max.') : load ? 'Log this lift at another weight to estimate your 1-rep max.' : 'Enter the weight before a set to build your load–speed profile.');
}

/* ---------- Plate calibration: tap the top and bottom edge of a 45 cm plate ---------- */
$('#calBtn').onclick = () => {
  if (!live) return; live.calPts = []; $('#viewport').classList.add('calibrating');
  $('#status').textContent = 'Tap the TOP edge of a 45 cm plate';
};
$('#viewport').addEventListener('click', e => {
  if (!live?.calPts) return;
  const c = $('#overlay'), r = c.getBoundingClientRect();
  const k = Math.min(r.width / c.width, r.height / c.height), ox = (r.width - c.width * k) / 2, oy = (r.height - c.height * k) / 2;
  let x = e.clientX - r.left; if ($('#viewport').classList.contains('mirror')) x = r.width - x; // undo the selfie mirror
  live.calPts.push({ x: (x - ox) / k, y: (e.clientY - r.top - oy) / k });
  if (live.calPts.length === 1) { $('#status').textContent = 'Now tap the BOTTOM edge of the same plate'; return; }
  const s = scaleFromPlate(live.calPts[0], live.calPts[1]);
  live.calPts = null; $('#viewport').classList.remove('calibrating');
  if (!s) { $('#status').textContent = 'Those points were too close. Tap Calibrate and try again.'; setTimeout(() => live && ($('#status').textContent = ''), 2500); return; }
  live.mPerPx = s; live.calibrated = true; bar.reset();
  $('#status').textContent = 'Calibrated. Bar speed is now exact.'; setTimeout(() => live && ($('#status').textContent = ''), 1800);
});

/* ---------- Guided two-view posture screen ---------- */
const fullScan = {};
async function guidedScan(file, want) {
  if (!file) return;
  const slot = $(want === 'front' ? '#frontSlot' : '#sideSlot');
  try {
    const { w, h, lms } = await landmarksFrom(file);
    if (!lms) return toast('No full body found. Stand further back in good light.');
    const px = toPx(lms, w, h), view = viewOf(px);
    if (view !== want) return toast(want === 'front' ? 'That looks side-on. Face the camera for photo 1.' : 'That looks front-on. Turn side-on for photo 2.');
    const problem = stanceProblem(px, view); if (problem) return toast(problem);
    fullScan[want] = analyse(px);
    slot.firstChild.textContent = (want === 'front' ? '1 · Front ✓' : '2 · Side ✓');
    renderFullScan();
  } catch (e) { console.error(e); toast('That file couldn\'t be read. Try a JPG photo.'); }
}
function renderFullScan() {
  const box = $('#fullScreen'), f = fullScan.front, sd = fullScan.side;
  box.hidden = !(f || sd);
  const issues = [...(f?.findings || []), ...(sd?.findings || [])].filter(x => !x.good);
  box.innerHTML = `${!f || !sd ? `<p class="muted small" style="margin:0">${f ? 'Now add the side photo.' : 'Now add the front photo.'}</p>` : ''}
    <div class="kv">${[...(f?.metrics || []), ...(sd?.metrics || [])].map(([k, v, bad]) => `<span>${esc(k)}</span><span class="${bad ? 'hot' : 'ok'}">${esc(v)}</span>`).join('')}</div>
    ${issues.length ? findingsHTML(issues.map(x => ({ ...x, ok: false }))) : f && sd ? findingsHTML([{ ok: true, title: 'Balanced posture from both views', why: 'No alignment issues beyond normal ranges.', fix: [] }]) : ''}`;
  if (f && sd) { S.scans.push({ at: Date.now(), view: 'both', findings: issues.map(x => x.title) }); persist(); say(issues.length ? `Full screen done. ${issues.length} thing${issues.length > 1 ? 's' : ''} to work on, starting with ${issues[0].title}.` : 'Full screen done. Your posture looks balanced from the front and the side.', { id: 'fullscan_' + Date.now(), priority: 'high' }); }
}
$('#scanFront').onchange = e => { guidedScan(e.target.files[0], 'front'); e.target.value = ''; };
$('#scanSide').onchange = e => { guidedScan(e.target.files[0], 'side'); e.target.value = ''; };

/* ---------- Diagnostics ---------- */
function renderDiag() {
  const errs = ErrorLog.read(), last = recorder2.toJSON();
  $('#diagTable').innerHTML = `<span>App version</span><span>${APP_VERSION}</span><span>Live tracking model</span><span>${liveModelName()}</span>
    <span>Last session</span><span>${last.frames.length ? `${last.meta.kind} · ${last.frames.length} frames · ${Math.round(measuredFps(last.frames.map(f => f.t))) || '–'} fps` : 'none yet'}</span>
    ${last.meta?.result?.quality ? `<span>Last recording quality</span><span>${last.meta.result.quality.score}/100</span>` : ''}
    <span>Errors logged</span><span class="${errs.length ? 'hot' : 'ok'}">${errs.length}</span>`;
}
$('#diagCard').addEventListener('toggle', () => { if ($('#diagCard').open) renderDiag(); });
try { $('#precisionSel').value = localStorage.getItem('qk_precision') || ''; } catch {}
$('#precisionSel').onchange = e => { try { e.target.value ? localStorage.setItem('qk_precision', e.target.value) : localStorage.removeItem('qk_precision'); } catch {} renderDiag(); toast('Tracking precision saved'); };
$('#exportSession').onclick = () => { if (!recorder2.meta.kind) return toast('No session recorded yet.'); downloadJSON(`shred-session-${Date.now()}.json`, recorder2.toJSON()); };
$('#backupBtn').onclick = () => downloadJSON(`shred-backup-${new Date().toISOString().slice(0, 10)}.json`, S);
$('#restoreFile').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!data || typeof data !== 'object' || !Array.isArray(data.sessions)) throw new Error('not a Shred backup');
    store.save(data); toast('Restored. Reloading…'); setTimeout(() => location.reload(), 800);
  } catch { toast('That file isn\'t a Shred backup.'); }
};
$('#sendWeek').onclick = async () => {
  const faultName = id => { for (const k of Object.keys(LIB)) { const r = exFor(k) && allRules(exFor(k)).find(x => x.id === id); if (r) return r.cue; } return id; };
  const rk = S.rehab?.active?.checkins?.slice(-1)[0];
  const light = rk ? painLight({ ...rk, usualMorning: S.rehab.active.usualMorning }, COND[S.rehab.active.cond].painLimit).light : null;
  const text = weekSummary(S, { faultName, light, isHold: isHoldId }) + progressionLines();
  try { if (navigator.share) { await navigator.share({ text }); return; } } catch (err) { if (err?.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); toast('Copied. Paste it into WhatsApp or a message to QK.'); }
  catch { $('#weekText').textContent = text; $('#weekText').hidden = false; toast('Select the text below and copy it.'); }
};
$('#exportErrors').onclick = () => downloadJSON(`shred-errors-${Date.now()}.json`, { app: APP_VERSION, ua: navigator.userAgent, errors: ErrorLog.read() });

/* ---------- Rehab clinic ---------- */
S.rehab ||= { active: null, history: [] };
let rehabArea = 'Knee';
const plan = () => S.rehab.active;
const condOf = p => COND[p.cond];
const openSheet = html => { $('#rsheetBody').innerHTML = html; $('#rsheet').hidden = false; };
const closeSheet = () => { $('#rsheet').hidden = true; };
$('#rsheet').onclick = e => { if (e.target.id === 'rsheet') closeSheet(); };

function renderRehab() {
  const p = plan();
  $('#rehabStart').hidden = !!p; $('#rehabActive').hidden = !p;
  $('#rehabTitle').textContent = p ? condOf(p).name : 'Recover with a plan';
  if (!p) {
    $('#areaChips').innerHTML = AREAS.map(a => `<button type="button" class="mchip ${a === rehabArea ? 'on' : ''}" data-area="${a}">${a}</button>`).join('');
    $('#condList').innerHTML = CONDITIONS.filter(c => c.area === rehabArea).map(c => `<button type="button" class="cond" data-cond="${c.id}"><b>${esc(c.name)}</b><span>${esc(c.about)}</span>
      <span class="tags"><span class="pill">${c.phases.length} phases</span>${c.tests.length ? `<span class="pill cam">${c.tests.length} camera test${c.tests.length > 1 ? 's' : ''}</span>` : ''}${c.postOp ? '<span class="pill voice">Physio-led after surgery</span>' : ''}</span></button>`).join('');
    return;
  }
  renderRehabDashboard();
}
$('#areaChips').onclick = e => { const b = e.target.closest('[data-area]'); if (b) { rehabArea = b.dataset.area; renderRehab(); } };
$('#condList').onclick = e => { const b = e.target.closest('[data-cond]'); if (b) openSafety(COND[b.dataset.cond]); };

// 1. Safety screen: every question must be answered.
function openSafety(c) {
  const qs = [...c.flags, ...GENERAL_FLAGS];
  const structural = ['acl', 'pcl', 'meniscus'].includes(c.id);
  openSheet(`<div><span class="eyebrow">Step 1 of 2 · safety check</span><h2 class="display h2" id="rsheetTitle" style="margin-top:6px;font-size:1.3rem">${esc(c.name)}</h2>
    <p class="muted small" style="margin:6px 0 0">Answer honestly. These questions pick up problems that need a doctor, not exercise.</p></div>
    <div id="flagList">${qs.map((f, i) => `<div class="flag-q" data-i="${i}"><span>${esc(f.q)}</span><span class="yn"><button type="button" class="yes" data-v="1">Yes</button><button type="button" class="no" data-v="0">No</button></span></div>`).join('')}
    <div class="flag-q" data-i="dx"><span>Has a physio or doctor diagnosed this problem?</span><span class="yn"><button type="button" class="yes" data-v="1">Yes</button><button type="button" class="no" data-v="0">No</button></span></div>
    ${c.postOp ? `<div class="flag-q" data-i="op"><span>Have you had surgery for this?</span><span class="yn"><button type="button" class="yes" data-v="1">Yes</button><button type="button" class="no" data-v="0">No</button></span></div>` : ''}</div>
    <button class="cta" type="button" id="safetyGo">Continue</button><p class="note" id="safetyMsg"></p>`);
  const ans = {};
  $('#flagList').onclick = e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    const row = b.closest('.flag-q'); ans[row.dataset.i] = b.dataset.v === '1';
    row.querySelectorAll('[data-v]').forEach(x => x.classList.toggle('on', x === b));
  };
  $('#safetyGo').onclick = () => {
    const need = [...qs.map((_, i) => String(i)), 'dx', ...(c.postOp ? ['op'] : [])];
    if (need.some(k => ans[k] === undefined)) { $('#safetyMsg').textContent = 'Please answer every question.'; return; }
    const level = triage(qs.map((f, i) => ({ yes: ans[i], level: f.level, unchecked: f.unchecked })), { diagnosed: ans.dx });
    const hit = qs.filter((f, i) => ans[i] && f.level === level && !(ans.dx && (f.unchecked || f.level === 'assess')));
    if (level) return showStop(level, hit);
    if (!ans.dx && structural) return showStop('assess', [{ q: 'This injury needs a confirmed diagnosis (often a scan) before rehab, because the right programme depends on what\'s damaged.' }]);
    openBaseline(c, { diagnosed: ans.dx, postOp: !!ans.op });
  };
}

function showStop(level, hits) {
  const a = FLAG_ADVICE[level];
  openSheet(`<div class="alert ${level}"><b>${a.title}</b><span>${a.text}</span>
    ${level === 'emergency' ? '<span class="emergency-num">999</span><span class="small">UK emergency number. Outside the UK, use your local number.</span>' : ''}
    ${hits.map(h => `<span class="small">• ${esc(h.q)}${h.why ? ' ' + esc(h.why) : ''}</span>`).join('')}</div>
    <p class="muted small" style="margin:0">Once you've been checked and cleared, come back and start your programme.</p>
    <button class="ghost full" type="button" id="stopOk">OK</button>`);
  say(`${a.title}. ${a.text}`, { id: 'stop_' + Date.now(), priority: 'high' });
  $('#stopOk').onclick = closeSheet;
}

// 2. Baseline: side, PSFS activities, usual morning pain.
function openBaseline(c, info) {
  const limb = !['lbp', 'neck'].includes(c.id);
  openSheet(`<div><span class="eyebrow">Step 2 of 2 · your starting point</span><h2 class="display h2" id="rsheetTitle" style="margin-top:6px;font-size:1.3rem">What can't you do?</h2>
    <p class="muted small" style="margin:6px 0 0">List up to 3 everyday activities this problem makes hard, and rate each one: 0 = can't do it, 10 = as well as before.</p></div>
    ${limb ? `<div class="mode-switch three" role="group" aria-label="Injured side" id="sideSel"><button type="button" data-s="L">Left</button><button type="button" data-s="R">Right</button><button type="button" class="on" data-s="">Both / n/a</button></div>` : ''}
    ${[0, 1, 2].map(i => `<div class="grid2"><label class="field">Activity ${i + 1}<input id="act${i}" placeholder="${['e.g. Walking upstairs', 'e.g. Running 5 km', 'e.g. Squatting to lift'][i]}"></label>
      <label class="field slider">Ability <span class="val" id="actv${i}">5</span><input type="range" min="0" max="10" value="5" id="actr${i}"></label></div>`).join('')}
    <label class="field slider">Pain first thing in the morning (usual) <span class="val" id="umv">2</span><input type="range" min="0" max="10" value="2" id="um"></label>
    ${info.postOp ? '<div class="alert assess"><b>After surgery</b><span class="small">Follow your surgeon\'s and physio\'s protocol first: their timelines and restrictions override this programme. Use Shred to track your measurements and do the exercises they approve.</span></div>' : ''}
    ${!info.diagnosed ? '<div class="alert assess"><b>Not yet diagnosed</b><span class="small">Book a physio assessment to confirm what this is. Start phase 1 gently meanwhile, and stop if anything gets worse.</span></div>' : ''}
    <button class="cta" type="button" id="startPlan">Start my programme</button>`);
  let side = '';
  $('#sideSel')?.addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (!b) return; side = b.dataset.s; $$('#sideSel button').forEach(x => x.classList.toggle('on', x === b)); });
  [0, 1, 2].forEach(i => $('#actr' + i).oninput = e => $('#actv' + i).textContent = e.target.value);
  $('#um').oninput = e => $('#umv').textContent = e.target.value;
  $('#startPlan').onclick = () => {
    const acts = [0, 1, 2].map(i => ({ name: $('#act' + i).value.trim(), v: +$('#actr' + i).value })).filter(a => a.name);
    const now = Date.now();
    S.rehab.active = { cond: c.id, startedAt: now, phase: 0, phaseStartedAt: now, injured: side || null, postOp: info.postOp, diagnosed: info.diagnosed,
      acts: acts.map(a => a.name), psfs: acts.length ? [{ at: now, score: psfsScore(acts.map(a => a.v)), ratings: acts.map(a => a.v) }] : [],
      usualMorning: +$('#um').value, checkins: [], tests: [], kneeTests: [] };
    persist(); closeSheet(); renderRehab(); renderToday();
    say(`Your ${c.name.toLowerCase()} programme is ready. Phase one: ${c.phases[0].name}. Do today's exercises, then check in so I can adjust your load.`, { id: 'rehab_start', priority: 'high' });
  };
}

// 3. Dashboard
function renderRehabDashboard() {
  const p = plan(), c = condOf(p), ph = c.phases[p.phase], ev = evaluatePhase(c, p.phase, p);
  const last = p.checkins.slice(-1)[0], lightInfo = last ? painLight(last, c.painLimit) : null;
  const pending = p.checkins.find(k => k.nextMorning == null && Date.now() - k.at > 8 * 3600e3 && Date.now() - k.at < 48 * 3600e3);
  const latest = id => [...p.tests].reverse().find(t => t.test === id);
  const testRow = id => { const d = ROM_TESTS[id], t = latest(id); const v = t ? (t.value != null ? `${t.value}${d.unit === '°' ? '°' : ' ' + d.unit}${t.side ? ` (${t.side === 'L' ? 'left' : 'right'})` : ''}` : `L ${t.L ?? '–'} · R ${t.R ?? '–'}`) : 'not tested'; return `<div class="row"><div><b class="small">${esc(d.name)}</b><br><span class="muted small">${esc(v)} · typical ${esc(d.norm)}</span></div><button type="button" class="ghost" data-romtest="${id}">Test</button></div>`; };
  const painSeries = p.checkins.slice(-12).map(k => k.during), psfsSeries = p.psfs.map(x => x.score);
  $('#rehabActive').innerHTML = `
    ${pending ? `<button type="button" class="card rehab-today" id="morningBtn"><span class="eyebrow" style="color:var(--warn)">Quick check</span><b>How does it feel this morning?</b><span class="muted small">This tells QK whether yesterday's load was right.</span></button>` : ''}
    <div class="card stack">
      <div class="card-head" style="margin:0"><div><span class="eyebrow">Phase ${p.phase + 1} of ${c.phases.length}${p.postOp ? ' · after surgery: physio-led' : ''}</span><h2 class="display h2">${esc(ph.name)}</h2><span class="muted small">${esc(ph.goal)}</span></div></div>
      <div class="phase-track">${c.phases.map((_, i) => `<i class="${i < p.phase ? 'done' : i === p.phase ? 'now' : ''}"></i>`).join('')}</div>
    </div>
    <div class="card"><span class="eyebrow">Today's exercises</span>
      <div style="margin-top:4px">${ph.exercises.map(([id, dose]) => { const x = LIB[id]; return `<button type="button" class="ex-row" data-train="${id}" style="width:100%;background:none;border-left:0;border-right:0;border-bottom:0;text-align:left;cursor:pointer;padding-inline:0"><span class="pic">${icon(iconKey(id))}</span><div><b>${esc(x.name)}</b><span class="tag" style="${x.pattern ? '' : 'color:var(--z3)'}">${x.pattern ? 'QK checks your form' : 'QK coaches your tempo'}</span></div><span class="sets">${esc(dose)}</span></button>`; }).join('')}</div>
      <div class="stack" style="margin-top:12px"><button class="cta" type="button" id="checkinRehab">Check in after today's session</button></div>
      ${lightInfo ? `<p style="margin:12px 0 0"><span class="light ${lightInfo.light}">${lightInfo.light === 'green' ? 'On track' : lightInfo.light === 'amber' ? 'Hold the load' : 'Ease off'}</span><br><span class="muted small">${esc(lightInfo.advice)}</span></p>` : ''}
    </div>
    <div class="card"><span class="eyebrow">To move to the next phase</span>
      <div style="margin-top:8px">${ev.items.map(i => `<div class="crit ${i.met ? 'met' : ''}"><span class="tick">${i.met ? '✓' : ''}</span><span>${esc(i.label)}<small>${esc(i.detail || '')}</small></span></div>`).join('')}</div>
      ${ev.allMet && p.phase < c.phases.length - 1 ? `<button class="cta" type="button" id="nextPhase" style="margin-top:10px">Move to phase ${p.phase + 2}</button>` : ''}
      ${ev.allMet && p.phase === c.phases.length - 1 ? `<div class="alert assess" style="margin-top:10px"><b>All criteria met</b><span class="small">You've completed the programme. Keep the strength work going 2× a week to prevent it coming back.</span></div>` : ''}
    </div>
    ${c.tests.length || ph.criteria.some(k => k.type === 'kneeTest') ? `<div class="card"><span class="eyebrow">Your measurements</span><div class="list" style="margin-top:6px">${c.tests.map(testRow).join('')}
      ${ph.criteria.some(k => k.type === 'kneeTest') ? `<div class="row"><div><b class="small">Single-leg squat knee test</b><br><span class="muted small">${p.kneeTests.length ? `L ${p.kneeTests.slice(-1)[0].L ?? '–'}° · R ${p.kneeTests.slice(-1)[0].R ?? '–'}°` : 'not tested'}</span></div><button type="button" class="ghost" id="goKneeTest">Test</button></div>` : ''}</div></div>` : ''}
    <div class="card stack"><div class="card-head" style="margin:0"><div><span class="eyebrow">Daily activities</span><div class="num" style="font-size:1.8rem;margin-top:4px">${psfsSeries.length ? psfsSeries[psfsSeries.length - 1] + '/10' : '–'}</div></div><button type="button" class="ghost" id="rerate">Re-rate</button></div>
      ${psfsSeries.length >= 2 ? lineChart(psfsSeries, { min: 0, max: 10, labels: p.psfs.map(x => new Date(x.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })) }) : '<span class="muted small">Re-rate every week to see your progress.</span>'}
      ${painSeries.length >= 2 ? `<span class="eyebrow">Pain during exercise</span>${lineChart(painSeries, { min: 0, max: 10, labels: painSeries.map((_, i) => String(i + 1)) })}` : ''}</div>
    <details class="card"><summary>About ${esc(c.name.toLowerCase())}</summary><p class="small" style="margin:10px 0 0">${esc(c.about)}</p><p class="muted small">${esc(c.evidence)}</p>
      <p class="muted small">Pain rule: up to ${c.painLimit}/10 during exercise is OK if it settles by the next morning.</p></details>
    <div class="btn-row">${p.phase > 0 ? '<button class="ghost" type="button" id="prevPhase">Step back a phase</button>' : ''}<button class="ghost" type="button" id="endPlan">End programme</button></div>
    <p class="muted small" style="margin:0">Shred supports rehabilitation; it doesn't diagnose or replace your physiotherapist or doctor. If symptoms get worse, or a warning sign appears, stop and get checked.</p>`;
  $('#checkinRehab').onclick = openCheckin;
  $('#morningBtn') && ($('#morningBtn').onclick = () => openMorning(pending));
  $('#nextPhase') && ($('#nextPhase').onclick = () => { p.phase++; p.phaseStartedAt = Date.now(); persist(); renderRehab(); say(`Great work. Phase ${p.phase + 1}: ${c.phases[p.phase].name}.`, { id: 'phase_' + Date.now(), priority: 'high' }); });
  $('#prevPhase') && ($('#prevPhase').onclick = () => { p.phase--; p.phaseStartedAt = Date.now(); persist(); renderRehab(); toast('Stepped back a phase. That\'s a normal part of rehab.'); });
  $('#endPlan').onclick = () => openSheet(`<b id="rsheetTitle">End this programme?</b><p class="muted small" style="margin:0">Your results are kept in your history.</p><div class="btn-row"><button class="ghost" type="button" id="endNo">Keep going</button><button class="stop" type="button" id="endYes">End programme</button></div>`) || ($('#endNo').onclick = closeSheet, $('#endYes').onclick = () => { S.rehab.history.push({ ...p, endedAt: Date.now() }); S.rehab.active = null; persist(); closeSheet(); renderRehab(); renderToday(); });
  $('#rerate').onclick = openRerate;
  $('#goKneeTest') && ($('#goKneeTest').onclick = () => { tab('gait'); $('[data-test=sls]').click(); });
  $$('#rehabActive [data-romtest]').forEach(b => b.onclick = () => startRomTest(b.dataset.romtest));
}

function slider(id, label, v = 0) { return `<label class="field slider">${label} <span class="val" id="${id}v">${v}</span><input type="range" min="0" max="10" value="${v}" id="${id}"></label>`; }
function bindSliders(ids) { ids.forEach(id => $('#' + id).oninput = e => $('#' + id + 'v').textContent = e.target.value); }

function openCheckin() {
  const c = condOf(plan());
  openSheet(`<div><span class="eyebrow">Session check-in</span><h2 class="display h2" id="rsheetTitle" style="margin-top:6px;font-size:1.3rem">How did it feel?</h2>
    <p class="muted small" style="margin:6px 0 0">0 = no pain, 10 = worst imaginable. Your limit for this condition is ${c.painLimit}/10.</p></div>
    ${slider('pd', 'Highest pain during the exercises', 2)}${slider('pa', 'Pain now, after the session', 2)}
    <button class="cta" type="button" id="saveCheckin">Save</button>`);
  bindSliders(['pd', 'pa']);
  $('#saveCheckin').onclick = () => {
    const k = { at: Date.now(), during: +$('#pd').value, after: +$('#pa').value, nextMorning: null };
    plan().checkins.push(k); persist(); closeSheet(); renderRehab();
    const l = painLight({ ...k, usualMorning: plan().usualMorning }, c.painLimit);
    say(l.light === 'green' ? 'Good session. Pain stayed in your safe zone. I\'ll check how it feels tomorrow morning.' : l.light === 'amber' ? 'A little over your limit. Keep the same load next time and we\'ll see how it settles.' : 'That was too much today. Next session, ease off: fewer sets or a smaller range.', { id: 'ck_' + Date.now(), priority: 'high' });
  };
}
function openMorning(k) {
  openSheet(`<h2 class="display h2" id="rsheetTitle" style="font-size:1.3rem">This morning</h2>${slider('pm', 'Pain or stiffness right now', plan().usualMorning ?? 2)}<button class="cta" type="button" id="saveMorning">Save</button>`);
  bindSliders(['pm']);
  $('#saveMorning').onclick = () => {
    k.nextMorning = +$('#pm').value; persist(); closeSheet(); renderRehab();
    const l = painLight({ ...k, usualMorning: plan().usualMorning }, condOf(plan()).painLimit);
    say(l.light === 'red' ? 'It\'s more irritated than usual this morning, so we\'ll go lighter today.' : 'It settled well. Yesterday\'s load was right.', { id: 'mn_' + Date.now(), priority: 'high' });
  };
}
function openRerate() {
  const p = plan(), acts = p.acts.length ? p.acts : ['Your main activity'];
  openSheet(`<h2 class="display h2" id="rsheetTitle" style="font-size:1.3rem">Rate your activities</h2><p class="muted small" style="margin:0">0 = can't do it, 10 = as well as before.</p>
    ${acts.map((a, i) => slider('rr' + i, esc(a), p.psfs.slice(-1)[0]?.ratings?.[i] ?? 5)).join('')}<button class="cta" type="button" id="saveRr">Save</button>`);
  bindSliders(acts.map((_, i) => 'rr' + i));
  $('#saveRr').onclick = () => { const r = acts.map((_, i) => +$('#rr' + i).value); p.psfs.push({ at: Date.now(), score: psfsScore(r), ratings: r }); persist(); closeSheet(); renderRehab(); };
}

// 4. Camera measurement tests
function startRomTest(id) {
  const d = ROM_TESTS[id];
  const go = side => {
    closeSheet();
    TEST.rom = { secs: d.secs, label: d.name, minFps: 20, view: d.view, intro: () => d.how, romId: id, side };
    startLive({ mode: 'rom', source: 'camera' });
  };
  openSheet(`<div><span class="eyebrow">Measurement</span><h2 class="display h2" id="rsheetTitle" style="margin-top:6px;font-size:1.3rem">${esc(d.name)}</h2></div>
    <ol class="steps"><li>${esc(d.how)}</li><li>Recording lasts ${d.secs} seconds and starts after a countdown.</li>${d.view === 'side' && !d.chooseSide ? '<li>The side nearest the camera is measured. Turn around to test the other side.</li>' : ''}</ol>
    ${d.chooseSide ? `<p class="small" style="margin:0">Which leg are you testing?</p><div class="btn-row"><button class="cta" type="button" data-side="L">Left leg</button><button class="cta" type="button" data-side="R">Right leg</button></div>`
      : '<button class="cta" type="button" data-side="">Start</button>'}
    <label class="ghost">Upload a video instead<input type="file" id="romFile" accept="video/*" hidden></label>`);
  $$('#rsheetBody [data-side]').forEach(b => b.onclick = () => go(b.dataset.side || null));
  $('#romFile').onchange = e => { const f = e.target.files[0]; if (!f) return; closeSheet(); TEST.rom = { secs: d.secs, label: d.name, minFps: 20, view: d.view, intro: () => d.how, romId: id, side: null }; startLive({ mode: 'rom', source: 'file', file: f }); };
}

async function finishRom(frames, q) {
  const cfg = TEST.rom, d = ROM_TESTS[cfg.romId], p = plan();
  const mPerPx = scaleFromHeight(frames.slice(0, 20), (S.profile.heightCm || 0) / 100);
  const r = await runRomTest(cfg.romId, frames, { mPerPx });
  tab('rehab');
  if (q.score < 40 || !r.ok) { const msg = q.score < 40 ? 'Recording quality was too low: ' + (q.issues[0] || 'check the camera view.') : r.issues[0]; toast(msg); say(msg, { id: 'rom_fail_' + Date.now(), priority: 'high' }); return; }
  const rec = { at: Date.now(), test: cfg.romId, side: cfg.side || r.side || null, value: r.value, L: r.L, R: r.R, quality: q.score };
  if (p) { p.tests.push(rec); persist(); renderRehab(); }
  const val = r.value != null ? `${r.value}${d.unit === '°' ? ' degrees' : ' ' + d.unit}` : `left ${r.L}, right ${r.R}`;
  say(`${d.name}: ${val}.`, { id: 'rom_' + Date.now(), priority: 'high' });
  toast(`${d.name}: ${r.value != null ? r.value + (d.unit === '°' ? '°' : ' ' + d.unit) : `L ${r.L} · R ${r.R}`}`);
}

function renderRehabToday() {
  const p = plan(), el = $('#rehabToday'); el.hidden = true; if (!p) return; // the next-step card covers rehab now
  const c = condOf(p), ev = evaluatePhase(c, p.phase, p);
  el.innerHTML = `<span class="eyebrow" style="color:var(--good)">Rehab · phase ${p.phase + 1} of ${c.phases.length}</span><b>${esc(c.name)}</b><span class="muted small">${c.phases[p.phase].exercises.length} exercises today · ${ev.items.filter(i => i.met).length}/${ev.items.length} phase goals met</span>`;
  el.onclick = () => tab('rehab');
}

/* ---------- Readiness and training load ---------- */
S.readiness ||= []; S.loads ||= [];
const todayCheck = () => S.readiness.find(c => dayKey(c.at) === dayKey(Date.now()));
function renderReady() {
  const c = todayCheck(), hist = S.readiness.filter(x => x !== c);
  const lastJump = (S.jumps || []).slice(-1)[0], jumpHist = (S.jumps || []).slice(0, -1).map(j => j.cm);
  const jr = lastJump && dayKey(lastJump.at) === dayKey(Date.now()) ? jumpReadiness(lastJump.cm, jumpHist) : null;
  const rk = S.rehab?.active?.checkins?.slice(-1)[0];
  const rl = rk ? painLight({ ...rk, usualMorning: S.rehab.active.usualMorning }, COND[S.rehab.active.cond].painLimit).light : null;
  const rec = recommendToday({ check: c, history: hist, sessions: S.loads, jumpStatus: jr?.status, rehabLight: rl });
  const card = $('#readyCard'); card.className = 'card stack ' + (c ? rec.level + ' answered' : '');
  $('#readyChange').hidden = !c;
  $('#readyResult').hidden = !c;
  $$('[data-feel]').forEach(b => b.classList.toggle('on', !!c && c.feel === b.dataset.feel));
  $('#readyTitle').textContent = c ? rec.title : '';
  $('#readyScore').textContent = c ? readiness(c, hist).score + '/100' : '';
  // Today's camera HRV and alertness test, compared with the client's own normal, add to the reasons.
  const vn = vitalNotes(S.vitals, Date.now()).map(n => n.text);
  $('#readyReasons').innerHTML = c ? [...rec.reasons, ...vn].map(r => '<li>' + esc(r) + '</li>').join('') : '';
  $('#morningCheck').textContent = c ? 'Change or add detail' : 'Add more detail';
  renderNext(c ? rec.level : null);
}
$('#readyChange').onclick = () => { $('#readyCard').classList.remove('answered'); $('#readyChange').hidden = true; };

/* ---------- The one next step on Today ---------- */
function renderNext(level) {
  const today = dayKey(Date.now()), now = new Date();
  const p = S.rehab?.active, c = p && COND[p.cond];
  const morningDue = p ? p.checkins.find(k => k.nextMorning == null && Date.now() - k.at > 8 * 3600e3 && Date.now() - k.at < 48 * 3600e3) : null;
  if (level === undefined) { const t = todayCheck(); level = t ? recommendToday({ check: t, history: S.readiness.filter(x => x !== t), sessions: S.loads }).level : null; }
  const step = nextStep({
    hour: now.getHours(), weekday: now.getDay(), plan: S.plan || { days: [] }, focus: S.profile.focus || 'train', readiness: level,
    trainedToday: S.sessions.some(s => !s.demo && dayKey(s.at) === today) || S.checkins.some(x => dayKey(x.at) === today),
    calmedToday: (S.calm || []).some(x => dayKey(x.at) === today),
    rehab: p ? { name: c.name, phase: p.phase, phases: c.phases.length, morningDue: !!morningDue } : null,
    workout: { name: todayName(), minutes: 38, count: todayItems().length },
  });
  $('#nextCard').dataset.kind = step.kind;
  $('#nextEyebrow').textContent = step.eyebrow; $('#nextTitle').textContent = step.title; $('#nextSub').textContent = step.sub; $('#nextCta').textContent = step.cta;
  $('#todayDetails').hidden = step.kind !== 'workout';
  $('#nextAlt').hidden = !step.secondary; $('#nextAlt').textContent = step.secondary || '';
  const go = {
    'rehab-morning': () => { tab('rehab'); openMorning(morningDue); },
    rehab: () => tab('rehab'), 'rehab-start': () => tab('rehab'),
    calm: () => { tab('calm'); startCalmNow(); }, rest: () => { tab('calm'); startCalmNow(); },
    done: () => tab('progress'), workout: () => startFlow(),
  };
  $('#nextBtn').onclick = go[step.kind];
  $('#nextAlt').onclick = () => openSetup(todayItems()[0][0]);
}
const scale7 = (id, label, lo, hi, v = 3) => `<label class="field slider">${label} <span class="val" id="${id}v">${v}</span><input type="range" min="1" max="7" value="${v}" id="${id}"><span class="muted small" style="display:flex;justify-content:space-between"><span>${lo}</span><span>${hi}</span></span></label>`;
// One tap: Great / OK / Rough maps onto the Hooper scale (1 = very good ... 7 = very bad).
const FEEL = { great: { sleepQ: 2, fatigue: 2, stress: 2, soreness: 2 }, ok: { sleepQ: 4, fatigue: 4, stress: 3, soreness: 3 }, rough: { sleepQ: 6, fatigue: 6, stress: 5, soreness: 6 } };
$$('[data-feel]').forEach(b => b.onclick = () => {
  const entry = { at: Date.now(), sleepH: null, feel: b.dataset.feel, ...FEEL[b.dataset.feel] };
  S.readiness = S.readiness.filter(x => dayKey(x.at) !== dayKey(entry.at)); S.readiness.push(entry); persist(); renderReady();
  say($('#readyTitle').textContent + '.', { id: 'ready_' + Date.now(), priority: 'high' });
});
$('#morningCheck').onclick = () => {
  const c = todayCheck() || {};
  openSheet(`<div><span class="eyebrow">Morning check-in · 20 seconds</span><h2 class="display h2" id="rsheetTitle" style="margin-top:6px;font-size:1.3rem">How are you today?</h2></div>
    <label class="field">Hours slept<input id="rdH" type="number" inputmode="decimal" min="0" max="14" step="0.5" value="${c.sleepH ?? 7.5}"></label>
    ${scale7('rdS', 'Sleep quality', 'great', 'awful', c.sleepQ ?? 3)}${scale7('rdF', 'Tiredness', 'fresh', 'exhausted', c.fatigue ?? 3)}
    ${scale7('rdT', 'Stress', 'relaxed', 'very stressed', c.stress ?? 3)}${scale7('rdM', 'Muscle soreness', 'none', 'very sore', c.soreness ?? 3)}
    <button class="cta" type="button" id="rdSave">Save</button>`);
  bindSliders(['rdS', 'rdF', 'rdT', 'rdM']);
  $('#rdSave').onclick = () => {
    const entry = { at: Date.now(), sleepH: parseFloat($('#rdH').value) || null, sleepQ: +$('#rdS').value, fatigue: +$('#rdF').value, stress: +$('#rdT').value, soreness: +$('#rdM').value };
    S.readiness = S.readiness.filter(x => dayKey(x.at) !== dayKey(entry.at)); S.readiness.push(entry); persist(); closeSheet(); renderReady();
    say(`${$('#readyTitle').textContent}.`, { id: 'ready_' + Date.now(), priority: 'high' });
  };
};
$('#logSession').onclick = () => {
  const firstToday = [...S.sessions, ...S.checkins].filter(s => dayKey(s.at) === dayKey(Date.now())).map(s => s.at).sort()[0];
  const guess = firstToday ? Math.max(10, Math.round((Date.now() - firstToday) / 60000) + 5) : 45;
  openSheet(`<div><span class="eyebrow">Session effort</span><h2 class="display h2" id="rsheetTitle" style="margin-top:6px;font-size:1.3rem">How hard was today's session?</h2>
    <p class="muted small" style="margin:6px 0 0">Rate the whole session now, or any time in the next half hour. 0 = rest, 3 = moderate, 5 = hard, 7 = very hard, 10 = maximal.</p></div>
    <label class="field slider">Effort <span class="val" id="rpeV">5</span><input type="range" min="0" max="10" value="5" id="rpe"></label>
    <label class="field">Minutes<input id="mins" type="number" inputmode="numeric" value="${Math.min(guess, 180)}"></label>
    <button class="cta" type="button" id="loadSave">Save</button>`);
  $('#rpe').oninput = e => $('#rpeV').textContent = e.target.value;
  $('#loadSave').onclick = () => {
    const s = { at: Date.now(), rpe: +$('#rpe').value, minutes: Math.max(0, parseInt($('#mins').value) || 0) };
    S.loads.push(s); persist(); closeSheet(); renderReady(); toast('Saved: ' + sessionLoad(s) + ' training points');
  };
};
function renderLoad() {
  const weeks = [7, 6, 5, 4, 3, 2, 1, 0].map(w => weekStats(S.loads, Date.now() - w * 7 * 864e5).load);
  const sp = loadSpike(S.loads), wk = weekStats(S.loads);
  $('#loadNow').textContent = S.loads.length ? wk.load + ' points' : '–';
  $('#loadDelta').textContent = sp.ratio ? `${sp.ratio >= 1 ? '+' : ''}${Math.round((sp.ratio - 1) * 100)}% vs usual` : '';
  $('#loadDelta').style.color = sp.spike ? 'var(--warn)' : 'var(--muted)';
  if (!S.loads.length) return;
  const max = Math.max(...weeks, 1), W = 360, H = 130, bw = (W - 40) / 8;
  $('#loadChart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Weekly training load, last 8 weeks">${weeks.map((v, i) => { const h = v / max * (H - 30); return `<rect x="${30 + i * bw + 4}" y="${H - 20 - h}" width="${bw - 8}" height="${h}" rx="5" style="fill:${i === 7 ? (sp.spike ? 'var(--warn)' : 'url(#zoneStroke)') : 'var(--surface-2)'}"/><text x="${30 + i * bw + bw / 2}" y="${H - 5}" text-anchor="middle" style="fill:var(--muted)" font-size="10" font-family="IBM Plex Mono, monospace">${i === 7 ? 'now' : '-' + (7 - i) + 'w'}</text>`; }).join('')}</svg>`;
  $('#loadNote').textContent = (sp.spike ? 'This week is well above your usual. Big jumps raise injury risk, so build up gradually. ' : '') + (wk.monotony > 2 ? 'Most days are the same effort. Mix in some easier days.' : 'Effort × minutes for each session you rate.');
}

/* ---------- Studio ---------- */
let studioGroup = 'Coaching', studioRec = null, studioHave = new Set();
async function renderStudio() {
  const cues = cueList(); studioHave = new Set(await listClipIds());
  const groups = [...new Set(cues.map(c => c.group))];
  $('#studioGroups').innerHTML = groups.map(g => `<button type="button" class="mchip ${g === studioGroup ? 'on' : ''}" data-sg="${esc(g)}">${esc(g)}</button>`).join('');
  const done = cues.filter(c => studioHave.has(c.id)).length;
  $('#studioBar').style.width = (done / cues.length * 100) + '%';
  $('#studioCount').textContent = `${done} of ${cues.length} lines recorded`;
  $('#studioList').innerHTML = cues.filter(c => c.group === studioGroup).map(c => `<div class="studio-row" data-cue="${c.id}"><span>${esc(c.text)}${studioHave.has(c.id) ? ' <span class="done">✓ recorded</span>' : ''}</span>
    <span class="acts"><button type="button" data-act="rec">${studioRec?.id === c.id ? 'Stop' : 'Record'}</button>${studioHave.has(c.id) ? '<button type="button" data-act="play">Play</button><button type="button" data-act="del">✕</button>' : ''}</span></div>`).join('');
  if (studioRec) $(`[data-cue="${studioRec.id}"] [data-act=rec]`)?.classList.add('rec');
}
$('#studioCard').addEventListener('toggle', () => { if ($('#studioCard').open) renderStudio(); });
$('#studioGroups').onclick = e => { const b = e.target.closest('[data-sg]'); if (b) { studioGroup = b.dataset.sg; renderStudio(); } };
$('#studioList').onclick = async e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const id = b.closest('[data-cue]').dataset.cue, act = b.dataset.act;
  try {
    if (act === 'rec') {
      if (studioRec?.id === id) { const blob = await studioRec.r.stop(); studioRec = null; await saveClip(id, blob); toast('Saved'); }
      else { if (studioRec) await studioRec.r.stop(); studioRec = { id, r: await startRecording() }; }
    } else if (act === 'play') { const blob = await getClip(id); if (blob) new Audio(URL.createObjectURL(blob)).play(); }
    else if (act === 'del') { await deleteClip(id); }
  } catch (err) { toast('Microphone not available. Allow microphone access for this site.'); studioRec = null; }
  renderStudio();
};
$('#studioExport').onclick = async () => { const data = await exportClips(); if (!Object.keys(data.clips).length) return toast('Record some lines first.'); downloadJSON(`shred-voice-${Date.now()}.json`, data); };

/* ---------- Boot ---------- */
mountOrbs(); bindPlan(); bindProfile(); renderTrain(); renderToday(); applyMute(); renderTestHistory();
if (S.profile.name) {
  // Returning client: straight to Today. The first tap anywhere wakes the voice (phones need a tap before sound).
  $('#welcome').hidden = true;
  document.addEventListener('pointerdown', () => { try { speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch {} getVideoLandmarker().catch(() => {}); }, { once: true });
}
// Home-screen shortcut or a shared link: ?calm=now opens Sukoon.
if (new URLSearchParams(location.search).has('calm') || location.hash === '#calm') { $('#welcome').hidden = true; tab('calm'); startCalmNow(); }
// First run: three short questions, then straight to Today.
const OB_STEPS = ['ob1', 'ob2', 'ob3', 'obGoal', 'obExp'];
const obStep = n => { const id = typeof n === 'number' ? ['ob1', 'ob2', 'ob3'][n - 1] : n; OB_STEPS.forEach(x => $('#' + x).hidden = x !== id); $('#obIntro').hidden = id !== 'ob1'; };
$('#welcomeBtn').onclick = () => {
  const nm = $('#welcomeName').value.trim();
  if (nm && !S.profile.name) { S.profile.name = nm; $('#pName').value = nm; persist(); }
  obStep(2);
  try { getVideoLandmarker().catch(() => {}); } catch {} // warm the model up in the background; never block the next step
};
$('#ob2').onclick = e => {
  const b = e.target.closest('[data-focus]'); if (!b) return;
  S.profile.focus = b.dataset.focus; persist();
  if (b.dataset.focus === 'train') { drawObGoals(); return obStep('obGoal'); }
  finishWelcome();
};
// Goal → program. People new to lifting get the beginner program where the goal has one.
let obGoalKey = null;
function drawObGoals() { $('#obGoals').innerHTML = GOALS.map(g => `<button type="button" data-goal="${g.key}"><b>${esc(g.label)}</b><span>${esc(g.sub)}</span></button>`).join(''); }
$('#obGoals').onclick = e => {
  const b = e.target.closest('[data-goal]'); if (!b) return;
  obGoalKey = b.dataset.goal; S.profile.goal = obGoalKey; persist();
  if (GOALS.find(g => g.key === obGoalKey)?.beginner) return obStep('obExp');
  chooseProgram(pickProgram(obGoalKey));
};
$('#obExp').onclick = e => { const b = e.target.closest('[data-exp]'); if (!b) return; S.profile.experience = b.dataset.exp; persist(); chooseProgram(pickProgram(obGoalKey, b.dataset.exp === 'new')); };
function chooseProgram(id) {
  const p = programById(id); if (!p) return;
  S.program = { id, start: Date.now(), blockStart: Date.now(), block: 1, log: [] };
  if (!S.plan.days.length) { S.plan.days = defaultDays(p.days); S.profile.weeklyGoal = p.days; }
  persist(); drawObDays();
  $('#obDaysNote').textContent = `QK picked ${p.name}: ${p.tagline} It's ${p.days} days a week, so QK suggested days. Change them to fit your life.`;
  obStep(3);
}
const OB_ORDER = [1, 2, 3, 4, 5, 6, 0], OB_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function drawObDays() { $('#obDays').innerHTML = OB_ORDER.map(d => `<button type="button" class="day ${S.plan.days.includes(d) ? 'on' : ''}" data-day="${d}" aria-pressed="${S.plan.days.includes(d)}">${OB_NAMES[d]}</button>`).join(''); }
$('#obDays').onclick = e => { const b = e.target.closest('[data-day]'); if (!b) return; const d = +b.dataset.day, i = S.plan.days.indexOf(d); i >= 0 ? S.plan.days.splice(i, 1) : S.plan.days.push(d); if (S.plan.days.length) S.profile.weeklyGoal = S.plan.days.length; persist(); drawObDays(); };
$('#obDone').onclick = $('#obSkip').onclick = () => finishWelcome();
function finishWelcome() {
  $('#welcome').hidden = true; bindPlan(); renderPrograms(); renderToday(); tab('today');
  say(`${greeting(S.profile.name)} ${nudgeLine()}`, { id: 'greet', priority: 'high' });
}
// The website caches itself for offline use; the native app (native/README.md) ships its files inside, so it skips this.
if ('serviceWorker' in navigator && location.protocol === 'https:' && !globalThis.Capacitor?.isNativePlatform?.()) navigator.serviceWorker.register('sw.js').catch(() => {});
window.__shred = { S, CONFIG };
