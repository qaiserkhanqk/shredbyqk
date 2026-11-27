// The small signals: read from what clients already do, used to pick a kinder next step, and never noisy.
import * as N from '../js/nutrition.js';
import { engagement, wellbeing, strength, cycle, nudgeDue, notifyLevel } from '../js/signals.js';
import { evaluate } from '../js/adapt.js';
import { plan } from '../tools/push-checkins.mjs';
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : '  ' + detail}`); if (!ok) fails++; };
const DAY = 864e5, NOW = Date.UTC(2026, 10, 27, 8);
const series = (start, perWeek, days = 18) => Array.from({ length: Math.floor(days / 3.5) + 1 }, (_, i) => ({ at: NOW - days * DAY + i * 3.5 * DAY, kg: +(start + perWeek * i * 0.5 + (i % 2 ? 0.3 : -0.3)).toFixed(1) }));
const P = { weightKg: 64, heightCm: 163, age: 30, sex: 'female', dietGoal: 'lose', job: 'desk', trainDays: 4 };
const T = N.targets(P);
const ev = (weights, signals, extra = {}) => evaluate({ weights, goal: 'lose', target: T, adapt: {}, now: NOW, signals, ...extra });

// Reading the signals
const S = { profile: P, food: { log: [{ at: NOW - 5 * DAY }, { at: NOW - 4 * DAY }], weights: [] }, sessions: [], readiness: [] };
const e = engagement(S, NOW);
check('engagement: days since food, and food days in 14', e.daysSinceFood === 4 && e.foodDays14 === 2);
const tired = Array.from({ length: 5 }, (_, i) => ({ at: NOW - i * DAY, sleepH: 5, sleepQ: 6, fatigue: 5, stress: 4 }));
const w = wellbeing({ readiness: tired }, NOW);
check('wellbeing: short sleep from the one-tap morning card = a poor week', w.poor && w.sleepH === 5 && w.rough === 5);
check('wellbeing: no morning cards = no judgement', !wellbeing({}, NOW).poor);
const lifts = ex => [{ ex, at: NOW - 30 * DAY, kg: 60, reps: 5 }, { ex, at: NOW - 3 * DAY, kg: 54, reps: 5 }];
const st = strength({ sessions: [...lifts('squat'), ...lifts('bench')] }, NOW);
check('strength: best lift last 2 weeks vs before (−10%)', st.change === -10 && st.lifts === 2, JSON.stringify(st));
check('cycle: off unless she turns it on', cycle({ profile: P, food: {} }, NOW) === null && cycle({ profile: { sex: 'male' }, food: { cycleOn: true } }, NOW) === null);
const cyc = cycle({ profile: P, food: { cycleOn: true, periods: [NOW - 57 * DAY, NOW - 29 * DAY] } }, NOW);
check('cycle: learns her cycle length; flags the week before a period', cyc.avgLength === 28 && cyc.inWindow && cyc.nextIn === -1, JSON.stringify(cyc));
check('cycle: mid-cycle is not flagged', !cycle({ profile: P, food: { cycleOn: true, periods: [NOW - 12 * DAY] } }, NOW).inWindow);

// Smarter check-ins
const flat = series(64, 0);
check('period week + stall → nothing changes, kind explanation', ev(flat, { cycle: cyc }).kind === 'cycle' && ev(flat, { cycle: cyc }).choices.every(c => c.id === 'keep'));
const rough = ev(flat, { wellbeing: w });
check('rough sleep week + stall → no cut, protect sleep', rough.kind === 'rough-week' && !rough.choices.some(c => c.delta < 0) && /5 hours/.test(rough.message));
const drop = ev(series(66, -0.6), { strength: { change: -7, lifts: 3 } });
check('losing but lifts down 7% → a bit more food offered first', drop.kind === 'strength-drop' && drop.choices[0].delta === 100);
const few = ev(flat, { engagement: { foodDays14: 2 } });
check('few food logs → the check-in says it\'s reading the scale, not the meals', few.kind === 'stalled' && /logged food on 2 of the last 14 days/.test(few.message));
check('women who track get "It\'s my period week" as a choice', ev(flat, {}, { female: true }).choices.some(c => c.id === 'period'));
check('plain stall still works without signals', ev(flat, {}).kind === 'stalled');

// Not noisy
check('default reminders = essentials only', notifyLevel({ profile: {} }) === 'essential');
check('nudge: never for "essential" clients', !nudgeDue({ level: 'essential', daysSinceFood: 5, today: '2026-11-27' }));
check('nudge: "normal" after 3 quiet days', nudgeDue({ level: 'normal', daysSinceFood: 3, today: '2026-11-27' }));
check('nudge: at most once a week', !nudgeDue({ level: 'normal', daysSinceFood: 9, lastNudge: '2026-11-23', today: '2026-11-27' }) && nudgeDue({ level: 'normal', daysSinceFood: 9, lastNudge: '2026-11-20', today: '2026-11-27' }));
check('nudge: never on a check-in day', !nudgeDue({ level: 'normal', daysSinceFood: 5, checkinToday: true, today: '2026-11-27' }));
const day = '2026-11-27';
const jobs = plan({ day,
  profiles: [{ id: 'a', name: 'Sara', next_checkin: day, notify: 'normal', last_food: '2026-11-20' }, { id: 'b', name: 'Ali', notify: 'normal', last_food: '2026-11-22' }, { id: 'c', name: 'Zara', next_checkin: day, notify: 'off' }, { id: 'd', name: 'Hina', notify: 'essential', last_food: '2026-11-01' }],
  subs: [{ client_id: 'a', endpoint: 'a1' }, { client_id: 'b', endpoint: 'b1' }, { client_id: 'c', endpoint: 'c1' }, { client_id: 'd', endpoint: 'd1' }],
  plans: [{ client_id: 'a', note: 'New dinner', updated_at: '2026-11-27T09:00:00Z' }] });
const kinds = Object.fromEntries(jobs.map(j => [j.client, j.kind]));
check('one notification per client per day: QK\'s plan beats the check-in', jobs.filter(j => j.client === 'a').length === 1 && kinds.a === 'plan');
check('quiet 5 days and chose nudges → one gentle nudge', kinds.b === 'nudge' && /Snap your next meal/.test(jobs.find(j => j.client === 'b').msg.body));
check('"off" → nothing, even on check-in day', !kinds.c);
check('"essential" client quiet for weeks → still no nudge', !kinds.d);
check('nudge wording has no guilt', !/(miss|fail|lazy|forgot|should)/i.test(jobs.find(j => j.client === 'b').msg.body));
console.log(fails ? `\n${fails} failed` : '\nall signal checks pass');
process.exit(fails ? 1 : 0);
