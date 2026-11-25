// "Map my body": checks the calibration measures a simulated person correctly, and that the
// personal thresholds change the verdict for bodies the textbook numbers would misjudge.
// Run: node tests/bodymap.test.mjs
import { BodyMapDemo, BODYMAP_SECS, squatPose, AVG_BODY } from '../js/demo.js';
import { analyseBodyMap, personalFor, explainBodyMap, fitLines } from '../js/bodymap.js';
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
check('measures elbows that don\'t fully straighten (~168°)', Math.abs(b.elbowStraight - 168) <= 3, b.elbowStraight);
check('measures overhead reach (~150°)', Math.abs(b.shoulderFlex - 150) <= 5, b.shoulderFlex);
check('measures tight hamstrings in the hinge (~98°)', Math.abs(b.hingeMin - 98) <= 4, b.hingeMin);
check('measures toe rise for calf raises', b.calfLift > 0.3, b.calfLift);
check('measures shoulder abduction facing the camera', b.shoulderAbd > 140, b.shoulderAbd);
check('front view: knee width standing and at the bottom', b.kneeRatioStand > 0.9 && b.kneeRatioBottom < b.kneeRatioStand, `${b.kneeRatioStand} → ${b.kneeRatioBottom}`);
const P = personalFor('squat', b);
console.log(P);
check('lean allowance raised for their proportions', P.sqLean > 50, P.sqLean);
check('depth judged against their range', P.sqDepth === b.kneeMin + 10 || P.sqDepth === 105, P.sqDepth);
check('flags tight ankles', P.tightAnkles);
const ex = explainBodyMap(b);
ex.forEach(x => console.log(`  • ${x.title}: ${x.detail}`));
check('explains in plain words, with fixes', ex.some(x => /Long thighs/.test(x.title)) && ex.some(x => x.fix));
check('a 98° hinge is reported as tight hamstrings', ex.some(x => x.title === 'Tight hamstrings'));

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

// 3. Every movement, not just squats: same reps, textbook vs their body map (metric streams).
function stream(pattern, libEx, Pers, seq, extra = {}) {
  const eng = new RepEngine(libEx, libEx.view === 'either' ? 'side' : libEx.view, Pers); const faults = new Set(); let t = 0;
  for (const [from, to] of seq) for (let i = 0; i <= 60; i++) {
    const v = from + (to - from) * (0.5 - 0.5 * Math.cos(Math.PI * i / 60));
    for (const ev of eng.update({ [libEx.primary]: v, knee: 170, hip: 170, elbow: 170, torsoLean: 5, ...extra, [libEx.primary]: v }, t += 33)) ev.faults.forEach(f => faults.add(f.id));
  }
  return { reps: eng.reps, faults: [...faults] };
}
const reps = (top, bottom, n = 3) => Array.from({ length: n }, () => [[top, bottom], [bottom, top]]).flat().concat([[top, top]]);
// RDL, tight hamstrings: hinges to 112°. Textbook never asks for depth; deeper hinge cue only exists with a body map.
const rdlP = personalFor('rdl', b), rdlShallow = stream('rdl', EXERCISES.rdl, rdlP, reps(175, 124));
check('RDL: a hinge short of THEIR range (124° vs their 98°) is counted and cued "hips back"', rdlShallow.reps === 3 && rdlShallow.faults.includes('rdl_short'), JSON.stringify(rdlShallow));
const rdlGood = stream('rdl', EXERCISES.rdl, rdlP, reps(175, 112));
check('RDL: hinging to their range is clean', rdlGood.reps === 3 && !rdlGood.faults.length, JSON.stringify(rdlGood));
check('RDL: textbook limits would not count the 124° hinge at all', stream('rdl', EXERCISES.rdl, null, reps(175, 124)).reps === 0);
// Bench, short arms: bar reaches the chest at 110° of elbow bend.
const bpP = personalFor('bench', b);
check('bench: short arms → textbook limits never count their full reps', stream('bench', EXERCISES.bench, null, reps(175, 110), { feetUp: false, knee: 90 }).reps === 0);
const bpMe = stream('bench', EXERCISES.bench, bpP, reps(175, 110), { feetUp: false, knee: 90 });
check('bench: their body map counts them, clean', bpMe.reps === 3 && !bpMe.faults.length, JSON.stringify(bpMe));
// Overhead press, elbows that only straighten to 158°.
const stiff = { ...b, elbowStraight: 158 }, prP = personalFor('press', stiff);
const prText = stream('press', EXERCISES.press, null, reps(156, 80), { wristDiff: 0 }), prMe = stream('press', EXERCISES.press, prP, reps(156, 80), { wristDiff: 0 });
check('press: textbook says "lock out" to someone whose elbows can\'t straighten further', prText.faults.includes('pr_lockout'), JSON.stringify(prText));
check('press: their body map accepts their full lockout', prMe.reps === 3 && !prMe.faults.includes('pr_lockout'), JSON.stringify(prMe));
check('press: still cued if they stop well short of THEIR lockout', stream('press', EXERCISES.press, prP, reps(144, 80), { wristDiff: 0 }).faults.includes('pr_lockout'));
// Every camera pattern has a personal profile (except fly and crunch, where nothing measured changes what's correct).
const pats = [...new Set(Object.values(EXERCISES).map((_, i) => Object.keys(EXERCISES)[i]))];
const none = pats.filter(k => !personalFor(k, b));
check('every pattern gets personal limits except fly and crunch', none.sort().join() === 'fly,torsoCurl', none.join());
check('setup sheet explains what changed, in words', fitLines('rdl', b).some(l => /hamstrings/.test(l)) && fitLines('press', b).some(l => /overhead reach/.test(l)));

console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
