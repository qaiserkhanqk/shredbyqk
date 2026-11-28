// Fewer taps: your usual meals, copy a meal, saved meals, shared plates, extras, protein left. Run: node tests/foodquick.test.mjs
import { usualMeals, copyOf, saveMeal, findSaved, sharedCount, splitShared, extrasFor, proteinNudge, fibreTarget, mealFor, timeFor, weekendSplit, isShared } from '../js/foodquick.js';
let fails = 0;
const check = (name, ok, got) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${got !== undefined ? `  — ${JSON.stringify(got)}` : ''}`); if (!ok) fails++; };

const now = new Date('2026-11-28T08:30:00').getTime(), D = 864e5;
const E = (daysAgo, h, id, meal, servings = 1, kcal = 100) => ({ id: `${id}${daysAgo}${h}`, at: new Date(new Date(now - daysAgo * D).setHours(h, 0, 0, 0)).getTime(), meal, ref: { t: 'dish', id }, opts: { servings, style: 'home' }, name: id, kcal });
const log = [];
for (const d of [1, 2, 3, 5]) log.push(E(d, 8, 'anda_paratha', 'Breakfast', 1, 320), E(d, 8, 'chai', 'Breakfast', 1, 90));
log.push(E(4, 8, 'omelette', 'Breakfast', 1, 200), E(4, 8, 'chai', 'Breakfast', 1, 90));
for (const d of [1, 2]) log.push(E(d, 13, 'chicken_karahi', 'Lunch', 1.5, 500), E(d, 13, 'roti', 'Lunch', 2, 400));
log.push(E(40, 8, 'aloo_paratha', 'Breakfast', 1, 400), E(41, 8, 'aloo_paratha', 'Breakfast', 1, 400)); // older than 30 days

const u = usualMeals(log, 'Breakfast', now);
check('usual breakfast: anda paratha + chai first', u[0]?.label === 'anda_paratha + chai' && u[0].kcal === 410, u[0]);
check('usual: single dishes eaten on 3+ days too (chai)', u.some(x => x.items.length === 1 && x.items[0].ref.id === 'chai'));
check('usual: older than 30 days ignored', !u.some(x => x.items.some(i => i.ref.id === 'aloo_paratha')));
check('usual: one-off meals not offered', !u.some(x => x.items.some(i => i.ref.id === 'omelette')));
check('usual lunch keeps their portions (1.5 karahi, 2 roti)', usualMeals(log, 'Lunch', now)[0]?.items.map(i => i.opts.servings).join() === '1.5,2');
const logged = [...log, E(0, 8, 'anda_paratha', 'Breakfast'), E(0, 8, 'chai', 'Breakfast')];
check('usual: not offered again once logged today', !usualMeals(logged, 'Breakfast', now).some(x => x.items.length === 2));

check('copy yesterday\'s lunch', copyOf(log, 1, 'Lunch', now).map(i => i.ref.id).join() === 'chicken_karahi,roti');
check('copy a whole day', copyOf(log, 1, null, now).length === 4);

const m = saveMeal("Ammi's daal chawal", [{ ref: { t: 'dish', id: 'daal_masoor' }, opts: { servings: 1 }, name: 'Daal', kcal: 250 }, { ref: { t: 'dish', id: 'plain_rice' }, opts: { servings: 1 }, name: 'Rice', kcal: 300 }]);
check('saved meal keeps items and kcal', m.items.length === 2 && m.kcal === 550 && m.name === "Ammi's daal chawal");
check('saved meal found by name or item', findSaved([m], 'daal').length === 1 && findSaved([m], 'rice').length === 1 && findSaved([m], 'pizza').length === 0);

for (const [t, n] of [['hum 4 the, karahi aur roti', 4], ['4 logon ne karahi khayi', 4], ['shared a biryani with 2 friends', 3], ['split between 3', 3], ['family of 5 dinner', 5], ['teen dost', 3], ['do roti aur daal', 1], ['family karahi', 2], ['2 roti aur karahi', 1]])
  check(`people: "${t}" → ${n}`, sharedCount(t) === n, sharedCount(t));
const items = [{ ref: { t: 'dish', id: 'chicken_karahi' }, opts: { servings: 1 } }, { ref: { t: 'dish', id: 'roti' }, opts: { servings: 2 } }, { ref: { t: 'dish', id: 'chicken_biryani' }, opts: { servings: 2 } }];
const sp = splitShared(items, 4);
check('shared: karahi and biryani divided, rotis stay theirs', sp[0].opts.servings === 0.25 && sp[1].opts.servings === 2 && sp[2].opts.servings === 0.5, sp.map(i => i.opts.servings));
check('shared: counted things (anda curry) not divided', !isShared({ t: 'dish', id: 'anda_curry' }) && isShared({ t: 'dish', id: 'daal_masoor' }));

const ex = extrasFor([{ ref: { t: 'dish', id: 'chicken_karahi' } }, { ref: { t: 'dish', id: 'roti' } }], 'Dinner');
check('extras after karahi: chai, cold drink, raita… not roti (already there)', ex.some(x => x.id === 'chai') && ex.some(x => x.id === 'cola') && !ex.some(x => x.id === 'roti' && false), ex.map(x => x.id));
check('no fries or cold drink offered with breakfast', !extrasFor([{ ref: { t: 'dish', id: 'anda_paratha' } }], 'Breakfast').some(x => ['fries', 'cola'].includes(x.id)));

const pm = new Date('2026-11-28T16:00:00').getTime();
check('protein nudge from 2 pm when 20 g+ left', proteinNudge(60, pm)?.ideas.length === 3 && proteinNudge(60, pm).ideas[0].protein >= 24, proteinNudge(60, pm));
check('no protein nudge in the morning or when nearly done', !proteinNudge(60, now) && !proteinNudge(10, pm));
check('fibre target 14 g / 1,000 kcal', fibreTarget(2000) === 28);

check('Ramadan meals: Sehri, Iftar, Late', mealFor(new Date('2026-03-01T04:00').getTime(), true) === 'Sehri' && mealFor(new Date('2026-03-01T18:30').getTime(), true) === 'Iftar' && mealFor(new Date('2026-03-01T23:00').getTime(), true) === 'Late');
check('normal meals', mealFor(new Date('2026-03-01T13:00').getTime()) === 'Lunch');
check('log yesterday\'s dinner at 8 pm yesterday', new Date(timeFor('Dinner', 1, now)).getHours() === 20 && new Date(timeFor('Dinner', 1, now)).getDate() === 27);
check('log breakfast now → now', timeFor('Breakfast', 0, now) === now);
check('log today\'s dinner in the morning: not in the future', timeFor('Dinner', 0, now) <= now);

const ws = weekendSplit([{ day: '2026-11-23', kcal: 1900 }, { day: '2026-11-24', kcal: 1950 }, { day: '2026-11-25', kcal: 1850 }, { day: '2026-11-28', kcal: 2700 }, { day: '2026-11-29', kcal: 2500 }]);
check('weekday vs weekend', ws.weekday === 1900 && ws.weekend === 2600, ws);

console.log(fails ? `\n${fails} FAILED` : '\nall quick-log checks passed');
process.exit(fails ? 1 : 0);
