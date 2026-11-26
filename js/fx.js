// Motion graphics drawn on the lifter's body during a set.
// When QK cues a fault, a short animated graphic shows WHAT to change, anchored to the joints
// involved, so it moves with the body: arrows pushing the knees out, the heel pressing into the
// floor, the chest leading the hips, the shoulder blades pinning to the bench.
// Graphics show the target (external focus, like the spoken cue), not the error.
// Each lasts ~2.4 s. A clean rep gets a short green ring; a fixed fault gets a green check.
import { dist, mid } from './angles.js';

const DUR = 2400;
const C = { bad: '#E46E66', good: '#5CC394', aim: '#9FD0B6', ink: 'rgba(11,19,17,.82)', z2: '#5FB39D' };
const easeOut = x => 1 - Math.pow(1 - x, 3);

export class FormFX {
  constructor() { this.fx = []; }
  reset() { this.fx = []; }
  /** A cued fault: show its corrective graphic. */
  cue(rule, t) { if (!rule) return; this.fx = this.fx.filter(f => f.id !== rule.id); this.fx.push({ id: rule.id, tag: rule.tag, kind: 'cue', t0: t }); }
  /** A fault that was cued earlier and is now fixed. */
  fixed(rule, t) { if (rule) this.fx.push({ id: rule.id, tag: rule.tag, kind: 'fixed', t0: t }); }
  clean(t) { this.fx.push({ id: 'clean', kind: 'clean', t0: t }); }

  /**
   * @param ctx canvas 2D context
   * @param px pixel landmarks for this frame
   * @param s  bestSide(px) for this frame
   * @param t  timestamp (ms)
   * @param o  { mirror } — text is un-mirrored when the selfie view flips the canvas
   */
  draw(ctx, px, s, t, o = {}) {
    this.fx = this.fx.filter(f => t - f.t0 < DUR);
    const u = Math.max(8, dist(s.sh, s.hip) / 6); // body-relative unit (~1/6 torso)
    for (const f of this.fx) {
      const k = (t - f.t0) / DUR;
      const a = k < 0.12 ? k / 0.12 : k > 0.82 ? (1 - k) / 0.18 : 1; // fade in / out
      ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (f.kind === 'clean') drawClean(ctx, s, u, k, o);
      else if (f.kind === 'fixed') drawFixed(ctx, anchorOf(f.id, px, s), u, k, f.tag, o);
      else (GFX[f.id] || generic)(ctx, px, s, u, k, f, o);
      ctx.restore();
    }
  }
}

/* ---------- primitives ---------- */
function arrow(ctx, from, to, color, w, glow = true) {
  const ang = Math.atan2(to.y - from.y, to.x - from.x), h = w * 3.2;
  if (glow) { ctx.shadowColor = color; ctx.shadowBlur = w * 3; }
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x - Math.cos(ang) * h * 0.6, to.y - Math.sin(ang) * h * 0.6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - Math.cos(ang - 0.5) * h, to.y - Math.sin(ang - 0.5) * h);
  ctx.lineTo(to.x - Math.cos(ang + 0.5) * h, to.y - Math.sin(ang + 0.5) * h);
  ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
}
// An arrow that slides along its direction in a loop, so it reads as "move this way".
function slideArrow(ctx, at, dx, dy, len, color, w, k) {
  const n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n, off = ((k * 3) % 1) * len * 0.35;
  arrow(ctx, { x: at.x + ux * off, y: at.y + uy * off }, { x: at.x + ux * (off + len), y: at.y + uy * (off + len) }, color, w);
}
function pulse(ctx, p, r, color, k) {
  const q = (k * 2.5) % 1;
  ctx.strokeStyle = color; ctx.lineWidth = r * 0.18;
  ctx.globalAlpha *= 1 - q; ctx.beginPath(); ctx.arc(p.x, p.y, r * (0.6 + q * 0.9), 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha /= Math.max(0.01, 1 - q);
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.32, 0, Math.PI * 2); ctx.fill();
}
function dashed(ctx, a, b, color, w) {
  ctx.save(); ctx.setLineDash([w * 2.2, w * 2]); ctx.lineDashOffset = -performance.now() / 30;
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore();
}
// Label pill. Drawn un-mirrored when the canvas is mirrored for the selfie camera.
export function tag(ctx, p, text, color, u, o) {
  if (!text) return;
  const fs = Math.max(13, u * 0.9);
  ctx.save();
  ctx.font = `800 ${fs}px "Archivo", "Arial Narrow", system-ui, sans-serif`;
  const label = text.toUpperCase(), w = ctx.measureText(label).width + fs * 1.2, h = fs * 1.7;
  ctx.translate(p.x, p.y); if (o.mirror) ctx.scale(-1, 1);
  const W = ctx.canvas.width;
  // keep the pill on screen
  let x = 0; const sx = o.mirror ? W - p.x : p.x; if (sx + w > W - 4) x = W - 4 - w - sx; if (sx + x < 4) x = 4 - sx;
  ctx.fillStyle = C.ink; ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, -h / 2, w, h, h / 2) : ctx.rect(x, -h / 2, w, h); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(label, x + fs * 0.6, 1);
  ctx.restore();
}
const pt = (p, dx = 0, dy = 0) => ({ x: p.x + dx, y: p.y + dy });
// Which way is "forward" (the direction the toes point) on a side-on view.
const fwd = s => (s.ft && s.he ? Math.sign(s.ft.x - s.he.x) : Math.sign(s.kn.x - s.hip.x)) || 1;

