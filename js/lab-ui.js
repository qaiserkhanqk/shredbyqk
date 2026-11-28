// QK Athlete Biomechanics Lab screen: two videos of the same movement → a 3D skeleton, measurements and a report.
// Everything runs on this device: videos are read here and never uploaded. Maths: lab3d.js.
import { getVideoLandmarker } from './pose.js';
import { SKELETON } from './angles.js';
import * as lab from './lab3d.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let ctx; // { S, persist, toast, say, cloud: () => Cloud|null }
let squad = []; // coach's athletes, when signed in as a coach
let cur = null; // { rec, rep, meta }
let view = { yaw: -35, i: 0, playing: false, raf: 0 };

export function initLab(c) {
  ctx = c;
  $('#labPreset').innerHTML = Object.entries(lab.PRESETS).map(([k, p]) => `<option value="${k}">${esc(p.name)}</option>`).join('');
  $('#labPreset').onchange = () => { $('#labArmWrap').hidden = $('#labPreset').value !== 'bowling'; };
  $('#labGo').onclick = () => run().catch(e => { console.error(e); status(`Couldn't analyse: ${e.message}`); $('#labGo').disabled = false; });
  $('#labPlay').onclick = () => { view.playing = !view.playing; $('#labPlay').textContent = view.playing ? 'Pause' : 'Play'; if (view.playing) loop(); };
  $('#labScrub').oninput = e => { view.i = +e.target.value; view.playing = false; $('#labPlay').textContent = 'Play'; draw(); };
  $('#labCsv').onclick = () => { if (!cur) return; download(`${slug(cur.meta.athlete)}-${cur.meta.preset}-3d.csv`, lab.toCSV(cur.rec, cur.rep), 'text/csv'); };
  $('#labPrint').onclick = () => window.print();
  const cv = $('#labCanvas'); let drag = null;
  cv.onpointerdown = e => { drag = e.clientX; cv.setPointerCapture(e.pointerId); };
  cv.onpointermove = e => { if (drag == null) return; view.yaw += (e.clientX - drag) * 0.5; drag = e.clientX; draw(); };
  cv.onpointerup = () => { drag = null; };
  window.__qkLab = { analyse: (views, opts) => show(views, opts) }; // test hook: landmark frames straight in
  $('#labSquad').onchange = () => { const a = squad.find(x => x.id === $('#labSquad').value); if (a) { $('#labName').value = a.name; if (a.height_cm) $('#labHeight').value = a.height_cm; } };
}

export async function renderLab() {
  if (!ctx) return;
  const p = ctx.S.profile || {};
  // Signed in as a coach: pick the squad athlete; results are saved to them for the squad dashboard.
  const cloud = ctx.cloud?.();
  if (cloud?.signedIn) {
    try {
      const me = await cloud.me();
      if (me?.role === 'coach') { squad = await cloud.athletes(); $('#labSquad').innerHTML = '<option value="">Not in the squad (just this phone)</option>' + squad.map(a => `<option value="${esc(a.id)}">${esc(a.name)}${a.team ? ' · ' + esc(a.team) : ''}</option>`).join(''); $('#labSquadWrap').hidden = false; }
    } catch {}
  }
  if (!$('#labName').value) $('#labName').value = p.name || '';
  if (!$('#labHeight').value && p.heightCm) $('#labHeight').value = p.heightCm;
  drawHistory();
}

const status = t => { $('#labStatus').textContent = t; $('#labStatus').hidden = !t; };
const slug = s => String(s || 'athlete').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); }

/** Read a video file frame by frame with the pose model. */
async function framesOf(file, lm, label, { hz = 30, maxSec = 20 } = {}) {
  const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.src = URL.createObjectURL(file);
  await new Promise((ok, bad) => { v.onloadeddata = ok; v.onerror = () => bad(new Error(`${label}: this video format can't be read here. Try MP4.`)); });
  const dur = Math.min(v.duration || 0, maxSec), out = [];
  for (let t = 0; t < dur; t += 1 / hz) {
    v.currentTime = t; await new Promise(ok => { v.onseeked = ok; });
    const r = lm.detectForVideo(v, performance.now());
    if (r?.landmarks?.[0]) out.push({ t, lm: r.landmarks[0].map(p => ({ x: p.x, y: p.y, v: p.visibility ?? 1 })) });
    if (out.length % 10 === 0) status(`${label}: ${Math.round(t / dur * 100)}%`);
  }
  URL.revokeObjectURL(v.src);
  if (out.length < hz) throw new Error(`${label}: no athlete found. The whole body should be in view the whole time.`);
  return { frames: out, w: v.videoWidth, h: v.videoHeight };
}
async function clapOf(file) {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const buf = await ac.decodeAudioData(await file.arrayBuffer()); ac.close?.();
    return lab.clapTime(buf.getChannelData(0), buf.sampleRate);
  } catch { return null; }
}

