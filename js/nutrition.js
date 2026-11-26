// Desi nutrition engine. Calories are COMPUTED from ingredients, never guessed.
//
// The problem with desi food in other apps: one database row for "chicken karahi" can't be right,
// because the same plate can be 280 or 480 kcal depending on how much oil went in and how much of
// the katori was meat rather than masala. So each dish here is a small recipe model:
//   meat (raw edible grams) + base ingredients (raw grams) + cooking fat (grams, by who cooked it)
// for one standard serving, with its cooked weight. The user (or the photo step) only answers what
// a person can actually tell: how much, who cooked it, mostly meat or mostly gravy, oil on top.
// Every estimate comes with a likely range, and says where the calories come from.
//
// Ingredient values per 100 g are rounded from USDA FoodData Central SR Legacy (public domain, CC0)
// unless noted. Fat per serving is a modelling assumption, checked against INDB home recipes
// (tests/nutrition.test.mjs). See SCIENCE.md, "Food", and docs/NUTRITION.md.
import { INDB } from './foods-indb.js';

// [kcal, protein, carbs, fat, fibre] per 100 g, raw unless noted.
export const ING = {
  atta: ['Whole wheat flour (atta)', 340, 13.2, 72, 2.5, 10.7],
  maida: ['White flour (maida)', 364, 10.3, 76.3, 1.0, 2.7],
  suji: ['Semolina (suji)', 360, 12.7, 72.8, 1.1, 3.9],
  makki: ['Maize flour (makki atta)', 362, 8.1, 76.9, 3.6, 7.3],
  rice: ['Rice, white/basmati, raw', 365, 7.1, 80, 0.7, 1.3],
  besan: ['Gram flour (besan)', 387, 22.4, 57.8, 6.7, 10.8],
  dalia: ['Broken wheat (dalia)', 342, 12.3, 75.9, 1.3, 12.5],
  vermicelli: ['Vermicelli (seviyan)', 360, 11, 75, 1.5, 3],
  masoor: ['Red lentils (masoor), dry', 352, 24.6, 63.4, 1.1, 10.7],
  moong: ['Mung lentils (moong), dry', 347, 23.9, 62.6, 1.2, 16.3],
  chanaDal: ['Split chickpeas (chana dal), dry', 360, 21, 60, 5.3, 11],
  mash: ['Black gram (mash/urad), dry', 341, 25.2, 59, 1.6, 18.3],
  kabuli: ['Chickpeas (kabuli chana), dry', 378, 20.5, 63, 6, 12.2],
  rajma: ['Kidney beans (rajma), dry', 333, 23.6, 60, 0.8, 15.2],
  chicken: ['Chicken, meat only, raw', 119, 21.4, 0, 3.1, 0],
  chickenBreast: ['Chicken breast, raw', 120, 22.5, 0, 2.6, 0],
  mutton: ['Mutton (goat), raw', 109, 20.6, 0, 2.3, 0],
  beef: ['Beef shank/chuck, lean and fat, raw', 170, 20, 0, 9.5, 0],
  beefMince: ['Beef mince (qeema), 15% fat, raw', 215, 18.6, 0, 15, 0],
  chickenMince: ['Chicken mince, raw', 143, 17.4, 0, 8.1, 0],
  fish: ['Fish, white (rohu, sole), raw', 100, 18, 0, 2.5, 0],
  egg: ['Egg, whole', 143, 12.6, 0.7, 9.5, 0],
  paneer: ['Paneer', 265, 18.3, 1.2, 20.8, 0], // typical label and IFCT value; USDA has no plain paneer
  dahi: ['Yogurt (dahi), whole milk', 61, 3.5, 4.7, 3.3, 0],
  milk: ['Milk, whole', 61, 3.2, 4.8, 3.3, 0],
  cream: ['Cream (malai)', 340, 2.8, 2.9, 36, 0],
  khoya: ['Khoya', 421, 14.6, 20.5, 31.2, 0], // IFCT value
  onion: ['Onion', 40, 1.1, 9.3, 0.1, 1.7],
  tomato: ['Tomato', 18, 0.9, 3.9, 0.2, 1.2],
  potato: ['Potato', 77, 2, 17.5, 0.1, 2.2],
  spinach: ['Spinach (palak)', 23, 2.9, 3.6, 0.4, 2.2],
  sarson: ['Mustard greens (sarson)', 27, 2.9, 4.7, 0.4, 3.2],
  peas: ['Peas (matar)', 81, 5.4, 14.5, 0.4, 5.1],
  okra: ['Okra (bhindi)', 33, 1.9, 7.5, 0.2, 3.2],
  cauliflower: ['Cauliflower (gobhi)', 25, 1.9, 5, 0.3, 2],
  carrot: ['Carrot (gajar)', 41, 0.9, 9.6, 0.2, 2.8],
  capsicum: ['Capsicum (shimla mirch)', 20, 0.9, 4.6, 0.2, 1.7],
  cucumber: ['Cucumber (kheera)', 15, 0.7, 3.6, 0.1, 0.5],
  mixedVeg: ['Mixed vegetables', 35, 1.5, 7, 0.2, 2.5],
  spices: ['Ginger, garlic, chilli and masala', 150, 5, 25, 4, 8],
  sugar: ['Sugar', 387, 0, 100, 0, 0],
  nuts: ['Almonds and pistachios', 579, 21, 21.6, 49.9, 12.5],
  oil: ['Cooking oil', 884, 0, 0, 100, 0],
  ghee: ['Ghee', 876, 0.3, 0, 99.5, 0],
  butter: ['Butter (makhan)', 717, 0.9, 0.1, 81, 0],
  banana: ['Banana', 89, 1.1, 22.8, 0.3, 2.6],
  apple: ['Apple', 52, 0.3, 13.8, 0.2, 2.4],
  mango: ['Mango', 60, 0.8, 15, 0.4, 1.6],
  dates: ['Dates (khajoor)', 282, 2.5, 75, 0.4, 8],
  bread: ['White bread', 266, 8.9, 49, 3.3, 2.7],
  oats: ['Oats, dry', 379, 13.2, 67.7, 6.5, 10.1],
  whey: ['Whey protein powder', 400, 80, 8, 6, 0],
};
const FATS = { oil: 'Oil', ghee: 'Ghee', butter: 'Butter' };

