// "You're moving your body too much": each steadiness check fires when the body moves during the rep,
// and stays quiet on a clean rep. Simulated lifters from tests/synth.mjs run through the real engine.
// Run: node tests/steady.test.mjs
import { frameAt } from './synth.mjs';
import { EXERCISES, RepEngine } from '../js/exercises.js';
import { Smoother, viewOf } from '../js/angles.js';

let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };

let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);
let JITTER = 0;
function run(pattern, move, extra) {
  const ex = EXERCISES[pattern], sm = new Smoother(0.55); let eng; const seen = new Set(); let liveAt = null;
  for (let t = 0; t < 10; t += 1 / 30) {
    const px = frameAt(move, t, { extra }).map(p => ({ ...p, x: p.x + rnd() * JITTER, y: p.y + rnd() * JITTER }));
    eng ||= new RepEngine(ex, ex.view === 'either' ? viewOf(px) : ex.view);
    const raw = ex.metrics(px, eng.view), m = { ...raw };
    for (const k of ['knee', 'hip', 'elbow', 'torsoLean']) if (raw[k] != null) m[k] = sm.push(k, raw[k]);
    for (const ev of eng.update(m, t * 1000)) for (const f of ev.faults) { seen.add(f.id); if (ev.type !== 'rep' && liveAt == null) liveAt = +t.toFixed(1); }
  }
  return { reps: eng.reps, faults: [...seen], liveAt };
}
const bell = k => Math.sin(Math.PI * k); // peaks mid-rep

let r = run('curl', 'curl');
check('curl, body still: counted, no "body still" cue', r.reps >= 3 && !r.faults.includes('cu_body'), JSON.stringify(r));
r = run('curl', 'curl', (t, k) => ({ t: -18 * bell(k) })); // leans back to swing the weight up
check('curl, swinging the body: "Keep your body still" mid-rep', r.faults.includes('cu_body') && r.liveAt != null, JSON.stringify(r));

r = run('row', 'row');
check('row, chest still: no "chest still" cue', !r.faults.includes('row_body'), JSON.stringify(r));
r = run('row', 'row', (t, k) => ({ t: 60 - 25 * k })); // stands up as it pulls
check('row, heaving the torso up: "Keep your chest still"', r.faults.includes('row_body'), JSON.stringify(r));

r = run('raise', 'lateral');
check('lateral raise, still: no sway cue', !r.faults.includes('raise_body'), JSON.stringify(r));

r = run('squat', 'squat');
check('squat, feet planted: no "feet" cue', !r.faults.includes('sq_feet'), JSON.stringify(r));

r = run('squat', 'squat', (t, k) => ({ dx: 45 * k })); // feet slide forward during the rep
check('squat, feet sliding: "Keep your feet planted" mid-rep', r.faults.includes('sq_feet') && r.liveAt != null, JSON.stringify(r));
r = run('squat', 'squatFront');
check('squat facing the camera: reps counted, no shift cue', r.reps >= 3 && !r.faults.includes('sq_shift'), JSON.stringify(r));
r = run('squat', 'squatFront', (t, k) => ({ hx: 40 * k })); // drifts to one side at the bottom
check('squat facing the camera, shifting sideways: "Stay centred"', r.faults.includes('sq_shift'), JSON.stringify(r));

r = run('press', 'press');
check('overhead press, square: no lean cue', !r.faults.includes('pr_lean'), JSON.stringify(r));

// A real camera wobbles: clean reps filmed with ±4 px jitter must not trigger any "moving too much" cue.
JITTER = 8;
const noisy = [['curl', 'curl', 'cu_body'], ['row', 'row', 'row_body'], ['raise', 'lateral', 'raise_body'], ['squat', 'squat', 'sq_feet'], ['squat', 'squatFront', 'sq_shift'], ['press', 'press', 'pr_lean'], ['triExt', 'pushdown', 'tri_body']]
  .map(([pat, mv, id]) => [mv, run(pat, mv)]).filter(([mv, r]) => r.faults.some(f => /_(body|feet|shift|lean)$/.test(f)));
check('with ±4 px camera jitter, clean reps get no "moving too much" cue', !noisy.length, noisy.map(([mv, r]) => mv + ':' + r.faults).join(' '));

console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
