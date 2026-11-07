import * as store from './store.js';
import { say, registerAvatar, setMuted, greeting, CONFIG } from './coach.js';
import { EXERCISES, RepEngine, allRules, estimateRIR } from './exercises.js';
import { FeedbackCoach, restSeconds } from './feedback.js';
import { getVideoLandmarker, drawPose } from './pose.js';
import { toPx, viewOf, Smoother, bestSide } from './angles.js';
import { MotionTracker, romSummary, torsoLen } from './motion.js';
import { analyseGait } from './gait.js';
import { LIBRARY, LIB, MUSCLES, exFor } from './library.js';
import { HipThrustDemo, WalkDemo, DEMO_W, DEMO_H } from './demo.js';
import { landmarksFrom, analyse, render, navyBodyFat, bfCategory, stanceProblem } from './bodyscan.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let S = store.load();
S.gaits ||= [];
const persist = () => store.save(S);
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
  $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === id));
  if (id === 'today') renderToday();
  if (id === 'progress') renderProgress();
  if (id === 'scan') $('#hipWrap').hidden = S.profile.sex === 'male';
  window.scrollTo(0, 0);
}
$$('.tabs button').forEach(b => b.onclick = () => tab(b.dataset.tab));

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
  if (since === null) return plan.days?.length ? 'Your plan is set. First session today, and I\'ll be right here with you.' : 'Pick your training days below, then let\'s do your first session together.';
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
  $('#muscleChips').innerHTML = ['All', ...MUSCLES].map(m => `<button type="button" class="mchip ${m === muscleFilter ? 'on' : ''}" data-muscle="${m}" aria-pressed="${m === muscleFilter}">${m}</button>`).join('');
  const q = searchQ.trim().toLowerCase();
  const list = LIBRARY.filter(x => (muscleFilter === 'All' || x.muscles.includes(muscleFilter)) && (!q || `${x.name} ${x.muscles.join(' ')} ${x.equipment}`.toLowerCase().includes(q)));
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
  live = { mode, source, frames: [], t0: null, lost: 0, wrong: 0, demo: null, done: false, steps: 0 };
  engine = null; fb = null; smooth.reset(); motion.reset();
  $('#formMeters').hidden = mode !== 'form'; $('#gaitMeters').hidden = mode !== 'gait';
  $('#repBig').hidden = mode !== 'form'; $('#cueHint').hidden = mode !== 'form';
  $('#repNum').textContent = '0'; $('#repLbl').textContent = ex?.hold ? 'seconds' : 'reps'; $('#dots').innerHTML = ''; $('#cleanCt').textContent = '0 clean'; $('#vlKnob').style.left = '0%'; $('#vlTxt').textContent = 'fresh';
  $('#gSteps').textContent = '0'; $('#gProg').style.width = '0';
  $('#liveEyebrow').textContent = mode === 'form' ? ex.name : `Gait · ${gaitMode === 'run' ? 'running' : 'walking'}`;
  $('#liveTitle').textContent = mode === 'form' ? `Set ${setsToday(exKey) + 1}${source === 'demo' ? ' · demo' : ''}` : (source === 'demo' ? 'Demo walker' : source === 'file' ? 'Analysing your video' : 'Walk naturally for 10 seconds');
  $('#endLive').textContent = mode === 'form' ? 'End set' : 'Stop';
  $('#flipCam').hidden = source !== 'camera';
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
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        video.removeAttribute('src'); video.srcObject = stream;
        $('#viewport').classList.toggle('mirror', facing === 'user');
        if (mode === 'form' && $('#recordChk').checked && window.MediaRecorder) {
          chunks = []; recorder = new MediaRecorder(stream); recorder.ondataavailable = e => e.data.size && chunks.push(e.data); recorder.start(1000); $('#recBadge').hidden = false;
        }
      }
      await video.play();
      live.lm = await getVideoLandmarker();
      $('#status').textContent = '';
    }
  } catch (err) {
    console.warn(err);
    $('#status').textContent = source === 'file' ? 'That video couldn\'t be played. Try an MP4 or MOV.' : 'Camera blocked. Allow camera access for this site in your browser settings, then try again.';
    return;
  }

  if (mode === 'form') say(`${ex.name}. ${ex.hold ? 'Get into position and hold.' : ex.setup + ' Start when you\'re ready.'}`, { id: `setup_${exKey}`, priority: 'high' });
  else if (source !== 'file') { say(gaitMode === 'run' ? 'Start running at an easy pace. Recording starts after the countdown.' : 'Walk naturally. Recording starts after the countdown.', { id: 'gait_intro', priority: 'high' }); await countdown(3); }
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
  if (px) live.mode === 'form' ? formFrame(px, ctx, t) : gaitFrame(px, ctx, t);
  if (!live || live.done) return;
  if (live.source === 'file' && video.ended) return live.mode === 'form' ? endSet() : finishGait();
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
    }
    if (ev.faults.length) flagged = true;
    const line = ev.type === 'rep' ? fb.onRep(ev) : fb.onContinuousFault(ev.faults[0]);
    if (line) say(line.text, line);
  }
  motion.draw(ctx);
  const s = raw.s;
  drawPose(ctx, px, { color: flagged ? '#ff5a5f' : '#7c6cff', labels: [{ at: s.kn, value: m.knee }, { at: s.hip, value: m.hip }, ...(ex.primary === 'elbow' ? [{ at: s.el, value: m.elbow }] : [])] });
  const keys = ex.primary === 'elbow' ? ['elbow', 'hip'] : ['hip', 'knee'];
  $('#readout').innerHTML = keys.map(k => `<span>${k} ${fmtA(m[k])}</span>`).join('') + `<span class="muted">${engine.view} view</span>`;
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
    <span>Rep speed loss</span><span class="${vl >= .3 ? 'hot' : ''}">${Math.round(vl * 100)}%</span><span>Reps left in the tank</span><span>${tempo.length >= 3 ? estimateRIR(vl) : '–'}</span>${driftTxt}`;
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

$('#endLive').onclick = () => { if (!live) return; live.mode === 'gait' ? finishGait() : endSet(); };
$('#flipCam').onclick = () => { const m = live?.mode || 'form'; facing = facing === 'user' ? 'environment' : 'user'; stopLive(); live = null; startLive({ mode: m, source: 'camera' }); };
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

/* ---------- Gait ---------- */
let gaitMode = 'walk';
$$('[data-gmode]').forEach(b => b.onclick = () => { gaitMode = b.dataset.gmode; $$('[data-gmode]').forEach(x => x.classList.toggle('on', x === b)); });
$('#gaitLive').onclick = () => startLive({ mode: 'gait', source: 'camera' });
$('#gaitDemo').onclick = () => startLive({ mode: 'gait', source: 'demo' });
$('#gaitFile').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) startLive({ mode: 'gait', source: 'file', file: f }); };
const GAIT_SECONDS = 10;
const footTrails = { L: new MotionTracker(40), R: new MotionTracker(40) };

function gaitFrame(px, ctx, t) {
  live.frames.push({ t, px });
  footTrails.L.push(px[31], 1); footTrails.R.push(px[32], 1);
  footTrails.L.draw(ctx); footTrails.R.draw(ctx);
  drawPose(ctx, px, { color: '#45c3ff' });
  const el = (t - (live.source === 'file' ? 0 : live.t0)) / 1000;
  if (live.source !== 'file') {
    $('#gProg').style.width = Math.min(100, el / GAIT_SECONDS * 100) + '%';
    if (el >= GAIT_SECONDS) return finishGait();
  } else {
    const v = $('#video'); $('#gProg').style.width = (v.duration ? v.currentTime / v.duration * 100 : 0) + '%';
  }
  // Rough live step count: direction changes of the gap between the ankles.
  const gap = px[27].x - px[28].x, sg = Math.sign(gap);
  if (live.lastSign && sg && sg !== live.lastSign) $('#gSteps').textContent = ++live.steps;
  if (sg) live.lastSign = sg;
}

function finishGait() {
  if (!live) return;
  const frames = live.frames, demo = live.source === 'demo';
  stopLive(); $('#live').hidden = true; live = null;
  footTrails.L.reset(); footTrails.R.reset();
  const r = analyseGait(frames, { mode: gaitMode });
  const box = $('#gaitResult'); box.hidden = false;
  if (!r.ok) { box.innerHTML = `<div class="card"><b>No result yet</b><p class="muted small" style="margin:6px 0 0">${esc(r.reason)}</p></div>`; say(r.reason, { id: 'gait_fail', priority: 'high' }); tab('gait'); return; }
  if (!demo) { S.gaits.push({ at: Date.now(), mode: r.mode, view: r.view, cadence: r.cadence, findings: r.findings.map(f => f.title) }); persist(); }
  box.innerHTML = gaitHTML(r, demo);
  tab('gait'); box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const issues = r.findings.filter(f => !f.ok);
  say(issues.length ? `Gait check done. ${Math.round(r.cadence)} steps a minute. The main thing I noticed: ${issues[0].title}. Your fixes are below.` : `Gait check done. ${Math.round(r.cadence)} steps a minute, and your left and right sides are well matched.`, { id: 'gait_done_' + Date.now(), priority: 'high' });
}

function gaitHTML(r, demo) {
  const metric = m => `<div class="metric ${m.ok ? '' : 'warn'}"><small>${esc(m.label)}</small><span class="num">${esc(m.value)}</span><small>${esc(m.unit)} · typical ${esc(m.norm)}</small></div>`;
  return `<div class="card stack">
      <div class="card-head" style="margin:0"><div><span class="eyebrow">${r.view === 'side' ? 'Side view' : 'Front view'} · ${r.mode === 'run' ? 'running' : 'walking'}${demo ? ' · demo' : ''}</span><h2 class="display h2">${Math.round(r.cadence)} steps/min</h2></div><span class="chip-note">${r.steps} steps</span></div>
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

/* ---------- Boot ---------- */
mountOrbs(); bindPlan(); bindProfile(); renderTrain(); renderToday(); applyMute();
$('#welcomeBtn').onclick = () => {
  $('#welcome').hidden = true;
  say(`${greeting(S.profile.name)} ${nudgeLine()}`, { id: 'greet', priority: 'high' });
  getVideoLandmarker().catch(() => {}); // warm the model up in the background
};
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
window.__shred = { S, CONFIG };
