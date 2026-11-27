// Athlete section: every sport and role builds a valid programme from real library exercises.
import { SPORTS, PHASES, buildProgram, parseId, roleOf } from '../js/athletes.js';
import { LIB } from '../js/library.js';
import { nextBlock } from '../js/refresh.js';
import { scheme } from '../js/programs.js';

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };

check('7 sports in batch 1', SPORTS.map(s => s.id).join() === 'cricket,football,hockey,mma,boxing,padel,tennis,squash'.replace('hockey,mma', 'hockey,mma'), SPORTS.map(s => s.id).join());
check('cricket has the three fast-bowling actions', ['fastSide', 'fastFront', 'fastMixed'].every(r => roleOf('cricket', r)));
check('football has all six positions', SPORTS.find(s => s.id === 'football').roles.length === 6);
const missing = SPORTS.flatMap(s => [...(s.protect || []), ...s.roles.flatMap(r => [...(r.power || []), ...(r.strength || []), ...(r.trunk || []), ...(r.protect || []), r.condition])].filter(id => id && !LIB[id]).map(id => `${s.id}:${id}`));
check('every exercise exists in the library', !missing.length, [...new Set(missing)].join(' '));

let n = 0, bad = [];
for (const s of SPORTS) for (const r of s.roles) for (const ph of PHASES) {
  const p = buildProgram(s.id, r.id, ph.id, LIB); n++;
  const days = { off: 3, pre: 2, in: 2 }[ph.id];
  if (!p || p.plan.length !== days || p.plan.some(d => d.items.length < 3 || d.items.some(it => !LIB[it[0]]))) bad.push(`${s.id}/${r.id}/${ph.id}`);
}
check(`all ${n} sport × role × phase programmes are valid`, !bad.length, bad.join(' '));

const mixed = buildProgram('cricket', 'fastMixed', 'off', LIB), side = buildProgram('cricket', 'fastSide', 'off', LIB);
const ids = p => p.plan.flatMap(d => d.items.map(i => i[0]));
check('mixed-action bowler gets more trunk-protection work than side-on', ids(mixed).filter(i => ['pallof', 'suitcaseCarry', 'backExtHold', 'sidePlank'].includes(i)).length > ids(side).filter(i => ['pallof', 'suitcaseCarry', 'backExtHold', 'sidePlank'].includes(i)).length);
check('mixed-action bowler is flagged for a technique review', /lumbar stress/.test(mixed.flag));
check('Nordic and Copenhagen run in every football phase', PHASES.every(ph => ['nordic', 'copenhagen'].every(x => ids(buildProgram('football', 'wide', ph.id, LIB)).includes(x))));
const off = buildProgram('football', 'cb', 'off', LIB), inn = buildProgram('football', 'cb', 'in', LIB);
const vol = p => p.plan.reduce((a, d) => a + d.items.reduce((b, i) => b + i[1], 0), 0);
check('in-season volume is well below off-season', vol(inn) < vol(off) * 0.6, `${vol(inn)} vs ${vol(off)}`);
check('pre-season power uses low reps', buildProgram('mma', 'striker', 'pre', LIB).plan[0].items.some(i => i[2] === '3-5'));
check('all-rounder volume is lower than a pure bowler', vol(buildProgram('cricket', 'allrounder', 'off', LIB)) < vol(side));
check('neck work in every MMA programme', PHASES.every(ph => ids(buildProgram('mma', 'allround', ph.id, LIB)).includes('neckIso')));
check('evidence gaps are carried for the app to show', /concussion/.test(buildProgram('mma', 'striker', 'off', LIB).gaps));
check('id round-trips', JSON.stringify(parseId('ath-cricket-fastMixed-pre')) === '{"sport":"cricket","role":"fastMixed","phase":"pre"}');
check('a monthly refresh works on athlete programmes', nextBlock(off, { block: 1, plan: off.plan }, { lib: LIB }).plan.length === 3);
check('timed and interval items are single pieces', ids(off).length && off.plan.flatMap(d => d.items).filter(i => LIB[i[0]].coach === 'intervals').every(i => i[1] === 1));
check('rep ranges feed the progression engine', scheme(4, '5-6') && off.plan[0].items[0][2] === '5-6');

if (fail) { console.log(`${fail} FAILED`); process.exit(1); }
console.log('athletes: all pass');
