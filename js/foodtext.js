// Say or type a meal, in English, Roman Urdu or Urdu: "do roti aur chicken karahi",
// "maine do paratha aur ek cup chai pi", "aadhi plate biryani", "sawa roti", "دو روٹی اور دال",
// "2 big mac from mcdonalds", "halwa puri". Turns it into dishes and portions, using the same dish
// models as everything else. Accuracy is measured on tests/fixtures/meal-phrases.json.
//
// How it copes with the way people really talk (and with speech-to-text spelling):
//  - Urdu script is mapped to Roman Urdu word by word; Urdu digits and ½ / 1/2 become numbers.
//  - Every word is compared by its "sound skeleton": consonants only, aspirates folded (th→t, kh→k),
//    q→k, common plural endings dropped. So parata = paratha = prathay, nahari = nihari,
//    karhai = karahi, samose = samosa, chapatiyan = chapati, khajoorain = khajoor.
//  - A phrase must match every word of a dish ("chicken tikka" ≠ "chicken boti"); if nothing does,
//    it's split in two ("halwa puri", "daal chawal", "keema naan"), then the least useful word is dropped.
//  - Numbers: ek, do, teen…, aadha, dedh, dhai, sawa (+¼), paune (−¼), "two and a half", "a couple".
//  - Containers convert by weight: a plate of karahi ≈ 1½ katori, a pao of dahi ≈ 250 g.
import { DISH, DISHES } from './nutrition.js';
import { searchPlaces } from './menus.js';

