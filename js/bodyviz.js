// Particle body: the one bold visual in the app. A standing figure made of glowing particles (ion blue),
// with one region lit in ember for the joint being worked on. It assembles once when shown, then drifts.
// Respects prefers-reduced-motion (draws one still frame) and pauses when off-screen or the tab is hidden.
// Pure canvas, no assets, works offline.

// Figure in a 100 × 200 box, front view. Each segment is a capsule [x1, y1, x2, y2, radius].
const SEG = {
  head: [[50, 16, 50, 16, 9]],
  neck: [[50, 26, 50, 33, 3.5]],
  torso: [[50, 36, 50, 70, 13], [38, 38, 62, 38, 6]],
  lowerBack: [[50, 70, 50, 86, 11.5]],
  hipL: [[44, 88, 44, 92, 7]], hipR: [[56, 88, 56, 92, 7]],
  upperArmL: [[36, 39, 30, 66, 4.6]], upperArmR: [[64, 39, 70, 66, 4.6]],
  forearmL: [[30, 68, 27, 94, 3.8]], forearmR: [[70, 68, 73, 94, 3.8]],
  handL: [[26.5, 98, 26.5, 101, 3]], handR: [[73.5, 98, 73.5, 101, 3]],
  thighL: [[44, 94, 42, 134, 6.6]], thighR: [[56, 94, 58, 134, 6.6]],
  shinL: [[42, 140, 41, 178, 4.8]], shinR: [[58, 140, 59, 178, 4.8]],
  footL: [[41, 184, 36, 188, 3]], footR: [[59, 184, 64, 188, 3]],
};
// Joint centres that can glow. Left/right are the person's own sides (front view: their left is on screen right).
const JOINT = {
  head: [50, 16], neck: [50, 30], shoulderL: [64, 39], shoulderR: [36, 39], elbowL: [70, 67], elbowR: [30, 67],
  lowerBack: [50, 80], hipL: [56, 92], hipR: [44, 92], thighL: [58, 114], thighR: [42, 114],
  kneeL: [58, 137], kneeR: [42, 137], shinL: [59, 160], shinR: [41, 160], ankleL: [60, 182], ankleR: [40, 182],
};

/** Which joint to light for a rehab area and side ('L' | 'R' | null). */
export function focusFor(area, side) {
  const s = side === 'R' ? 'R' : 'L';
  return ({ Knee: 'knee', Shoulder: 'shoulder', Elbow: 'elbow', Hip: 'hip', Thigh: 'thigh', 'Ankle & foot': 'ankle', Shin: 'shin' })[area]
    ? ({ Knee: 'knee', Shoulder: 'shoulder', Elbow: 'elbow', Hip: 'hip', Thigh: 'thigh', 'Ankle & foot': 'ankle', Shin: 'shin' })[area] + s
    : ({ 'Lower back': 'lowerBack', Neck: 'neck' })[area] || null;
}

// Deterministic random so the figure looks the same every time it assembles.
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function buildPoints(count) {
  const r = rng(7), segs = [];
  for (const [name, list] of Object.entries(SEG)) for (const sg of list) {
    const [x1, y1, x2, y2, rad] = sg, len = Math.hypot(x2 - x1, y2 - y1);
    // The figure is symmetric, so segment sides don't matter for drawing; JOINT decides which side glows.
    segs.push({ name, x1, y1, x2, y2, rad, area: (len + rad * 2) * rad });
  }
  const total = segs.reduce((s, g) => s + g.area, 0), pts = [];
  for (const g of segs) {
    const n = Math.max(6, Math.round(count * g.area / total));
    for (let i = 0; i < n; i++) {
      const t = r(), a = r() * Math.PI * 2, d = Math.sqrt(r()) * g.rad;
      // Denser near the surface: a body "shell" reads better than a filled blob.
      const shell = r() < 0.55 ? g.rad * (0.82 + r() * 0.18) : d;
      pts.push({ x: g.x1 + (g.x2 - g.x1) * t + Math.cos(a) * shell, y: g.y1 + (g.y2 - g.y1) * t + Math.sin(a) * shell * 0.9,
        seg: g.name, s: 0.6 + r() * 1.4, ph: r() * Math.PI * 2, sx: (r() - 0.5) * 220, sy: (r() - 0.5) * 300 });
    }
  }
  return pts;
}

