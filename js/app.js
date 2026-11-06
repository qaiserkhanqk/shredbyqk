import * as store from './store.js';
import { say, registerAvatar, setMuted, greeting, praise, countWord } from './coach.js';
import { EXERCISES, RepEngine, allRules, estimateRIR } from './exercises.js';
import { FeedbackCoach, restSeconds } from './feedback.js';
import { getVideoLandmarker, drawPose } from './pose.js';
import { toPx, viewOf, Smoother } from './angles.js';
import { landmarksFrom, analyse, render, navyBodyFat, bfCategory, stanceProblem } from './bodyscan.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let S = store.load();
const persist = () => store.save(S);

/* ---------- Avatar ---------- */
function mountAvatars() {
  $$('.avatar-slot').forEach(slot => {
    slot.innerHTML = '';
    const el = $('#avatar-tpl').content.firstElementChild.cloneNode(true);
    const img = el.querySelector('img');
    if (S.coachPhoto) { img.src = S.coachPhoto; img.hidden = false; el.querySelector('.mono').hidden = true; }
    slot.appendChild(el); registerAvatar(el);
  });
}

/* ---------- Navigation ---------- */
function go(id) {
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.go === id));
  if (id !== 'train') stopCamera();
  if (id === 'home') renderHome();
  if (id === 'progress') renderProgress();
  if (id === 'scan') $('#hipWrap').hidden = S.profile.sex === 'male';
  window.scrollTo(0, 0);
}
document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); });

/* ---------- Home / accountability ---------- */
// Accountability language is autonomy-supportive (Self-Determination Theory, Ryan & Deci 2000):
// it reminds the client of THEIR plan and reasons instead of shaming. Missing once is framed as
// normal ("never miss twice") — habit research shows a single miss doesn't derail habit formation
// (Lally et al. 2010), but all-or-nothing thinking after a slip does.
function nudgeLine() {
  const since = store.daysSinceLast(S), st = store.streak(S), wk = store.thisWeek(S), goal = S.profile.weeklyGoal || 4;
  const plan = S.plan || {}, today = new Date().getDay(), planned = (plan.days || []).includes(today);
  const when = plan.time ? ` at ${plan.time}` : '', where = plan.place ? ` at ${plan.place}` : '';
  if (since === null) return planned || !plan.days?.length ? 'First session today. I\'ll be right here with you.' : 'Set your plan below, then we start.';
  if (since === 0) return st > 1 ? `${st} sessions on track. This is who you are now.` : 'Session done today. That\'s a vote for the person you\'re becoming.';
  if (planned) return `Today's a training day${when}${where}. You planned it, let's keep that promise to yourself.`;
  if (since === 1) return wk >= goal ? 'Weekly goal hit. Recovery is where the muscle is built.' : `${goal - wk} more session${goal - wk > 1 ? 's' : ''} this week gets you to your goal.`;
  if (since === 2) return 'Missing one day is normal. The rule is never miss twice. Even ten minutes counts today.';
  return `It's been ${since} days. No guilt, just restart. One short session today and we're back.`;
}

function renderHome() {
  const name = S.profile.name;
  $('#greet').textContent = greeting(name);
  $('#nudge').textContent = nudgeLine();
  $('#streak').textContent = store.streak(S);
  $('#week').textContent = `${store.thisWeek(S)}/${S.profile.weeklyGoal || 4}`;
  $('#reps').textContent = S.sessions.reduce((n, s) => n + (s.reps || 0), 0);
  const items = [...S.sessions.map(s => ({ at: s.at, t: `${s.name}: ${s.reps} reps, ${s.good} clean` })),
    ...S.checkins.map(c => ({ at: c.at, t: 'Checked in ✓' })),
    ...S.scans.map(c => ({ at: c.at, t: c.bf ? `Body fat ${c.bf.toFixed(1)}%` : 'Posture scan' }))]
    .sort((a, b) => b.at - a.at).slice(0, 5);
  if (items.length) $('#recent').innerHTML = items.map(i => `<li><span>${i.t}</span><span class="muted">${new Date(i.at).toLocaleDateString()}</span></li>`).join('');
}