// Who cooked it decides the fat. Labels change for fried foods, where it's oil soaked up, not added.
export const STYLES = [
  { id: 'home', label: 'Home', sub: 'cooked at home' },
  { id: 'restaurant', label: 'Restaurant', sub: 'or takeaway' },
  { id: 'shaadi', label: 'Shaadi / dhaba', sub: 'or street stall' },
];
export const MEAT_SHARE = [{ id: 'less', label: 'Mostly gravy', f: 0.6 }, { id: 'normal', label: 'Even', f: 1 }, { id: 'more', label: 'Mostly meat', f: 1.5 }];
export const OIL_LEVEL = [{ id: 'less', label: 'Less oil', f: 0.7 }, { id: 'normal', label: 'Normal', f: 1 }, { id: 'oily', label: 'Oil on top', f: 1.4 }];
const MEAT_YIELD = 0.7; // meat keeps ~70% of its raw weight when stewed or grilled (USDA yield tables)

// D(id, name, aliases, kind, serving label, cooked g of one serving, meat, base, fat {type, home, restaurant, shaadi}, extra)
// kind: curry | rice | bread | bbq | fried | snack | sweet | drink | egg | side
const D = (id, name, alias, kind, serve, cooked, meat, base, fat, x = {}) => ({ id, name, alias, kind, serve, cooked, meat, base, fat, ...x });
const F = (type, home, restaurant, shaadi) => ({ type, home, restaurant, shaadi });
const NOFAT = F('oil', 0, 0, 0);

