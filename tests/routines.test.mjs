// Warm-up drills, post-workout stretches and recovery routines.
import * as R from '../js/routines.js';
import { timeline, callout, minutes, MOVES } from '../js/classes.js';
import { LIB } from '../js/library.js';

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };

check('every linked library exercise exists', Object.entries(R.MOVES).every(([, m]) => !m.lib || LIB[m.lib]), Object.entries(R.MOVES).filter(([, m]) => m.lib && !LIB[m.lib]).map(([k]) => k).join());
check('routine moves are part of the class engine', Object.keys(R.MOVES).every(k => MOVES[k]));
check('six recovery routines, 6–16 minutes each', R.ROUTINES.length === 6 && R.ROUTINES.every(r => minutes(r) >= 5 && minutes(r) <= 16), R.ROUTINES.map(r => `${r.id}:${minutes(r)}`).join());

const legDay = ['squat', 'rdl', 'lunge', 'calfRaise'], upperDay = ['benchPress', 'bentRow', 'press', 'curl'];
check('session type: leg day', R.sessionType(legDay, LIB) === 'lower');
check('session type: upper day', R.sessionType(upperDay, LIB) === 'upper');
check('session type: mixed', R.sessionType([...legDay, ...upperDay], LIB) === 'full');
check('session type: run', R.sessionType(['runEasy'], LIB) === 'run');

const wu = R.warmupFor(legDay, LIB), wt = timeline(wu);
check('leg-day drills: dynamic, about 4–6 minutes', /Leg-day/.test(wu.name) && wt.total >= 200 && wt.total <= 400, wt.total);
check('drills are dynamic only (no long static holds)', wu.blocks[0].moves.every(([m]) => !R.MOVES[m].muscles));
check('upper-day drills open the shoulders', R.warmupFor(upperDay, LIB).blocks[0].moves.some(([m]) => m === 'pullAparts'));

const st = R.stretchFor(legDay, LIB), sm = st.blocks[0].moves.map(([m]) => m);
check('leg-day stretch covers quads, hamstrings, glutes and calves', ['Quads', 'Hamstrings', 'Glutes', 'Calves'].every(mu => sm.some(m => R.MOVES[m].muscles?.includes(mu))), sm.join());
check('ends with child\'s pose and slow breathing', sm.slice(-2).join() === 'childPose,breathe');
const us = R.stretchFor(upperDay, LIB).blocks[0].moves.map(([m]) => m);
check('upper-day stretch covers chest and back', us.some(m => R.MOVES[m].muscles?.includes('Chest')) && us.some(m => R.MOVES[m].muscles?.includes('Back')), us.join());
check('cool-down is 5–10 minutes', minutes(st) >= 5 && minutes(st) <= 10, minutes(st));
check('nothing trained → a general stretch', R.stretchFor([], LIB).blocks[0].moves.length >= 4);

const segs = timeline(st).segs, q = segs.filter(s => s.move === 'quadStretch');
check('one-sided stretch: both sides, same hold', q.length === 2 && q[0].side === 1 && q[1].side === 2 && q[0].secs === q[1].secs);
check('QK says "switch sides"', callout(q[1]) === 'Switch sides.' && /First side\.$/.test(callout(q[0])));
check('routines have no class warm-up or cool-down added', timeline(R.ROUTINES[0]).segs.every(s => s.kind === 'hold'));
check('musclesOf ranks the most-trained first', R.musclesOf(['squat', 'lunge', 'curl'], LIB)[0] === 'Quads');

if (fail) { console.log(`${fail} FAILED`); process.exit(1); }
console.log('routines: all pass');
