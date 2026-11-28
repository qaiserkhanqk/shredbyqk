// A synthetic athlete for the 3D Lab demo and tests: known 3D angles, "filmed" by two virtual cameras.
// Squats (knee bend 0→100° every 2.5 s); options add knees moving in (valgus) or shoulders twisting over the hips.
export const LM = { nose: 0, lEar: 7, rEar: 8, lSh: 11, rSh: 12, lEl: 13, rEl: 14, lWr: 15, rWr: 16, lHip: 23, rHip: 24, lKn: 25, rKn: 26, lAn: 27, rAn: 28, lFt: 31, rFt: 32 };
const R = d => (d * Math.PI) / 180;

/** World pose (metres; X = athlete's left, Y up, Z forward) at time t, and the true knee bend. */
export function pose(t, { valgus = 0, twist = 0 } = {}) {
  const L = LM, k = 50 + 50 * Math.sin(2 * Math.PI * t / 2.5 - Math.PI / 2);
  const s = R(0.45 * k), th = R(0.45 * k - k), lean = R(0.4 * k), P = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }));
  const leg = (side, an, kn, hp, ft) => {
    const x0 = 0.15 * side, a = { x: x0, y: 0.08, z: 0 };
    const knee = { x: x0 - side * valgus * Math.sin(R(k)) * 0.06, y: a.y + 0.43 * Math.cos(s), z: a.z + 0.43 * Math.sin(s) };
    const hip = { x: 0.11 * side, y: knee.y + 0.43 * Math.cos(th), z: knee.z + 0.43 * Math.sin(th) };
    P[an] = a; P[kn] = knee; P[hp] = hip; P[ft] = { x: x0, y: 0.02, z: 0.15 }; P[ft - 2] = { x: x0, y: 0.03, z: -0.05 };
  };
  leg(1, L.lAn, L.lKn, L.lHip, L.lFt); leg(-1, L.rAn, L.rKn, L.rHip, L.rFt);
  const hip = { x: 0, y: (P[L.lHip].y + P[L.rHip].y) / 2, z: (P[L.lHip].z + P[L.rHip].z) / 2 };
  const sh = { x: 0, y: hip.y + 0.5 * Math.cos(lean), z: hip.z + 0.5 * Math.sin(lean) };
  const rot = R(twist * Math.sin(2 * Math.PI * t / 2.5));
  P[L.lSh] = { x: sh.x + 0.2 * Math.cos(rot), y: sh.y, z: sh.z + 0.2 * Math.sin(rot) };
  P[L.rSh] = { x: sh.x - 0.2 * Math.cos(rot), y: sh.y, z: sh.z - 0.2 * Math.sin(rot) };
  for (const [s1, e, w] of [[L.lSh, L.lEl, L.lWr], [L.rSh, L.rEl, L.rWr]]) { P[e] = { ...P[s1], y: P[s1].y - 0.3, z: P[s1].z + 0.05 }; P[w] = { ...P[e], y: P[e].y - 0.05, z: P[e].z + 0.25 }; }
  const head = { x: 0, y: sh.y + 0.22, z: sh.z + 0.05 };
  P[L.nose] = { ...head, z: head.z + 0.1 }; P[L.lEar] = { ...head, x: 0.07 }; P[L.rEar] = { ...head, x: -0.07 };
  return { P, k };
}

/**
 * Project to a camera. kind: 'side' / 'sideR' (on the athlete's right, sees Z, Y), 'sideL' (on the left, mirrored),
 * 'front' (sees X, Y), 'back' (mirrored). t0: this camera started t0 seconds late.
 * occlude: a side camera can't see the far-side limbs well, so they get extra noise and low visibility.
 */
export function film(kind, { t0 = 0, dur = 6, fps = 30, W, H, ppm, cx = 0.5, cy = 0.55, jitter = 1.5, opts, seed = 7, occlude = false } = {}) {
  let sd = seed; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647 - 0.5);
  const far = i => (kind === 'sideL' ? i >= 12 && i % 2 === 0 : (kind === 'side' || kind === 'sideR') ? i >= 11 && i % 2 === 1 : false);
  const frames = [];
  for (let t = 0; t < dur; t += 1 / fps) {
    const { P } = pose(t, opts);
    frames.push({ t: t - t0, lm: P.map((p, i) => {
      const u = kind === 'sideL' ? -p.z : kind === 'back' ? -p.x : /^side/.test(kind) ? p.z : p.x;
      const hidden = occlude && far(i), j = hidden ? 45 : jitter;
      return { x: cx + (u * ppm + rnd() * j) / W, y: cy - (p.y * ppm + rnd() * j) / H + 0.3, v: hidden ? 0.35 : 0.99 };
    }) });
  }
  return frames;
}

/** Four cameras round the demo athlete, each started at a different moment, far-side limbs partly hidden. */
export const demoVideos4 = (opts = { valgus: 1, twist: 15 }) => [
  { pos: 'sideR', frames: film('sideR', { W: 1920, H: 1080, ppm: 420, opts, occlude: true, seed: 3 }), w: 1920, h: 1080 },
  { pos: 'front', frames: film('front', { W: 1080, H: 1920, ppm: 600, t0: 0.5, opts, seed: 5 }), w: 1080, h: 1920 },
  { pos: 'sideL', frames: film('sideL', { W: 1920, H: 1080, ppm: 380, t0: 1.2, opts, occlude: true, seed: 11 }), w: 1920, h: 1080 },
  { pos: 'back', frames: film('back', { W: 1080, H: 1920, ppm: 560, t0: 0.8, opts, seed: 13 }), w: 1080, h: 1920 },
];

/** Two "videos" of the demo athlete (front camera started 0.5 s late), ready for the Lab. */
export const demoVideos = (opts = { valgus: 1, twist: 15 }) => ({
  side: { frames: film('side', { W: 1920, H: 1080, ppm: 420, opts }), w: 1920, h: 1080 },
  front: { frames: film('front', { W: 1080, H: 1920, ppm: 600, t0: 0.5, opts }), w: 1080, h: 1920 },
});