export const DISHES = [
  // Curries and salans — serving is one katori (~200 g) unless noted.
  D('chicken_karahi', 'Chicken karahi', 'kadai chicken karahi gosht کڑاہی', 'curry', 'katori', 200, ['chicken', 110], [['tomato', 80], ['spices', 8]], F('oil', 14, 28, 36)),
  D('chicken_handi', 'Chicken handi', 'handi chicken makhni handi', 'curry', 'katori', 200, ['chicken', 100], [['dahi', 40], ['cream', 15], ['onion', 30], ['tomato', 40], ['spices', 6]], F('oil', 12, 24, 30)),
  D('chicken_qorma', 'Chicken qorma', 'korma chicken qorma قورمہ', 'curry', 'katori', 200, ['chicken', 100], [['dahi', 45], ['onion', 40], ['spices', 6]], F('oil', 14, 28, 36)),
  D('chicken_jalfrezi', 'Chicken jalfrezi', 'jalfrezi', 'curry', 'katori', 220, ['chicken', 100], [['capsicum', 40], ['onion', 40], ['tomato', 50], ['spices', 6]], F('oil', 12, 22, 28)),
  D('chicken_salan', 'Chicken salan (shorba)', 'chicken curry shorba wala salan murgh', 'curry', 'katori', 220, ['chicken', 90], [['onion', 30], ['tomato', 40], ['spices', 6]], F('oil', 12, 22, 28)),
  D('butter_chicken', 'Butter chicken', 'murgh makhani chicken tikka masala makhni', 'curry', 'katori', 210, ['chicken', 100], [['tomato', 80], ['cream', 20], ['spices', 6]], F('butter', 10, 20, 26)),
  D('mutton_karahi', 'Mutton karahi', 'gosht karahi goat karahi', 'curry', 'katori', 200, ['mutton', 110], [['tomato', 80], ['spices', 8]], F('oil', 16, 30, 38)),
  D('mutton_qorma', 'Mutton qorma', 'korma gosht qorma mutton korma', 'curry', 'katori', 200, ['mutton', 100], [['dahi', 45], ['onion', 40], ['spices', 6]], F('ghee', 14, 28, 36)),
  D('aloo_gosht', 'Aloo gosht', 'aloo gosht potato meat curry', 'curry', 'katori', 240, ['mutton', 80], [['potato', 70], ['onion', 30], ['tomato', 40], ['spices', 6]], F('oil', 12, 22, 28)),
  D('nihari', 'Beef nihari', 'nihari nalli nehari نہاری', 'curry', 'bowl', 250, ['beef', 110], [['atta', 8], ['onion', 15], ['spices', 8]], F('ghee', 18, 35, 45)),
  D('haleem', 'Haleem', 'daleem haleem beef حلیم', 'curry', 'bowl', 250, ['beef', 60], [['dalia', 25], ['chanaDal', 10], ['masoor', 6], ['moong', 4], ['mash', 4], ['onion', 15], ['spices', 6]], F('ghee', 14, 26, 34)),
  D('qeema', 'Qeema (beef mince)', 'keema kima mince beef qeema', 'curry', 'katori', 170, ['beefMince', 100], [['onion', 30], ['tomato', 40], ['spices', 6]], F('oil', 10, 20, 26)),
  D('qeema_matar', 'Qeema matar', 'keema matar mince peas', 'curry', 'katori', 200, ['beefMince', 80], [['peas', 50], ['onion', 25], ['tomato', 40], ['spices', 6]], F('oil', 10, 20, 26)),
  D('palak_paneer', 'Palak paneer', 'saag paneer spinach paneer', 'curry', 'katori', 200, ['paneer', 50], [['spinach', 150], ['onion', 20], ['tomato', 20], ['cream', 5], ['spices', 5]], F('ghee', 10, 20, 26)),
  D('palak_gosht', 'Palak gosht', 'saag gosht spinach meat', 'curry', 'katori', 220, ['mutton', 80], [['spinach', 130], ['onion', 25], ['tomato', 25], ['spices', 6]], F('oil', 12, 22, 28)),
  D('sarson_saag', 'Sarson ka saag', 'saag sarson mustard greens', 'curry', 'katori', 200, null, [['sarson', 170], ['spinach', 30], ['makki', 8], ['spices', 5]], F('butter', 12, 22, 30)),
  D('cholay', 'Cholay (chana masala)', 'chole chana masala chickpea curry channay', 'curry', 'katori', 200, null, [['kabuli', 50], ['onion', 30], ['tomato', 40], ['spices', 6]], F('oil', 10, 18, 24)),
  D('daal_chana', 'Daal chana', 'chana dal chane ki daal', 'curry', 'katori', 200, null, [['chanaDal', 40], ['onion', 15], ['tomato', 15], ['spices', 3]], F('ghee', 8, 16, 22)),
  D('daal_masoor', 'Daal masoor', 'masoor dal red lentil daal', 'curry', 'katori', 200, null, [['masoor', 40], ['onion', 15], ['tomato', 15], ['spices', 3]], F('ghee', 8, 16, 22)),
  D('daal_moong', 'Daal moong', 'moong dal yellow daal', 'curry', 'katori', 200, null, [['moong', 40], ['onion', 15], ['tomato', 15], ['spices', 3]], F('ghee', 8, 16, 22)),
  D('daal_mash', 'Daal mash', 'mash ki daal urad dal white', 'curry', 'katori', 180, null, [['mash', 40], ['onion', 15], ['spices', 4]], F('ghee', 10, 18, 24)),
  D('daal_makhani', 'Daal makhani', 'dal makhani black dal', 'curry', 'katori', 200, null, [['mash', 30], ['rajma', 8], ['tomato', 30], ['cream', 15], ['spices', 4]], F('butter', 10, 20, 26)),
  D('rajma', 'Rajma', 'kidney bean curry lobia', 'curry', 'katori', 200, null, [['rajma', 45], ['onion', 25], ['tomato', 30], ['spices', 3]], F('oil', 9, 16, 22)),
  D('aloo_gobi', 'Aloo gobi', 'aloo gobhi potato cauliflower', 'curry', 'katori', 150, null, [['potato', 70], ['cauliflower', 70], ['onion', 15], ['tomato', 15], ['spices', 3]], F('oil', 10, 18, 24)),
  D('aloo_matar', 'Aloo matar', 'aloo mattar potato peas', 'curry', 'katori', 190, null, [['potato', 80], ['peas', 50], ['onion', 15], ['tomato', 30], ['spices', 3]], F('oil', 9, 16, 22)),
  D('bhindi', 'Bhindi', 'bhindi masala okra', 'curry', 'katori', 150, null, [['okra', 150], ['onion', 30], ['tomato', 20], ['spices', 3]], F('oil', 12, 20, 26)),
  D('mix_sabzi', 'Mix sabzi', 'mixed vegetable sabzi tarkari', 'curry', 'katori', 160, null, [['mixedVeg', 120], ['potato', 30], ['onion', 15], ['tomato', 20], ['spices', 3]], F('oil', 9, 16, 22)),
  D('anda_curry', 'Anda curry (2 eggs)', 'egg curry anday ka salan', 'curry', 'katori', 200, ['egg', 100], [['onion', 30], ['tomato', 50], ['spices', 5]], F('oil', 10, 18, 24)),
  D('fish_curry', 'Fish curry', 'machli salan fish salan', 'curry', 'katori', 200, ['fish', 120], [['tomato', 50], ['onion', 25], ['spices', 6]], F('oil', 12, 22, 28)),

  // Rice — serving is one plate (~300 g) unless noted.
  D('chicken_biryani', 'Chicken biryani', 'biryani biriyani chicken بریانی', 'rice', 'plate', 300, ['chicken', 90], [['rice', 75], ['dahi', 30], ['onion', 30], ['tomato', 20], ['spices', 5]], F('oil', 12, 20, 28)),
  D('mutton_biryani', 'Mutton biryani', 'biryani gosht mutton', 'rice', 'plate', 300, ['mutton', 85], [['rice', 75], ['dahi', 30], ['onion', 30], ['tomato', 20], ['spices', 5]], F('ghee', 12, 20, 28)),
  D('beef_pulao', 'Beef yakhni pulao', 'pulao yakhni beef pulao', 'rice', 'plate', 300, ['beef', 70], [['rice', 80], ['onion', 25], ['dahi', 15], ['spices', 4]], F('oil', 12, 20, 28)),
  D('chicken_pulao', 'Chicken pulao', 'yakhni pulao chicken', 'rice', 'plate', 300, ['chicken', 80], [['rice', 80], ['onion', 25], ['dahi', 15], ['spices', 4]], F('oil', 12, 20, 28)),
  D('matar_pulao', 'Matar pulao', 'peas pulao', 'rice', 'plate', 250, null, [['rice', 70], ['peas', 40], ['onion', 15], ['spices', 2]], F('oil', 8, 14, 18)),
  D('zeera_rice', 'Zeera rice', 'jeera rice cumin rice', 'rice', 'cup', 180, null, [['rice', 60], ['spices', 1]], F('ghee', 5, 10, 12)),
  D('plain_rice', 'Plain boiled rice', 'chawal white rice basmati', 'rice', 'cup', 160, null, [['rice', 55]], NOFAT),
  D('khichdi', 'Khichdi', 'khichri daal chawal', 'rice', 'katori', 250, null, [['rice', 40], ['moong', 25], ['spices', 2]], F('ghee', 6, 10, 14)),

  // Breads — one piece.
  D('roti', 'Roti / chapati', 'chapati phulka roti chapatti روٹی', 'bread', 'roti', 44, null, [['atta', 30]], NOFAT, { topping: ['ghee', 5, 'Ghee or butter on top'], sizes: true }),
  D('tandoori_roti', 'Tandoori roti', 'tandoor roti naan roti', 'bread', 'roti', 80, null, [['atta', 55]], NOFAT, { topping: ['butter', 6, 'Butter on top'] }),
  D('naan', 'Naan', 'plain naan butter naan roghni', 'bread', 'naan', 100, null, [['maida', 80], ['dahi', 8], ['milk', 10], ['sugar', 2]], F('oil', 4, 5, 6), { topping: ['butter', 8, 'Butter naan'] }),
  D('paratha', 'Plain paratha', 'paratha parantha lachha paratha پراٹھا', 'bread', 'paratha', 70, null, [['atta', 45]], F('ghee', 8, 15, 20), { sizes: true }),
  D('aloo_paratha', 'Aloo paratha', 'aloo parantha potato paratha', 'bread', 'paratha', 125, null, [['atta', 45], ['potato', 60], ['onion', 5], ['spices', 2]], F('ghee', 10, 18, 24)),
  D('anda_paratha', 'Anda paratha', 'egg paratha', 'bread', 'paratha', 115, ['egg', 50], [['atta', 45]], F('ghee', 12, 20, 24)),
  D('puri', 'Puri', 'poori halwa puri', 'fried', 'puri', 28, null, [['atta', 20]], F('oil', 5, 7, 8)),
  D('makki_roti', 'Makki ki roti', 'makai roti corn roti', 'bread', 'roti', 65, null, [['makki', 45]], NOFAT, { topping: ['butter', 8, 'Makhan on top'] }),

  // BBQ and kebabs.
  D('chicken_tikka', 'Chicken tikka / tandoori (leg piece)', 'tikka tandoori chicken leg piece bbq', 'bbq', 'piece', 120, ['chicken', 160], [['dahi', 15], ['spices', 4]], F('oil', 3, 6, 8)),
  D('chicken_boti', 'Chicken boti (one seekh)', 'boti tikka boti malai boti', 'bbq', 'seekh', 100, ['chicken', 130], [['dahi', 10], ['spices', 3]], F('oil', 4, 7, 9)),
  D('seekh_kebab', 'Seekh kebab', 'seekh kabab beef kebab', 'bbq', 'kebab', 45, ['beefMince', 60], [['onion', 5], ['spices', 2]], F('oil', 1, 3, 4)),
  D('chapli_kebab', 'Chapli kebab', 'chapli kabab peshawari', 'fried', 'kebab', 120, ['beefMince', 110], [['tomato', 15], ['onion', 15], ['egg', 10], ['makki', 5], ['spices', 4]], F('ghee', 8, 15, 18)),
  D('shami_kebab', 'Shami kebab', 'shami kabab', 'fried', 'kebab', 45, ['beef', 25], [['chanaDal', 12], ['egg', 5], ['spices', 2]], F('oil', 4, 6, 7)),
  D('fried_fish', 'Fried fish (Lahori)', 'lahori fish fry machli', 'fried', 'portion', 130, ['fish', 120], [['besan', 15], ['spices', 3]], F('oil', 10, 16, 18)),

  // Snacks.
  D('samosa', 'Samosa (aloo)', 'aloo samosa potato samosa سموسہ', 'fried', 'samosa', 75, null, [['maida', 25], ['potato', 40], ['peas', 5], ['spices', 2]], F('oil', 9, 12, 13)),
  D('keema_samosa', 'Samosa (qeema)', 'keema samosa meat samosa', 'fried', 'samosa', 70, ['beefMince', 30], [['maida', 25], ['onion', 8], ['spices', 2]], F('oil', 9, 12, 13)),
  D('pakora', 'Pakoray', 'pakora pakoda bhajia fritters', 'fried', 'plate', 100, null, [['besan', 30], ['onion', 30], ['potato', 20], ['spinach', 10], ['spices', 2]], F('oil', 14, 18, 20)),
  D('dahi_bhalla', 'Dahi bhalla', 'dahi baray dahi vada', 'fried', 'plate', 220, null, [['mash', 30], ['dahi', 120], ['sugar', 6], ['spices', 2]], F('oil', 8, 10, 12)),
  D('chana_chaat', 'Chana chaat', 'chaat chickpea chaat', 'snack', 'plate', 180, null, [['kabuli', 40], ['potato', 30], ['onion', 15], ['tomato', 20], ['sugar', 3], ['spices', 3]], NOFAT),
  D('suji_halwa', 'Suji halwa', 'halwa sooji halwa', 'sweet', 'katori', 110, null, [['suji', 35], ['sugar', 30]], F('ghee', 20, 25, 30)),

  // Sweets.
  D('kheer', 'Kheer', 'rice kheer chawal ki kheer', 'sweet', 'katori', 150, null, [['milk', 150], ['rice', 12], ['sugar', 15], ['nuts', 3]], NOFAT),
  D('gulab_jamun', 'Gulab jamun', 'gulab jaman', 'fried', 'piece', 40, null, [['khoya', 12], ['maida', 4], ['sugar', 20]], F('ghee', 4, 5, 5)),
  D('gajar_halwa', 'Gajar ka halwa', 'gajrela carrot halwa', 'sweet', 'katori', 150, null, [['carrot', 140], ['milk', 100], ['sugar', 20], ['khoya', 10], ['nuts', 3]], F('ghee', 10, 15, 20)),
  D('jalebi', 'Jalebi', 'jalaibi', 'fried', 'plate', 100, null, [['maida', 30], ['sugar', 45]], F('ghee', 12, 14, 15)),
  D('sheer_khurma', 'Sheer khurma', 'sheer korma seviyan', 'sweet', 'katori', 200, null, [['milk', 180], ['vermicelli', 12], ['sugar', 15], ['nuts', 8], ['dates', 6]], F('ghee', 4, 6, 8)),

  // Drinks.
  D('chai', 'Chai (doodh patti)', 'tea doodh patti chai milk tea چائے', 'drink', 'cup', 150, null, [['milk', 100], ['sugar', 10]], NOFAT),
  D('sweet_lassi', 'Lassi (sweet)', 'meethi lassi', 'drink', 'glass', 300, null, [['dahi', 200], ['milk', 50], ['sugar', 25]], NOFAT),
  D('salted_lassi', 'Lassi (salted)', 'namkeen lassi chaas', 'drink', 'glass', 300, null, [['dahi', 200]], NOFAT),

  // Eggs and sides.
  D('anda_fry', 'Fried egg (anda fry)', 'fried egg anda', 'egg', 'egg', 46, ['egg', 50], [], F('oil', 4, 6, 8)),
  D('omelette', 'Omelette (2 eggs)', 'omelet anday ka khagina', 'egg', 'omelette', 125, ['egg', 100], [['onion', 15], ['tomato', 15], ['spices', 2]], F('oil', 6, 10, 12)),
  D('boiled_egg', 'Boiled egg', 'ublay anday egg', 'egg', 'egg', 50, ['egg', 50], [], NOFAT),
  D('raita', 'Raita', 'raita yogurt', 'side', 'katori', 100, null, [['dahi', 90], ['cucumber', 15]], NOFAT),
  D('dahi', 'Dahi (plain yogurt)', 'yogurt curd', 'side', 'katori', 150, null, [['dahi', 150]], NOFAT),
  D('salad', 'Salad (kachumber)', 'salad kachumber', 'side', 'plate', 100, null, [['tomato', 40], ['onion', 30], ['cucumber', 30]], NOFAT),
];
export const DISH = Object.fromEntries(DISHES.map(d => [d.id, d]));

