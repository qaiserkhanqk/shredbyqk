import * as store from './store.js';
import { say, registerAvatar, setMuted, greeting, CONFIG } from './coach.js';
import { EXERCISES, RepEngine, allRules, estimateRIR } from './exercises.js';
import { FeedbackCoach, restSeconds } from './feedback.js';
import { getVideoLandmarker, drawPose, liveModelName } from './pose.js';
import { toPx, viewOf, Smoother, bestSide } from './angles.js';
import { MotionTracker, romSummary, torsoLen } from './motion.js';
import { analyseGait } from './gait.js';
import { analyseJumps, jumpReadiness } from './jump.js';
import { analyseSingleLegSquat } from './kneetest.js';
import { BarTracker, estimate1RM, velocityZone } from './vbt.js';
import { scaleFromPlate, scaleFromHeight, assessQuality, measuredFps } from './measure.js';
import { CONDITIONS, COND, AREAS, GENERAL_FLAGS, flagAdvice, triage, painLight, evaluatePhase, psfsScore, checkinDays, needsReview, consult, carePlan, dose,
  screenQueue, screenConditionFor, screenFindings, screenAdjust, affectedSide, screenCriteria, clinicianSetup, verifyPin, applyClinician, advanceBlock, canAdvance, reportData, reportText, REPORT_DISCLAIMER } from './rehab.js';
import { ROM_TESTS, runRomTest } from './rom.js';
import { mountBody, focusFor } from './bodyviz.js';
import { readiness, recommendToday, sessionLoad, weekStats, loadSpike, dayKey } from './load.js';
import { cueList, saveClip, getClip, deleteClip, listClipIds, startRecording, exportClips } from './studio.js';
import { SessionRecorder, ErrorLog, downloadJSON, APP_VERSION } from './diagnostics.js';
import { LIBRARY, LIB, MUSCLES, exFor } from './library.js';
import { HipThrustDemo, WalkDemo, DEMO_W, DEMO_H } from './demo.js';
import { landmarksFrom, analyse, render, navyBodyFat, bfCategory, stanceProblem } from './bodyscan.js';
import { initCycle, renderCycle } from './cycle/ui.js';
import { readFlags, setFlag } from './cycle/flags.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let S = store.load();
S.gaits ||= [];
const persist = () => store.save(S);
ErrorLog.install();
const recorder2 = new SessionRecorder();
const bar = new BarTracker();
const VBT_EQUIP = ['Barbell', 'Dumbbell', 'Dumbbells', 'EZ bar', 'Kettlebell'];
// The height-based scale assumes an upright body, so only standing lifts may use it; others need the plate.
const STANDING_LIFTS = ['squat', 'rdl', 'press', 'curl', 'lunge', 'raise'];
const vbtOn = () => { const it = LIB[exKey]; return !!it?.pattern && VBT_EQUIP.includes(it.equipment) && it.pattern !== 'plank'; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let toastTimer;
const NO_WEBGL = 'This browser can\'t run the pose analysis: it needs graphics acceleration (WebGL). Turn on hardware acceleration in your browser settings, or try another browser.';
const noWebGL = e => e?.message === 'webgl_unavailable';
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

/* ---------- Particle body (hero visual) ---------- */
// One canvas per stage. Mounted the first time its screen is visible, so the figure assembles while the
// person is looking; after that it only updates which joint glows.
const BODIES = {};
function showBody(id, opts = {}) {
  const c = document.getElementById(id);
  if (!c || !c.offsetParent) return;
  if (BODIES[id]) BODIES[id].update(opts); else BODIES[id] = mountBody(c, opts);
}
// The joint of the running rehab programme, if any, glows on Today and Body too.
function rehabFocus() {
  const p = S.rehab?.active, c = p && COND[p.cond];
  return c ? { focus: focusFor(c.area, p.injured), intensity: 0.75 } : { focus: null };
}
const chip = (label, value, extra = '') => `<span class="float-chip ${extra}"><small>${esc(label)}</small><b>${value}</b></span>`;
function renderHub() {
  const p = S.rehab?.active, c = p && COND[p.cond];
  $('#hubLabel').textContent = c ? `${c.name}: phase ${p.phase + 1} of ${c.phases.length}.` : '';
  showBody('hubBody', rehabFocus());
}

/* ---------- Navigation ---------- */
function tab(id) {
  $$('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  const tabFor = ['gait', 'scan', 'rehab', 'cycle'].includes(id) ? 'body' : id;
  $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tabFor));
  if (id === 'today') renderToday();
  if (id === 'progress') { renderProgress(); renderLoad(); renderToday(); $('#youName').textContent = S.profile.name || 'You'; }
  if (id === 'rehab') renderRehab();
  if (id === 'body') renderHub();
  if (id === 'cycle') renderCycle();
  if (id === 'scan') $('#hipWrap').hidden = S.profile.sex === 'male';
  window.scrollTo(0, 0);
}
$$('.tabs button').forEach(b => b.onclick = () => tab(b.dataset.tab));
document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]'); if (g) return tab(g.dataset.go);
  if (e.target.closest('[data-back]')) tab('body');
});

/* ---------- Today ---------- */
const TODAY = [['hipThrust', '4×10'], ['rdl', '3×10'], ['lunge', '3×12'], ['bandedWalk', '2×20']];
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
  list = list.filter(s => !s.guided);
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
  if (S.readiness) renderReady();
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
  $('#heroNum').innerHTML = `${wk}<small>/${goal}</small>`;
  $('#heroLabel').textContent = wk >= goal ? 'sessions this week. Goal hit.' : 'sessions this week';
  const rp = S.rehab?.active, rc = rp && COND[rp.cond];
  $('#todayChips').innerHTML = chip('Streak', `${st} day${st === 1 ? '' : 's'}`) + chip('Form score', fs == null ? '–' : fs + '%')
    + (rc ? `<button type="button" class="float-chip ember" data-go="rehab"><small>Rehab</small><b>Phase ${rp.phase + 1}/${rc.phases.length}</b></button>` : '');
  showBody('todayBody', rehabFocus());
  $('#weekTitle').textContent = wk >= goal ? 'Goal hit' : wk ? 'On track' : 'Let\'s start';
  $('#ringsSvg').setAttribute('aria-label', `Sessions ${wk} of ${goal}, form score ${fs ?? 'not yet measured'}, plan kept ${st} days`);

  const p = S.plan || {};
  $('#sessionMeta').textContent = ['Today', p.time, p.place].filter(Boolean).join(' · ');
  $('#todayList').innerHTML = TODAY.map(([k, sets]) => `<button type="button" class="ex-row" data-train="${k}" style="width:100%;background:none;border-left:0;border-right:0;border-bottom:0;text-align:left;cursor:pointer;padding-inline:0"><span class="pic">${icon(iconKey(k))}</span>
    <div><b>${esc(LIB[k].name)}</b>${LIB[k].pattern ? '<span class="tag">QK checks your form</span>' : '<span class="tag" style="color:var(--z3)">QK coaches your tempo</span>'}</div>
    <span class="sets">${sets}</span></button>`).join('');

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
let muscleFilter = 'All', searchQ = '';
function renderTrain() {
  $('#muscleChips').innerHTML = ['All', ...MUSCLES, 'Rehab'].map(m => `<button type="button" class="mchip ${m === muscleFilter ? 'on' : ''}" data-muscle="${m}" aria-pressed="${m === muscleFilter}">${m}</button>`).join('');
  const q = searchQ.trim().toLowerCase();
  // Physio exercises live under their own Rehab filter so they don't clutter the gym library.
  const list = LIBRARY.filter(x => (muscleFilter === 'Rehab' ? x.rehab : !x.rehab && (muscleFilter === 'All' || x.muscles.includes(muscleFilter))) && (!q || `${x.name} ${x.muscles.join(' ')} ${x.equipment}`.toLowerCase().includes(q)));
  const cam = list.filter(x => x.pattern).length;
  $('#exCount').textContent = `${list.length} exercise${list.length === 1 ? '' : 's'} · ${cam} with camera form check`;
  $('#exGrid').innerHTML = list.map(x => x.id === 'hipThrust' && muscleFilter === 'All' && !q
    ? `<button type="button" class="ex-card feature" data-train="${x.id}"><div><span class="eyebrow" style="color:var(--z1)">Includes a demo set</span><h2 class="display h2" style="margin:8px 0 6px">${x.name}</h2><span class="watch">QK watches: ${WATCH[x.pattern]}</span></div>${icon('hipThrust', 'fig')}</button>`
    : `<button type="button" class="ex-card" data-train="${x.id}">${icon(iconKey(x.id), 'fig')}<b>${esc(x.name)}</b>
        <span class="watch">${esc(x.muscles.slice(0, 2).join(' · '))} · ${esc(x.equipment)}</span>
        <span class="meta">${x.pattern ? '<span class="pill cam">Form check</span>' : '<span class="pill voice">Tempo coach</span>'}</span></button>`).join('') || '<p class="empty">No exercises match. Try another word.</p>';
}
$('#muscleChips').onclick = e => { const b = e.target.closest('[data-muscle]'); if (!b) return; muscleFilter = b.dataset.muscle; renderTrain(); };
$('#exSearch').oninput = e => { searchQ = e.target.value; renderTrain(); };
document.addEventListener('click', e => { const b = e.target.closest('[data-train]'); if (b) openSetup(b.dataset.train); });

let exKey = 'hipThrust';
const curEx = () => exFor(exKey);
function openSetup(k) {
  exKey = k; const item = LIB[k], ex = exFor(k);
  $('#setupEyebrow').textContent = `${item.name} · set ${setsToday(k) + 1}`;
  if (ex) {
    $('#setupTitle').textContent = 'Set up your phone';
    $('#setupSteps').innerHTML = [ex.setup, 'Shoulders, hips, knees and feet all in frame, with good light.', 'Turn your sound up. QK talks you through the set.'].map(s => `<li>${esc(s)}</li>`).join('');
  } else {
    $('#setupTitle').textContent = 'QK coaches your tempo';
    $('#setupSteps').innerHTML = [item.guide, item.hold ? `QK times a ${item.hold}-second hold and counts you down.` : 'QK calls out a controlled tempo: three seconds down, a pause, then up.', 'A camera can\'t judge this movement reliably, so there\'s no form score. QK still counts every rep with you.'].map(s => `<li>${esc(s)}</li>`).join('');
  }
  $('#startCam').hidden = !ex; $('#videoFile').parentElement.hidden = !ex; $('#recordChk').parentElement.hidden = !ex;
  $('#startGuided').hidden = !!ex;
  $('#startDemo').hidden = k !== 'hipThrust';
  $('#loadWrap').hidden = !vbtOn();
  $('#setup').hidden = false;
}
const setsToday = k => { const d = new Date(); d.setHours(0, 0, 0, 0); return S.sessions.filter(s => s.ex === k && s.at >= d.getTime()).length; };
$('#setup').onclick = e => { if (e.target.id === 'setup') $('#setup').hidden = true; };
$('#startCam').onclick = () => startLive({ mode: 'form', source: 'camera' });
$('#startDemo').onclick = () => startLive({ mode: 'form', source: 'demo' });
$('#startGuided').onclick = () => startGuided();
$('#videoFile').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) startLive({ mode: 'form', source: 'file', file: f }); };

/* ---------- Live session (form check + gait capture) ---------- */
let live = null, fb = null, engine = null, stream = null, recorder = null, chunks = [], facing = 'user', raf = 0;
const smooth = new Smoother(0.55);
const motion = new MotionTracker();

