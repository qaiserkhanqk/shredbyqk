// Synthetic lifters for tests only (never shown in the app). Builds MediaPipe-style landmarks from
// segment directions, so any exercise can be simulated side-on or facing the camera.
// Directions are degrees in screen space: 0 = up, 90 = towards the side the lifter faces, 180 = down.

const R = d => d * Math.PI / 180, dir = a => ({ x: Math.sin(R(a)), y: -Math.cos(R(a)) });
const add = (p, a, len) => { const u = dir(a); return { x: p.x + u.x * len, y: p.y + u.y * len }; };
const lerp = (a, b, k) => a + (b - a) * k;
export const L = { thigh: 120, shin: 115, torso: 140, upper: 75, fore: 68, foot: 50, W: 720, H: 600, floor: 560 };

// Side view. k: hip→knee, s: knee→ankle, t: hip→shoulder, u: shoulder→elbow, f: elbow→wrist,
// k2/s2: the far leg (for split stances), heel: 0..1 heel rise.
export function side(q) {
  const H = { x: 0, y: 0 }, K = add(H, q.k, L.thigh), A = add(K, q.s, L.shin);
  const S = add(H, q.t, L.torso), E = add(S, q.u, L.upper), W = add(E, q.f, L.fore), head = add(S, q.t, 34);
  const K2 = q.k2 != null ? add(H, q.k2, L.thigh) : K, A2 = q.s2 != null ? add(K2, q.s2, L.shin) : A;
  const fa = 90 + (q.heel || 0) * 30, heel = add(A, fa + 90 + 60, 16), toe = add(A, fa + 15, L.foot);
  const pts = [H, K, A, S, E, W, head, K2, A2, heel, toe];
  // anchor 'sh': shoulders stay on the floor (bridges); otherwise the lowest point rests on the floor.
  const dy = q.anchor === 'sh' ? L.floor - 20 - S.y : L.floor - Math.max(...pts.map(p => p.y)), dx = L.W / 2 - A.x + (q.dx || 0); // feet stay where they are, like a real lifter (dx: feet slide)
  const c = (p, v = 1) => ({ x: p.x + dx, y: p.y + dy, v });
  const px = Array.from({ length: 33 }, () => c(H, 0.1));
  px[0] = c(head); px[7] = c(head); px[11] = c(S); px[13] = c(E); px[15] = c(W);
  px[23] = c(H); px[25] = c(K); px[27] = c(A); px[29] = c(heel); px[31] = c(toe);
  for (const [n, f] of [[11, 12], [13, 14], [15, 16], [23, 24], [7, 8], [29, 30], [31, 32]]) px[f] = { ...px[n], v: 0.3 };
  const split = q.k2 != null;
  px[26] = c(K2, split ? 0.6 : 0.3); px[28] = c(A2, split ? 0.6 : 0.3);
  return px;
}

// Facing the camera. d: squat depth 0..1, aU/aF: upper arm / forearm angle from straight down
// (0 = down, 90 = out to the side, 180 = up), lift: whole body moved up (px), valgus: knees in at depth.
export function front(q) {
  const cx = L.W / 2, d = q.d || 0, lift = q.lift || 0, hx = q.hx || 0; // hx: hips and shoulders shift sideways
  const ankY = L.floor - 20, kneeY = ankY - L.shin + 8 * d, hipY = ankY - L.shin - L.thigh + 110 * d - lift, shY = hipY - L.torso + 10 * d;
  const c = (x, y) => ({ x, y, v: 1 }), px = Array.from({ length: 33 }, () => c(cx, hipY));
  for (const sg of [-1, 1]) {
    const [sh, el, wr, hp, kn, an, he, ft] = sg < 0 ? [11, 13, 15, 23, 25, 27, 29, 31] : [12, 14, 16, 24, 26, 28, 30, 32];
    const S = { x: cx + hx + sg * 62, y: shY };
    const ua = R(q.aU || 0), fa = R(q.aF ?? q.aU ?? 0);
    const E = { x: S.x + sg * L.upper * Math.sin(ua), y: S.y + L.upper * Math.cos(ua) }, W = { x: E.x + sg * L.fore * Math.sin(fa), y: E.y + L.fore * Math.cos(fa) };
    px[sh] = c(S.x, S.y); px[el] = c(E.x, E.y); px[wr] = c(W.x, W.y);
    px[hp] = c(cx + hx + sg * 38, hipY); px[kn] = c(cx + sg * (46 + (q.knees ?? 8) * d), kneeY); px[an] = c(cx + sg * 46, ankY);
    px[he] = c(cx + sg * 44, L.floor - 4); px[ft] = c(cx + sg * 54, L.floor);
  }
  px[0] = c(cx + hx, shY - 58); px[7] = c(cx + hx - 18, shY - 56); px[8] = c(cx + hx + 18, shY - 56);
  return px;
}

