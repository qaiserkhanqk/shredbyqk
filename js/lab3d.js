// QK Athlete Biomechanics Lab: two cameras → 3D. Pure maths, unit tested on a synthetic athlete (tests/lab3d.test.mjs).
//
// Setup (the classic two-camera orthogonal method of sports biomechanics): camera A films the athlete side-on,
// camera B from the front (or back), about 90° apart, both at hip height, 3–5 m away, same frame rate.
//  - Camera A (side) gives forward/back depth (Z) and height (Y).
//  - Camera B (front/back) gives left/right (X) and height (Y).
// Each pose landmark seen by both cameras at the same moment becomes one 3D point (X, Y, Z) in metres.
// It needs no calibration object: the athlete's height sets the scale, and the shared vertical (Y) makes both
// cameras' scales agree. Assumptions: cameras roughly 90° apart and level, far enough that perspective is small.
// Accuracy is coaching/screening grade, not an accredited lab: see SCIENCE.md "3D Lab".
//
// Frames in: [{ t: seconds, lm: [{ x, y, v }] }] with x, y normalised 0–1 (MediaPipe), plus the video's w and h.

const L = { nose: 0, lEar: 7, rEar: 8, lSh: 11, rSh: 12, lEl: 13, rEl: 14, lWr: 15, rWr: 16, lHip: 23, rHip: 24, lKn: 25, rKn: 26, lAn: 27, rAn: 28, lHeel: 29, rHeel: 30, lFt: 31, rFt: 32 };
export { L as LANDMARK };
const median = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
const midY = (lm, a, b) => (lm[a].y + lm[b].y) / 2;

/* ---------- 1. Resample to a fixed rate (cameras rarely share exact frame times) ---------- */
export function resample(frames, hz = 60) {
  if (frames.length < 2) return frames.slice();
  const out = [], t0 = frames[0].t, t1 = frames[frames.length - 1].t;
  let j = 0;
  for (let t = t0; t <= t1 + 1e-9; t += 1 / hz) {
    while (j < frames.length - 2 && frames[j + 1].t < t) j++;
    const a = frames[j], b = frames[j + 1], k = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0;
    out.push({ t, lm: a.lm.map((p, i) => ({ x: p.x + (b.lm[i].x - p.x) * k, y: p.y + (b.lm[i].y - p.y) * k, v: Math.min(p.v ?? 1, b.lm[i].v ?? 1) })) });
  }
  return out;
}

/* ---------- 2. Sync: line the two videos up ---------- */
/** The loudest moment (a clap) in an audio channel. Returns seconds, or null when nothing stands out. */
export function clapTime(samples, rate, { maxSec = 12 } = {}) {
  const n = Math.min(samples.length, Math.floor(maxSec * rate)), win = Math.max(1, Math.floor(rate / 100));
  const env = [];
  for (let i = 0; i + win <= n; i += win) { let e = 0; for (let k = i; k < i + win; k++) e += samples[k] * samples[k]; env.push(e / win); }
  if (env.length < 10) return null;
  let best = 0; for (let i = 1; i < env.length; i++) if (env[i] > env[best]) best = i;
  const med = median(env) || 1e-12;
  return env[best] > med * 30 ? (best * win) / rate : null;
}
/**
 * Motion sync: the hips rise and fall identically in both views, so slide one video's hip-height signal
 * over the other's and keep the best match. Returns { lag (seconds to add to B's times), r (match 0–1) }.
 */
