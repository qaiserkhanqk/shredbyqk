// QK remembers: follow-ups on pain, rough days, bests, skips, missed weeks, travel, Ramadan, milestones.
import { followUps, sessionFeel, returningAreas } from '../js/memory.js';
import { LIB } from '../js/library.js';

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };
const DAY = 864e5, NOW = new Date(2026, 10, 26, 12).getTime(); // a Thursday, local noon
const base = over => ({ profile: { name: 'Ali' }, sessions: [], prefs: {}, memory: { done: {} }, ...over });
const kinds = S => followUps(S, { now: NOW, lib: LIB }).map(f => f.kind);

// Pain: day 3, then weekly; done ones don't repeat.
const painS = since => base({ profile: { name: 'Ali', pain: ['knee'], painSince: { knee: NOW - since * DAY } } });
check('pain: 2 days in → not yet', !kinds(painS(2)).includes('pain'));
const f3 = followUps(painS(3), { now: NOW, lib: LIB })[0];
check('pain: day 3 → "How\'s your knee, Ali?" with Better / Same / Worse and the date they told QK', f3?.kind === 'pain' && /How's your knee, Ali\?/.test(f3.title) && f3.actions.map(a => a.label).join() === 'Better,Same,Worse' && /You told me it hurt on/.test(f3.text), JSON.stringify(f3));
check('pain: answered → not asked again the same week', !kinds({ ...painS(5), profile: { ...painS(5).profile, painAsked: { knee: NOW - 2 * DAY }, painAskCount: { knee: 1 } } }).includes('pain'));
check('pain: a week after the last answer → asked again', kinds({ ...painS(12), profile: { ...painS(12).profile, painAsked: { knee: NOW - 7 * DAY }, painAskCount: { knee: 1 } } }).includes('pain'));
check('pain: "same" before → suggests a physio', /see a physio/.test(followUps({ ...painS(12), profile: { ...painS(12).profile, painAsked: { knee: NOW - 8 * DAY }, painAskCount: { knee: 1 }, painSame: { knee: 1 } } }, { now: NOW, lib: LIB })[0].text));
check('pain: marked done → gone', !kinds({ ...painS(3), memory: { done: { 'pain:knee:0': NOW } } }).includes('pain'));

// Rough yesterday.
check('rough day yesterday (check-in) → "Feeling better today?"', kinds(base({ checkinLog: [{ at: NOW - DAY, level: 'rest' }] })).includes('rough'));
check('rough morning card yesterday → asked too; a good day → not', kinds(base({ readiness: [{ at: NOW - DAY, feel: 'rough' }] })).includes('rough') && !kinds(base({ checkinLog: [{ at: NOW - DAY, level: 'normal' }] })).includes('rough'));

// Personal best.
const prS = base({ sessions: [{ ex: 'benchPress', at: NOW - 10 * DAY, kg: 80, reps: 5 }, { ex: 'benchPress', at: NOW - 2 * DAY, kg: 82.5, reps: 5 }] });
const pr = followUps(prS, { now: NOW, lib: LIB }).find(f => f.kind === 'pr');
check('best: last session\'s bench PR is celebrated next time', /Barbell Bench Press: 82.5 kg × 5/.test(pr?.text || ''), JSON.stringify(pr));
check('best: not the first time a lift is done, not today', !kinds(base({ sessions: [{ ex: 'benchPress', at: NOW - 2 * DAY, kg: 82.5, reps: 5 }] })).includes('pr'));

// Skips.
check('skip once → "Not a fan of …?" with Swap it', followUps(base({ prefs: { skips: { reverseLunge: [NOW - 3 * DAY] } } }), { now: NOW, lib: LIB }).find(f => f.kind === 'skip')?.actions[0].act === 'skip:reverseLunge:swap');

// Missed week.
const lastWeekMon = NOW - ((new Date(NOW).getDay() + 6) % 7) * DAY - 7 * DAY;
check('missed: trained before, nothing last week → "We missed you"', kinds(base({ program: { id: 'x' }, sessions: [{ ex: 'squat', at: lastWeekMon - 3 * DAY, kg: 60, reps: 5 }] })).includes('missed'));
check('missed: trained last week → no', !kinds(base({ program: { id: 'x' }, sessions: [{ ex: 'squat', at: lastWeekMon - 3 * DAY, kg: 60, reps: 5 }, { ex: 'squat', at: lastWeekMon + DAY, kg: 60, reps: 5 }] })).includes('missed'));

// Travel, Ramadan, milestone.
check('travel ended → welcome back; Ramadan ended → Eid Mubarak', kinds(base({ profile: { travel: { kind: 'hotel', until: NOW - DAY } } })).includes('travel') && kinds(base({ profile: { ramadan: { until: NOW - 2 * DAY } } })).includes('ramadan'));
check('one month with QK', kinds(base({ sessions: [{ ex: 'squat', at: NOW - 31 * DAY, reps: 5, good: 5 }, { ex: 'squat', at: NOW - DAY, reps: 5, good: 4 }] })).includes('milestone'));
check('order: pain first', kinds({ ...painS(4), checkinLog: [{ at: NOW - DAY, level: 'rest' }] })[0] === 'pain');

// How was it?
check('feel: two "too hard" → one set fewer; two "too easy" → one more; mixed → nothing', sessionFeel([{ at: NOW - 3 * DAY, rating: 'hard' }, { at: NOW - DAY, rating: 'hard' }], { now: NOW })?.setDelta === -1 && sessionFeel([{ at: NOW - 3 * DAY, rating: 'easy' }, { at: NOW - DAY, rating: 'easy' }], { now: NOW })?.setDelta === 1 && sessionFeel([{ at: NOW - 3 * DAY, rating: 'hard' }, { at: NOW - DAY, rating: 'right' }], { now: NOW }) === null);
check('returning after pain: 14 days', returningAreas({ painCleared: { knee: NOW - 5 * DAY, back: NOW - 20 * DAY } }, NOW).join() === 'knee');

if (fail) { console.log(`${fail} FAILED`); process.exit(1); }
console.log('memory: all pass');
