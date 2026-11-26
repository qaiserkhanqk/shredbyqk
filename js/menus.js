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
import { near, typo } from './fuzzy.js';

const I = (name, dish, opts = {}, official = null) => ({ name, dish, opts, official });
const R = { style: 'restaurant', styleKnown: true }, S = { style: 'shaadi', styleKnown: true };

// Official values: published by the chain, but for another country's menu (no chain publishes Pakistan
// values yet; the Punjab Food Authority asked them to in 2023). Each says where it's from. Gathered from
// the chains' nutrition pages and PDFs in Nov 2026; re-check the URL before relying on one.
const O = (kcal, protein, carbs, fat, source, url) => ({ kcal, protein, carbs, fat, source, url });
const MCD_SG = 'McDonald\'s Singapore', KFC_UK = 'KFC UK (Mar 2025)';
export const PLACES = [
  // International chains
  { id: 'kfc', name: 'KFC', type: 'Chain', items: [
    I('Zinger Burger', 'zinger_burger', R, O(420, 25.8, 40.9, 17.6, KFC_UK, 'https://www.kfc.co.uk/nutrition-allergens')),
    I('Mighty Zinger', 'mighty_zinger', R), I('Krunch Burger', 'zinger_burger', { ...R, servings: 0.8 }),
    I('Hot & Crispy chicken (1 piece)', 'fried_chicken', R),
    I('Hot Wings (6)', 'wings', R, O(540, 29.4, 22.2, 37.2, KFC_UK + ', 6 × 90 kcal', 'https://www.kfc.co.uk/nutrition-allergens')),
    I('Popcorn chicken (regular)', 'nuggets', R, O(285, 17.6, 17.6, 16.2, KFC_UK, 'https://www.kfc.co.uk/nutrition-allergens')),
    I('Nuggets (6)', 'nuggets', R), I('Fries (regular)', 'fries', R, O(245, 3.7, 38.1, 9.2, KFC_UK, 'https://www.kfc.co.uk/nutrition-allergens')),
    I('Fries (large)', 'fries', { ...R, servings: 1.5 }), I('Twister / wrap', 'shawarma', R), I('Soft drink (regular)', 'cola', { servings: 1.1 }) ] },
  { id: 'mcdonalds', name: "McDonald's", type: 'Chain', items: [
    I('Big Mac', 'beef_burger', R, O(558, 28, 48, 28, MCD_SG, 'https://www.mcdonalds.com.sg/food-menu/big-mac')),
    I('McChicken', 'chicken_burger', R, O(391, 15, 42, 18, MCD_SG, 'https://www.mcdonalds.com.sg/food-menu/mcchicken')),
    I('McSpicy', 'zinger_burger', R, O(541, 23, 50, 28, MCD_SG, 'https://www.mcdonalds.com.sg/food-menu/mcspicy')),
    I('Double McSpicy', 'mighty_zinger', R, O(833, 38, 66, 46, MCD_SG, 'https://www.mcdonalds.com.sg/food-menu/double-mcspicy')),
    I('Filet-O-Fish', 'chicken_burger', R, O(332, 15, 38, 13, MCD_SG, 'https://www.mcdonalds.com.sg/food-menu/filet-o-fish')),
    I('McNuggets (6)', 'nuggets', R, O(273, 14, 17, 16, MCD_SG, 'https://www.mcdonalds.com.sg/food-menu/chicken-mcnuggets-6pc')),
    I('Fries (small)', 'fries', { ...R, servings: 0.8 }, O(315, 4, 37, 17, MCD_SG, 'https://www.mcdonalds.com.sg/food-menu/french-fries-small')),
    I('Fries (medium)', 'fries', R, O(384, 5, 46, 20, MCD_SG, 'https://www.mcdonalds.com.sg/food-menu/french-fries-medium')),
    I('Fries (large)', 'fries', { ...R, servings: 1.4 }, O(512, 6, 61, 27, MCD_SG, 'https://www.mcdonalds.com.sg/food-menu/french-fries-large')),
    I('Soft drink (medium)', 'cola', { servings: 1.2 }), I('Milkshake', 'milkshake', {}) ] },
  { id: 'hardees', name: "Hardee's", type: 'Chain', items: [
    I('Famous Star with Cheese', 'beef_burger', { ...R, servings: 1.2 }, O(670, 28, 52, 40, "Hardee's USA", 'https://www.hardees.com/menu')),
    I('Beef burger (Thickburger style)', 'beef_burger', { ...R, servings: 1.4 }), I('Chicken fillet burger', 'zinger_burger', R),
    I('Fried chicken (1 piece)', 'fried_chicken', R), I('Curly / regular fries', 'fries', { ...R, servings: 1.2 }) ] },
  { id: 'burgerking', name: 'Burger King', type: 'Chain', items: [
    I('Whopper', 'beef_burger', { ...R, servings: 1.2 }, O(660, 28, 49, 40, 'Burger King USA', 'https://www.bk.com/nutrition')),
    I('Chicken Royale', 'chicken_burger', { ...R, servings: 1.3 }), I('Fries (medium)', 'fries', R) ] },
  { id: 'dominos', name: "Domino's", type: 'Chain', items: [
    I('Pizza slice (medium)', 'pizza_slice', R), I('Pizza slice (large)', 'pizza_slice', { ...R, servings: 1.3 }), I('Whole medium pizza (8 slices)', 'pizza_slice', { ...R, servings: 8 }) ] },
  { id: 'pizzahut', name: 'Pizza Hut', type: 'Chain', items: [
    I('Pan pizza slice (medium)', 'pizza_slice', { ...R, servings: 1.2 }), I('Whole medium pan pizza (6 slices)', 'pizza_slice', { ...R, servings: 7.2 }) ] },
  { id: 'subway', name: 'Subway', type: 'Chain', items: [
    I('Chicken Tikka 6-inch', 'sub_6', R, O(302, 26, 42, 3.7, 'Subway UK', 'https://www.subway.com/en-gb/menunutrition/menu/category/subs/product/chicken-tikka')),
    I('Chicken Tikka Footlong', 'sub_6', { ...R, servings: 2 }, O(605, 51, 84, 7.3, 'Subway UK', 'https://www.subway.com/en-gb/menunutrition/menu/category/subs/product/chicken-tikka')) ] },
  { id: 'dunkin', name: "Dunkin'", type: 'Chain', items: [I('Glazed donut', 'donut', {}, O(240, 4, 33, 11, "Dunkin' USA", 'https://www.dunkindonuts.com/en/menu/nutrition'))] },
  { id: 'krispykreme', name: 'Krispy Kreme', type: 'Chain', items: [I('Original Glazed', 'donut', {}, O(195, 3, 27, 7.9, 'Krispy Kreme UK (2025)', 'https://www.krispykreme.co.uk/allergens-nutrition'))] },
  { id: 'baskin', name: 'Baskin-Robbins', type: 'Chain', items: [I('Ice cream (1 regular scoop, 71 g)', 'ice_cream', { servings: 0.5 }, O(170, 3, 20, 9, 'Baskin-Robbins USA (Pralines n Cream)', 'https://www.baskinrobbins.com/en/nutrition'))] },

  // Pakistani chains (no published nutrition: QK estimates from the closest dish, at restaurant oil levels)
  { id: 'cheezious', name: 'Cheezious', type: 'Chain', items: [I('Crown Crust (slice)', 'cheesy_pizza_slice', { ...R, servings: 1.2 }), I('Stuffed Crust (slice)', 'cheesy_pizza_slice', { ...R, servings: 1.15 }), I('Kabab Bite (slice)', 'cheesy_pizza_slice', R), I('Chicken Fajita (slice)', 'cheesy_pizza_slice', R), I('Peri Peri (slice)', 'cheesy_pizza_slice', R), I('Medium pizza (whole, 6 slices)', 'cheesy_pizza_slice', { ...R, servings: 6 })] },
  { id: 'broadway', name: 'Broadway Pizza', type: 'Chain', items: [I('Dancing Fajita (slice)', 'cheesy_pizza_slice', R), I('Tarzan Tikka (slice)', 'cheesy_pizza_slice', R), I('Mughlai Beast (slice)', 'cheesy_pizza_slice', { ...R, servings: 1.1 })] },
  { id: 'pizzamax', name: 'Pizza Max', type: 'Chain', items: [I('Pizza slice', 'cheesy_pizza_slice', R), I('Creamy Chicken Pasta', 'creamy_pasta', R), I('Creamy Chicken Lasagne', 'lasagna', R)] },
  { id: 'californiapizza', name: 'California Pizza', type: 'Chain', items: [I('Chicken Tikka (slice)', 'cheesy_pizza_slice', R), I('Dynamite / Cheesy Mayo (slice)', 'cheesy_pizza_slice', { ...R, servings: 1.15 })] },
  { id: 'burgerlab', name: 'Burger Lab', type: 'Chain', items: [I('Firehouse', 'zinger_burger', { ...R, servings: 1.3 }), I("Lab's Original", 'beef_burger', R), I('Big Bang', 'beef_burger', { ...R, servings: 1.3 }), I('Chilli Poppers', 'nuggets', R), I('Fries', 'fries', R)] },
  { id: 'ranchers', name: 'Ranchers', type: 'Chain', items: [I('Krunch Burger', 'zinger_burger', R), I('Bronco', 'zinger_burger', { ...R, servings: 1.2 }), I('Mighty Rodeo Beef Burger', 'beef_burger', { ...R, servings: 1.3 })] },
  { id: 'howdy', name: 'Howdy', type: 'Chain', items: [I('Son of a Bun', 'beef_burger', { ...R, servings: 1.4 }), I('Rodeo Glory', 'beef_burger', { ...R, servings: 1.2 }), I('Rango Tango', 'zinger_burger', R), I('Wrangler (pita)', 'shawarma', R)] },
  { id: 'kaybees', name: 'Kaybees', type: 'Chain', items: [I('Zinger Burger', 'zinger_burger', R), I('Double Decker Zinger', 'mighty_zinger', R), I('Crispy Broast (quarter)', 'broast', R), I('Chicken Cheese Burger', 'chicken_burger', { ...R, topping: true })] },
  { id: 'optp', name: 'OPTP', type: 'Chain', items: [I('Fries (regular)', 'fries', R), I('Loaded Nashville / Bomber Fries', 'loaded_fries', R), I('Crispy Wings', 'wings', R), I('Al Arabi Burger', 'shawarma', R), I('Smash Beef', 'beef_burger', R)] },
  { id: 'jj', name: 'Johnny & Jugnu', type: 'Chain', items: [I('Wehshi', 'zinger_burger', { ...R, servings: 1.2 }), I('Johnny Classic', 'beef_burger', R), I('Johnny Crispy', 'zinger_burger', R), I('Fries', 'fries', R)] },
  { id: 'hotnspicy', name: 'Hot n Spicy', type: 'Chain', items: [I('Chicken Bihari Roll', 'paratha_roll', R), I('Malai Cheese Roll', 'paratha_roll', { ...R, servings: 1.15 }), I('Chicken Chutney Roll', 'paratha_roll', R)] },
  { id: 'tooso', name: 'Tooso', type: 'Restaurant', items: [I('Club Sandwich', 'club_sandwich', R), I('Sweet Chilli Burger', 'zinger_burger', R), I('Halwa Puri (2 puri, halwa, cholay)', 'puri', { ...R, servings: 2 }), I('Chicken Karahi', 'chicken_karahi', R)] },

  // Desi restaurants (portions and oil as they usually serve them)
  { id: 'savour', name: 'Savour Foods', type: 'Restaurant', items: [
    I('Pulao Kabab (chicken pulao, 2 shami kebab)', 'chicken_pulao', { ...R, servings: 1.2 }), I('Chicken Pulao Single', 'chicken_pulao', R), I('Shami Kabab', 'shami_kebab', R), I('Zarda', 'zarda', R), I('Raita', 'raita', {}), I('Kheer', 'kheer', {}) ] },
  { id: 'student-biryani', name: 'Student Biryani', type: 'Restaurant', items: [I('Chicken Biryani (single)', 'chicken_biryani', R), I('Chicken Biryani (full)', 'chicken_biryani', { ...R, servings: 1.6 }), I('Plain (sada) biryani', 'chicken_biryani', { ...R, meat: 'less' }), I('Raita', 'raita', {})] },
  { id: 'butt-karahi', name: 'Butt Karahi', type: 'Restaurant', items: [I('Mutton karahi (per person)', 'mutton_karahi', { ...S, servings: 1.5 }), I('Chicken karahi (per person)', 'chicken_karahi', { ...S, servings: 1.5 }), I('Naan', 'naan', R), I('Roghni naan', 'roghni_naan', R)] },
  { id: 'waris-nihari', name: 'Waris Nihari', type: 'Restaurant', items: [I('Nihari (plate)', 'nihari', S), I('Nalli nihari', 'nihari', { ...S, servings: 1.3 }), I('Khamiri roti / naan', 'naan', R), I('Special lassi', 'sweet_lassi', {})] },
  { id: 'javed-nihari', name: 'Javed Nihari', type: 'Restaurant', items: [I('Special Nalli Nihari', 'nihari', { ...S, servings: 1.3 }), I('Plain Nihari', 'nihari', S), I('Naan', 'naan', R)] },
  { id: 'kababjees', name: 'Kababjees', type: 'Restaurant', items: [I('Seekh kebab', 'seekh_kebab', R), I('Chicken tikka', 'chicken_tikka', R), I('Malai boti', 'chicken_boti', R), I('Reshmi kabab', 'seekh_kebab', R), I('Paratha roll', 'paratha_roll', R)] },
  { id: 'bundu-khan', name: 'Bundu Khan', type: 'Restaurant', items: [I('Chicken leg tikka', 'chicken_tikka', R), I('Beef seekh kebab', 'seekh_kebab', R), I('Chicken karahi', 'chicken_karahi', R), I('Tawa paratha', 'paratha', R), I('Naan', 'naan', R), I('Lassi', 'sweet_lassi', {})] },
  { id: 'monal', name: 'Monal', type: 'Restaurant', items: [I('Mutton karahi', 'mutton_karahi', R), I('Mutton seekh kabab', 'seekh_kebab', R), I('Mutton pulao', 'beef_pulao', R)] },
  { id: 'chaaye-khana', name: 'Chaaye Khana', type: 'Cafe', items: [I('Halwa puri', 'puri', { ...R, servings: 2 }), I('Aloo paratha', 'aloo_paratha', R), I('Chicken qeema', 'qeema', R), I('Peshawari kehwa', 'kehwa', {}), I('Kunafa', 'kunafa', R)] },
  { id: 'cafe-aylanto', name: 'Cafe Aylanto', type: 'Cafe', items: [I('Moroccan Chicken', 'grilled_chicken_meal', R), I('Tarragon Chicken', 'grilled_chicken_meal', { ...R, servings: 1.1 })] },
  { id: 'jade-cafe', name: 'Jade Cafe', type: 'Cafe', items: [I('Grilled Chicken Fillet', 'grilled_chicken_meal', R), I('California Club Sandwich', 'club_sandwich', R), I('Chicken Fettuccine Alfredo', 'creamy_pasta', R)] },
  { id: 'xanders', name: "Xander's", type: 'Cafe', items: [I('Babar Pasta', 'creamy_pasta', R), I('Beef Lasagna', 'lasagna', R)] },
  { id: 'saltnpepper', name: "Salt'n Pepper", type: 'Restaurant', items: [I('Stuffed Chicken Breast', 'grilled_chicken_meal', R), I('Chicken Chow Mein', 'chow_mein', R)] },

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
  // Another country's official value: precise for that recipe, but Pakistani portions can differ, hence ±10%.
  if (item.official) { const o = item.official; return { kcal: o.kcal, protein: o.protein, carbs: o.carbs, fat: o.fat, fibre: o.fibre || 0, low: Math.round(o.kcal * 0.9 / 10) * 10, high: Math.round(o.kcal * 1.1 / 10) * 10, official: true, source: o.source, url: o.url, parts: { fat: o.fat * 9, meat: 0, rest: o.kcal - o.fat * 9 } }; }
  return estimate({ t: 'dish', id: item.dish }, item.opts);
}

