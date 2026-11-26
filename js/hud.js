// The "it's watching you" layer: graphics that make the live tracking visible, so the lifter feels
// a coach's eyes on them. All canvas, drawn on top of the skeleton, so it is also burned into recordings.
//  - Lock-on: when the body is first found (or found again), a scan line sweeps head to feet and each
//    joint snaps on with a ring, then "Locked on · 33 points".
//  - Tracking frame: corner brackets that follow the body and breathe softly while it is tracked.
//  - Rep read: at the end of every rep a ripple runs up the joints (QK checking the rep), then the rep
//    number pops above the head, green if clean, red if not, with the clean streak ("3 in a row").
//  - Rewards: a milestone (100 clean reps, a perfect set) bursts confetti around the lifter with the
//    reward's name, so the moment is felt, not just logged.
// Cheap on purpose: a few arcs and lines per frame, no allocations in the hot path beyond small arrays.
import { tag } from './fx.js';

const C = { good: '#5CC394', bad: '#E46E66', aim: '#9FD0B6' };
const LOCK_MS = 1100, REP_MS = 1300, LOST_MS = 1500, PARTY_MS = 2800;
const CONFETTI = ['#5CC394', '#9FD0B6', '#E5A84C', '#F2D06B', '#ffffff', '#7FB8E6'];
const JOINTS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 31, 32];
const easeOut = x => 1 - Math.pow(1 - x, 3);

export class TrackHUD {
  constructor() { this.reset(); }
  reset() { this.lockT = null; this.lastSeen = -1e9; this.pops = []; this.streak = 0; this.best = 0; this.box = null; this.fpsT = []; this.party = null; }

  /** A reward moment: confetti and a badge with `title` (and a smaller `sub` line). */
  celebrate(t, title, sub = '') {
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const bits = Array.from({ length: 70 }, () => ({ a: -Math.PI / 2 + (rnd() - 0.5) * 2.6, v: 0.5 + rnd() * 0.9, c: CONFETTI[Math.floor(rnd() * CONFETTI.length)], s: 0.5 + rnd() * 0.8, spin: (rnd() - 0.5) * 12 }));
    this.party = { t0: t, title, sub, bits };
  }
  get locked() { return this.lockT != null; }

  /** A finished rep. Returns the clean streak so the app can praise milestones. */
  rep(t, n, clean) {
    this.streak = clean ? this.streak + 1 : 0; this.best = Math.max(this.best, this.streak);
    this.pops.push({ t0: t, n, clean, streak: this.streak });
    return this.streak;
  }

  /** Frames per second over the last second, for the LIVE chip. */
  fps() { return this.fpsT.length > 1 ? Math.round((this.fpsT.length - 1) * 1000 / (this.fpsT[this.fpsT.length - 1] - this.fpsT[0])) : 0; }
  points(px) { let n = 0; for (const p of px) if (p.v >= 0.5) n++; return n; }

  /**
   * @param px pixel landmarks, s bestSide(px), t ms, o { mirror, seen } (seen: confident enough to coach)
   * Returns 'lock' on the frame the body is locked on (for a haptic tick), else null.
   */
  draw(ctx, px, s, t, o = {}) {
    this.fpsT.push(t); while (this.fpsT.length > 2 && t - this.fpsT[0] > 1000) this.fpsT.shift();
    let ev = null;
    if (!o.seen) { if (t - this.lastSeen > LOST_MS) this.lockT = null; return null; }
    if (this.lockT == null || t - this.lastSeen > LOST_MS) { this.lockT = t; ev = 'lock'; }
    this.lastSeen = t;

    // Body box from the visible joints, eased so the brackets glide instead of jittering.
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const i of JOINTS) { const p = px[i]; if (p.v < 0.5) continue; if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; }
    if (x1 < x0) return ev;
    // At least ~half as wide as tall, so a side-on lifter still gets a proper frame.
    const pad = Math.max(18, (y1 - y0) * 0.08), half = Math.max((x1 - x0) / 2 + pad, (y1 - y0) * 0.28), cx = (x0 + x1) / 2;
    const nb = [cx - half, y0 - pad * 1.6, cx + half, y1 + pad];
    const b = this.box = this.box && !ev ? this.box.map((v, i) => v + (nb[i] - v) * 0.25) : nb;
    const u = Math.max(ctx.canvas.width / 60, (b[3] - b[1]) / 32); // readable on a phone at any camera resolution

