// Scores: fair (no data = grey, never red), motivating (each comes with one fix), and they move with real behaviour.
import * as N from '../js/nutrition.js';
import { allScores, band, fitnessAge, scoreSummary } from '../js/scores.js';
import { dayKey } from '../js/weekly.js';
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : '  ' + detail}`); if (!ok) fails++; };
const DAY = 864e5, NOW = Date.UTC(2026, 10, 27, 20);
const P = { name: 'Ali', weightKg: 80, heightCm: 178, age: 30, sex: 'male', dietGoal: 'lose', job: 'desk', trainDays: 4, weeklyGoal: 4 };
const entry = (at, id, servings = 1, style = 'home') => { const ref = { t: 'dish', id }, opts = { servings, style }; const e = N.estimate(ref, opts); return { at, ref, opts, name: id, kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat, low: e.low, high: e.high }; };
const day = (i, items) => items.map(([id, s], k) => entry(NOW - i * DAY - (3 - k) * 3600e3, id, s));

// 1. A new client: nothing to score, nothing red.
const empty = allScores({ profile: P }, NOW);
check('new client: every score waits for data (grey, not red)', ['health', 'nutrition', 'recovery', 'activity', 'workout'].every(k => empty[k].score == null && empty[k].band.id === 'none'));
check('new client: each empty score says how to unlock it', ['nutrition', 'recovery', 'activity', 'workout'].every(k => /\d|today|first/i.test(empty[k].why)));

// 2. Doing well: on-target meals with protein and salad, good mornings, steps, training 4×/week with clean reps.
const T = N.targets(P);
const goodDay = i => day(i, [['anda_fry', 2], ['roti', 2], ['chicken_tikka', 2], ['salad', 2], ['chapati_thin', 2], ['chicken_karahi', 1], ['dahi', 1], ['banana', 1], ['apple', 1]]);
const log = Array.from({ length: 7 }, (_, i) => goodDay(i)).flat();
const avgK = log.reduce((a, e) => a + e.kcal, 0) / 7;
const steps = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [dayKey(NOW - i * DAY), 9000]));
const readiness = Array.from({ length: 7 }, (_, i) => ({ at: NOW - i * DAY - 12 * 3600e3, sleepH: 7.5, sleepQ: 2, fatigue: 2, stress: 2, soreness: 2, feel: 'great' }));
const sessions = [];
for (let w = 0; w < 6; w++) for (const d of [0, 2, 4, 5]) for (const ex of ['squat', 'bench']) sessions.push({ at: NOW - (w * 7 + d) * DAY, ex, kg: 60 + (5 - w) * 2, reps: 5, good: 5 });
const good = allScores({ profile: P, food: { log, steps, adapt: {} }, readiness, sessions, plan: { days: [1, 3, 5, 6] } }, NOW);
check(`doing well: nutrition is strong (meals ~${Math.round(avgK)} vs ${T.kcal} kcal)`, good.nutrition.score >= 75, JSON.stringify(good.nutrition));
check('doing well: recovery, activity and workout are strong', good.recovery.score >= 75 && good.activity.score >= 75 && good.workout.score >= 75, JSON.stringify([good.recovery.score, good.activity.score, good.workout.score]));
check('doing well: health score is green', good.health.band.id === 'good', good.health.score);

// 3. Struggling: big portions, little protein, no veg; poor sleep; few steps; skipped training.
const badLog = Array.from({ length: 4 }, (_, i) => day(i, [['halwa_puri', 1], ['chicken_biryani', 2], ['samosa', 3], ['jalebi', 2], ['cola', 2]])).flat();
const badRead = Array.from({ length: 4 }, (_, i) => ({ at: NOW - i * DAY - 12 * 3600e3, sleepH: 5, sleepQ: 6, fatigue: 6, stress: 6, soreness: 5, feel: 'rough' }));
const lowSteps = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [dayKey(NOW - i * DAY), 2500]));
const oldSessions = [{ at: NOW - 20 * DAY, ex: 'squat', kg: 60, reps: 5, good: 3 }];
const bad = allScores({ profile: P, food: { log: badLog, steps: lowSteps, adapt: {} }, readiness: badRead, sessions: oldSessions, plan: { days: [1, 3, 5] } }, NOW);
check('struggling: nutrition needs attention (red)', bad.nutrition.band.id === 'low', bad.nutrition.score);
check('struggling: red comes with one concrete fix', bad.nutrition.fix.length > 20 && bad.recovery.fix.length > 20, bad.nutrition.fix);
check('struggling: recovery red and tells them about sleep', bad.recovery.band.id === 'low' && /hours/.test(bad.recovery.fix), JSON.stringify(bad.recovery));
check('struggling: activity and workout red', bad.activity.band.id === 'low' && bad.workout.band.id === 'low', JSON.stringify([bad.activity.score, bad.workout.score]));
check('struggling: health score points to the weakest area', bad.health.band.id === 'low' && !!bad.health.weakest);
check('no blaming words anywhere', !/(lazy|fail|bad|cheat|terrible|danger)/i.test(JSON.stringify(bad)));

// 4. Colours
check('bands: 75 green, 74 amber, 50 amber, 49 red', band(75).id === 'good' && band(74).id === 'mid' && band(50).id === 'mid' && band(49).id === 'low' && band(null).id === 'none');

// 5. Fitness age (estimate, HUNT method)
const fit = fitnessAge({ age: 30, sex: 'male', waist: 82, rhr: 56, perWeek: 4 });
const unfit = fitnessAge({ age: 30, sex: 'male', waist: 108, rhr: 82, perWeek: 0 });
check('fit 30-year-old (waist 82, resting HR 56, trains 4×) → younger fitness age', fit.age < 30, JSON.stringify(fit));
check('unfit 30-year-old (waist 108, resting HR 82, no training) → older fitness age', unfit.age > 40, JSON.stringify(unfit));
check('women use their own equation and reference', fitnessAge({ age: 35, sex: 'female', waist: 72, rhr: 62, perWeek: 3 }).age < 35);
check('missing waist or heart rate → tells them what to measure', JSON.stringify(fitnessAge({ age: 30, sex: 'male', waist: null, rhr: null }).missing) === '["waist","resting heart rate"]');
check('summary for the coach has every score', Object.keys(scoreSummary(good)).join() === 'health,nutrition,recovery,activity,workout,fitnessAge,age');
console.log(fails ? `\n${fails} failed` : '\nall score checks pass');
process.exit(fails ? 1 : 0);
