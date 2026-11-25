// Demo athletes for when there's no camera (or to show a client what the coach does).
// They produce the same 33-point landmark arrays the camera produces, so the demo runs through
// the real rep engine, feedback scheduler, motion tracker and gait analysis — nothing is faked
// downstream of the "camera".
import { simulateWalker } from './gait.js';

export const DEMO_W = 720, DEMO_H = 600;

// Hip-thrust set: feet too far for 3 reps, fixed after QK's cue, then fatigue slows the reps.
const SCRIPT = [[225, .8], [224, .8], [223, .85], [188, .8], [188, .85], [189, .9], [188, 1.0], [188, 1.15], [189, 1.4], [188, 1.6]];
const ECC = 1.5, PAUSE = .25, HOLD = .7, TOP = -.06, BOTTOM = .84;
const ease = x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;

export class HipThrustDemo {
  constructor() { this.t0 = null; this.rep = 0; this.footD = SCRIPT[0][0]; this.done = false; }

  frame(now) {
    if (this.t0 == null) { this.t0 = now; this.phaseStart = now; }
    const con = SCRIPT[Math.min(this.rep, SCRIPT.length - 1)][1];
    const el = (now - this.phaseStart) / 1000, cyc = ECC + PAUSE + con + HOLD;
    let theta;
    if (this.rep >= SCRIPT.length) { theta = TOP; this.done = true; }
    else if (el < ECC) theta = TOP + (BOTTOM - TOP) * ease(el / ECC);
    else if (el < ECC + PAUSE) theta = BOTTOM;
    else if (el < ECC + PAUSE + con) theta = BOTTOM - (BOTTOM - TOP) * ease((el - ECC - PAUSE) / con);
    else theta = TOP;
    const target = SCRIPT[Math.min(this.rep + (el > ECC + PAUSE + con + .4 ? 1 : 0), SCRIPT.length - 1)][0];
    this.footD += (target - this.footD) * .08;
    if (el >= cyc && this.rep < SCRIPT.length) { this.rep++; this.phaseStart = now; }
    this.P = pose(theta, this.footD);
    return toLandmarks(this.P);
  }

  // Body silhouette, bench and barbell under the skeleton overlay.
  drawScene(ctx) {
    const P = this.P; if (!P) return;
    const s = 2, X = p => p.x * s, Y = p => p.y * s + 10;
    const g = ctx.createRadialGradient(400, 500, 10, 400, 500, 440);
    g.addColorStop(0, 'rgba(124,108,255,.16)'); g.addColorStop(1, 'rgba(124,108,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, DEMO_W, DEMO_H);
    ctx.strokeStyle = '#1e2638'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, Y({ y: 250 })); ctx.lineTo(DEMO_W, Y({ y: 250 })); ctx.stroke();
    ctx.fillStyle = '#1a2130'; ctx.beginPath(); ctx.roundRect?.(X({ x: 40 }), Y({ y: 170 }), 160, 160, 16); ctx.fill();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#262f44';
    const limb = (pts, w) => { ctx.lineWidth = w * s; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(X(p), Y(p)) : ctx.moveTo(X(p), Y(p))); ctx.stroke(); };
    limb([P.S, P.H], 30); limb([P.H, P.K], 24); limb([P.K, P.A], 18); limb([P.A, P.toe], 10); limb([P.S, P.elbow, P.hand], 12);
    ctx.fillStyle = '#262f44'; ctx.beginPath(); ctx.arc(X(P.head), Y(P.head), 34, 0, 7); ctx.fill();
    ctx.strokeStyle = '#3a4460'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(X(P.H), Y({ y: P.H.y - 26 }), 52, 0, 7); ctx.stroke();
  }
}

function pose(theta, footD) {
  const S = { x: 115, y: 165 }, Lt = 100, thigh = 88, shin = 86;
  const H = { x: S.x + Lt * Math.cos(theta), y: S.y + Lt * Math.sin(theta) };
  const A = { x: S.x + footD, y: 250 };
  const d = Math.min(thigh + shin - 1, Math.hypot(A.x - H.x, A.y - H.y));
  const base = Math.atan2(A.y - H.y, A.x - H.x), a = Math.acos((thigh * thigh + d * d - shin * shin) / (2 * thigh * d));
  const k1 = { x: H.x + thigh * Math.cos(base - a), y: H.y + thigh * Math.sin(base - a) };
  const k2 = { x: H.x + thigh * Math.cos(base + a), y: H.y + thigh * Math.sin(base + a) };
  const K = k1.y < k2.y ? k1 : k2;
  return { S, H, K, A, head: { x: S.x - 26, y: S.y - 8 }, toe: { x: A.x + 18, y: 250 }, heel: { x: A.x - 6, y: 250 }, elbow: { x: S.x - 30, y: S.y + 20 }, hand: { x: H.x - 6, y: H.y - 22 } };
}

