// Personalisation: readiness, equipment, pain, likes/skips, starting volume, weak points, missed sessions, voice.
import * as P from '../js/personal.js';
import { parse, words2num } from '../js/voicecmd.js';
import { LIB } from '../js/library.js';
import { byId } from '../js/programs.js';
import { dayMinutes } from '../js/warmup.js';
import { liftClass } from '../js/progression.js';

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };
const DAY = 864e5, NOW = Date.UTC(2026, 10, 26, 12); // a Thursday

// 1. Readiness
check('readiness: good sleep, no soreness, high energy → ready, nothing lighter', P.readiness({ sleep: 'good', sore: 'none', energy: 'high' }).level === 'ready' && P.readiness({ sleep: 'good', sore: 'none', energy: 'high' }).load === 1);
check('readiness: all OK → normal', P.readiness({ sleep: 'ok', sore: 'some', energy: 'ok' }).level === 'normal');
const easy = P.readiness({ sleep: 'bad', sore: 'some', energy: 'ok' });
check('readiness: poor sleep + a bit sore → easy (−5%, one set off extras)', easy.level === 'easy' && easy.load === 0.95 && easy.setDelta === -1, JSON.stringify(easy));
const rough = P.readiness({ sleep: 'bad', sore: 'very', energy: 'low' });
check('readiness: everything bad → rest day offer (−10%)', rough.level === 'rest' && rough.load === 0.9 && /recovery/.test(rough.note));
check('readiness: high resting heart rate nudges it down and says so', P.readiness({ sleep: 'ok', sore: 'some', energy: 'ok' }, { restHr: 72, baseHr: 60 }).level === 'easy' && /12 beats above/.test(P.readiness({ sleep: 'ok', sore: 'some', energy: 'ok' }, { restHr: 72, baseHr: 60 }).note));
const day = byId('powerPump').plan[0].items, ri = P.readyItems(day, easy, LIB);
const bigLift = id => /^big/.test(liftClass(LIB[id]) || '');
check('readiness: main lifts keep their sets, extras lose one (never below 2)', day.every((it, i) => (bigLift(it[0]) || i === 0 ? ri[i][1] === it[1] : ri[i][1] === Math.max(2, it[1] - 1))) && ri.some((it, i) => it[1] < day[i][1]), JSON.stringify(ri.map(it => it[1])));
check('readiness: a normal day changes nothing', P.readyItems(day, P.readiness({}), LIB) === day);

// 2. Equipment
check('equipment: full gym (nothing ticked) can do everything', P.canDo(LIB, 'benchPress') && P.canDo(LIB, 'cableFly', []));
check('equipment: dumbbells only → no barbell bench, yes dumbbell bench, yes push-ups', !P.canDo(LIB, 'benchPress', ['dumbbells']) && P.canDo(LIB, 'dbBench', ['dumbbells']) && P.canDo(LIB, 'pushUp', ['dumbbells']));
const home = P.personalDay(byId('massMonster').plan[0].items, LIB, { have: ['dumbbells', 'bench'] });
check('equipment: Mass Monster day 1 with dumbbells and a bench → every exercise doable', home.items.every(it => P.canDo(LIB, it[0], ['dumbbells', 'bench'])), home.items.map(it => `${it[0]}:${LIB[it[0]].equipment}`).join(' '));
check('equipment: swaps keep sets and reps, and say why', home.swaps.length > 0 && home.swaps.every(s => s.why === 'equipment') && home.items.every((it, i) => it[1] === byId('massMonster').plan[0].items[i][1]));
check('equipment: no exercise twice after swapping', new Set(home.items.map(it => it[0])).size === home.items.length);

// 3. Pain
const sh = P.personalDay(byId('powerPump').plan[0].items, LIB, { pain: ['shoulder'] });
check('pain: shoulder → no overhead press or dips; two rehab moves first', !sh.items.some(it => ['press', 'dip'].includes(LIB[it[0]].pattern)) && sh.items[0][0] === 'bandER' && sh.items[1][0] === 'bandPullApart', sh.items.map(it => it[0]).join(' '));
const kn = P.personalDay(byId('massMonster').plan[3].items, LIB, { pain: ['knee'] });
check('pain: knee → no lunges or split squats, rehab added', !kn.items.some(it => LIB[it[0]].pattern === 'lunge') && kn.items.some(it => it[0] === 'spanishSquat'), kn.items.map(it => it[0]).join(' '));
const bk = P.personalDay(byId('strengthBuilder').plan[2].items, LIB, { pain: ['back'] });
check('pain: lower back → no conventional deadlift or good mornings', !bk.items.some(it => ['deadlift', 'goodMorning'].includes(it[0])), bk.items.map(it => it[0]).join(' '));
check('pain: every area has real rehab exercises', Object.values(P.PAIN).every(a => a.rehab.every(id => LIB[id])));