export function motionLag(a, b, { hz = 60, maxLag = 4 } = {}) {
  const sig = f => { const ys = f.map(x => midY(x.lm, L.lHip, L.rHip)), m = ys.reduce((p, q) => p + q, 0) / ys.length; return ys.map(y => y - m); };
  const A = sig(a), B = sig(b), max = Math.round(maxLag * hz), start = a[0].t - b[0].t, all = [];
  for (let s = -max; s <= max; s++) {
    let sab = 0, saa = 0, sbb = 0, n = 0;
    for (let i = 0; i < A.length; i++) { const j = i - s; if (j < 0 || j >= B.length) continue; sab += A[i] * B[j]; saa += A[i] * A[i]; sbb += B[j] * B[j]; n++; }
    if (n < hz) continue; // need at least a second of overlap
    all.push({ lag: start + s / hz, r: sab / Math.sqrt(saa * sbb || 1) });
  }
  if (!all.length) return { lag: 0, r: 0 };
  // Repeated reps look alike, so several offsets (one rep apart) can match almost equally. The cameras were started
  // within seconds of each other, so among near-equal matches take the smallest offset. A clap beats all of this.
  const top = Math.max(...all.map(x => x.r));
  const peaks = all.filter((x, i) => x.r >= (all[i - 1]?.r ?? -2) && x.r >= (all[i + 1]?.r ?? -2));
  return peaks.filter(x => x.r >= top - 0.02).sort((x, y) => Math.abs(x.lag) - Math.abs(y.lag))[0];
}

/* ---------- 3. Reconstruct 3D ---------- */
/** Which way the athlete faces in the side view: +1 if forward is image-right. */
export function facingSign(frames) {
  const d = median(frames.map(f => f.lm[L.nose].x - (f.lm[L.lEar].x + f.lm[L.rEar].x) / 2));
  return d >= 0 ? 1 : -1;
}
/** Metres per normalised unit, from the athlete's height (nose-to-ankle ≈ 88% of stature, standing frames). */
function scaleFor(frames, heightM, aspect) {
  const tall = frames.map(f => Math.abs(midY(f.lm, L.lAn, L.rAn) - f.lm[L.nose].y)).sort((x, y) => y - x);
  const standing = median(tall.slice(0, Math.max(1, Math.floor(tall.length * 0.2)))); // the tallest 20%: upright
  return (heightM * 0.88) / (standing || 1) * aspect;
}

/**
 * side, front: frame lists; opts: { heightM, sideW, sideH, frontW, frontH, back (camera B behind the athlete),
 * lag (seconds, from motionLag/clap), hz }. Returns { frames: [{ t, P: [{x,y,z,v}] }], info }.
 * Axes: X = athlete's left, Y = up, Z = forward. Origin: between the ankles on the floor, first frame.
 */
export function reconstruct(side, front, { heightM = 1.75, sideW = 1, sideH = 1, frontW = 1, frontH = 1, back = false, lag = 0, hz = 60 } = {}) {
  return reconstructMulti([{ pos: 'side', frames: side, w: sideW, h: sideH, lag: 0 }, { pos: back ? 'back' : 'front', frames: front, w: frontW, h: frontH, lag }], { heightM, hz });
}

/**
 * 2–4 cameras. views: [{ pos: 'sideL' | 'sideR' | 'side' | 'front' | 'back', frames, w, h, lag }], lag = seconds to
 * add to that camera's times to match the first camera. Needs at least one side camera (depth) and one front or back
 * camera (left/right). With more cameras every point is a weighted average: each camera's visibility for it, and a
 * side camera counts the limbs on its own side fully and the far-side (partly hidden) limbs at a third. So with a
 * camera on each side, both legs are measured by the camera that can actually see them.
 */
