// Progression: QK's next-weight decisions, units, plate rounding, light weeks and strength charts.
import * as P from '../js/progression.js';

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };
const near = (a, b, e = 0.01) => Math.abs(a - b) < e;

const DAY = 864e5, T0 = Date.UTC(2026, 8, 1);
const SQ = { id: 'squat', equipment: 'Barbell', pattern: 'squat' }, BP = { id: 'benchPress', equipment: 'Barbell', pattern: 'bench' };
const CURL = { id: 'curl', equipment: 'Dumbbells', pattern: 'curl' }, LP = { id: 'legPress', equipment: 'Machine', pattern: 'squat' };
// A training day: n sets of `reps` at kg, with `good` clean reps each and speed loss vl.
const day = (ex, d, kg, reps, { n = 3, good = reps, vl = 0.15, target, mode, wave } = {}) =>
  Array.from({ length: n }, (_, i) => ({ ex, at: T0 + d * DAY + i * 60000, kg, reps: Array.isArray(reps) ? reps[i] : reps, good: Array.isArray(good) ? good[i] : good, vl, target, mode, wave }));

check('lift classes', P.liftClass(SQ) === 'big-lower' && P.liftClass(BP) === 'big-upper' && P.liftClass(CURL) === 'small' && P.liftClass(LP) === 'mid' && P.liftClass({ equipment: 'Bodyweight', pattern: 'pushUp' }) === null);
check('kg and lb steps', P.stepKg('big-lower') === 5 && P.stepKg('big-upper') === 2.5 && near(P.stepKg('big-lower', 'lb'), 4.536) && near(P.stepKg('small', 'lb'), 1.134));
check('barbell weights round to 2.5 kg', P.roundLoad(61.3, 'big-lower') === 62.5 && P.roundLoad(58.6, 'big-upper') === 57.5);
check('lb weights round to 5 lb plates', near(P.toUnit(P.roundLoad(100, 'big-lower', 'lb'), 'lb'), 220));
check('formatting in both units', P.fmtW(62.5) === '62.5 kg' && P.fmtW(P.fromUnit(225, 'lb'), 'lb') === '225 lb');

// Linear beginner: clean, fast reps → add 5 kg to squat, 2.5 to bench.
let n = P.nextFor(SQ, day('squat', 0, 60, 8, { target: 8 }));
check('squat: all clean and fast → +5 kg', n.kg === 65 && n.reps === 8 && n.sets === 3 && n.action === 'add' && n.mode === 'linear', JSON.stringify(n));
n = P.nextFor(BP, day('benchPress', 0, 40, 8, { target: 8 }));
check('bench: → +2.5 kg', n.kg === 42.5, n.kg);
n = P.nextFor(SQ, day('squat', 0, P.fromUnit(135, 'lb'), 8, { target: 8 }), { unit: 'lb' });
check('in pounds: +10 lb, on a 5 lb plate step', near(P.toUnit(n.kg, 'lb'), 145), P.toUnit(n.kg, 'lb'));

// The camera gate: reps done but form faults, or reps slowed a lot → same weight.
n = P.nextFor(SQ, day('squat', 0, 60, 8, { target: 8, good: 5 }));
check('form slipped → same weight, says why', n.kg === 60 && n.action === 'same' && /form/.test(n.why), JSON.stringify(n));
n = P.nextFor(SQ, day('squat', 0, 60, 8, { target: 8, vl: 0.4 }));
check('reps slowed a lot → same weight', n.kg === 60 && /slowed/.test(n.why));

// Misses: once → retry, twice → back off 10%, and the lift switches to a weekly wave.
n = P.nextFor(SQ, [...day('squat', 0, 80, 8, { target: 8 }), ...day('squat', 3, 85, [8, 7, 6], { target: 8 })]);
check('one miss → same weight again', n.kg === 85 && n.action === 'same');
const twoMiss = [...day('squat', 0, 80, 8, { target: 8 }), ...day('squat', 3, 85, [8, 7, 6], { target: 8 }), ...day('squat', 6, 85, [7, 6, 6], { target: 8 })];
n = P.nextFor(SQ, twoMiss);
check('two misses → back off 10% and rotate heavy/medium/light (starting on medium)', n.action === 'reset' && n.kg === 77.5 && n.day === 'medium' && n.reps === 8 && n.mode === 'wave' && /rotates/.test(n.why), JSON.stringify(n));
// base 76.5 → round 77.5; heavy ×1.1 = 85.25 → 85