function toLandmarks(P) {
  const s = 2, c = (p, v = 1) => ({ x: p.x * s, y: p.y * s + 10, v });
  const px = Array.from({ length: 33 }, () => c(P.H, 0.1));
  px[0] = c(P.head); px[7] = c(P.head);
  px[11] = c(P.S); px[13] = c(P.elbow); px[15] = c(P.hand);
  px[23] = c(P.H); px[25] = c(P.K); px[27] = c(P.A); px[29] = c(P.heel); px[31] = c(P.toe);
  // Far side is hidden behind the near side, exactly like a real side-on camera.
  for (const [n, f] of [[11, 12], [13, 14], [15, 16], [23, 24], [25, 26], [27, 28], [29, 30], [31, 32], [7, 8]]) px[f] = { ...px[n], v: 0.3 };
  return px;
}

/* ---------- Squat demo (side-on) ----------
   Reps 1–2: hips shoot up first out of the bottom. Rep 3 fixed after QK's cue.
   Reps 5–6: heels lift off the floor. Rep 7 fixed. */
const SQ_SCRIPT = ['hips', 'hips', 'clean', 'clean', 'heels', 'heels', 'clean', 'clean'];
const SQ = { ecc: 1.4, pause: 0.2, con: 1.1, hold: 0.9 };
const FLOOR = 540, rad = d => d * Math.PI / 180;

export class SquatDemo {
  constructor() { this.t0 = null; this.rep = 0; this.done = false; }
  frame(now) {
    if (this.t0 == null) { this.t0 = now; this.phaseStart = now + 600; }
    const el = (now - this.phaseStart) / 1000, cyc = SQ.ecc + SQ.pause + SQ.con + SQ.hold;
    const fault = SQ_SCRIPT[Math.min(this.rep, SQ_SCRIPT.length - 1)];
    let d = 0, rising = false;
    if (this.rep >= SQ_SCRIPT.length || el < 0) { d = 0; if (this.rep >= SQ_SCRIPT.length) this.done = true; }
    else if (el < SQ.ecc) d = ease(el / SQ.ecc);
    else if (el < SQ.ecc + SQ.pause) d = 1;
    else if (el < SQ.ecc + SQ.pause + SQ.con) { d = 1 - ease((el - SQ.ecc - SQ.pause) / SQ.con); rising = true; }
    if (el >= cyc && this.rep < SQ_SCRIPT.length) { this.rep++; this.phaseStart = now; }
    this.P = squatPose(d, rising && fault === 'hips', fault === 'heels' ? d : 0);
    return toPxLandmarks(this.P);
  }
  drawScene(ctx) {
    const P = this.P; if (!P) return;
    backdrop(ctx, 380, 420, 'rgba(124,108,255,.16)');
    floorLine(ctx, FLOOR + 2);
    body(ctx, P, { torso: 46, thigh: 34, shin: 24 });
    // barbell on the upper back
    ctx.fillStyle = '#3a4460'; ctx.beginPath(); ctx.arc(P.bar.x, P.bar.y, 46, 0, 7); ctx.fill();
    ctx.fillStyle = '#4b5675'; ctx.beginPath(); ctx.arc(P.bar.x, P.bar.y, 10, 0, 7); ctx.fill();
  }
}

function squatPose(d, hipsFirst, heel) {
  const toe = { x: 410, y: FLOOR }, foot = 62, shin = 130, thigh = 136, torso = 150;
  const phi = rad(26 * heel); // foot pivots about the toe when the heels lift
  const he = { x: toe.x - foot * Math.cos(phi), y: FLOOR - foot * Math.sin(phi) };
  const A = { x: he.x + 14 * Math.cos(phi) + 6 * Math.sin(phi), y: he.y - 22 };
  const ts = rad(30 * d), tt = rad(84 * d);
  const K = { x: A.x + shin * Math.sin(ts), y: A.y - shin * Math.cos(ts) };
  const H = { x: K.x - thigh * Math.sin(tt), y: K.y - thigh * Math.cos(tt) };
  const lean = rad(38 * d + (hipsFirst ? 34 * Math.sin(Math.PI * (1 - d)) : 0));
  const S = { x: H.x + torso * Math.sin(lean), y: H.y - torso * Math.cos(lean) };
  const head = { x: S.x + 30 * Math.sin(lean) + 10, y: S.y - 34 * Math.cos(lean) - 6 };
  const bar = { x: S.x - 8 * Math.cos(lean), y: S.y + 4 };
  const elbow = { x: S.x - 30, y: S.y + 34 }, hand = { x: bar.x + 4, y: bar.y - 2 };
  return { S, H, K, A, head, toe, heel: he, elbow, hand, bar };
}

