// QK Athlete Biomechanics Lab screen: two videos of the same movement → a 3D skeleton, measurements and a report.
// Everything runs on this device: videos are read here and never uploaded. Maths: lab3d.js.
import { getVideoLandmarker } from './pose.js';
import { SKELETON } from './angles.js';
import * as lab from './lab3d.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let ctx; // { S, persist, toast, say }
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
  window.__qkLab = { analyse: (side, front, opts) => show(side, front, opts) }; // test hook: landmark frames straight in
}

export function renderLab() {
  if (!ctx) return;
  const p = ctx.S.profile || {};
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

async function run() {
  const fa = $('#labSide').files[0], fb = $('#labFront').files[0];
  if (!fa || !fb) return ctx.toast('Add both videos: one side-on, one from the front or back.');
  $('#labGo').disabled = true; status('Loading the precise pose model…');
  const lm = await getVideoLandmarker($('#labFast').checked ? 'full' : 'heavy');
  const A = await framesOf(fa, lm, 'Side video'), B = await framesOf(fb, lm, $('#labBack').checked ? 'Back video' : 'Front video');
  status('Lining the two videos up…');
  const [ca, cb] = await Promise.all([clapOf(fa), clapOf(fb)]);
  show(A, B, { clap: ca != null && cb != null ? ca - cb : null });
  $('#labGo').disabled = false;
}

/** Sync, reconstruct, report and draw. side/front: { frames, w, h }. */
function show(A, B, { clap = null } = {}) {
  const S = ctx.S, preset = $('#labPreset').value, heightM = (parseFloat($('#labHeight').value) || S.profile?.heightCm || 175) / 100;
  let lag, how;
  if (clap != null) { lag = clap; how = `Synced by the clap (${lag >= 0 ? '+' : ''}${lag.toFixed(2)} s)`; }
  else { const m = lab.motionLag(lab.resample(A.frames, 60), lab.resample(B.frames, 60)); lag = m.lag; how = `Synced by the movement (${lag >= 0 ? '+' : ''}${lag.toFixed(2)} s, match ${Math.round(m.r * 100)}%)${m.r < 0.8 ? '. Weak match: clap at the start next time.' : ''}`; }
  const rec = lab.reconstruct(A.frames, B.frames, { heightM, sideW: A.w, sideH: A.h, frontW: B.w, frontH: B.h, back: $('#labBack').checked, lag });
  const rep = lab.report(rec, { preset, bowlArm: $('#labArm').value });
  const meta = { athlete: $('#labName').value.trim() || 'Athlete', preset, heightCm: Math.round(heightM * 100) };
  cur = { rec, rep, meta };
  (S.lab ||= []).push(lab.summary(rep, meta)); if (S.lab.length > 60) S.lab.splice(0, S.lab.length - 60); ctx.persist();
  status(''); $('#labResult').hidden = false; $('#labSync').textContent = `${how} · ${rec.info.duration.toFixed(1)} s analysed in 3D at ${rec.info.hz} frames a second.`;
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
