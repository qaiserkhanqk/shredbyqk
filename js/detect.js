// Recognises the exercise from the movement itself, so a lifter can open the camera and just start.
// Works on the same 33 pose landmarks as everything else, over a sliding window of ~3.5 s:
//  1. Posture: upright, bent over, lying, or hanging.
//  2. Which joint angles move, and by how much (range = 90th − 10th percentile, so jitter is ignored).
//  3. Where the hands go (overhead, above the elbow, below it) and whether the body or the hands move.
//  4. At least one full down-and-up cycle of the main joint, so a single fidget doesn't trigger it.
// Returns { pattern, id (library exercise), label, confidence, alt? } or null while still unsure.
// A 2D camera can't tell some pairs apart (a seated overhead press and a lat pulldown look alike), so
// `alt` names the other likely exercise and the app offers a one-tap switch.
import { angle, fromVertical, dist, mid, bestSide, viewOf } from './angles.js';

const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]; };
const range = a => (a.length ? pct(a, 0.9) - pct(a, 0.1) : 0);
const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const frac = a => a.filter(Boolean).length / (a.length || 1);

// Full cycles of a signal: crossings of its middle, counted in pairs (down and back up).
function cycles(a) {
  if (a.length < 6) return 0;
  const lo = pct(a, 0.1), hi = pct(a, 0.9), m = (lo + hi) / 2, band = (hi - lo) * 0.15;
  let side = 0, n = 0;
  for (const v of a) { const s = v > m + band ? 1 : v < m - band ? -1 : 0; if (s && side && s !== side) n++; if (s) side = s; }
  return n / 2;
}

/** Per-frame features. Exported for tests. */
export function features(p) {
  const s = bestSide(p), view = viewOf(p), T = dist(s.sh, s.hip) || 1;
  const both = (a, b, c, d, e, f) => [angle(p[a], p[b], p[c]), angle(p[d], p[e], p[f])];
  const elbows = both(11, 13, 15, 12, 14, 16), knees = both(23, 25, 27, 24, 26, 28);
  const visLegs = p[25].v > 0.5 && p[26].v > 0.5;
  return {
    view, conf: s.conf,
    torso: fromVertical(s.hip, s.sh),                       // 0 upright … 90 lying
    thigh: fromVertical(s.hip, s.kn),                       // thighs near horizontal too = lying, not bent over
    torsoSigned: Math.atan2(s.sh.x - s.hip.x, s.hip.y - s.sh.y) * 180 / Math.PI,
    knee: view === 'front' ? Math.min(...knees) : angle(s.hip, s.kn, s.an),
    kneeGap: visLegs ? Math.abs(knees[0] - knees[1]) : 0,   // split stance → one knee bends more
    feetApart: Math.abs(p[27].x - p[28].x) / T,
    hip: angle(s.sh, s.hip, s.kn),
    elbow: view === 'front' ? Math.min(...elbows) : angle(s.sh, s.el, s.wr),
    flex: view === 'front' ? Math.max(angle(p[23], p[11], p[13]), angle(p[24], p[12], p[14])) : angle(s.hip, s.sh, s.el),
    line: angle(s.sh, s.hip, s.an),
    // Heel lift only side-on: facing the camera the heel and toe overlap, so the ratio is pure noise.
    heel: view === 'side' && s.he && s.ft ? (s.ft.y - s.he.y) / (dist(s.he, s.ft) || 1) : 0,
    wristOverHead: s.wr.y < Math.min(p[0].y, s.sh.y - T * 0.3),
    wristAboveSh: s.wr.y < s.sh.y,
    wristAboveEl: s.wr.y < s.el.y,
    shY: mid(p[11], p[12]).y / T, wrY: s.wr.y / T, hipY: s.hip.y / T,
    ankBelowHip: (s.an.y - s.hip.y) / T,
  };
}

const PICK = {
  squat: ['squat', 'Squats'], lunge: ['lunge', 'Lunges'], rdl: ['rdl', 'Romanian deadlifts'], calf: ['calfRaise', 'Calf raises'],
  press: ['press', 'Overhead press'], vPull: ['pullUp', 'Pull-ups'], pulldown: ['latPulldown', 'Lat pulldown'], row: ['bentRow', 'Rows'],
  curl: ['curl', 'Biceps curls'], pushdown: ['pushdown', 'Triceps pushdowns'], ohTri: ['ohExtension', 'Overhead triceps extensions'],
  lateral: ['lateralRaise', 'Lateral raises'], front: ['frontRaise', 'Front raises'], pushUp: ['pushUp', 'Push-ups'],
  bench: ['benchPress', 'Bench press'], floorPress: ['xBarbellFloorPress', 'Floor press'], bridge: ['gluteBridge', 'Glute bridges'],
  crunch: ['crunch', 'Crunches'], legRaise: ['legRaise', 'Leg raises'], plank: ['plank', 'Plank'],
};
const out = (k, confidence, alt) => ({ key: k, id: PICK[k][0], label: PICK[k][1], confidence, alt: alt && { key: alt, id: PICK[alt][0], label: PICK[alt][1] } });