async function startLive({ mode, source, file }) {
  $('#setup').hidden = true; $('#summary').hidden = true; $('#live').hidden = false;
  $('#tempoRing').hidden = true;
  const ex = mode === 'form' ? curEx() : null;
  live = { mode, source, frames: [], t0: null, lost: 0, wrong: 0, demo: null, done: false, steps: 0, mPerPx: null, standFrames: [], times: [] };
  bar.reset(); recorder2.start({ kind: mode, exercise: mode === 'form' ? exKey : undefined, gaitMode: mode === 'gait' ? gaitMode : undefined, source, loadKg: mode === 'form' ? parseFloat($('#loadKg').value) || null : undefined });
  engine = null; fb = null; smooth.reset(); motion.reset();
  $('#formMeters').hidden = mode !== 'form'; $('#gaitMeters').hidden = mode === 'form';
  $('#repBig').hidden = mode !== 'form'; $('#cueHint').hidden = mode !== 'form';
  $('#repNum').textContent = '0'; $('#repLbl').textContent = ex?.hold ? 'seconds' : 'reps'; $('#dots').innerHTML = ''; $('#cleanCt').textContent = '0 clean'; $('#vlKnob').style.left = '0%'; $('#vlTxt').textContent = 'fresh';
  $('#gSteps').textContent = '0'; $('#gProg').style.width = '0';
  const testName = { rom: TEST.rom?.label || 'Measurement', gait: `Gait · ${gaitMode === 'run' ? 'running' : 'walking'}`, jump: 'Jump test', sls: 'Single-leg squat knee test' };
  $('#liveEyebrow').textContent = mode === 'form' ? ex.name : testName[mode];
  $('#liveTitle').textContent = mode === 'form' ? `Set ${setsToday(exKey) + 1}${source === 'demo' ? ' · demo' : ''}` : (source === 'demo' ? 'Demo walker' : source === 'file' ? 'Analysing your video (precise mode)' : mode === 'gait' ? 'Walk naturally for 10 seconds' : mode === 'jump' ? 'Up to 3 jumps' : mode === 'rom' ? `${TEST.rom.secs} seconds` : 'Left leg first, then right');
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
      video.hidden = true; live.demo = mode === 'form' ? new HipThrustDemo() : new WalkDemo();
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
        if (mode === 'form' && $('#recordChk').checked && window.MediaRecorder) {
          chunks = []; recorder = new MediaRecorder(stream); recorder.ondataavailable = e => e.data.size && chunks.push(e.data); recorder.start(1000); $('#recBadge').hidden = false;
        }
      }
      await video.play();
      // Uploaded videos don't need real-time speed, so they use the most precise model.
      live.model = source === 'file' ? 'heavy' : mode === 'form' ? liveModelName() : 'full';
      live.lm = await getVideoLandmarker(live.model);
      $('#status').textContent = '';
    }
  } catch (err) {
    console.warn(err);
    $('#status').textContent = noWebGL(err) ? NO_WEBGL : source === 'file' ? 'That video couldn\'t be played. Try an MP4 or MOV.' : 'Camera blocked. Allow camera access for this site in your browser settings, then try again.';
    return;
  }

  if (mode === 'form') say(`${ex.name}. ${ex.hold ? 'Get into position and hold.' : ex.setup + ' Start when you\'re ready.'}`, { id: `setup_${exKey}`, priority: 'high' });
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
  if (!live || live.done) return;
  if (live.source === 'file' && video.ended) return live.mode === 'form' ? endSet() : finishTest();
  if (live.demo?.done && live.mode === 'form' && !live.ending) { live.ending = true; setTimeout(() => live && endSet(), 1500); }
  raf = requestAnimationFrame(loop);
}

const fmtA = v => (v == null || Number.isNaN(v) ? '–' : Math.round(v) + '°');
function formFrame(px, ctx, t) {
  const ex = curEx(), view = viewOf(px);
  if (!engine) { engine = new RepEngine(ex, ex.view === 'either' ? view : ex.view); fb = new FeedbackCoach(); }
  const raw = ex.metrics(px, engine.view), m = { ...raw };
  for (const k of ['knee', 'hip', 'elbow', 'torsoLean']) if (raw[k] != null) m[k] = smooth.push(k, raw[k]);

  // Confidence gate: low-confidence landmarks give wrong angles, so stay quiet instead.
  if (raw.s.conf < 0.55) {
    if (++live.lost === 45) say('Move back a little. I need to see your whole body.', { id: 'not_visible', priority: 'high' });
    drawPose(ctx, px, { color: 'rgba(237,240,246,.35)' }); return;
  }
  live.lost = 0;
  if (ex.view !== 'either' && view !== ex.view) { if (++live.wrong === 60) say(ex.view === 'side' ? 'Turn side-on to the camera for this one.' : 'Face the camera for this one.', { id: 'wrong_view', priority: 'high' }); }
  else live.wrong = 0;

  motion.push(raw.s[ex.track], torsoLen(px));
  recorder2.push(t, px);
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
    if (sec !== live.lastSec) { live.lastSec = sec; $('#repNum').textContent = sec; if (sec && sec % 10 === 0) say(`${sec} seconds.${bad ? '' : ' Solid.'}`, { priority: 'low' }); }
    $('#cleanCt').textContent = `${Math.floor(live.goodHeld || 0)} s good`;
  }
  let flagged = false;
  for (const ev of engine.update(m, t)) {
    if (ev.type === 'rep') {
      ev.drift = motion.endRep();
      $('#repNum').textContent = engine.reps;
      const dot = document.createElement('i'); if (ev.faults.length) dot.className = 'f'; $('#dots').appendChild(dot);
      $('#cleanCt').textContent = `${engine.goodReps} clean`;
      $('#vlKnob').style.left = Math.min(100, ev.vl / .5 * 100) + '%';
      $('#vlTxt').textContent = ev.vl < .1 ? 'fresh' : ev.vl < .25 ? `−${Math.round(ev.vl * 100)}%` : `−${Math.round(ev.vl * 100)}% · near failure`;
      if (vbtOn() && live.mPerPx) { const v = bar.closeRep(); if (v) { live.lastV = v; $('#vlTxt').textContent = `${v.mcv.toFixed(2)} m/s`; } }
    }
    if (ev.faults.length) flagged = true;
    const line = ev.type === 'rep' ? fb.onRep(ev) : fb.onContinuousFault(ev.faults[0]);
    if (line) say(line.text, line);
  }
  motion.draw(ctx);
  const s = raw.s;
  drawPose(ctx, px, { color: flagged ? '#ff5a5f' : '#7c6cff', labels: [{ at: s.kn, value: m.knee }, { at: s.hip, value: m.hip }, ...(ex.primary === 'elbow' ? [{ at: s.el, value: m.elbow }] : [])] });
  const keys = ex.primary === 'elbow' ? ['elbow', 'hip'] : ['hip', 'knee'];
  $('#readout').innerHTML = keys.map(k => `<span>${k} ${fmtA(m[k])}</span>`).join('') + (live.lastV ? `<span>${live.lastV.mcv.toFixed(2)} m/s</span>` : '') + `<span class="muted">${engine.view} view</span>`;
}

function endSet() {
  if (!live) return;
  if (live.mode === 'guided') return endGuided();
  const wasRec = recorder && recorder.state !== 'inactive';
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
  const L = 2 * Math.PI * 50;
  $('#scoreRing').innerHTML = `<circle cx="60" cy="60" r="50" fill="none" stroke="#1a2130" stroke-width="11"/><circle cx="60" cy="60" r="50" fill="none" stroke="url(#zoneStroke)" stroke-width="11" stroke-linecap="round" stroke-dasharray="${L}" stroke-dashoffset="${L * (1 - score / 100)}" transform="rotate(-90 60 60)"/><text x="60" y="64" text-anchor="middle" fill="#edf0f6" font-family="Archivo, sans-serif" font-weight="800" font-size="26">${score}%</text><text x="60" y="81" text-anchor="middle" fill="#8c95a8" font-family="Figtree, sans-serif" font-size="10">form score</text>`;
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
  recorder2.finish({ reps, good, faults: tally });
  const rest = restSeconds(ex.patternKey, vl); restLeft = rest; restTotal = rest; drawRest();
  $('#restWhy').textContent = vl >= .3 ? 'Longer, because you went close to failure' : 'Recovery for the next set';
  $('#restCard').hidden = !reps;

  if (reps) {
    S.sessions.push({ at: Date.now(), ex: exKey, name: ex.name, reps, good, faults: tally, vl, tempo, roms: roms.map(r => Math.round(r.rom)), demo: live?.source === 'demo' || undefined });
    persist();
    const better = prevScore != null && score > prevScore ? ` Your form score is up from ${prevScore} to ${score} percent.` : '';
    say(`Set done. ${reps} reps, ${good} clean.${better} ${top ? 'One thing for next set: ' + top.cue : 'Great form. Keep it up.'}`, { id: 'summary_' + Date.now(), priority: 'high' });
  }
  const pb = $('#playback'); pb.hidden = true;
  if (wasRec) setTimeout(() => { if (!chunks.length) return; pb.src = URL.createObjectURL(new Blob(chunks, { type: chunks[0].type || 'video/webm' })); pb.hidden = false; }, 400);
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

$('#endLive').onclick = () => { if (!live) return; ['gait', 'jump', 'sls', 'rom'].includes(live.mode) ? finishTest() : endSet(); };
$('#flipCam').onclick = () => { const m = live?.mode || 'form'; live && (live.done = true); facing = facing === 'user' ? 'environment' : 'user'; stopLive(); live = null; startLive({ mode: m, source: 'camera' }); };
$('#doneBtn').onclick = () => { stopRest(); $('#summary').hidden = true; tab('today'); };
$('#nextSet').onclick = () => { stopRest(); $('#summary').hidden = true; openSetup(exKey); };

let restLeft = 120, restTotal = 120, restTimer = null;
function drawRest() { $('#restClock').textContent = `${Math.floor(restLeft / 60)}:${String(restLeft % 60).padStart(2, '0')}`; $('#restArc').style.strokeDashoffset = 201 * (1 - restLeft / restTotal); }
function stopRest() { clearInterval(restTimer); restTimer = null; $('#restBtn').textContent = 'Start'; }
$('#restBtn').onclick = () => {
  if (restTimer) return stopRest();
  $('#restBtn').textContent = 'Pause';
  restTimer = setInterval(() => {
    restLeft = Math.max(0, restLeft - 1); drawRest();
    if (restLeft === 10) say('Ten seconds. Get set up.', { id: 'rest10_' + Date.now(), priority: 'high' });
    if (restLeft === 0) { stopRest(); restLeft = restTotal; say('Rest over. Let\'s go again.', { id: 'rest0_' + Date.now(), priority: 'high' }); }
  }, 1000);
};

/* ---------- Tempo coach (voice-only, no camera) ---------- */
// Used where a phone camera can't judge the movement. QK paces a controlled tempo
// (3 s lowering, 1 s pause, 1 s lifting) or times a hold — no form score is invented.
function startGuided() {
  const item = LIB[exKey], target = item.hold || 10;
  $('#setup').hidden = true; $('#summary').hidden = true; $('#live').hidden = false;
  live = { mode: 'guided', source: 'voice', done: false, reps: 0, timers: [], target };
  $('#formMeters').hidden = true; $('#gaitMeters').hidden = true; $('#repBig').hidden = false; $('#cueHint').hidden = true;
  $('#flipCam').hidden = true; $('#readout').innerHTML = ''; $('#status').textContent = ''; $('#recBadge').hidden = true;
  $('#video').hidden = true; const c = $('#overlay'); c.getContext('2d').clearRect(0, 0, c.width, c.height);
  $('#tempoRing').hidden = false; $('#tempoWord').textContent = 'Get set';
  $('#repNum').textContent = item.hold ? target : 0; $('#repLbl').textContent = item.hold ? 'seconds left' : `of ${target} reps`;
  $('#liveEyebrow').textContent = item.name; $('#liveTitle').textContent = item.hold ? `${target}-second hold · tempo coach` : `Target ${target} · tempo coach`;
  $('#endLive').textContent = 'End set';
  say(`${item.name}. ${item.guide}`, { id: 'guide_' + Date.now(), priority: 'high' });
  const T = (fn, ms) => live.timers.push(setTimeout(() => { if (live && !live.done) fn(); }, ms));
  const word = w => { $('#tempoWord').textContent = w; };
  if (item.hold) {
    let left = target;
    T(function tick() {
      if (left === target) { word('Hold'); say('Go. Hold it.', { id: 'hold_go', priority: 'high' }); }
      $('#repNum').textContent = left; live.reps = target - left;
      if (left === Math.floor(target / 2)) say('Halfway. Breathe.', { id: 'hold_half', priority: 'high' });
      if (left === 10 && target > 15) say('Ten seconds left.', { id: 'hold_10', priority: 'high' });
      if (left <= 3 && left > 0) say(String(left), { priority: 'low' });
      if (left === 0) { live.reps = target; return endGuided(); }
      left--; T(tick, 1000);
    }, 5000);
  } else {
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
  const item = LIB[exKey], reps = live.reps, hold = !!item.hold;
  stopLive(); live = null;
  $('#live').hidden = true; $('#tempoRing').hidden = true; $('#summary').hidden = false;
  $('#sumEyebrow').textContent = `${item.name} · set ${setsToday(exKey) + 1}`;
  $('#scoreRing').hidden = true; $('#romBars').parentElement.hidden = true; $('#sTable').hidden = true;
  $('#sReps').textContent = hold ? `${reps} s` : reps; $('#sClean').textContent = 'coached by tempo';
  $('#sCompare').textContent = 'Voice-coached set. No camera form score for this movement.';
  $('#sFocusBox').hidden = false; $('#sFocus').textContent = item.guide; $('#sWhy').textContent = '';
  restLeft = restTotal = item.muscles.includes('Full body') || ['Quads', 'Hamstrings', 'Back', 'Chest'].includes(item.muscles[0]) ? 120 : 75; drawRest();
  $('#restWhy').textContent = 'Recovery for the next set'; $('#restCard').hidden = !reps;
  $('#playback').hidden = true;
  if (reps) { S.sessions.push({ at: Date.now(), ex: exKey, name: item.name, reps, good: 0, guided: true }); persist(); }
  say(reps ? `Set done. ${hold ? reps + ' seconds' : reps + ' reps'}. Nice and controlled.` : 'Set ended.', { id: 'gsum_' + Date.now(), priority: 'high' });
}

/* ---------- Movement tests: gait, jump, single-leg squat ---------- */
let gaitMode = 'walk', testMode = 'gait';
const TEST = {
  gait: { secs: 10, label: 'Record 10 seconds', minFps: 25, view: null, intro: () => gaitMode === 'run' ? 'Start running at an easy pace. Recording starts after the countdown.' : 'Walk naturally. Recording starts after the countdown.' },
  jump: { secs: 15, label: 'Record jumps (15 s)', minFps: 50, view: 'side', intro: () => 'Hands on hips. Stand still for a second, then jump as high as you can. Three jumps with a short rest.' },
  sls: { secs: 30, label: 'Record knee test (30 s)', minFps: 25, view: 'front', intro: () => 'Stand on your left leg and do five slow squats.' },
};
$$('[data-gmode]').forEach(b => b.onclick = () => { gaitMode = b.dataset.gmode; $$('[data-gmode]').forEach(x => x.classList.toggle('on', x === b)); });
$$('[data-test]').forEach(b => b.onclick = () => {
  testMode = b.dataset.test;
  $$('[data-test]').forEach(x => x.classList.toggle('on', x === b));
  $$('[data-panel]').forEach(p => p.hidden = p.dataset.panel !== testMode);
  $('#testLiveLbl').textContent = TEST[testMode].label;
  $('#gaitDemo').hidden = testMode !== 'gait';
  $('#gaitResult').hidden = true; renderTestHistory();
});
$('#testLive').onclick = () => startLive({ mode: testMode, source: 'camera' });
$('#gaitDemo').onclick = () => startLive({ mode: 'gait', source: 'demo' });
$('#gaitFile').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) startLive({ mode: testMode, source: 'file', file: f }); };
const footTrails = { L: new MotionTracker(40), R: new MotionTracker(40) };