const STAND = { k: 180, s: 180, t: 0, u: 180, f: 180 };
// Each exercise: [view, start pose, end pose]. A rep goes start → end → start.
export const MOVES = {
  squat: ['side', STAND, { k: 100, s: 210, t: 40, u: 90, f: 90 }],
  squatFront: ['front', { d: 0 }, { d: 1 }],
  lunge: ['side', { k: 160, s: 185, k2: 200, s2: 175, t: 0, u: 180, f: 180 }, { k: 95, s: 195, k2: 185, s2: 265, t: 5, u: 180, f: 180 }],
  rdl: ['side', STAND, { k: 170, s: 188, t: 82, u: 180, f: 180 }],
  calf: ['side', { ...STAND, heel: 0 }, { ...STAND, heel: 1 }],
  curl: ['side', STAND, { ...STAND, u: 175, f: 20 }],
  curlFront: ['front', { aU: 5, aF: 5 }, { aU: 5, aF: 150 }],
  pushdown: ['side', { ...STAND, u: 175, f: 95 }, { ...STAND, u: 178, f: 180 }],
  ohTri: ['side', { ...STAND, u: 10, f: 165 }, { ...STAND, u: 5, f: 5 }],
  press: ['front', { aU: 90, aF: 195 }, { aU: 172, aF: 178 }],
  row: ['side', { k: 165, s: 190, t: 60, u: 180, f: 180 }, { k: 165, s: 190, t: 60, u: 262, f: 165 }],
  lateral: ['front', { aU: 10 }, { aU: 92 }],
  frontRaise: ['side', STAND, { ...STAND, u: 92, f: 92 }],
  // Hands stay on the bar: the arms fold as the body rises.
  pullUp: ['front', { aU: 172, aF: 178, lift: 0 }, { aU: 95, aF: 125, lift: 110 }],
  pushUp: ['side', { k: 270, s: 272, t: 82, u: 182, f: 180 }, { k: 270, s: 272, t: 88, u: 215, f: 140 }],
  bench: ['side', { k: 90, s: 175, t: 270, u: 5, f: 2 }, { k: 90, s: 175, t: 270, u: 135, f: 15 }],
  bridge: ['side', { k: 115, s: 200, t: 268, u: 90, f: 90, anchor: 'sh' }, { k: 70, s: 200, t: 250, u: 90, f: 90, anchor: 'sh' }],
  crunch: ['side', { k: 60, s: 200, t: 270, u: 300, f: 300 }, { k: 60, s: 200, t: 300, u: 330, f: 330 }],
  legRaise: ['side', { k: 90, s: 90, t: 270, u: 90, f: 90 }, { k: 0, s: 0, t: 270, u: 90, f: 90 }],
};

/** Landmarks for exercise `name` at time t (s), rep period `per` (s), with an optional hold before. */
export function frameAt(name, t, { per = 2.4, lead = 0.6, extra } = {}) {
  const [view, a, b] = MOVES[name];
  const k = t < lead ? 0 : 0.5 - 0.5 * Math.cos(2 * Math.PI * ((t - lead) / per));
  const q = {}; for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) q[key] = typeof a[key] === 'string' ? a[key] : lerp(a[key] ?? b[key], b[key] ?? a[key], k);
  if (extra) Object.assign(q, extra(t, k));
  return view === 'side' ? side(q) : front(q);
}

/** A still pose (plank etc.). */
export function holdFrame(name) { const [view, a] = MOVES[name] || ['side', name]; return view === 'side' ? side(a) : front(a); }
