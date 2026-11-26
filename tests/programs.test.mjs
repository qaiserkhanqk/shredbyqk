// Programs: every exercise exists, each program is distinct, and rep targets feed the progression engine.
import { PROGRAMS, scheme, weeklySets, currentDay, byId, GOALS, pickProgram, defaultDays } from '../js/programs.js';
import { LIB } from '../js/library.js';
import { nextFor } from '../js/progression.js';

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };

check('at least 10 programs (14 core + home programs)', PROGRAMS.length >= 10, PROGRAMS.length);
check('unique ids and names', new Set(PROGRAMS.map(p => p.id)).size === PROGRAMS.length && new Set(PROGRAMS.map(p => p.name)).size === PROGRAMS.length);
const missing = PROGRAMS.flatMap(p => p.plan.flatMap(dd => dd.items.filter(it => !LIB[it[0]]).map(it => `${p.id}:${it[0]}`)));
check('every exercise is in the library', !missing.length, missing.join(' '));
check('every program has days, a method and a tagline', PROGRAMS.every(p => p.plan.length && p.method && p.tagline && p.days && p.weeks));
for (const want of ['Power building', 'Fat loss', 'Muscle building', 'Powerlifting', 'Gains', 'HYROX', 'Hybrid', 'Plyometrics', 'Olympic lifting', 'Strength & conditioning'])
  check(`has a ${want} program`, PROGRAMS.some(p => p.goal.startsWith(want)));
const vols = PROGRAMS.map(weeklySets);
check('different volumes across programs', new Set(vols.map(Math.round)).size >= PROGRAMS.length - 2, vols.map(Math.round).join());
const sig = p => p.plan.flatMap(dd => dd.items.map(it => it[0] + it[2])).sort().join();
check('no two programs have the same exercises and reps', new Set(PROGRAMS.map(sig)).size === PROGRAMS.length);

check('scheme: fixed reps', JSON.stringify(scheme(5, '3')) === '{"sets":5,"lo":3,"hi":3}');
check('scheme: rep range', JSON.stringify(scheme(3, '8-12')) === '{"sets":3,"lo":8,"hi":12}');
check('scheme: time or distance → none', scheme(3, '30s') === null && scheme(1, '1 km') === null && scheme(3, '10/side') === null);

// Program days rotate as training days are logged.
const P = byId('powerPump');
check('starts on day 1', currentDay(P, { log: [] }).index === 0);
check('moves on after a logged day', currentDay(P, { log: [{ day: 0, at: Date.now() - 2 * 864e5 }] }).index === 1);
check('stays on today once logged today', currentDay(P, { log: [{ day: 2, at: Date.now() }] }).doneToday === true);
check('wraps around', currentDay(P, { log: [{ day: 3, at: Date.now() - 864e5 }] }).index === 0);

// Program reps drive the progression: 10×10 at the same weight; add when all 10 sets are clean.
const T = Date.UTC(2026, 9, 1), sets = n => Array.from({ length: n }, (_, i) => ({ ex: 'squat', at: T + i * 6e4, kg: 60, reps: 10, good: 10, vl: 0.15, target: 10 }));
let r = nextFor(LIB.squat, sets(10), { scheme: scheme(10, '10') });
check('10×10: all clean → +5 kg, still 10 × 10', r.kg === 65 && r.sets === 10 && r.reps === 10 && r.action === 'add', JSON.stringify(r));
r = nextFor(LIB.squat, sets(4).map((s, i) => ({ ...s, reps: i < 1 ? 6 : 5, good: 5 })), { scheme: scheme(4, '4-6') });
check('range on a barbell lift: double progression inside the range', r.kg === 60 && r.reps === 6 && r.action === 'reps', JSON.stringify(r));

// Sign-up goal → program.
check('every goal starts a real program', GOALS.every(g => byId(g.program) && (!g.beginner || byId(g.beginner))));
check('every program except the 10×10 specialist block is reachable from a goal', PROGRAMS.filter(p => p.id !== 'inferno').every(p => GOALS.some(g => g.program === p.id || g.beginner === p.id)), PROGRAMS.filter(p => !GOALS.some(g => g.program === p.id || g.beginner === p.id)).map(p => p.id).join());
check('HYROX goal → Race Ready', pickProgram('hyrox') === 'raceReady' && pickProgram('hyrox', true) === 'raceReady');
check('new to lifting, build muscle → Gains Engine', pickProgram('muscle', true) === 'gainsEngine' && pickProgram('muscle') === 'hypertrophyLab');
check('default days spread through the week', defaultDays(3).join() === '1,3,5' && defaultDays(4).length === 4);
if (fail) { console.log(`${fail} FAILED`); process.exit(1); }
console.log('programs: all pass');
