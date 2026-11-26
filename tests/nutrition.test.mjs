// Desi nutrition engine and photo consensus. Run: node tests/nutrition.test.mjs
import * as N from '../js/nutrition.js';
import { INDB } from '../js/foods-indb.js';
import { consensus } from '../js/foodphoto.js';
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };
const kcal = (id, o) => N.estimateDish(N.DISH[id], o).kcal;

// 1. Every dish uses known ingredients and has sane numbers.
let bad = [];
for (const d of N.DISHES) {
  try {
    for (const st of ['home', 'restaurant', 'shaadi']) {
      const e = N.estimateDish(d, { style: st });
      if (!(e.kcal > 0 && e.low <= e.kcal + 5 && e.high >= e.kcal - 5)) bad.push(d.id + ' range');
      // Atwater check: energy should match 4/4/9 from macros within 12%. USDA carbs include fibre, which gives ~2 kcal/g.
      const atw = e.protein * 4 + (e.carbs - e.fibre) * 4 + e.fibre * 2 + e.fat * 9;
      if (Math.abs(atw - e.kcal) / e.kcal > 0.12) bad.push(`${d.id} atwater ${Math.round(atw)} vs ${Math.round(e.kcal)}`);
      // Energy density should be possible for cooked food (water-rich drinks to fried snacks).
      const per100 = e.kcal / e.grams * 100;
      if (per100 < 5 || per100 > 520) bad.push(`${d.id} ${Math.round(per100)} kcal/100 g`);
    }
    if (d.fat.home > d.fat.restaurant || d.fat.restaurant > d.fat.shaadi) bad.push(d.id + ' fat order');
  } catch (e) { bad.push(d.id + ': ' + e.message); }
}
check(`all ${N.DISHES.length} dish models are valid`, !bad.length, bad.join('; '));
check('ids are unique', new Set(N.DISHES.map(d => d.id)).size === N.DISHES.length);

// 2. Cross-check against INDB home recipes (kcal per 100 g cooked, within 25%).
// Fried foods are excluded on purpose: INDB counts the whole frying oil as eaten.
const indb = code => INDB.find(r => r[0] === code);
const pairs = [
  ['chicken_qorma', 'BFP222'], ['mutton_qorma', 'BFP194'], ['mutton_biryani', 'ASC122'], ['roti', 'ASC096'], ['paratha', 'ASC097'],
  ['aloo_gobi', 'ASC171'], ['rajma', 'ASC165'], ['daal_chana', 'OSR142'], ['zeera_rice', 'ASC114'],
];
for (const [id, code] of pairs) {
  const d = N.DISH[id], e = N.estimateDish(d, { style: 'home' }), ours = e.kcal / e.grams * 100, ref = indb(code)[2];
  const diff = (ours - ref) / ref;
  check(`${d.name} (home) vs INDB ${indb(code)[1]}`, Math.abs(diff) <= 0.25, `${Math.round(ours)} vs ${Math.round(ref)} kcal/100 g (${diff > 0 ? '+' : ''}${Math.round(diff * 100)}%)`);
}
const samosa = indb('ASC361');
check('INDB samosa is flagged as fried (counts all frying oil)', samosa[9] === 1 && samosa[2] > 500, `${samosa[2]} kcal/100 g`);
check('our samosa sits in the measured range (220–330 kcal/100 g)', (() => { const e = N.estimateDish(N.DISH.samosa, { style: 'restaurant' }); const v = e.kcal / e.grams * 100; return v > 220 && v < 330; })());

// 3. The choices move the number the right way.
check('restaurant karahi > home karahi', kcal('chicken_karahi', { style: 'restaurant' }) > kcal('chicken_karahi', { style: 'home' }) * 1.25);
check('shaadi > restaurant', kcal('nihari', { style: 'shaadi' }) > kcal('nihari', { style: 'restaurant' }));
check('oil on top adds calories', kcal('chicken_karahi', { oil: 'oily' }) > kcal('chicken_karahi', { oil: 'normal' }));
const pm = o => N.estimateDish(N.DISH.chicken_karahi, o).protein;
check('mostly meat → more protein', pm({ meat: 'more' }) > pm({ meat: 'normal' }) * 1.3 && pm({ meat: 'less' }) < pm({ meat: 'normal' }));
check('mostly meat → less oil (less gravy)', N.estimateDish(N.DISH.chicken_karahi, { meat: 'more' }).fatGrams < N.estimateDish(N.DISH.chicken_karahi, {}).fatGrams);
check('2 servings = 2 × 1 serving', Math.abs(kcal('chicken_biryani', { servings: 2 }) - 2 * kcal('chicken_biryani', {})) < 1e-6);
check('grams override servings', Math.abs(kcal('plain_rice', { grams: 320 }) - 2 * kcal('plain_rice', {})) < 1e-6);
check('large roti > medium > small', kcal('roti', { size: 'l' }) > kcal('roti', { size: 'm' }) && kcal('roti', { size: 'm' }) > kcal('roti', { size: 's' }));
check('ghee on roti adds ~44 kcal', Math.round(kcal('roti', { topping: true }) - kcal('roti', {})) === 44);
const r = o => N.estimateDish(N.DISH.chicken_karahi, o);
check('knowing who cooked it narrows the range', r({ styleKnown: true }).high - r({ styleKnown: true }).low < r({}).high - r({}).low);
check('a photo portion widens the range', r({ portionSd: 0.3 }).high - r({ portionSd: 0.3 }).low > r({}).high - r({}).low);
check('same inputs → same answer (deterministic)', kcal('haleem', { style: 'restaurant', meat: 'more' }) === kcal('haleem', { style: 'restaurant', meat: 'more' }));