$('#checkinBtn').onclick = () => {
  S.checkins.push({ at: Date.now() }); persist(); renderHome();
  say(`Logged. That's ${store.streak(S)} day${store.streak(S) > 1 ? 's' : ''} on the streak. Keep showing up.`, { id: 'checkin' });
};

/* Implementation intentions (Gollwitzer & Sheeran 2006): an "if it's X o'clock on Y, I'll train at Z"
   plan roughly doubles follow-through vs a goal alone. */
function bindPlan() {
  S.plan ||= { days: [], time: '', place: '' };
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], order = [1, 2, 3, 4, 5, 6, 0];
  const draw = () => {
    $('#planDays').innerHTML = order.map(d => `<button class="chip ${S.plan.days.includes(d) ? 'on' : ''}" data-day="${d}">${names[d]}</button>`).join('');
    const ds = order.filter(d => S.plan.days.includes(d)).map(d => names[d]);
    $('#planLine').textContent = ds.length ? `"On ${ds.join(', ')}${S.plan.time ? ' at ' + S.plan.time : ''}, I train${S.plan.place ? ' at ' + S.plan.place : ''}."` : '';
  };
  $('#planDays').onclick = e => {
    const b = e.target.closest('[data-day]'); if (!b) return;
    const d = +b.dataset.day, i = S.plan.days.indexOf(d);
    i >= 0 ? S.plan.days.splice(i, 1) : S.plan.days.push(d);
    S.profile.weeklyGoal = S.plan.days.length || S.profile.weeklyGoal; $('#pGoal').value = S.profile.weeklyGoal;
    persist(); draw(); renderHome();
  };
  $('#planTime').value = S.plan.time; $('#planPlace').value = S.plan.place;
  $('#planTime').onchange = e => { S.plan.time = e.target.value; persist(); draw(); renderHome(); };
  $('#planPlace').onchange = e => { S.plan.place = e.target.value.trim(); persist(); draw(); renderHome(); };
  draw();
}

/* Settings */
function bindSettings() {
  const p = S.profile;
  $('#pName').value = p.name; $('#pSex').value = p.sex; $('#pHeight').value = p.heightCm; $('#pGoal').value = p.weeklyGoal;
  $('#pName').onchange = e => { p.name = e.target.value.trim(); persist(); renderHome(); };
  $('#pSex').onchange = e => { p.sex = e.target.value; persist(); };
  $('#pHeight').onchange = e => { p.heightCm = +e.target.value; persist(); };
  $('#pGoal').onchange = e => { p.weeklyGoal = Math.max(1, Math.min(7, +e.target.value || 4)); persist(); renderHome(); };
  $('#coachPhoto').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    S.coachPhoto = await downscale(f, 320); persist(); mountAvatars();
  };
  const fillVoices = () => {
    const vs = speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));
    $('#voiceSel').innerHTML = vs.map(v => `<option ${v.name === localStorage.getItem('qk_voice') ? 'selected' : ''}>${v.name}</option>`).join('');
  };
  if ('speechSynthesis' in window) { fillVoices(); speechSynthesis.onvoiceschanged = fillVoices; }
  $('#voiceSel').onchange = e => localStorage.setItem('qk_voice', e.target.value);
  $('#testVoice').onclick = () => say('Right, let\'s go. Feet planted, brace your core, and give me ten good reps.');
}

function downscale(file, max) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = img.width * s; c.height = img.height * s;
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.82));
    };
    img.src = URL.createObjectURL(file);
  });
}

let isMuted = false;
$('#muteBtn').onclick = () => { isMuted = !isMuted; setMuted(isMuted); $('#muteBtn').textContent = isMuted ? '🔇' : '🔊'; };

/* ---------- Train: live form check ---------- */
let fb = null, exKey = 'squat', stream = null, facing = 'user', running = false, engine = null, recorder = null, chunks = [], source = 'camera';
const smooth = new Smoother(0.55);

