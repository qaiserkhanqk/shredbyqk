// Fitness Age: HUNT non-exercise fitness model + HUNT 3 healthy reference values.
import { ecrf, refVo2, ageForVo2, fitnessAge, levers, missing, meetsGuideline, retestDue, pushupNote, sitRiseNote, rhrNote, REF } from '../js/fitnessage.js';

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };
const near = (a, b, d = 0.01) => Math.abs(a - b) <= d;

// Equations exactly as printed (men: 105.91 − 0.334·age − 0.402·WC − 0.144·RHR + 3.102·PA).
const m = { sex: 'male', age: 35, waistCm: 90, rhr: 65, active: true };
check('men: HUNT equation as printed', near(ecrf(m), 105.91 - 0.334 * 35 - 0.402 * 90 - 0.144 * 65 + 3.102), ecrf(m));
const w = { sex: 'female', age: 40, waistCm: 78, rhr: 68, active: false };
check('women: HUNT equation as printed', near(ecrf(w), 78 - 0.297 * 40 - 0.27 * 78 - 0.11 * 68), ecrf(w));

// Reference curve hits the published group means and falls with age.
check('reference: group means at mid-ages', refVo2(25, 'male') === 54.4 && refVo2(55, 'female') === 34.4);
check('reference: in between is interpolated', near(refVo2(30, 'male'), (54.4 + 49.1) / 2));
check('reference: falls with age for both sexes', ['male', 'female'].every(s => REF[s].every(([, v], i, a) => i === 0 || v < a[i - 1][1])));

// Fitness age inverts the curve.
check('fitness age: a group mean maps back to its mid-age', ageForVo2(47.2, 'male') === 45 && ageForVo2(31.1, 'female') === 65);
check('fitness age: fitter → younger', ageForVo2(50, 'male') < ageForVo2(40, 'male'));
check('fitness age: very fit stays at 18 minimum', ageForVo2(80, 'male') === 18);
check('fitness age: very unfit capped at 90', ageForVo2(5, 'female') === 90);

const r = fitnessAge(m);
check('result: active 35-year-old man with a 90 cm waist is younger than his age', r.fitnessAge < 35 && r.diff < 0, JSON.stringify(r));
check('result: % of average for age is given', r.pct > 100);
check('result: not active adds years', fitnessAge({ ...m, active: false }).fitnessAge > r.fitnessAge);
check('result: missing pieces → no number', fitnessAge({ sex: 'male', age: 35 }) === null && missing({ sex: 'male', age: 35 }).join() === 'waist,rhr');

// Levers: only things in their control, worth at least a year, biggest first.
const L = levers({ sex: 'male', age: 45, waistCm: 104, rhr: 78, active: false });
check('levers: inactive, big waist, high RHR → all three', L.map(l => l.id).sort().join() === 'active,rhr,waist', JSON.stringify(L));
check('levers: biggest first', L.every((l, i) => i === 0 || l.years <= L[i - 1].years));
check('levers: nothing to suggest when already fit', levers({ sex: 'female', age: 30, waistCm: 70, rhr: 55, active: true }).length === 0);

// Activity from the log needs at least 2 weeks.
check('activity: one week is not enough', meetsGuideline({ weeks: [5] }) === null);
check('activity: 3 × 50 min a week meets it', meetsGuideline({ weeks: [3, 3] }) === true);
check('activity: 2 × 50 min does not', meetsGuideline({ weeks: [2, 2] }) === false);

// Monthly retest.
const DAY = 864e5, NOW = Date.UTC(2026, 10, 27);
check('retest: not due after 10 days', !retestDue([{ at: NOW - 10 * DAY }], NOW));
check('retest: due after 30 days', retestDue([{ at: NOW - 31 * DAY }], NOW));
check('retest: never tested → no reminder', !retestDue([], NOW));

// Body markers.
check('push-ups: >40 great, ≤10 low', pushupNote(41).level === 'great' && pushupNote(10).level === 'low' && pushupNote(25).level === 'ok');
check('sit-rise: 8+ great, 0–3 low', sitRiseNote(8.5).level === 'great' && sitRiseNote(3).level === 'low' && sitRiseNote(11) === null);
check('resting HR: <60 great, >75 low', rhrNote(55).level === 'great' && rhrNote(80).level === 'low');

if (fail) { console.log(`\n${fail} failed`); process.exit(1); }
console.log('\nfitness age: all passed');