const NAMES = { sideR: 'Right-side video', sideL: 'Left-side video', front: 'Front video', back: 'Back video' };
async function run() {
  const slots = [...document.querySelectorAll('.lab-cams input[type=file]')].filter(i => i.files[0]).map(i => ({ pos: i.dataset.pos, file: i.files[0] }));
  if (!slots.some(s => /^side/.test(s.pos)) || !slots.some(s => s.pos === 'front' || s.pos === 'back')) return ctx.toast('Add at least one side-on video and one front or back video.');
  // Side camera first: it sets the scale and the clock the others are lined up to.
  slots.sort((a, b) => (/^side/.test(b.pos) ? 1 : 0) - (/^side/.test(a.pos) ? 1 : 0));
  $('#labGo').disabled = true; status('Loading the precise pose model…');
  const lm = await getVideoLandmarker($('#labFast').checked ? 'full' : 'heavy');
  const views = [];
  for (const s of slots) views.push({ pos: s.pos, ...(await framesOf(s.file, lm, NAMES[s.pos])) });
  status(`Lining the ${views.length} videos up…`);
  const claps = await Promise.all(slots.map(s => clapOf(s.file)));
  await show(views, { claps });
  $('#labGo').disabled = false;
}

/** Sync, reconstruct, report and draw. views: [{ pos, frames, w, h }] (first = side camera). */
async function show(views, { claps = null } = {}) {
  const S = ctx.S, preset = $('#labPreset').value, heightM = (parseFloat($('#labHeight').value) || S.profile?.heightCm || 175) / 100;
  const sy = lab.syncAll(views, { claps: claps && claps.every(c => c != null) ? claps : null });
  const lagTxt = sy.lags.slice(1).map((l, i) => `${NAMES[views[i + 1].pos].replace(' video', '')} ${l >= 0 ? '+' : ''}${l.toFixed(2)} s`).join(', ');
  const how = sy.how === 'clap' ? `Synced by the clap (${lagTxt})` : `Synced by the movement (${lagTxt}; match ${Math.round(sy.r * 100)}%)${sy.r < 0.8 ? '. Weak match: clap at the start next time.' : ''}`;
  const rec = lab.reconstructMulti(views.map((v, i) => ({ ...v, lag: sy.lags[i] })), { heightM });
  const rep = lab.report(rec, { preset, bowlArm: $('#labArm').value });
  const athleteId = $('#labSquad').value || null;
  const meta = { athlete: $('#labName').value.trim() || 'Athlete', preset, heightCm: Math.round(heightM * 100), cameras: views.length, athleteId };
  cur = { rec, rep, meta };
  const sum = lab.summary(rep, meta);
  (S.lab ||= []).push(sum); if (S.lab.length > 60) S.lab.splice(0, S.lab.length - 60); ctx.persist();
  let saved = '';
  if (athleteId) { try { await ctx.cloud().saveLabTest(athleteId, sum); saved = ' Saved to the squad dashboard.'; } catch (e) { saved = ` Not saved to the squad (${e.message}); kept on this phone.`; } }
  status(''); $('#labResult').hidden = false; $('#labSync').textContent = `${views.length} cameras. ${how} · ${rec.info.duration.toFixed(1)} s analysed in 3D at ${rec.info.hz} frames a second.${saved}`;
  const f = v => (v == null || !Number.isFinite(v) ? '–' : `${Math.round(v)}°`);
  $('#labTable').innerHTML = `<div class="lab-row head"><span>Measurement</span><span>Min</span><span>Max</span><span>${esc(rep.key?.label || 'Range')}</span></div>` +
    rep.rows.map(r => `<div class="lab-row"><span>${esc(r.name)}</span><span>${f(r.min)}</span><span>${f(r.max)}</span><span><b>${rep.key ? f(r.at) : f(r.range)}</b></span></div>`).join('');
  $('#labFlags').innerHTML = rep.flags.length ? rep.flags.map(x => `<p class="fa-note low" style="margin:0">${esc(x)}</p>`).join('') : '<p class="fa-note great" style="margin:0">Nothing stands out. Left and right match within 10°.</p>';
  $('#labTitle').textContent = `${meta.athlete} · ${rep.preset}`;
  $('#labScrub').max = rec.frames.length - 1; view.i = rep.key?.i ?? 0; $('#labScrub').value = view.i; draw(); drawHistory();
  ctx.say?.(`3D analysis ready for ${meta.athlete}. ${rep.flags.length ? `${rep.flags.length} thing${rep.flags.length > 1 ? 's' : ''} to look at.` : 'Nothing stands out.'}`, { priority: 'high' });
  $('#labResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
  return rep;
}

/* ---------- 3D viewer: drag to turn, play or scrub through the movement ---------- */
function draw() {
  if (!cur) return;
  const cv = $('#labCanvas'), g = cv.getContext('2d'), W = cv.width = cv.clientWidth * devicePixelRatio, H = cv.height = cv.clientHeight * devicePixelRatio;
  const fr = cur.rec.frames[view.i], P = fr.P, y = (view.yaw * Math.PI) / 180, pitch = 0.18;
  const pr = p => { const x = p.x * Math.cos(y) + p.z * Math.sin(y), z = -p.x * Math.sin(y) + p.z * Math.cos(y); return { u: W / 2 + x * H * 0.42, v: H * 0.92 - (p.y * Math.cos(pitch) + z * Math.sin(pitch)) * H * 0.42, d: z }; };
  g.clearRect(0, 0, W, H);
  g.strokeStyle = getComputedStyle(document.body).getPropertyValue('--line') || '#ccc'; g.lineWidth = 1;
  for (let k = -1; k <= 1; k += 0.5) { const a = pr({ x: k, y: 0, z: -1 }), b = pr({ x: k, y: 0, z: 1 }), c = pr({ x: -1, y: 0, z: k }), d = pr({ x: 1, y: 0, z: k }); g.beginPath(); g.moveTo(a.u, a.v); g.lineTo(b.u, b.v); g.moveTo(c.u, c.v); g.lineTo(d.u, d.v); g.stroke(); }
  g.lineCap = 'round'; g.lineWidth = Math.max(3, W / 160);
  const Q = P.map(pr);
  for (const [a, b] of SKELETON) { const left = [11, 13, 15, 23, 25, 27, 29, 31].includes(a); g.strokeStyle = left ? '#2F7568' : '#D99A5B'; g.beginPath(); g.moveTo(Q[a].u, Q[a].v); g.lineTo(Q[b].u, Q[b].v); g.stroke(); }
  g.fillStyle = '#12201B'; for (let i = 11; i < 33; i++) { g.beginPath(); g.arc(Q[i].u, Q[i].v, g.lineWidth * 0.8, 0, 7); g.fill(); }
  const m = cur.rep.series[view.i];
  $('#labNow').textContent = `${fr.t.toFixed(2)} s · knees ${Math.round(m.kneeL)}° / ${Math.round(m.kneeR)}° · trunk ${Math.round(m.trunkLean)}° · separation ${Math.round(m.separation)}°`;
}
function loop() { if (!view.playing || !cur) return; view.i = (view.i + 1) % cur.rec.frames.length; $('#labScrub').value = view.i; draw(); view.raf = setTimeout(() => requestAnimationFrame(loop), 1000 / 30); }

function drawHistory() {
  const H = (ctx.S.lab || []).slice().reverse();
  $('#labHistory').hidden = !H.length;
  $('#labHistory').innerHTML = `<span class="eyebrow">Earlier tests</span>` + H.slice(0, 12).map(h => `<div class="lab-row"><span><b>${esc(h.athlete)}</b> · ${esc(h.preset)}</span><span class="muted small">${new Date(h.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span><span class="muted small">${h.flags.length} flag${h.flags.length === 1 ? '' : 's'}</span></div>`).join('');
}