function testFrame(px, ctx, t) {
  live.frames.push({ t, px }); recorder2.push(t, px);
  if (live.mode === 'gait') { footTrails.L.push(px[31], 1); footTrails.R.push(px[32], 1); footTrails.L.draw(ctx); footTrails.R.draw(ctx); }
  drawPose(ctx, px, { color: '#45c3ff' });
  const cfg = TEST[live.mode], el = (t - (live.source === 'file' ? 0 : live.t0)) / 1000;
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
      <div class="legend-inline"><span><i style="background:var(--z1)"></i>Left</span><span><i style="background:var(--z3)"></i>Right</span><span><i style="background:rgba(124,108,255,.35);height:8px"></i>Typical range</span></div></div>` : ''}
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
  for (let v = 0; v <= max; v += mode === 'run' ? 40 : 20) s += `<line x1="${l}" x2="${W - r}" y1="${Y(v)}" y2="${Y(v)}" stroke="#1f2738"/><text x="${l - 6}" y="${Y(v) + 4}" text-anchor="end" fill="#8c95a8" font-size="10" font-family="IBM Plex Mono, monospace">${v}°</text>`;
  [0, 25, 50, 75, 100].forEach(p => { s += `<text x="${X(p / 2)}" y="${H - 6}" text-anchor="middle" fill="#8c95a8" font-size="10" font-family="IBM Plex Mono, monospace">${p}%</text>`; });
  s += `<path d="${band.map((v, i) => `${i ? 'L' : 'M'}${X(i)} ${Y(Math.min(max, v + 8))}`).join(' ')} ${band.map((v, i) => `L${X(50 - i)} ${Y(Math.max(0, band[50 - i] - 8))}`).join(' ')} Z" fill="rgba(124,108,255,.2)"/>`;
  const line = (c, col) => c.length ? `<path d="${c.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(Math.max(0, Math.min(max, v))).toFixed(1)}`).join(' ')}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` : '';
  s += line(curves.L, '#45c3ff') + line(curves.R, '#ff6b4a') + '</svg>';
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
  } catch (e) { if (noWebGL(e)) { $('#scanStatus').textContent = NO_WEBGL; return; } console.error(e); $('#scanStatus').textContent = 'That file couldn\'t be read. Try a JPG photo instead.'; }
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
  $('#bfOut').innerHTML = `<div class="gauge"><svg viewBox="0 0 132 80" role="img" aria-label="Body fat ${bf.toFixed(1)} percent"><path d="M10 72a56 56 0 0 1 112 0" fill="none" stroke="#1a2130" stroke-width="12" stroke-linecap="round"/><path d="M10 72a56 56 0 0 1 112 0" fill="none" stroke="url(#zoneStroke)" stroke-width="12" stroke-linecap="round" stroke-dasharray="176" stroke-dashoffset="${off}"/><text x="66" y="62" text-anchor="middle" fill="#edf0f6" font-family="Archivo, sans-serif" font-weight="800" font-size="24">${bf.toFixed(1)}%</text><text x="66" y="76" text-anchor="middle" fill="#8c95a8" font-family="Figtree, sans-serif" font-size="9">body fat</text></svg>
    <span class="small"><b>${bfCategory(bf, p.sex)}</b><br><span class="muted">${prev ? `${bf < prev.bf ? 'Down' : 'Up'} ${Math.abs(bf - prev.bf).toFixed(1)}% since last time.` : 'Re-measure every two weeks, same time of day.'}</span></span></div>
    ${lean ? `<div class="comp" style="margin-top:12px"><div><span class="num">${lean.toFixed(1)}</span><small>lean kg</small></div><div><span class="num">${(wt - lean).toFixed(1)}</span><small>fat kg</small></div><div><span class="num">${v('#bWater') || '–'}</span><small>water % · scale</small></div></div>` : ''}`;
  say(`Body fat is about ${Math.round(bf)} percent, in the ${bfCategory(bf, p.sex).toLowerCase()} range.`, { id: 'bf_' + Date.now(), priority: 'high' });
};

