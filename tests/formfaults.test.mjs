// Drives the squat and bench demo athletes (real landmark geometry) through the real rep engine
// and feedback coach, and checks each scripted fault is detected and cued, then praised when fixed.
// Run: node tests/formfaults.test.mjs
import { SquatDemo, BenchDemo } from '../js/demo.js';
import { RepEngine } from '../js/exercises.js';
import { exFor } from '../js/library.js';
import { FeedbackCoach } from '../js/feedback.js';
import { Smoother, viewOf } from '../js/angles.js';

let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };

function run(libId, Demo) {
  const ex = exFor(libId), demo = new Demo(), sm = new Smoother(0.55), fb = new FeedbackCoach();
  let eng = null; const reps = [], said = [];
  for (let t = 0; t < 60000 && !demo.done; t += 1000 / 30) {
    const px = demo.frame(t);
    eng ||= new RepEngine(ex, ex.view === 'either' ? viewOf(px) : ex.view);
    const raw = ex.metrics(px, eng.view), m = { ...raw };
    for (const k of ['knee', 'hip', 'elbow', 'torsoLean', 'heelLift', 'shY', 'hipY']) if (raw[k] != null) m[k] = sm.push(k, raw[k]);
    for (const ev of eng.update(m, t)) {
      if (ev.type === 'rep') reps.push(ev.faults.map(f => f.id));
      const l = ev.type === 'rep' ? fb.onRep(ev) : fb.onContinuousFault(ev.faults[0]);
      if (l) said.push(`rep ${eng.reps}: ${l.text}`);
    }
  }
  return { eng, reps, said };
}

const sq = run('squat', SquatDemo);
console.log('squat reps:', JSON.stringify(sq.reps)); sq.said.forEach(x => console.log('  ' + x));
check('squat: 8 reps counted', sq.eng.reps === 8, `${sq.eng.reps}`);
check('squat: hips shooting up detected on reps 1–2', sq.reps[0]?.includes('sq_hips_first') && sq.reps[1]?.includes('sq_hips_first'));
check('squat: heels lifting detected on reps 5–6', sq.reps[4]?.includes('sq_heels') && sq.reps[5]?.includes('sq_heels'));
check('squat: clean reps have no faults', [2, 3, 6, 7].every(i => sq.reps[i]?.length === 0), JSON.stringify([2, 3, 6, 7].map(i => sq.reps[i])));
check('squat: cues "lead with your chest", then praises the fix', sq.said.some(x => x.includes('Lead with your chest')) && sq.said.some(x => x.includes('chest and hips together')));
check('squat: cues heels, then praises the fix', sq.said.some(x => x.includes('through your heels')) && sq.said.some(x => x.includes('Heels down')));

const bp = run('benchPress', BenchDemo);
console.log('bench reps:', JSON.stringify(bp.reps)); bp.said.forEach(x => console.log('  ' + x));
check('bench: 8 reps counted', bp.eng.reps === 8, `${bp.eng.reps}`);
check('bench: shoulders rolling off the bench detected on reps 1–2', bp.reps[0]?.includes('bp_scap') && bp.reps[1]?.includes('bp_scap'));
check('bench: no leg drive detected on reps 4–5', bp.reps[3]?.includes('bp_legs') && bp.reps[4]?.includes('bp_legs'));
check('bench: hips off the bench detected on rep 7', bp.reps[6]?.includes('bp_butt'));
check('bench: clean reps have no faults', [2, 5, 7].every(i => bp.reps[i]?.length === 0), JSON.stringify([2, 5, 7].map(i => bp.reps[i])));
check('bench: cues shoulder blades and leg drive', bp.said.some(x => x.includes('shoulder blades')) && bp.said.some(x => x.includes('drive them into the floor')));

// Rules limited with `only` must not fire on machines where they don't apply.
const lp = new RepEngine(exFor('legPress'), 'side');
check('leg press: heel/hips-first rules are switched off', !lp.rules(exFor('legPress').bottom).some(r => r.id === 'sq_heels') && !lp.rules(exFor('legPress').ascent).length);
const dec = new RepEngine(exFor('declinePress'), 'side');
check('decline press: leg-drive rule off (feet are hooked), scapula rule on', !dec.rules(exFor('declinePress').bottom).some(r => r.id === 'bp_legs') && dec.rules(exFor('declinePress').top).some(r => r.id === 'bp_scap'));

console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