const URDU = {
  'ایک': 'ek', 'دو': 'do', 'تین': 'teen', 'چار': 'char', 'پانچ': 'panch', 'چھ': 'chhe', 'سات': 'saat', 'آٹھ': 'aath', 'آدھا': 'aadha', 'آدھی': 'aadhi', 'ڈیڑھ': 'dedh', 'ڈھائی': 'dhai', 'سوا': 'sawa', 'پونے': 'paune',
  'اور': 'aur', 'کے': 'ke', 'کا': 'ka', 'کی': 'ki', 'ساتھ': 'saath', 'میں': 'mein', 'نے': 'ne', 'کھایا': 'khaya', 'پی': 'pi',
  'روٹی': 'roti', 'روٹیاں': 'roti', 'چپاتی': 'chapati', 'پھلکا': 'phulka', 'نان': 'naan', 'روغنی': 'roghni', 'پراٹھا': 'paratha', 'پراٹھے': 'paratha', 'پوری': 'puri', 'پوریاں': 'puri',
  'چاول': 'chawal', 'بریانی': 'biryani', 'پلاؤ': 'pulao', 'دال': 'daal', 'چنے': 'chane', 'کڑاہی': 'karahi', 'قورمہ': 'qorma', 'سالن': 'salan', 'نہاری': 'nihari', 'حلیم': 'haleem',
  'قیمہ': 'qeema', 'کباب': 'kebab', 'تکہ': 'tikka', 'بوٹی': 'boti', 'مرغی': 'chicken', 'چکن': 'chicken', 'مٹن': 'mutton', 'گوشت': 'gosht', 'بیف': 'beef', 'مچھلی': 'machli',
  'سبزی': 'sabzi', 'آلو': 'aloo', 'پالک': 'palak', 'پنیر': 'paneer', 'بھنڈی': 'bhindi', 'ساگ': 'saag', 'مکئی': 'makki', 'انڈا': 'anda', 'انڈے': 'anday', 'آملیٹ': 'omelette',
  'چائے': 'chai', 'لسی': 'lassi', 'دہی': 'dahi', 'رائتہ': 'raita', 'دودھ': 'doodh', 'سموسہ': 'samosa', 'سموسے': 'samosa', 'پکوڑے': 'pakoray', 'کھیر': 'kheer', 'حلوہ': 'halwa', 'جلیبی': 'jalebi',
  'کیلا': 'kela', 'کیلے': 'kelay', 'سیب': 'seb', 'آم': 'aam', 'کھجور': 'khajoor', 'کھجوریں': 'khajoor', 'کیلے': 'kelay', 'سموسے': 'samosa', 'پراٹھے': 'paratha', 'انڈوں': 'anday', 'روٹیوں': 'roti', 'بسکٹ': 'biscuits', 'پائے': 'paye', 'کڑھی': 'kadhi', 'لیٹر': 'liter', 'گرام': 'gram', 'امرود': 'amrood', 'مالٹا': 'malta', 'برگر': 'burger', 'پیزا': 'pizza', 'شوارما': 'shawarma', 'رول': 'roll',
  'کٹوری': 'katori', 'پلیٹ': 'plate', 'کپ': 'cup', 'پیالی': 'pyali', 'گلاس': 'glass', 'پیالہ': 'bowl', 'پاؤ': 'pao', 'ٹکڑا': 'piece', 'ٹکڑے': 'piece',
};
const NUM = {
  ek: 1, aik: 1, ik: 1, one: 1, a: 1, an: 1, do: 2, two: 2, teen: 3, tin: 3, three: 3, char: 4, chaar: 4, four: 4, panch: 5, paanch: 5, five: 5,
  chhe: 6, chay: 6, che: 6, six: 6, saat: 7, seven: 7, aath: 8, eight: 8, nau: 9, nine: 9, das: 10, ten: 10, couple: 2,
  aadha: 0.5, aadhi: 0.5, adha: 0.5, adhi: 0.5, half: 0.5, dedh: 1.5, dairh: 1.5, derh: 1.5, dhai: 2.5, adhai: 2.5, arhai: 2.5, dhaai: 2.5,
};
// Container units in grams, so "a plate of karahi" becomes 1½ katori.
const UNIT = { liter: 1000, litre: 1000, l: 1000, ml: 1, g: 1, gm: 1, gram: 1, grams: 1, kg: 1000, katori: 200, katoray: 200, bowl: 250, plate: 300, cup: 160, cups: 160, glass: 250, glasses: 250, piyala: 250, pyala: 250, pyali: 160, pao: 250 };
const COUNT = new Set(['piece', 'pieces', 'pc', 'pcs', 'adad', 'slice', 'slices', 'number']);
const FILLER = new Set(['from', 'at', 'se', 'say', 'wala', 'wali', 'walay', 'the', 'ke', 'ka', 'ki', 'of', 'and', 'aur', 'te', 'or', 'i', 'had', 'have', 'ate', 'eaten', 'drank', 'khaya', 'khayi', 'khai', 'khaye', 'piya', 'pi', 'pee', 'li', 'liya', 'mein', 'main', 'maine', 'mainay', 'nay', 'ne', 'some', 'kuch', 'thora', 'thori', 'my', 'me', 'for', 'today', 'aaj', 'subah', 'shaam', 'raat', 'dopehar', 'lunch', 'dinner', 'breakfast', 'nashta', 'nashte', 'snack', 'with', 'saath', 'bhi', 'ko', 'ka', 'aj', 'nashtay', 'nashtey', 'subha', 'subhah', 'kal', 'raat ko', 'khana', 'khane', 'khaana', 'mujhe', 'humne', 'hamne', 'yesterday', 'tonight', 'morning', 'evening', 'night', 'then', 'phir', 'also', 'tha', 'thi', 'hai', 'just', 'only', 'sirf', 'about', 'around', 'like']);
// Extras on the side that aren't worth a separate entry (or are already in the dish, like sugar in chai).
const SIDE = new Set(['sugar', 'cheeni', 'chini', 'chutney', 'achar', 'achaar', 'salt', 'namak', 'pepper', 'mirch', 'lemon', 'nimbu', 'ketchup', 'sauce', 'mayo', 'ice', 'baraf']);
// Words that describe rather than name; a dish matched only through one of these isn't a match.
const ADJ = new Set(['green', 'sweet', 'hot', 'plain', 'white', 'black', 'special', 'fried', 'boiled', 'cold', 'fresh', 'spicy', 'masala', 'desi', 'homemade', 'ghar', 'gharelu', 'crispy']);
// "seekh kebab paratha roll": the words before a wrapper are its filling, not another dish.
const WRAPPER = ['roll', 'burger', 'sandwich', 'wrap', 'shawarma', 'pizza', 'paratha roll'];
// Dishes sold as a pack of pieces: "4 nuggets" is ⅔ of a 6-piece box.
const PACK = { nuggets: 6, wings: 6, gol_gappay: 6 };
const SIZE_WORDS = new Set(['small', 'medium', 'regular', 'large', 'chota', 'chhota', 'choti', 'bara', 'bada', 'bari', 'full', 'single', 'double']);
// Everyday words dish names don't contain.
const SAY = { chawal: 'plain rice', doodh: 'milk', milk: 'milk', bread: 'bread slice', toast: 'bread slice', egg: 'boiled egg', eggs: 'boiled egg', tea: 'chai', coke: 'cola', pepsi: 'cola', sprite: 'cola' };
// What a bare word usually means at a Pakistani table (the most common version of the dish).
const DEFAULT = { biryani: 'chicken_biryani', karahi: 'chicken_karahi', qorma: 'chicken_qorma', korma: 'chicken_qorma', pulao: 'chicken_pulao', samosa: 'samosa',
  qeema: 'qeema', keema: 'qeema', chapati: 'roti', roti: 'roti', paratha: 'paratha', naan: 'naan', kebab: 'seekh_kebab', kabab: 'seekh_kebab', tikka: 'chicken_tikka',
  salan: 'chicken_salan', daal: 'daal_masoor', dal: 'daal_masoor', chawal: 'plain_rice', rice: 'plain_rice', anday: 'boiled_egg', anda: 'anda_fry', egg: 'boiled_egg',
  burger: 'zinger_burger', pizza: 'pizza_slice', lassi: 'sweet_lassi', halwa: 'suji_halwa', chane: 'cholay', chanay: 'cholay', sabzi: 'mix_sabzi', chai: 'chai',
  shawarma: 'shawarma', roll: 'paratha_roll', pakoray: 'pakora', fries: 'fries', omelette: 'omelette', saag: 'sarson_saag', machli: 'fish_curry', fish: 'fish_curry',
  puri: 'puri', rajma: 'rajma', raita: 'raita', milk: 'milk_glass', doodh: 'milk_glass', bread: 'bread_slice', kela: 'banana', seb: 'apple', aam: 'mango', khajoor: 'dates', haleem: 'haleem', nihari: 'nihari', dahi: 'dahi', kheer: 'kheer' };