/* ---------- per-fault graphics ---------- */
const GFX = {
  // Front view: arrows push each knee outward, dashed lines show hip → knee → ankle tracking.
  sq_valgus(ctx, px, s, u, k, f, o) {
    const L = [px[23], px[25], px[27]], R = [px[24], px[26], px[28]];
    const midX = (px[23].x + px[24].x) / 2;
    for (const [hip, kn, an] of [L, R]) {
      const out = Math.sign(kn.x - midX) || 1;
      dashed(ctx, hip, pt(an, out * u * 0.4), C.aim, u * 0.18);
      pulse(ctx, kn, u * 0.9, C.bad, k);
      slideArrow(ctx, pt(kn, out * u * 0.6), out, 0, u * 1.6, C.good, u * 0.3, k);
    }
    tag(ctx, pt(mid(px[25], px[26]), -u * 1.5, -u * 2.2), f.tag, C.good, u, o);
  },
  // Heel pulses, arrow presses down into the floor, floor line under the whole foot.
  sq_heels(ctx, px, s, u, k, f, o) {
    const floor = Math.max(s.he.y, s.ft.y) + u * 0.3;
    dashed(ctx, { x: Math.min(s.he.x, s.ft.x) - u, y: floor }, { x: Math.max(s.he.x, s.ft.x) + u, y: floor }, C.aim, u * 0.2);
    pulse(ctx, s.he, u * 0.9, C.bad, k);
    slideArrow(ctx, pt(s.he, 0, -u * 2.6), 0, 1, u * 1.8, C.good, u * 0.32, k);
    tag(ctx, pt(s.he, -fwd(s) * u * 4, -u * 3), f.tag, C.good, u, o);
  },
  // Ghost line shows the torso angle to aim for; an arrow lifts the chest back towards it.
  sq_chest(ctx, px, s, u, k, f, o) {
    const len = dist(s.hip, s.sh), dir = fwd(s), aim = 35 * Math.PI / 180;
    const target = { x: s.hip.x + dir * Math.sin(aim) * len, y: s.hip.y - Math.cos(aim) * len };
    dashed(ctx, s.hip, target, C.aim, u * 0.22);
    pulse(ctx, s.sh, u * 0.8, C.bad, k);
    arcArrow(ctx, s.hip, len * 1.05, s.sh, target, C.good, u * 0.3, k);
    tag(ctx, pt(target, dir * u, -u * 1.2), f.tag, C.good, u, o);
  },
  // Two upward arrows: the chest arrow leads, the hip arrow is short. "Chest first."
  sq_hips_first(ctx, px, s, u, k, f, o) {
    const grow = easeOut(Math.min(1, k * 2.2));
    pulse(ctx, s.hip, u * 0.8, C.bad, k);
    const lift = ((k * 2) % 1) * u * 0.6;
    arrow(ctx, pt(s.sh, 0, -lift), pt(s.sh, 0, -lift - u * 3.2 * grow - 1), C.good, u * 0.34);
    arrow(ctx, pt(s.hip, 0, -lift * 0.4), pt(s.hip, 0, -lift * 0.4 - u * 1.2 * grow - 1), C.aim, u * 0.24);
    dashed(ctx, s.sh, s.hip, C.good, u * 0.16);
    tag(ctx, pt(s.sh, fwd(s) * u * 1.2, -u * 4.2), f.tag, C.good, u, o);
  },
  // Target line at knee height: the hip crease goes below it.
  sq_depth(ctx, px, s, u, k, f, o) {
    const y = s.kn.y + u * 0.3;
    dashed(ctx, { x: s.hip.x - u * 3, y }, { x: s.kn.x + u * 2, y }, C.aim, u * 0.2);
    slideArrow(ctx, pt(s.hip, -fwd(s) * u * 1.6, -u * 1.4), 0, 1, u * 1.6, C.good, u * 0.3, k);
    tag(ctx, pt(s.hip, -fwd(s) * u * 5, -u * 1.5), f.tag, C.good, u, o);
  },
  sq_lockout: (ctx, px, s, u, k, f, o) => up(ctx, s.hip, u, k, f, o),
  // Shoulder blades: arrow drives the shoulder down into the bench, brackets squeeze together.
  bp_scap(ctx, px, s, u, k, f, o) {
    pulse(ctx, s.sh, u * 0.9, C.bad, k);
    slideArrow(ctx, pt(s.sh, 0, -u * 2.4), 0, 1, u * 1.6, C.good, u * 0.32, k);
    const dir = Math.sign(s.hip.x - s.sh.x) || 1, sq = Math.sin(k * Math.PI * 6) * u * 0.25;
    arrow(ctx, pt(s.sh, -dir * (u * 2.4 + sq), u * 0.9), pt(s.sh, -dir * u * 0.9, u * 0.9), C.aim, u * 0.22, false);
    arrow(ctx, pt(s.sh, dir * (u * 2.4 + sq), u * 0.9), pt(s.sh, dir * u * 0.9, u * 0.9), C.aim, u * 0.22, false);
    tag(ctx, pt(s.sh, -dir * u * 3, -u * 3.2), f.tag, C.good, u, o);
  },
  // Feet: arrows drive down into the floor; a dashed guide shows the foot under the knee.
  bp_legs(ctx, px, s, u, k, f, o) {
    const floor = Math.max(s.an.y, s.ft?.y || 0) + u * 0.4;
    const under = { x: s.kn.x, y: floor };
    dashed(ctx, s.kn, under, C.aim, u * 0.2);
    pulse(ctx, under, u * 0.8, C.aim, k);
    pulse(ctx, s.an, u * 0.8, C.bad, k);
    slideArrow(ctx, pt(s.an, 0, -u * 2.6), 0, 1, u * 1.8, C.good, u * 0.32, k);
    tag(ctx, pt(s.kn, 0, -u * 2.6), f.tag, C.good, u, o);
  },
  bp_butt(ctx, px, s, u, k, f, o) {
    pulse(ctx, s.hip, u * 0.9, C.bad, k);
    slideArrow(ctx, pt(s.hip, 0, -u * 2.6), 0, 1, u * 1.8, C.good, u * 0.32, k);
    tag(ctx, pt(s.hip, 0, -u * 3.6), f.tag, C.good, u, o);
  },
  bp_depth(ctx, px, s, u, k, f, o) {
    const chest = pt(s.sh, Math.sign(s.hip.x - s.sh.x) * u * 0.8, -u * 0.6);
    pulse(ctx, chest, u * 0.8, C.aim, k);
    slideArrow(ctx, pt(s.wr, 0, -u * 0.4), chest.x - s.wr.x, chest.y - s.wr.y, Math.min(u * 2, dist(s.wr, chest) * 0.7), C.good, u * 0.3, k);
    tag(ctx, pt(s.wr, 0, -u * 2), f.tag, C.good, u, o);
  },
  bp_lockout: (ctx, px, s, u, k, f, o) => up(ctx, s.wr, u, k, f, o),
};