// 4. Likes and skips
check('skips: twice in 4 weeks → dropped; once, or long ago → kept', P.skipDrops({ a: [NOW - DAY, NOW - 9 * DAY], b: [NOW - DAY], c: [NOW - 40 * DAY, NOW - 50 * DAY] }, { now: NOW }).join() === 'a');
const sess = [...[1, 3, 5, 8].map(d => ({ ex: 'hipThrust', at: NOW - d * DAY, reps: 10 })), ...[1, 3].map(d => ({ ex: 'squat', at: NOW - d * DAY, reps: 5 }))];
check('favourites: done on 4+ days in 8 weeks', P.favourites(sess, { now: NOW }).join() === 'hipThrust');

// 5. Starting volume
check('cautious start: new lifter or 50+', P.cautious({ experience: 'new' }) && P.cautious({ age: 55 }) && !P.cautious({ age: 30, experience: 'trained' }));
check('light week every 5 weeks at 50+, else 7', P.lightEvery({ age: 52 }) === 5 && P.lightEvery({ age: 30 }) === 7);
const st = P.startItems(day, LIB, { age: 60 }, 1);
check('cautious start: month 1 extras −1 set, main lifts untouched; month 2 back to full', st[0][1] === day[0][1] && st.slice(2).some((it, i) => it[1] < day[i + 2][1]) && P.startItems(day, LIB, { age: 60 }, 2) === day);