import { skeleton, exact, near, rawLev } from './fuzzy.js';
export { skeleton };

/* ---------- dish index ---------- */
const words = s => s.toLowerCase().replace(/['’]/g, '').split(/[^\p{L}\p{N}]+/u).filter(w => w && !FILLER.has(w));
const INDEX = DISHES.map(d => ({ d, name: words(d.name), alias: words(d.alias) }));
const PRIORITY = new Set(Object.values(DEFAULT));

/** Dishes containing every word of the query; best first. `fuzzy` allows sound-alike words. */
function strict(qw, fuzzy = false) {
  if (!qw.length) return [];
  const eq = fuzzy ? near : exact, out = [];
  for (const e of INDEX) {
    let score = 0, ok = true;
    for (const w of qw) {
      if (e.name.some(n => exact(w, n))) score += 3.5;
      else if (e.alias.some(n => exact(w, n))) score += 2.5;
      else if (fuzzy && e.name.some(n => eq(w, n))) score += 3;
      else if (fuzzy && e.alias.some(n => eq(w, n))) score += 2;
      else { ok = false; break; }
    }
    if (!ok || qw.every(w => ADJ.has(w))) continue;
    const extra = e.name.filter(n => !qw.some(w => eq(w, n))).length;
    out.push({ d: e.d, score: score - extra * 0.4 + (PRIORITY.has(e.d.id) ? 0.5 : 0) });
  }
  return out.sort((a, b) => b.score - a.score);
}
/** A single word that clearly names a dish on its own ("halwa", "puri", "raita"), for splitting pairs. */
function standalone(w) {
  if (ADJ.has(w)) return null; // "sweet" alone isn't a dish
  const key = Object.keys(DEFAULT).find(k => exact(w, k)) || Object.keys(DEFAULT).find(k => near(w, k));
  if (key) return DEFAULT[key];
  const e = INDEX.find(x => exact(w, x.name[0])) || INDEX.find(x => near(w, x.name[0]));
  return e ? e.d.id : null;
}

const GENERIC = new Set(['any', 'the', 'and', 'pizza', 'burger', 'burgers', 'roll', 'cart', 'stall', 'shop', 'foods', 'food', 'cafe', 'roadside', 'hotel', 'dhaba', 'halwa', 'samosa', 'chaat', 'bhutta', 'broast', 'fried', 'fish', 'nihari', 'karahi', 'biryani', 'king', 'house', 'point', 'corner', 'centre', 'center', 'restaurant', 'tikka', 'kebab', 'kabab', 'chicken', 'paratha', 'chai', 'sweets', 'bakers', 'special']);
// A place's own word (Nagina, Cheezious, Kala Khan), not a food or describing word ("Corner Sweet House" is
// named by "corner"/"house", not "sweet"; "Haleem Ghar" not by "haleem").
const FOOD_WORDS = new Set(INDEX.flatMap(e => [...e.name, ...e.alias]));
const placeNamed = (name, query) => {
  const w = name.toLowerCase().replace(/['’]/g, '').split(/[^a-z0-9]+/).find(x => x.length >= 3 && !GENERIC.has(x) && !FOOD_WORDS.has(x) && !ADJ.has(x) && !SIDE.has(x));
  // In a spoken meal a place must really be named: exact, or one typo in a longer word (no prefixes: "bun" ≠ "Bundu").
  return !!w && query.split(' ').some(q => q === w || (q.length >= 6 && w.length >= 6 && q[0] === w[0] && rawLev(q, w) <= 1));
};

/** One phrase's words → a dish (or a place's menu item), or null. Tries splitting and dropping words. */
function match(qw, depth = 0) {
  if (!qw.length) return null;
  const query = qw.join(' ');
  // "kfc zinger", "nagina burger": a named place wins.
  const menu = searchPlaces(query, [], 1)[0];
  if (menu && !['Street', 'Dhaba'].includes(menu.place.type) && placeNamed(menu.place.name, query))
    return [{ ref: { t: 'dish', id: menu.item.dish }, opts: { ...menu.item.opts, menuBase: menu.item.opts.servings || 1 }, name: `${menu.place.name} · ${menu.item.name}`, official: menu.item.official && { ...menu.item.official, base: menu.item.opts.servings || 1 } }];
  if (qw.length === 1) {
    const w = qw[0];
    const key = Object.keys(DEFAULT).find(k => exact(w, k));
    if (key) return [one(DEFAULT[key])];
    if (SAY[w]) return match(words(SAY[w]), depth + 1);
  }
  const hit = strict(qw)[0];
  if (hit) return [one(hit.d.id)];
  const swapped = qw.map(w => SAY[w] ? words(SAY[w]) : [w]).flat();
  if (swapped.join(' ') !== query) { const h = strict(swapped)[0]; if (h) return [one(h.d.id)]; }
  if (qw.length === 1) { const id = standalone(qw[0]); if (id) return [one(id)]; }
  const fz = strict(qw, true)[0];
  if (fz) return [one(fz.d.id)];
  if (depth > 2) return null;
  // A wrapper with its filling ("seekh kebab paratha roll", "chicken cheese burger") is one item.
  for (const w of WRAPPER) {
    const ww = w.split(' ');
    if (qw.length > ww.length && ww.every((x, i) => exact(qw[qw.length - ww.length + i], x))) {
      const h = strict(qw.slice(-ww.length - 1))[0] || strict(ww)[0];
      if (h) return [one(h.d.id)];
    }
  }
  // Two dishes said together: "halwa puri", "daal chawal", "keema naan". Each half must name a dish by itself.
  for (let i = 1; i < qw.length; i++) {
    const L = qw.slice(0, i), R = qw.slice(i);
    const a = L.length === 1 ? (standalone(L[0]) && [one(standalone(L[0]))]) : match(L, 3);
    const b = R.length === 1 ? (standalone(R[0]) && [one(standalone(R[0]))]) : match(R, 3);
    if (a && b) return [...a, ...b];
  }
  // Drop a describing word ("sweet corn bhutta" → "corn bhutta"). Never drop the word that names the food:
  // "kadhi pakora" or "bhindi gosht" we don't know should come back as "didn't catch", not as a guess.
  for (let i = 0; i < qw.length; i++) {
    if (!ADJ.has(qw[i]) && !SIZE_WORDS.has(qw[i]) && !['sweet', 'corn', 'desi', 'fresh'].includes(qw[i])) continue;
    const r = match([...qw.slice(0, i), ...qw.slice(i + 1)], depth + 1);
    if (r) return r;
  }
  return null;
}
const one = id => ({ ref: { t: 'dish', id }, opts: {}, name: DISH[id].name });

/* ---------- normalising ---------- */
const norm = s => String(s).toLowerCase()
  .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
  .replace(/[؀-ۿ]+/g, w => URDU[w] ?? w)
  .replace(/(\d+)\s*\/\s*(\d+)/g, (_, a, b) => ` ${+a / +b} `).replace(/½/g, ' 0.5 ').replace(/¼/g, ' 0.25 ')
  .replace(/\b(\w+) and a half\b/g, (m, n) => (n in NUM || /^\d/.test(n)) ? ` ${(NUM[n] ?? +n) + 0.5} ` : m)
  .replace(/\bek dedh\b/g, 'dedh').replace(/['’]/g, '').replace(/[^\p{L}\p{N}.,+&]+/gu, ' ').trim();

/** Split "do roti aur karahi, chai" into item phrases. */
export function splitMeal(text) {
  return norm(text).split(/\s*(?:,|\+|&|\band\b|\baur\b|\bte\b|\bwith\b|\bke saath\b|\bsaath\b|\bplus\b)\s*/).map(s => s.trim()).filter(Boolean);
}

/** One phrase → { amount, unit, words }. */
export function readPhrase(phrase) {
  let amount = null, unit = null, mod = 0; const rest = [];
  for (const w of phrase.split(/\s+/)) {
    if (/^\d+(\.\d+)?$/.test(w)) amount = +w;
    else if (w === 'sawa') mod = 0.25;
    else if (w === 'paune' || w === 'pone') mod = -0.25;
    else if (w in NUM && !(w === 'a' || w === 'an') ) amount = NUM[w];
    else if (w === 'a' || w === 'an') amount ??= 1;
    else if (w in UNIT) unit = w;
    else if (COUNT.has(w)) unit = 'piece';
    else if (!FILLER.has(w) && !SIDE.has(w)) rest.push(w);
  }
  if (mod) amount = (amount ?? 1) + mod;
  return { amount: amount ?? 1, unit, words: rest };
}

/** "do roti aur aadhi plate biryani" → { items: [{ ref, opts: { servings }, name, said }], unknown: [...] }. */
// Where it was eaten, said once for the whole meal: "… from Burger Hub", "… at Johnny Rockets",
// "Ravi se karahi aur 2 naan", "ghar ka khana", "dhabay se". Every dish in the sentence takes it.
const HOME = /\b(ghar|gher|home|homemade|ammi)\b/, OILY = /\b(dhaba|dhabay|dhabe|shaadi|shadi|wedding|walima|mehndi|dawat|street|thela|thelay|cart|stall)\b/;
const CLAUSE_FILLER = new Set(['the', 'a', 'some', 'one', 'ek', 'aik', 'my', 'our', 'restaurant', 'hotel', 'place', 'shop', 'wala', 'wali', 'walay', 'se', 'say', 'sy', 'today', 'aaj', 'khaya', 'khayi', 'khai', 'ate', 'had', 'eaten', 'pi', 'piya', 'liya', 'li', 'mangwaya', 'order', 'ordered', 'delivery']);
function placeContext(text) {
  const n = norm(text), style = HOME.test(n) ? 'home' : OILY.test(n) ? 'shaadi' : null;
  const tries = [];
  const en = n.match(/^(.*?)\b(?:from|at)\s+(.+)$/);
  if (en) tries.push({ place: en[2], rest: en[1] });
  const ur = n.match(/^(.+?)\s+(?:se|say|sy|ka|ki|ke)\s+(.+)$/);
  if (ur) tries.push({ place: ur[1], rest: ur[2], urdu: true, se: /\s(se|say|sy)\s/.test(` ${n.slice(ur[1].length, ur[1].length + 5)} `) });
  for (const t of tries) {
    const pw = words(t.place).filter(w => !CLAUSE_FILLER.has(w) && !HOME.test(w) && !OILY.test(w)), q = pw.join(' ');
    if (!q) { if (style) return { style, rest: t.rest }; continue; }
    const hit = searchPlaces(q, [], 1)[0];
    if (hit && placeNamed(hit.place.name, q)) return { place: hit.place, style: style || (['Street', 'Dhaba'].includes(hit.place.type) ? 'shaadi' : 'restaurant'), rest: t.rest };
    // Not in the database: keep its name; it's restaurant food unless they said dhaba or home. "aloo ka paratha" is not a place.
    if ((!t.urdu || t.se) && !match(pw) && pw.length <= 4 && words(t.rest).length) return { unknownPlace: pw.map(w => w[0].toUpperCase() + w.slice(1)).join(' '), style: style || 'restaurant', rest: t.rest };
  }
  return style ? { style, rest: n } : null;
}
// Use the place's own menu item for a dish when it has one (same dish, or same family: "burger" → their burger).
function atPlace(it, ctx) {
  const P = ctx.place, d = DISH[it.ref.id];
  if (P) {
    // Same family is enough when they said it generically ("burger"); a specific word ("zinger") must match the item.
    const said = words(it.said || '').filter(w => !GENERIC.has(w) && !(w in NUM) && !(w in UNIT) && !FILLER.has(w));
    const famOk = x => d?.fam && DISH[x.dish]?.fam === d.fam && (!said.length || said.every(w => words(x.name).some(v => exact(v, w) || near(v, w))));
    const own = P.items.find(x => x.dish === it.ref.id) || P.items.find(famOk);
    if (own) return { ...it, ref: { t: 'dish', id: own.dish }, opts: { ...own.opts, menuBase: own.opts.servings || 1, servings: (own.opts.servings || 1) * (it.opts.servings || 1) }, name: `${P.name} · ${own.name}`, official: own.official && { ...own.official, base: own.opts.servings || 1 } };
    return { ...it, opts: { ...it.opts, style: ctx.style, styleKnown: true }, name: `${P.name} · ${d.name}` };
  }
  if (ctx.unknownPlace) return { ...it, opts: { ...it.opts, style: ctx.style, styleKnown: true }, name: `${d.name} · ${ctx.unknownPlace}`, place: ctx.unknownPlace };
  return { ...it, opts: { ...it.opts, style: ctx.style, styleKnown: true } };
}

export function parseMeal(text) {
  const ctx = placeContext(text);
  if (ctx) {
    const r = parseMealPlain(ctx.rest);
    return { items: r.items.map(it => it.name?.includes(' · ') && !ctx.unknownPlace && !ctx.place ? it : atPlace(it, ctx)), unknown: r.unknown, place: ctx.place?.name || ctx.unknownPlace || null, style: ctx.style };
  }
  return parseMealPlain(text);
}
function parseMealPlain(text) {
  const items = [], unknown = [];
  for (const ph of splitMeal(text)) {
    const { amount, unit, words: qw } = readPhrase(ph);
    if (!qw.length) continue;
    let m = match(qw);
    if (!m) { const bare = qw.filter(w => !SIZE_WORDS.has(w)); if (bare.length && bare.length < qw.length) m = match(bare); }
    if (!m) { unknown.push(qw.join(' ')); continue; }
    const share = m.length > 1 && unit && UNIT[unit] ? 1 / m.length : 1; // "ek plate cholay chawal": the plate is shared
    m.forEach((it, i) => {
      const d = DISH[it.ref.id], amt = share < 1 ? amount * share : i === 0 ? amount : 1; // "2 halwa puri": the number goes with the first
      let servings = amt;
      if (unit && ['liter', 'litre', 'l', 'ml', 'g', 'gm', 'gram', 'grams', 'kg'].includes(unit)) servings = Math.round(amt * UNIT[unit] / d.cooked * 4) / 4;
      else if (PACK[d.id] && !unit && amt >= 2) servings = Math.round(amt / PACK[d.id] * 100) / 100; // "4 nuggets" = 4 of a 6-piece box
      // A container: convert by weight to this dish's serving ("ek katori dahi" = 200 g of a 150 g serving).
      else if (unit && UNIT[unit] && unit !== d.serve && ['katori', 'bowl', 'plate', 'cup', 'glass', 'portion'].includes(d.serve) && UNIT[unit] !== d.cooked) {
        servings = Math.max(0.5, Math.round(amt * UNIT[unit] / d.cooked * 2) / 2);
      }
      items.push({ ...it, opts: { ...it.opts, servings: (it.opts.servings || 1) * servings }, said: ph });
    });
  }
  return { items, unknown };
}

/** True when the search box text looks like a whole meal rather than one food. */
export const looksLikeMeal = text => splitMeal(text).length > 1 || /^\s*(\d|ek|aik|do|teen|char|aadh|half|dedh|dhai|sawa|paune|one|two|three|a couple)\b/i.test(norm(text));

/** Speech recognisers return a few guesses ("do roti aur karahi" / "the roti or karahi"); keep the one we understand best. */
export function bestTranscript(alternatives) {
  let best = alternatives[0] || '', bestScore = -Infinity;
  for (const [i, t] of alternatives.entries()) {
    const r = parseMeal(t), score = r.items.length * 2 - r.unknown.length * 3 - i * 0.1;
    if (score > bestScore) { best = t; bestScore = score; }
  }
  return best;
}
