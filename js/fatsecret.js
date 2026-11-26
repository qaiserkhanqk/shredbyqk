// FatSecret live fallback (through tools/food-vision-server.mjs, so the key stays on the server).
// FatSecret's terms don't allow keeping their data in our own database beyond 24 hours, so results are
// shown live and only the food a client actually eats is written to that client's own diary.
import { registerProduct } from './nutrition.js';

// "Per 100g - Calories: 250kcal | Fat: 10.00g | Carbs: 30.00g | Protein: 8.00g" → numbers.
export function parseFatSecret(desc = '') {
  const per = desc.match(/^Per\s+(.+?)\s+-/i)?.[1] || '';
  const g = k => +(desc.match(new RegExp(k + ':\\s*([\\d.]+)', 'i'))?.[1] ?? NaN);
  const grams = +(per.match(/^([\d.]+)\s*g$/i)?.[1] ?? NaN);
  return { per, grams: Number.isFinite(grams) ? grams : null, kcal: g('Calories'), fat: g('Fat'), carbs: g('Carbs'), protein: g('Protein') };
}

/** A FatSecret result → a product the sheet can scale (per 100 g when grams are known, else per serving). */
export function toProduct(f) {
  const k = f.grams ? 100 / f.grams : 1;
  return registerProduct({
    code: 'fs:' + f.id, name: f.name, source: 'FatSecret',
    per100: { kcal: f.kcal * k, protein: (f.protein || 0) * k, carbs: (f.carbs || 0) * k, fat: (f.fat || 0) * k, fibre: 0 },
    servingG: f.grams ? null : 100, servingLabel: f.grams ? null : f.per,
  });
}

export async function searchFatSecret(endpoint, q, fetcher = fetch) {
  const r = await fetcher(`${endpoint}?q=${encodeURIComponent(q)}`);
  if (!r.ok) return [];
  return ((await r.json()).foods || []).map(toProduct);
}