// 6. Weak points
const faulty = [0, 2, 5].map(d => ({ ex: 'squat', at: NOW - d * DAY, reps: 5, kg: 100, faults: { sq_shift: 2 } }));
const wpF = P.weakPoints(faulty, LIB, { now: NOW, plan: [] });
check('weak points: squat shift in 3 sets → single-leg work, with the reason', wpF[0]?.id === 'bulgarian' && /one side/.test(wpF[0].why), JSON.stringify(wpF));
check('weak points: a fault seen twice is not enough', P.weakPoints(faulty.slice(0, 2), LIB, { now: NOW }).length === 0);
const lift = (ex, kgEarly, kgLate) => [{ ex, at: NOW - 35 * DAY, kg: kgEarly, reps: 5 }, { ex, at: NOW - 5 * DAY, kg: kgLate, reps: 5 }];
const stall = [...lift('benchPress', 80, 80), ...lift('squat', 100, 110), ...lift('deadlift', 120, 130), ...lift('press', 50, 55)];
const wpS = P.weakPoints(stall, LIB, { now: NOW, plan: byId('powerPump').plan });
check('weak points: bench stuck 6 weeks while others rose → extra chest exercise not already in the plan', wpS.length === 1 && LIB[wpS[0].id].muscles[0] === 'Chest' && !byId('powerPump').plan.some(d => d.items.some(it => it[0] === wpS[0].id)) && /Barbell Bench Press hasn't gone up/.test(wpS[0].why), JSON.stringify(wpS));
check('weak points: everything stuck (a hard block) → no blame on one lift', P.weakPoints([...lift('benchPress', 80, 80), ...lift('squat', 100, 100), ...lift('deadlift', 120, 120)], LIB, { now: NOW }).length === 0);
const added = P.addWeak(byId('powerPump').plan, wpS);
check('weak points: added once, 3 × 8-12, to the lightest session; original plan untouched', added.flatMap(d => d.items).filter(it => it[0] === wpS[0].id).length === 1 && byId('powerPump').plan.flatMap(d => d.items).length + 1 === added.flatMap(d => d.items).length);

// 7. Missed sessions (Mon/Tue/Thu/Fri plan, 4 a week; today Thursday)
const mon = NOW - 3 * DAY;
check('missed: trained Mon, missed Tue, Thu+Fri left for 3 sessions → behind by 1', JSON.stringify(P.behind([{ day: 0, at: mon }], { perWeek: 4, weekdays: [1, 2, 4, 5], now: NOW })) === JSON.stringify({ behind: 1, missedDays: [2], left: 2 }), JSON.stringify(P.behind([{ day: 0, at: mon }], { perWeek: 4, weekdays: [1, 2, 4, 5], now: NOW })));
check('missed: days before the program started never count (started today, Thursday)', P.behind([], { perWeek: 4, weekdays: [1, 2, 4, 5], now: NOW, since: NOW - 3600e3 }) === null);
check('missed: started Tuesday, missed Tuesday → behind', P.behind([], { perWeek: 4, weekdays: [1, 2, 4, 5], now: NOW, since: NOW - 2 * DAY })?.missedDays.join() === '2');
check('rehab warm-ups are not main lifts: rescue lifts go after them', (() => { const today = [['bandER', 2, '12', 45, 'Rehab: easy'], ['bandPullApart', 2, '12', 45, 'Rehab: easy'], ['dbBench', 4, '6-8', 120], ['dbFly', 3, '12', 60]]; const r = P.rescue(today, [['squat', 4, '6-8', 180], ['legPress', 3, '10', 90]], LIB, { maxMinutes: 90 }); return r.items[0][0] === 'bandER' && r.items[1][0] === 'bandPullApart' && r.items[2][0] === 'dbBench' && r.items[3][0] === 'squat'; })());
check('missed: on track → nothing', P.behind([{ day: 0, at: mon }, { day: 1, at: mon + DAY }], { perWeek: 4, weekdays: [1, 2, 4, 5], now: NOW }) === null);
check('missed: a merged session counts twice', P.behind([{ day: 0, at: mon, merged: 1 }], { perWeek: 4, weekdays: [1, 2, 4, 5], now: NOW }) === null);
check('missed: extra session on an off day counts too', P.behind([{ day: 0, at: mon }, { day: 1, at: mon + 2 * DAY }], { perWeek: 4, weekdays: [1, 2, 4, 5], now: NOW }) === null);
const pp = byId('powerPump').plan, rs = P.rescue(pp[1].items, pp[2].items, LIB, { maxMinutes: 85 });
check('rescue: next session\'s main lifts join today, one set lighter', rs.added.length >= 1 && rs.added.every(id => rs.items.find(it => it[0] === id)[1] === Math.max(2, pp[2].items.find(it => it[0] === id)[1] - 1)), JSON.stringify(rs.added));
check('rescue: stays under the time limit', dayMinutes(rs.items, 9) <= 85 + 9);
check('rescue: no exercise twice', new Set(rs.items.map(it => it[0])).size === rs.items.length);

// 8. Time per day
check('time: one-off cap wins, else the weekday budget', P.minutesFor({ 4: 45 }, 30, NOW) === 30 && P.minutesFor({ 4: 45 }, null, NOW) === 45 && P.minutesFor({}, null, NOW) === null);

// 9. Voice commands
check('voice: numbers in words and digits', words2num('eighty') === 80 && words2num('one hundred and twenty two point five') === 122.5 && words2num('sixty two and a half') === 62.5 && words2num('80 kg') === 80);
check('voice: "eighty kilos" → weight 80 kg', JSON.stringify(parse('eighty kilos')) === JSON.stringify({ cmd: 'weight', kg: 80, unit: 'kg' }));
check('voice: "185 pounds" → weight in lb', parse('185 pounds')?.unit === 'lb' && parse('185 pounds')?.kg === 185);
check('voice: next / skip / done / heavier / lighter', ['next exercise', 'skip this one', "I'm done", 'go heavier', 'make it lighter'].map(t => parse(t)?.cmd).join() === 'next,skip,done,heavier,lighter');
check('voice: Urdu words (agla, chhor do, bas, bhari, halka)', ['agla', 'chhor do', 'bas', 'bhari karo', 'halka'].map(t => parse(t)?.cmd).join() === 'next,skip,done,heavier,lighter');
check('voice: random talk is ignored', parse('what a nice day') === null && parse('') === null);

// 11. Coming back after a break
const trainedOn = (...daysAgo) => daysAgo.map(d => ({ ex: 'squat', at: NOW - d * DAY, kg: 100, reps: 5 }));
check('break: trained 3 days ago → nothing changes', P.welcomeBack(trainedOn(3, 5, 7), { now: NOW }) === null);
const wb3 = P.welcomeBack(trainedOn(20, 22), { now: NOW });
check('break: 3 weeks off → first session back at 90%, 2 sessions to ramp', wb3?.load === 0.9 && wb3.of === 2 && wb3.session === 1 && /Welcome back/.test(wb3.note), JSON.stringify(wb3));
const wb6 = P.welcomeBack(trainedOn(45, 47), { now: NOW });
check('break: 6 weeks off → 85% and one set fewer on extras', wb6?.load === 0.85 && wb6.setDelta === -1 && wb6.of === 3);
check('break: 10 weeks off → 75%, 4 sessions to ramp', P.welcomeBack(trainedOn(70), { now: NOW })?.load === 0.75);
const ramp = P.welcomeBack(trainedOn(2, 30, 32), { now: NOW });
check('break: ramps up each session back (2nd of 3 after 4 weeks off: 90%)', ramp?.session === 2 && ramp.load === 0.9, JSON.stringify(ramp));
check('break: done ramping → normal', P.welcomeBack(trainedOn(1, 3, 5, 40), { now: NOW }) === null);
check('break: no history → nothing', P.welcomeBack([], { now: NOW }) === null);
check('combine: lightest load and fewest sets win, notes kept', JSON.stringify(P.combine({ load: 0.95, setDelta: -1, note: 'a' }, null, { load: 0.9, setDelta: 0, note: 'b' })) === JSON.stringify({ level: 'normal', load: 0.9, setDelta: -1, note: 'a b' }));

// 12. Home weights ceiling
check('ceiling: 25 kg asked, dumbbells only go to 20 → 20 kg, harder with reps and tempo', P.capLoad(LIB, 'dbBench', 25, { dumbbells: 20 })?.kg === 20 && /3 seconds/.test(P.capLoad(LIB, 'dbBench', 25, { dumbbells: 20 }).note));
check('ceiling: under the limit, or a barbell lift → nothing', P.capLoad(LIB, 'dbBench', 18, { dumbbells: 20 }) === null && P.capLoad(LIB, 'benchPress', 100, { dumbbells: 20 }) === null);

// 13. Pain re-check
check('pain re-check: after 14 days, ask once; not again for 14 days', P.painDue({ pain: ['knee', 'back'], painSince: { knee: NOW - 15 * DAY, back: NOW - 3 * DAY } }, { now: NOW }).join() === 'knee' && P.painDue({ pain: ['knee'], painSince: { knee: NOW - 30 * DAY }, painAsked: { knee: NOW - 2 * DAY } }, { now: NOW }).length === 0);

// 14. Early light week
check('light week: 3 rough check-ins this week → offer, with why', P.lightWeekOffer([], [0, 1, 3].map(d => ({ at: NOW - d * DAY, level: 'easy' })), { now: NOW })?.why === 'fatigue');
check('light week: 2 rough days, or rough days long ago → no', P.lightWeekOffer([], [{ at: NOW, level: 'rest' }, { at: NOW - DAY, level: 'easy' }, { at: NOW - 20 * DAY, level: 'rest' }], { now: NOW }) === null);
const flat = [...lift('benchPress', 80, 80), ...lift('squat', 100, 100), ...lift('deadlift', 120, 121)];
check('light week: every lift stalled 6 weeks → plateau offer', P.lightWeekOffer(flat, [], { now: NOW })?.why === 'plateau');
check('light week: one lift stalled, others rising → no plateau (that is a weak point)', P.lightWeekOffer(stall, [], { now: NOW }) === null);

// 15. Travel and Ramadan
check('travel: hotel gym for a week, then back to your own gym by itself', P.equipNow({ equip: ['barbell'], travel: { kind: 'hotel', until: NOW + DAY } }, { now: NOW }).includes('machines') && P.equipNow({ equip: ['barbell'], travel: { kind: 'hotel', until: NOW - DAY } }, { now: NOW }).join() === 'barbell');
const tv = P.personalDay(byId('massMonster').plan[0].items, LIB, { have: P.equipNow({ travel: { kind: 'none', until: NOW + DAY } }, { now: NOW }) });
check('travel: no equipment → bodyweight-only session', tv.items.every(it => P.canDo(LIB, it[0], ['none'])), tv.items.map(it => it[0]).join(' '));
check('Ramadan: on until its end date; one set fewer, 45-minute sessions', P.ramadanOn({ ramadan: { until: NOW + DAY } }, NOW) && !P.ramadanOn({ ramadan: { until: NOW - DAY } }, NOW) && P.RAMADAN.setDelta === -1 && P.RAMADAN.maxMinutes === 45);

// 16. Bodyweight and timed exercises progress
const pu = days => days.flatMap(([d, reps]) => [0, 1, 2].map(i => ({ ex: 'pushUp', at: NOW - d * DAY + i * 6e4, reps })));
check('bodyweight: hit 12 on every set (target 8-12) → 14 next time', P.bwTarget(pu([[2, 12]]), 'pushUp', { sets: 3, lo: 8, hi: 12 }, { now: NOW })?.reps === 14);
check('bodyweight: missed the target → same target', P.bwTarget(pu([[2, 9]]), 'pushUp', { sets: 3, lo: 8, hi: 12 }, { now: NOW })?.reps === 12);
check('bodyweight: 25+ reps → slower tempo instead of more reps', /3 seconds/.test(P.bwTarget(pu([[2, 26]]), 'pushUp', { sets: 3, lo: 8, hi: 12 }, { now: NOW })?.why || ''));
check('holds: 30 s held every set → 35 s; capped at 90 s with a harder version', P.bwTarget([{ ex: 'plank', at: NOW - DAY, secs: 31 }], 'plank', { sets: 3, secs: 30 }, { now: NOW })?.secs === 36 && P.bwTarget([{ ex: 'plank', at: NOW - DAY, secs: 95 }], 'plank', { sets: 3, secs: 30 }, { now: NOW })?.secs === 90);
check('bodyweight: never done → no target (program reps)', P.bwTarget([], 'pushUp', { sets: 3, lo: 8, hi: 12 }, { now: NOW }) === null);
// 17. Reps in reserve on the first day
check('first time: 40 kg × 10 with 5+ left → next set heavier (8 reps target)', P.rirKg(40, 10, 6, 8) > 45);
check('first time: 40 kg × 10 to failure, target 10 → lighter (10 with 2 left needs less); target 8 → same 40 kg', P.rirKg(40, 10, 0, 10) < 40 && Math.abs(P.rirKg(40, 10, 0, 8) - 40) < 0.01);
check('first time: a beginner never jumps more than 10%', P.rirKg(40, 10, 6, 8, { beginner: true }) <= 44);
// 18. Supersets before cutting
const pp1 = byId('powerPump').plan[0].items, paired = P.pairUp(pp1, LIB);
const letters = paired.map(it => it[5] || '-').join('');
check('pairing: extras paired with different muscles; main lifts and existing supersets untouched', paired.slice(0, 3).every(it => !it[5]) && paired.filter(it => it[5] && !pp1.find(x => x[0] === it[0])[5]).length >= 2 && paired.every((it, i) => it[1] === pp1[i][1]), letters);
check('pairing: saves time, same sets', dayMinutes(paired, 9) < dayMinutes(pp1, 9) && paired.reduce((a, it) => a + it[1], 0) === pp1.reduce((a, it) => a + it[1], 0));
// 10. Urdu cues: short lines only; a form tip is never dropped
const { toUrdu } = await import('../js/coach-ur.js');
check('urdu: counts, sets, rest, switch sides', toUrdu('seven') === 'سات' && toUrdu('Set 2 of 4.') === 'سیٹ دو، کل چار میں سے۔' && toUrdu('Rest. Next up: Squat.') === 'آرام کریں۔' && toUrdu('Switch sides.') === 'سائیڈ بدلیں۔');
check('urdu: a set summary with a form tip stays English', toUrdu('Set done. 8 reps, 6 clean. One thing for next set: Knees out.') === null);
check('urdu: long coaching sentences stay English', toUrdu('Bar close to your shins. Brace, and go.') === null);

if (fail) { console.log(`${fail} FAILED`); process.exit(1); }
console.log('personal: all pass');
