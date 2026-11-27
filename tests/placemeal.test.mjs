// "I ate this from that place": the place decides the portion, the oil and (for chains) the official numbers.
import { parseMeal } from '../js/foodtext.js';
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : '  ' + detail}`); if (!ok) fails++; };
const show = r => JSON.stringify(r.items.map(i => [i.name, i.opts.servings, i.opts.style, !!i.official]));
const cases = [
  ['big mac from mcdonalds', r => r.items[0].name === "McDonald's · Big Mac" && r.items[0].official, 'a chain item uses its official values'],
  ['kfc ka mighty zinger aur fries', r => r.items.length === 2 && r.items.every(i => i.name.startsWith('KFC · ')), 'Urdu "ka": both items come from KFC'],
  ['nagina se anda shami burger khaya', r => r.items[0].name === 'Nagina Burger Point · Anda shami burger', 'Urdu "se" with a local place'],
  ['ravi restaurant se chicken karahi aur 2 naan', r => r.items.length === 2 && r.items.every(i => i.name.startsWith('Ravi Restaurant · ')) && r.items[1].opts.servings === 2, 'every dish in the sentence is from that place'],
  ['burger from nagina', r => r.items[0].name === 'Nagina Burger Point · Anda shami burger', 'a generic "burger" becomes the place\'s burger'],
  ['zinger burger from burger hub', r => r.items[0].ref.id === 'zinger_burger' && r.items[0].opts.style === 'restaurant' && r.items[0].name.startsWith('Burger Hub · '), 'a specific dish the place doesn\'t list: restaurant-style, keeps the place'],
  ['ate a beef burger at johnny rockets', r => r.items[0].ref.id === 'beef_burger' && r.items[0].opts.style === 'restaurant' && r.place === 'Johnny Rockets', 'a place not in the database: restaurant-style, name kept'],
  ['chicken karahi from some dhaba', r => r.items[0].opts.style === 'shaadi', 'a dhaba means the oilier style'],
  ['karahi at home', r => r.items[0].opts.style === 'home', '"at home" means home cooking'],
  ['ghar ka daal chawal', r => r.items.length === 2 && r.items.every(i => i.opts.style === 'home'), '"ghar ka" means home cooking'],
  ['aloo ka paratha aur chai', r => r.items[0].ref.id === 'aloo_paratha' && !r.place, '"aloo ka paratha" is not a place'],
  ['do roti aur karahi', r => r.items.length === 2 && !r.place, 'no place said: unchanged'],
  ['ek plate chicken mandi aur karak chai from bait al mandi', r => r.items[0].name.startsWith('Bait Al Mandi · '), 'UAE place'],
];
for (const [t, ok, what] of cases) { const r = parseMeal(t); check(`${what}: "${t}"`, !!ok(r), show(r)); }
console.log(fails ? `\n${fails} failed` : '\nall place-meal checks pass');
process.exit(fails ? 1 : 0);