/* ---------- Progress ---------- */
function lineChart(vals, { min, max, suffix = '', labels }) {
  const W = 360, H = 150, l = 34, r = 12, t = 14, b = 24, n = vals.length;
  const X = i => l + (n === 1 ? 0 : i * (W - l - r) / (n - 1)), Y = v => t + (1 - (v - min) / (max - min || 1)) * (H - t - b);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img"><defs><linearGradient id="fillG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c6cff" stop-opacity=".35"/><stop offset="1" stop-color="#7c6cff" stop-opacity="0"/></linearGradient></defs>`;
  const ticks = 3; for (let k = 0; k <= ticks; k++) { const v = min + (max - min) * k / ticks; s += `<line x1="${l}" x2="${W - r}" y1="${Y(v)}" y2="${Y(v)}" stroke="#1f2738"/><text x="${l - 8}" y="${Y(v) + 4}" text-anchor="end" fill="#8c95a8" font-size="10" font-family="IBM Plex Mono, monospace">${Math.round(v)}${suffix}</text>`; }
  labels.forEach((lb, i) => { if (n <= 8 || i % Math.ceil(n / 6) === 0 || i === n - 1) s += `<text x="${X(i)}" y="${H - 6}" text-anchor="middle" fill="#8c95a8" font-size="10" font-family="IBM Plex Mono, monospace">${lb}</text>`; });
  const path = vals.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');
  s += `<path d="${path} L${X(n - 1)} ${H - b} L${X(0)} ${H - b} Z" fill="url(#fillG)"/><path d="${path}" fill="none" stroke="url(#zoneStroke)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  s += `<circle cx="${X(n - 1)}" cy="${Y(vals[n - 1])}" r="9" fill="#ff6b4a" fill-opacity=".25"/><circle cx="${X(n - 1)}" cy="${Y(vals[n - 1])}" r="4.5" fill="#edf0f6"/></svg>`;
  return s;
}

function renderProgress() {
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
  } catch (e) { if (noWebGL(e)) return toast(NO_WEBGL); console.error(e); toast('That file couldn\'t be read. Try a JPG photo.'); }
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
$('#exportErrors').onclick = () => downloadJSON(`shred-errors-${Date.now()}.json`, { app: APP_VERSION, ua: navigator.userAgent, errors: ErrorLog.read() });

/* ---------- Rehab ---------- */
// Step-by-step rehab exercise programmes, two ways in:
//   - a camera movement check for people who don't know what's wrong: it measures how the joint moves,
//     compares sides and builds goals from that. It never names a condition.
//   - a named programme for people a physio or doctor has already diagnosed.
// A physio can unlock clinician mode on this phone (their own PIN) to confirm a diagnosis and set phases,
// doses and approval. Otherwise no clinician is involved, and the wording says so: no "clinic", "care plan"
// or "treatment" (compliance review, 2026-11-27).
S.rehab ||= { active: null, history: [] };
let rehabArea = 'Knee';
const plan = () => S.rehab.active;
const condOf = p => COND[p.cond];
const limitOf = p => p.painLimit ?? condOf(p).painLimit;
const openSheet = html => { $('#rsheetBody').innerHTML = html; $('#rsheet').hidden = false; };
const closeSheet = () => { $('#rsheet').hidden = true; };
$('#rsheet').onclick = e => { if (e.target.id === 'rsheet') closeSheet(); };
const note = (p, text) => { (p.notes ||= []).push({ at: Date.now(), text }); };
const fmtDate = at => new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const LEVEL_NAME = { high: 'Gentle start', moderate: 'Standard start', low: 'Standard start' };
const REASSESS_MS = 7 * 864e5;
const nextReassess = p => (p.lastReassessAt || p.startedAt) + REASSESS_MS;
const sideWord = s => (s === 'L' ? 'left' : s === 'R' ? 'right' : '');
// A choice row: buttons with data-v, one pre-selected. Read back with choiceOf().
const choice = (id, label, opts, on) => `<div class="field"><span>${label}</span><div class="mode-switch ${opts.length === 3 ? 'three' : ''}" role="group" aria-label="${esc(label)}" id="${id}">${opts.map(([v, t]) => `<button type="button" data-v="${v}" class="${v === on ? 'on' : ''}" aria-pressed="${v === on}">${t}</button>`).join('')}</div></div>`;
const bindChoices = root => root.querySelectorAll('.mode-switch[id]').forEach(g => g.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; g.querySelectorAll('[data-v]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); }));
const choiceOf = id => $(`#${id} .on`)?.dataset.v;
function slider(id, label, v = 0) { return `<label class="field slider">${label} <span class="val" id="${id}v">${v}</span><input type="range" min="0" max="10" value="${v}" id="${id}"></label>`; }
function bindSliders(ids) { ids.forEach(id => $('#' + id).oninput = e => $('#' + id + 'v').textContent = e.target.value); }
// One tap fills an activity instead of typing it.
const ACT_HINTS = {
  Knee: ['Stairs', 'Squatting', 'Running', 'Kneeling', 'Walking'], Shoulder: ['Reaching overhead', 'Getting dressed', 'Lying on that side', 'Lifting', 'Throwing'],
  'Lower back': ['Bending', 'Sitting for long', 'Lifting', 'Getting out of bed', 'Walking'], Neck: ['Looking over my shoulder', 'Desk work', 'Sleeping', 'Driving'],
  Elbow: ['Gripping', 'Carrying a bag', 'Typing', 'Racket sport'], Hip: ['Stairs', 'Walking', 'Lying on that side', 'Getting out of a car', 'Running'],
  Thigh: ['Sprinting', 'Bending to the floor', 'Kicking', 'Running'], 'Ankle & foot': ['First steps in the morning', 'Walking', 'Running', 'Stairs', 'Jumping'],
  Shin: ['Running', 'Walking far', 'Jumping'],
};

function renderRehab() {
  const p = plan(), ik = S.rehab.intake;
  $('#rehabStart').hidden = !!p; $('#rehabActive').hidden = !p;
  $('#rehabTitle').textContent = p ? condOf(p).name : 'Start a rehab programme';
  if (p) return renderRehabDashboard();
  $('#rehabNum').hidden = true; $('#rehabChips').innerHTML = ''; $('#rehabStage').classList.add('no-chips');
  $('#rehabNumLabel').textContent = 'Tap where it hurts. If you don\'t know what it is, the camera movement check measures it.';
  showBody('rehabBody', { focus: focusFor(rehabArea, null), intensity: 0.55 });
  $('#areaChips').innerHTML = AREAS.map(a => `<button type="button" class="mchip ${a === rehabArea ? 'on' : ''}" data-area="${a}">${a}</button>`).join('');
  const q = screenQueue(rehabArea), secs = q.reduce((s, x) => s + ROM_TESTS[x.test].secs, 0);
  const named = CONDITIONS.filter(c => c.area === rehabArea && !c.general);
  $('#condList').innerHTML = `
    ${ik ? `<button type="button" class="card rehab-today" data-resume><span class="eyebrow" style="color:var(--z1)">In progress</span><b>Continue your movement check</b><span class="muted small">${ik.idx} of ${ik.queue.length} done.</span></button>` : ''}
    ${q.length ? `<button type="button" class="cond screen-card" data-screen="${esc(rehabArea)}"><span class="eyebrow" style="color:var(--z1)">Not sure what it is?</span><b>Camera movement check</b>
        <span>${q.length} short movements, about ${secs} seconds of recording. The app measures how it moves, compares left and right, and builds your programme around what it finds. It doesn't diagnose.</span>
        <span class="tags"><span class="pill cam">${q.length} camera tests</span><span class="pill">No typing needed</span></span></button>`
      : '<p class="muted small" style="margin:0">There\'s no camera movement check for this area yet. Choose your diagnosis below, or see a physio first.</p>'}
    ${named.length ? `<span class="eyebrow">Already diagnosed by a physio or doctor?</span>` : ''}
    ${named.map(c => `<button type="button" class="cond" data-cond="${c.id}"><b>${esc(c.name)}</b><span>${esc(c.about)}</span>
      <span class="tags"><span class="pill">${c.phases.length} phases</span>${c.tests.length ? `<span class="pill cam">${c.tests.length} camera test${c.tests.length > 1 ? 's' : ''}</span>` : ''}${c.postOp ? '<span class="pill voice">After surgery: follow your physio</span>' : ''}</span></button>`).join('')}`;
}
$('#areaChips').onclick = e => { const b = e.target.closest('[data-area]'); if (b) { rehabArea = b.dataset.area; renderRehab(); } };
$('#condList').onclick = e => {
  if (e.target.closest('[data-resume]')) return openScreenRunner();
  const s = e.target.closest('[data-screen]');
  if (s) { S.rehab.intake = null; return openSafety(COND[screenConditionFor(s.dataset.screen)], { screen: true, area: s.dataset.screen }); }
  const b = e.target.closest('[data-cond]'); if (b) openSafety(COND[b.dataset.cond], { area: COND[b.dataset.cond].area });
};

// 1. Safety screen: every question must be answered.
function openSafety(c, opts = {}) {
  const qs = [...c.flags, ...GENERAL_FLAGS], total = opts.screen ? 4 : 3;
  const structural = ['acl', 'pcl', 'meniscus'].includes(c.id);
  openSheet(`<div><span class="eyebrow">Step 1 of ${total} · safety check</span><h2 class="display h2" id="rsheetTitle" style="margin-top:6px;font-size:1.3rem">${esc(opts.screen ? `${opts.area} pain` : c.name)}</h2>
    <p class="muted small" style="margin:6px 0 0">These questions check for some warning signs that need a doctor, not exercise. They can't rule everything out.</p></div>
    <div id="flagList">${qs.map((f, i) => `<div class="flag-q" data-i="${i}"><span>${esc(f.q)}</span><span class="yn"><button type="button" class="yes" data-v="1">Yes</button><button type="button" class="no" data-v="0">No</button></span></div>`).join('')}
    ${opts.screen ? '' : `<div class="flag-q" data-i="dx"><span>Has a physio or doctor diagnosed this problem?</span><span class="yn"><button type="button" class="yes" data-v="1">Yes</button><button type="button" class="no" data-v="0">No</button></span></div>`}
    ${c.postOp && !opts.screen ? `<div class="flag-q" data-i="op"><span>Have you had surgery for this?</span><span class="yn"><button type="button" class="yes" data-v="1">Yes</button><button type="button" class="no" data-v="0">No</button></span></div>` : ''}</div>
    <button class="cta" type="button" id="safetyGo">Continue</button><p class="note" id="safetyMsg"></p>`);
  const ans = {};
  $('#flagList').onclick = e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    const row = b.closest('.flag-q'); ans[row.dataset.i] = b.dataset.v === '1';
    row.querySelectorAll('[data-v]').forEach(x => x.classList.toggle('on', x === b));
  };
  $('#safetyGo').onclick = () => {
    const need = [...qs.map((_, i) => String(i)), ...(opts.screen ? [] : ['dx']), ...(c.postOp && !opts.screen ? ['op'] : [])];
    if (need.some(k => ans[k] === undefined)) { $('#safetyMsg').textContent = 'Please answer every question.'; return; }
    const level = triage(qs.map((f, i) => ({ yes: ans[i], level: f.level, unchecked: f.unchecked })), { diagnosed: !!ans.dx });
    const hit = qs.filter((f, i) => ans[i] && f.level === level && !(ans.dx && (f.unchecked || f.level === 'assess')));
    if (level) return showStop(level, hit);
    if (!opts.screen && !ans.dx && structural) return showStop('assess', [{ q: 'This injury needs a confirmed diagnosis (often a scan) before rehab, because the right programme depends on what\'s damaged.' }]);
    openAssessment(c, { diagnosed: !!ans.dx, postOp: !!ans.op, screen: !!opts.screen, area: opts.area || c.area });
  };
}

function showStop(level, hits) {
  const a = flagAdvice(level);
  openSheet(`<div class="alert ${level}"><b>${a.title}</b><span>${esc(a.text)}</span>
    ${level === 'emergency' && a.number ? `<span class="emergency-num">${a.number}</span><span class="small">${esc(a.numberNote)}</span>` : ''}
    ${hits.map(h => `<span class="small">• ${esc(h.q)}${h.why ? ' ' + esc(h.why) : ''}</span>`).join('')}</div>
    <p class="muted small" style="margin:0">Once you've been checked and cleared, come back and start your programme.</p>
    <button class="ghost full" type="button" id="stopOk">OK</button>`);
  say(`${a.title}. ${a.text}`, { id: 'stop_' + Date.now(), priority: 'high' });
  $('#stopOk').onclick = closeSheet;
}

// 2. About your pain: decides how hard to start.
function openAssessment(c, info) {
  const limb = !['Lower back', 'Neck'].includes(info.area), total = info.screen ? 4 : 3, hints = ACT_HINTS[info.area] || [];
  openSheet(`<div><span class="eyebrow">Step 2 of ${total} · about your pain</span><h2 class="display h2" id="rsheetTitle" style="margin-top:6px;font-size:1.3rem">Tell us about the pain</h2>
    <p class="muted small" style="margin:6px 0 0">These answers decide how hard you start. 0 = no pain, 10 = worst imaginable.</p></div>
    ${slider('aRest', 'Pain right now, at rest', 2)}${slider('aWorst', 'Worst pain in the last week', 5)}
    ${choice('aSettle', 'After an activity that hurts, the pain settles…', [['minutes', 'Within minutes'], ['hours', 'Within hours'], ['nextDay', 'Lasts to the next day']], 'hours')}
    ${choice('aNight', 'Does it wake you at night?', [['0', 'No'], ['1', 'Yes']], '0')}
    ${choice('aDur', 'How long have you had it?', [['acute', 'Under 6 weeks'], ['subacute', '6 weeks–3 months'], ['persistent', 'Over 3 months']], 'subacute')}
    ${c.needsDate ? `<label class="field">Date of surgery (or injury, if no surgery)<input type="date" id="aDate" max="${new Date().toISOString().slice(0, 10)}"></label>` : ''}
    ${limb ? choice('sideSel', 'Which side hurts?', [['L', 'Left'], ['R', 'Right'], ['', 'Both / not sure']], '') : ''}
    ${choice('aGoal', 'What do you want to get back to?', [['daily', 'Everyday life'], ['gym', 'Gym training'], ['sport', 'My sport']], 'daily')}
    ${slider('aDays', 'Days a week you can do your rehab', 3).replace('max="10"', 'max="7"').replace('min="0"', 'min="1"')}
    <span class="eyebrow">What does it stop you doing?</span>
    <p class="muted small" style="margin:0">Tap or type up to 3 activities, then rate each: 0 = can't do it, 10 = as well as before.</p>
    ${hints.length ? `<div class="chips-scroll" id="actHints">${hints.map(h => `<button type="button" class="mchip" data-hint="${esc(h)}">${esc(h)}</button>`).join('')}</div>` : ''}
    ${[0, 1, 2].map(i => `<div class="grid2"><label class="field">Activity ${i + 1}<input id="act${i}" placeholder="${['e.g. Walking upstairs', 'e.g. Running 5 km', 'e.g. Squatting to lift'][i]}"></label>
      <label class="field slider">Ability <span class="val" id="actv${i}">5</span><input type="range" min="0" max="10" value="5" id="actr${i}"></label></div>`).join('')}
    ${slider('um', 'Pain or stiffness first thing in the morning (usual)', 2)}
    ${info.postOp ? '<div class="alert assess"><b>After surgery</b><span class="small">Follow your surgeon\'s and physio\'s protocol first: their timelines and restrictions override this programme. Use Shred to track your measurements and do the exercises they approve.</span></div>' : ''}
    ${!info.screen && !info.diagnosed ? '<div class="alert assess"><b>Not confirmed yet</b><span class="small">You picked this condition yourself, so it may not be the right match. A physio or doctor can confirm it. If you start meanwhile, you stay in phase 1, and stop if anything gets worse. The camera movement check is the other option: it doesn\'t need a diagnosis.</span></div>' : ''}
    <button class="cta" type="button" id="seePlan">${info.screen ? 'Next: movement check' : 'See my plan'}</button><p class="note" id="assessMsg"></p>`);
  bindChoices($('#rsheetBody'));
  bindSliders(['aRest', 'aWorst', 'aDays', 'um']);
  [0, 1, 2].forEach(i => $('#actr' + i).oninput = e => $('#actv' + i).textContent = e.target.value);
  $('#actHints') && ($('#actHints').onclick = e => {
    const b = e.target.closest('[data-hint]'); if (!b) return;
    const empty = [0, 1, 2].map(i => $('#act' + i)).find(x => !x.value.trim());
    if (empty && ![0, 1, 2].some(i => $('#act' + i).value === b.dataset.hint)) { empty.value = b.dataset.hint; b.classList.add('on'); }
  });
  $('#seePlan').onclick = () => {
    const dateVal = c.needsDate ? $('#aDate').value : '';
    if (c.needsDate && !dateVal) { $('#assessMsg').textContent = 'Add the date of your surgery or injury. Return to sport is timed from it.'; return; }
    const answers = { restPain: +$('#aRest').value, worstPain: +$('#aWorst').value, settle: choiceOf('aSettle'), nightPain: choiceOf('aNight') === '1',
      duration: choiceOf('aDur'), goal: choiceOf('aGoal'), daysAvailable: +$('#aDays').value };
    const acts = [0, 1, 2].map(i => ({ name: $('#act' + i).value.trim(), v: +$('#actr' + i).value })).filter(a => a.name);
    const a = { answers, acts, side: limb ? choiceOf('sideSel') || null : null, dateAt: dateVal ? new Date(dateVal + 'T12:00').getTime() : null, usualMorning: +$('#um').value };
    if (!info.screen) return showPlan(c, info, a);
    S.rehab.intake = { cond: c.id, info, a, queue: screenQueue(info.area), idx: 0, results: [], startedAt: Date.now() };
    persist(); openScreenRunner();
  };
}