function renderChips() {
  $('#exChips').innerHTML = Object.entries(EXERCISES).map(([k, e]) => `<button class="chip ${k === exKey ? 'on' : ''}" data-ex="${k}">${e.name}</button>`).join('');
  $('#setupTip').textContent = '📐 ' + EXERCISES[exKey].setup;
}
$('#exChips').onclick = e => { const b = e.target.closest('[data-ex]'); if (!b) return; exKey = b.dataset.ex; renderChips(); };

async function startSession(fileUrl) {
  $('#picker').hidden = true; $('#summary').hidden = true; $('#stage').hidden = false;
  $('#status').textContent = 'Loading coach vision…';
  $('#repNum').textContent = '0';
  const video = $('#video');
  source = fileUrl ? 'file' : 'camera';
  $('#flipCam').hidden = !!fileUrl;
  try {
    if (fileUrl) {
      video.srcObject = null; video.src = fileUrl; video.loop = false;
      $('#viewport').classList.remove('mirror');
    } else {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      video.removeAttribute('src'); video.srcObject = stream;
      $('#viewport').classList.toggle('mirror', facing === 'user');
      if ($('#recordChk').checked && window.MediaRecorder) {
        chunks = []; recorder = new MediaRecorder(stream);
        recorder.ondataavailable = e => e.data.size && chunks.push(e.data);
        recorder.start(1000);
      }
    }
    await video.play();
  } catch (err) {
    $('#status').textContent = fileUrl ? 'Could not play that video.' : 'Camera blocked. Allow camera access in your browser settings.';
    return;
  }
  const lm = await getVideoLandmarker();
  $('#status').textContent = '';
  const ex = EXERCISES[exKey];
  engine = null; smooth.reset();
  say(`${ex.name}. ${ex.setup} Start when you're ready.`, { id: `setup_${exKey}`, priority: 'high' });
  running = true;
  loop(lm, ex);
}

let lastTs = -1, lostFrames = 0, wrongView = 0;
function loop(lm, ex) {
  if (!running) return;
  const video = $('#video'), canvas = $('#overlay');
  if (video.readyState >= 2 && video.videoWidth) {
    if (canvas.width !== video.videoWidth) { canvas.width = video.videoWidth; canvas.height = video.videoHeight; }
    const ts = performance.now();
    if (ts > lastTs) {
      lastTs = ts;
      const res = lm.detectForVideo(video, ts);
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const raw = res.landmarks?.[0];
      if (raw) processFrame(ex, toPx(raw, canvas.width, canvas.height), ctx);
      else if (++lostFrames === 45) say('I can\'t see you. Step back so your whole body is in the frame.', { id: 'not_visible', priority: 'high' });
    }
  }
  if (source === 'file' && video.ended) { endSet(); return; }
  requestAnimationFrame(() => loop(lm, ex));
}

function processFrame(ex, px, ctx) {
  const view = viewOf(px);
  if (!engine) { engine = new RepEngine(ex, ex.view === 'either' ? view : ex.view); fb = new FeedbackCoach(); }
  const raw = ex.metrics(px, engine.view);
  const m = { ...raw };
  for (const k of ['knee', 'hip', 'elbow', 'torsoLean']) if (raw[k] != null) m[k] = smooth.push(k, raw[k]);

  // Confidence gate: bad landmarks give garbage angles, so stay quiet rather than give wrong cues.
  if (raw.s.conf < 0.55) {
    if (++lostFrames === 45) say('Move back a little, I need to see your full body.', { id: 'not_visible', priority: 'high' });
    drawPose(ctx, px, { color: 'rgba(255,255,255,.4)' });
    return;
  }
  lostFrames = 0;
  if (ex.view !== 'either' && view !== ex.view) {
    if (++wrongView === 60) say(ex.view === 'side' ? 'Turn side-on to the camera for this one.' : 'Face the camera for this one.', { id: 'wrong_view', priority: 'high' });
  } else wrongView = 0;

  let flagged = false;
  for (const ev of engine.update(m, performance.now())) {
    $('#repNum').textContent = engine.reps;
    if (ev.faults.length) flagged = true;
    const line = ev.type === 'rep' ? fb.onRep(ev) : fb.onContinuousFault(ev.faults[0]);
    if (line) say(line.text, line);
  }
  const s = raw.s;
  drawPose(ctx, px, {
    color: flagged ? '#ff4d4d' : '#c6ff3d',
    labels: [{ at: s.kn, value: m.knee }, { at: s.hip, value: m.hip }, { at: s.el, value: m.elbow }],
  });
  $('#angleReadout').innerHTML = `knee ${fmt(m.knee)}<br>hip ${fmt(m.hip)}<br>elbow ${fmt(m.elbow)}<br><span class="muted">${engine.view} view</span>`;
}
const fmt = v => (v == null || Number.isNaN(v) ? '–' : Math.round(v) + '°');

