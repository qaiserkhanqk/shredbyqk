// QK's weekly food report. Run: node tests/weekly.test.mjs
import { weekReport, weightTrend, waterGoal, reportText, dayKey } from '../js/weekly.js';
import { estimate, DISH } from '../js/nutrition.js';
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };
const DAY = 864e5, NOW = new Date(2026, 10, 22, 21, 0).getTime(); // a Sunday evening
const profile = { weightKg: 80, heightCm: 178, age: 30, sex: 'male', goal: 'muscle', activity: 'mid' };
const E = (dayAgo, id, opts = {}, meal = 'Lunch') => { const ref = { t: 'dish', id }, e = estimate(ref, opts); return { at: NOW - dayAgo * DAY - 3600e3, ref, opts, meal, name: DISH[id].name, ...e }; };
const week = menu => Array.from({ length: 7 }, (_, d) => menu.map(([id, o, m]) => E(d, id, o, m))).flat();
const BANNED = /\b(bad|fail|failed|poor|deficien|too much|warning|should have|terrible|junk)/i;
const allText = r => [...r.wins, ...r.focus.flatMap(f => [f.title, f.why, f.tip]), ...r.notes, r.line].join(' ');

// A typical desi week: paratha + chai, karahi + roti, biryani; no fruit, little dahi, no water logged.
const typical = week([['paratha', { style: 'home' }, 'Breakfast'], ['chai', {}, 'Breakfast'], ['chicken_karahi', { style: 'restaurant' }], ['roti', { servings: 2 }], ['chicken_biryani', { style: 'home' }, 'Dinner'], ['chai', {}, 'Snack']]);
const r = weekReport({ log: typical, profile, now: NOW, sessions: [{ at: NOW - DAY }, { at: NOW - 3 * DAY }, { at: NOW - 5 * DAY }] });
check('report is ready after a full week', r.enough && r.logged === 7, `${r.logged} days`);
check('opens with wins (1–3)', r.wins.length >= 1 && r.wins.length <= 3, r.wins.join(' | '));
check('counts training days as a win', r.wins.some(w => /3 training days/.test(w)));
check('at most two focus points', r.focus.length <= 2);
check('low veg and fruit is a focus here (protein is low too)', r.focus.some(f => f.id === 'veg'), r.focus.map(f => f.id).join());
check('focus names the nutrients it brings', r.focus.find(f => f.id === 'veg')?.nutrients?.includes('Vitamin C'));
check('every focus has a concrete tip', r.focus.every(f => f.tip.length > 30));
check('tone: no blaming words anywhere', !BANNED.test(allText(r)), (allText(r).match(BANNED) || [])[0]);
check('ends with an encouraging line', /Small adds/.test(r.line));
check('veg counted from the dishes (tomato and onion in the salan)', r.avg.veg > 50 && r.avg.veg < 300, `${Math.round(r.avg.veg)} g/day`);
check('eating out share is measured', r.avg.outShare > 0.15 && r.avg.outShare < 0.5, r.avg.outShare.toFixed(2));

// A strong week: protein, veg, dahi, fish, water.
const strong = week([['omelette', {}, 'Breakfast'], ['roti', { servings: 2 }, 'Breakfast'], ['chicken_tikka', { servings: 2 }], ['salad', { servings: 2 }], ['raita', { servings: 2 }], ['daal_masoor', {}, 'Dinner'], ['fish_curry', {}, 'Dinner'], ['roti', { servings: 2 }, 'Dinner'], ['dahi', {}, 'Snack'], ['sweet_lassi', {}, 'Snack'], ['plain_rice', { servings: 2 }, 'Dinner']]);
const water = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [dayKey(NOW - i * DAY), 12]));
const s = weekReport({ log: strong, profile, now: NOW, water, sessions: [{ at: NOW }, { at: NOW - 2 * DAY }, { at: NOW - 4 * DAY }] });
check('strong week: protein is a win', s.wins.some(w => /protein/i.test(w)), s.wins.join(' | '));
check('strong week: no veg or water focus', !s.focus.some(f => ['veg', 'water', 'protein'].includes(f.id)), s.focus.map(f => f.id).join());
check('strong week: no blaming words', !BANNED.test(allText(s)));

// Low protein on a muscle goal → protein focus with real numbers.
const low = week([['paratha', {}, 'Breakfast'], ['chai', {}, 'Breakfast'], ['aloo_matar', {}], ['roti', { servings: 3 }], ['daal_chana', {}, 'Dinner'], ['plain_rice', { servings: 2 }, 'Dinner'], ['samosa', { servings: 2 }, 'Snack']]);
const l = weekReport({ log: low, profile, now: NOW });
check('low protein → "add a protein to each meal" first', l.focus[0]?.id === 'protein', l.focus.map(f => f.id).join());
check('protein focus quotes the average and target', /\d+ g a day; your target is 144 g/.test(l.focus[0].why), l.focus[0].why);