// 3. Movement check: a short guided series of camera tests, one after another.
function openScreenRunner(msg = '') {
  const ik = S.rehab.intake; if (!ik) return;
  if (ik.idx >= ik.queue.length) return finishScreen();
  const step = ik.queue[ik.idx], d = ROM_TESTS[step.test];
  openSheet(`<div><span class="eyebrow">Step 3 of 4 · movement check · ${ik.idx + 1} of ${ik.queue.length}</span><h2 class="display h2" id="rsheetTitle" style="margin-top:6px;font-size:1.3rem">${esc(d.name)}${step.side ? ` · ${sideWord(step.side)}` : ''}</h2></div>
    <div class="phase-track">${ik.queue.map((_, i) => `<i class="${i < ik.idx ? 'done' : i === ik.idx ? 'now' : ''}"></i>`).join('')}</div>
    ${msg ? `<p class="note" style="color:var(--warn);margin:0">${esc(msg)}</p>` : ''}
    <ol class="steps"><li>${esc(d.how)}</li>${step.side && d.view === 'side' ? `<li>Turn so your ${sideWord(step.side)} side is nearest the camera.</li>` : ''}<li>Recording lasts ${d.secs} seconds after a countdown. Only move as far as is comfortable: a small movement still counts, and it gets measured.</li></ol>
    <button class="cta" type="button" id="scrGo">Start camera</button>
    <label class="ghost">Upload a video instead<input type="file" id="scrFile" accept="video/*" hidden></label>
    <span class="eyebrow">Can't do this one?</span>
    <div class="btn-row"><button class="ghost" type="button" id="scrPain">Too painful</button><button class="ghost" type="button" id="scrCant">Can't get into position</button></div>
    <p class="muted small" style="margin:0">Camera angles are estimates, not clinical measurements.</p>`);
  const go = (source, file) => {
    closeSheet();
    TEST.rom = { secs: d.secs, label: d.name, minFps: 20, view: d.view, intro: () => d.how, romId: step.test, side: step.side, intake: true };
    startLive(source === 'file' ? { mode: 'rom', source: 'file', file } : { mode: 'rom', source: 'camera' });
  };
  $('#scrGo').onclick = () => go('camera');
  $('#scrFile').onchange = e => { const f = e.target.files[0]; if (f) go('file', f); };
  // Not being able to do a movement is recorded as a result: it changes how the programme starts.
  const skip = reason => { ik.results.push({ at: Date.now(), test: step.test, side: step.side, skipped: true, reason }); ik.idx++; persist(); openScreenRunner(); };
  $('#scrPain').onclick = () => skip('pain');
  $('#scrCant').onclick = () => skip('cant');
}

function finishScreen() {
  const ik = S.rehab.intake, done = ik.results.filter(x => !x.skipped);
  showPlan(COND[ik.cond], ik.info, ik.a, screenFindings(ik.results), done, screenAdjust(ik.results));
}

// 4. The plan, before the programme starts.
function showPlan(c, info, a, findings = [], baseline = [], adj = { gentle: false, physioAdvised: false, reasons: [] }) {
  let con = consult(a.answers);
  // Movements the person couldn't do mean a gentle start, whatever the pain answers said.
  if (adj.gentle && con.irritability !== 'high') con = { ...con, irritability: 'high', reasons: [...adj.reasons] };
  else if (adj.gentle) con = { ...con, reasons: [...con.reasons, ...adj.reasons] };
  const cp = carePlan(c, con), ph = c.phases[0], total = info.screen ? 4 : 3;
  const goals = findings.filter(f => f.criterion), side = a.side || affectedSide(findings) || null;
  openSheet(`<div><span class="eyebrow">Step ${total} of ${total} · your plan</span><h2 class="display h2" id="rsheetTitle" style="margin-top:6px;font-size:1.3rem">${esc(c.name)}</h2>
    <p class="muted small" style="margin:6px 0 0">Made by the app from your answers${info.screen ? ' and measurements' : ''} and the sources below. It isn't a diagnosis, and no clinician has checked it.</p></div>
    ${info.screen ? `<div class="careplan"><span class="eyebrow">What the camera measured</span>
      ${findings.length ? `<ul class="findings">${findings.map(f => `<li class="small">${f.criterion ? '<span class="pill cam">Goal</span> ' : ''}${esc(f.text)}</li>`).join('')}</ul>` : '<p class="small" style="margin:0">Nothing was measured. You can retest from your programme.</p>'}
      ${baseline.length && !goals.length ? '<p class="small" style="margin:0">Movement looked even between sides and within typical ranges, so the programme focuses on pain and strength.</p>' : ''}
      ${goals.length ? `<p class="small muted" style="margin:0">Each goal must be reached before the last phase. You'll retest with the camera as you go.</p>` : ''}</div>` : ''}
    ${adj.physioAdvised ? '<div class="alert urgent"><b>See a physio before going further</b><span class="small">Get a physio to check it before you go further. You can do the phase 1 exercises gently meanwhile, as long as they don\'t increase your pain. The programme stays in phase 1 until a physio has seen you. Your report shows them what you recorded.</span></div>' : ''}
    <div class="careplan">
      <div class="cp-row"><span>Starting level</span><b><span class="pill ${con.irritability === 'high' ? 'voice' : 'cam'}">${LEVEL_NAME[con.irritability]}</span></b></div>
      <div class="cp-row"><span>Pain limit during exercise</span><b>${cp.painLimit}/10</b></div>
      <div class="cp-row"><span>Sessions</span><b>${cp.sessionsPerWeek} a week</b></div>
      <div class="cp-row"><span>Check-ins</span><b>after each session, and weekly</b></div>
      <p class="small" style="margin:6px 0 0">${esc(cp.summary)}</p>
      <ul class="small muted" style="margin:0;padding-left:18px">${cp.reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
      <p class="small" style="margin:0">${esc(cp.goal)} ${esc(cp.expect)}</p>
      ${cp.warnings.map(w => `<p class="small" style="margin:0;color:var(--warn)">${esc(w)}</p>`).join('')}
    </div>
    <span class="eyebrow">Phase 1 · ${esc(ph.name)}</span>
    <div class="list">${ph.exercises.map(([id, d]) => `<div class="row"><b class="small">${esc(LIB[id].name)}</b><span class="muted small">${esc(dose(d, cp.doseLevel))}</span></div>`).join('')}</div>
    <details><summary class="small">The sources behind this programme</summary><p class="muted small">${esc(c.evidence)}</p></details>
    <button class="cta" type="button" id="startPlan">Start programme</button>`);
  $('#startPlan').onclick = () => {
    const now = Date.now();
    S.rehab.active = { cond: c.id, startedAt: now, phase: 0, phaseStartedAt: now, injured: side, postOp: info.postOp, diagnosed: info.diagnosed,
      acts: a.acts.map(x => x.name), psfs: a.acts.length ? [{ at: now, score: psfsScore(a.acts.map(x => x.v)), ratings: a.acts.map(x => x.v) }] : [],
      usualMorning: a.usualMorning, checkins: [], tests: baseline.map(t => ({ ...t })), kneeTests: [], notes: [],
      consult: con, painLimit: cp.painLimit, doseLevel: cp.doseLevel, sessionsPerWeek: cp.sessionsPerWeek, lastReassessAt: now,
      screened: !!info.screen, findings: findings.map(f => ({ test: f.test, text: f.text, goal: !!f.criterion })), extraCriteria: screenCriteria(findings), physioAdvised: !!adj.physioAdvised,
      ...(a.dateAt ? (info.postOp ? { surgeryAt: a.dateAt } : { injuryAt: a.dateAt }) : {}) };
    note(S.rehab.active, `Start: ${LEVEL_NAME[con.irritability].toLowerCase()}, pain limit ${cp.painLimit}/10, ${cp.sessionsPerWeek} sessions a week.${info.screen ? ` Movement check: ${baseline.length} measurement${baseline.length === 1 ? '' : 's'}, ${goals.length} goal${goals.length === 1 ? '' : 's'}.` : ''} Phase 1 started.`);
    S.rehab.intake = null;
    persist(); closeSheet(); renderRehab(); renderToday();
    say(`Your plan is ready. Phase one: ${ph.name}. Do today's exercises, then check in so the app can adjust your load.`, { id: 'rehab_start', priority: 'high' });
  };
}

function rehabHero(p, c) {
  const inj = p.injured, tests = [...new Set([...(p.findings || []).filter(f => f.goal).map(f => f.test), ...c.tests])];
  for (const id of tests) {
    const d = ROM_TESTS[id]; if (!d || d.unit !== '°') continue;
    for (const t of [...p.tests].reverse().filter(x => x.test === id)) {
      const v = inj ? (t[inj] ?? (t.side === inj ? t.value : null)) : (t.value ?? t.L ?? t.R);
      if (v != null) return { num: `${Math.round(v)}°`, label: `${inj ? sideWord(inj)[0].toUpperCase() + sideWord(inj).slice(1) + ' ' : ''}${d.name.toLowerCase()}, latest camera estimate`, ember: false };
    }
  }
  const day = checkinDays(p.checkins).slice(-1)[0];
  if (day) return { num: `${day.during}<small>/10</small>`, label: 'worst pain during your last session', ember: day.during > limitOf(p) };
  return { num: `${p.phase + 1}<small>/${c.phases.length}</small>`, label: `phase: ${c.phases[p.phase].name}`, ember: false };
}

