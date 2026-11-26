// Monthly refresh: same formula, new exercises, rotating reps, volume from what the lifter did, swaps stick.
import * as R from '../js/refresh.js';
import { PROGRAMS, byId } from '../js/programs.js';
import { LIB } from '../js/library.js';

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };

const alts = R.alternatives('benchPress', LIB);
check('bench alternatives are other bench-pattern presses', alts.length >= 4 && alts.every(id => LIB[id].pattern === 'bench'), alts.join());
check('avoided exercises never offered', !R.alternatives('benchPress', LIB, { avoid: [alts[0]] }).includes(alts[0]));
const hy = R.alternatives('hyroxSki', LIB);
check('non-camera exercises get alternatives of the same kind', hy.every(id => (LIB[id].kind || 'gym') === 'hyrox'), hy.join());

check('reps: volume month', R.repsFor('8-12', 'volume') === '10-15' && R.repsFor('5', 'volume') === '8');
check('reps: strength month', R.repsFor('8-12', 'strength') === '6-8' && R.repsFor('5', 'strength') === '3');
check('reps: time and distance unchanged', R.repsFor('30s', 'volume') === '30s' && R.repsFor('1 km', 'strength') === '1 km');
check('phases rotate', [1, 2, 3, 4].map(R.phaseOf).join() === 'base,volume,strength,base');

const pp = byId('powerPump');
const b2 = R.nextBlock(pp, { block: 1, plan: pp.plan }, { lib: LIB });
check('month 2: same days and slot count', b2.block === 2 && b2.plan.length === pp.plan.length && b2.plan.every((d, i) => d.items.length === pp.plan[i].items.length));
check('month 2: most exercises are new', b2.changes.length >= pp.plan.flat().length && b2.changes.length >= 15, b2.changes.length);
const samePattern = b2.plan.every((d, i) => d.items.every((it, j) => { const o = LIB[pp.plan[i].items[j][0]], n = LIB[it[0]]; return !o.pattern || o.pattern === n.pattern; }));
check('month 2: every slot keeps its movement pattern', samePattern);
check('month 2: volume month reps', b2.phase === 'volume' && b2.plan[0].items[0][2] === '6-9', b2.plan[0].items[0][2]);
const b3 = R.nextBlock(pp, b2, { lib: LIB });
check('month 3: no exercise repeats last month in the same slot', b3.plan.every((d, i) => d.items.every((it, j) => it[0] !== b2.plan[i].items[j][0] || !R.alternatives(it[0], LIB).length)));
check('month 3: strength reps', b3.phase === 'strength');

const pl = byId('platformPrep'), p2 = R.nextBlock(pl, { block: 1, plan: pl.plan }, { lib: LIB });
check('powerlifting keeps the competition lift first', p2.plan.every((d, i) => d.items[0][0] === pl.plan[i].items[0][0]));

const less = R.nextBlock(pp, { block: 1, plan: pp.plan }, { lib: LIB, compliance: 0.4 });
check('missed sessions → fewer accessory sets', less.volume === 'less' && less.plan[0].items[3][1] === pp.plan[0].items[3][1] - 1 && /fewer days/.test(less.note));
const more = R.nextBlock(pp, { block: 1, plan: pp.plan }, { lib: LIB, compliance: 1, clean: 0.9 });
check('every session, clean form → +1 set on main lifts', more.volume === 'more' && more.plan[0].items[0][1] === pp.plan[0].items[0][1] + 1);

const avoid = ['inclinePress'];
const av = R.nextBlock(pp, { block: 1, plan: pp.plan }, { lib: LIB, avoid });
check('swapped-out exercises never come back', av.plan.every(d => d.items.every(it => !avoid.includes(it[0]))));
const sw = R.swapIn(pp.plan, 'benchPress', 'dbBench');
check('swap replaces it everywhere, keeps sets and reps', sw[0].items[0][0] === 'dbBench' && sw[0].items[0][1] === 4 && sw[0].items[0][2] === '4-6');
check('every program refreshes without errors', PROGRAMS.every(p => R.nextBlock(p, { block: 1, plan: p.plan }, { lib: LIB }).plan.every(d => d.items.every(it => LIB[it[0]]))));

const D = 864e5, now = Date.UTC(2026, 10, 26);
check('compliance: 6 of 12 planned days', R.compliance({ log: Array.from({ length: 6 }, (_, i) => ({ at: now - i * 3 * D })) }, 3, { now }) === 0.5);

if (fail) { console.log(`${fail} FAILED`); process.exit(1); }
console.log('refresh: all pass');
