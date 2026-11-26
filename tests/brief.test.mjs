// QK's plan: plain instructions from last week's sets.
import * as B from '../js/brief.js';
import { LIB } from '../js/library.js';
import { scheme } from '../js/programs.js';

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };

const D = 864e5, T = Date.UTC(2026, 10, 16); // a Monday
const set3 = (ex, d, kg, reps, extra = {}) => [0, 1, 2].map(i => ({ ex, at: T + d * D + i * 6e4, kg, reps, good: reps, vl: 0.15, target: 8, ...extra }));
const sets = [...set3('squat', 0, 60, 8), ...set3('benchPress', 0, 40, 8, { good: 5 }), ...set3('curl', 1, 12, 9), ...set3('rdl', 2, 70, [5, 5, 5][0], { target: 8 }), ...set3('rdl', 4, 70, 6, { target: 8 })];
const rows = B.planRows(['squat', 'benchPress', 'curl', 'rdl', 'legPress', 'plank'], { lib: LIB, sets });
const by = Object.fromEntries(rows.map(r => [r.id, r]));
check('squat goes up 5 kg', by.squat.change === 'up' && by.squat.line === '3 × 8 · 65 kg' && by.squat.tag === '▲ 5 kg', JSON.stringify(by.squat));
check('bench stays (form slipped)', by.benchPress.change === 'same' && /form/.test(by.benchPress.why));
check('curls add reps', by.curl.change === 'reps' && by.curl.tag === '+ reps');
check('rdl backs off after two misses', by.rdl.change === 'down' && by.rdl.tag.startsWith('▼'), JSON.stringify(by.rdl));
check('new lift asks for a starting weight', by.legPress.change === 'new' && /pick weight/.test(by.legPress.line));
check('bodyweight hold has no weight target', by.plank.change === 'none');
check('weekly summary', B.summary(rows) === '1 lift goes up, 1 adds reps, 1 stays the same, 1 backs off.', B.summary(rows));
check('spoken target, kilos', B.spokenTarget(by.squat) === 'Today: 3 sets of 8 at 65 kilos. Up 5 from last time.', B.spokenTarget(by.squat));
const lb = B.planRows(['squat'], { lib: LIB, sets: set3('squat', 0, 135 * 0.45359237, 8), unit: 'lb' })[0];
check('spoken target, pounds', /at 145 pounds\. Up 10 from last time\./.test(B.spokenTarget(lb, 'lb')), B.spokenTarget(lb, 'lb'));
const light = B.planRows(['squat'], { lib: LIB, sets, light: true });
check('light week summary', light[0].change === 'light' && /Light week/.test(B.summary(light)));
const prog = B.planRows(['squat'], { lib: LIB, sets, schemeFor: () => scheme(5, '5') })[0];
check('program scheme drives the target', prog.line === '5 × 5 · 65 kg', prog.line);
check('weeks start on Monday', B.weekOf(T) === B.weekOf(T + 6 * D + 3600e3) && B.weekOf(T + 7 * D) === B.weekOf(T) + 1);
const pw = B.programWeek({ start: T }, { weeks: 8 }, T + 15 * D);
check('program week', pw.week === 3 && pw.of === 8 && !pw.finished);
check('program finished', B.programWeek({ start: T }, { weeks: 8 }, T + 60 * D).finished);

if (fail) { console.log(`${fail} FAILED`); process.exit(1); }
console.log('brief: all pass');