const LEFT = i => i >= 11 && i % 2 === 1, RIGHT = i => i >= 12 && i % 2 === 0;
export function reconstructMulti(views, { heightM = 1.75, hz = 60 } = {}) {
  const sides = views.filter(v => /^side/.test(v.pos)), fronts = views.filter(v => v.pos === 'front' || v.pos === 'back');
  if (!sides.length || !fronts.length) throw new Error('Needs at least one side-on camera and one front or back camera.');
  const R = views.map(v => ({ ...v, F: resample(v.frames.map(f => ({ ...f, t: f.t + (v.lag || 0) })), hz) }));
  const t0 = Math.max(...R.map(v => v.F[0].t)), t1 = Math.min(...R.map(v => v.F[v.F.length - 1].t));
  if (!(t1 - t0 > 0.5)) throw new Error('The videos overlap by less than half a second. Record them at the same time and clap at the start.');
  const pick = (F, t) => F[Math.min(F.length - 1, Math.max(0, Math.round((t - F[0].t) * hz)))];
  const ext = lm => Math.abs(midY(lm, L.lAn, L.rAn) - lm[L.nose].y);
  const ref = R.find(v => /^side/.test(v.pos)), sRef = scaleFor(ref.F, heightM, 1);
  for (const v of R) {
    v.aspect = (v.w || 1) / (v.h || 1);
    const ratios = [];
    for (let t = t0; t <= t1; t += 1 / hz) ratios.push(ext(pick(ref.F, t).lm) / (ext(pick(v.F, t).lm) || 1));
    v.s = v === ref ? sRef : sRef * median(ratios);
    v.sign = /^side/.test(v.pos) ? facingSign(v.F) : v.pos === 'back' ? -1 : 1; // front: athlete's left is image-right
    const l0 = pick(v.F, t0).lm; v.h0 = (l0[L.lAn].x + l0[L.rAn].x) / 2; v.y0 = midY(l0, L.lAn, L.rAn);
    v.near = v.pos === 'sideL' ? LEFT : v.pos === 'sideR' ? RIGHT : null;
  }
  const out = [];
  for (let t = t0; t <= t1 + 1e-9; t += 1 / hz) {
    const now = R.map(v => ({ v, lm: pick(v.F, t).lm }));
    const P = now[0].lm.map((_, i) => {
      let x = 0, wx = 0, z = 0, wz = 0, y = 0, wy = 0, vis = 1;
      for (const { v, lm } of now) {
        const p = lm[i], vi = p.v ?? 1, h = v.sign * (p.x - v.h0) * v.aspect * v.s, yy = (v.y0 - p.y) * v.s;
        const w = vi * (v.near && (LEFT(i) || RIGHT(i)) && !v.near(i) ? 0.35 : 1);
        if (/^side/.test(v.pos)) { z += h * w; wz += w; } else { x += h * w; wx += w; }
        y += yy * w; wy += w; vis = Math.min(vis, vi);
      }
      return { x: wx ? x / wx : 0, y: wy ? y / wy : 0, z: wz ? z / wz : 0, v: vis };
    });
    out.push({ t: t - t0, P });
  }
  return { frames: out, info: { hz, duration: t1 - t0, cameras: views.map(v => v.pos), scale: Object.fromEntries(R.map(v => [v.pos, v.s])) } };
}

/** Line every camera up with the first: clap times when all have one, else the movement. Returns lags (seconds). */
export function syncAll(views, { claps = null, hz = 60 } = {}) {
  if (claps && claps.every(c => c != null)) return { how: 'clap', lags: claps.map(c => claps[0] - c), r: 1 };
  const ref = resample(views[0].frames, hz), out = [0]; let worst = 1;
  for (const v of views.slice(1)) { const m = motionLag(ref, resample(v.frames, hz), { hz }); out.push(m.lag); worst = Math.min(worst, m.r); }
  return { how: 'motion', lags: out, r: worst };
}

/* ---------- 4. 3D measurements ---------- */
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = a => Math.hypot(a.x, a.y, a.z);
const mid3 = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });
const deg = r => (r * 180) / Math.PI;
/** Angle at b between a and c, degrees (180 = straight). */
export const angle3 = (a, b, c) => { const u = sub(a, b), w = sub(c, b), m = len(u) * len(w); return m ? deg(Math.acos(Math.max(-1, Math.min(1, dot(u, w) / m)))) : NaN; };
/** Heading of a left→right line about the vertical axis (degrees): 0 = square to the front camera. */
const heading = (l, r) => deg(Math.atan2(r.z - l.z, r.x - l.x));

