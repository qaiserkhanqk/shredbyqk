// Say or type a meal, in English, Roman Urdu or Urdu: "do roti aur chicken karahi",
// "aadhi plate biryani, ek glass lassi", "2 anday aur paratha", "دو روٹی اور دال", "kfc zinger and fries".
// Turns the sentence into dishes and portions, using the same dish models as everything else.
import { DISH, search } from './nutrition.js';
import { searchPlaces } from './menus.js';

// Urdu script → Roman Urdu, so one parser handles both.
const URDU = {
  'ایک': 'ek', 'دو': 'do', 'تین': 'teen', 'چار': 'char', 'پانچ': 'panch', 'چھ': 'chhe', 'آدھا': 'aadha', 'آدھی': 'aadhi', 'ڈیڑھ': 'dedh', 'ڈھائی': 'dhai',
  'اور': 'aur', 'کے': 'ke', 'ساتھ': 'saath',
  'روٹی': 'roti', 'روٹیاں': 'roti', 'چپاتی': 'chapati', 'نان': 'naan', 'پراٹھا': 'paratha', 'پراٹھے': 'paratha', 'پوری': 'puri', 'چاول': 'chawal', 'بریانی': 'biryani', 'پلاؤ': 'pulao',
  'دال': 'daal', 'چنے': 'chane', 'کڑاہی': 'karahi', 'قورمہ': 'qorma', 'سالن': 'salan', 'نہاری': 'nihari', 'حلیم': 'haleem', 'قیمہ': 'qeema', 'کباب': 'kebab', 'تکہ': 'tikka',
  'مرغی': 'chicken', 'چکن': 'chicken', 'گوشت': 'gosht', 'سبزی': 'sabzi', 'انڈا': 'anda', 'انڈے': 'anday', 'آملیٹ': 'omelette',
  'چائے': 'chai', 'لسی': 'lassi', 'دہی': 'dahi', 'رائتہ': 'raita', 'سموسہ': 'samosa', 'سموسے': 'samosa', 'پکوڑے': 'pakoray', 'کھیر': 'kheer', 'حلوہ': 'halwa',
  'کٹوری': 'katori', 'پلیٹ': 'plate', 'کپ': 'cup', 'گلاس': 'glass', 'پیالہ': 'bowl', 'ٹکڑا': 'piece', 'ٹکڑے': 'piece',
};
const NUM = {
  ek: 1, aik: 1, one: 1, a: 1, an: 1, do: 2, two: 2, teen: 3, tin: 3, three: 3, char: 4, chaar: 4, four: 4, panch: 5, paanch: 5, five: 5,
  chhe: 6, chay: 6, six: 6, saat: 7, seven: 7, aath: 8, eight: 8, nau: 9, nine: 9, das: 10, ten: 10,
  aadha: 0.5, aadhi: 0.5, adha: 0.5, adhi: 0.5, half: 0.5, dedh: 1.5, dairh: 1.5, dhai: 2.5, adhai: 2.5, arhai: 2.5,
};
// Container units in grams, so "a plate of karahi" becomes 1½ katori.
const UNIT = { katori: 200, katoray: 200, bowl: 250, plate: 300, cup: 160, cups: 160, glass: 300, glasses: 300, piyala: 250, pyala: 250, pyali: 160 };
const COUNT = new Set(['piece', 'pieces', 'pc', 'pcs', 'adad', 'slice', 'slices']);
const FILLER = new Set(['from', 'at', 'se', 'say', 'wala', 'wali', 'walay', 'the', 'ke', 'ka', 'ki', 'saath', 'with', 'of', 'and', 'aur', 'te', 'or', 'i', 'had', 'ate', 'khaya', 'khai', 'khaye', 'piya', 'pi', 'li', 'liya', 'mein', 'nay', 'ne', 'some', 'kuch', 'thora', 'thori', 'my', 'lunch', 'dinner', 'breakfast', 'nashta', 'me']);
// Words people say that the dish names don't contain.
// What a bare word usually means at a Pakistani table (the most common version of the dish).
const DEFAULT = { biryani: 'chicken_biryani', karahi: 'chicken_karahi', qorma: 'chicken_qorma', korma: 'chicken_qorma', pulao: 'chicken_pulao', samosa: 'samosa', samosay: 'samosa',
  qeema: 'qeema', keema: 'qeema', chapati: 'roti', chapatti: 'roti', roti: 'roti', paratha: 'paratha', parathay: 'paratha', naan: 'naan', kebab: 'seekh_kebab', kabab: 'seekh_kebab',
  tikka: 'chicken_tikka', salan: 'chicken_salan', daal: 'daal_masoor', dal: 'daal_masoor', chawal: 'plain_rice', rice: 'plain_rice', anday: 'boiled_egg', anda: 'anda_fry',
  egg: 'boiled_egg', eggs: 'boiled_egg', burger: 'zinger_burger', pizza: 'pizza_slice', lassi: 'sweet_lassi', halwa: 'suji_halwa', chane: 'cholay', chanay: 'cholay', sabzi: 'mix_sabzi',
  chai: 'chai', tea: 'chai', coke: 'cola', pepsi: 'cola', shawarma: 'shawarma', roll: 'paratha_roll', pakoray: 'pakora', pakore: 'pakora', fries: 'fries', omelette: 'omelette' };
