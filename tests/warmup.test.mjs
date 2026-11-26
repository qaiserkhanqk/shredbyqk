// Warm-up sets and workout length.
import * as W from '../js/warmup.js';
import { LIB } from '../js/library.js';
import { byId } from '../js/programs.js';
import { fromUnit } from '../js/progression.js';

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };

let w = W.warmupSets(LIB.squat, 120);
check('heavy squat: bar, then 3 ramp sets under the work weight', w.length === 4 && w[0].kg === 20 && w.every((s, i) => !i || s.kg > w[i - 1].kg) && w.at(-1).kg < 120, JSON.stringify(w.map(s => s.kg)));
check('ramp sets get fewer reps as they get heavier', w.map(s => s.reps).join() === '10,5,3,1');
check('every warm-up is loadable, with plates', w.every(s => s.kg % 2.5 === 0 && s.plates));
check('line: "Bar × 10, 47.5 kg × 5, …"', /^Bar × 10, 47\.5 kg × 5, 72\.5 kg × 3, 95 kg × 1$/.test(W.warmupLine(w)), W.warmupLine(w));
check('spoken', W.warmupSpeech(w) === 'Warm up: the bar for 10, then 47.5 kilos for 5, then 72.5 kilos for 3, then 95 kilos for 1.', W.warmupSpeech(w));
check('moderate weight: two ramp sets', W.warmupSets(LIB.benchPress, 60).length === 3);
check('light weight: bar plus one', W.warmupSets(LIB.benchPress, 40).length === 2);
check('just the bar: no warm-up', W.warmupSets(LIB.benchPress, 20).length === 0);
check('dumbbells: one lighter set', JSON.stringify(W.warmupSets(LIB.dbRow, 30)) === JSON.stringify([{ kg: 15, reps: 8 }]));
check('curls: no warm-up', W.warmupSets(LIB.curl, 14).length === 0);
check('bodyweight: no warm-up', W.warmupSets(LIB.pushUp, 0).length === 0);
const lb = W.warmupSets(LIB.squat, fromUnit(225, 'lb'), 'lb');
check('pounds: 45 lb bar, 5 lb plates', /^Bar × 10, 90 lb × 5, 135 lb × 3, 180 lb × 1$/.test(W.warmupLine(lb, 'lb')), W.warmupLine(lb, 'lb'));

const pp = byId('powerPump').plan[0].items;
const mins = W.dayMinutes(pp, 7);
check('Power & Pump upper day: about an hour', mins >= 50 && mins <= 80, mins);
check('run item counts its minutes', W.itemSecs(['runEasy', 1, '40 min', 0]) === 40 * 60 + 15 + 60);
const f45 = W.fitTo(pp, 45, 7);
check('fit into 45 min: under the cap', f45.minutes <= 45, f45.minutes);
check('main lifts kept', f45.items[0][0] === 'benchPress' && f45.items[1][0] === 'bentRow');
check('accessories cut before anything else', f45.cut.length > 0 && f45.cut.every(c => !['benchPress', 'bentRow'].includes(c.id) || c.to >= 3), JSON.stringify(f45.cut));
const f30 = W.fitTo(pp, 30, 7);
check('fit into 30 min: drops accessories from the end', f30.items.length < pp.length && f30.minutes <= 32, `${f30.items.length} items, ${f30.minutes} min`);
check('no cut needed when it already fits', W.fitTo(pp, 200).cut.length === 0);

if (fail) { console.log(`${fail} FAILED`); process.exit(1); }
console.log('warmup: all pass');