/** Every measurement for one frame. Flexion: 0 = straight. */
export function measure(P) {
  const hip = mid3(P[L.lHip], P[L.rHip]), sh = mid3(P[L.lSh], P[L.rSh]), trunk = sub(sh, hip);
  const pelvis = heading(P[L.rHip], P[L.lHip]), shoulders = heading(P[L.rSh], P[L.lSh]);
  let sep = shoulders - pelvis; if (sep > 180) sep -= 360; if (sep < -180) sep += 360;
  // Frontal-plane knee angle (valgus +): thigh vs shin seen from the front (X–Y plane).
  // side: +1 left leg (its midline is towards smaller X), −1 right leg. Positive = knee inside the hip–ankle line.
  const fpa = (h, k, a, side) => {
    const u = { x: h.x - k.x, y: h.y - k.y }, w = { x: a.x - k.x, y: a.y - k.y }, m = Math.hypot(u.x, u.y) * Math.hypot(w.x, w.y);
    if (!m) return NaN;
    const bend = 180 - deg(Math.acos(Math.max(-1, Math.min(1, (u.x * w.x + u.y * w.y) / m))));
    const lineX = h.x + (a.x - h.x) * ((k.y - h.y) / ((a.y - h.y) || 1e-9)), inside = (lineX - k.x) * side;
    return inside >= 0 ? bend : -bend;
  };
  return {
    kneeL: 180 - angle3(P[L.lHip], P[L.lKn], P[L.lAn]), kneeR: 180 - angle3(P[L.rHip], P[L.rKn], P[L.rAn]),
    hipL: 180 - angle3(sh, P[L.lHip], P[L.lKn]), hipR: 180 - angle3(sh, P[L.rHip], P[L.rKn]),
    elbowL: 180 - angle3(P[L.lSh], P[L.lEl], P[L.lWr]), elbowR: 180 - angle3(P[L.rSh], P[L.rEl], P[L.rWr]),
    trunkLean: deg(Math.atan2(trunk.z, trunk.y)), // forward +
    sideBend: deg(Math.atan2(trunk.x, trunk.y)),  // towards the left +
    pelvisRot: pelvis, shoulderRot: shoulders, separation: sep,
    valgusL: fpa(P[L.lHip], P[L.lKn], P[L.lAn], 1), valgusR: fpa(P[L.rHip], P[L.rKn], P[L.rAn], -1),
    hipHeight: hip.y,
  };
}
export const METRICS = {
  kneeL: 'Knee bend, left', kneeR: 'Knee bend, right', hipL: 'Hip bend, left', hipR: 'Hip bend, right',
  elbowL: 'Elbow bend, left', elbowR: 'Elbow bend, right', trunkLean: 'Trunk lean (forward +)', sideBend: 'Trunk side-bend (left +)',
  pelvisRot: 'Pelvis rotation', shoulderRot: 'Shoulder rotation', separation: 'Hip–shoulder separation',
  valgusL: 'Knee alignment, left (in +)', valgusR: 'Knee alignment, right (in +)',
};

/* ---------- 5. Reports by movement ---------- */
export const PRESETS = {
  squat: { name: 'Squat / landing', key: 'deepest', keys: ['kneeL', 'kneeR', 'hipL', 'hipR', 'trunkLean', 'valgusL', 'valgusR', 'sideBend'] },
  bowling: { name: 'Cricket: fast bowling', key: 'release', keys: ['elbowL', 'elbowR', 'kneeL', 'kneeR', 'sideBend', 'trunkLean', 'separation', 'shoulderRot'] },
  sprint: { name: 'Sprint / acceleration', key: 'none', keys: ['kneeL', 'kneeR', 'hipL', 'hipR', 'trunkLean', 'separation'] },
  kick: { name: 'Football: kicking', key: 'none', keys: ['kneeL', 'kneeR', 'hipL', 'hipR', 'separation', 'trunkLean', 'sideBend'] },
  other: { name: 'Any movement', key: 'none', keys: ['kneeL', 'kneeR', 'hipL', 'hipR', 'elbowL', 'elbowR', 'trunkLean', 'sideBend', 'separation'] },
};

/**
 * The report: per measurement min / max / range, the value at the key moment (deepest point for squats and
 * landings; ball release for bowling), left–right differences, and plain-language flags.
 * bowlArm: 'R' | 'L' for bowling. Returns { preset, key: { t, label }, rows, asym, flags, series }.
 */
