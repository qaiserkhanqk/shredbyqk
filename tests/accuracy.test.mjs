// Camera accuracy: per-joint gating, front-view screening flags, adaptive smoothing, setup check,
// "Was QK right?" labels and the accuracy maths. Uses the real demo athletes through the real rep engine.
import { SquatDemo } from '../js/demo.js';
import { RepEngine } from '../js/exercises.js';
import { exFor } from '../js/library.js';
import { Smoother, OneEuro, viewOf, jointVisibility, VIS_MIN } from '../js/angles.js';
import { makeLabel, saveLabel, accuracy, needsTuning, setupCheck } from '../js/accuracy.js';
import { romSummary } from '../js/motion.js';

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };

// Drive the squat demo; hide = (t) => true makes the knee/ankle on both sides blurry for that frame.
function run({ filter = 'euro', hide = () => false } = {}) {
  const ex = exFor('squat'), demo = new SquatDemo(), sm = filter === 'euro' ? new OneEuro() : new Smoother(0.55);
  let eng = null; const reps = [];
  for (let t = 0; t < 60000 && !demo.done; t += 1000 / 30) {
    let px = demo.frame(t);
    if (hide(t)) px = px.map((p, i) => ([25, 26, 27, 28].includes(i) ? { ...p, v: 0.2 } : p));
    eng ||= new RepEngine(ex, ex.view === 'either' ? viewOf(px) : ex.view);
    const raw = ex.metrics(px, eng.view), m = { ...raw };
    for (const k of ['knee', 'hip', 'elbow', 'torsoLean', 'heelLift', 'shY', 'hipY']) if (raw[k] != null) m[k] = sm.push(k, raw[k], t);
    m.unsure = jointVisibility(px, ex.primary, eng.view) < VIS_MIN;
    for (const ev of eng.update(m, t)) if (ev.type === 'rep') reps.push(ev);
  }
  return { eng, reps };
}

const base = run({ filter: 'ema' }), euro = run();
check('adaptive filter: same 8 reps as the old smoothing', euro.eng.reps === 8 && base.eng.reps === 8, `${euro.eng.reps}/${base.eng.reps}`);
check('adaptive filter: same faults found on the scripted reps', JSON.stringify(euro.reps.map(r => r.faults.map(f => f.id).sort())) === JSON.stringify(base.reps.map(r => r.faults.map(f => f.id).sort())),
  JSON.stringify([euro.reps.map(r => r.faults.map(f => f.id)), base.reps.map(r => r.faults.map(f => f.id))]));

// One Euro: steady when still (jitter shrinks), follows fast movement with little lag.
{
  const f = new OneEuro(); let out = [], raw = [];
  for (let i = 0; i < 90; i++) { const v = 100 + (i % 2 ? 2 : -2); raw.push(v); out.push(f.push('k', v, i * 33)); }
  const sd = a => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); };
  check('One Euro: jitter at rest is cut by more than half', sd(out.slice(30)) < sd(raw.slice(30)) / 2, `${sd(out.slice(30)).toFixed(2)} vs ${sd(raw.slice(30)).toFixed(2)}`);
  const g = new OneEuro(), e = new Smoother(0.55); let lagE = 0, lagG = 0;
  for (let i = 0; i < 30; i++) { const v = 180 - i * 4; const a = g.push('k', v, i * 33), b = e.push('k', v); if (i === 29) { lagG = a - v; lagE = b - v; } }
  check('One Euro: lag on a fast squat descent no worse than the old smoothing', lagG <= lagE + 0.5, `${lagG.toFixed(1)} vs ${lagE.toFixed(1)}`);
}

