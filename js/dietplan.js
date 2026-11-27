// Diet plans the way QK writes them: the client says what they like, and every food gets an exact amount
// ("200 g chicken, 2 roti") so the day lands on their calories, protein, carbs and fat.
//
// How it works:
//   1. Each meal gets a share of the day's targets (breakfast 25%, lunch 30%, …).
//   2. A meal is built from templates ("eggs + roti + chai", "chicken + rice + salad") filled with foods the
//      client likes and is allowed (diet type, allergies). Each meal offers up to 3 options of equal size.
//   3. The amounts are solved: a small search over real portion steps (25 g of chicken, 1 roti, 1 egg) that
//      gets closest to the meal's calories and protein first, then carbs and fat.
// Every number comes from js/nutrition.js (USDA ingredients, desi dish models cooked at home), so logging
// a plan meal is exact: the grams logged are the grams planned.
import * as N from './nutrition.js';

// unit: 'g' (amount is grams), or a counted unit with `per` grams (ingredients) or 1 serving (dishes).
// cook: add 1 tsp oil when the plan says to cook it plain. yield: cooked weight / raw weight.
const f = (id, name, ref, unit, step, min, max, x = {}) => ({ id, name, ref, unit, step, min, max, tags: [], per: 1, ...x });
const ing = id => ({ t: 'ing', id }), dish = id => ({ t: 'dish', id });
export const FOODS = Object.fromEntries([
  // Protein
  f('chicken', 'Chicken breast', ing('chickenBreast'), 'g', 25, 100, 300, { tags: ['chicken'], raw: true, cook: true, yield: 0.75 }),
  f('chickenSalan', 'Chicken salan (home-cooked)', dish('chicken_salan'), 'katori', 0.5, 1, 2, { tags: ['chicken'] }),
  f('fish', 'Fish (rohu, sole or any white fish)', ing('fish'), 'g', 25, 100, 300, { tags: ['fish'], raw: true, cook: true, yield: 0.8 }),
  f('beef', 'Beef, boneless', ing('beef'), 'g', 25, 100, 250, { tags: ['beef', 'redmeat'], raw: true, cook: true, yield: 0.7 }),
  f('mutton', 'Mutton, boneless', ing('mutton'), 'g', 25, 100, 250, { tags: ['mutton', 'redmeat'], raw: true, cook: true, yield: 0.7 }),
  f('daal', 'Daal masoor (home-cooked)', dish('daal_masoor'), 'katori', 0.5, 0.5, 2, {}),
  f('cholay', 'Cholay (home-cooked)', dish('cholay'), 'katori', 0.5, 0.5, 1.5, {}),
  f('paneer', 'Paneer', ing('paneer'), 'g', 25, 50, 150, { tags: ['dairy'] }),
  f('eggs', 'Eggs, boiled or omelette', ing('egg'), 'egg', 1, 1, 4, { per: 50, tags: ['egg'] }),
  f('eggWhites', 'Egg whites', ing('eggWhite'), 'white', 1, 0, 8, { per: 33, tags: ['egg'] }),
  f('greekYogurt', 'Greek yogurt, low fat', ing('greekYogurt'), 'g', 50, 100, 300, { tags: ['dairy'] }),
  f('dahi', 'Dahi (yogurt)', ing('dahi'), 'g', 50, 100, 250, { tags: ['dairy'] }),
  f('whey', 'Whey protein', ing('whey'), 'scoop', 0.5, 0.5, 2, { per: 30, tags: ['dairy'] }),
  f('milk', 'Milk, low fat', ing('milkLow'), 'ml', 50, 150, 400, { tags: ['dairy'] }),
  // Carbs
  f('roti', 'Roti (medium, no ghee)', dish('roti'), 'roti', 1, 1, 5, { tags: ['gluten'] }),
  f('paratha', 'Paratha (home, light ghee)', dish('paratha'), 'paratha', 1, 1, 2, { tags: ['gluten'] }),
  f('bread', 'Brown bread', ing('brownBread'), 'slice', 1, 1, 4, { per: 30, tags: ['gluten'] }),
  f('rice', 'Rice, cooked', ing('riceCooked'), 'g', 25, 100, 450, {}),
  f('oats', 'Oats', ing('oats'), 'g', 10, 30, 100, { raw: true }),
  f('cornflakes', 'Cornflakes', ing('cornflakes'), 'g', 10, 30, 80, {}),
  f('banana', 'Banana', ing('banana'), 'banana', 0.5, 0.5, 2, { per: 120 }),
  f('apple', 'Apple', ing('apple'), 'apple', 1, 1, 2, { per: 180 }),
  f('orange', 'Orange (kinnow / malta)', ing('orange'), 'orange', 1, 1, 2, { per: 130 }),
  f('guava', 'Guava (amrood)', ing('guava'), 'guava', 1, 1, 2, { per: 150 }),
  f('dates', 'Dates (khajoor)', ing('dates'), 'date', 1, 2, 6, { per: 8 }),
  // Fat
  f('nuts', 'Almonds or pistachios', ing('nuts'), 'g', 5, 10, 40, { tags: ['nuts'] }),
  f('peanutButter', 'Peanut butter', ing('peanutButter'), 'g', 5, 10, 30, { tags: ['nuts'] }),
  // Fixed sides
  f('chai', 'Chai (doodh patti)', dish('chai'), 'cup', 1, 1, 1, { tags: ['dairy'] }),
  f('salad', 'Salad (kachumber)', dish('salad'), 'plate', 1, 1, 1, {}),
  f('sabzi', 'Mix sabzi (home-cooked)', dish('mix_sabzi'), 'katori', 1, 1, 1, {}),
  f('oil', 'Oil to cook it', ing('oil'), 'tsp', 1, 1, 3, { per: 5 }),
].map(x => [x.id, x]));