// Wave: medium after heavy, weights from the base.
n = P.nextFor(SQ, [...twoMiss, ...day('squat', 9, 85, 5, { n: 4, target: 5, mode: 'wave', wave: 'heavy' })]);
check('wave: heavy done clean → medium day, base +5', n.day === 'medium' && n.reps === 8 && n.kg === 82.5 && n.action === 'add', JSON.stringify(n));
n = P.nextFor(SQ, [...day('squat', 9, 80, 8, { target: 8, mode: 'wave', wave: 'medium' })]);
check('wave: medium → light day at ~85%', n.day === 'light' && n.reps === 12 && n.kg === 72.5, JSON.stringify(n)); // base 85 ×0.85 = 72.25 → 72.5

// Double progression for dumbbells/machines.
n = P.nextFor(CURL, day('curl', 0, 12, [10, 9, 9], { target: 8 }));
check('curls: add reps first (aim for 10)', n.kg === 12 && n.reps === 10 && n.action === 'reps', JSON.stringify(n));
n = P.nextFor(CURL, day('curl', 0, 12, 12, { target: 12 }));
check('curls: 12 on every set, clean → +1 kg, back to 8', n.kg === 13 && n.reps === 8 && n.action === 'add', JSON.stringify(n));
n = P.nextFor(LP, day('legPress', 0, 100, 12, { target: 12 }));
check('machine: +2.5 kg', n.kg === 102.5);
n = P.nextFor(CURL, [...day('curl', 0, 14, [7, 6, 6], { target: 8 }), ...day('curl', 2, 14, [7, 6, 5], { target: 8 })]);
check('dumbbells: below range twice → back off 10%', n.action === 'reset' && n.kg === 12.5, JSON.stringify(n));

// Light week keeps the weight and cuts sets by a third.
n = P.nextFor(SQ, day('squat', 0, 60, 8, { target: 8 }), { light: true });
check('light week: fewer sets, same weight', n.sets === 2 && n.kg === 60 && n.action === 'light');
check('no history → no prescription', P.nextFor(SQ, []) === null && P.nextFor({ equipment: 'Bodyweight' }, []) === null);
check('demo and unweighted sets ignored', P.nextFor(SQ, day('squat', 0, 60, 8).map(s => ({ ...s, demo: true }))) === null);
check('warm-up sets ignored when judging', P.judge([{ kg: 40, reps: 5 }, { kg: 60, reps: 8, good: 8 }, { kg: 60, reps: 8, good: 8 }], { reps: 8 }).sets === 2);

// Light week due.
const weekly = Array.from({ length: 8 }, (_, w) => day('squat', w * 7, 60, 8)).flat();
check('light week due after 7 training weeks', P.lightWeekDue(weekly, { now: T0 + 55 * DAY }));
check('not due right after one', !P.lightWeekDue(weekly, { now: T0 + 55 * DAY, lastLight: T0 + 50 * DAY }));
check('due early when 2 lifts backed off recently', P.lightWeekDue(day('squat', 0, 60, 8), { now: T0 + 10 * DAY, resets: [{ ex: 'squat', at: T0 + 5 * DAY }, { ex: 'benchPress', at: T0 + 8 * DAY }] }));

// Strength chart.
check('Epley 1RM', near(P.e1rm(100, 5), 116.67) && P.e1rm(100, 15) === null);
const hist = [...day('squat', 0, 60, 8), ...day('squat', 7, 65, 8), ...day('squat', 14, 62.5, 8), ...day('squat', 21, 70, 8)];
const s1 = P.strengthSeries(hist, 'squat', '1M', T0 + 22 * DAY);
check('series: one point per session with PR flags', s1.points.length === 4 && s1.points.map(p => p.pr).join() === 'true,true,false,true', JSON.stringify(s1.points.map(p => p.pr)));
check('series: % change over the range', near(s1.change, 70 / 60 - 1));
check('series: volume per point', s1.points[0].vol === 60 * 8 * 3);
const s3 = P.strengthSeries(hist, 'squat', '1Y', T0 + 22 * DAY);
check('year view groups by month', s3.points.length <= 2, s3.points.length);
const vol = P.weeklyVolume(hist, 4, T0 + 22 * DAY);
check('weekly volume, oldest first', vol.length === 4 && vol[3] === 70 * 24 && vol[0] === 60 * 24, vol.join());

if (fail) { console.log(`${fail} FAILED`); process.exit(1); }
console.log('progression: all pass');