const ION = [90, 180, 255], EMBER = [255, 122, 46];

/**
 * Mount on a <canvas>. opts: { focus: joint name | null, intensity: 0–1 (how strongly the focus glows) }.
 * Returns { update(opts), destroy() }.
 */
export function mountBody(canvas, opts = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { update() {}, destroy() {} };
  const reduce = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const pts = buildPoints(2600);
  let focus = opts.focus || null, intensity = opts.intensity ?? 0.8, raf = 0, start = 0, visible = true, dead = false;
  let W = 0, H = 0, dpr = 1;

  const size = () => {
    dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    const b = canvas.getBoundingClientRect(); W = b.width; H = b.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const frame = now => {
    if (dead) return;
    if (!start) start = now;
    const t = (now - start) / 1000, settle = reduce ? 1 : Math.min(1, t / 1.6), ease = 1 - Math.pow(1 - settle, 3);
    const scale = Math.min(W / 100, H / 200) * 0.94, ox = (W - 100 * scale) / 2, oy = (H - 200 * scale) / 2;
    const [fx, fy] = focus && JOINT[focus] ? JOINT[focus] : [null, null];
    ctx.clearRect(0, 0, W, H);
    // Soft ember halo behind the focus joint.
    if (fx != null) {
      const hx = ox + fx * scale, hy = oy + fy * scale, pulse = reduce ? 1 : 0.85 + 0.15 * Math.sin(t * 2.2);
      const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, 34 * scale * 0.5 * pulse + 18);
      g.addColorStop(0, `rgba(255,122,46,${0.42 * intensity * ease})`); g.addColorStop(1, 'rgba(255,122,46,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const p of pts) {
      const drift = reduce ? 0 : 0.6;
      const x = p.x + Math.sin(t * 0.7 + p.ph) * drift, y = p.y + Math.cos(t * 0.5 + p.ph) * drift;
      const px = ox + (x + p.sx * (1 - ease)) * scale, py = oy + (y + p.sy * (1 - ease)) * scale;
      let heat = 0;
      if (fx != null) { const d = Math.hypot(p.x - fx, p.y - fy); heat = Math.max(0, 1 - d / 13) * intensity; }
      const c = heat > 0 ? ION.map((v, i) => Math.round(v + (EMBER[i] - v) * Math.min(1, heat * 1.4))) : ION;
      const tw = reduce ? 0.8 : 0.55 + 0.45 * Math.sin(t * 1.8 + p.ph * 3);
      const a = (0.38 + 0.55 * tw + heat * 0.4) * ease;
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${Math.min(1, a)})`;
      const r = p.s * (1 + heat * 0.9) * Math.max(0.75, scale / 2.8);
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    if (!reduce && visible) raf = requestAnimationFrame(frame);
  };

  const io = globalThis.IntersectionObserver ? new IntersectionObserver(es => {
    visible = es.some(e => e.isIntersecting);
    cancelAnimationFrame(raf);
    if (visible) raf = requestAnimationFrame(frame);
  }) : null;
  const onVis = () => { cancelAnimationFrame(raf); if (!document.hidden && visible) raf = requestAnimationFrame(frame); };
  const ro = globalThis.ResizeObserver ? new ResizeObserver(() => { size(); if (reduce) frame(performance.now()); }) : null;

  size(); io?.observe(canvas); ro?.observe(canvas); document.addEventListener('visibilitychange', onVis);
  raf = requestAnimationFrame(frame);
  return {
    update(o = {}) { if ('focus' in o) focus = o.focus; if ('intensity' in o) intensity = o.intensity; if (reduce) frame(performance.now()); },
    destroy() { dead = true; cancelAnimationFrame(raf); io?.disconnect(); ro?.disconnect(); document.removeEventListener('visibilitychange', onVis); },
  };
}

export const JOINTS = Object.keys(JOINT);
