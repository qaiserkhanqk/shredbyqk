// Squad dashboard maths: roster, per-athlete trends, squad comparison with outliers, CSV.
import { roster, series, compare, squadCSV, valueOf, presetKey, metricsFor, demoSquad } from '../js/squad.js';

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };
const NOW = Date.UTC(2026, 10, 28), { athletes, tests } = demoSquad(NOW);

const R = roster(athletes, tests);
check('roster: every athlete, with tests count and last test', R.length === 6 && R.find(r => r.id === 'a1').tests === 2);
check('roster: athletes with flags on their latest test come first', R[0].flags >= R[R.length - 1].flags && R[0].id === 'a5', R.map(r => `${r.id}:${r.flags}`).join(' '));
check('value: the key-moment value when there is one', valueOf({ rows: [{ k: 'kneeL', min: 1, max: 90, at: 80 }] }, 'kneeL') === 80 && valueOf({ rows: [{ k: 'kneeL', min: 1, max: 90, at: null }] }, 'kneeL') === 90);
check('movement name → preset', presetKey('Cricket: fast bowling') === 'bowling' && presetKey('Squat / landing') === 'squat');
const s = series(tests, 'a1', 'bowling', 'sideBend');
check('trend: one athlete over time, oldest first', s.length === 2 && s[0].v === 48 && s[1].v === 42);
const c = compare(athletes, tests, 'bowling', 'elbowR');
check('compare: latest value per bowler, highest first', c.rows.map(r => r.id).join() === 'a3,a2,a1' && Math.round(c.mean) === 13, JSON.stringify(c));
check('compare: change since the first test', c.rows.find(r => r.id === 'a1').change === -2);
const big = compare([...athletes, { id: 'x1', name: 'X1' }, { id: 'x2', name: 'X2' }], [...tests,
  { athlete_id: 'x1', at: NOW, summary: { preset: 'Squat / landing', rows: [{ k: 'valgusL', at: 30 }] } }, { athlete_id: 'x2', at: NOW, summary: { preset: 'Squat / landing', rows: [{ k: 'valgusL', at: 4 }] } }], 'squat', 'valgusL');
check('compare: someone far from the squad (>1.5 SD) is marked for a closer look', big.rows.find(r => r.id === 'x1').outlier && !big.rows.find(r => r.id === 'a4').outlier, JSON.stringify(big.rows.map(r => [r.id, r.v, r.z.toFixed(2)])));
check('compare: too few athletes → no outliers claimed', compare(athletes.slice(0, 2), tests, 'bowling', 'elbowR').rows.every(r => !r.outlier));
check('measurements listed per movement', metricsFor('bowling').some(m => m.k === 'elbowR') && metricsFor('squat').some(m => m.k === 'valgusL'));
const csv = squadCSV(athletes, tests).split('\n');
check('CSV: header + one row per test, oldest first', csv.length === tests.length + 1 && csv[0].startsWith('athlete,team,position,date,movement') && csv[1].includes('Bowler A'));

if (fail) { console.log(`\n${fail} failed`); process.exit(1); }
console.log('\nsquad: all passed');
