// Geometry helpers for pose landmarks (MediaPipe 33-point BlazePose model).
export const LM = {
  nose: 0, lEar: 7, rEar: 8,
  lShoulder: 11, rShoulder: 12, lElbow: 13, rElbow: 14, lWrist: 15, rWrist: 16,
  lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnkle: 27, rAnkle: 28,
  lHeel: 29, rHeel: 30, lFoot: 31, rFoot: 32,
};

export const SKELETON = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 29], [29, 31], [27, 31], [28, 30], [30, 32], [28, 32], [7, 11], [8, 12],
];

// Convert normalized landmarks to pixel space so angles are not distorted by aspect ratio.
export function toPx(landmarks, w, h) {
  return landmarks.map(p => ({ x: p.x * w, y: p.y * h, z: p.z, v: p.visibility ?? 1 }));
}

// Interior angle ABC in degrees (vertex at B).
export function angle(a, b, c) {
  const abx = a.x - b.x, aby = a.y - b.y, cbx = c.x - b.x, cby = c.y - b.y;
  const dot = abx * cbx + aby * cby;
  const mag = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
  if (!mag) return NaN;
  return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180 / Math.PI;
}

// Angle of segment a->b from vertical (0 = perfectly upright).
export function fromVertical(a, b) {
  return Math.atan2(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) * 180 / Math.PI;
}

// Tilt of the line a-b from horizontal, signed degrees.
export function tilt(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
}

export function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
export function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, v: Math.min(a.v, b.v) }; }

// Pick the body side facing the camera (higher landmark visibility).
export function bestSide(p) {
  const L = [11, 13, 15, 23, 25, 27].reduce((s, i) => s + p[i].v, 0);
  const R = [12, 14, 16, 24, 26, 28].reduce((s, i) => s + p[i].v, 0);
  return L >= R
    ? { side: 'left', sh: p[11], el: p[13], wr: p[15], hip: p[23], kn: p[25], an: p[27], ear: p[7], he: p[29], ft: p[31], conf: L / 6 }
    : { side: 'right', sh: p[12], el: p[14], wr: p[16], hip: p[24], kn: p[26], an: p[28], ear: p[8], he: p[30], ft: p[32], conf: R / 6 };
}

// Is the user filmed side-on or facing the camera? Shoulder width vs torso length.
export function viewOf(p) {
  const shW = dist(p[11], p[12]);
  const torso = dist(mid(p[11], p[12]), mid(p[23], p[24]));
  return shW / (torso || 1) > 0.55 ? 'front' : 'side';
}

// Exponential smoothing so jittery landmarks don't trigger false cues.
export class Smoother {
  constructor(alpha = 0.5) { this.alpha = alpha; this.v = {}; }
  push(key, val) {
    if (Number.isNaN(val)) return this.v[key];
    this.v[key] = this.v[key] == null ? val : this.alpha * val + (1 - this.alpha) * this.v[key];
    return this.v[key];
  }
  reset() { this.v = {}; }
}

// One Euro filter (Casiez, Roussel & Vogel, CHI 2012): smooths hard when the joint is still (no jitter at the
// bottom of a squat) and barely at all when it moves fast (no lag on the way up). Same push(key, val) API as
// Smoother, plus an optional time in ms. minCutoff (Hz) sets the smoothing at rest; beta how fast it lets go.
export class OneEuro {
  constructor({ minCutoff = 1.2, beta = 0.05, dCutoff = 1 } = {}) { this.o = { minCutoff, beta, dCutoff }; this.s = {}; }
  push(key, val, t = (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    if (val == null || Number.isNaN(val)) return this.s[key]?.x;
    const st = this.s[key], a = (dt, fc) => { const r = 2 * Math.PI * fc * dt; return r / (r + 1); };
    if (!st) { this.s[key] = { x: val, dx: 0, t }; return val; }
    const dt = Math.max(1e-3, (t - st.t) / 1000), dx = (val - st.x) / dt;
    const edx = st.dx + a(dt, this.o.dCutoff) * (dx - st.dx);
    const fc = this.o.minCutoff + this.o.beta * Math.abs(edx);
    const x = st.x + a(dt, fc) * (val - st.x);
    this.s[key] = { x, dx: edx, t }; return x;
  }
  reset() { this.s = {}; }
}

// Joints each measurement depends on (BlazePose indices, left/right).
const JOINTS = { knee: [[23, 25, 27], [24, 26, 28]], hip: [[11, 23, 25], [12, 24, 26]], elbow: [[11, 13, 15], [12, 14, 16]] };
/**
 * How clearly the camera sees the joints this exercise is judged on (0–1, the worst one).
 * Research: gating out low-confidence frames lifted squat-angle agreement from ICC 0.43 to 0.77 (Yue 2026).
 * Side view: the side facing the camera. Front view: both sides (knee-cave needs both knees).
 */
export function jointVisibility(px, primary, view = 'side') {
  const set = JOINTS[primary] || [[11, 23, 25, 27, 13, 15], [12, 24, 26, 28, 14, 16]];
  const v = side => Math.min(...side.map(i => px[i]?.v ?? 0));
  if (view === 'front') return Math.min(v(set[0]), v(set[1]));
  return Math.max(v(set[0]), v(set[1]));
}
export const VIS_MIN = 0.5;