    ctx.save(); ctx.lineCap = 'round';
    const lk = (t - this.lockT) / LOCK_MS;
    if (lk < 1) this.lockOn(ctx, px, b, u, lk, o);
    this.brackets(ctx, b, u, t, lk);
    this.repRead(ctx, px, s, b, u, t, o);
    if (this.party) this.drawParty(ctx, b, u, t, o);
    ctx.restore();
    return ev;
  }

  lockOn(ctx, px, b, u, k, o) {
    const y = b[1] + (b[3] - b[1]) * easeOut(Math.min(1, k * 1.4));
    // Scan line with a soft trailing glow.
    const g = ctx.createLinearGradient(0, y - u * 6, 0, y);
    g.addColorStop(0, 'rgba(159,208,182,0)'); g.addColorStop(1, 'rgba(159,208,182,.28)');
    ctx.fillStyle = g; ctx.fillRect(b[0], Math.max(b[1], y - u * 6), b[2] - b[0], Math.min(u * 6, y - b[1]));
    ctx.strokeStyle = C.aim; ctx.lineWidth = u * 0.22; ctx.shadowColor = C.aim; ctx.shadowBlur = u;
    ctx.beginPath(); ctx.moveTo(b[0], y); ctx.lineTo(b[2], y); ctx.stroke(); ctx.shadowBlur = 0;
    // Each joint snaps on as the line passes it.
    for (const i of JOINTS) {
      const p = px[i]; if (p.v < 0.5 || p.y > y) continue;
      const q = Math.min(1, (y - p.y) / (u * 8));
      ctx.globalAlpha = 1 - q * 0.6; ctx.strokeStyle = C.aim; ctx.lineWidth = u * 0.18;
      ctx.beginPath(); ctx.arc(p.x, p.y, u * (2.2 - q * 1.2), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = k < 0.8 ? 1 : (1 - k) / 0.2;
    if (k > 0.35) tag(ctx, { x: (b[0] + b[2]) / 2 - u * 6, y: b[1] - u * 1.5 }, `Locked on · ${this.points(px)} points`, C.aim, u * 1.1, o);
    ctx.globalAlpha = 1;
  }

  brackets(ctx, b, u, t, lk) {
    const L = Math.min(b[2] - b[0], b[3] - b[1]) * 0.16, breathe = 0.55 + 0.25 * Math.sin(t / 420);
    ctx.globalAlpha = lk < 1 ? Math.min(1, lk * 2) : breathe;
    ctx.strokeStyle = C.aim; ctx.lineWidth = u * 0.26;
    ctx.beginPath();
    for (const [x, y, dx, dy] of [[b[0], b[1], 1, 1], [b[2], b[1], -1, 1], [b[0], b[3], 1, -1], [b[2], b[3], -1, -1]]) {
      ctx.moveTo(x + dx * L, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * L);
    }
    ctx.stroke(); ctx.globalAlpha = 1;
  }

  repRead(ctx, px, s, b, u, t, o) {
    this.pops = this.pops.filter(p => t - p.t0 < REP_MS);
    for (const p of this.pops) {
      const k = (t - p.t0) / REP_MS, col = p.clean ? C.good : C.bad;
      // Ripple: joints light up from the feet to the head over the first 40% (QK reading the rep).
      const r = Math.min(1, k / 0.4), yy = b[3] - (b[3] - b[1]) * r;
      for (const i of JOINTS) {
        const q = px[i]; if (q.v < 0.5 || q.y < yy) continue;
        const d = Math.max(0, 1 - (q.y - yy) / (u * 10));
        if (d <= 0) continue;
        ctx.globalAlpha = d; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(q.x, q.y, u * 0.75, 0, Math.PI * 2); ctx.fill();
      }
      // The rep number pops above the head and floats up.
      const a = k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1, sc = k < 0.15 ? 0.6 + easeOut(k / 0.15) * 0.6 : 1.2 - Math.min(0.2, (k - 0.15));
      const head = px[0].v >= 0.5 ? px[0] : { x: (b[0] + b[2]) / 2, y: b[1] };
      const x = head.x, y = Math.max(u * 5, head.y - u * 5 - k * u * 4), fs = u * 5.5 * sc;
      ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(x, y); if (o.mirror) ctx.scale(-1, 1);
      ctx.font = `900 ${fs}px "Archivo", "Arial Narrow", system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = fs * 0.12; ctx.strokeStyle = 'rgba(11,19,17,.85)'; ctx.strokeText(String(p.n), 0, 0);
      ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = u * 1.5; ctx.fillText(String(p.n), 0, 0);
      ctx.restore();
      if (p.streak >= 2 && k > 0.12) { ctx.globalAlpha = Math.max(0, a); tag(ctx, { x: x - u * 4, y: y + u * 4.2 }, `${p.streak} clean in a row`, C.good, u * 1.1, o); }
      ctx.globalAlpha = 1;
    }
  }
}

TrackHUD.prototype.drawParty = function (ctx, b, u, t, o) {
  const p = this.party, k = (t - p.t0) / PARTY_MS;
  if (k >= 1) { this.party = null; return; }
  const cx = (b[0] + b[2]) / 2, cy = b[1] + (b[3] - b[1]) * 0.25, R = (b[3] - b[1]) * 0.9;
  // Confetti bursts out from the chest and falls.
  for (const q of p.bits) {
    const d = easeOut(Math.min(1, k * 1.6)) * R * q.v, x = cx + Math.cos(q.a) * d, y = cy + Math.sin(q.a) * d + k * k * R * 0.9;
    ctx.save(); ctx.globalAlpha = k < 0.7 ? 1 : (1 - k) / 0.3; ctx.translate(x, y); ctx.rotate(q.spin * k);
    ctx.fillStyle = q.c; ctx.fillRect(-u * 0.45 * q.s, -u * 0.2 * q.s, u * 0.9 * q.s, u * 0.4 * q.s); ctx.restore();
  }
  // Badge: a ring that draws itself, with the reward's name.
  const a = k < 0.1 ? k / 0.1 : k > 0.8 ? (1 - k) / 0.2 : 1, by = Math.max(u * 9, b[1] - u * 2);
  ctx.save(); ctx.globalAlpha = Math.max(0, a);
  ctx.strokeStyle = '#F2D06B'; ctx.lineWidth = u * 0.5; ctx.shadowColor = '#F2D06B'; ctx.shadowBlur = u * 2;
  ctx.beginPath(); ctx.arc(cx, by - u * 4, u * 3, -Math.PI / 2, -Math.PI / 2 + easeOut(Math.min(1, k * 3)) * Math.PI * 2); ctx.stroke();
  ctx.shadowBlur = 0; ctx.translate(cx, by - u * 4); if (o.mirror) ctx.scale(-1, 1);
  ctx.fillStyle = '#F2D06B'; ctx.font = `900 ${u * 3}px "Archivo", system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('★', 0, u * 0.2);
  ctx.restore();
  ctx.globalAlpha = Math.max(0, a);
  tag(ctx, { x: cx - u * 7, y: by + u * 0.6 }, p.title, '#F2D06B', u * 1.5, o);
  if (p.sub) tag(ctx, { x: cx - u * 6, y: by + u * 3.4 }, p.sub, C.good, u * 1.1, o);
  ctx.globalAlpha = 1;
};
