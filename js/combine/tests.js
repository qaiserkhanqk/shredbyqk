// Athlete Combine: camera analysis for the tests that are not in jump.js / gait.js.
//
// One phone measures TIMING far better than distance (see jump.js), so every test here is built
// on timing events and joint angles, never on pixel distances without a known scale:
//  - Reactive hops (10/5 repeated-jump style): contact time + flight time per hop → RSI.
//  - Flying sprint: the body passes two cones a known distance apart → speed = distance ÷ time.
//  - 5-0-5 change of direction: the body passes ONE line out and back → time between crossings.
//  - Nordic hamstring lower: thigh-trunk angle from vertical where the lower stops being controlled.
//  - Bowling front knee: knee angle at front-foot contact vs at ball release (side-on screen).
// Precision is reported for every timed result: each event is ±½ frame, interpolated.
import { G, measuredFps } from '../measure.js';
import { angle } from '../angles.js';

const median = a => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN;
const interp = (t0, t1, v0, v1, target) => (v1 === v0 ? t1 : t0 + (t1 - t0) * (target - v0) / (v1 - v0));
const footY = px => Math.max(px[29].y, px[30].y, px[31].y, px[32].y, px[27].y, px[28].y);
const hipX = px => (px[23].x + px[24].x) / 2;
const hipY = px => (px[23].y + px[24].y) / 2;
const round = (v, d = 0) => +v.toFixed(d);

/** Peak power (W) from countermovement jump height and body mass. Sayers et al., MSSE 1999. */
export function peakPowerSayers(heightCm, massKg) {
  if (!(heightCm > 0) || !(massKg > 0)) return null;
  return Math.round(60.7 * heightCm + 45.3 * massKg - 2055);
}

/** Air/ground phases from foot height: returns [{tOff, tOn}] for every flight. */
function flights(frames) {
  const fps = measuredFps(frames.map(f => f.t));
  const nBase = Math.max(5, Math.round((fps || 30) * 0.4));
  const ground = median(frames.slice(0, nBase).map(f => footY(f.px)));
  const shin = median(frames.slice(0, nBase).map(f => Math.abs(f.px[27].y - f.px[25].y)));
  const thresh = Math.max(2, shin * 0.05);
  const lift = frames.map(f => ground - footY(f.px));
  // Crossing time of a height level, searching forward (up) or backward (down) from frame i.
  const cross = (i, level, up) => {
    if (up) { for (let k = i; k < frames.length; k++) if (lift[k - 1] < level && lift[k] >= level) return interp(frames[k - 1].t, frames[k].t, lift[k - 1], lift[k], level); }
    else { for (let k = i; k > 0; k--) if (lift[k - 1] >= level && lift[k] < level) return interp(frames[k - 1].t, frames[k].t, lift[k - 1], lift[k], level); }
    return null;
  };
  const out = [];
  for (let i = 1; i < frames.length; i++) {
    if (lift[i - 1] < thresh && lift[i] >= thresh) {
      let j = i + 1; while (j < frames.length && lift[j] >= thresh) j++;
      if (j >= frames.length) break;
      // Events are detected `thresh` above the floor, which trims flight and pads contact. Near the
      // floor the foot moves at roughly constant speed, so the time from 2×thresh to thresh equals the
      // time from thresh to the floor: extrapolate back to height 0. No scale needed.
      const a1 = cross(i, thresh, true), a2 = cross(i, 2 * thresh, true);
      const b1 = cross(j, thresh, false), b2 = cross(j, 2 * thresh, false);
      const tOff = a2 != null && a2 < b1 ? a1 - (a2 - a1) : a1;
      const tOn = b2 != null && b2 > a1 ? b1 + (b1 - b2) : b1;
      if (tOn - tOff > 60 && tOn - tOff < 1200) out.push({ tOff, tOn });
      i = j;
    }
  }
  return { out, fps };
}

/**
 * Reactive hops: 10 maximal hops, minimal ground time. RSI = jump height (m) ÷ ground contact (s),
 * reported as the mean of the best 5 hops (the "10/5" repeated jump test, Harper et al. 2011 style).
 */
export function analyseHops(frames) {
  if (frames.length < 30) return { ok: false, issues: ['Recording is too short. Stand still for a second, then hop 10 times.'] };
  const { out, fps } = flights(frames);
  const issues = [];
  if (fps < 50) issues.push(`Recorded at ${Math.round(fps)} fps. Ground contacts are short, so use slow-motion (120 fps or more).`);
  const hops = [];
  for (let k = 1; k < out.length; k++) {
    const contact = (out[k].tOff - out[k - 1].tOn) / 1000;
    const flight = (out[k].tOn - out[k].tOff) / 1000;
    if (contact <= 0.08 || contact > 0.6) continue; // not a rebound hop
    const hM = G * flight * flight / 8;
    hops.push({ contactMs: Math.round(contact * 1000), flightMs: Math.round(flight * 1000), heightCm: round(hM * 100, 1), rsi: round(hM / contact, 2) });
  }
  if (hops.length < 3) return { ok: false, fps: Math.round(fps), issues: [...issues, 'Fewer than 3 rebound hops found. Hop continuously, feet in view, without pausing on the ground.'] };
  const best = [...hops].sort((a, b) => b.rsi - a.rsi).slice(0, 5);
  return { ok: true, fps: Math.round(fps), hops, rsi: round(mean(best.map(h => h.rsi)), 2), contactMs: Math.round(mean(best.map(h => h.contactMs))), heightCm: round(mean(best.map(h => h.heightCm)), 1),
    precisionMs: Math.round(1000 / fps), issues };
}

