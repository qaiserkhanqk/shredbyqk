// Simulates a hip-thrust set frame by frame and prints what the coach would say.
// Run: node tests/simulate.mjs
import { EXERCISES, RepEngine, estimateRIR } from '../js/exercises.js';
import { FeedbackCoach } from '../js/feedback.js';

const ex = EXERCISES.hipThrust, eng = new RepEngine(ex, 'side'), fb = new FeedbackCoach();
let t = 0; const fps = 30, said = [];
// [kneeAtTop, concentricSeconds] per rep: feet too far for 3 reps, fixed, then slowing down.
const plan = [[118, .8], [117, .8], [116, .8], [92, .8], [90, .85], [91, .9], [90, 1.0], [92, 1.15], [90, 1.4], [91, 1.6]];
for (const [kneeTop, con] of plan) {
  const ecc = 1.5, frames = Math.round((ecc + con + 0.6) * fps);
  for (let f = 0; f < frames; f++) {
    const s = f / fps; let hip;
    if (s < ecc) hip = 175 - 65 * (s / ecc);            // lowering
    else if (s < ecc + con) hip = 110 + 65 * ((s - ecc) / con); // lifting
    else hip = 175;                                      // hold at top
    const knee = hip > 160 ? kneeTop : 120;
    const evs = eng.update({ hip, knee, arch: 0 }, t); t += 1000 / fps;
    for (const ev of evs) { const l = ev.type === 'rep' ? fb.onRep(ev) : fb.onContinuousFault(ev.faults[0]); if (l) said.push(`rep ${eng.reps}: ${l.text}`); }
  }
}
said.forEach(x => console.log(x));
console.log({ reps: eng.reps, clean: eng.goodReps, velocityLoss: Math.round(eng.velocityLoss() * 100) + '%', RIR: estimateRIR(eng.velocityLoss()) });
const assert = (c, m) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
assert(eng.reps === 10, 'counts 10 reps');
assert(said[0].includes('Walk your feet back'), 'first rep cues feet');
assert(said.filter(x => x.includes('Walk your feet back')).length <= 2, 'cue is faded, not repeated every rep');
assert(said.some(x => x.includes('Shins vertical')), 'praises the correction');
assert(said.some(x => /slowed right down|getting hard/.test(x)), 'detects fatigue');
console.log('ALL PASS');
