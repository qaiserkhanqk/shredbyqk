// Jump test (countermovement jump) from one camera.
//
// Method: flight time. Height h = g·t² / 8, where t = time in the air (Bosco et al. 1983).
// This is the same principle as jump mats and the validated "My Jump" phone app: it only needs
// accurate TIMING of take-off and landing, not distances, which is what one camera does best.
// Frame rate sets the precision: each event is timed to ±½ frame, interpolated between frames.
//   30 fps → ±~4 cm on a 40 cm jump; 120 fps → ±~1 cm; 240 fps → ±~0.5 cm.
// Cross-check: if a scale is known, the hip rise is measured too; tucking the legs in the air
// inflates flight time, and the two methods then disagree, so the jump is flagged.
import { G, measuredFps } from './measure.js';

const footY = px => Math.max(px[29].y, px[30].y, px[31].y, px[32].y, px[27].y, px[28].y); // lowest foot point (largest y)

/**
 * @param frames [{t ms, px}]
 * @param opts { mPerPx? }  scale enables the hip-rise cross-check
 * @returns { ok, jumps:[{heightCm, flightMs, hipRiseCm?, flagged?}], best, fps, precisionCm, issues[] }
 */
export function analyseJumps(frames, { mPerPx = null } = {}) {
  const issues = [];
  if (frames.length < 20) return { ok: false, jumps: [], issues: ['Recording is too short. Stand still for a second, then jump.'] };
  const fps = measuredFps(frames.map(f => f.t));
  if (fps < 50) issues.push(`Recorded at ${Math.round(fps)} fps. Use slow-motion (120 fps or more) for a precise result.`);

  // Standing baseline from the first ~0.5 s (the lifter stands still before jumping).
  const nBase = Math.max(5, Math.round((fps || 30) * 0.5));
  const base = frames.slice(0, nBase).map(f => footY(f.px)).sort((a, b) => a - b);
  const ground = base[Math.floor(base.length / 2)];
  const shin = median(frames.slice(0, nBase).map(f => Math.abs(f.px[27].y - f.px[25].y)));
  const thresh = Math.max(3, shin * 0.06); // feet this far above the floor = airborne
  const hip0 = median(frames.slice(0, nBase).map(f => (f.px[23].y + f.px[24].y) / 2));

  // Find take-off (foot rises past threshold) and landing (back below it), interpolated between frames.
  const lift = frames.map(f => ground - footY(f.px)); // + = above floor
  const jumps = [];
  for (let i = 1; i < frames.length; i++) {
    if (lift[i - 1] < thresh && lift[i] >= thresh) {
      const tOff = interp(frames[i - 1].t, frames[i].t, lift[i - 1], lift[i], thresh);
      let j = i + 1; while (j < frames.length && lift[j] >= thresh) j++;
      if (j >= frames.length) { issues.push('A landing was cut off. Keep recording until you\'ve landed.'); break; }
      const tOn = interp(frames[j - 1].t, frames[j].t, lift[j - 1], lift[j], thresh);
      const flight = (tOn - tOff) / 1000;
      if (flight > 0.1 && flight < 1.2) {
        // Each event is detected when the foot is `thresh` above the floor, which trims a little flight
        // time at both ends. The foot passes that height at about take-off speed v = g·t/2, so each end
        // loses ≈ threshold ÷ v. Needs the scale to convert the threshold to metres.
        const corr = mPerPx ? 2 * (thresh * mPerPx) / (G * flight / 2) : 0;
        const t = flight + corr;
        const heightCm = (G * t * t) / 8 * 100;
        const jump = { heightCm: +heightCm.toFixed(1), flightMs: Math.round(t * 1000) };
        if (mPerPx) {
          const peakHip = Math.min(...frames.slice(i, j).map(f => (f.px[23].y + f.px[24].y) / 2));
          jump.hipRiseCm = +((hip0 - peakHip) * mPerPx * 100).toFixed(1);
          if (Math.abs(jump.hipRiseCm - heightCm) > Math.max(6, heightCm * 0.3)) jump.flagged = 'Flight time and hip rise disagree. Land with straight legs, don\'t tuck your knees.';
        }
        jumps.push(jump);
      }
      i = j;
    }
  }
  if (!jumps.length) issues.push('No jump detected. Keep your feet in view and jump straight up.');
  const best = jumps.length ? jumps.reduce((a, b) => (b.heightCm > a.heightCm ? b : a)) : null;
  // Precision from timing resolution: dt ≈ 1/(2·fps) per event, two events; dh = g·t·dt/4 per event.
  const precisionCm = best && fps ? +((G * (best.flightMs / 1000) * (1 / fps)) / 4 * 100).toFixed(1) : null;
  return { ok: jumps.length > 0, jumps, best, fps: Math.round(fps), precisionCm, issues };
}

const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] ?? 0; };
const interp = (t0, t1, v0, v1, target) => (v1 === v0 ? t1 : t0 + (t1 - t0) * (target - v0) / (v1 - v0));

/** Readiness from jump height vs the athlete's own recent baseline (a common monitoring use). */
export function jumpReadiness(todayCm, history) {
  if (history.length < 3) return null;
  const recent = history.slice(-10), mean = recent.reduce((s, v) => s + v, 0) / recent.length;
  const sd = Math.sqrt(recent.reduce((s, v) => s + (v - mean) ** 2, 0) / recent.length) || 0.5;
  const z = (todayCm - mean) / sd;
  return { z: +z.toFixed(2), pct: +((todayCm / mean - 1) * 100).toFixed(1), status: z < -1.5 ? 'fatigued' : z < -0.75 ? 'slightly down' : 'ready' };
}
