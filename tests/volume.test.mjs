// Weight lifted, workout summary (bests, change since last time), milestones and the running totals.
import { setKg, workoutSummary, equivalent, milestones, rollup, recount, weekKey, monthKey } from '../js/volume.js';

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };
const DAY = 864e5, NOW = new Date(2026, 10, 27, 19).getTime();

check('volume: weight × reps', setKg({ kg: 60, reps: 8 }) === 480);
check('volume: bodyweight sets add reps, not kg', setKg({ reps: 15 }) === 0);
check('volume: demo sets never count', setKg({ kg: 100, reps: 10, demo: true }) === 0);

const last = [{ at: NOW - 7 * DAY, ex: 'squat', kg: 60, reps: 8 }, { at: NOW - 7 * DAY, ex: 'squat', kg: 60, reps: 8 }, { at: NOW - 7 * DAY, ex: 'bench', kg: 40, reps: 8 }];
const today = [{ at: NOW - 50 * 60e3, ex: 'squat', kg: 65, reps: 8, good: 8 }, { at: NOW - 40 * 60e3, ex: 'squat', kg: 62.5, reps: 8, good: 7 }, { at: NOW - 30 * 60e3, ex: 'bench', kg: 40, reps: 10, manual: true }];
const w = workoutSummary(today, last, { workoutsBefore: 9 });
check('summary: total kg lifted', w.kg === 65 * 8 + 62.5 * 8 + 400, w.kg);
check('summary: heaviest-ever PR', w.prs.some(p => p.kind === 'weight' && p.value === 65 && p.was === 60));
check('summary: stronger set PR (estimated 1-rep max)', w.prs.some(p => p.ex === 'bench' && p.kind === 'e1rm'));
check('summary: +11% volume vs last time on the same exercises', w.change === 11, w.change);
check('summary: workout number', w.number === 10);
check('summary: form from camera sets only', w.form === 94, w.form);
check('summary: first time on an exercise is a baseline, not a PR', workoutSummary([{ at: NOW, ex: 'row', kg: 50, reps: 8 }], last).prs.length === 0);
check('summary: no comparison when the exercises are new', workoutSummary([{ at: NOW, ex: 'row', kg: 50, reps: 8 }], last).change === null);
check('summary: more reps at the same top weight is a PR', workoutSummary([{ at: NOW, ex: 'bench', kg: 40, reps: 8 }, { at: NOW, ex: 'bench', kg: 40, reps: 9 }], [{ at: NOW - 3 * DAY, ex: 'bench', kg: 40, reps: 9 }, { at: NOW - 3 * DAY, ex: 'bench', kg: 30, reps: 15 }]).prs.length === 0);

check('equivalent: 1,420 kg ≈ 2 Suzuki Mehrans', equivalent(1420).text === '2 Suzuki Mehrans', equivalent(1420)?.text);
check('equivalent: 1,600 kg ≈ a family car', equivalent(1600).text === 'a family car');
check('equivalent: tiny totals → none', equivalent(10) === null);
check('equivalent: a year of training ≈ blue whales', /blue whale/.test(equivalent(400000).text));

const m = milestones({ workouts: 9, kg: 900 }, { workouts: 10, kg: 1500 });
check('milestones: workout 10 and the first tonne', m.map(x => x.n).join() === '10,1000');
check('milestones: nothing crossed → none', milestones({ workouts: 11, kg: 2000 }, { workouts: 12, kg: 2500 }).length === 0);

// Running totals: incremental, and the same as recounting from scratch.
const S = { sessions: [...last, ...today] };
const T = rollup(S);
check('totals: lifetime kg, sets and workouts (days)', T.kg === 480 + 480 + 320 + w.kg && T.sets === 6 && T.workouts === 2, JSON.stringify(T).slice(0, 200));
check('totals: by week and month', T.weeks[weekKey(NOW)].kg === w.kg && T.months[monthKey(NOW)].days === 2);
S.sessions.push({ at: NOW + 60e3, ex: 'squat', kg: 70, reps: 5 });
const before = T.kg; rollup(S);
check('totals: adding a set only reads the new set', S.totals.kg === before + 350 && S.totals.workouts === 2);
const again = recount({ sessions: S.sessions });
check('totals: incremental = recount from scratch', again.kg === S.totals.kg && again.sets === S.totals.sets && again.workouts === S.totals.workouts);
// Speed: 3 years of training (≈ 20,000 sets) rolls up fast, and the next call is instant.
const big = { sessions: Array.from({ length: 20000 }, (_, i) => ({ at: NOW - (20000 - i) * 80 * 60e3, ex: 'squat', kg: 60, reps: 8 })) };
let t = performance.now(); rollup(big); const first = performance.now() - t;
big.sessions.push({ at: NOW + 1, ex: 'squat', kg: 60, reps: 8 });
t = performance.now(); rollup(big); const next = performance.now() - t;
check(`speed: 20,000 sets in ${first.toFixed(0)} ms, then ${next.toFixed(1)} ms per new set`, first < 400 && next < 15, `${first} / ${next}`);

if (fail) { console.log(`\n${fail} failed`); process.exit(1); }
console.log('\nvolume: all passed');