/* ---------- Bench press demo (side-on, head on the left) ----------
   Reps 1–2: shoulders roll off the bench at lockout (no scapular retraction).
   Reps 4–5: feet out in front, no leg drive. Rep 7: hips lift off the bench. */
const BP_SCRIPT = ['scap', 'scap', 'clean', 'legs', 'legs', 'clean', 'butt', 'clean'];
const BP = { ecc: 1.5, pause: 0.25, con: 1.0, hold: 0.8 };
const BENCH_Y = 380;

export class BenchDemo {
  constructor() { this.t0 = null; this.rep = 0; this.done = false; this.legs = 0; }
  frame(now) {
    if (this.t0 == null) { this.t0 = now; this.phaseStart = now + 600; }
    const el = (now - this.phaseStart) / 1000, cyc = BP.ecc + BP.pause + BP.con + BP.hold;
    const fault = BP_SCRIPT[Math.min(this.rep, BP_SCRIPT.length - 1)];
    let lift = 1, press = 0; // lift: 1 = lockout, 0 = bar on chest; press: progress of the press 0..1
    if (this.rep >= BP_SCRIPT.length || el < 0) { lift = 1; if (this.rep >= BP_SCRIPT.length) this.done = true; }
    else if (el < BP.ecc) lift = 1 - ease(el / BP.ecc);
    else if (el < BP.ecc + BP.pause) lift = 0;
    else if (el < BP.ecc + BP.pause + BP.con) { press = (el - BP.ecc - BP.pause) / BP.con; lift = ease(press); }
    if (el >= cyc && this.rep < BP_SCRIPT.length) { this.rep++; this.phaseStart = now; }
    // Feet move between reps, during the lockout hold, like a real lifter resetting.
    const nextFault = BP_SCRIPT[Math.min(this.rep + (el > BP.ecc + BP.pause + BP.con ? 1 : 0), BP_SCRIPT.length - 1)];
    this.legs += ((nextFault === 'legs' ? 1 : 0) - this.legs) * 0.08;
    const shRise = fault === 'scap' && el > BP.ecc + BP.pause ? 30 * lift : 0;
    const hipRise = fault === 'butt' && press > 0 ? 32 * Math.sin(Math.PI * press) : 0;
    this.P = benchPose(lift, shRise, hipRise, this.legs);
    return toPxLandmarks(this.P);
  }
  drawScene(ctx) {
    const P = this.P; if (!P) return;
    backdrop(ctx, 360, 440, 'rgba(69,195,255,.12)');
    floorLine(ctx, FLOOR + 2);
    ctx.fillStyle = '#1a2130'; ctx.beginPath(); ctx.roundRect?.(150, BENCH_Y, 330, 26, 10); ctx.fill();
    ctx.fillRect(200, BENCH_Y + 20, 18, FLOOR - BENCH_Y - 20); ctx.fillRect(420, BENCH_Y + 20, 18, FLOOR - BENCH_Y - 20);
    body(ctx, P, { torso: 46, thigh: 32, shin: 22 });
    ctx.fillStyle = '#3a4460'; ctx.beginPath(); ctx.arc(P.hand.x, P.hand.y, 52, 0, 7); ctx.fill();
    ctx.fillStyle = '#4b5675'; ctx.beginPath(); ctx.arc(P.hand.x, P.hand.y, 11, 0, 7); ctx.fill();
  }
}

