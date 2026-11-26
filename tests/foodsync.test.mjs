// Food on the coach dashboard: day rows, weekly summary, the dashboard card, and the sync push. Run: node tests/foodsync.test.mjs
import { foodDayRows, foodWeekSummary, placeRows, foodCard } from '../js/foodsync.js';
import { clientCard, demoData, localClient } from '../js/dash.js';
import { pushAll } from '../js/sync.js';
import { estimate, DISH } from '../js/nutrition.js';
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };
const DAY = 864e5, NOW = Date.now();
const E = (d, id, o = {}, meal = 'Lunch') => { const ref = { t: 'dish', id }; return { id: id + d, at: NOW - d * DAY, ref, opts: o, meal, name: DISH[id].name, label: '', source: 'photo', ...estimate(ref, o) }; };
const log = []; for (let d = 0; d < 7; d++) log.push(E(d, 'paratha', {}, 'Breakfast'), E(d, 'chicken_karahi', { style: 'restaurant' }), E(d, 'roti', { servings: 2 }), E(d, 'chicken_biryani', {}, 'Dinner'));
const S = { profile: { name: 'Sara', weightKg: 70, heightCm: 165, age: 28, sex: 'female', goal: 'lose' }, sessions: [], food: { log, water: {}, steps: {}, weights: [], places: [{ name: 'Ali Burger Cart', items: [{ name: 'Chicken cheese burger', dish: 'chicken_burger', opts: {} }] }] } };

const rows = foodDayRows('u1', S, NOW);
check('8 days max, one row per day with food', rows.length === 7 && rows.every(r => r.client_id === 'u1' && /^\d{4}-\d\d-\d\d$/.test(r.at)));
check('rows carry totals and dish names, no photos', rows[0].kcal > 1000 && rows[0].items.length === 4 && !JSON.stringify(rows).includes('data:image'));
const wk = foodWeekSummary(S, NOW);
check('weekly summary: averages, target and QK\'s focus', wk.logged === 7 && wk.kcal > 1000 && wk.target.kcal > 0 && wk.focus.length >= 1, JSON.stringify(wk.focus));
check('places the client added are sent for review', placeRows('u1', S)[0].name === 'Ali Burger Cart');
const card = foodCard(wk, rows, NOW);
check('dashboard food card: days logged, averages vs target', card.daysLogged === 7 && card.avgKcal === wk.kcal && card.target.protein > 0);
check('no food at all → no card', foodCard(null, [], NOW) === null);
const c = clientCard({ id: 'u1', name: 'Sara', food_week: wk }, [], [], [], { now: NOW, food: rows });
check('client card includes food', c.food?.daysLogged === 7);
const demo = demoData(NOW);
check('sample dashboard has food for sample clients', demo.food.length > 0 && demo.profiles[0].food_week);
const me = localClient(S, NOW);
check('demo mode shows this phone\'s food', me.food.length === 7 && me.profile.food_week.logged === 7);

// pushAll sends food_days, places and food_week
const calls = [];
const cloud = { uid: 'u1', upsert: async (t, r, c) => calls.push({ t, n: r.length, c }), updateMe: async f => calls.push({ t: 'me', f }) };
await pushAll(cloud, S, {});
check('sync pushes food days (conflict on client_id,at)', calls.some(x => x.t === 'food_days' && x.n === 7 && x.c === 'client_id,at'));
check('sync pushes places', calls.some(x => x.t === 'places' && x.n === 1));
check('sync puts the weekly summary on the profile', calls.find(x => x.t === 'me')?.f.food_week?.logged === 7);
console.log(fails ? `\n${fails} FAILED` : '\nall food sync checks passed');
process.exit(fails ? 1 : 0);
