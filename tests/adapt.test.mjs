// Two-weekly check-ins: the right, gentle next step for each kind of fortnight.
import * as N from '../js/nutrition.js';
import { checkinDue, daysToCheckin, evaluate, applyChoice, weightSeries, stepGoal, weighInIcs } from '../js/adapt.js';

let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : '  ' + detail}`); if (!ok) fails++; };
const DAY = 864e5, NOW = Date.UTC(2026, 10, 27, 8);
// Weigh-ins every 3–4 days over 18 days, moving `perWeek` kg a week, with ±0.3 kg day-to-day noise.
const series = (start, perWeek, days = 18) => Array.from({ length: Math.floor(days / 3.5) + 1 }, (_, i) => ({ at: NOW - days * DAY + i * 3.5 * DAY, kg: +(start + perWeek * i * 0.5 + (i % 2 ? 0.3 : -0.3)).toFixed(1) }));
const P = { weightKg: 80, heightCm: 178, age: 30, sex: 'male', dietGoal: 'lose', job: 'desk', trainDays: 4 };
const T = N.targets(P);

// Targets from job and training days
const desk0 = N.targets({ ...P, trainDays: 0 }), desk4 = N.targets(P), phys4 = N.targets({ ...P, job: 'physical' });
check('training days add calories (4 sessions > 0)', desk4.kcal > desk0.kcal, `${desk0.kcal} vs ${desk4.kcal}`);
check('a physical job needs more than a desk job', phys4.kcal > desk4.kcal);
check('desk job, 4 sessions, cutting: about 1,900 kcal for an 80 kg man', desk4.kcal >= 1800 && desk4.kcal <= 2000, desk4.kcal);
check('no job given → the older activity setting still works', N.targets({ ...P, job: undefined, activity: 'mid' }).kcal === Math.round(N.maintenance({ ...P, job: undefined }).tdee * 0.8 / 10) * 10);
check('check-in adjustment moves the target', N.targets({ ...P, kcalAdjust: -150 }).kcal === desk4.kcal - 150);
check('never below the safety floor', N.targets({ ...P, kcalAdjust: -2000 }).kcal >= Math.max(desk4.bmr * 0.9, 1500) - 10);
check('at the floor, "eat less" is not offered (steps instead)', !evaluate({ weights: series(80, 0), goal: 'lose', target: N.targets({ ...P, kcalAdjust: -2000 }), adapt: {}, now: NOW }).choices.some(c => c.delta < 0));

// When check-ins are due
const ws = series(82, -0.5);
check('due 14 days after the last check-in', checkinDue(ws, { lastAt: NOW - 14 * DAY }, NOW) && !checkinDue(ws, { lastAt: NOW - 5 * DAY }, NOW));
check('never weighed in → due now', checkinDue([], {}, NOW));
check('days to next check-in counted', daysToCheckin(ws, { lastAt: NOW - 10 * DAY }, NOW) === 4);

// Decisions
const ev = (weights, goal = 'lose', extra = {}) => evaluate({ weights, goal, target: N.targets({ ...P, dietGoal: goal }), adapt: {}, avgSteps: 5200, now: NOW, ...extra });
const stalled = ev(series(80, 0));
check('cutting but stalled → "paused", movement offered first', stalled.kind === 'stalled' && stalled.choices[0].id === 'steps', JSON.stringify(stalled.choices));
check('stalled also offers eating a little less, and keeping it the same', stalled.choices.some(c => c.delta === -150) && stalled.choices.some(c => c.id === 'keep'));
check('steps goal goes up by 2,000 (from at least 8,000, the same goal the Activity score uses)', stalled.choices[0].steps === 10000, stalled.choices[0].steps);
const good = ev(series(82, -0.6));
check('losing at a healthy pace → progress, choice of less food OR more steps OR keep', good.kind === 'progress' && ['keep', 'steps', 'kcal'].every(id => good.choices.some(c => c.id === id)), JSON.stringify(good));
check('progress message says how much was lost', /down \d+(\.\d)? kg over the last two weeks/.test(good.message), good.message);
const fast = ev(series(84, -1.4));
check('losing over 1% a week → suggest eating more', fast.kind === 'fast' && fast.choices[0].delta === 150);
check('bulking but not gaining → eat 150 more', ev(series(70, -0.2), 'gain').choices[0].delta === 150);
check('bulking too fast → eat a little less', ev(series(70, 0.9), 'gain').kind === 'fast');
check('maintaining and steady → keep', ev(series(70, 0.05), 'maintain').kind === 'steady');
check('rehab: never suggests eating less', !ev(series(80, 0), 'lose', { rehab: true }).choices.some(c => c.delta < 0));
check('no recent weigh-in → asks to weigh in', ev([{ at: NOW - 10 * DAY, kg: 80 }]).kind === 'weigh');
check('one fresh weigh-in → needs more data, no changes', ev([{ at: NOW, kg: 80 }]).kind === 'more');
const words = [stalled, good, fast].map(d => d.message).join(' ');
check('messages are kind (no blaming words)', !/\b(fail|bad|lazy|cheat|should have|too much food)\b/i.test(words));

// Applying a choice
const prof = { ...P }, A = {};
applyChoice({ profile: prof, adapt: A, decision: good, choiceId: 'kcal', weight: 81, now: NOW });
check('choosing "eat less" lowers the target by 100', N.targets(prof).kcal === T.kcal - 100 && A.lastAt === NOW && A.history.length === 1);
applyChoice({ profile: prof, adapt: A, decision: stalled, choiceId: 'steps', now: NOW });
check('choosing steps sets the step goal', A.stepGoal === 10000 && stepGoal(A, 3000) === 10000);
check('total adjustment is capped at ±600', (() => { const q = { kcalAdjust: -580 }; applyChoice({ profile: q, adapt: {}, decision: stalled, choiceId: 'kcal' }); return q.kcalAdjust === -600; })());

// Graph data
const years = Array.from({ length: 40 }, (_, i) => ({ at: NOW - (40 - i) * 20 * DAY, kg: 95 - i * 0.4 }));
const all = weightSeries(years, 'all', NOW), m3 = weightSeries(years, '3m', NOW);
check('graph: "All" shows every weigh-in across years', all.pts.length === 40 && all.days > 700);
check('graph: 3 months shows only recent ones', m3.pts.length < 10 && m3.pts.length > 2);
check('graph: change and since-start are reported', m3.change < 0 && all.sinceStart === -15.6, `${m3.change} ${all.sinceStart}`);
check('calendar reminder repeats every two weeks', /RRULE:FREQ=WEEKLY;INTERVAL=2/.test(weighInIcs(NOW)));

{ // Ramadan: no cut, and the dip isn't progress.
  const now = Date.parse('2026-03-10T08:00:00Z'), D = 864e5;
  const weights = [16, 12, 8, 4, 0].map(d => ({ at: now - d * D, kg: 80 + d * 0.08 }));
  const r = evaluate({ weights, goal: 'lose', target: { kcal: 2000, floor: 1500 }, adapt: {}, avgSteps: 7000, now, ramadan: true });
  check('Ramadan check-in: no calorie change offered', r.kind === 'ramadan' && r.choices.every(c => !c.delta), JSON.stringify(r));
  check('Ramadan check-in says the drop mostly comes back', /comes back after Eid/.test(r.message));
}
console.log(fails ? `\n${fails} failed` : '\nall check-in checks pass');
process.exit(fails ? 1 : 0);