// "1½ katori (≈300 g)", "2 rotis". Containers show grams so people can check against a scale.
export function serveLabel(d, n = 1) {
  const u = d.serve, many = n > 1 && !u === 'katori';
  const word = many ? (u.endsWith('s') ? u : u + 's') : u;
  const grams = ['katori', 'bowl', 'plate', 'cup', 'glass', 'portion'].includes(u) ? ` (≈${Math.round(d.cooked * n)} g)` : '';
  return `${fmtN(n)} ${word}${grams}`;
}
export const fmtN = n => { const w = Math.floor(n), h = n - w >= 0.5; return w === 0 && h ? '½' : `${w}${h ? '½' : ''}`; };

// Size multipliers for breads people make in many sizes.
export const SIZES = [{ id: 's', label: 'Small', f: 0.7 }, { id: 'm', label: 'Medium', f: 1 }, { id: 'l', label: 'Large', f: 1.5 }];

const sum = (a, b) => a.map((v, i) => v + b[i]);
const nut = (ing, g) => { const r = ING[ing]; if (!r) throw new Error('unknown ingredient ' + ing); return [r[1], r[2], r[3], r[4], r[5]].map(v => v * g / 100); };
const pack = v => ({ kcal: v[0], protein: v[1], carbs: v[2], fat: v[3], fibre: v[4] });

