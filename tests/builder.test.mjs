// Workout builder: defaults, validation, finalize, search, templates; built programs work with the rest.
import * as B from '../js/builder.js';
import { LIB } from '../js/library.js';
import { byId, scheme, currentDay } from '../js/programs.js';
import { nextBlock } from '../js/refresh.js';
import { nextFor } from '../js/progression.js';

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };

check('defaults: barbell lift 4 × 6-8', B.defaults(LIB.squat).join() === '4,6-8,150');
check('defaults: dumbbell isolation 3 × 12-15', B.defaults(LIB.curl).join() === '3,12-15,60');
check('defaults: plank is a timed hold', /s$/.test(B.defaults(LIB.plank)[1]));
check('defaults: a run is one timed piece', B.defaults(LIB.runEasy).join() === '1,20 min,0');

const d = B.blank(1);
check('blank program has an id and one empty day', d.id === 'my-1' && d.plan.length === 1 && d.custom);
check('empty program explains what is missing', B.validate(d, LIB).join(' ').includes('Give it a name') && B.validate(d, LIB).join(' ').includes('no exercises'));
d.name = 'QK Signature'; d.plan[0].items.push(['squat', ...B.defaults(LIB.squat)], ['curl', 3, '8-12', 60], ['plank', 3, '45s', 30], ['lunge', 3, '10/side', 60]);
check('valid program passes', B.validate(d, LIB).length === 0, B.validate(d, LIB).join(' | '));
d.plan[0].items.push(['curl', 0, 'lots', 60]);
check('bad sets and reps are caught', B.validate(d, LIB).length === 2, B.validate(d, LIB).join(' | '));
d.plan[0].items.pop();
d.plan.push({ name: '', focus: '', items: [] }, { name: ' Pull day ', focus: '', items: [['bentRow', '4', '8', '90']] });
const f = B.finalize(d);
check('finalize drops empty days, names days, numbers sets', f.plan.length === 2 && f.plan[1].name === 'Pull day' && f.plan[1].items[0][1] === 4 && f.days === 2 && /2 days/.test(f.tagline));

const hits = B.search(LIB, 'dumbbell chest');
check('search by equipment and muscle', hits.length > 0 && hits.every(x => /dumbbell/i.test(x.equipment + x.name) && /chest/i.test(x.muscles.join(' ') + x.name)), hits.map(x => x.id).join());
check('search puts form-checked exercises first', B.search(LIB, 'squat')[0].pattern);

const t = B.fromTemplate(byId('powerPump'), 2);
check('copy a built-in program to edit it', t.id === 'my-2' && t.custom && t.plan.length === 4 && t.name === 'Power & Pump (my version)' && byId('powerPump').name === 'Power & Pump');
check('move exercise up and down', B.move(['a', 'b', 'c'], 2, -1).join() === 'a,c,b' && B.move(['a', 'b'], 0, -1).join() === 'a,b');

// A built program works with the rest of the app.
check('days rotate', currentDay(f, { log: [] }).day.name === 'Day 1');
check('its reps drive QK\'s weights', nextFor(LIB.squat, [0, 1, 2, 3].map(i => ({ ex: 'squat', at: 1e12 + i, kg: 60, reps: 8, good: 8, vl: 0.1, target: 6 })), { scheme: scheme(4, '6-8') }).kg === 62.5 + 2.5);
const nb = nextBlock(f, { block: 1, plan: f.plan }, { lib: LIB });
check('it gets a monthly refresh like any program', nb.plan.length === 2 && nb.changes.length >= 1);

if (fail) { console.log(`${fail} FAILED`); process.exit(1); }
console.log('builder: all pass');
