// Places and menus, and how QK's recipe models compare with chains' published values. Run: node tests/menus.test.mjs
import { PLACES, searchPlaces, itemNutrition, suggestDish, allPlaces } from '../js/menus.js';
import { estimate, DISH } from '../js/nutrition.js';
import { parseMeal } from '../js/foodtext.js';
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };

const items = PLACES.flatMap(p => p.items.map(it => ({ p, it })));
check(`${PLACES.length} places, ${items.length} menu items, all tied to a dish model`, items.every(({ it }) => DISH[it.dish]) && PLACES.length >= 40);
check('ids are unique', new Set(PLACES.map(p => p.id)).size === PLACES.length);
check('every official value names its source and URL', items.filter(x => x.it.official).every(({ it }) => it.official.source && /^https:/.test(it.official.url)));

// Validation: the recipe model for each item vs the chain's own published number.
const rows = items.filter(x => x.it.official).map(({ p, it }) => {
  const model = estimate({ t: 'dish', id: it.dish }, it.opts).kcal, off = it.official.kcal;
  return { name: `${p.name} ${it.name}`, model: Math.round(model), off, err: (model - off) / off };
});
for (const r of rows) console.log(`     ${r.name.padEnd(44)} model ${String(r.model).padStart(4)}  official ${String(r.off).padStart(4)}  ${r.err > 0 ? '+' : ''}${Math.round(r.err * 100)}%`);
const abs = rows.map(r => Math.abs(r.err)).sort((a, b) => a - b), med = abs[abs.length >> 1];
check(`recipe models vs ${rows.length} published values: median error ≤ 15%`, med <= 0.15, `${Math.round(med * 100)}%`);
check('no model more than 35% off a published value', abs[abs.length - 1] <= 0.35, `worst ${Math.round(abs[abs.length - 1] * 100)}%`);

// Search and parsing
const top = q => searchPlaces(q)[0];
check('"kfc zinger" → KFC Zinger with official UK value', top('kfc zinger')?.item.name === 'Zinger Burger' && itemNutrition(top('kfc zinger').item).official);
check('"cheezious crown crust" → Cheezious', top('cheezious crown crust')?.place.id === 'cheezious');
check('"mcdonalds" without apostrophe works', searchPlaces('mcdonalds').length > 5);
check('"javed nihari" found', top('javed nihari')?.place.id === 'javed-nihari');
const said = parseMeal('2 big mac from mcdonalds aur ek medium fries');
check('"2 big mac from mcdonalds" → McDonald\'s Big Mac × 2 (official)', said.items[0]?.name === "McDonald's · Big Mac" && said.items[0].opts.servings / said.items[0].opts.menuBase === 2 && said.items[0].official, JSON.stringify(said.items.map(i => i.name)));
check('"cheezious pizza" → a Cheezious slice', /Cheezious/.test(parseMeal('cheezious pizza')?.items[0]?.name || ''));
check('add-a-place suggestions find burgers for "chicken cheese burger"', suggestDish('chicken cheese burger').some(d => d.id === 'chicken_burger'));
// Local places, city by city
check('"nagina burger" → Nagina Burger Point (Islamabad)', top('nagina burger')?.place.id === 'nagina-burger' && top('nagina burger').place.city === 'Islamabad');
check('typos still find it ("nagina burgr")', top('nagina burgr')?.place.id === 'nagina-burger');
check('"cheezius" → Cheezious, not another pizza place', top('cheezius')?.place.id === 'cheezious');
check('city + dish: "peshawar chapli" → a Peshawar place', top('peshawar chapli')?.place.city === 'Peshawar');
check('your city ranks first ("nihari" in Karachi)', searchPlaces('nihari', [], 5, 'Karachi')[0]?.place.city === 'Karachi');
check('"bhindi" does not find Bundu Khan', !searchPlaces('bhindi').some(r => r.place.id === 'bundu-khan'));
check('"nagina burger" said in a meal → their anda shami burger', parseMeal('nagina burger aur chai').items[0]?.name === 'Nagina Burger Point · Anda shami burger');
check('a sweets shop is not named by "sweet"', !/Sweet/.test(parseMeal('sweet lassi').items[0]?.name || ''));
check('every local place has a city and a source', allPlaces().filter(p => p.type === 'Local').every(p => p.city && /^https?:/.test(p.url)));

console.log(fails ? `\n${fails} FAILED` : '\nall menu checks passed');
process.exit(fails ? 1 : 0);