function stopCamera() {
  running = false;
  if (recorder && recorder.state !== 'inactive') recorder.stop();
  stream?.getTracks().forEach(t => t.stop()); stream = null;
  const v = $('#video'); v.pause();
}

function endSet() {
  const wasRecording = recorder && recorder.state !== 'inactive';
  stopCamera();
  $('#stage').hidden = true; $('#summary').hidden = false;
  const ex = EXERCISES[exKey];
  const reps = engine?.reps || 0, good = engine?.goodReps || 0;
  const tally = engine?.faultTally || {};
  const rules = allRules(ex);
  const faults = Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ n, rule: rules.find(r => r.id === id) })).filter(f => f.rule);
  const tempo = engine?.tempo || [], vl = engine?.velocityLoss() || 0;
  const avg = k => tempo.length ? (tempo.reduce((a, t) => a + t[k], 0) / tempo.length).toFixed(1) : '–';
  const prev = [...S.sessions].reverse().find(x => x.ex === exKey);
  const score = reps ? Math.round(good / reps * 100) : 0;
  const prevScore = prev && prev.reps ? Math.round(prev.good / prev.reps * 100) : null;
  const rest = restSeconds(exKey, vl);
  $('#summaryBody').innerHTML = `
    <div class="stats"><div class="stat card"><span class="num">${reps}</span><span class="lbl">reps</span></div>
    <div class="stat card"><span class="num">${good}</span><span class="lbl">clean reps</span></div>
    <div class="stat card"><span class="num">${score}%</span><span class="lbl">form score${prevScore != null ? ` (last ${prevScore}%)` : ''}</span></div></div>
    <table class="metrics" style="margin-top:12px">
      <tr><td>Avg lowering time (eccentric)</td><td>${avg('ecc')} s</td></tr>
      <tr><td>Avg lifting time (concentric)</td><td>${avg('con')} s</td></tr>
      <tr class="${vl >= 0.3 ? 'bad' : ''}"><td>Rep speed loss</td><td>${Math.round(vl * 100)}%</td></tr>
      <tr><td>Estimated reps left in the tank</td><td>${tempo.length >= 3 ? estimateRIR(vl) : '–'}</td></tr>
    </table>
    ${faults.length ? `<h2 style="margin-top:14px">Focus for next set</h2><ul class="list">${faults.slice(0, 3).map(f => `<li><span><b>${f.rule.cue}</b><br><span class="muted">${f.rule.why}</span></span><span class="muted">×${f.n}</span></li>`).join('')}</ul>` : ''}
    ${reps ? `<div class="rest"><span>Rest</span><b id="restClock">${Math.floor(rest / 60)}:${String(rest % 60).padStart(2, '0')}</b><button class="btn small" id="restStart">Start rest timer</button></div>` : ''}`;
  if (reps) {
    S.sessions.push({ at: Date.now(), ex: exKey, name: ex.name, reps, good, faults: tally, vl, tempo }); persist();
    // Summary feedback after the set (KR) plus one focus point — and competence: compare to last time.
    const top = faults[0]?.rule.cue;
    const better = prevScore != null && score > prevScore ? ` Your form score is up from ${prevScore} to ${score} percent.` : '';
    say(`Set done. ${reps} reps, ${good} clean.${better} ${top ? 'One thing for next set: ' + top : 'Great form. Keep it up.'}`, { id: 'summary', priority: 'high' });
    $('#restStart').onclick = () => startRest(rest);
  } else {
    say('No reps counted that time. Check your camera angle and try again.', { id: 'summary0', priority: 'high' });
  }
  const pb = $('#playback'), dl = $('#downloadRec');
  pb.hidden = dl.hidden = true;
  if (wasRecording) setTimeout(() => {
    if (!chunks.length) return;
    const url = URL.createObjectURL(new Blob(chunks, { type: chunks[0].type || 'video/webm' }));
    pb.src = url; pb.hidden = false; dl.href = url; dl.hidden = false;
  }, 300);
}