function up(ctx, p, u, k, f, o) {
  pulse(ctx, p, u * 0.8, C.bad, k);
  slideArrow(ctx, pt(p, 0, -u * 0.8), 0, -1, u * 1.8, C.good, u * 0.32, k);
  tag(ctx, pt(p, u * 1.2, -u * 3.4), f.tag, C.good, u, o);
}

// Curved arrow around `c` from p1's direction to p2's direction.
function arcArrow(ctx, c, r, p1, p2, color, w, k) {
  let a1 = Math.atan2(p1.y - c.y, p1.x - c.x), a2 = Math.atan2(p2.y - c.y, p2.x - c.x);
  let d = a2 - a1; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  const e = a1 + d * easeOut(Math.min(1, ((k * 1.6) % 1) * 1.3));
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.shadowColor = color; ctx.shadowBlur = w * 3;
  ctx.beginPath(); ctx.arc(c.x, c.y, r, a1, e, d < 0); ctx.stroke(); ctx.shadowBlur = 0;
  const tip = { x: c.x + Math.cos(e) * r, y: c.y + Math.sin(e) * r }, tg = e + Math.sign(d) * 0.25;
  arrow(ctx, { x: c.x + Math.cos(tg - Math.sign(d) * 0.5) * r, y: c.y + Math.sin(tg - Math.sign(d) * 0.5) * r }, tip, color, w, false);
}

