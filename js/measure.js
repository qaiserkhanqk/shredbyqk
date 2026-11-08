// Shared measurement helpers: real-world scale, frame rate, and recording-quality checks.
// Pure functions (no DOM) so they can be unit-tested and reused by every test.
import { dist, mid } from './angles.js';

export const G = 9.80665; // m/s², standard gravity
export const OLYMPIC_PLATE_M = 0.45; // standard bumper/competition plate diameter (450 mm)

/**
 * Metres per pixel from the plate: the user taps the top and bottom edge of a 45 cm plate.
 * This is the most accurate single-camera scale reference available in a gym.
 */
export function scaleFromPlate(p1, p2, diameterM = OLYMPIC_PLATE_M) {
  const px = dist(p1, p2);
  return px > 5 ? diameterM / px : null;
}

/**
 * Fallback scale from body height. Shoulder-to-ankle is ~0.779 of standing height
 * (Drillis & Contini segment proportions: shoulder 0.818 H, ankle 0.039 H). Estimate only: ±5% person to person.
 * Uses the median over standing frames to reject jitter.
 */
export function scaleFromHeight(frames, heightM) {
  if (!heightM || !frames.length) return null;
  const spans = frames.map(f => {
    const sh = mid(f.px[11], f.px[12]), an = mid(f.px[27], f.px[28]);
    return Math.abs(an.y - sh.y);
  }).filter(v => v > 20).sort((a, b) => a - b);
  if (!spans.length) return null;
  const median = spans[Math.floor(spans.length / 2)];
  return (0.779 * heightM) / median;
}

/** Effective frame rate from timestamps (ms). Uses the median interval so a dropped frame doesn't skew it. */
export function measuredFps(times) {
  if (times.length < 3) return 0;
  const d = []; for (let i = 1; i < times.length; i++) d.push(times[i] - times[i - 1]);
  d.sort((a, b) => a - b);
  const m = d[Math.floor(d.length / 2)];
  return m > 0 ? 1000 / m : 0;
}

/**
 * Recording quality gate — run before any test result is shown. Returns { ok, score 0–100, issues[] }.
 * Each issue is plain-language advice the client can act on.
 * @param frames [{t, px}] px: 33 landmarks in pixels with visibility v
 * @param opts {w, h, joints: indices that must be visible, minFps, view: expected 'side'|'front'|null, viewOf}
 */
export function assessQuality(frames, { w, h, joints = [11, 12, 23, 24, 25, 26, 27, 28], minFps = 25, minFrames = 30, view = null, viewOf = null } = {}) {
  const issues = [];
  if (frames.length < minFrames) issues.push('Recording is too short. Record for longer.');
  const fps = measuredFps(frames.map(f => f.t));
  if (fps && fps < minFps) issues.push(`Frame rate is ${Math.round(fps)} fps; this test needs ${minFps}+. Use slow-motion or better light.`);
  let visOk = 0, inFrame = 0, viewMatch = 0;
  for (const f of frames) {
    if (joints.every(i => f.px[i] && f.px[i].v >= 0.6)) visOk++;
    if (w && h && joints.every(i => f.px[i] && f.px[i].x > w * 0.01 && f.px[i].x < w * 0.99 && f.px[i].y > h * 0.01 && f.px[i].y < h * 0.99)) inFrame++;
    if (view && viewOf && viewOf(f.px) === view) viewMatch++;
  }
  const n = frames.length || 1;
  if (visOk / n < 0.8) issues.push('Some joints were hard to see. Wear fitted clothing and improve the lighting.');
  if (w && h && inFrame / n < 0.9) issues.push('Part of your body left the frame. Step back so you stay fully in view.');
  if (view && viewOf && viewMatch / n < 0.7) issues.push(view === 'side' ? 'Turn side-on to the camera.' : 'Face the camera straight on.');
  const score = Math.round(100 * Math.min(1, frames.length / minFrames) * (visOk / n) * (w && h ? inFrame / n : 1) * (view && viewOf ? Math.max(0.3, viewMatch / n) : 1) * (fps && fps < minFps ? 0.6 : 1));
  return { ok: issues.length === 0, score, issues, fps: Math.round(fps) };
}

/** Linear regression y = a + b·x. Returns {a, b, r2}. */
export function linearFit(xs, ys) {
  const n = xs.length; if (n < 2) return null;
  const mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  if (sxx === 0) return null;
  const b = sxy / sxx, a = my - b * mx;
  return { a, b, r2: syy ? (sxy * sxy) / (sxx * syy) : 1 };
}
