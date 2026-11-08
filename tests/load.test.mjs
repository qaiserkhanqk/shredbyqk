// Readiness, training load and Studio cue-list tests. Run: node tests/load.test.mjs
import { hooper, readiness, sessionLoad, weekStats, loadSpike, recommendToday } from '../js/load.js';
import { cueList } from '../js/studio.js';
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };
const DAY = 864e5, now = new Date('2026-11-08T12:00:00').getTime();
const good = { sleepQ: 2, fatigue: 2, stress: 2, soreness: 2, sleepH: 8 };

check('Hooper index sums 4 items', hooper(good) === 8);
check('readiness: absolute scale, best possible = 100', readiness({ sleepQ: 1, fatigue: 1, stress: 1, soreness: 1, sleepH: 8 }).score === 100);
check('readiness: short sleep costs 10 points', readiness({ ...good, sleepH: 5 }).score === readiness(good).score - 10);
const hist = Array.from({ length: 14 }, (_, i) => ({ ...good, fatigue: 2 + (i % 2), at: now - (14 - i) * DAY }));
const usual = readiness({ ...good, fatigue: 2 }, hist), bad = readiness({ sleepQ: 5, fatigue: 6, stress: 5, soreness: 6, sleepH: 7 }, hist);
check('readiness: uses personal baseline after 7 days', usual.basis === 'baseline' && usual.score >= 60, `${usual.score}`);
check('readiness: much worse than usual → low score', bad.score < 40, `${bad.score}`);
check('session load = effort × minutes (Foster)', sessionLoad({ rpe: 7, minutes: 60 }) === 420);

const steady = []; for (let d = 0; d < 28; d++) if (d % 7 < 4) steady.push({ at: now - d * DAY, rpe: 6, minutes: 60 }); // 4 sessions/week
const wk = weekStats(steady, now);
check('weekly load: 4 sessions × 360 AU', wk.load === 1440, `${wk.load}`);
check('monotony and strain computed', wk.monotony > 0 && Math.abs(wk.strain - wk.load * wk.monotony) / wk.strain < 0.01, `${wk.monotony}`);
check('steady training → no spike', loadSpike(steady, now).spike === false, JSON.stringify(loadSpike(steady, now)));
const spiky = [...steady, ...[0, 1, 2, 3].map(d => ({ at: now - d * DAY + 3600e3, rpe: 8, minutes: 90 }))];
const sp = loadSpike(spiky, now);
check('doubling this week → spike flagged', sp.spike && sp.ratio > 1.3, `ratio ${sp.ratio}`);
check('new user with little history → no false spike', loadSpike([{ at: now, rpe: 9, minutes: 120 }], now).spike === false);

check('recommendation: good readiness, steady load → go', recommendToday({ check: good, history: hist, sessions: steady, now }).level === 'go');
check('recommendation: load spike → adjust', recommendToday({ check: good, history: hist, sessions: spiky, now }).level === 'adjust');
check('recommendation: very poor readiness → recovery day', recommendToday({ check: { sleepQ: 7, fatigue: 7, stress: 6, soreness: 7, sleepH: 4 }, history: hist, sessions: steady, now }).level === 'recover');
check('recommendation: rehab red light → adjust', recommendToday({ check: good, history: hist, sessions: steady, rehabLight: 'red', now }).level === 'adjust');
check('recommendation: no check-in asks for one', /check-in/.test(recommendToday({ sessions: [], now }).reasons[0]));

const cues = cueList();
check('studio: every cue has a unique id and text', new Set(cues.map(c => c.id)).size === cues.length && cues.every(c => c.text && /^[a-z0-9_]+$/i.test(c.id)));
check('studio: includes rep counts, praise and form corrections', ['n1', 'n20', 'praise1', 'ht_feet_far', 'yes_ht_feet_far', 'sq_valgus'].every(id => cues.some(c => c.id === id)), `${cues.length} lines`);
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
