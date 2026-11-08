// Single-leg squat knee test (front view).
//
// Measures the frontal plane projection angle (FPPA): the 2D angle between the thigh (hip→knee) and
// the shin (knee→ankle) seen from the front. 0° = hip, knee and ankle in a straight line.
// Positive = knee moves toward the midline (dynamic knee valgus). This single-camera measure is
// widely used in clinics and research as a screen for patellofemoral pain and ACL injury risk
// (Willson & Davis 2008; Munro et al. 2012). Typical healthy values are small (single digits);
// thresholds here are screening values to discuss with a physio, not a diagnosis.
import { measuredFps } from './measure.js';

export const SIDE = { L: { hip: 23, knee: 25, ankle: 27 }, R: { hip: 24, knee: 26, ankle: 28 } };

/** Signed FPPA in degrees for one leg in one frame. + = knee toward the body's midline (valgus). */
export function fppa(px, side) {
  const s = SIDE[side], hip = px[s.hip], knee = px[s.knee], ankle = px[s.ankle];
  const ux = knee.x - hip.x, uy = knee.y - hip.y, vx = ankle.x - knee.x, vy = ankle.y - knee.y;
  const ang = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy) * 180 / Math.PI; // signed turn from thigh to shin
  const midX = (px[23].x + px[24].x) / 2;
  // If the knee sits on the midline side of the hip→ankle line, the deviation is valgus (+).
  const t = (knee.y - hip.y) / ((ankle.y - hip.y) || 1), lineX = hip.x + t * (ankle.x - hip.x);
  const towardMid = Math.sign(midX - lineX) === Math.sign(knee.x - lineX) ? 1 : -1;
  return towardMid * Math.abs(ang);
}

/**
 * Analyse a single-leg squat recording (either or both legs, several reps).
 * @param frames [{t, px}]
 * @returns { ok, legs: {L?: {reps, maxFppa, meanFppa, pelvicDrop}, R?: ...}, asymmetry, findings[], issues[] }
 */
export function analyseSingleLegSquat(frames, { valgusFlagDeg = 10, asymFlagDeg = 5 } = {}) {
  const issues = [];
  if (frames.length < 30) return { ok: false, legs: {}, findings: [], issues: ['Recording is too short. Do 3–5 single-leg squats on each leg.'] };
  const fps = measuredFps(frames.map(f => f.t));
  // Stance leg per frame: the other foot is lifted clearly off the floor.
  const shin = med(frames.map(f => Math.abs(f.px[27].y - f.px[25].y) + Math.abs(f.px[28].y - f.px[26].y)) ) / 2;
  const legOf = f => { const d = f.px[27].y - f.px[28].y; return d > shin * 0.15 ? 'L' : d < -shin * 0.15 ? 'R' : null; };
  const legs = {};
  for (const side of ['L', 'R']) {
    const seq = frames.map((f, i) => ({ i, f, on: legOf(f) === side })).filter(x => x.on);
    if (seq.length < 15) continue;
    // Reps = hip low points. Hip y (down = larger). Find local maxima of hip y within this leg's frames.
    const hipY = seq.map(x => (x.f.px[23].y + x.f.px[24].y) / 2);
    const gap = Math.max(5, Math.round((fps || 30) * 0.6));
    const top = Math.min(...hipY), bottom = Math.max(...hipY);
    const reps = [];
    for (let k = 0; k < hipY.length; k++) {
      let isMax = hipY[k] - top > (bottom - top) * 0.6;
      for (let j = Math.max(0, k - gap); isMax && j <= Math.min(hipY.length - 1, k + gap); j++) if (hipY[j] > hipY[k]) isMax = false;
      if (isMax && (!reps.length || k - reps[reps.length - 1].k > gap)) reps.push({ k });
    }
    const vals = reps.map(r => {
      // FPPA around the deepest point (±3 frames), take the median to resist jitter.
      const win = seq.slice(Math.max(0, r.k - 3), r.k + 4).map(x => fppa(x.f.px, side)).sort((a, b) => a - b);
      const drop = seq.slice(Math.max(0, r.k - 3), r.k + 4).map(x => pelvicDrop(x.f.px, side));
      return { fppa: win[Math.floor(win.length / 2)], drop: med(drop) };
    });
    if (!vals.length) continue;
    legs[side] = {
      reps: vals.length,
      maxFppa: +Math.max(...vals.map(v => v.fppa)).toFixed(1),
      meanFppa: +(vals.reduce((s, v) => s + v.fppa, 0) / vals.length).toFixed(1),
      pelvicDrop: +med(vals.map(v => v.drop)).toFixed(1),
    };
  }
  if (!legs.L && !legs.R) issues.push('No single-leg squats found. Face the camera and lift one foot clearly off the floor.');
  const findings = [], name = { L: 'left', R: 'right' };
  for (const [side, r] of Object.entries(legs)) {
    if (r.meanFppa > valgusFlagDeg) findings.push({ title: `${cap(name[side])} knee collapses inward (${r.meanFppa}°)`, why: 'Dynamic knee valgus on a single leg is linked to patellofemoral pain and ACL injury risk. It usually comes from weak hip abductors and external rotators, or poor foot control.', fix: [`Side-lying abduction, ${name[side]} leg first`, 'Banded single-leg squats, knee pushed out', 'Short-foot drill'] });
    if (r.pelvicDrop > 5) findings.push({ title: `Hip drops when standing on the ${name[side]} leg (${r.pelvicDrop}°)`, why: 'The opposite hip sinks, which points to glute medius weakness on the standing side.', fix: ['Single-leg stance with level hips', 'Lateral step-downs', 'Copenhagen plank'] });
  }
  let asymmetry = null;
  if (legs.L && legs.R) {
    asymmetry = +Math.abs(legs.L.meanFppa - legs.R.meanFppa).toFixed(1);
    if (asymmetry > asymFlagDeg) findings.push({ title: `Left and right knees differ by ${asymmetry}°`, why: 'A clear side-to-side difference suggests one leg has less control, often after an old injury.', fix: ['Train the weaker side first, extra set', 'Single-leg balance 3×30 s'] });
  } else if (legs.L || legs.R) issues.push('Only one leg was recorded. Test both legs to compare them.');
  if (!findings.length && (legs.L || legs.R)) findings.push({ ok: true, title: 'Good knee control', why: 'Your knee stays in line over your foot on a single leg.', fix: [] });
  return { ok: !!(legs.L || legs.R), legs, asymmetry, findings, issues, fps: Math.round(fps) };
}

// Pelvic drop (°): how far the free-leg side of the pelvis sinks below the stance side.
function pelvicDrop(px, stance) {
  const st = stance === 'L' ? px[23] : px[24], fr = stance === 'L' ? px[24] : px[23];
  return Math.atan2(fr.y - st.y, Math.abs(fr.x - st.x)) * 180 / Math.PI;
}
const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] ?? 0; };
const cap = s => s[0].toUpperCase() + s.slice(1);
