// Velocity-based training (VBT) from one camera.
//
// The bar is tracked through a body landmark that moves with it:
//   - squat / good morning: shoulders (the bar sits on the upper back)
//   - bench, press, deadlift, RDL, row, curl: wrists (the bar is in the hands)
// Vertical position (pixels) × scale (metres per pixel) → bar height in metres.
//
// Per rep: mean concentric velocity (MCV) = vertical displacement ÷ time from the bottom to the top.
// Across loads: the load–velocity relationship is close to linear, so a few sets at different weights
// estimate the 1-rep max as the load at which bar speed falls to the lift's minimum velocity threshold
// (González-Badillo & Sánchez-Medina 2010; Jovanović & Flanagan 2014).
import { linearFit } from './measure.js';

// Typical minimum velocity thresholds (m/s) at 1RM from the VBT literature. They vary between people;
// a lifter's own true-1RM velocity, once known, should replace these.
export const MVT = { squat: 0.30, bench: 0.17, deadlift: 0.15, press: 0.20, row: 0.40, default: 0.25 };
export const BAR_POINT = { squat: 'shoulder', default: 'wrist' };

export class BarTracker {
  constructor({ minRomM = 0.12 } = {}) { this.samples = []; this.cut = 0; this.minRomM = minRomM; this.reps = []; }
  reset() { this.samples = []; this.cut = 0; this.reps = []; }

  /** @param t ms  @param yPx bar point vertical pixel position  @param mPerPx scale */
  push(t, yPx, mPerPx) {
    if (yPx == null || !mPerPx) return;
    this.samples.push({ t, h: -yPx * mPerPx }); // height in metres, up = positive
  }

  /**
   * Call when the rep engine reports a completed rep. Analyses the samples since the previous rep:
   * the lowest point, then the highest point after it, is the concentric phase.
   * Returns { mcv, peak, romM, conMs } or null if the movement was too small to be a rep.
   */
  closeRep() {
    const seg = smoothSeries(this.samples.slice(this.cut));
    this.cut = this.samples.length;
    if (seg.length < 6) return null;
    // Velocity by central difference on the smoothed path.
    const v = seg.map((p, i) => {
      const a = seg[Math.max(0, i - 1)], b = seg[Math.min(seg.length - 1, i + 1)];
      return b.t > a.t ? (b.h - a.h) / ((b.t - a.t) / 1000) : 0;
    });
    // The concentric phase is the continuous run of upward movement around the fastest point.
    // Timing it by movement (bar speed above 0.05 m/s) instead of lowest-to-highest point keeps
    // a pause at the bottom or a hold at lockout from being counted as lifting time.
    let pk = 0; for (let i = 1; i < v.length; i++) if (v[i] > v[pk]) pk = i;
    const V0 = 0.05;
    if (v[pk] < V0 * 2) return null;
    let lo = pk; while (lo > 0 && v[lo - 1] > V0) lo--;
    let hi = pk; while (hi < v.length - 1 && v[hi + 1] > V0) hi++;
    const romM = seg[hi].h - seg[lo].h, dt = (seg[hi].t - seg[lo].t) / 1000;
    if (romM < this.minRomM || dt <= 0.05) return null;
    const peak = v[pk];
    const rep = { mcv: romM / dt, peak, romM, conMs: Math.round(dt * 1000) };
    this.reps.push(rep);
    return rep;
  }

  /** Velocity loss within the set: 1 − last MCV ÷ fastest MCV. */
  velocityLoss() {
    if (this.reps.length < 2) return 0;
    const best = Math.max(...this.reps.map(r => r.mcv));
    return Math.max(0, 1 - this.reps[this.reps.length - 1].mcv / best);
  }
}

// 5-point centred moving average: removes landmark jitter that would inflate peak velocity.
function smoothSeries(s) {
  return s.map((p, i) => {
    let sum = 0, n = 0;
    for (let j = Math.max(0, i - 2); j <= Math.min(s.length - 1, i + 2); j++) { sum += s[j].h; n++; }
    return { t: p.t, h: sum / n };
  });
}

/**
 * Estimated 1RM from sets at different loads. Uses each set's fastest rep (closest to true capability).
 * @param sets [{ loadKg, mcv }]  needs ≥2 distinct loads, ideally spread ≥20% apart
 * @returns { e1rm, slope, intercept, r2, mvt, reliable } or null
 */
export function estimate1RM(sets, lift = 'default') {
  const loads = [...new Set(sets.map(s => s.loadKg))];
  if (loads.length < 2) return null;
  const best = loads.map(l => ({ l, v: Math.max(...sets.filter(s => s.loadKg === l).map(s => s.mcv)) }));
  const fit = linearFit(best.map(b => b.l), best.map(b => b.v));
  if (!fit || fit.b >= 0) return null; // velocity must fall as load rises
  const mvt = MVT[lift] ?? MVT.default;
  const e1rm = (mvt - fit.a) / fit.b;
  const spread = (Math.max(...loads) - Math.min(...loads)) / Math.max(...loads);
  return { e1rm, slope: fit.b, intercept: fit.a, r2: fit.r2, mvt, reliable: fit.r2 >= 0.9 && spread >= 0.2 && best.length >= 3 };
}

/** Training-zone label from MCV, using the commonly used VBT zones (Mann). */
export function velocityZone(mcv) {
  if (mcv >= 1.3) return 'Starting strength';
  if (mcv >= 1.0) return 'Speed-strength';
  if (mcv >= 0.75) return 'Strength-speed';
  if (mcv >= 0.5) return 'Accelerative strength';
  return 'Absolute strength';
}