$('#startCam').onclick = () => startSession();
$('#videoFile').onchange = e => { const f = e.target.files[0]; if (f) startSession(URL.createObjectURL(f)); e.target.value = ''; };
$('#endSet').onclick = endSet;
$('#flipCam').onclick = () => { facing = facing === 'user' ? 'environment' : 'user'; stopCamera(); startSession(); };
let restTimer;
function startRest(sec) {
  clearInterval(restTimer); let left = sec;
  restTimer = setInterval(() => {
    left--; const el = $('#restClock'); if (!el) return clearInterval(restTimer);
    el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    if (left === 10) say('Ten seconds. Get set up.', { id: 'rest10', priority: 'high' });
    if (left <= 0) { clearInterval(restTimer); say('Rest over. Let\'s go again.', { id: 'rest0', priority: 'high' }); }
  }, 1000);
}
// Self-controlled feedback: tap the coach mid-set to ask how that rep looked.
$('.coach-bubble').onclick = () => { if (fb) { const l = fb.onRequest(); say(l.text, l); } };
$('#again').onclick = () => { $('#summary').hidden = true; $('#picker').hidden = false; };

/* ---------- Body scan ---------- */
async function runScan(file) {
  if (!file) return;
  $('#scanStatus').textContent = 'Analysing your posture…';
  $('#scanResult').hidden = true;
  try {
    const { source, w, h, lms } = await landmarksFrom(file);
    if (!lms) { $('#scanStatus').textContent = 'Couldn\'t find a full body. Stand further back with good lighting.'; return; }
    const px = toPx(lms, w, h);
    const problem = stanceProblem(px, viewOf(px));
    if (problem) { $('#scanStatus').textContent = problem; say(problem, { id: 'stance', priority: 'high' }); return; }
    const r = analyse(px);
    render($('#scanCanvas'), source, w, h, px, r.labels, r.view);
    $('#scanTitle').textContent = `Posture & joint angles (${r.view === 'front' ? 'front' : 'side'} view)`;
    $('#scanMetrics').innerHTML = r.metrics.map(([k, v, bad]) => `<tr class="${bad ? 'bad' : ''}"><td>${k}</td><td>${v}</td></tr>`).join('');
    $('#scanFindings').innerHTML = r.findings.map(f => `<div class="finding ${f.good ? 'good' : ''}"><h3>${f.title}</h3><p>${f.why}</p>${f.fix.length ? `<ul>${f.fix.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}</div>`).join('')
      + `<p class="muted" style="font-size:.78rem">Screening only, not a medical diagnosis. Pain or injury? See a physio.</p>`;
    $('#scanResult').hidden = false; $('#scanStatus').textContent = '';
    S.scans.push({ at: Date.now(), view: r.view, findings: r.findings.map(f => f.title) }); persist();
    const issues = r.findings.filter(f => !f.good);
    say(issues.length ? `Scan done. I spotted ${issues.length} thing${issues.length > 1 ? 's' : ''} to work on. The main one: ${issues[0].title}. I've added the fixes below.` : 'Scan done. Your alignment looks good.', { id: 'scan_done', priority: 'high' });
  } catch (e) {
    console.error(e); $('#scanStatus').textContent = 'Something went wrong reading that file. Try a photo instead.';
  }
}
$('#scanFile').onchange = e => { runScan(e.target.files[0]); e.target.value = ''; };
$('#scanFile2').onchange = e => { runScan(e.target.files[0]); e.target.value = ''; };

$('#calcBf').onclick = () => {
  const p = S.profile;
  const v = id => parseFloat($(id).value);
  if (!p.heightCm) { $('#bfOut').innerHTML = '<p class="muted">Add your height in Coach → Profile settings first.</p>'; return; }
  const bf = navyBodyFat({ sex: p.sex, heightCm: p.heightCm, neckCm: v('#bNeck'), waistCm: v('#bWaist'), hipCm: v('#bHip') });
  if (Number.isNaN(bf)) { $('#bfOut').innerHTML = '<p class="muted">Check your measurements: neck, waist' + (p.sex === 'female' ? ', hips' : '') + '.</p>'; return; }
  const wt = v('#bWeight');
  const lean = wt ? wt * (1 - bf / 100) : null;
  const entry = { at: Date.now(), bf, weight: wt || null, lean, water: v('#bWater') || null, muscle: v('#bMuscle') || null, deviceBf: v('#bDeviceBf') || null };
  S.scans.push(entry); persist();
  $('#bfOut').innerHTML = `<div class="bf-big">${bf.toFixed(1)}%</div><p>${bfCategory(bf, p.sex)}${lean ? ` · Lean mass ≈ ${lean.toFixed(1)} kg · Fat mass ≈ ${(wt - lean).toFixed(1)} kg` : ''}</p>`;
  say(`Body fat is about ${Math.round(bf)} percent. That's in the ${bfCategory(bf, p.sex).toLowerCase()} range. We'll track it every two weeks.`, { id: 'bf_done', priority: 'high' });
};

/* ---------- Progress ---------- */
function renderProgress() {
  const pts = S.scans.filter(s => s.bf).map(s => ({ at: s.at, v: s.bf }));
  const c = $('#bfChart'); $('#bfEmpty').hidden = pts.length >= 2;
  c.hidden = pts.length < 2;
  if (pts.length >= 2) {
    const dpr = devicePixelRatio || 1, W = c.clientWidth || 600, H = 160;
    c.width = W * dpr; c.height = H * dpr; const ctx = c.getContext('2d'); ctx.scale(dpr, dpr);
    const min = Math.min(...pts.map(p => p.v)) - 1, max = Math.max(...pts.map(p => p.v)) + 1;
    const x = i => 20 + i * (W - 40) / (pts.length - 1), y = v => H - 20 - (v - min) / (max - min) * (H - 40);
    ctx.strokeStyle = '#c6ff3d'; ctx.lineWidth = 2.5; ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(x(i), y(p.v)) : ctx.moveTo(x(i), y(p.v))); ctx.stroke();
    ctx.fillStyle = '#f4f4f5'; ctx.font = '600 12px Inter, sans-serif';
    pts.forEach((p, i) => { ctx.beginPath(); ctx.arc(x(i), y(p.v), 4, 0, 7); ctx.fill(); ctx.fillText(p.v.toFixed(1) + '%', x(i) - 14, y(p.v) - 10); });
  }
  const tally = {};
  for (const s of S.sessions) for (const [id, n] of Object.entries(s.faults || {})) tally[id] = (tally[id] || 0) + n;
  const rules = Object.values(EXERCISES).flatMap(e => [...(e.bottom || []), ...(e.top || []), ...(e.always || [])]);
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (top.length) $('#faultList').innerHTML = top.map(([id, n]) => { const r = rules.find(x => x.id === id); return `<li><span><b>${r?.cue || id}</b><br><span class="muted">${r?.why || ''}</span></span><span class="muted">×${n}</span></li>`; }).join('');
  $('#allSessions').innerHTML = S.sessions.slice().reverse().map(s => `<li><span>${s.name}: ${s.reps} reps (${s.good} clean)</span><span class="muted">${new Date(s.at).toLocaleDateString()}</span></li>`).join('') || '<li class="muted">Nothing yet.</li>';
}

/* ---------- Boot ---------- */
mountAvatars(); bindSettings(); bindPlan(); renderChips(); renderHome();
$('#unlockBtn').onclick = () => {
  $('#unlock').classList.add('gone');
  say(`${greeting(S.profile.name)} ${nudgeLine()}`, { id: 'greet', priority: 'high' });
  getVideoLandmarker().catch(() => {}); // warm up the model in the background
};
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