const SAY = { chawal: 'plain rice', anday: 'boiled egg', anda: 'fried egg', chane: 'cholay', chanay: 'cholay', murgh: 'chicken', murghi: 'chicken', sabzi: 'mix sabzi', pakoray: 'pakoray', pakore: 'pakoray', tikka: 'chicken tikka', kebab: 'seekh kebab', kabab: 'seekh kebab', chai: 'chai', tea: 'chai', coke: 'cola', pepsi: 'cola', burger: 'zinger', egg: 'boiled egg', eggs: 'boiled egg', rice: 'plain rice', daal: 'daal masoor', dal: 'daal masoor', salan: 'chicken salan' };

const norm = s => String(s).toLowerCase().replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
  .replace(/[؀-ۿ]+/g, w => URDU[w] ?? w).replace(/½/g, ' 0.5 ').replace(/[^\p{L}\p{N}.,+&]+/gu, ' ').trim();

/** Split "do roti aur karahi, chai" into item phrases. */
export function splitMeal(text) {
  return norm(text).split(/\s*(?:,|\+|&|\band\b|\baur\b|\bte\b|\bwith\b|\bke saath\b|\bsaath\b)\s*/).map(s => s.trim()).filter(Boolean);
}

const GENERIC = new Set(['any', 'the', 'and', 'pizza', 'burger', 'roll', 'cart', 'stall', 'shop', 'foods', 'cafe', 'roadside', 'hotel', 'dhaba', 'halwa', 'samosa', 'chaat', 'bhutta', 'broast', 'fried', 'fish', 'nihari', 'karahi', 'biryani', 'king', 'house']);
const placeNamed = (name, query) => {
  const w = name.toLowerCase().replace(/['’]/g, '').split(/[^a-z0-9]+/).find(x => x.length >= 3 && !GENERIC.has(x));
  return !!w && query.replace(/['’]/g, '').includes(w);
};

/** One phrase → { amount, unit, query }. */
export function readPhrase(phrase) {
  let amount = null, unit = null; const rest = [];
  for (const w of phrase.split(/\s+/)) {
    if (/^\d+(\.\d+)?$/.test(w)) amount = (amount ?? 0) + +w;
    else if (w in NUM && amount === null && rest.length === 0) amount = NUM[w];
    else if (w in UNIT) unit = w;
    else if (COUNT.has(w)) unit = 'piece';
    else if (!FILLER.has(w)) rest.push(w);
  }
  return { amount: amount ?? 1, unit, query: rest.join(' ') };
}

/** Best match for a phrase: a place's menu item ("kfc zinger"), else a dish model, else nothing. */
function match(query) {
  if (!query) return null;
  // "kfc zinger", "cheezious crown crust": a named place wins over the generic dish.
  const menu = searchPlaces(query, [], 1)[0];
  if (menu && placeNamed(menu.place.name, query)) return { ref: { t: 'dish', id: menu.item.dish }, opts: { ...menu.item.opts, menuBase: menu.item.opts.servings || 1 }, name: `${menu.place.name} · ${menu.item.name}`, official: menu.item.official && { ...menu.item.official, base: menu.item.opts.servings || 1 } };
  const one = query.replace(/s$/, '') in DEFAULT ? DEFAULT[query.replace(/s$/, '')] : DEFAULT[query];
  if (one) return { ref: { t: 'dish', id: one }, opts: {}, name: DISH[one].name };
  // Try the words as said first ("chicken karahi"); then with everyday words swapped in ("chawal" → plain rice).
  const dishHit = q => search(q, 10).find(e => e.ref.t === 'dish');
  const hit = (query.split(' ').length > 1 && dishHit(query)) || dishHit(query.split(' ').map(w => SAY[w] || w).join(' ')) || dishHit(query);
  if (hit) return { ref: hit.ref, opts: {}, name: DISH[hit.ref.id].name };
  // "medium fries", "large lassi": try again without the size word.
  const bare = query.split(' ').filter(w => !SIZE_WORDS.has(w)).join(' ');
  return bare && bare !== query ? match(bare) : null;
}
const SIZE_WORDS = new Set(['small', 'medium', 'regular', 'large', 'chota', 'chhota', 'bara', 'bada', 'full', 'single']);

/** "do roti aur aadhi plate biryani" → [{ ref, opts: { servings }, name, said }] plus what it couldn't place. */
export function parseMeal(text) {
  const items = [], unknown = [];
  for (const ph of splitMeal(text)) {
    const { amount, unit, query } = readPhrase(ph);
    const m = match(query);
    if (!m) { if (query) unknown.push(query); continue; }
    const d = DISH[m.ref.id];
    let servings = amount;
    // A container the dish isn't served in: convert by weight ("a plate of karahi" ≈ 1½ katori).
    if (unit && UNIT[unit] && d.serve !== unit && ['katori', 'bowl', 'plate', 'cup', 'glass', 'portion'].includes(d.serve)) servings = amount * UNIT[unit] / d.cooked;
    servings = Math.max(0.5, Math.round(servings * 2) / 2);
    items.push({ ...m, opts: { ...m.opts, servings: (m.opts.servings || 1) * servings }, said: ph });
  }
  return { items, unknown };
}

/** True when the search box text looks like a whole meal rather than one food. */
export const looksLikeMeal = text => splitMeal(text).length > 1 || /^\s*(\d|ek|aik|do|teen|char|aadh|half|dedh|one|two|three)\b/i.test(norm(text));
