// Places: chains, well-known restaurants, street carts, and the places each client adds themselves.
//
// Every menu item points at a dish model in js/nutrition.js, with the portion and the cooking style
// that place uses. That keeps the numbers grounded: a client adding "Zinger from the corner shop"
// can't invent 120 kcal. Where a chain publishes official values for Pakistan, put them in `official`
// ({ kcal, protein, carbs, fat, source }) and they replace the estimate for that item.
//
// No public database lists every Pakistani restaurant and cart with nutrition, so this list is a
// seed: the big chains, famous local names, and the street-food formats every cart sells from.
// Clients grow it with "Add a place" (stored on the phone now; send to a backend later so every
// client sees places others added).
import { DISH, DISHES, estimate } from './nutrition.js';

const I = (name, dish, opts = {}, official = null) => ({ name, dish, opts, official });
const R = { style: 'restaurant', styleKnown: true }, S = { style: 'shaadi', styleKnown: true };

export const PLACES = [
  // Fast-food chains
  { id: 'kfc', name: 'KFC', type: 'Chain', items: [
    I('Zinger Burger', 'zinger_burger', R), I('Mighty Zinger', 'mighty_zinger', R), I('Krunch Burger', 'zinger_burger', { ...R, servings: 0.8 }),
    I('Hot & Crispy chicken (1 piece)', 'fried_chicken', R), I('Hot Wings (6)', 'fried_chicken', { ...R, servings: 1.3 }),
    I('Nuggets (6)', 'nuggets', R), I('Fries (regular)', 'fries', R), I('Fries (large)', 'fries', { ...R, servings: 1.5 }),
    I('Twister / wrap', 'shawarma', R), I('Soft drink (regular)', 'cola', { servings: 1.1 }) ] },
  { id: 'mcdonalds', name: "McDonald's", type: 'Chain', items: [
    I('Big Mac', 'beef_burger', R), I('McChicken', 'chicken_burger', R), I('McNuggets (6)', 'nuggets', R),
    I('Fries (medium)', 'fries', R), I('Fries (large)', 'fries', { ...R, servings: 1.4 }), I('Spicy McCrispy / Chicken Big Mac', 'zinger_burger', R),
    I('Soft drink (medium)', 'cola', { servings: 1.2 }), I('Milkshake', 'milkshake', {}) ] },
  { id: 'hardees', name: "Hardee's", type: 'Chain', items: [
    I('Beef burger (Thickburger style)', 'beef_burger', { ...R, servings: 1.4 }), I('Chicken fillet burger', 'zinger_burger', R),
    I('Fried chicken (1 piece)', 'fried_chicken', R), I('Curly / regular fries', 'fries', { ...R, servings: 1.2 }) ] },
  { id: 'burgerking', name: 'Burger King', type: 'Chain', items: [
    I('Whopper', 'beef_burger', { ...R, servings: 1.2 }), I('Chicken Royale', 'chicken_burger', { ...R, servings: 1.3 }), I('Fries (medium)', 'fries', R) ] },
  { id: 'dominos', name: "Domino's", type: 'Chain', items: [
    I('Pizza slice (medium)', 'pizza_slice', R), I('Pizza slice (large)', 'pizza_slice', { ...R, servings: 1.3 }), I('Whole medium pizza (8 slices)', 'pizza_slice', { ...R, servings: 8 }) ] },
  { id: 'pizzahut', name: 'Pizza Hut', type: 'Chain', items: [
    I('Pan pizza slice (medium)', 'pizza_slice', { ...R, servings: 1.2 }), I('Whole medium pan pizza (6 slices)', 'pizza_slice', { ...R, servings: 7.2 }) ] },
  { id: 'subway', name: 'Subway', type: 'Chain', items: [I('6-inch chicken sub', 'sub_6', R), I('Footlong chicken sub', 'sub_6', { ...R, servings: 2 })] },
  { id: 'optp', name: 'OPTP', type: 'Chain', items: [I('Fries (regular)', 'fries', R), I('Loaded fries', 'fries', { ...R, servings: 1.5 }), I('Chicken wrap', 'shawarma', R), I('Zinger-style burger', 'zinger_burger', R)] },
  { id: 'jj', name: 'Johnny & Jugnu', type: 'Chain', items: [I('Wrap', 'shawarma', { ...R, servings: 1.2 }), I('Crispy chicken burger', 'zinger_burger', R), I('Fries', 'fries', R)] },

  // Desi restaurants (portions and oil as they usually serve them)
  { id: 'savour', name: 'Savour Foods', type: 'Restaurant', items: [
    I('Pulao kebab plate (chicken pulao, 2 shami kebab)', 'chicken_pulao', { ...R, servings: 1.2 }), I('Shami kebab', 'shami_kebab', R), I('Raita', 'raita', {}), I('Kheer', 'kheer', {}) ] },
  { id: 'student-biryani', name: 'Student Biryani', type: 'Restaurant', items: [I('Chicken biryani (single)', 'chicken_biryani', R), I('Chicken biryani (full)', 'chicken_biryani', { ...R, servings: 1.6 }), I('Raita', 'raita', {})] },
  { id: 'butt-karahi', name: 'Butt Karahi', type: 'Restaurant', items: [I('Mutton karahi (per person)', 'mutton_karahi', { ...S, servings: 1.5 }), I('Chicken karahi (per person)', 'chicken_karahi', { ...S, servings: 1.5 }), I('Naan', 'naan', R), I('Roghni naan', 'roghni_naan', R)] },
  { id: 'waris-nihari', name: 'Waris Nihari', type: 'Restaurant', items: [I('Nihari (plate)', 'nihari', S), I('Nalli nihari', 'nihari', { ...S, servings: 1.3 }), I('Khamiri roti / naan', 'naan', R)] },
  { id: 'kababjees', name: 'Kababjees', type: 'Restaurant', items: [I('Seekh kebab', 'seekh_kebab', R), I('Chicken tikka', 'chicken_tikka', R), I('Malai boti', 'chicken_boti', R), I('Paratha roll', 'paratha_roll', R)] },
  { id: 'bundu-khan', name: 'Bundu Khan', type: 'Restaurant', items: [I('Chicken tikka', 'chicken_tikka', R), I('Beef seekh kebab', 'seekh_kebab', R), I('Chicken karahi', 'chicken_karahi', R), I('Naan', 'naan', R)] },

  // Every dhaba and cart sells from the same short menu, so these cover the smallest stalls too.
  { id: 'dhaba', name: 'Any dhaba / roadside hotel', type: 'Dhaba', items: [
    I('Daal chana', 'daal_chana', S), I('Daal mash', 'daal_mash', S), I('Chicken karahi', 'chicken_karahi', S), I('Mix sabzi', 'mix_sabzi', S),
    I('Tandoori roti', 'tandoori_roti', {}), I('Paratha', 'paratha', S), I('Chai', 'chai', { servings: 1 }) ] },
  { id: 'nashta', name: 'Halwa puri / nashta shop', type: 'Street', items: [I('Puri', 'puri', S), I('Suji halwa', 'suji_halwa', S), I('Cholay', 'cholay', S), I('Aloo bhujia', 'aloo_matar', S), I('Lassi', 'sweet_lassi', {})] },
  { id: 'bun-kebab-cart', name: 'Bun kebab / anda shami cart', type: 'Street', items: [I('Bun kebab', 'bun_kebab', S), I('Anda shami burger', 'anda_shami_burger', S), I('Chicken burger', 'chicken_burger', S)] },
  { id: 'roll-stall', name: 'Roll and shawarma stall', type: 'Street', items: [I('Chicken paratha roll', 'paratha_roll', S), I('Shawarma', 'shawarma', S), I('Fries', 'fries', S)] },
  { id: 'chaat-cart', name: 'Chaat and gol gappay cart', type: 'Street', items: [I('Gol gappay (6)', 'gol_gappay', S), I('Chana chaat', 'chana_chaat', {}), I('Samosa chaat', 'samosa_chaat', S), I('Dahi bhalla', 'dahi_bhalla', S), I('Fruit chaat', 'fruit_chaat', {})] },
  { id: 'samosa-pakora', name: 'Samosa and pakora stall', type: 'Street', items: [I('Samosa', 'samosa', S), I('Pakoray (plate)', 'pakora', S), I('Jalebi', 'jalebi', S)] },
  { id: 'bbq-stall', name: 'BBQ stall', type: 'Street', items: [I('Chicken tikka (leg)', 'chicken_tikka', S), I('Seekh kebab', 'seekh_kebab', S), I('Chicken boti (seekh)', 'chicken_boti', S), I('Chapli kebab', 'chapli_kebab', S)] },
  { id: 'broast-shop', name: 'Broast shop', type: 'Street', items: [I('Broast (quarter)', 'broast', S), I('Fries', 'fries', S), I('Bun', 'bread_slice', { servings: 2 })] },
  { id: 'fry-fish', name: 'Fried fish stall', type: 'Street', items: [I('Lahori fish (portion)', 'fried_fish', S)] },
  { id: 'corn-cart', name: 'Bhutta cart', type: 'Street', items: [I('Bhutta', 'bhutta', {})] },
];

