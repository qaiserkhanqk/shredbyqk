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