// What the client is asked. Keys match the chips in the app.
export const DIETS = [
  { id: 'all', label: 'I eat everything' },
  { id: 'nobeef', label: 'No beef' },
  { id: 'whitemeat', label: 'Chicken and fish only' },
  { id: 'eggetarian', label: 'Vegetarian + eggs' },
  { id: 'veg', label: 'Vegetarian' },
];
export const AVOID = [{ id: 'dairy', label: 'Dairy (lactose)' }, { id: 'gluten', label: 'Gluten (wheat)' }, { id: 'nuts', label: 'Nuts' }, { id: 'egg', label: 'Eggs' }];
export const LIKES = {
  breakfast: ['eggs', 'paratha', 'roti', 'bread', 'oats', 'cornflakes', 'greekYogurt', 'banana', 'chai'],
  main: ['chicken', 'chickenSalan', 'fish', 'beef', 'mutton', 'daal', 'cholay', 'paneer', 'roti', 'rice', 'salad', 'sabzi', 'dahi'],
  snack: ['banana', 'apple', 'guava', 'dates', 'nuts', 'peanutButter', 'greekYogurt', 'whey', 'eggs', 'chai'],
};
export const DEFAULT_ANSWERS = {
  diet: 'all', meals: 4, avoid: [],
  likes: { breakfast: ['eggs', 'roti', 'oats', 'chai'], main: ['chicken', 'daal', 'fish', 'roti', 'rice', 'salad'], snack: ['banana', 'nuts', 'greekYogurt'] },
};

const SPLITS = {
  3: [['Breakfast', 0.3], ['Lunch', 0.35], ['Dinner', 0.35]],
  4: [['Breakfast', 0.25], ['Lunch', 0.3], ['Snack', 0.15], ['Dinner', 0.3]],
  5: [['Breakfast', 0.2], ['Morning snack', 0.1], ['Lunch', 0.3], ['Evening snack', 0.1], ['Dinner', 0.3]],
};

export function allowed(food, a) {
  const t = food.tags, d = a.diet || 'all';
  if ((a.avoid || []).some(x => t.includes(x))) return false;
  if (d === 'nobeef' && t.includes('beef')) return false;
  if (d === 'whitemeat' && t.includes('redmeat')) return false;
  if ((d === 'eggetarian' || d === 'veg') && ['chicken', 'fish', 'redmeat'].some(x => t.includes(x))) return false;
  if (d === 'veg' && t.includes('egg')) return false;
  return true;
}