// Rehab: never pushes a calorie cut; eat to recover.
const cut = { ...profile, dietGoal: 'lose' };
const big = week([['paratha', { style: 'shaadi' }, 'Breakfast'], ['nihari', { style: 'shaadi', servings: 2 }], ['naan', { servings: 2, topping: true }], ['mutton_biryani', { style: 'shaadi', servings: 2 }, 'Dinner'], ['jalebi', {}, 'Snack'], ['gulab_jamun', { servings: 2 }, 'Snack']]);
const c = weekReport({ log: big, profile: cut, now: NOW });
check('cutting and over target → one easy swap', c.focus.some(f => f.id === 'kcal-high'), c.focus.map(f => f.id).join());
check('swap tip talks about eating out when most food is from outside', /eating out/.test(c.focus.find(f => f.id === 'kcal-high')?.tip || ''));
const rh = weekReport({ log: big, profile: cut, now: NOW, rehab: true });
check('rehab: no calorie-cut advice while healing', !rh.focus.some(f => f.id === 'kcal-high'));
check('rehab: closing line is about healing', /Healing/.test(rh.line));
const rl = weekReport({ log: week([['chai', {}, 'Breakfast'], ['paratha', {}, 'Breakfast'], ['daal_masoor', {}], ['roti', { servings: 2 }], ['plain_rice', {}], ['aloo_gobi', {}, 'Dinner'], ['roti', { servings: 2 }, 'Dinner']]), profile, now: NOW, rehab: true });
check('rehab + under-eating → eat enough to recover / protein first', ['kcal-low', 'protein'].includes(rl.focus[0]?.id), rl.focus.map(f => f.id).join());

// Women: iron advice mentions tea with meals (tannins block non-haem iron).
const f = weekReport({ log: week([['chai', {}, 'Breakfast'], ['paratha', {}, 'Breakfast'], ['aloo_gobi', {}], ['roti', { servings: 2 }], ['mix_sabzi', {}, 'Dinner'], ['roti', { servings: 2 }, 'Dinner'], ['kheer', {}, 'Snack']]), profile: { ...profile, sex: 'female', weightKg: 60, heightCm: 162, goal: 'lose' }, now: NOW });
check('women with little iron-rich food → iron advice mentions chai timing (focus or note)', [...f.focus.map(x => x.tip), ...f.notes].some(t => /iron/i.test(t) && /chai/.test(t)), f.focus.map(x => x.id).join());

// Too few days → no judgement, just encouragement.
const few = weekReport({ log: [E(0, 'chicken_karahi'), E(0, 'roti', { servings: 2 })], profile, now: NOW });
check('under 3 full days → no report yet, friendly line', !few.enough && /Snap your meals/.test(few.line));
check('half-logged days are not counted as days', weekReport({ log: [E(1, 'chai'), E(2, 'chai'), E(3, 'chai')], profile, now: NOW }).logged === 0);

// Weight trend and real maintenance.
const pts = [0, 4, 8, 12, 16, 20].map(d => ({ at: NOW - d * DAY, kg: 80 + d * 0.05 })); // losing 0.35 kg/week
const tr = weightTrend(pts, NOW);
check('weight trend in kg/week', Math.abs(tr.perWeek + 0.35) < 0.01, tr.perWeek.toFixed(3));
check('trend needs at least a week of weigh-ins', weightTrend(pts.slice(0, 2), NOW) === null);
const m = weekReport({ log: typical, profile: { ...profile, dietGoal: 'lose' }, now: NOW, weights: pts });
check('losing weight on a cut → a win', m.wins.some(w => /Down about 0\.3/.test(w)) || m.wins.length === 3, m.wins.join(' | '));
check('real maintenance from logs + scale', m.maintenance > 0 && /maintain at about/.test(m.notes.join(' ')), String(m.maintenance));

const stepsLow = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [dayKey(NOW - i * DAY), 3500]));
const sl = weekReport({ log: strong, profile: { ...profile, dietGoal: 'lose', activity: 'high' }, now: NOW, water, steps: stepsLow });
check('few steps → walk after meals is suggested', sl.focus.some(f => f.id === 'walk'), sl.focus.map(f => f.id).join());
check('steps disagree with "How active" → gentle note', sl.notes.some(n => /How active/.test(n)));
const sh = weekReport({ log: strong, profile, now: NOW, water, steps: Object.fromEntries(Array.from({ length: 7 }, (_, i) => [dayKey(NOW - i * DAY), 9500])) });
check('lots of steps → a win', sh.wins.some(w => /steps a day/.test(w)) || sh.wins.length === 3);
check('water goal: 80 kg → 11 glasses, +2 on training days', waterGoal(80) === 11 && waterGoal(80, true) === 13);
check('text for QK lists wins and next week', /Went well:/.test(reportText(r, 'Sara')) && /Next week:/.test(reportText(r)));

{ // Weekdays vs Fri–Sun, and days the client says weren't fully logged.
  const now = new Date('2026-11-29T21:00:00').getTime(), DAYMS = 864e5, prof = { sex: 'male', age: 30, heightCm: 178, weightKg: 82, job: 'desk', trainDays: 3, dietGoal: 'lose' };
  const it = (at, id, servings) => { const e = estimate({ t: 'dish', id }, { servings }); return { at, ref: { t: 'dish', id }, opts: { servings }, meal: 'Lunch', name: id, kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat }; };
  const log = [];
  for (let d = 0; d < 7; d++) { const t = now - d * DAYMS, wd = new Date(t).getDay(), big = [0, 5, 6].includes(wd); log.push(it(t, 'chicken_karahi', big ? 2.5 : 1.2), it(t, 'roti', big ? 4 : 2), { ...it(t - 5 * 3600e3, 'paratha', 1), meal: 'Breakfast' }); }
  const r = weekReport({ log, profile: prof, now });
  check('weekend line: weekdays vs Fri–Sun', r.weekend && r.weekend.weekend - r.weekend.weekday >= 300 && r.notes.some(n => /Fri–Sun about/.test(n)), JSON.stringify(r.weekend));
  const k = dayKey(now - DAYMS), r2 = weekReport({ log, profile: prof, now, incomplete: { [k]: true } });
  check('"I didn\'t log everything" days are left out', r2.logged === r.logged - 1, `${r.logged} → ${r2.logged}`);
}

console.log(fails ? `\n${fails} FAILED` : '\nall weekly report checks passed');
process.exit(fails ? 1 : 0);