/** Times the body centre (mid-hip) crosses a vertical line at x, interpolated between frames. */
export function crossings(frames, x, minGapMs = 300) {
  const out = [];
  for (let i = 1; i < frames.length; i++) {
    const a = hipX(frames[i - 1].px) - x, b = hipX(frames[i].px) - x;
    if (a === 0 || Math.sign(a) === Math.sign(b)) continue;
    const t = interp(frames[i - 1].t, frames[i].t, a, b, 0);
    if (!out.length || t - out[out.length - 1].t > minGapMs) out.push({ t, dir: Math.sign(b - a) });
  }
  return out;
}

/**
 * Flying sprint between two cones (gate x positions in video pixels) a known distance apart.
 * Camera side-on, far enough back that both cones are in frame.
 */
export function analyseFlyingSprint(frames, { gateA, gateB, distanceM = 10 } = {}) {
  if (!Number.isFinite(gateA) || !Number.isFinite(gateB)) return { ok: false, issues: ['Tap both cones on the video first.'] };
  const fps = measuredFps(frames.map(f => f.t));
  const a = crossings(frames, gateA), b = crossings(frames, gateB);
  if (!a.length || !b.length) return { ok: false, fps: Math.round(fps), issues: ['The runner didn\'t pass both cones in view. Start the build-up out of frame and run all the way through.'] };
  // First pass of each gate; whichever comes first is the entry cone, so either running direction works.
  const t1 = Math.min(a[0].t, b[0].t), t2 = Math.max(a[0].t, b[0].t);
  if (t2 - t1 < 300) return { ok: false, fps: Math.round(fps), issues: ['The two cones are too close together in the video. Tap the two cones, not the same one twice.'] };
  const s = (t2 - t1) / 1000;
  const mps = distanceM / s;
  const issues = fps < 50 ? [`Recorded at ${Math.round(fps)} fps. Use slow-motion for a precise time.`] : [];
  const dt = 1 / fps; // two events at ±½ frame each
  return { ok: true, fps: Math.round(fps), timeS: round(s, 3), mps: round(mps, 2), kmh: round(mps * 3.6, 1), precisionKmh: round((distanceM / (s - dt) - distanceM / (s + dt)) / 2 * 3.6, 1), issues };
}

/** 5-0-5: time from passing the line 5 m before the turn, to passing it again on the way back. */
export function analyseShuttle(frames, { gate } = {}) {
  if (!Number.isFinite(gate)) return { ok: false, issues: ['Tap the 5-metre line on the video first.'] };
  const fps = measuredFps(frames.map(f => f.t));
  const c = crossings(frames, gate, 500);
  const pair = c.findIndex((x, i) => c[i + 1] && c[i + 1].dir !== x.dir);
  if (pair < 0) return { ok: false, fps: Math.round(fps), issues: ['Didn\'t see the athlete pass the line out and back. Keep the line and the turn in view.'] };
  const s = (c[pair + 1].t - c[pair].t) / 1000;
  if (s < 1.5 || s > 5) return { ok: false, fps: Math.round(fps), issues: [`Timed ${s.toFixed(2)} s, which isn't a full-effort 5-0-5. Run it again at full effort.`] };
  return { ok: true, fps: Math.round(fps), timeS: round(s, 2), precisionS: round(1 / fps, 3), issues: fps < 50 ? [`Recorded at ${Math.round(fps)} fps. Use slow-motion for a precise time.`] : [] };
}

/**
 * Nordic hamstring lower, filmed side-on. Knees on the floor, ankles held. The body angle is the
 * knee→shoulder line from vertical. The "break point" is where lowering speed jumps (control lost).
 * A later break (bigger angle) means stronger hamstrings at long length.
 */