// 5. Your programme: exercises, check-ins, phase checks, measurements, weekly check-ins and the log.
function renderRehabDashboard() {
  const p = plan(), c = condOf(p), ph = c.phases[p.phase], ev = evaluatePhase(c, p.phase, p), block = advanceBlock(p);
  const last = p.checkins.slice(-1)[0], lightInfo = last ? painLight({ ...last, usualMorning: p.usualMorning }, limitOf(p)) : null;
  const pending = p.checkins.find(k => k.nextMorning == null && Date.now() - k.at > 8 * 3600e3 && Date.now() - k.at < 48 * 3600e3);
  const review = needsReview(c, p), due = Date.now() >= nextReassess(p);
  const latest = id => [...p.tests].reverse().find(t => t.test === id);
  const testRow = id => { const d = ROM_TESTS[id], t = latest(id); const v = t ? (t.value != null ? `${t.value}${d.unit === '°' ? '°' : ' ' + d.unit}${t.side ? ` (${sideWord(t.side)})` : ''}` : `L ${t.L ?? '–'} · R ${t.R ?? '–'}`) : 'not tested'; return `<div class="row"><div><b class="small">${esc(d.name)}</b><br><span class="muted small">${esc(v)} · typical ${esc(d.norm)}</span></div><button type="button" class="ghost" data-romtest="${id}">Test</button></div>`; };
  const painSeries = checkinDays(p.checkins).slice(-12).map(k => k.during), psfsSeries = p.psfs.map(x => x.score);
  const level = p.consult ? LEVEL_NAME[p.consult.irritability] : (p.doseLevel === 'gentle' ? 'Gentle start' : 'Standard start');
  const hero = rehabHero(p, c);
  $('#rehabStage').classList.remove('no-chips');
  $('#rehabNum').hidden = false; $('#rehabNum').innerHTML = hero.num; $('#rehabNum').classList.toggle('ember', hero.ember);
  $('#rehabNumLabel').textContent = hero.label;
  $('#rehabChips').innerHTML = chip('Phase', `${p.phase + 1} of ${c.phases.length}`) + chip('Pain limit', `${limitOf(p)}/10`)
    + chip('Next check-in', due ? 'Today' : fmtDate(nextReassess(p)), due ? 'ember' : '');
  showBody('rehabBody', { focus: focusFor(c.area, p.injured), intensity: hero.ember ? 1 : 0.8 });
  const status = p.diagnosed ? (p.confirmedBy ? `Marked confirmed by ${esc(p.confirmedBy)} (clinician mode)` : 'Diagnosed') : c.general || p.screened ? 'From your movement check' : 'Not confirmed';
  $('#rehabActive').innerHTML = `
    ${review ? `<div class="alert urgent"><b>Get your plan reviewed by a physio</b><span class="small">Your last 2 sessions were flare-ups. Ease off to the exercises that don't flare it, and ask a physiotherapist to review the plan before you progress. If anything new or worrying appears, repeat the safety check.</span><button class="ghost" type="button" id="reviewAgain">Repeat the safety check</button></div>` : ''}
    ${pending ? `<button type="button" class="card rehab-today" id="morningBtn"><span class="eyebrow" style="color:var(--warn)">Quick check</span><b>How does it feel this morning?</b><span class="muted small">This tells the app whether yesterday's load was right. Phase checks only count days with a morning answer.</span></button>` : ''}
    ${due ? `<button type="button" class="card rehab-today" id="reassessBtn"><span class="eyebrow" style="color:var(--z1)">Check-in due</span><b>Weekly check-in</b><span class="muted small">A 1-minute warning-sign recheck and your activity ratings.</span></button>` : ''}
    <div class="card stack patient-file">
      <div class="card-head" style="margin:0"><div><span class="eyebrow">Your programme · phase ${p.phase + 1} of ${c.phases.length}${p.postOp ? ' · after surgery: follow your physio\'s plan' : ''}</span><h2 class="display h2">${esc(ph.name)}</h2><span class="muted small">${esc(ph.goal)}</span></div></div>
      <div class="phase-track">${c.phases.map((_, i) => `<i class="${i < p.phase ? 'done' : i === p.phase ? 'now' : ''}"></i>`).join('')}</div>
      <span class="muted small">${esc(level)}, ${p.sessionsPerWeek || 3} sessions a week. ${status}.${p.requireApproval ? ' Your clinician approves phase changes.' : ''}</span>
      <div class="btn-row"><button class="ghost" type="button" id="shareReport">Share report</button><button class="ghost" type="button" id="clinicianBtn">Clinician mode</button></div>
    </div>
    <div class="card"><span class="eyebrow">Today's exercises</span>
      <div style="margin-top:4px">${ph.exercises.map(([id, d]) => { const x = LIB[id]; return `<button type="button" class="ex-row" data-train="${id}" style="width:100%;background:none;border-left:0;border-right:0;border-bottom:0;text-align:left;cursor:pointer;padding-inline:0"><span class="pic">${icon(iconKey(id))}</span><div><b>${esc(x.name)}</b><span class="tag" style="${x.pattern ? '' : 'color:var(--z3)'}">${x.pattern ? 'Form check on' : 'Tempo coaching on'}</span></div><span class="sets">${esc(dose(d, p.doseLevel))}</span></button>`; }).join('')}</div>
      <div class="stack" style="margin-top:12px"><button class="cta" type="button" id="checkinRehab">${p.checkins.some(k => dayKey(k.at) === dayKey(Date.now())) ? 'Update today\'s check-in' : 'Check in after today\'s session'}</button></div>
      ${lightInfo ? `<p style="margin:12px 0 0"><span class="light ${lightInfo.light}">${lightInfo.light === 'green' ? 'On track' : lightInfo.light === 'amber' ? 'Hold the load' : 'Ease off'}</span><br><span class="muted small">${esc(lightInfo.advice)}</span></p>` : ''}
    </div>
    <div class="card"><span class="eyebrow">To move to the next phase</span>
      <div style="margin-top:8px">${ev.items.map(i => `<div class="crit ${i.met ? 'met' : ''}"><span class="tick">${i.met ? '✓' : ''}</span><span>${esc(i.label)}<small>${esc(i.detail || '')}</small></span></div>`).join('')}</div>
      ${block && p.phase < c.phases.length - 1 ? `<p class="muted small" style="margin:10px 0 0">${esc(block)}</p>` : ''}
      ${canAdvance(p, ev) && p.phase < c.phases.length - 1 ? `<button class="cta" type="button" id="nextPhase" style="margin-top:10px">Move to phase ${p.phase + 2}</button>` : ''}
      ${ev.allMet && p.phase === c.phases.length - 1 ? `<div class="alert assess" style="margin-top:10px"><b>All checks met</b><span class="small">You've completed the programme. Keep the strength work going 2× a week.</span></div>` : ''}
    </div>
    ${c.tests.length || ph.criteria.some(k => k.type === 'kneeTest') ? `<div class="card"><span class="eyebrow">Your measurements</span><div class="list" style="margin-top:6px">${c.tests.map(testRow).join('')}
      ${ph.criteria.some(k => k.type === 'kneeTest') ? `<div class="row"><div><b class="small">Single-leg squat knee test</b><br><span class="muted small">${p.kneeTests.length ? `L ${p.kneeTests.slice(-1)[0].L ?? '–'}° · R ${p.kneeTests.slice(-1)[0].R ?? '–'}°` : 'not tested'}</span></div><button type="button" class="ghost" id="goKneeTest">Test</button></div>` : ''}</div>
      <p class="muted small" style="margin:8px 0 0">Camera angles are estimates, not clinical measurements.</p></div>` : ''}
    ${p.findings?.length ? `<details class="card"><summary>Movement check at the start</summary><ul class="findings">${p.findings.map(f => `<li class="small">${f.goal ? '<span class="pill cam">Goal</span> ' : ''}${esc(f.text)}</li>`).join('')}</ul></details>` : ''}
    <div class="card stack"><div class="card-head" style="margin:0"><div><span class="eyebrow">Daily activities</span><div class="num" style="font-size:1.8rem;margin-top:4px">${psfsSeries.length ? psfsSeries[psfsSeries.length - 1] + '/10' : '–'}</div></div><button type="button" class="ghost" id="rerate">Re-rate</button></div>
      ${psfsSeries.length >= 2 ? lineChart(psfsSeries, { min: 0, max: 10, labels: p.psfs.map(x => fmtDate(x.at)) }) : '<span class="muted small">Your weekly check-in re-rates these, so you can see progress.</span>'}
      ${painSeries.length >= 2 ? `<span class="eyebrow">Pain during exercise (worst each day)</span>${lineChart(painSeries, { min: 0, max: 10, labels: painSeries.map((_, i) => String(i + 1)) })}` : ''}</div>
    <details class="card"><summary>Programme log (${(p.notes || []).length})</summary><div class="notes">${[...(p.notes || [])].reverse().map(n => `<div class="note-row"><small>${fmtDate(n.at)}</small><span class="small">${esc(n.text)}</span></div>`).join('') || '<span class="muted small">Nothing logged yet.</span>'}</div></details>
    <details class="card"><summary>About ${esc(c.name.toLowerCase())}</summary><p class="small" style="margin:10px 0 0">${esc(c.about)}</p><p class="muted small">${esc(c.evidence)}</p>
      <p class="muted small">Pain rule: up to ${limitOf(p)}/10 during exercise is OK if it settles by the next morning.</p></details>
    <div class="btn-row">${p.phase > 0 ? '<button class="ghost" type="button" id="prevPhase">Step back a phase</button>' : ''}<button class="ghost" type="button" id="endPlan">End programme</button></div>
    <p class="muted small" style="margin:0">Shred supports rehab exercise. It doesn't diagnose or treat, and no clinician reviews your answers unless one uses clinician mode with you. If symptoms get worse, or a warning sign appears, stop and get checked.</p>`;
  $('#checkinRehab').onclick = openCheckin;
  $('#morningBtn') && ($('#morningBtn').onclick = () => openMorning(pending));
  $('#reassessBtn') && ($('#reassessBtn').onclick = openReassess);
  $('#reviewAgain') && ($('#reviewAgain').onclick = () => openSafety(c, { area: c.area, screen: !!c.general }));
  $('#shareReport').onclick = openReport;
  $('#clinicianBtn').onclick = openClinician;
  $('#nextPhase') && ($('#nextPhase').onclick = () => { p.phase++; p.phaseStartedAt = Date.now(); note(p, `Passed phase ${p.phase} checks. Moved to phase ${p.phase + 1}: ${c.phases[p.phase].name}.`); persist(); renderRehab(); say(`Great work. Phase ${p.phase + 1}: ${c.phases[p.phase].name}.`, { id: 'phase_' + Date.now(), priority: 'high' }); });
  $('#prevPhase') && ($('#prevPhase').onclick = () => { p.phase--; p.phaseStartedAt = Date.now(); note(p, `Stepped back to phase ${p.phase + 1}.`); persist(); renderRehab(); toast('Stepped back a phase. That\'s a normal part of rehab.'); });
  $('#endPlan').onclick = () => openSheet(`<b id="rsheetTitle">End this programme?</b><p class="muted small" style="margin:0">Your results are kept in your history.</p><div class="btn-row"><button class="ghost" type="button" id="endNo">Keep going</button><button class="stop" type="button" id="endYes">End programme</button></div>`) || ($('#endNo').onclick = closeSheet, $('#endYes').onclick = () => { S.rehab.history.push({ ...p, endedAt: Date.now() }); S.rehab.active = null; persist(); closeSheet(); renderRehab(); renderToday(); });
  $('#rerate').onclick = openReassess;
  $('#goKneeTest') && ($('#goKneeTest').onclick = () => { tab('gait'); $('[data-test=sls]').click(); });
  $$('#rehabActive [data-romtest]').forEach(b => b.onclick = () => startRomTest(b.dataset.romtest));
}

// One check-in per day: a second one updates today's record (the evaluator also keeps the worst of the day).
function openCheckin() {
  const p = plan(), c = condOf(p), today = p.checkins.find(k => dayKey(k.at) === dayKey(Date.now()));
  openSheet(`<div><span class="eyebrow">Session check-in</span><h2 class="display h2" id="rsheetTitle" style="margin-top:6px;font-size:1.3rem">How did it feel?</h2>
    <p class="muted small" style="margin:6px 0 0">0 = no pain, 10 = worst imaginable. Your limit is ${limitOf(p)}/10.${today ? ' This updates today\'s check-in.' : ''}</p></div>
    ${slider('pd', 'Highest pain during the exercises', today?.during ?? 2)}${slider('pa', 'Pain now, after the session', today?.after ?? 2)}
    <button class="cta" type="button" id="saveCheckin">Save</button>`);
  bindSliders(['pd', 'pa']);
  $('#saveCheckin').onclick = () => {
    const during = +$('#pd').value, after = +$('#pa').value;
    // Keep the worst of the day: an update can't erase a flare-up already reported today.
    const k = today ? Object.assign(today, { at: Date.now(), during: Math.max(today.during, during), after: Math.max(today.after ?? 0, after) }) : { at: Date.now(), during, after, nextMorning: null };
    if (!today) p.checkins.push(k);
    const l = painLight({ ...k, usualMorning: p.usualMorning }, limitOf(p));
    if (l.light === 'red') note(p, `Flare-up: pain ${k.during}/10 during exercise.`);
    if (needsReview(c, p)) note(p, 'Second flare-up in a row: physio review advised, progression paused.');
    persist(); closeSheet(); renderRehab();
    say(l.light === 'green' ? 'Good session. Pain stayed within your limit. The app will ask how it feels tomorrow morning.' : l.light === 'amber' ? 'A little over your limit. Keep the same load next time and see how it settles.' : 'That was too much today. Next session, ease off: fewer sets or a smaller range.', { id: 'ck_' + Date.now(), priority: 'high' });
  };
}
function openMorning(k) {
  const p = plan();
  openSheet(`<h2 class="display h2" id="rsheetTitle" style="font-size:1.3rem">This morning</h2>${slider('pm', 'Pain or stiffness right now', p.usualMorning ?? 2)}<button class="cta" type="button" id="saveMorning">Save</button>`);
  bindSliders(['pm']);
  $('#saveMorning').onclick = () => {
    k.nextMorning = +$('#pm').value;
    const l = painLight({ ...k, usualMorning: p.usualMorning }, limitOf(p));
    if (l.light === 'red') note(p, `Worse the next morning (${k.nextMorning}/10 against a usual ${p.usualMorning}/10).`);
    persist(); closeSheet(); renderRehab();
    say(l.light === 'red' ? 'It\'s more irritated than usual this morning, so go lighter today.' : 'It settled well. Yesterday\'s load looks about right.', { id: 'mn_' + Date.now(), priority: 'high' });
  };
}