export const hasFatChoice = d => d.fat.home + d.fat.restaurant + d.fat.shaadi > 0;
export const hasMeatChoice = d => !!d.meat && ['curry', 'rice'].includes(d.kind) && d.meat[0] !== 'egg';
export const hasOilChoice = d => hasFatChoice(d) && !['fried', 'bbq', 'egg'].includes(d.kind);

// One dish → nutrition. opts: servings, grams (overrides servings), style, meat, oil, size, topping,
// styleKnown (the user picked who cooked it — narrows the range), portionSd (photo portions are vaguer).
export function estimateDish(d, opts = {}) {
  const style = opts.style || 'home';
  const size = SIZES.find(s => s.id === opts.size)?.f ?? 1;
  const servings = opts.grams ? opts.grams / d.cooked : (opts.servings ?? 1) * (d.sizes ? size : 1);
  const meatF = hasMeatChoice(d) ? MEAT_SHARE.find(m => m.id === opts.meat)?.f ?? 1 : 1;
  const oilF = hasOilChoice(d) ? OIL_LEVEL.find(m => m.id === opts.oil)?.f ?? 1 : 1;

  // Taking more meat pieces leaves less room for gravy in the same katori, and the oil sits in the gravy.
  let gravyF = 1;
  if (d.meat && meatF !== 1) {
    const meatCooked = d.meat[1] * MEAT_YIELD;
    gravyF = Math.max(0.2, (d.cooked - meatCooked * meatF) / (d.cooked - meatCooked));
  }
  const fatG = d.fat[style] * oilF * (d.kind === 'curry' ? 0.3 + 0.7 * gravyF : gravyF);

  let meat = [0, 0, 0, 0, 0], base = [0, 0, 0, 0, 0];
  if (d.meat) meat = nut(d.meat[0], d.meat[1] * meatF);
  for (const [ing, g] of d.base) base = sum(base, nut(ing, g * gravyF));
  let fat = nut(d.fat.type, fatG);
  if (opts.topping && d.topping) fat = sum(fat, nut(d.topping[0], d.topping[1]));

  const one = sum(sum(meat, base), fat);
  const total = one.map(v => v * servings);
  const kcal = total[0], fatKcal = fat[0] * servings, meatKcal = meat[0] * servings;

  // Likely range (about ±1 SD): portion error on everything, plus fat error, plus meat-share error.
  const portionSd = opts.portionSd ?? (['curry', 'rice', 'side', 'snack'].includes(d.kind) || ['plate', 'portion'].includes(d.serve) ? 0.2 : 0.1);
  const fatSd = hasFatChoice(d) ? (opts.styleKnown ? 0.25 : 0.4) : 0;
  const sd = Math.sqrt((portionSd * kcal) ** 2 + (fatSd * fatKcal) ** 2 + (0.15 * meatKcal) ** 2);
  return {
    ...pack(total), grams: d.cooked * servings,
    low: round10(Math.max(0, kcal - sd)), high: round10(kcal + sd),
    parts: { fat: fatKcal, meat: meatKcal, rest: kcal - fatKcal - meatKcal },
    fatLabel: (opts.topping && d.topping ? FATS[d.topping[0]] : FATS[d.fat.type]) || 'Fat',
    fatGrams: (fatG + (opts.topping && d.topping ? d.topping[1] : 0)) * servings,
  };
}
const round10 = v => Math.round(v / 10) * 10;