/**
 * Search places and their menus: "kfc zinger", "nagina burger", "butt karahi", "rawalpindi burger".
 * Typo-tolerant ("nagina burgr", "cheezius", "kababjes"): words are matched by sound, not exact spelling.
 * A word can hit the place's name, its city or area, or the item.
 */
export function searchPlaces(q, custom = [], limit = 12) {
  const words = norm(q).split(' ').filter(w => w && !STOP.has(w));
  if (!words.length) return [];
  const out = [];
  const hit = (w, list) => list.some(x => x === w || (w.length >= 3 && x.startsWith(w)) || near(w, x));
  const named = (w, list) => list.some(x => typo(w, x));
  for (const p of allPlaces(custom)) {
    const pw = norm(p.name).split(' '), cw = norm([p.city, p.area].filter(Boolean).join(' ')).split(' ').filter(Boolean);
    const placeHit = words.filter(w => named(w, pw)), cityHit = words.filter(w => !placeHit.includes(w) && named(w, cw));
    for (const it of p.items || []) {
      if (!DISH[it.dish]) continue;
      const iw0 = norm(it.name + ' ' + DISH[it.dish].name + ' ' + DISH[it.dish].alias).split(' '), iw = [...iw0, ...iw0.slice(1).map((x, i) => iw0[i] + x)]; // "bigmac" = "big mac"
      const rest = words.filter(w => !placeHit.includes(w) && !cityHit.includes(w));
      if (!placeHit.length && !cityHit.length && !rest.length) continue;
      if (!rest.every(w => hit(w, iw))) continue;
      if (!placeHit.length && !rest.length) continue; // a city alone isn't enough to list every item there
      const exactName = placeHit.filter(w => pw.includes(w)).length;
      out.push({ place: p, item: it, score: placeHit.length * 3 + exactName * 0.5 + cityHit.length * 1.5 + rest.length * 2 - (placeHit.length && !rest.length ? 2 : 0) + (p.custom ? 0.3 : 0) });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
const STOP = new Set(['the', 'from', 'at', 'se', 'ka', 'ki', 'ke', 'wala', 'wali', 'of', 'in', 'mein']);

/** Closest dish models for a new menu item a client is adding ("chicken cheese burger" → burgers). */
// Ranks by how many of the words match, so extra words ("cheese", "special") don't hide the right family.
export function suggestDish(name, n = 5) {
  const words = norm(name).split(' ').filter(w => w.length > 2);
  return DISHES.map(d => { const hay = norm(d.name + ' ' + d.alias); return { d, score: words.filter(w => hay.includes(w)).length - hay.length / 500 }; })
    .filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, n).map(x => x.d);
}