function generic(ctx, px, s, u, k, f, o) {
  const p = anchorOf(f.id, px, s);
  pulse(ctx, p, u * 0.9, C.bad, k);
  tag(ctx, pt(p, u * 1.2, -u * 2), f.tag, C.bad, u, o);
}

function anchorOf(id, px, s) {
  if (/heel/.test(id)) return s.he;
  if (/valgus/.test(id)) return mid(px[25], px[26]);
  if (/chest|scap|swing|even/.test(id)) return s.sh;
  if (/legs/.test(id)) return s.an;
  if (/^(bp|pr|vp|row|cu|tri|dip|fly|raise|pu)_/.test(id)) return s.el;
  return s.hip;
}

function drawClean(ctx, s, u, k, o) {
  const q = easeOut(Math.min(1, k * 1.8));
  ctx.strokeStyle = C.good; ctx.lineWidth = u * 0.25 * (1 - q) + 1;
  ctx.shadowColor = C.good; ctx.shadowBlur = u;
  ctx.beginPath(); ctx.arc(s.hip.x, s.hip.y, u * (1.2 + q * 4), 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;
  if (k < 0.6) tag(ctx, pt(s.hip, u * 1.5, -u * 5 - q * u), 'Clean rep', C.good, u, o);
}

function drawFixed(ctx, p, u, k, label, o) {
  const q = easeOut(Math.min(1, k * 2));
  ctx.strokeStyle = C.good; ctx.lineWidth = u * 0.35; ctx.shadowColor = C.good; ctx.shadowBlur = u;
  ctx.beginPath(); ctx.arc(p.x, p.y, u * 1.4, -Math.PI / 2, -Math.PI / 2 + q * Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(p.x - u * 0.6, p.y); ctx.lineTo(p.x - u * 0.1, p.y + u * 0.5 * q); ctx.lineTo(p.x + u * 0.7 * q, p.y - u * 0.55 * q); ctx.stroke();
  ctx.shadowBlur = 0;
  tag(ctx, pt(p, u * 1.8, -u * 1.8), (label ? label + ' ✓' : 'Fixed ✓'), C.good, u, o);
}

/**
 * Live depth gauge: an arc at the working joint that fills as the rep goes deeper and turns
 * green once the target depth is reached. Drawn every frame.
 */
export function drawDepthArc(ctx, joint, a, b, value, { start = 180, target = 100 } = {}) {
  if (!joint || !a || value == null || Number.isNaN(value)) return;
  const u = Math.max(14, dist(a, joint) * 0.32);
  const prog = Math.max(0, Math.min(1, (start - value) / (start - target)));
  const ang1 = Math.atan2(a.y - joint.y, a.x - joint.x), ang2 = Math.atan2(b.y - joint.y, b.x - joint.x);
  let d = ang2 - ang1; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(236,241,236,.18)'; ctx.lineWidth = u * 0.22;
  ctx.beginPath(); ctx.arc(joint.x, joint.y, u, ang1, ang1 + d, d < 0); ctx.stroke();
  const col = prog >= 1 ? C.good : prog > 0.75 ? '#E5A84C' : C.aim;
  ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = prog >= 1 ? u * 0.8 : 0;
  ctx.beginPath(); ctx.arc(joint.x, joint.y, u, ang1, ang1 + d * Math.max(0.02, prog), d < 0); ctx.stroke();
  ctx.restore();
}
