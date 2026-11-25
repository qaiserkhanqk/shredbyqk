// The single "next step" on Today. Run: node tests/today.test.mjs
import { nextStep } from '../js/today.js';
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };
const base = { hour: 9, weekday: 1, plan: { days: [1, 3, 5] }, focus: 'train', readiness: null, trainedToday: false, calmedToday: false, rehab: null, workout: { name: 'Glute Builder', minutes: 38, count: 4 } };
const k = o => nextStep({ ...base, ...o }).kind;

check('planned day → today\'s workout', k({}) === 'workout');
check('no plan set yet → workout every day', k({ plan: { days: [] }, weekday: 2 }) === 'workout');
check('lighter day → still the workout, with a lighter instruction', /lighter/.test(nextStep({ ...base, readiness: 'adjust' }).eyebrow));
check('rest day → rest, names the next workout day', k({ weekday: 2 }) === 'rest' && /Wednesday/.test(nextStep({ ...base, weekday: 2 }).sub));
check('rest day wraps the week (Saturday → Monday)', /Monday/.test(nextStep({ ...base, weekday: 6 }).sub));
check('trained today → wind down with Sukoon', k({ trainedToday: true }) === 'calm');
check('trained and calmed → done', k({ trainedToday: true, calmedToday: true }) === 'done');
check('trained, late evening → done (no nagging)', k({ trainedToday: true, hour: 22 }) === 'done');
check('recovery day without rehab → calm', k({ readiness: 'recover' }) === 'calm');
const rehab = { name: 'Knee pain', phase: 0, phases: 3, morningDue: false };
check('recovery day with rehab → gentle rehab', k({ readiness: 'recover', rehab }) === 'rehab');
check('rehab morning check comes first of all', k({ readiness: 'recover', rehab: { ...rehab, morningDue: true } }) === 'rehab-morning');
check('active rehab on a training day → rehab first, says workout is next', k({ rehab }) === 'rehab' && /workout is next/.test(nextStep({ ...base, rehab }).sub));
check('client came for recovery, no plan yet → start a recovery plan', k({ focus: 'recover' }) === 'rehab-start');
check('client came for calm, rest day → calm', k({ focus: 'calm', weekday: 2 }) === 'calm');
check('client came for calm, training day → workout still comes first', k({ focus: 'calm' }) === 'workout');
check('every step has a title, a reason and one button', ['workout', 'rest', 'calm', 'done'].every(() => true) &&
  [{}, { weekday: 2 }, { trainedToday: true }, { readiness: 'recover' }, { rehab }, { focus: 'recover' }].every(o => { const s = nextStep({ ...base, ...o }); return s.title && s.sub && s.cta && s.eyebrow; }));
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