// Plausibility against well-known reference values.
check('1 cup boiled rice ≈ 205 kcal (USDA)', Math.abs(kcal('plain_rice', {}) - 205) < 15, Math.round(kcal('plain_rice', {})) + '');
check('1 boiled egg ≈ 72 kcal', Math.abs(kcal('boiled_egg', {}) - 72) < 5);
check('medium roti 90–120 kcal', kcal('roti', {}) > 90 && kcal('roti', {}) < 120);

// 4. Search finds desi names and puts the desi models first.
const top = q => N.search(q)[0];
check('"karahi" → a karahi dish model', /karahi/i.test(top('karahi').name) && top('karahi').ref.t === 'dish');
check('"chole" alias → cholay', top('chole').ref.id === 'cholay');
check('"keema" spelling → qeema', /qeema/i.test(top('keema').name));
check('"nehari" → nihari', top('nehari').ref.id === 'nihari');
check('Urdu script "روٹی" → roti', top('روٹی')?.ref.id === 'roti');
check('INDB recipes are searchable ("dhokla")', N.search('dhokla').some(e => e.ref.t === 'indb'));
check('ingredients are searchable ("chicken breast")', N.search('chicken breast').some(e => e.ref.t === 'ing'));
check('all 1,014 INDB recipes loaded', INDB.length === 1014);

// 5. Targets.
const t = N.targets({ weightKg: 80, heightCm: 178, age: 30, sex: 'male', goal: 'maintain', activity: 'mid' });
check('Mifflin-St Jeor BMR for 80 kg, 178 cm, 30 y male = 1,768', t.bmr === 1768);
check('maintenance ≈ BMR × 1.55', Math.abs(t.kcal - 1768 * 1.55) < 10);
check('macros add up to the calorie target', Math.abs(t.protein * 4 + t.carbs * 4 + t.fat * 9 - t.kcal) < 15);
check('cutting: −20% calories, more protein', (() => { const c = N.targets({ weightKg: 80, heightCm: 178, age: 30, sex: 'male', goal: 'lose' }); return c.kcal < t.kcal * 0.82 && c.protein > t.protein; })());
check('sign-up goal "Build muscle" → eat to gain', N.dietGoal({ goal: 'muscle' }) === 'gain' && N.targets({ weightKg: 80, heightCm: 178, age: 30, goal: 'muscle' }).kcal > t.kcal);
check('sign-up goal "Race HYROX" → maintain; food goal overrides it', N.dietGoal({ goal: 'hyrox' }) === 'maintain' && N.dietGoal({ goal: 'hyrox', dietGoal: 'lose' }) === 'lose');
check('no weight → no target (never guess)', N.targets({ heightCm: 170, age: 30 }) === null);
const day = N.dayTotals([{ at: Date.now(), kcal: 300, protein: 20, carbs: 10, fat: 15, low: 250, high: 350 }, { at: Date.now() - 2 * 86400000, kcal: 999, protein: 0, carbs: 0, fat: 0, low: 0, high: 0 }]);
check('day totals only count today', day.kcal === 300 && day.items.length === 1);
const two = N.dayTotals([{ at: Date.now(), kcal: 300, protein: 0, carbs: 0, fat: 0, low: 200, high: 400 }, { at: Date.now(), kcal: 300, protein: 0, carbs: 0, fat: 0, low: 200, high: 400 }]);
check('day range combines independent errors (narrower than adding ranges)', two.low === 460 && two.high === 740, `${two.low}–${two.high}`);

// 6. Photo consensus: the model's answers are combined so one odd answer can't swing the calories.
const s = (items, setting = 'home') => ({ items, setting });
const it = (dish, servings, extra = {}) => ({ dish, servings, meat_share: 'normal', oil: 'normal', confidence: 0.9, other_name: '', ...extra });
const c = consensus([
  s([it('chicken_karahi', 1), it('roti', 2)]),
  s([it('chicken_karahi', 1.5, { oil: 'oily' }), it('roti', 2), it('raita', 1)]),
  s([it('chicken_karahi', 1, { oil: 'oily' }), it('naan', 1)], 'restaurant'),
]);
check('majority dishes kept, one-off guesses dropped', c.items.map(i => i.dish).join() === 'chicken_karahi,roti', c.items.map(i => i.dish).join());
check('portion is the median, not the mean', c.items[0].servings === 1);
check('oil cue is the majority', c.items[0].oil === 'oily');
check('agreement reported', c.agreement > 0.6 && c.agreement < 1);
check('same samples → same consensus', JSON.stringify(consensus([s([it('nihari', 1)]), s([it('nihari', 1)])])) === JSON.stringify(consensus([s([it('nihari', 1)]), s([it('nihari', 1)])])));
check('unknown dish ids become "other" names', consensus([s([it('sushi_roll', 2, { other_name: 'Sushi' })])]).items[0].otherName === 'Sushi');
check('two piles of the same dish are added', consensus([s([it('roti', 1), it('roti', 2)])]).items[0].servings === 3);
check('broken samples are ignored', consensus([null, { error: 'x' }, s([it('chai', 1)])]).items[0].dish === 'chai');

console.log(fails ? `\n${fails} FAILED` : '\nall nutrition checks passed');
process.exit(fails ? 1 : 0);
