// NSCA-based rules: each fires on the mistake NSCA names and stays quiet on a clean rep.
// Simulated lifters (tests/synth.mjs) run through the real engine with the real library flags.
// Run: node tests/nsca.test.mjs
import { MOVES, frameAt } from './synth.mjs';
import { RepEngine, SOURCES, allRules, EXERCISES } from '../js/exercises.js';
import { exFor } from '../js/library.js';
import { Smoother, viewOf } from '../js/angles.js';

let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };

const STAND = { k: 180, s: 180, t: 0, u: 180, f: 180 };
Object.assign(MOVES, {
  // Bottom poses found by search so the bar (wrists) sits over mid-foot, like a real hinge: hips go back.
  deadlift: ['side', STAND, { k: 116, s: 186, t: 55, u: 180, f: 180 }],
  rdlSoft: ['side', { ...STAND, k: 172, s: 186 }, { k: 144, s: 162, t: 80, u: 180, f: 180 }],
  rdlLocked: ['side', STAND, { k: 180, s: 180, t: 80, u: 180, f: 180 }],
  frontSquat: ['side', { ...STAND, u: 85, f: 30 }, { k: 100, s: 210, t: 30, u: 75, f: 30 }],
  benchSide: MOVES.bench,
});
const ascent = (t) => (((t - 0.6) / 2.4) % 1) > 0.5;

let seed = 5; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);
let JITTER = 0;
function run(id, move, extra) {
  const ex = exFor(id), sm = new Smoother(0.55); let eng; const seen = new Set();
  for (let t = 0; t < 10; t += 1 / 30) {
    const px = frameAt(move, t, { extra }).map(p => ({ ...p, x: p.x + rnd() * JITTER, y: p.y + rnd() * JITTER }));
    eng ||= new RepEngine(ex, ex.view === 'either' ? viewOf(px) : ex.view);
    const raw = ex.metrics(px, eng.view), m = { ...raw };
    for (const k of ['knee', 'hip', 'elbow', 'torsoLean']) if (raw[k] != null) m[k] = sm.push(k, raw[k]);
    for (const ev of eng.update(m, t * 1000)) for (const f of ev.faults) seen.add(f.id);
  }
  return { reps: eng.reps, faults: [...seen] };
}
const pair = (label, id, move, bad, rule) => {
  const ok = run(id, move), ko = run(id, move, bad);
  check(`${label}: clean reps counted, no "${rule}"`, ok.reps >= 3 && !ok.faults.includes(rule), JSON.stringify(ok));
  check(`${label}: the mistake is caught ("${rule}")`, ko.faults.includes(rule), JSON.stringify(ko));
};

pair('Deadlift, hips rise before the chest', 'deadlift', 'deadlift', (t, k) => (ascent(t) ? { t: 55 * Math.max(k, Math.min(1, k + 0.5 * Math.sin(Math.PI * k))) } : {}), 'dl_hips_first');
pair('Deadlift, bar drifts away from the legs', 'deadlift', 'deadlift', (t, k) => ({ u: 180 - 50 * k, f: 180 - 50 * k }), 'rdl_bar');
pair('Deadlift, arms bend', 'deadlift', 'deadlift', (t, k) => ({ f: 180 - 50 * k }), 'rdl_arms');
pair('Romanian deadlift, knees locked', 'rdl', 'rdlSoft', (t, k) => ({ k: 180, s: 180 }), 'rdl_locked');
pair('Front squat, elbows drop', 'frontSquat', 'frontSquat', (t, k) => ({ u: 75 + 95 * k, f: 30 + 120 * k }), 'fsq_elbows');
pair('Lunge, stride too short', 'lunge', 'lunge', (t, k) => ({ k2: 178, s2: 178 + 10 * k }) /* back foot almost under the hips */, 'lu_stride');
pair('Bench press, head lifts off the bench', 'benchPress', 'bench', (t, k) => ({ headUp: 40 * k }), 'bp_head');
pair('Overhead press, wrists not over elbows', 'press', 'press', (t, k) => ({ aF: 195 + 30 * (1 - k) }), 'pr_stack');
pair('Bent-over row, torso too upright', 'bentRow', 'row', (t, k) => ({ t: 30 }), 'row_angle');
pair('Push-up, hands not under the shoulders', 'pushUp', 'pushUp', (t, k) => ({ u: 130 + 85 * k }) /* hands well in front of the shoulders */, 'pu_hands');

// A wobbly camera (±4 px) must not set off the new rules on clean reps.
JITTER = 8;
const NEW = ['dl_hips_first', 'rdl_bar', 'rdl_arms', 'rdl_locked', 'fsq_elbows', 'lu_stride', 'bp_head', 'pr_stack', 'row_angle', 'pu_hands'];
const noisy = [['deadlift', 'deadlift'], ['rdl', 'rdlSoft'], ['frontSquat', 'frontSquat'], ['lunge', 'lunge'], ['benchPress', 'bench'], ['press', 'press'], ['bentRow', 'row'], ['pushUp', 'pushUp']]
  .map(([id, mv]) => [id, run(id, mv).faults.filter(f => NEW.includes(f))]).filter(([, f]) => f.length);
check('with ±4 px camera jitter, clean reps trigger none of the new NSCA rules', !noisy.length, JSON.stringify(noisy));
JITTER = 0;

// Scoping: rules only where they belong.
const has = (id, rule) => new RepEngine(exFor(id), 'side').rules([...(exFor(id).bottom || []), ...(exFor(id).ascent || []), ...(exFor(id).top || [])]).some(r => r.id === rule);
check('hips-first pull check: deadlift yes, Romanian deadlift no', has('deadlift', 'dl_hips_first') && !has('rdl', 'dl_hips_first'));
check('"soft knees": Romanian and stiff-leg deadlifts, not the conventional deadlift', has('rdl', 'rdl_locked') && has('xStiffLeggedBarbellDeadlift', 'rdl_locked') && !has('deadlift', 'rdl_locked'));
check('no bar-path rules on good mornings or back extensions', !has('goodMorning', 'rdl_bar') && !has('backExt', 'rdl_arms'));
check('front-rack elbows only on front squats', has('frontSquat', 'fsq_elbows') && !has('squat', 'fsq_elbows'));
check('stride rule not on step-ups', has('lunge', 'lu_stride') && !has('stepUp', 'lu_stride'));
check('row angle only on free bent-over rows', has('bentRow', 'row_angle') && !has('cableRow', 'row_angle'));
check('knees past toes is never cued (research approach, by decision)', !Object.values(EXERCISES).flatMap(allRules).some(r => /toe/i.test(r.cue + ' ' + r.id)));

// Every rule that cites NSCA points at a real source with a URL.
const cited = Object.values(EXERCISES).flatMap(allRules).filter(r => r.src);
check(`${cited.length} rules cite an NSCA source, all resolvable`, cited.length >= 15 && cited.every(r => SOURCES[r.src]?.url?.startsWith('https://www.nsca.com/')));

console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
