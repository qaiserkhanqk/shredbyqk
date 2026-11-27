// Days a week: re-packing programs keeps the training, and QK only changes the days on a clear pattern.
import { PROGRAMS, byId } from '../js/programs.js';
import { LIB } from '../js/library.js';
import { FLEX, adapt, canAdapt, muscleSets, judgeDays, usualDays, defaultDaysFor, weekOf, MUSCLE_CAP } from '../js/frequency.js';
import { liftClass } from '../js/progression.js';
import { dayMinutes } from '../js/warmup.js';

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };

// ---------- Re-packing ----------
check('flexible programs exist and are real', FLEX.length >= 8 && FLEX.every(byId));
check('circuits, sport, HYROX, plyometric and 10×10 keep their own days', ['shredCircuit', 'raceReady', 'springLoaded', 'inferno', 'athleteMode', 'engineIron'].every(id => !canAdapt(byId(id)) && adapt(byId(id), 5, LIB) === byId(id)));
check('same days → the program itself', adapt(byId('massMonster'), 4, LIB) === byId('massMonster'));
check('default: 5 days, beginner programs keep their 3', defaultDaysFor(byId('massMonster')) === 5 && defaultDaysFor(byId('gainsEngine')) === 3 && defaultDaysFor(byId('raceReady')) === 4);

const big = id => (liftClass(LIB[id]) || '').startsWith('big');
for (const id of FLEX) for (const n of [3, 4, 5, 6]) {
  const p = byId(id), a = adapt(p, n, LIB), tag = `${id} at ${n} days`;
  if (n === p.days) continue;
  const bad = [];
  if (a.plan.length !== n || a.days !== n) bad.push('session count');
  // Every muscle keeps its weekly sets: within 15% (muscles with 6+ weekly sets).
  const before = muscleSets(p, LIB), after = muscleSets(a, LIB);
  for (const m of Object.keys(before)) if (before[m] >= 6 && Math.abs((after[m] || 0) - before[m]) / before[m] > 0.15) bad.push(`${m} ${before[m]}→${after[m] || 0}`);
  // Main lifts kept with all their sets.
  const sets = pl => pl.flatMap(d => d.items).filter(it => big(it[0])).map(it => `${it[0]}:${it[1]}:${it[2]}`).sort().join();
  if (sets(p.plan) !== sets(a.plan)) bad.push('main lifts changed');
  // Every exercise still there (none dropped), no exercise twice in a session.
  const ids = pl => pl.flatMap(d => d.items.map(it => it[0])).sort().join();
  if (ids(p.plan) !== ids(a.plan)) bad.push('exercises changed');
  if (a.plan.some(d => new Set(d.items.map(it => it[0])).size !== d.items.length)) bad.push('exercise twice in a session');
  // Sets per muscle per session within the cap (main lifts aside); sessions within the time limit.
  for (const d of a.plan) {
    const per = {}; d.items.forEach(it => { if (!big(it[0])) { const m = LIB[it[0]].muscles[0]; per[m] = (per[m] || 0) + it[1]; } });
    if (Object.values(per).some(v => v > MUSCLE_CAP)) bad.push(`${d.name}: muscle over ${MUSCLE_CAP} sets`);
  }
  const longest = Math.max(...p.plan.map(d => dayMinutes(d.items, 6)));
  if (a.plan.some(d => dayMinutes(d.items, 0) > Math.max(85, longest))) bad.push('session too long');
  // Supersets stay together: each letter appears on exactly one run of adjacent items.
  for (const d of a.plan) { const ls = d.items.map(it => it[5] || '-').join(''); if (/(\w)-+\1/.test(ls)) bad.push('superset split'); }
  // Accessories never below 2 sets; names say what the session is.
  if (a.plan.some(d => d.items.some(it => it[1] < 2))) bad.push('under 2 sets');
  if (a.plan.some(d => !/^(Upper|Lower|Full body)( [A-E])?$/.test(d.name) || !d.focus)) bad.push('names');
  check(`${tag}: weekly sets per muscle kept, main lifts intact, sessions sane`, !bad.length, bad.join('; '));
}
const mm = adapt(byId('massMonster'), 3, LIB);
check('Mass Monster at 3 days: same total weekly sets', mm.plan.flatMap(d => d.items).reduce((a, it) => a + it[1], 0) === byId('massMonster').plan.flatMap(d => d.items).reduce((a, it) => a + it[1], 0));
const sb = adapt(byId('strengthBuilder'), 5, LIB);
check('Strength Builder at 5 days: squat, bench, deadlift, press on four different days', ['squat', 'benchPress', 'deadlift', 'press'].map(id => sb.plan.findIndex(d => d.items.some(it => it[0] === id))).filter((v, i, a) => v >= 0 && a.indexOf(v) === i).length === 4);
check('re-packing never changes the original program', byId('massMonster').plan.length === 4 && byId('massMonster').days === 4);

