// Weight logging and the weekly message to QK. Run: node tests/share.test.mjs
import { lastLoad, lastLoadText, weekSummary } from '../js/share.js';
import { silentWav } from '../js/sukoon.js';
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };
const DAY = 864e5, now = new Date('2026-11-24T12:00:00').getTime();
const set = (d, ex, o = {}) => ({ at: now - d * DAY, ex, name: ex === 'squat' ? 'Back squat' : 'Hip thrust', reps: 10, good: 8, faults: {}, ...o });

const hist = [set(10, 'squat', { kg: 60 }), set(3, 'squat', { kg: 65 }), set(2, 'squat'), set(1, 'hipThrust', { kg: 80 })];
check('last load: most recent set with a weight', lastLoad(hist, 'squat').kg === 65);
check('last load: none for an unlogged exercise', lastLoad(hist, 'rdl') === null);
check('last load text', lastLoadText({ kg: 62.5, reps: 8 }) === 'Last time: 62.5 kg × 8' && lastLoadText(null) === '');

const S = { profile: { name: 'Sara', weeklyGoal: 4 },
  sessions: [...hist, set(2, 'squat', { faults: { sq_valgus: 3 } }), set(9, 'squat', { good: 5 }), set(1, 'squat', { demo: true, good: 0 }), set(1, 'squat', { edited: true, good: 0 })],
  checkins: [], readiness: [{ at: now - DAY }], calm: [{ at: now - DAY }, { at: now - 20 * DAY }] };
const txt = weekSummary(S, { now, faultName: id => id === 'sq_valgus' ? 'Push your knees out' : id, light: 'green' });
check('week: header names the client', txt.startsWith('Shred weekly update from Sara'));
check('week: days trained vs plan, demo sets ignored', /Trained 3 of 4 planned days · 5 sets/.test(txt), txt.split('\n')[1]);
check('week: form score leaves out demo and hand-corrected sets, compares with last week', /Form score 80% \(last week 65%\)/.test(txt), txt);
check('week: top fault in plain words', /Most common fault: Push your knees out \(3×\)/.test(txt));
check('week: new best weight vs before this week', /New best weights: Back squat 65 kg/.test(txt));
check('week: readiness, rehab light and Sukoon counts (this week only)', /Readiness check-ins: 1/.test(txt) && /Rehab pain light: green/.test(txt) && /Sukoon sessions: 1/.test(txt));
check('week: empty history still gives a message', /Trained 0 of 4/.test(weekSummary({ profile: {} }, { now })));
check('silent WAV still valid', silentWav().length === 844);
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