// Weekly check-in: recheck the warning signs that can appear during rehab, then re-rate activities.
function openReassess() {
  const p = plan(), c = condOf(p), acts = p.acts.length ? p.acts : ['Your main activity'];
  const flags = [...c.flags, ...GENERAL_FLAGS].filter(f => !f.unchecked);
  openSheet(`<div><span class="eyebrow">Weekly check-in</span><h2 class="display h2" id="rsheetTitle" style="margin-top:6px;font-size:1.3rem">How are things now?</h2>
    <p class="muted small" style="margin:6px 0 0">Since your last check, has any of this started?</p></div>
    <div id="flagList">${flags.map((f, i) => `<div class="flag-q" data-i="${i}"><span>${esc(f.q)}</span><span class="yn"><button type="button" class="yes" data-v="1">Yes</button><button type="button" class="no on" data-v="0">No</button></span></div>`).join('')}</div>
    <span class="eyebrow">Rate your activities</span><p class="muted small" style="margin:0">0 = can't do it, 10 = as well as before.</p>
    ${acts.map((a, i) => slider('rr' + i, esc(a), p.psfs.slice(-1)[0]?.ratings?.[i] ?? 5)).join('')}<button class="cta" type="button" id="saveRr">Save check-in</button>`);
  const yes = new Set();
  $('#flagList').onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; const row = b.closest('.flag-q'), i = +row.dataset.i; b.dataset.v === '1' ? yes.add(i) : yes.delete(i); row.querySelectorAll('[data-v]').forEach(x => x.classList.toggle('on', x === b)); };
  bindSliders(acts.map((_, i) => 'rr' + i));
  $('#saveRr').onclick = () => {
    const level = triage(flags.map((f, i) => ({ yes: yes.has(i), level: f.level })));
    p.lastReassessAt = Date.now();
    if (level) { note(p, `Weekly check-in: warning sign reported (${level}). Programme paused until checked.`); persist(); renderRehab(); return showStop(level, flags.filter((f, i) => yes.has(i) && f.level === level)); }
    const r = acts.map((_, i) => +$('#rr' + i).value); p.psfs.push({ at: Date.now(), score: psfsScore(r), ratings: r });
    note(p, `Weekly check-in: no warning signs; daily activities ${psfsScore(r)}/10.`);
    persist(); closeSheet(); renderRehab();
  };
}

// 6. Clinician mode: the physio's own PIN, on this phone, at a visit. Every change is logged under their name.
function openClinician() {
  const rec = S.rehab.clinician;
  if (!rec) {
    openSheet(`<div><span class="eyebrow">Clinician mode</span><h2 class="display h2" id="rsheetTitle" style="margin-top:6px;font-size:1.3rem">Set up clinician access</h2>
      <p class="muted small" style="margin:6px 0 0">For the physiotherapist or doctor treating you, at a visit. They choose the PIN, not you. Every change they make is logged under their name and shown on your report.</p></div>
      <label class="field">Clinician's name<input id="cName" autocomplete="off"></label>
      <label class="field">Profession<select id="cRole"><option>Physiotherapist</option><option>Doctor</option><option>Other clinician</option></select></label>
      <label class="field">PIN (4–8 digits)<input id="cPin" type="password" inputmode="numeric" autocomplete="off"></label>
      <label class="field">PIN again<input id="cPin2" type="password" inputmode="numeric" autocomplete="off"></label>
      <button class="cta" type="button" id="cSave">Save and open</button><p class="note" id="cMsg"></p>`);
    $('#cSave').onclick = async () => {
      if ($('#cPin').value !== $('#cPin2').value) { $('#cMsg').textContent = 'The PINs don\'t match.'; return; }
      try {
        const r = await clinicianSetup({ name: $('#cName').value, role: $('#cRole').value, pin: $('#cPin').value });
        S.rehab.clinician = r;
        if (plan()) note(plan(), `Clinician access set up under the name ${r.name} (${r.role}).`);
        persist(); openClinicianPanel(r);
      } catch (e) { $('#cMsg').textContent = e.message; }
    };
    return;
  }
  openSheet(`<div><span class="eyebrow">Clinician mode</span><h2 class="display h2" id="rsheetTitle" style="margin-top:6px;font-size:1.3rem">${esc(rec.name)}</h2><p class="muted small" style="margin:6px 0 0">${esc(rec.role)}</p></div>
    <label class="field">PIN<input id="cPin" type="password" inputmode="numeric" autocomplete="off"></label>
    <button class="cta" type="button" id="cOpen">Open</button><p class="note" id="cMsg"></p>
    <button class="linkbtn" type="button" id="cReset">Different clinician, or forgot the PIN? Reset access</button>`);
  $('#cOpen').onclick = async () => {
    const r = await verifyPin(rec, $('#cPin').value); persist();
    if (r.ok) return openClinicianPanel(rec);
    $('#cMsg').textContent = r.lockedFor ? `Too many wrong PINs. Try again in ${Math.ceil(r.lockedFor / 60e3)} minutes.` : `Wrong PIN. ${r.triesLeft} ${r.triesLeft === 1 ? 'try' : 'tries'} left.`;
  };
  $('#cReset').onclick = () => {
    openSheet(`<b id="rsheetTitle">Reset clinician access?</b><p class="muted small" style="margin:0">The clinician will need to set it up again. The reset is recorded in your programme log and on your report.</p><div class="btn-row"><button class="ghost" type="button" id="crNo">Cancel</button><button class="stop" type="button" id="crYes">Reset</button></div>`);
    $('#crNo').onclick = openClinician;
    $('#crYes').onclick = () => { S.rehab.clinician = null; if (plan()) note(plan(), 'Clinician access was reset on this phone.'); persist(); renderRehab(); openClinician(); };
  };
}

function openClinicianPanel(rec, msg = '') {
  const p = plan();
  if (!p) { openSheet(`<p id="rsheetTitle" class="small">Clinician access is set up for ${esc(rec.name)}. Start a programme first, then open clinician mode from it.</p><button class="cta" type="button" id="clDone">Close</button>`); $('#clDone').onclick = closeSheet; return; }
  const c = condOf(p), who = { name: rec.name, role: rec.role };
  const opts = CONDITIONS.filter(x => !x.general).map(x => `<option value="${x.id}" ${x.id === p.cond ? 'selected' : ''}>${esc(x.area)} · ${esc(x.name)}</option>`).join('');
  openSheet(`<div><span class="eyebrow">Clinician mode · ${esc(rec.name)}</span><h2 class="display h2" id="rsheetTitle" style="margin-top:6px;font-size:1.3rem">${esc(c.name)}</h2>
      <p class="muted small" style="margin:6px 0 0">Phase ${p.phase + 1} of ${c.phases.length} · ${p.diagnosed ? (p.confirmedBy ? `confirmed by ${esc(p.confirmedBy)}` : 'patient reports a diagnosis') : 'not confirmed'}${p.injured ? ` · ${sideWord(p.injured)} side` : ''}. Changes are logged under your name.</p></div>
    ${msg ? `<p class="note" style="margin:0;color:var(--good)">${esc(msg)}</p>` : ''}
    <div class="cl-block"><b class="small">Confirm the diagnosis</b><select id="clCond" aria-label="Diagnosis">${c.general ? `<option value="" selected>Choose…</option>` : ''}${opts}</select><button class="ghost" type="button" id="clDx">Confirm and switch programme</button></div>
    ${c.needsDate ? `<div class="cl-block"><b class="small">Surgery or injury date</b>${choice('clDateKind', 'Date of', [['surgery', 'Surgery'], ['injury', 'Injury']], p.surgeryAt != null || p.postOp ? 'surgery' : 'injury')}<input type="date" id="clDate" aria-label="Date" max="${new Date().toISOString().slice(0, 10)}"><button class="ghost" type="button" id="clDateSave">Save date</button></div>` : ''}
    <div class="cl-block"><b class="small">Set the phase</b><select id="clPhase" aria-label="Phase">${c.phases.map((ph, i) => `<option value="${i}" ${i === p.phase ? 'selected' : ''}>Phase ${i + 1}: ${esc(ph.name)}</option>`).join('')}</select><input id="clReason" placeholder="Reason (required)" aria-label="Reason"><button class="ghost" type="button" id="clPh">Set phase</button></div>
    <div class="cl-block"><b class="small">Dose and pain limit</b>${choice('clDose', 'Dose', [['gentle', 'Gentle'], ['standard', 'Standard']], p.doseLevel || 'standard')}<label class="field">Pain limit during exercise (0–10)<input id="clLimit" type="number" min="0" max="10" value="${limitOf(p)}"></label><button class="ghost" type="button" id="clDoseSave">Save dose</button></div>
    <div class="cl-block">${choice('clAppr', 'Phase changes', [['0', 'Patient moves on when checks are met'], ['1', 'Need my approval']], p.requireApproval ? '1' : '0')}<button class="ghost" type="button" id="clApprSave">Save</button></div>
    <div class="cl-block"><b class="small">Note</b><textarea id="clNote" rows="3" aria-label="Note"></textarea><button class="ghost" type="button" id="clNoteSave">Add note</button></div>
    <p class="note" id="clMsg"></p>
    <button class="cta" type="button" id="clDone">Close clinician mode</button>`);
  bindChoices($('#rsheetBody'));
  const act = (a, done) => { try { applyClinician(p, a, who); persist(); renderRehab(); openClinicianPanel(rec, done); } catch (e) { $('#clMsg').textContent = e.message; } };
  $('#clDx').onclick = () => { const v = $('#clCond').value; if (!v) { $('#clMsg').textContent = 'Choose a diagnosis first.'; return; } act({ type: 'diagnose', cond: v }, 'Diagnosis confirmed. Programme switched to phase 1.'); };
  $('#clDateSave') && ($('#clDateSave').onclick = () => { const v = $('#clDate').value; if (!v) { $('#clMsg').textContent = 'Pick a date.'; return; } const at = new Date(v + 'T12:00').getTime(); act(choiceOf('clDateKind') === 'surgery' ? { type: 'dates', surgeryAt: at } : { type: 'dates', injuryAt: at }, 'Date saved.'); });
  $('#clPh').onclick = () => act({ type: 'setPhase', phase: +$('#clPhase').value, reason: $('#clReason').value }, 'Phase set.');
  $('#clDoseSave').onclick = () => act({ type: 'dose', doseLevel: choiceOf('clDose'), painLimit: +$('#clLimit').value }, 'Dose saved.');
  $('#clApprSave').onclick = () => act({ type: 'requireApproval', on: choiceOf('clAppr') === '1' }, 'Saved.');
  $('#clNoteSave').onclick = () => act({ type: 'note', text: $('#clNote').value }, 'Note added.');
  $('#clDone').onclick = closeSheet;
}