// INDB recipe → nutrition (values are per 100 g; serving grams from INDB's own serving size).
export function estimateIndb(row, opts = {}) {
  const [, , kcal, p, c, f, fib, , sg, fried] = row;
  const grams = opts.grams ?? (opts.servings ?? 1) * (sg || 100);
  const m = grams / 100, k = kcal * m;
  return { kcal: k, protein: p * m, carbs: c * m, fat: f * m, fibre: fib * m, grams, low: round10(k * 0.8), high: round10(k * 1.2),
    parts: { fat: f * m * 9, meat: 0, rest: k - f * m * 9 }, fried: !!fried };
}
export function estimateIng(id, grams = 100) {
  const v = nut(id, grams);
  return { ...pack(v), grams, low: round10(v[0] * 0.95), high: round10(v[0] * 1.05), parts: { fat: v[3] * 9, meat: 0, rest: v[0] - v[3] * 9 } };
}

// A food reference stored in the log: { t: 'dish'|'indb'|'ing', id }.
const INDB_BY = Object.fromEntries(INDB.map(r => [r[0], r]));
export function lookup(ref) {
  if (ref.t === 'dish') return DISH[ref.id] && { ref, name: DISH[ref.id].name, food: DISH[ref.id] };
  if (ref.t === 'indb') return INDB_BY[ref.id] && { ref, name: INDB_BY[ref.id][1], food: INDB_BY[ref.id] };
  if (ref.t === 'ing') return ING[ref.id] && { ref, name: ING[ref.id][0], food: ING[ref.id] };
  return null;
}
export function estimate(ref, opts = {}) {
  if (ref.t === 'dish') return estimateDish(DISH[ref.id], opts);
  if (ref.t === 'indb') return estimateIndb(INDB_BY[ref.id], opts);
  return estimateIng(ref.id, opts.grams ?? 100);
}