export function report(rec, { preset = 'squat', bowlArm = 'R' } = {}) {
  const pr = PRESETS[preset] || PRESETS.other, F = rec.frames, M = F.map(f => measure(f.P));
  let ki = null, label = null;
  if (pr.key === 'deepest') { ki = M.reduce((b, m, i) => (m.hipHeight < M[b].hipHeight ? i : b), 0); label = 'Deepest point'; }
  if (pr.key === 'release') { const w = bowlArm === 'L' ? L.lWr : L.rWr; ki = F.reduce((b, f, i) => (f.P[w].y > F[b].P[w].y ? i : b), 0); label = 'Ball release (bowling hand highest)'; }
  const rows = pr.keys.map(k => {
    const v = M.map(m => m[k]).filter(Number.isFinite);
    return { key: k, name: METRICS[k], min: Math.min(...v), max: Math.max(...v), range: Math.max(...v) - Math.min(...v), at: ki == null ? null : M[ki][k] };
  });
  const asym = [['kneeL', 'kneeR', 'Knee bend'], ['hipL', 'hipR', 'Hip bend'], ['valgusL', 'valgusR', 'Knee alignment']]
    .filter(([a]) => pr.keys.includes(a)).map(([a, b, name]) => {
      const A = Math.max(...M.map(m => m[a])), B = Math.max(...M.map(m => m[b]));
      return { name, left: A, right: B, diff: Math.abs(A - B), pct: Math.round(Math.abs(A - B) / Math.max(1, Math.max(A, B)) * 100) };
    });
  const flags = [];
  for (const s of asym) if (s.diff >= 10 && s.pct >= 10) flags.push(`${s.name}: ${Math.round(s.diff)}° difference between left and right. Worth checking strength and mobility on the ${s.left < s.right ? 'left' : 'right'}.`);
  if (pr.key === 'deepest') {
    const v = Math.max(M[ki].valgusL, M[ki].valgusR);
    if (v >= 10) flags.push(`Knees moving in about ${Math.round(v)}° at the bottom. Screening flag: knee valgus on landing is a known ACL risk pattern (Hewett 2005). Re-test and coach knees over toes.`);
  }
  if (preset === 'bowling') {
    const e = bowlArm === 'L' ? 'elbowL' : 'elbowR', hz = rec.info.hz, from = Math.max(0, ki - Math.round(0.15 * hz));
    const before = Math.max(...M.slice(from, ki + 1).map(m => m[e])), ext = before - M[ki][e];
    flags.push(`Bowling elbow: straightened about ${Math.round(ext)}° in the last 0.15 s before release (bent ${Math.round(before)}° → ${Math.round(M[ki][e])}°). ${ext > 15 ? 'Above the 15° the ICC allows: get an accredited lab test before any decision.' : 'Within the 15° the ICC allows.'} Screening only: official tests use accredited labs.`);
    const sideBendAtRelease = Math.abs(M[ki].sideBend);
    if (sideBendAtRelease > 45) flags.push(`Trunk side-bend at release about ${Math.round(sideBendAtRelease)}°. Injured young fast bowlers averaged about 50° vs 40° in uninjured ones (Bayne 2016): monitor back load.`);
    const sepRange = Math.max(...M.map(m => m.shoulderRot)) - Math.min(...M.map(m => m.shoulderRot));
    flags.push(`Shoulder line turned through about ${Math.round(sepRange)}° during the delivery. Large counter-rotation (a mixed action) is linked to lumbar stress injury (Elliott 2000).`);
  }
  return { preset: pr.name, key: ki == null ? null : { i: ki, t: F[ki].t, label }, rows, asym, flags, series: M };
}

/** CSV of every frame's 3D points and measurements (for physios, spreadsheets or other software). */
export function toCSV(rec, rep) {
  const names = Object.keys(L), head = ['t', ...names.flatMap(n => [`${n}_x`, `${n}_y`, `${n}_z`]), ...Object.keys(METRICS)];
  const lines = [head.join(',')];
  rec.frames.forEach((f, i) => lines.push([f.t.toFixed(3), ...names.flatMap(n => { const p = f.P[L[n]]; return [p.x, p.y, p.z].map(v => v.toFixed(4)); }), ...Object.keys(METRICS).map(k => (rep.series[i][k] ?? 0).toFixed(1))].join(',')));
  return lines.join('\n');
}

/** Small summary kept in the athlete's history (no video, no frames). */
export const summary = (rep, meta) => ({ at: Date.now(), ...meta, preset: rep.preset, key: rep.key?.label || null, rows: rep.rows.map(r => ({ k: r.key, min: Math.round(r.min), max: Math.round(r.max), at: r.at == null ? null : Math.round(r.at) })), flags: rep.flags });
