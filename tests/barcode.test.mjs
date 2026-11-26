// Barcode products (Open Food Facts) and FatSecret live results. Run: node tests/barcode.test.mjs
import { fromOFF, lookupBarcode } from '../js/barcode.js';
import { parseFatSecret, toProduct, searchFatSecret } from '../js/fatsecret.js';
import { estimate, lookup } from '../js/nutrition.js';
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };
globalThis.localStorage = { _: {}, getItem(k) { return this._[k] ?? null; }, setItem(k, v) { this._[k] = v; } };

// A made-up biscuit in Open Food Facts' format.
const off = { status: 1, product: { product_name: 'Test Biscuit', brands: 'Brand A, Brand B', serving_quantity: '25', serving_size: '1 pack (25 g)', nutriments: { 'energy-kcal_100g': 480, proteins_100g: 6.5, carbohydrates_100g: 68, fat_100g: 20, fiber_100g: 2 } } };
const p = fromOFF('8964000000001', off);
check('OFF product → name with brand', p.name === 'Brand A · Test Biscuit');
check('per-100 g values and serving size kept', p.per100.kcal === 480 && p.servingG === 25);
check('kJ-only products are converted to kcal', Math.round(fromOFF('1', { status: 1, product: { product_name: 'x', nutriments: { energy_100g: 2000 } } }).per100.kcal) === 478);
check('no nutrition → null (never guess)', fromOFF('1', { status: 1, product: { product_name: 'x', nutriments: {} } }) === null && fromOFF('1', { status: 0 }) === null);

let calls = 0;
const fake = async () => { calls++; return { ok: true, status: 200, json: async () => off }; };
const got = await lookupBarcode('8964000000001', fake);
check('lookup registers the product: 1 pack = 120 kcal', Math.round(estimate({ t: 'bc', id: got.code }, { servings: 1 }).kcal) === 120 && lookup({ t: 'bc', id: got.code }).name === p.name);
await lookupBarcode('8964000000001', fake);
check('second scan comes from the phone (no network)', calls === 1);
check('grams also work (50 g = 240 kcal)', Math.round(estimate({ t: 'bc', id: got.code }, { grams: 50 }).kcal) === 240);
check('unknown product in an old log entry → zeros, not a crash', estimate({ t: 'bc', id: 'nope' }).kcal === 0);

const fs = parseFatSecret('Per 100g - Calories: 250kcal | Fat: 10.00g | Carbs: 30.00g | Protein: 8.00g');
check('FatSecret per-100 g description parsed', fs.grams === 100 && fs.kcal === 250 && fs.protein === 8);
const fs2 = toProduct({ id: '9', name: 'Some burger', ...parseFatSecret('Per 1 serving - Calories: 540kcal | Fat: 28.00g | Carbs: 45.00g | Protein: 25.00g') });
check('FatSecret per-serving result → 1 serving = 540 kcal', Math.round(estimate({ t: 'bc', id: fs2.code }, { servings: 1 }).kcal) === 540);
const fs3 = toProduct({ id: '10', name: 'x', ...parseFatSecret('Per 50g - Calories: 100kcal | Fat: 2g | Carbs: 10g | Protein: 5g') });
check('FatSecret per-50 g result scaled to per 100 g', fs3.per100.kcal === 200);
const list = await searchFatSecret('/food-search', 'zinger', async url => ({ ok: true, json: async () => ({ foods: [{ id: '1', name: 'A', ...fs }] }), url }));
check('live search returns products', list.length === 1 && list[0].source === 'FatSecret');
console.log(fails ? `\n${fails} FAILED` : '\nall barcode and FatSecret checks passed');
process.exit(fails ? 1 : 0);
