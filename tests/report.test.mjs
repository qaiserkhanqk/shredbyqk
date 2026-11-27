// Weekly report: wins first, plan not "last week", kg lifted, health + mind + food, one focus, saved snapshots.
import { buildReport, snapshot, saveWeek, history, lastWeekStart } from '../js/report.js';
import { followUps } from '../js/memory.js';
import { careSummary, careChips } from '../js/dash.js';

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };
const DAY = 864e5, NOW = new Date(2026, 10, 30, 9).getTime(); // Monday morning
const WS = lastWeekStart(NOW), at = (d, h = 18) => WS + d * DAY + h * 3600e3;

const S = {
  profile: { name: 'Ali', age: 34, sex: 'male' }, plan: { days: [1, 3, 5] },
  sessions: [
    { at: WS - 7 * DAY, ex: 'squat', name: 'Squat', kg: 60, reps: 8 },
    ...[0, 2, 4].flatMap(d => [{ at: at(d), ex: 'squat', name: 'Squat', kg: d === 4 ? 70 : 62.5, reps: 8, good: 8 }, { at: at(d, 19), ex: 'squat', name: 'Squat', kg: 62.5, reps: 8, good: 7 }]),
  ],
  readiness: [0, 1, 2, 3, 4].map(d => ({ at: at(d, 7), sleepQ: 2, fatigue: 2, stress: 2, soreness: 2 })),
  calm: [{ at: at(3, 21) }],
  fitage: [{ at: at(1), sex: 'male', age: 34, waist: 84, rhr: 58, active: true, fitnessAge: 28 }],
};
const r = buildReport(S, WS);
check('report: training days vs the plan (not vs last week)', r.training.days === 3 && r.training.planned === 3);
check('report: kg lifted that week', r.training.kg === (62.5 * 8 * 2 + 62.5 * 8 * 2 + (70 + 62.5) * 8), r.training.kg);
check('report: the week\'s personal best', r.training.prs.some(p => p.ex === 'squat' && p.kind === 'weight'));
check('report: wins open the report', r.wins[0] === 'You hit your plan: 3 of 3 training days.' && r.wins.length >= 3, JSON.stringify(r.wins));
check('report: Fitness Age, sleep and calm feature when they are good', r.wins.some(w => /Fitness Age 28/.test(w)) || r.wins.length === 4);
check('report: sleep and mind section', r.mind.checkDays === 5 && r.mind.sleep === 2 && r.mind.calm === 1);
check('report: health scores included', 'health' in r.health && 'recovery' in r.health);
check('report: exactly one focus', typeof r.focus === 'string' && r.focus.length > 10, r.focus);

const quiet = buildReport({ ...S, sessions: S.sessions.filter(s => s.at < WS) }, WS);
check('report: a missed week is welcomed back, not shamed', /quiet week happens/.test(quiet.wins[0]) && /One session this week/.test(quiet.focus), JSON.stringify([quiet.wins, quiet.focus]));
check('report: never says "streak" or "failed"', !/streak|fail|lazy/i.test(JSON.stringify([r, quiet])));

const snap = snapshot(r);
check('snapshot: small enough to keep forever (<400 bytes)', JSON.stringify(snap).length < 400, JSON.stringify(snap).length);
const S2 = structuredClone(S);
check('saveWeek: saves last week once', saveWeek(S2, NOW) && !saveWeek(S2, NOW) && Object.keys(S2.reports).length === 1);
check('history: snapshots oldest first', history({ reports: { '2026-11-16': { week: '2026-11-16' }, '2026-11-09': { week: '2026-11-09' } } }).map(h => h.week).join() === '2026-11-09,2026-11-16');
check('saveWeek: nothing logged → no report', saveWeek({ sessions: [] }, NOW) === null);

const f = followUps({ ...S2, memory: { done: {} } }, { now: NOW + 3600e3 });
check('Monday: "Your week in review is ready" card', f.some(x => x.kind === 'report' && /3 of 3 training days/.test(x.text)), JSON.stringify(f.map(x => x.kind)));
check('coach: sees "Last week 3/3 days"', careChips(careSummary(S2, NOW)).some(c => /^Last week 3\/3 days/.test(c)), careChips(careSummary(S2, NOW)).join(' | '));

if (fail) { console.log(`\n${fail} failed`); process.exit(1); }
console.log('\nweekly report: all passed');