const norm = s => String(s).toLowerCase().replace(/['’]/g, '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** All places: the seed list plus the client's own. */
export const allPlaces = (custom = []) => [...PLACES, ...custom.map(p => ({ ...p, type: p.type || 'Added by you', custom: true }))];

/** Nutrition for a menu item: the chain's official numbers if present, else the dish model. */
export function itemNutrition(item) {
  if (item.official) { const o = item.official; return { kcal: o.kcal, protein: o.protein, carbs: o.carbs, fat: o.fat, fibre: o.fibre || 0, low: Math.round(o.kcal * 0.95), high: Math.round(o.kcal * 1.05), official: true, parts: { fat: o.fat * 9, meat: 0, rest: o.kcal - o.fat * 9 } }; }
  return estimate({ t: 'dish', id: item.dish }, item.opts);
}

/** Search places and their menus: "kfc zinger", "butt karahi", "gol gappay cart". */
export function searchPlaces(q, custom = [], limit = 12) {
  const words = norm(q).split(' ').filter(Boolean);
  if (!words.length) return [];
  const out = [];
  for (const p of allPlaces(custom)) {
    const pn = norm(p.name);
    const placeHit = words.filter(w => pn.includes(w));
    for (const it of p.items || []) {
      if (!DISH[it.dish]) continue;
      const hay = norm(it.name + ' ' + DISH[it.dish].name + ' ' + DISH[it.dish].alias);
      const rest = words.filter(w => !pn.includes(w));
      if (!placeHit.length && !rest.length) continue;
      if (rest.every(w => hay.includes(w)) && (placeHit.length || rest.length)) {
        out.push({ place: p, item: it, score: placeHit.length * 3 + rest.length * 2 - (placeHit.length && !rest.length ? 2 : 0) });
      }
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Closest dish models for a new menu item a client is adding ("chicken cheese burger" → burgers). */
// Ranks by how many of the words match, so extra words ("cheese", "special") don't hide the right family.
export function suggestDish(name, n = 5) {
  const words = norm(name).split(' ').filter(w => w.length > 2);
  return DISHES.map(d => { const hay = norm(d.name + ' ' + d.alias); return { d, score: words.filter(w => hay.includes(w)).length - hay.length / 500 }; })
    .filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, n).map(x => x.d);
}
