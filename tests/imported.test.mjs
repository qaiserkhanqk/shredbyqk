// Checks the exercises imported from free-exercise-db (js/library-extra.js) are wired in safely.
// Run: node tests/imported.test.mjs
import { LIBRARY, LIB, exFor } from '../js/library.js';
import { EXTRA } from '../js/library-extra.js';
import { EXERCISES, RepEngine } from '../js/exercises.js';
import { squatPose, frontSquatLandmarks, AVG_BODY } from '../js/demo.js';
import { personalFor } from '../js/bodymap.js';

let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };

const ids = LIBRARY.map(x => x.id), names = LIBRARY.map(x => x.name.toLowerCase());
check(`${EXTRA.length} exercises imported`, EXTRA.length >= 100, EXTRA.length);
check('every exercise id is unique', new Set(ids).size === ids.length);
check('no two exercises share a name', new Set(names).size === names.length, names.filter((n, i) => names.indexOf(n) !== i).join(', '));
check('every imported exercise is camera-checked by a real pattern', EXTRA.every(([id, , , , p]) => EXERCISES[p] && exFor(id)));
check('every imported exercise records its source and level', EXTRA.every(([, , , , , x]) => x.src && x.level));
check('imported muscles use the app\'s muscle groups', EXTRA.every(([, , m]) => m.length && m.every(x => ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core', 'Full body'].includes(x))));

// Rule scoping by flags.
const eng = id => new RepEngine(exFor(id), 'side', null), has = (id, list, rule) => eng(id).rules(exFor(id)[list]).some(r => r.id === rule);
check('free squats (imported) get the heel and hips-first checks', has('xZercherSquat', 'bottom', 'sq_heels') && has('xBoxSquat', 'ascent', 'sq_hips_first'));
check('Smith machine squat does not (bar path is fixed)', !has('xSmithMachineSquat', 'bottom', 'sq_heels'));
check('feet-on-floor benches get the leg-drive check; floor press does not', has('xInclineBarbellBenchPress', 'bottom', 'bp_legs') && !has('xBarbellFloorPress', 'bottom', 'bp_legs'));
check('floor press still gets the shoulder-blade check', has('xBarbellFloorPress', 'top', 'bp_scap'));
check('cable chest press (no bench) gets neither bench check', !has('xCableChestPress', 'bottom', 'bp_legs') && !has('xCableChestPress', 'top', 'bp_scap'));
check('preacher and concentration curls skip "elbow swing" (arm rests at an angle)', ['preacherCurl', 'xConcentrationCurl', 'xMachinePreacherCurl'].every(id => !has(id, 'always', 'cu_swing')) && has('xEzBarCurl', 'always', 'cu_swing'));
check('deadlift and kettlebell swing skip "squatting, not hinging" (knees bend by design)', ['deadlift', 'kbSwing', 'xCablePullThrough'].every(id => !has(id, 'bottom', 'rdl_squat')) && has('xStiffLeggedBarbellDeadlift', 'bottom', 'rdl_squat'));

// Smoke test: every camera exercise (old and new) runs through metrics + engine + personal limits without errors.
const side = squatPose(0, false, 0, AVG_BODY), c = p => ({ x: p.x, y: p.y, v: 1 });
const sidePx = Array.from({ length: 33 }, () => c(side.H));
Object.assign(sidePx, { 0: c(side.head), 7: c(side.head), 11: c(side.S), 13: c(side.elbow), 15: c(side.hand), 23: c(side.H), 25: c(side.K), 27: c(side.A), 29: c(side.heel), 31: c(side.toe) });
for (const [n, f] of [[11, 12], [13, 14], [15, 16], [23, 24], [25, 26], [27, 28], [29, 30], [31, 32], [7, 8]]) sidePx[f] = { ...sidePx[n], v: 0.3 };
const frontPx = frontSquatLandmarks(0.3, {});
const body = { ok: true, femurTorso: 1, armTorso: 1.1, kneeStraight: 176, hipStraight: 178, elbowStraight: 170, line: 176, calfLift: 0.4, kneeMin: 100, leanAtDepth: 40, shinAtDepth: 30, heelRise: 0, hingeMin: 80, shoulderFlex: 165, shoulderAbd: 170, kneeRatioStand: 1 };
const broken = [];
for (const x of LIBRARY.filter(x => x.pattern)) {
  try {
    const ex = exFor(x.id);
    for (const view of ['side', 'front']) {
      const e = new RepEngine(ex, ex.view === 'either' ? view : ex.view, personalFor(x.pattern, body));
      for (let t = 0; t < 40; t++) e.update(ex.metrics(view === 'side' ? sidePx : frontPx, e.view), t * 33);
    }
  } catch (err) { broken.push(`${x.id}: ${err.message}`); }
}
check(`all ${LIBRARY.filter(x => x.pattern).length} camera exercises run through the engine with personal limits`, !broken.length, broken.slice(0, 5).join(' | '));

console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
