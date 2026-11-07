// Motion tracking: follows one key point through every rep (the bar or the hips) and measures
// range of motion. Two things coaches watch by eye that a camera can measure precisely:
//  - Path drift: how far the tracked point wanders sideways. In squats and deadlifts the bar
//    should travel close to vertically over mid-foot; wandering wastes force and loads the back.
//  - ROM consistency: a rep that is less than ~85% of the set's best range is a partial rep.
import { dist } from './angles.js';

export class MotionTracker {
  constructor(maxPoints = 75) { this.trail = []; this.max = maxPoints; this.repPath = []; this.drifts = []; }
  reset() { this.trail = []; this.repPath = []; this.drifts = []; }

  push(p, scale) {
    if (!p || p.v < 0.5) return;
    this.trail.push({ x: p.x, y: p.y }); if (this.trail.length > this.max) this.trail.shift();
    this.repPath.push({ x: p.x, y: p.y }); this.scale = scale;
  }

  // Close the current rep's path; returns sideways drift as a fraction of torso length.
  endRep() {
    const xs = this.repPath.map(p => p.x);
    const d = xs.length > 4 ? (Math.max(...xs) - Math.min(...xs)) / (this.scale || 1) : 0;
    this.drifts.push(d); this.repPath = [];
    return d;
  }

  draw(ctx) {
    const t = this.trail; if (t.length < 2) return;
    const w = Math.max(3, ctx.canvas.width / 200);
    for (let i = 1; i < t.length; i++) {
      const a = i / t.length;
      ctx.strokeStyle = `rgba(${Math.round(69 + a * 186)}, ${Math.round(195 - a * 88)}, ${Math.round(255 - a * 181)}, ${a * 0.9})`;
      ctx.lineWidth = w * (0.4 + a); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(t[i - 1].x, t[i - 1].y); ctx.lineTo(t[i].x, t[i].y); ctx.stroke();
    }
    const e = t[t.length - 1];
    ctx.fillStyle = '#ff6b4a'; ctx.beginPath(); ctx.arc(e.x, e.y, w * 1.8, 0, 7); ctx.fill();
  }
}

export function romSummary(roms) {
  if (!roms.length) return { best: 0, partial: 0, cv: 0 };
  const v = roms.map(r => r.rom), best = Math.max(...v), m = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length);
  return { best, partial: v.filter(x => x < best * 0.85).length, cv: m ? sd / m : 0 };
}

export const torsoLen = px => dist({ x: (px[11].x + px[12].x) / 2, y: (px[11].y + px[12].y) / 2 }, { x: (px[23].x + px[24].x) / 2, y: (px[23].y + px[24].y) / 2 });