// ---------- Judging the pattern ----------
const DAY = 864e5, MON = Date.UTC(2026, 10, 2, 12); // a Monday, noon UTC
const weekStart = w => MON + w * 7 * DAY;
// Build a log: counts[i] sessions in week i (Mon, Tue, …), program started on week 0's Monday.
const logOf = counts => counts.flatMap((c, w) => Array.from({ length: c }, (_, k) => ({ day: k, at: weekStart(w) + k * DAY })));
const judge = (counts, current, extra = {}) => judgeDays(logOf(counts), { current, since: weekStart(0) - DAY, now: weekStart(counts.length) + 2 * DAY, ...extra });

check('steady 5 a week on a 5-day plan → no change', judge([5, 5, 5, 5], 5) === null);
check('3 a week for 3 weeks on a 5-day plan → 3 days', judge([5, 3, 3, 3], 5)?.days === 3, JSON.stringify(judge([5, 3, 3, 3], 5)));
check('3, 4, 3 → 4 days (the most they did, not the least)', judge([5, 3, 4, 3], 5)?.days === 4);
check('one bad week never triggers a change (5, 2, 5)', judge([5, 5, 2, 5], 5) === null);
check('two short weeks are not enough', judge([5, 5, 3, 3], 5) === null);
check('mixed weeks (3, 5, 3) → no change', judge([5, 3, 5, 3], 5) === null);
check('a week with no training (holiday) is skipped, not counted as 0', judge([3, 3, 0, 3], 5)?.days === 3 && judge([5, 5, 0, 5], 5) === null);
check('never below 3 days (2 a week → 3)', judge([2, 2, 2, 2], 5)?.days === 3 && judge([2, 2, 2, 2], 3) === null);
check('training more: 5 a week for 3 weeks on a 3-day plan → 5', judge([5, 5, 5, 5], 3)?.days === 5 && judge([4, 5, 4, 4], 3)?.days === 4);
check('up to 6 days: 6 a week for 3 weeks on a 5-day plan → 6', judge([5, 6, 6, 6], 5)?.days === 6);
check('never above 6 days (7 a week → 6, and nothing past 6)', judge([7, 7, 7, 7], 5)?.days === 6 && judge([7, 7, 7, 7], 6) === null);
check('the current week is never judged (half a week of 1 session)', judge([5, 5, 5, 5], 5, { now: weekStart(4) + 2 * DAY }) === null && judgeDays([...logOf([5, 5, 5, 5]), { day: 0, at: weekStart(4) }], { current: 5, since: weekStart(0) - DAY, now: weekStart(4) + 2 * DAY }) === null);
check('the first partial week after starting is not judged', judgeDays(logOf([1, 3, 3]), { current: 5, since: weekStart(0) + 3 * DAY, now: weekStart(3) + DAY }) === null);
check('after a change: three new full weeks needed before judging again', judgeDays(logOf([3, 3, 3, 3, 3]), { current: 5, since: weekStart(3) + DAY, now: weekStart(5) + DAY }) === null);
check('after an undo: no judging until the hold ends', judge([5, 3, 3, 3], 5, { hold: weekStart(4) + 10 * DAY }) === null);
check('weeks run Monday to Sunday', weekOf(weekStart(0)) === weekOf(weekStart(0) + 6 * DAY) && weekOf(weekStart(0) + 7 * DAY) === weekOf(weekStart(0)) + 1);

// Reminder days follow the days they actually train.
const mwf = [0, 1, 2].flatMap(w => [0, 2, 4].map(k => ({ day: k, at: weekStart(w) + k * DAY })));
check('usual days: Mon/Wed/Fri trainer → Mon, Wed, Fri', usualDays(mwf, 3, { now: weekStart(3) }).join() === '1,3,5', usualDays(mwf, 3, { now: weekStart(3) }).join());
check('fit weekdays: keeps the chosen days and adds evenly (Tue/Fri/Sat → 4 days)', (await import('../js/frequency.js')).fitWeekdays([2, 5, 6], 4).join() === '1,2,5,6');
check('fit weekdays: trims to n, keeping the earliest in the week', (await import('../js/frequency.js')).fitWeekdays([1, 2, 3, 4, 5], 3).join() === '1,2,3');
check('6 days: Mass Monster re-packs into 6 sessions, Mon–Sat reminders', adapt(byId('massMonster'), 6, LIB).plan.length === 6 && usualDays([], 6, { now: weekStart(3) }).join() === '1,2,3,4,5,6');
check('usual days: fills missing days evenly', usualDays([], 4, { now: weekStart(3) }).join() === '1,2,4,5');

if (fail) { console.log(`${fail} FAILED`); process.exit(1); }
console.log('frequency: all pass');