// Search: desi dish models first (they handle oil and portions), then INDB recipes, then ingredients.
const norm = s => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const INDEX = [
  ...DISHES.map(d => ({ ref: { t: 'dish', id: d.id }, name: d.name, hay: norm(d.name + ' ' + d.alias), rank: 0 })),
  ...INDB.map(r => ({ ref: { t: 'indb', id: r[0] }, name: r[1], hay: norm(r[1]), rank: 1, fried: !!r[9] })),
  ...Object.entries(ING).map(([id, r]) => ({ ref: { t: 'ing', id }, name: r[0], hay: norm(r[0] + ' ' + id), rank: 2 })),
];
export function search(q, limit = 30) {
  const words = norm(q).split(' ').filter(Boolean);
  if (!words.length) return [];
  const out = [];
  for (const e of INDEX) {
    let score = 0;
    for (const w of words) {
      const i = e.hay.indexOf(w);
      if (i < 0) { score = -1; break; }
      score += (i === 0 ? 3 : e.hay[i - 1] === ' ' ? 2 : 1);
    }
    if (score > 0) out.push({ ...e, score: score - e.rank * 2.5 - e.hay.length / 200 });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

/* ---------- Targets ---------- */
// Mifflin-St Jeor resting energy (best of the common equations for non-obese adults; Frankenfield 2005),
// times an activity factor, then a goal change. Protein 1.6–2.2 g/kg supports muscle while training
// (Morton 2018; ISSN 2017); the higher end when cutting.
// The food goal is its own setting. Until it's set, it follows the training goal chosen at sign-up.
const GAIN_GOALS = ['muscle', 'powerbuild', 'strength', 'glutes'];
export function dietGoal(p) {
  if (['lose', 'maintain', 'gain'].includes(p.dietGoal)) return p.dietGoal;
  return p.goal === 'lose' ? 'lose' : GAIN_GOALS.includes(p.goal) ? 'gain' : 'maintain';
}
export function targets(p) {
  const w = +p.weightKg, h = +p.heightCm, a = +p.age;
  if (!(w > 30 && h > 120 && a >= 14)) return null;
  const bmr = 10 * w + 6.25 * h - 5 * a + (p.sex === 'female' ? -161 : 5);
  const act = { low: 1.375, mid: 1.55, high: 1.725 }[p.activity] || 1.55;
  const dg = dietGoal(p), goal = { lose: -0.2, maintain: 0, gain: 0.1 }[dg];
  const kcal = Math.round(bmr * act * (1 + goal) / 10) * 10;
  const protein = Math.round(w * (dg === 'lose' ? 2.0 : 1.8));
  const fat = Math.round(kcal * 0.27 / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, fat, carbs, bmr: Math.round(bmr) };
}

const dayKey = t => { const x = new Date(t); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
export function dayTotals(log, t = Date.now()) {
  const k = dayKey(t), items = (log || []).filter(e => dayKey(e.at) === k);
  const tot = items.reduce((s, e) => ({ kcal: s.kcal + e.kcal, protein: s.protein + e.protein, carbs: s.carbs + e.carbs, fat: s.fat + e.fat, v: s.v + ((e.high - e.low) / 2) ** 2 }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0, v: 0 });
  // Errors on separate dishes are independent, so they partly cancel: combine as √(Σ sd²), not by adding ranges.
  const sd = Math.sqrt(tot.v);
  return { items, kcal: tot.kcal, protein: tot.protein, carbs: tot.carbs, fat: tot.fat, low: round10(Math.max(0, tot.kcal - sd)), high: round10(tot.kcal + sd) };
}
export function mealOf(t = Date.now()) {
  const h = new Date(t).getHours();
  return h < 11 ? 'Breakfast' : h < 16 ? 'Lunch' : h < 19 ? 'Snack' : 'Dinner';
}