export function analyseNordic(frames) {
  if (frames.length < 20) return { ok: false, issues: ['Recording is too short. Lower as slowly as you can, all the way down.'] };
  const fps = measuredFps(frames.map(f => f.t));
  const side = mean(frames.map(f => (f.px[25].v ?? 1) + (f.px[23].v ?? 1) + (f.px[11].v ?? 1))) >= mean(frames.map(f => (f.px[26].v ?? 1) + (f.px[24].v ?? 1) + (f.px[12].v ?? 1))) ? 'L' : 'R';
  const [K, S] = side === 'L' ? [25, 11] : [26, 12];
  const ang = frames.map(f => { const k = f.px[K], s = f.px[S]; return Math.abs(Math.atan2(s.x - k.x, k.y - s.y)) * 180 / Math.PI; });
  const sm = ang.map((_, i) => mean(ang.slice(Math.max(0, i - 2), i + 3)));
  const vel = sm.map((v, i) => i ? (v - sm[i - 1]) / ((frames[i].t - frames[i - 1].t) / 1000) : 0);
  const start = sm.findIndex(v => v > 8);
  if (start < 0) return { ok: false, fps: Math.round(fps), issues: ['No lowering seen. Kneel upright side-on to the camera, then lower forward slowly.'] };
  const controlled = vel.slice(start, start + Math.max(5, Math.round(fps * 0.6))).filter(v => v > 0);
  const base = Math.max(15, median(controlled) || 15);
  let brk = vel.findIndex((v, i) => i > start && v > Math.max(60, base * 3));
  const maxAng = Math.max(...sm);
  if (brk < 0) brk = sm.indexOf(maxAng); // never lost control: reached the bottom
  const breakDeg = Math.round(Math.min(90, sm[brk]));
  const lowerS = round((frames[brk].t - frames[start].t) / 1000, 1);
  return { ok: true, fps: Math.round(fps), side, breakDeg, reachedFloor: breakDeg >= 80, lowerS, issues: [] };
}

/**
 * Bowling front knee, filmed side-on from the off or leg side, whole run-up end in view.
 * Front-foot contact (FFC) = the front ankle lands and stops; release = bowling wrist at its highest.
 * Knee angle 180° = straight. Extension after FFC is linked with faster ball speed (Portus 2004;
 * Worthington 2013). This is a coaching screen from one 2D camera, not a lab measurement.
 */
export function analyseBowling(frames) {
  if (frames.length < 20) return { ok: false, issues: ['Recording is too short. Film the last few strides through to the follow-through.'] };
  const fps = measuredFps(frames.map(f => f.t));
  const dir = Math.sign(hipX(frames[frames.length - 1].px) - hipX(frames[0].px)) || 1;
  // Release: highest wrist (smallest y) across the clip.
  let rel = 0, best = Infinity, arm = 15;
  frames.forEach((f, i) => { for (const w of [15, 16]) if (f.px[w].y < best && f.px[w].y < f.px[0].y) { best = f.px[w].y; rel = i; arm = w; } });
  if (best === Infinity) return { ok: false, fps: Math.round(fps), issues: ['Couldn\'t see the bowling arm go above the head. Keep the whole body in view.'] };
  // Front leg = the leg further ahead in the direction of travel at release.
  const fl = dir * (frames[rel].px[27].x - frames[rel].px[28].x) > 0 ? 'L' : 'R';
  const [H, K, A] = fl === 'L' ? [23, 25, 27] : [24, 26, 28];
  // FFC: last frame before release where the front ankle's horizontal speed drops near zero after moving.
  const speed = frames.map((f, i) => i ? Math.abs(f.px[A].x - frames[i - 1].px[A].x) / Math.max(1, f.t - frames[i - 1].t) : 0);
  const moving = Math.max(...speed.slice(0, rel + 1)) || 1;
  let ffc = -1;
  for (let i = rel; i > 1; i--) if (speed[i] < moving * 0.15 && speed[i - 1] >= moving * 0.15) { ffc = i; break; }
  if (ffc < 0 || rel - ffc > fps * 0.4) return { ok: false, fps: Math.round(fps), issues: ['Couldn\'t find front-foot contact. Film side-on, slow-motion, front foot in view.'] };
  const knee = i => angle(frames[i].px[H], frames[i].px[K], frames[i].px[A]);
  const kFfc = Math.round(knee(ffc)), kRel = Math.round(knee(rel)), change = kRel - kFfc;
  const pattern = change >= 10 ? 'extender' : change <= -10 ? 'flexor' : 'brace';
  const issues = fps < 100 ? [`Recorded at ${Math.round(fps)} fps. Fast bowling needs slow-motion (120 fps or more) to catch front-foot contact.`] : [];
  return { ok: true, fps: Math.round(fps), frontLeg: fl, bowlingArm: arm === 15 ? 'L' : 'R', kneeAtContact: kFfc, kneeAtRelease: kRel, change, pattern,
    contactToReleaseMs: Math.round(frames[rel].t - frames[ffc].t), issues };
}

/** Left/right difference as % of the better leg (limb symmetry, inverted: 0% = equal). */
export function asymmetryPct(l, r) {
  if (!(l > 0) || !(r > 0)) return null;
  return round(Math.abs(l - r) / Math.max(l, r) * 100, 1);
}
