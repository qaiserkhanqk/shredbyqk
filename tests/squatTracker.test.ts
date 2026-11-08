// Synthetic squats with known answers. Run: node tests/squatTracker.test.ts
import { SquatTracker, angleAt } from '../src/squatTracker.ts';
import type { Landmark } from '../src/squatTracker.ts';

const FPS = 30, LT = 0.2, LS = 0.19;
let seed = 7; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());

/** Pose for a given knee angle. view 'side' = camera sees the left leg; 'front' = facing camera. caveFrac pulls knees inward. */
function pose(kneeDeg: number, view: 'side' | 'front', caveFrac = 0, noise = 0): Landmark[] {
  const f = ((180 - kneeDeg) * Math.PI) / 180, psi = 0.4 * f, phi = 0.6 * f;
  const lm: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.2 }));
  const set = (i: number, x: number, y: number, v = 0.99) => { lm[i] = { x: x + noise * gauss(), y: y + noise * gauss(), z: 0, visibility: v }; };
  if (view === 'side') {
    const ank = { x: 0.5, y: 0.9 }, kn = { x: ank.x + LS * Math.sin(psi), y: ank.y - LS * Math.cos(psi) };
    const hip = { x: kn.x - LT * Math.sin(phi), y: kn.y - LT * Math.cos(phi) };
    const sh = { x: hip.x + 0.25 * Math.sin(0.5 * f), y: hip.y - 0.25 * Math.cos(0.5 * f) };
    for (const [l, r, p] of [[11, 12, sh], [23, 24, hip], [25, 26, kn], [27, 28, ank]] as const) { set(l, p.x, p.y); set(r, p.x + 0.005, p.y, 0.3); }
  } else {
    const ankY = 0.9, knY = ankY - LS * Math.cos(psi), hipY = knY - LT * Math.cos(phi), shY = hipY - 0.25;
    const depth = (180 - kneeDeg) / 100; // 0 standing → ~1 deep
    const cave = caveFrac * depth * 0.06;
    set(27, 0.42, ankY); set(28, 0.58, ankY);
    set(25, 0.42 + cave, knY); set(26, 0.58 - cave, knY);
    set(23, 0.45, hipY); set(24, 0.55, hipY); set(11, 0.40, shY); set(12, 0.60, shY);
  }
  return lm;
}

/** Run N reps down to `bottom` degrees and return the tracker's completed reps. */
function run(opts: { reps: number; bottom: number; view: 'side' | 'front'; cave?: number; noise?: number; world?: boolean }) {
  const t = new SquatTracker({ imageAspect: 1 }); const done: any[] = []; let ms = 0;
  const frame = (k: number) => {
    const lm = pose(k, opts.view, opts.cave, opts.noise ?? 0);
    const r = t.update(lm, ms, opts.world ? lm.map(p => ({ ...p })) : undefined); ms += 1000 / FPS;
    if (r.repCompleted) done.push(r.repCompleted);
  };
  for (let i = 0; i < 20; i++) frame(178); // stand: calibration
  for (let rep = 0; rep < opts.reps; rep++) {
    const seg = (a: number, b: number, s: number) => { const n = Math.round(s * FPS); for (let i = 1; i <= n; i++) frame(a + (b - a) * (0.5 - 0.5 * Math.cos(Math.PI * i / n))); };
    seg(178, opts.bottom, 1.2); seg(opts.bottom, opts.bottom, 0.2); seg(opts.bottom, 178, 1.0); seg(178, 178, 0.6);
  }
  return done;
}

let fails = 0;
const check = (name: string, ok: boolean, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };

check('angleAt: right angle = 90°', Math.abs(angleAt({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }) - 90) < 1e-9);
check('angleAt: straight line = 180°', Math.abs(angleAt({ x: 0, y: 2, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 }) - 180) < 1e-6);
check('angleAt: degenerate → NaN', Number.isNaN(angleAt({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 })));

let r = run({ reps: 3, bottom: 80, view: 'side' });
check('side, deep: counts 3 reps', r.length === 3, `got ${r.length}`);
check('side, deep: depth OK every rep', r.every(x => x.depthOk === true), r.map(x => x.minKneeAngle).join(','));
check('side: valgus not assessed (null)', r.every(x => x.valgus === null));
check('side: tempo measured', r.every(x => x.eccentricMs > 1000 && x.eccentricMs < 1500 && x.concentricMs > 600 && x.concentricMs < 1200), r.map(x => `${x.eccentricMs}/${x.concentricMs}`).join(' '));

r = run({ reps: 2, bottom: 112, view: 'side' });
check('side, shallow: counted but flagged', r.length === 2 && r.every(x => x.depthOk === false), r.map(x => x.minKneeAngle).join(','));

r = run({ reps: 3, bottom: 150, view: 'side' });
check('side, quarter dip: not a rep', r.length === 0, `got ${r.length}`);

r = run({ reps: 5, bottom: 82, view: 'side', noise: 0.004 });
check('side, noisy landmarks: still exactly 5 reps', r.length === 5, `got ${r.length}`);

r = run({ reps: 3, bottom: 85, view: 'front' });
check('front, no cave: counts 3 reps (foreshortening angle)', r.length === 3, `got ${r.length}, min ${r.map(x => x.minKneeAngle)}`);
check('front, no cave: valgus false', r.every(x => x.valgus === false), r.map(x => x.minKneeToAnkleRatio).join(','));
check('front: depth not judged without world landmarks', r.every(x => x.depthOk === null));

r = run({ reps: 3, bottom: 85, view: 'front', cave: 1 });
check('front, knees cave: valgus true', r.length === 3 && r.every(x => x.valgus === true), r.map(x => x.minKneeToAnkleRatio).join(','));

r = run({ reps: 3, bottom: 85, view: 'front', cave: 1, noise: 0.003 });
check('front, cave + noise: valgus still detected', r.length === 3 && r.every(x => x.valgus === true), `reps ${r.length}`);

r = run({ reps: 2, bottom: 88, view: 'side', world: true });
check('world landmarks: depth judged', r.length === 2 && r.every(x => x.depthOk === true));

// Robustness: 20 different noise patterns must all give exact counts and the right valgus verdict.
let robust = 0;
for (let k = 1; k <= 20; k++) {
  seed = 1000 + k * 7919;
  const a = run({ reps: 4, bottom: 84, view: 'side', noise: 0.004 });
  const b = run({ reps: 4, bottom: 86, view: 'front', cave: 1, noise: 0.003 });
  const c2 = run({ reps: 4, bottom: 86, view: 'front', cave: 0, noise: 0.003 });
  if (a.length === 4 && b.length === 4 && b.every(x => x.valgus) && c2.length === 4 && c2.every(x => x.valgus === false)) robust++;
}
check('20 noise seeds: exact reps + correct valgus every time', robust === 20, `${robust}/20`);

const t = new SquatTracker(); const blind = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.1 }));
check('low visibility: frame rejected, no crash', t.update(blind, 0).tracking === false);

console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