// Per-joint gate: blur the knees for the whole of reps 5–6 (the heel-lift reps): still counted, not judged.
const secondsOf = r => r; // reps 5–6 of the demo happen roughly between 24 and 36 s
const hidden = run({ hide: t => t > 24000 && t < 36000 });
check('gate: every rep still counted when joints blur', hidden.eng.reps === 8, hidden.eng.reps);
check('gate: blurred reps are marked unclear, not faulty', hidden.reps.some(r => r.unsure) && hidden.reps.filter(r => r.unsure).every(r => !r.faults.length), JSON.stringify(hidden.reps.map(r => [r.unsure, r.faults.map(f => f.id)])));
check('gate: unclear reps never count as clean', hidden.eng.goodReps + hidden.eng.unsureReps + hidden.reps.filter(r => !r.unsure && r.faults.length).length === 8);
check('visibility: front view needs both knees, side view the clearer side', jointVisibility(Array.from({ length: 33 }, (_, i) => ({ v: [24, 26, 28].includes(i) ? 0.1 : 0.9 })), 'knee', 'front') === 0.1
  && jointVisibility(Array.from({ length: 33 }, (_, i) => ({ v: [24, 26, 28].includes(i) ? 0.1 : 0.9 })), 'knee', 'side') === 0.9);

// Front-view knee cave is a screening flag: reported as a check, never as a fault.
{
  const ex = exFor('squat'), rule = [...ex.bottom].find(r => r.id === 'sq_valgus');
  check('knee cave: marked as a screening check (front-view angles are not valid measurements)', rule?.screen === true);
  check('knee cave: judged against their own standing knee gap', rule.test({ kneeGap: 60, ankleGap: 100 }, { base: { kneeGap: 85, ankleGap: 100 } }) === true && rule.test({ kneeGap: 60, ankleGap: 100 }, { base: { kneeGap: 70, ankleGap: 100 } }) === false);
}

// Partial reps: a whole set of half reps is caught against their usual range.
check('partial reps: half reps caught against the lifter\'s usual range', romSummary([{ rom: 50 }, { rom: 52 }, { rom: 51 }], 100).partial === 3 && romSummary([{ rom: 50 }, { rom: 52 }, { rom: 51 }]).partial === 0);

// Setup check before a set.
const P = (y0, y1, x = 500) => Array.from({ length: 33 }, (_, i) => ({ x, y: i === 0 ? y0 : [27, 28].includes(i) ? y1 : (y0 + y1) / 2, v: 1 }));
check('setup: good placement passes', setupCheck({ px: P(100, 900), w: 1000, h: 1000, view: 'side', wantView: 'side', fps: 30 }).ok);
check('setup: feet cut off → move the phone back', setupCheck({ px: P(100, 995), w: 1000, h: 1000, view: 'side', wantView: 'side', fps: 30 }).issues[0].id === 'frame');
check('setup: too far away', setupCheck({ px: P(400, 650), w: 1000, h: 1000, view: 'side', wantView: 'side', fps: 30 }).issues.some(i => i.id === 'far'));
check('setup: wrong view and slow camera', (() => { const r = setupCheck({ px: P(100, 900), w: 1000, h: 1000, view: 'front', wantView: 'side', fps: 12 }); return r.issues.map(i => i.id).join() === 'view,fps'; })());

// Labels and accuracy.
const S = {};
saveLabel(S, makeLabel({ at: 1, ex: 'squat', counted: 8, verdict: 'right', cue: 'sq_depth' }));
saveLabel(S, makeLabel({ at: 2, ex: 'squat', counted: 8, reps: 9, verdict: 'count' }));
saveLabel(S, makeLabel({ at: 3, ex: 'bench', counted: 10, verdict: 'cue', cue: 'bp_legs' }));
saveLabel(S, makeLabel({ at: 3, ex: 'bench', counted: 10, verdict: 'right', cue: 'bp_legs' }));
check('labels: one per set (a changed answer replaces it)', S.labels.length === 3 && S.labels[2].verdict === 'right');
const a = accuracy(S.labels);
check('accuracy: exact counts and within one', a.countExact === 67 && a.countWithin1 === 100, JSON.stringify(a));
check('accuracy: cues confirmed', a.cueRight === 100);
const many = Array.from({ length: 10 }, (_, i) => makeLabel({ at: i, ex: 'squat', counted: 8, cue: 'sq_valgus', verdict: i < 4 ? 'cue' : 'right' }));
check('accuracy: a cue called wrong 40% of 10 sets is flagged to retune', needsTuning(accuracy(many)).map(c => c.id).join() === 'sq_valgus');
check('accuracy: nothing answered → no numbers', accuracy([]) === null);

if (fail) { console.log(`\n${fail} failed`); process.exit(1); }
console.log('\naccuracy: all passed');
