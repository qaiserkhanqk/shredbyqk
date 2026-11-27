// Diet plans: amounts land on the client's targets, respect their diet, and log exactly what was planned.
import * as N from '../js/nutrition.js';
import { makePlan, planGap, FOODS, allowed } from '../js/dietplan.js';

let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : '  ' + detail}`); if (!ok) fails++; };

const people = [
  ['man cutting, defaults', { weightKg: 80, heightCm: 178, age: 28, sex: 'male', dietGoal: 'lose', activity: 'mid' }, {}],
  ['woman, vegetarian, cereal breakfast', { weightKg: 60, heightCm: 162, age: 30, sex: 'female', dietGoal: 'maintain' }, { diet: 'veg', meals: 3, likes: { breakfast: ['cornflakes', 'greekYogurt'], main: ['daal', 'cholay', 'paneer', 'roti', 'rice', 'salad'], snack: [] } }],
  ['young man bulking, 5 meals', { weightKg: 70, heightCm: 175, age: 22, sex: 'male', dietGoal: 'gain', activity: 'high' }, { meals: 5, likes: { breakfast: ['paratha', 'eggs', 'chai'], main: ['chicken', 'beef', 'mutton', 'rice', 'roti', 'sabzi', 'dahi'], snack: ['whey', 'banana', 'peanutButter'] } }],
  ['no dairy, no gluten', { weightKg: 65, heightCm: 168, age: 35, sex: 'female', dietGoal: 'lose', activity: 'low' }, { avoid: ['dairy', 'gluten'], likes: { breakfast: ['eggs', 'oats'], main: ['chicken', 'fish', 'rice', 'salad'], snack: ['apple', 'nuts'] } }],
  ['no beef, eggetarian-friendly', { weightKg: 90, heightCm: 182, age: 40, sex: 'male', dietGoal: 'maintain', activity: 'low' }, { diet: 'nobeef', likes: { breakfast: ['eggs', 'bread', 'chai'], main: ['chicken', 'mutton', 'daal', 'roti', 'salad'], snack: ['guava', 'nuts'] } }],
];

for (const [who, p, a] of people) {
  const T = N.targets(p), plan = makePlan(a, T), gap = planGap(plan);
  check(`${who}: calories within 8% (${gap.kcal}%)`, Math.abs(gap.kcal) <= 8);
  check(`${who}: protein not short by more than 15%, not over by more than 30% (${gap.protein}%)`, gap.protein >= -15 && gap.protein <= 30);
  check(`${who}: every meal has an option`, plan.meals.every(m => m.options.length > 0));
  const items = plan.meals.flatMap(m => m.options.flatMap(o => o.items));
  const ans = plan.answers;
  check(`${who}: nothing outside their diet or allergies`, items.every(it => allowed(FOODS[it.id], ans)), items.filter(it => !allowed(FOODS[it.id], ans)).map(i => i.id).join());
  check(`${who}: amounts are real portions (on the step, within limits)`, items.every(it => {
    const f = FOODS[it.id], k = it.amount / f.step;
    return it.amount >= Math.min(f.min, f.step) - 1e-9 && it.amount <= f.max + 1e-9 && Math.abs(k - Math.round(k)) < 1e-6;
  }), items.map(i => `${i.id}=${i.amount}`).join(' '));
  check(`${who}: logging a planned food gives the planned calories`, items.every(it => Math.abs(N.estimate(it.ref, it.opts).kcal - it.kcal) < 1.5));
  const opts = plan.meals.map(m => m.options.map(o => o.total.kcal));
  check(`${who}: options of a meal are about the same size (±20%)`, opts.every(os => os.every(k => Math.abs(k / os[0] - 1) <= 0.2)), JSON.stringify(opts.map(os => os.map(Math.round))));
}

const veg = makePlan({ diet: 'veg' }, N.targets(people[1][1]));
check('vegetarian plan has no meat, fish or eggs', veg.meals.flatMap(m => m.options.flatMap(o => o.items)).every(it => !['chicken', 'chickenSalan', 'fish', 'beef', 'mutton', 'eggs', 'eggWhites'].includes(it.id)));
check('no targets → no plan', makePlan({}, null) === null);
const s0 = makePlan({}, N.targets(people[0][1]), 0), s1 = makePlan({}, N.targets(people[0][1]), 1);
check('"Show me other options" changes the options', JSON.stringify(s0.meals.map(m => m.options.map(o => o.title))) !== JSON.stringify(s1.meals.map(m => m.options.map(o => o.title))));
const chicken = s0.meals.flatMap(m => m.options.flatMap(o => o.items)).find(i => i.id === 'chicken');
check('raw meat shows its cooked weight too', !chicken || /raw \(about \d+ g cooked\)/.test(chicken.amountLabel), chicken?.amountLabel);

console.log(fails ? `\n${fails} failed` : '\nall diet plan checks pass');
process.exit(fails ? 1 : 0);