// Templates. Each slot lists candidate foods in order of preference.
//   key: true  → the template is only offered when the client likes one of these (it defines the meal)
//   opt: true  → leave the slot out if nothing in it is allowed
//   fixed: true → a set amount (chai, salad), counted but not resized
//   boost: true → may be 0; added only when the meal is short of protein
const FRUIT = ['banana', 'apple', 'orange', 'guava', 'dates'];
const TEMPLATES = {
  breakfast: [
    { name: 'Eggs and roti', slots: [{ foods: ['eggs'], key: true }, { foods: ['roti', 'paratha', 'bread'] }, { foods: ['eggWhites'], boost: true, opt: true }, { foods: ['chai'], fixed: true, liked: true, opt: true }] },
    { name: 'Paratha and omelette', slots: [{ foods: ['paratha'], key: true }, { foods: ['eggs', 'dahi'] }, { foods: ['eggWhites', 'greekYogurt'], boost: true, opt: true }, { foods: ['chai'], fixed: true, liked: true, opt: true }] },
    { name: 'Oats bowl', slots: [{ foods: ['oats'], key: true }, { foods: ['milk'], opt: true }, { foods: ['banana', 'dates', 'apple'] }, { foods: ['whey', 'greekYogurt', 'eggWhites'], boost: true, opt: true }, { foods: ['nuts', 'peanutButter'], opt: true }] },
    { name: 'Cereal and milk', slots: [{ foods: ['cornflakes'], key: true }, { foods: ['milk'] }, { foods: ['banana', 'apple'] }, { foods: ['eggs', 'whey', 'greekYogurt'], boost: true, opt: true }] },
    { name: 'Yogurt bowl', slots: [{ foods: ['greekYogurt', 'dahi'], key: true }, { foods: FRUIT }, { foods: ['oats', 'cornflakes'], opt: true }, { foods: ['nuts', 'peanutButter'], opt: true }] },
    { name: 'Eggs on toast', slots: [{ foods: ['bread'], key: true }, { foods: ['eggs'] }, { foods: ['eggWhites'], boost: true, opt: true }, { foods: ['chai'], fixed: true, liked: true, opt: true }] },
  ],
  main: [
    // One template per protein; the carb alternates between the client's choices.
    ...['chicken', 'chickenSalan', 'fish', 'beef', 'mutton', 'paneer'].map(p => ({
      name: FOODS[p].name, slots: [{ foods: [p], key: true }, { foods: ['roti', 'rice'], carb: true }, { foods: ['salad', 'sabzi'], fixed: true, liked: true, opt: true }, { foods: ['dahi'], liked: true, opt: true }],
    })),
    ...['daal', 'cholay'].map(p => ({
      name: FOODS[p].name, slots: [{ foods: [p], key: true }, { foods: ['roti', 'rice'], carb: true }, { foods: ['greekYogurt', 'dahi', 'paneer', 'eggs', 'chicken'], boost: true, opt: true }, { foods: ['salad', 'sabzi'], fixed: true, liked: true, opt: true }],
    })),
  ],
  snack: [
    { name: 'Fruit and nuts', slots: [{ foods: FRUIT, key: true }, { foods: ['nuts', 'peanutButter'], opt: true }, { foods: ['greekYogurt', 'whey', 'eggs', 'eggWhites'], boost: true, opt: true }] },
    { name: 'Yogurt and fruit', slots: [{ foods: ['greekYogurt'], key: true }, { foods: FRUIT }, { foods: ['nuts'], opt: true }] },
    { name: 'Protein shake', slots: [{ foods: ['whey'], key: true }, { foods: ['milk'], opt: true }, { foods: ['banana', 'dates'], opt: true }, { foods: ['peanutButter', 'nuts', 'oats'], opt: true, boost: true }] },
    { name: 'Boiled eggs and fruit', slots: [{ foods: ['eggs'], key: true }, { foods: FRUIT }] },
    { name: 'Peanut butter toast', slots: [{ foods: ['peanutButter'], key: true }, { foods: ['bread'], opt: true }, { foods: ['banana'], opt: true }] },
    { name: 'Chai and nuts', slots: [{ foods: ['chai'], key: true, fixed: true }, { foods: ['nuts', 'dates'] }, { foods: ['greekYogurt', 'whey', 'eggs'], boost: true, opt: true }] },
  ],
};