function benchPose(lift, shRise, hipRise, legs) {
  const S = { x: 250, y: BENCH_Y - 18 - shRise }, H = { x: 410, y: BENCH_Y - 16 - hipRise };
  const up = 86, fore = 80, D = 74 + (164 - 74) * lift;
  const W = { x: S.x + 12, y: S.y - Math.sqrt(Math.max(0, D * D - 144)) };
  // Two-link IK: elbow on the hip side of the shoulder→wrist line.
  const dx = W.x - S.x, dy = W.y - S.y, L = Math.hypot(dx, dy), a = Math.acos(Math.min(1, (up * up + L * L - fore * fore) / (2 * up * L)));
  const base = Math.atan2(dy, dx), E = { x: S.x + up * Math.cos(base + a), y: S.y + up * Math.sin(base + a) };
  const lerp = (p, q) => ({ x: p.x + (q.x - p.x) * legs, y: p.y + (q.y - p.y) * legs });
  const K = lerp({ x: 520, y: BENCH_Y + 8 - hipRise * 0.4 }, { x: 540, y: BENCH_Y + 2 - hipRise * 0.4 });
  const A = lerp({ x: 500, y: FLOOR - 20 }, { x: 665, y: FLOOR - 20 });
  return { S, H, K, A, head: { x: S.x - 46, y: S.y - 4 }, toe: { x: A.x + 22, y: FLOOR }, heel: { x: A.x - 8, y: FLOOR }, elbow: E, hand: W };
}

/* ---------- shared drawing ---------- */
function backdrop(ctx, x, y, col) {
  const g = ctx.createRadialGradient(x, y, 10, x, y, 440);
  g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, DEMO_W, DEMO_H);
}
function floorLine(ctx, y) { ctx.strokeStyle = '#1e2638'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(DEMO_W, y); ctx.stroke(); }
function body(ctx, P, w) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#262f44';
  const limb = (pts, lw) => { ctx.lineWidth = lw; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); };
  limb([P.S, P.H], w.torso * 1.4); limb([P.H, P.K], w.thigh * 1.4); limb([P.K, P.A], w.shin * 1.4); limb([P.heel, P.toe], 16); limb([P.S, P.elbow, P.hand], 22);
  ctx.fillStyle = '#262f44'; ctx.beginPath(); ctx.arc(P.head.x, P.head.y, 30, 0, 7); ctx.fill();
}
// Pixel-space pose → 33 MediaPipe-style landmarks (far side hidden, like a real side-on camera).
function toPxLandmarks(P) {
  const c = (p, v = 1) => ({ x: p.x, y: p.y, v });
  const px = Array.from({ length: 33 }, () => c(P.H, 0.1));
  px[0] = c(P.head); px[7] = c(P.head);
  px[11] = c(P.S); px[13] = c(P.elbow); px[15] = c(P.hand);
  px[23] = c(P.H); px[25] = c(P.K); px[27] = c(P.A); px[29] = c(P.heel); px[31] = c(P.toe);
  for (const [n, f] of [[11, 12], [13, 14], [15, 16], [23, 24], [25, 26], [27, 28], [29, 30], [31, 32], [7, 8]]) px[f] = { ...px[n], v: 0.3 };
  return px;
}

// Walking demo (treadmill, side-on) — real landmarks for the gait analyser.
export class WalkDemo {
  constructor() { this.t0 = null; }
  frame(now) { if (this.t0 == null) this.t0 = now; this.px = simulateWalker((now - this.t0) / 1000, { w: DEMO_W, h: DEMO_H }); return this.px; }
  drawScene(ctx) {
    const px = this.px; if (!px) return;
    const g = ctx.createRadialGradient(330, 560, 10, 330, 560, 420);
    g.addColorStop(0, 'rgba(69,195,255,.14)'); g.addColorStop(1, 'rgba(69,195,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, DEMO_W, DEMO_H);
    // treadmill belt
    const beltY = Math.max(px[29].y, px[30].y, px[31].y, px[32].y) + 6;
    ctx.fillStyle = '#161c2b'; ctx.beginPath(); ctx.roundRect?.(90, beltY, 520, 22, 11); ctx.fill();
    ctx.strokeStyle = '#262f44'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const limb = (ids, w) => { ctx.lineWidth = w; ctx.beginPath(); ids.forEach((i, k) => k ? ctx.lineTo(px[i].x, px[i].y) : ctx.moveTo(px[i].x, px[i].y)); ctx.stroke(); };
    limb([12, 14, 16], 20); limb([24, 26, 28, 32], 36); limb([11, 23], 56); limb([23, 25, 27, 31], 40); limb([11, 13, 15], 22);
    ctx.fillStyle = '#262f44'; ctx.beginPath(); ctx.arc(px[0].x - 6, px[0].y, 30, 0, 7); ctx.fill();
  }
}