// 7. Report to share with a physio before or at a visit.
const rpDate = at => new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
function reportHtml(d) {
  const status = d.diagnosed ? (d.confirmedBy ? `marked confirmed in clinician mode as "${esc(d.confirmedBy)}"; the app can't verify who entered this` : 'patient reports a diagnosis') : d.general || d.screened ? 'from the movement check, no diagnosis' : 'picked by the patient, not confirmed';
  return `<div class="report"><h3>Rehab progress report${d.name ? ` · ${esc(d.name)}` : ''}</h3><p class="small muted">${rpDate(d.generatedAt)}</p>
    <table class="rp"><tr><th>Programme</th><td>${esc(d.condition)} (${status})</td></tr>
      <tr><th>Phase</th><td>${d.phase} of ${d.phases}: ${esc(d.phaseName)}</td></tr>
      <tr><th>Started</th><td>${rpDate(d.startedAt)}${d.surgeryAt ? ` · surgery ${rpDate(d.surgeryAt)}` : d.injuryAt ? ` · injury ${rpDate(d.injuryAt)}` : ''}</td></tr>
      <tr><th>Side</th><td>${d.injured ? sideWord(d.injured) : 'both / not a limb'}</td></tr>
      <tr><th>Pain limit</th><td>${d.painLimit}/10 · ${d.doseLevel} dose${d.requireApproval ? ' · phase changes need clinician approval' : ''}</td></tr></table>
    ${d.findings.length ? `<h4>Movement check at the start</h4><ul>${d.findings.map(f => `<li>${esc(f.text)}</li>`).join('')}</ul>` : ''}
    ${d.measurements.length ? `<h4>Measurements</h4><table class="rp"><tr><th>Test</th><th>First</th><th>Latest</th><th>Other side</th><th>Approx. % of other side</th></tr>${d.measurements.map(m => `<tr><td>${esc(m.name)}${m.side ? ` (${sideWord(m.side)})` : ''}</td><td>${m.first}${esc(m.unit)}</td><td>${m.latest}${esc(m.unit)}</td><td>${m.other ?? '–'}${m.other != null ? esc(m.unit) : ''}</td><td>${m.lsi != null ? m.lsi + '%' : '–'}</td></tr>`).join('')}</table>` : ''}
    ${d.painDays.length ? `<h4>Pain during exercise, last ${d.painDays.length} session days</h4><p>${d.painDays.map(x => x.during).join(' · ')} (0–10) · flare-ups so far: ${d.flareUps}</p>` : ''}
    ${d.psfs ? `<h4>Daily activities (0–10)</h4><p>${d.psfs.first} → ${d.psfs.latest}${d.psfs.activities.length ? ` · ${esc(d.psfs.activities.join(', '))}` : ''}</p>` : ''}
    ${d.notes.length ? `<h4>Programme log</h4><ul>${d.notes.map(n => `<li>${rpDate(n.at)}: ${esc(n.text)}</li>`).join('')}</ul>` : ''}
    <p class="small muted">${esc(REPORT_DISCLAIMER)}</p></div>`;
}
function openReport() {
  const d = reportData(plan(), S.profile), text = reportText(d), html = reportHtml(d);
  $('#reportPrint').innerHTML = html;
  openSheet(`<div><span class="eyebrow">Share with your physio</span><h2 class="display h2" id="rsheetTitle" style="margin-top:6px;font-size:1.3rem">Progress report</h2>
    <p class="muted small" style="margin:6px 0 0">Send it before a visit, or show it on your phone. It holds your name, injury and results, so only share it with people you choose.</p></div>
    <div class="report-preview">${html}</div>
    <div class="btn-row"><button class="cta" type="button" id="rpShare">Share as text</button><button class="ghost" type="button" id="rpPrint">Print or save as PDF</button></div><p class="note" id="rpMsg"></p>`);
  $('#rpShare').onclick = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'Rehab progress report', text });
      else { await navigator.clipboard.writeText(text); $('#rpMsg').textContent = 'Copied. Paste it into a message to your physio.'; }
    } catch (e) { if (e.name !== 'AbortError') $('#rpMsg').textContent = 'Sharing didn\'t work on this device. Use Print or save as PDF.'; }
  };
  $('#rpPrint').onclick = () => { document.body.classList.add('printing-report'); window.print(); setTimeout(() => document.body.classList.remove('printing-report'), 1000); };
}

// 8. Camera measurement tests. For a one-sided injury, the person states which side is being tested,
// because only the injured side's results can pass a phase check.
function startRomTest(id) {
  const d = ROM_TESTS[id], p = plan();
  const askSide = !d.bothSides && (d.chooseSide || !!p?.injured);
  let side = p?.injured || 'L';
  const go = (source, file) => {
    closeSheet();
    TEST.rom = { secs: d.secs, label: d.name, minFps: 20, view: d.view, intro: () => d.how, romId: id, side: askSide ? side : null };
    startLive(source === 'file' ? { mode: 'rom', source: 'file', file } : { mode: 'rom', source: 'camera' });
  };
  openSheet(`<div><span class="eyebrow">Measurement</span><h2 class="display h2" id="rsheetTitle" style="margin-top:6px;font-size:1.3rem">${esc(d.name)}</h2></div>
    <ol class="steps"><li>${esc(d.how)}</li><li>Recording lasts ${d.secs} seconds and starts after a countdown.</li>${d.view === 'side' && askSide ? '<li>Put the side you are testing nearest the camera.</li>' : ''}</ol>
    ${askSide ? choice('romSide', 'Which side are you testing?', [['L', `Left${p?.injured === 'L' ? ' (injured)' : ''}`], ['R', `Right${p?.injured === 'R' ? ' (injured)' : ''}`]], side) : ''}
    <button class="cta" type="button" data-side="go">Start</button>
    <label class="ghost">Upload a video instead<input type="file" id="romFile" accept="video/*" hidden></label>
    <p class="muted small" style="margin:0">Camera angles are estimates, not clinical measurements.</p>`);
  bindChoices($('#rsheetBody'));
  const readSide = () => { if (askSide) side = choiceOf('romSide') || side; };
  $('#rsheetBody [data-side]').onclick = () => { readSide(); go('camera'); };
  $('#romFile').onchange = e => { const f = e.target.files[0]; if (!f) return; readSide(); go('file', f); };
}

async function finishRom(frames, q) {
  const cfg = TEST.rom, d = ROM_TESTS[cfg.romId], p = plan();
  const mPerPx = scaleFromHeight(frames.slice(0, 20), (S.profile.heightCm || 0) / 100);
  const r = await runRomTest(cfg.romId, frames, { mPerPx });
  tab('rehab');
  const bad = q.score < 40 || !r.ok;
  const msg = bad ? (q.score < 40 ? 'Recording quality was too low: ' + (q.issues[0] || 'check the camera view.') : r.issues[0]) : '';
  // During the movement check, results go into the check, and the next test follows.
  if (cfg.intake && S.rehab.intake) {
    if (bad) { say('The camera couldn\'t measure that one.', { id: 'rom_fail_' + Date.now(), priority: 'high' }); return openScreenRunner(`The camera couldn't measure that: ${msg} If the camera was the problem, start it again. If the movement itself was too hard, say so below: that's useful too.`); }
    const ik = S.rehab.intake;
    ik.results.push({ at: Date.now(), test: cfg.romId, side: cfg.side || r.side || null, value: r.value, L: r.L, R: r.R, quality: q.score });
    ik.idx++; persist();
    say(`${d.name}: done.`, { id: 'rom_' + Date.now(), priority: 'high' });
    return openScreenRunner();
  }
  if (bad) {
    say('The camera couldn\'t measure that one.', { id: 'rom_fail_' + Date.now(), priority: 'high' });
    if (!p) return toast(msg);
    openSheet(`<div><span class="eyebrow">Measurement</span><h2 class="display h2" id="rsheetTitle" style="margin-top:6px;font-size:1.3rem">${esc(d.name)}: not measured</h2>
      <p class="muted small" style="margin:6px 0 0">${esc(msg)}</p></div>
      <p class="small" style="margin:0">Was it the camera, or the movement?</p>
      <button class="cta" type="button" id="rfAgain">Camera: try again</button>
      <div class="btn-row"><button class="ghost" type="button" id="rfPain">Too painful</button><button class="ghost" type="button" id="rfCant">Couldn't do it</button></div>`);
    $('#rfAgain').onclick = () => startRomTest(cfg.romId);
    const log = why => { note(p, `${d.name}${cfg.side ? ` (${sideWord(cfg.side)})` : ''}: ${why}.`); persist(); closeSheet(); renderRehab(); toast('Noted in your programme log. If a movement is newly too painful, ease off and repeat the safety check. If it keeps happening, see a physio.'); };
    $('#rfPain').onclick = () => log('too painful to do');
    $('#rfCant').onclick = () => log('couldn\'t do the movement');
    return;
  }
  const rec = { at: Date.now(), test: cfg.romId, side: cfg.side || r.side || null, value: r.value, L: r.L, R: r.R, quality: q.score };
  const val = r.value != null ? `${r.value}${d.unit === '°' ? ' degrees' : ' ' + d.unit}` : `left ${r.L}, right ${r.R}`;
  if (p) { p.tests.push(rec); note(p, `${d.name}: ${val}${rec.side ? ` (${sideWord(rec.side)})` : ''}.`); persist(); renderRehab(); }
  say(`${d.name}: ${val}.`, { id: 'rom_' + Date.now(), priority: 'high' });
  toast(`${d.name}: ${r.value != null ? r.value + (d.unit === '°' ? '°' : ' ' + d.unit) : `L ${r.L} · R ${r.R}`}`);
}

function renderRehabToday() {
  const p = plan(), el = $('#rehabToday'); el.hidden = !p; if (!p) return;
  const c = condOf(p), ev = evaluatePhase(c, p.phase, p), due = Date.now() >= nextReassess(p);
  el.innerHTML = `<span class="eyebrow" style="color:var(--good)">Rehab · phase ${p.phase + 1} of ${c.phases.length}</span><b>${esc(c.name)}</b><span class="muted small">${c.phases[p.phase].exercises.length} exercises today · ${ev.items.filter(i => i.met).length}/${ev.items.length} phase checks met${due ? ' · weekly check-in due' : ''}</span>`;
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
  const rl = rk ? painLight({ ...rk, usualMorning: S.rehab.active.usualMorning }, S.rehab.active.painLimit ?? COND[S.rehab.active.cond].painLimit).light : null;
  const rec = recommendToday({ check: c, history: hist, sessions: S.loads, jumpStatus: jr?.status, rehabLight: rl });
  const card = $('#readyCard'); card.className = 'card stack ' + (c ? rec.level : '');
  $('#readyResult').hidden = !c;
  $$('[data-feel]').forEach(b => b.classList.toggle('on', !!c && c.feel === b.dataset.feel));
  $('#readyTitle').textContent = c ? rec.title : '';
  $('#readyScore').textContent = c ? readiness(c, hist).score + '/100' : '';
  $('#readyReasons').innerHTML = c ? rec.reasons.map(r => '<li>' + esc(r) + '</li>').join('') : '';
  $('#morningCheck').textContent = c ? 'Change or add detail' : 'Add more detail';
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
    <p class="muted small" style="margin:6px 0 0">Rate the whole session about 30 minutes after finishing. 0 = rest, 3 = moderate, 5 = hard, 7 = very hard, 10 = maximal.</p></div>
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
  $('#loadChart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Weekly training load, last 8 weeks">${weeks.map((v, i) => { const h = v / max * (H - 30); return `<rect x="${30 + i * bw + 4}" y="${H - 20 - h}" width="${bw - 8}" height="${h}" rx="5" fill="${i === 7 ? (sp.spike ? '#ffb547' : 'url(#zoneStroke)') : '#2a3348'}"/><text x="${30 + i * bw + bw / 2}" y="${H - 5}" text-anchor="middle" fill="#8c95a8" font-size="10" font-family="IBM Plex Mono, monospace">${i === 7 ? 'now' : '-' + (7 - i) + 'w'}</text>`; }).join('')}</svg>`;
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
  } catch (err) { toast(err?.message === 'recording_unsupported' ? 'This browser can\'t record audio. Try a recent Safari, Chrome or Firefox.' : 'Microphone not available. Allow microphone access for this site.'); studioRec = null; }
  renderStudio();
};
$('#studioExport').onclick = async () => { const data = await exportClips(); if (!Object.keys(data.clips).length) return toast('Record some lines first.'); downloadJSON(`shred-voice-${Date.now()}.json`, data); };

/* ---------- Cycle tracking (prototype, off by default) ----------
   Lives in its own encrypted store (js/cycle/store.js). Nothing from it goes into S, the coach voice,
   session exports or the error log. */
function applyCycleFlag() { const on = readFlags().cycleTracking; $('#cycleTile').hidden = !on; $('#flagCycle').checked = on; }
$('#flagCycle').onchange = e => { setFlag('cycleTracking', e.target.checked); applyCycleFlag(); };
initCycle({ root: $('#cycleRoot'), toast });

/* ---------- Boot ---------- */
applyCycleFlag(); mountOrbs(); bindPlan(); bindProfile(); renderTrain(); renderToday(); applyMute(); renderTestHistory();
if (S.profile.name) $('#welcomeNameWrap').hidden = true;
$('#welcomeBtn').onclick = () => {
  const nm = $('#welcomeName').value.trim();
  if (nm && !S.profile.name) { S.profile.name = nm; $('#pName').value = nm; persist(); renderToday(); }
  $('#welcome').hidden = true;
  say(`${greeting(S.profile.name)} ${nudgeLine()}`, { id: 'greet', priority: 'high' });
  getVideoLandmarker().catch(() => {}); // warm the model up in the background
};
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
window.__shred = { S, CONFIG };
