// "Map my body": checks the calibration measures a simulated person correctly, and that the
// personal thresholds change the verdict for bodies the textbook numbers would misjudge.
// Run: node tests/bodymap.test.mjs
import { BodyMapDemo, BODYMAP_SECS, squatPose, AVG_BODY } from '../js/demo.js';
import { analyseBodyMap, personalThresholds, explainBodyMap } from '../js/bodymap.js';
import { EXERCISES, RepEngine } from '../js/exercises.js';
import { Smoother, bestSide } from '../js/angles.js';

let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };

// 1. Calibration on a long-thigh, tight-ankle lifter whose knees drift in.
const demo = new BodyMapDemo(), frames = [];
for (let t = 0; t <= BODYMAP_SECS * 1000; t += 1000 / 30) frames.push({ t, px: demo.frame(t) });
const b = analyseBodyMap(frames);
console.log(b);
check('body map succeeds', b.ok, b.issues.join(' '));
check('measures long thighs (femur/torso > 1)', b.femurTorso > 1.0, b.femurTorso);
check('finds 3 squats side-on', b.reps === 3, b.reps);
check('measures limited depth (knee ~ 116° at bottom)', Math.abs(b.kneeMin - 116) <= 4, b.kneeMin);
check('measures tight ankles (shin ~ 22°) and heel rise', Math.abs(b.shinAtDepth - 22) <= 3 && b.heelRise > 0.2, `${b.shinAtDepth}°, heel ${b.heelRise}`);
check('front view: knee width standing and at the bottom', b.kneeRatioStand > 0.9 && b.kneeRatioBottom < b.kneeRatioStand, `${b.kneeRatioStand} → ${b.kneeRatioBottom}`);
const P = personalThresholds(b);
console.log(P);
check('lean allowance raised for their proportions', P.sqLean > 50, P.sqLean);
check('depth judged against their range', P.sqDepth === b.kneeMin + 10 || P.sqDepth === 105, P.sqDepth);
check('flags tight ankles', P.tightAnkles);
const ex = explainBodyMap(b);
ex.forEach(x => console.log(`  • ${x.title}: ${x.detail}`));
check('explains in plain words, with fixes', ex.some(x => /Long thighs/.test(x.title)) && ex.some(x => x.fix));

// 2. Same squat, two verdicts: a set by a long-thigh lifter who leans 54° at the bottom.
function runSet(Pers, body, leanDeg) {
  const exd = EXERCISES.squat, eng = new RepEngine(exd, 'side', Pers), sm = new Smoother(0.55); const faults = new Set();
  for (let rep = 0; rep < 4; rep++) for (let f = 0; f < 120; f++) {
    const d = Math.sin(Math.PI * f / 110) ** 2 * (f < 110 ? 1 : 0);
    const px = toPx(squatPose(d, false, 0, { ...body, leanDeg }));
    const raw = exd.metrics(px, 'side'), m = { ...raw };
    for (const k of ['knee', 'hip', 'torsoLean', 'heelLift']) if (raw[k] != null) m[k] = sm.push(k, raw[k]);
    for (const ev of eng.update(m, (rep * 120 + f) * 33)) ev.faults.forEach(x => faults.add(x.id));
  }
  last = eng.reps; return [...faults];
}
let last = 0;
function toPx(Q) {
  const c = p => ({ x: p.x, y: p.y, v: 1 }), px = Array.from({ length: 33 }, () => ({ ...c(Q.H), v: 0.1 }));
  px[0] = c(Q.head); px[7] = c(Q.head); px[11] = c(Q.S); px[13] = c(Q.elbow); px[15] = c(Q.hand);
  px[23] = c(Q.H); px[25] = c(Q.K); px[27] = c(Q.A); px[29] = c(Q.heel); px[31] = c(Q.toe);
  for (const [n, f] of [[11, 12], [13, 14], [15, 16], [23, 24], [25, 26], [27, 28], [29, 30], [31, 32], [7, 8]]) px[f] = { ...px[n], v: 0.3 };
  return px;
}
const LONG = { foot: 62, shin: 124, thigh: 150, torso: 138, shinDeg: 22, thighDeg: 42 };
const generic = runSet(null, LONG, 54), genericReps = last, personal = runSet(P, LONG, 54), personalReps = last;
console.log({ generic, personal });
check('textbook thresholds: this lifter\'s best squat never even counts as a rep', genericReps === 0, `${genericReps} reps`);
check('their body map counts every rep', personalReps === 4, `${personalReps} reps`);
check('their body map accepts the same squat', !personal.includes('sq_chest') && !personal.includes('sq_depth'), personal.join(','));
const worse = runSet(P, { ...LONG, thighDeg: 26 }, 54);
check('…but still cues them when they cut depth short of THEIR range', worse.includes('sq_depth'), worse.join(','));
const leaning = runSet(P, LONG, 66);
check('…and still cues them when they lean past THEIR limit', leaning.includes('sq_chest'), leaning.join(','));
const avg = runSet(null, AVG_BODY, 38);
check('an average lifter squatting well gets no cues with defaults', avg.length === 0, avg.join(','));

console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
