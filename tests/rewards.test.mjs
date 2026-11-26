// Rewards: clean-rep milestones, perfect sets, cheers and the weekly coach line.
import * as R from '../js/rewards.js';
import { weekSummary } from '../js/share.js';

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };

const DAY = 864e5, now = Date.UTC(2026, 10, 26);
const S = [
  { at: now - 20 * DAY, ex: 'squat', reps: 10, good: 8 },
  { at: now - 15 * DAY, ex: 'plank', reps: 60, good: 55 },           // hold: seconds, not reps
  { at: now - 10 * DAY, ex: 'squat', reps: 10, good: 10, demo: true }, // demo never counts
  { at: now - 9 * DAY, ex: 'curl', reps: 12, good: 0, guided: true },  // guided timer
  { at: now - 3 * DAY, ex: 'squat', reps: 12, good: 12 },
  { at: now - 2 * DAY, ex: 'curl', reps: 8, good: 6 },
];
const isHold = id => id === 'plank';

check('lifetime clean reps: only real camera reps, holds left out', R.lifetimeClean(S, isHold) === 26, R.lifetimeClean(S, isHold));
check('good can never exceed reps', R.lifetimeClean([{ reps: 5, good: 9 }]) === 5);
check('crossing 25 earns the first medal', R.crossed(24, 25)?.n === 25);
check('no medal when nothing is crossed', R.crossed(26, 40) === null);
check('a big jump reports the highest medal passed', R.crossed(40, 120)?.n === 100);
const p = R.progress(60);
check('progress: earned and next', p.earned.length === 2 && p.next.n === 100 && p.left === 40 && Math.abs(p.frac - 0.2) < 1e-9, JSON.stringify(p));
check('progress: every medal earned', R.progress(9999).next === null && R.progress(9999).frac === 1);
check('perfect set needs 5+ reps, all clean', R.isPerfect(5, 5) && !R.isPerfect(4, 4) && !R.isPerfect(8, 7));
check('perfect sets counted', R.perfectSets(S, isHold) === 1);
check('cheer uses the first name', R.cheer(R.TIERS[2], 'Sara') === 'One hundred clean reps! Sara, that\'s a century.', R.cheer(R.TIERS[2], 'Sara'));
check('cheer without a name reads cleanly', R.cheer(R.TIERS[0], '') === 'That\'s 25 clean reps. You\'re off the mark.', R.cheer(R.TIERS[0], ''));
const wk = R.earnedBetween(S, now - 7 * DAY, now, isHold);
check('this week: medal passed and perfect set', wk.tiers.map(t => t.n).join() === '25' && wk.perfect === 1, JSON.stringify(wk));
const msg = weekSummary({ sessions: S, profile: { weeklyGoal: 3 } }, { now, isHold });
check('weekly message to the coach lists rewards', /Rewards earned: Off the mark \(25 clean reps\), 1 perfect set/.test(msg), msg);

if (fail) { console.log(`${fail} FAILED`); process.exit(1); }
console.log('rewards: all pass');