// Nutrition of one unit of a food (1 g, 1 egg, 1 roti, 1 katori), cooked at home.
const unitCache = {};
export function perUnit(id) {
  if (unitCache[id]) return unitCache[id];
  const fd = FOODS[id];
  const e = fd.ref.t === 'dish' ? N.estimate(fd.ref, { servings: 1, style: 'home', styleKnown: true, size: 'm' }) : N.estimate(fd.ref, { grams: fd.per });
  return (unitCache[id] = { kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat });
}
export const optsFor = (id, amount) => FOODS[id].ref.t === 'dish'
  ? { servings: amount, style: 'home', styleKnown: true, size: 'm' }
  : { grams: Math.round(amount * FOODS[id].per) };

const KEYS = ['kcal', 'protein', 'carbs', 'fat'];
const W = { kcal: 3, protein: 3, carbs: 1, fat: 1 };
const sum = items => items.reduce((s, it) => { const u = perUnit(it.id); for (const k of KEYS) s[k] += u[k] * it.amount; return s; }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
// A little over on protein is fine (it's the hardest target to reach); under on calories or protein is not.
const err = (tot, T) => KEYS.reduce((e, k) => {
  const d = (tot[k] - T[k]) / Math.max(T[k], k === 'kcal' ? 100 : 10);
  return e + W[k] * (k === 'protein' && d > 0 ? 0.2 : 1) * d ** 2;
}, 0);

// Discrete hill-climb over real portion steps. Few variables (≤5), so this finds the best grid point quickly.
export function solve(items, T) {
  const vars = items.filter(it => !it.fixed);
  const lo = it => (it.boost ? 0 : FOODS[it.id].min), hi = it => FOODS[it.id].max;
  const run = start => {
    const xs = vars.map((it, i) => Math.min(hi(it), Math.max(lo(it), start[i])));
    const at = () => { vars.forEach((it, i) => { it.amount = xs[i]; }); return err(sum(items), T); };
    let best = at();
    for (let guard = 0; guard < 400; guard++) {
      let move = null;
      vars.forEach((it, i) => {
        const st = FOODS[it.id].step;
        for (const d of [st, -st, 2 * st, -2 * st]) {
          const v = +(xs[i] + d).toFixed(3);
          if (v < lo(it) - 1e-9 || v > hi(it) + 1e-9) continue;
          const old = xs[i]; xs[i] = v; const e = at(); xs[i] = old;
          if (e < best - 1e-9 && (!move || e < move.e)) move = { i, v, e };
        }
      });
      if (!move) break;
      xs[move.i] = move.v; best = move.e;
    }
    at();
    return { xs: [...xs], e: best };
  };
  const mid = it => { const st = FOODS[it.id].step; return lo(it) + Math.round((hi(it) - lo(it)) / 2 / st) * st; };
  const a = run(vars.map(lo)), b = run(vars.map(mid));
  const win = a.e <= b.e ? a : b;
  vars.forEach((it, i) => { it.amount = win.xs[i]; });
  return { total: sum(items), error: win.e };
}

const likedSet = a => new Set([...(a.likes?.breakfast || []), ...(a.likes?.main || []), ...(a.likes?.snack || [])]);
const kindOf = name => /breakfast/i.test(name) ? 'breakfast' : /snack/i.test(name) ? 'snack' : 'main';

// Turn one template into concrete foods for this client, or null if it doesn't fit them.
function fill(tpl, kind, a, turn) {
  const likesHere = new Set(a.likes?.[kind] || []), liked = likedSet(a);
  const items = [];
  for (const s of tpl.slots) {
    let pool = s.foods.filter(id => allowed(FOODS[id], a));
    if (s.key || s.liked) pool = pool.filter(id => (s.key ? likesHere : liked).has(id));
    if (s.carb) { const lc = pool.filter(id => liked.has(id)); if (lc.length) pool = lc; }
    else if (!s.key) { const lp = pool.filter(id => liked.has(id)); if (lp.length) pool = lp; }
    if (!pool.length) { if (s.opt) continue; return null; }
    const id = pool[(s.key || s.carb ? turn : 0) % pool.length];
    if (items.some(it => it.id === id)) continue;
    items.push({ id, amount: s.fixed ? 1 : FOODS[id].min, boost: !!s.boost, fixed: !!s.fixed });
    if (FOODS[id].cook && !items.some(it => it.id === 'oil')) items.push({ id: 'oil', amount: 1 });
  }
  return items.length ? items : null;
}

function describe(it) {
  const fd = FOODS[it.id], a = it.amount;
  if (fd.unit === 'g') return `${Math.round(a)} g${fd.raw ? ' raw' : ''}${fd.yield ? ` (about ${Math.round(a * fd.yield / 5) * 5} g cooked)` : ''}`;
  if (fd.unit === 'ml') return `${Math.round(a)} ml`;
  const n = N.fmtN(a), plural = a <= 1 ? fd.unit : fd.unit === 'katori' ? 'katori' : fd.unit + 's';
  return `${n} ${plural}${fd.per > 1 && fd.ref.t === 'ing' && fd.unit !== 'tsp' ? ` (${Math.round(a * fd.per)} g)` : fd.unit === 'tsp' ? ' (5 g)' : ''}`;
}

/** Build the plan. a: questionnaire answers; T: N.targets(profile). seed rotates the options for "Make another". */
export function makePlan(a, T, seed = 0) {
  if (!T) return null;
  a = { ...DEFAULT_ANSWERS, ...a, likes: { ...DEFAULT_ANSWERS.likes, ...(a?.likes || {}) } };
  const split = SPLITS[a.meals] || SPLITS[4];
  let mainTurn = seed;
  const meals = split.map(([name, share], mi) => {
    const kind = kindOf(name), target = Object.fromEntries(KEYS.map(k => [k, T[k] * share]));
    const tpls = TEMPLATES[kind];
    const options = [], seen = new Set();
    // Lunch and dinner take turns through the proteins so they don't repeat.
    const turns = kind === 'main' ? 3 : 2;
    for (let t = 0; t < turns && options.length < 3; t++) {
      for (let k = 0; k < tpls.length && options.length < 3; k++) {
        const tpl = tpls[(k + seed + (kind === 'main' ? mainTurn : mi)) % tpls.length];
        const items = fill(tpl, kind, a, t + seed + mi);
        if (!items) continue;
        const sig = items.map(i => i.id).sort().join('+');
        if (seen.has(sig)) continue;
        seen.add(sig);
        const { total } = solve(items, target);
        const kept = items.filter(i => i.amount > 0);
        options.push({
          title: tpl.name,
          items: kept.map(it => ({ id: it.id, amount: it.amount, name: FOODS[it.id].name, amountLabel: describe(it), ref: FOODS[it.id].ref, opts: optsFor(it.id, it.amount), ...Object.fromEntries(KEYS.map(k => [k, perUnit(it.id)[k] * it.amount])) })),
          total,
        });
      }
    }
    if (kind === 'main') mainTurn += 2;
    return { name, share, target, options };
  });
  const day = meals.reduce((s, m) => { const o = m.options[0]; if (o) for (const k of KEYS) s[k] += o.total[k]; return s; }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  return { at: Date.now(), seed, answers: a, target: { kcal: T.kcal, protein: T.protein, carbs: T.carbs, fat: T.fat }, meals, day };
}

/** How close the plan is to the targets, in percent: { kcal: -2, protein: +1, … }. */
export const planGap = plan => Object.fromEntries(KEYS.map(k => [k, Math.round((plan.day[k] - plan.target[k]) / plan.target[k] * 100)]));

// Short names for the questionnaire chips.
export const LIKE_LABELS = {
  eggs: 'Eggs', paratha: 'Paratha', roti: 'Roti', bread: 'Bread / toast', oats: 'Oats', cornflakes: 'Cereal',
  greekYogurt: 'Yogurt', banana: 'Banana', chai: 'Chai', chicken: 'Chicken', chickenSalan: 'Chicken salan', fish: 'Fish',
  beef: 'Beef', mutton: 'Mutton', daal: 'Daal', cholay: 'Cholay', paneer: 'Paneer', rice: 'Rice', salad: 'Salad',
  sabzi: 'Sabzi', dahi: 'Dahi / raita', apple: 'Apple', guava: 'Guava', dates: 'Dates', nuts: 'Nuts',
  peanutButter: 'Peanut butter', whey: 'Whey shake',
};