/** @param F array of features() over the last ~3.5 s (at least ~45 frames) */
export function classify(F) {
  F = F.filter(f => f.conf >= 0.55);
  if (F.length < 40) return null;
  const col = k => F.map(f => f[k]);
  const R = k => range(col(k)), M = k => mean(col(k));
  // Lying needs the torso AND the thighs off vertical at some point (a bent-over row has a flat torso but upright legs).
  const torso = pct(col('torso'), 0.5), lying = torso > 58 && pct(col('thigh'), 0.9) > 45, bent = !lying && torso > 28;
  const r = { knee: R('knee'), hip: R('hip'), elbow: R('elbow'), flex: R('flex'), heel: R('heel'), torso: R('torso'), line: R('line'), shY: R('shY'), wrY: R('wrY'), hipY: R('hipY') };
  const moved = Math.max(r.knee, r.hip, r.elbow, r.flex, r.torso, r.line, r.heel * 100);
  const cyc = k => cycles(col(k));

  if (lying) {
    if (r.elbow > 40 && cyc('elbow') >= 1) {
      if (frac(col('wristAboveSh')) > 0.6) return M('ankBelowHip') < 0.3 ? out('floorPress', 0.8, 'bench') : out('bench', 0.85, 'floorPress');
      if (M('line') > 145) return out('pushUp', 0.9);
    }
    // Bridge: the hips rise, shoulders stay down. Crunch: the shoulders rise, hips stay down.
    if (r.hip > 25 && M('knee') < 130 && r.hipY > r.shY && cyc('hip') >= 1) return out('bridge', 0.85);
    if (r.torso > 15 && M('knee') < 130 && r.shY >= r.hipY && cyc('torso') >= 1) return out('crunch', 0.8);
    if (r.line > 30 && M('knee') > 140 && cyc('line') >= 1) return out('legRaise', 0.8);
    if (moved < 10 && M('line') > 150 && F.length >= 75) return out('plank', 0.75);
    return null;
  }

  // Pull-up / chin-up: the hands stay on the bar (above the shoulders) while the body travels up and down.
  if (frac(col('wristAboveSh')) > 0.9 && r.shY > 0.3 && r.wrY < r.shY * 0.5 && cyc('elbow') >= 1) return out('vPull', 0.85);

  if (r.knee > 35 && cyc('knee') >= 1) {
    const split = pct(col('kneeGap'), 0.9) > 30 || M('feetApart') > 0.9;
    if (split) return out('lunge', 0.85);
    return out('squat', r.hip > 30 ? 0.9 : 0.7);
  }
  if (r.hip > 30 && r.knee < 30 && cyc('hip') >= 1) return out('rdl', 0.85);
  if (r.heel > 0.2 && r.knee < 20 && cyc('heel') >= 1) return out('calf', 0.85);

  if (r.elbow > 45 && cyc('elbow') >= 1) {
    const overhead = frac(col('wristOverHead'));
    if (overhead > 0.3) {
      // Upper arm stays pointing up while only the forearm moves: an overhead triceps extension.
      if (M('flex') > 140 && r.flex < 30) return out('ohTri', 0.8);
      const seated = M('knee') < 120;
      return seated ? out('press', 0.6, 'pulldown') : out('press', 0.8, 'pulldown');
    }
    if (bent) return out('row', 0.85);
    if (frac(col('wristAboveEl')) > 0.25) return out('curl', 0.9);
    return out('pushdown', 0.8);
  }
  if (r.flex > 40 && r.elbow < 35 && cyc('flex') >= 1) return F[F.length - 1].view === 'front' ? out('lateral', 0.85, 'front') : out('front', 0.8, 'lateral');
  return null;
}

/** Rolling detector: push one frame of landmarks at a time; returns a result once it's confident. */
export class ExerciseDetector {
  constructor({ windowMs = 3500 } = {}) { this.windowMs = windowMs; this.buf = []; this.n = 0; }
  reset() { this.buf = []; }
  push(px, t) {
    this.buf.push({ t, f: features(px) });
    while (this.buf.length && t - this.buf[0].t > this.windowMs) this.buf.shift();
    if (++this.n % 5) return null; // classify a few times a second, not every frame
    return classify(this.buf.map(b => b.f));
  }
}

/** Every exercise the detector can name, for the "Change" picker. */
export const PICK_LIST = Object.entries(PICK).map(([key, [id, label]]) => ({ key, id, label }));
