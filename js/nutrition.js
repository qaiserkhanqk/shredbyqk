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
  chickenSkin: ['Chicken with skin (thigh/leg), raw', 221, 17.3, 0, 16.6, 0],
  bun: ['Burger bun', 279, 9.5, 50, 4.3, 2.4],
  mayo: ['Mayonnaise / garlic sauce', 680, 1, 0.6, 75, 0],
  cheese: ['Cheese slice (cheddar/processed)', 380, 21, 4, 31, 0],
  mozzarella: ['Mozzarella', 300, 22, 2.2, 22, 0],
  ketchup: ['Ketchup and chutney', 101, 1, 27, 0.1, 0.3],
  cabbage: ['Cabbage and lettuce', 25, 1.3, 5.8, 0.1, 2.5],
  sesame: ['Sesame and nigella seeds', 573, 17.7, 23.4, 49.7, 11.8],
  pasta: ['Pasta / noodles, dry', 371, 13, 75, 1.5, 3.2],
  iceCream: ['Ice cream', 207, 3.5, 24, 11, 0.7],
  orange: ['Orange (malta / kinnow)', 47, 0.9, 11.8, 0.1, 2.4],
  guava: ['Guava (amrood)', 68, 2.6, 14.3, 1, 5.4],
  // Gulf and Levantine kitchens (USDA SR Legacy unless noted)
  tahini: ['Tahini (sesame paste)', 595, 17, 21.2, 53.8, 9.3],
  favaCooked: ['Fava beans (foul), cooked', 110, 7.6, 19.7, 0.4, 5.4],
  eggplant: ['Eggplant (baingan)', 25, 1, 5.9, 0.2, 3],
  parsley: ['Parsley, mint and herbs', 36, 3, 6.3, 0.8, 3.3],
  pita: ['Arabic bread (khubz / pita)', 275, 9.1, 55.7, 1.2, 2.2],
  lamb: ['Lamb, raw (lean and fat)', 230, 18, 0, 17, 0],
  evapMilk: ['Evaporated milk', 134, 6.8, 10, 7.6, 0],
  dateSyrup: ['Date syrup (dibs)', 290, 1.5, 72, 0.2, 1], // label values of common UAE brands
  crisps: ['Potato crisps (Chips Oman)', 536, 7, 53, 35, 4.4],
  condensedMilk: ['Sweetened condensed milk', 321, 7.9, 54.4, 8.7, 0],
  garlic: ['Garlic', 149, 6.4, 33, 0.5, 2.1],
  coconut: ['Coconut, fresh', 354, 3.3, 15.2, 33.5, 9],
  // For diet plans (USDA SR Legacy): foods weighed as eaten.
  eggWhite: ['Egg white', 52, 10.9, 0.7, 0.2, 0],
  riceCooked: ['Rice, white/basmati, cooked', 130, 2.7, 28.2, 0.3, 0.4],
  brownBread: ['Brown (whole-wheat) bread', 252, 12.4, 42.7, 3.5, 6],
  cornflakes: ['Cornflakes', 357, 7.5, 84.1, 0.4, 3.3],
  milkLow: ['Milk, low fat (1%)', 42, 3.4, 5, 1, 0],
  greekYogurt: ['Greek yogurt, low fat', 73, 10, 3.9, 1.9, 0],
  peanutButter: ['Peanut butter', 588, 25, 20, 50, 6],
  caneJuice: ['Sugarcane juice (ganne ka ras)', 70, 0.2, 17.5, 0, 0.1], // USDA branded cane drink 184 kcal / 248 g; stall juice ~64-75
  // Western café and restaurant food (USDA SR Legacy unless noted).
  beefSteak: ['Beef steak (sirloin / tenderloin), lean and fat, raw', 180, 21, 0, 10.5, 0], // SR top sirloin, 1/8" trim, raw ~180-200
  sausage: ['Sausage (chicken or beef)', 250, 13, 4, 20, 0], // SR smoked beef sausage ~300, chicken sausage ~170-220; local labels ~230
  bakedBeans: ['Baked beans, canned', 94, 4.8, 21, 0.4, 4.1],
  mushroom: ['Mushrooms', 22, 3.1, 3.3, 0.3, 1],
  avocado: ['Avocado', 160, 2, 8.5, 14.7, 6.7],
  creamCheese: ['Cream cheese', 342, 6, 4.1, 34, 0],
  mascarpone: ['Mascarpone', 435, 4.6, 3.5, 44.5, 0], // label values (Galbani, Président); not in SR
  feta: ['Feta cheese', 264, 14.2, 4.1, 21.3, 0],
  olives: ['Olives', 115, 0.8, 6.3, 10.7, 3.2],
  bagel: ['Bagel, plain', 257, 10, 50.5, 1.6, 2.1],
  tortilla: ['Flour tortilla (wrap)', 312, 8.3, 52, 8, 3.5],
  tortillaChips: ['Tortilla chips (nachos)', 497, 7, 66, 23, 5.3],
  granola: ['Granola', 471, 10, 64, 20, 7], // SR and branded granola 450-490
  honey: ['Honey', 304, 0.3, 82.4, 0, 0.2],
  syrup: ['Maple / pancake syrup', 260, 0, 67, 0.1, 0],
  chocolate: ['Chocolate (semi-sweet, chips)', 479, 4.2, 63.9, 30, 5.9],
  chocSauce: ['Chocolate syrup / sauce', 279, 2.1, 65, 1.1, 2.6],
  salmon: ['Salmon, raw', 208, 20.4, 0, 13.4, 0],
  soySauce: ['Soy / teriyaki / fish sauce', 53, 8.1, 4.9, 0.6, 0.8],
  coconutMilk: ['Coconut milk, canned', 197, 2, 2.8, 21.3, 0],
  riceNoodles: ['Rice noodles, dry', 364, 6, 80, 0.6, 1.6],
  peanuts: ['Peanuts', 567, 25.8, 16.1, 49.2, 8.5],
  berries: ['Berries (strawberry, blueberry)', 40, 0.7, 10, 0.3, 2.2], // SR strawberries 32, blueberries 57
  espresso: ['Espresso / brewed coffee', 9, 0.1, 1.7, 0.2, 0],
  hazelnutSpread: ['Chocolate hazelnut spread (Nutella)', 539, 6.3, 57.5, 30.9, 3.4], // Nutella label
  tapioca: ['Tapioca pearls, dry', 358, 0.2, 88.7, 0, 0.9],
  miso: ['Miso paste', 198, 12.8, 26.5, 6, 5.4],
  tofu: ['Tofu', 76, 8.1, 1.9, 4.8, 0.3],
  squid: ['Squid (calamari), raw', 92, 15.6, 3.1, 1.4, 0],
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
// Families: dishes people name loosely ("roti" can be a naan). The sheet shows the family as one-tap chips.
const FAM = (fam, list) => list.forEach(d => { if (!d) throw new Error('family ' + fam + ': unknown dish'); if (d.fam) throw new Error(d.id + ' is already in ' + d.fam); d.fam = fam; });

export const DISHES = [
  // Curries and salans — one katori. Meat curries 240 g (LFAC 2024 cup of karahi = 240 g;
  // FNDDS curry cup 240 g), daals 200 g (LFAC 185 g); nihari and haleem a 250 g bowl. Home fat sits between the Pakistani lab values (KHAN 2019,
  // 12-20% fat) and the leaner UK/US recipes (CoFID, FNDDS).
  D('chicken_karahi', 'Chicken karahi', 'kadai chicken karahi gosht کڑاہی', 'curry', 'katori', 240, ['chicken', 125], [['tomato', 95], ['spices', 10]], F('oil', 30, 45, 54)), // KHAN 2019 lab 240 vs CoFID/FNDDS 106-145 kcal/100 g: home at the midpoint
  D('chicken_handi', 'Chicken handi', 'handi chicken makhni handi', 'curry', 'katori', 240, ['chicken', 120], [['dahi', 48], ['cream', 18], ['onion', 36], ['tomato', 48], ['spices', 7]], F('oil', 18, 30, 38)),
  D('chicken_qorma', 'Chicken qorma', 'korma chicken qorma قورمہ', 'curry', 'katori', 240, ['chicken', 120], [['dahi', 55], ['onion', 50], ['spices', 7]], F('oil', 21, 35, 44)), // KHAN 194 vs CoFID 127 kcal/100 g: home ~165
  D('chicken_jalfrezi', 'Chicken jalfrezi', 'jalfrezi', 'curry', 'katori', 240, ['chicken', 110], [['capsicum', 44], ['onion', 44], ['tomato', 55], ['spices', 7]], F('oil', 20, 30, 36)),
  D('chicken_salan', 'Chicken salan (shorba)', 'chicken curry shorba wala salan murgh', 'curry', 'katori', 240, ['chicken', 100], [['onion', 33], ['tomato', 44], ['spices', 7]], F('oil', 18, 28, 34)),
  D('butter_chicken', 'Butter chicken', 'murgh makhani chicken tikka masala makhni', 'curry', 'katori', 240, ['chicken', 115], [['tomato', 90], ['cream', 23], ['spices', 7]], F('butter', 16, 26, 32)),
  D('mutton_karahi', 'Mutton karahi', 'gosht karahi goat karahi', 'curry', 'katori', 240, ['mutton', 130], [['tomato', 95], ['spices', 10]], F('oil', 32, 47, 56)), // KHAN 2019: 242 kcal/100 g; home at the midpoint
  D('mutton_qorma', 'Mutton qorma', 'korma gosht qorma mutton korma', 'curry', 'katori', 240, ['mutton', 120], [['dahi', 55], ['onion', 50], ['spices', 7]], F('ghee', 24, 37, 46)), // KHAN 2019 korma 194 kcal/100 g
  D('aloo_gosht', 'Aloo gosht', 'aloo gosht potato meat curry', 'curry', 'katori', 240, ['mutton', 95], [['potato', 70], ['onion', 30], ['tomato', 40], ['spices', 6]], F('oil', 25, 35, 42)), // KHAN 2019 potato-meat 199 kcal/100 g
  D('nihari', 'Beef nihari', 'nihari nalli nehari نہاری', 'curry', 'bowl', 250, ['beef', 110], [['atta', 8], ['onion', 15], ['spices', 8]], F('ghee', 18, 35, 45)), // LFAC 2024: 1 cup = 240 g; KHAN 172 kcal/100 g
  D('haleem', 'Haleem', 'daleem haleem beef حلیم', 'curry', 'bowl', 250, ['beef', 60], [['dalia', 20], ['chanaDal', 8], ['masoor', 5], ['moong', 3], ['mash', 3], ['onion', 15], ['spices', 5]], F('ghee', 10, 29, 36)), // KHAN 2019: 128 kcal/100 g at home; restaurant tarka on top
  D('qeema', 'Qeema (beef mince)', 'keema kima mince beef qeema aloo qeema', 'curry', 'katori', 170, ['beefMince', 100], [['onion', 30], ['tomato', 40], ['spices', 6]], F('oil', 10, 20, 26)),
  D('qeema_matar', 'Qeema matar', 'keema matar mince peas', 'curry', 'katori', 200, ['beefMince', 80], [['peas', 50], ['onion', 25], ['tomato', 40], ['spices', 6]], F('oil', 10, 20, 26)),
  D('palak_paneer', 'Palak paneer', 'saag paneer spinach paneer', 'curry', 'katori', 200, ['paneer', 50], [['spinach', 150], ['onion', 20], ['tomato', 20], ['cream', 5], ['spices', 5]], F('ghee', 10, 20, 26)),
  D('bhindi_gosht', 'Bhindi gosht', 'bhindi gosht okra meat', 'curry', 'katori', 220, ['mutton', 70], [['okra', 100], ['onion', 25], ['tomato', 30], ['spices', 5]], F('oil', 12, 22, 28)),
  D('paye', 'Paye (trotters)', 'paye paya siri paye trotters', 'curry', 'bowl', 250, ['beef', 80], [['atta', 5], ['onion', 20], ['spices', 6]], F('ghee', 15, 25, 32)),
  D('kadhi_pakora', 'Kadhi pakora', 'kadhi karhi pakora', 'curry', 'katori', 200, null, [['dahi', 100], ['besan', 35], ['onion', 15], ['spices', 3]], F('oil', 12, 18, 22)),
  D('hareesa', 'Hareesa', 'hareesa harissa', 'curry', 'bowl', 250, ['mutton', 60], [['dalia', 40], ['milk', 30], ['spices', 3]], F('ghee', 18, 25, 32)),
  D('gushtaba', 'Gushtaba / rogan josh (Kashmiri)', 'gushtaba rogan josh aab gosht kashmiri', 'curry', 'katori', 220, ['mutton', 110], [['dahi', 80], ['spices', 5]], F('ghee', 12, 18, 22)),
  D('dampukht', 'Dampukht (mutton in its own fat)', 'dampukht dum pukht', 'curry', 'portion', 200, ['mutton', 220], [['spices', 3]], F('ghee', 10, 14, 18)),
  D('yakhni', 'Chicken yakhni (broth)', 'yakhni soup broth desi chicken', 'drink', 'cup', 200, ['chicken', 20], [['spices', 2]], NOFAT),
  D('corn_soup', 'Chicken corn soup', 'corn soup chicken corn soup', 'side', 'bowl', 250, ['chicken', 30], [['makki', 10], ['egg', 15], ['sugar', 3]], NOFAT),
  D('palak_gosht', 'Palak gosht', 'spinach meat', 'curry', 'katori', 220, ['mutton', 80], [['spinach', 130], ['onion', 25], ['tomato', 25], ['spices', 6]], F('oil', 12, 22, 28)),
  D('sarson_saag', 'Sarson ka saag', 'saag sarson mustard greens', 'curry', 'katori', 200, null, [['sarson', 170], ['spinach', 30], ['makki', 8], ['spices', 5]], F('butter', 12, 22, 30)),
  D('cholay', 'Cholay (chana masala)', 'chole chana masala chickpea curry channay', 'curry', 'katori', 200, null, [['kabuli', 50], ['onion', 30], ['tomato', 40], ['spices', 6]], F('oil', 10, 18, 24)),
  D('daal_chana', 'Daal chana', 'chana dal chane ki daal', 'curry', 'katori', 200, null, [['chanaDal', 45], ['onion', 15], ['tomato', 15], ['spices', 3]], F('ghee', 19, 26, 32)), // KHAN 229 vs CoFID 152 kcal/100 g: home ~170
  D('daal_masoor', 'Daal masoor', 'masoor dal red lentil daal', 'curry', 'katori', 200, null, [['masoor', 42], ['onion', 15], ['tomato', 15], ['spices', 3]], F('ghee', 13, 22, 28)), // KHAN 183 vs CoFID/FNDDS 93-173 kcal/100 g: home ~140
  D('daal_moong', 'Daal moong', 'moong dal yellow daal', 'curry', 'katori', 200, null, [['moong', 42], ['onion', 15], ['tomato', 15], ['spices', 3]], F('ghee', 13, 22, 28)), // KHAN 183 vs CoFID 74-102 kcal/100 g: home ~135
  D('daal_mash', 'Daal mash', 'mash ki daal urad dal white', 'curry', 'katori', 180, null, [['mash', 45], ['onion', 15], ['spices', 4]], F('ghee', 22, 32, 38)), // KHAN 272 vs CoFID 154 kcal/100 g: home ~200
  D('daal_makhani', 'Daal makhani', 'dal makhani black dal', 'curry', 'katori', 200, null, [['mash', 30], ['rajma', 8], ['tomato', 30], ['cream', 15], ['spices', 4]], F('butter', 10, 20, 26)),
  D('rajma', 'Rajma', 'kidney bean curry lobia', 'curry', 'katori', 200, null, [['rajma', 45], ['onion', 25], ['tomato', 30], ['spices', 3]], F('oil', 9, 16, 22)),
  D('aloo_sabzi', 'Aloo ki sabzi (aloo bhujia)', 'aloo ki sabzi aloo bhujia aloo bhaji potato sabzi aloo fry', 'curry', 'katori', 150, null, [['potato', 130], ['onion', 15], ['tomato', 15], ['spices', 3]], F('oil', 10, 16, 20)),
  D('aloo_gobi', 'Aloo gobi', 'aloo gobhi potato cauliflower', 'curry', 'katori', 150, null, [['potato', 70], ['cauliflower', 70], ['onion', 15], ['tomato', 15], ['spices', 3]], F('oil', 10, 18, 24)),
  D('aloo_matar', 'Aloo matar', 'aloo mattar potato peas', 'curry', 'katori', 190, null, [['potato', 80], ['peas', 50], ['onion', 15], ['tomato', 30], ['spices', 3]], F('oil', 9, 16, 22)),
  D('bhindi', 'Bhindi', 'bhindi masala okra', 'curry', 'katori', 150, null, [['okra', 150], ['onion', 30], ['tomato', 20], ['spices', 3]], F('oil', 12, 20, 26)),
  D('mix_sabzi', 'Mix sabzi', 'mixed vegetable sabzi tarkari', 'curry', 'katori', 160, null, [['mixedVeg', 120], ['potato', 30], ['onion', 15], ['tomato', 20], ['spices', 3]], F('oil', 14, 18, 24)), // KHAN 142 vs CoFID 108-120 kcal/100 g
  D('anda_curry', 'Anda curry (2 eggs)', 'egg curry anday ka salan', 'curry', 'katori', 200, ['egg', 100], [['onion', 30], ['tomato', 50], ['spices', 5]], F('oil', 10, 18, 24)),
  D('fish_curry', 'Fish curry', 'machli salan fish salan', 'curry', 'katori', 200, ['fish', 120], [['tomato', 50], ['onion', 25], ['spices', 6]], F('oil', 17, 26, 32)), // KHAN 173 vs CoFID 139 kcal/100 g

  // Rice — one plate. Biryani and pulao 350 g: home plates ~300 g, restaurant 350-500 g, and the plate is the same serving for both.
  D('chicken_biryani', 'Chicken biryani', 'biryani biriyani chicken بریانی', 'rice', 'plate', 350, ['chicken', 105], [['rice', 88], ['dahi', 35], ['onion', 35], ['tomato', 23], ['spices', 6]], F('oil', 12, 18, 25)), // KHAN 160, CoFID 163 kcal/100 g
  D('mutton_biryani', 'Mutton biryani', 'biryani gosht mutton', 'rice', 'plate', 350, ['mutton', 99], [['rice', 88], ['dahi', 35], ['onion', 35], ['tomato', 23], ['spices', 6]], F('ghee', 12, 20, 28)), // CoFID 195 kcal/100 g
  D('beef_pulao', 'Beef yakhni pulao', 'pulao yakhni beef pulao', 'rice', 'plate', 350, ['beef', 82], [['rice', 93], ['onion', 29], ['dahi', 18], ['spices', 5]], F('oil', 13, 21, 28)), // KHAN 181 kcal/100 g
  D('chicken_pulao', 'Chicken pulao', 'yakhni pulao chicken', 'rice', 'plate', 350, ['chicken', 93], [['rice', 93], ['onion', 29], ['dahi', 18], ['spices', 5]], F('oil', 13, 21, 28)),
  D('kabuli_pulao', 'Kabuli pulao', 'kabuli pulao afghani pulao', 'rice', 'plate', 350, ['mutton', 88], [['rice', 88], ['carrot', 33], ['dates', 11], ['onion', 16]], F('oil', 13, 20, 26)),
  D('matar_pulao', 'Matar pulao', 'peas pulao', 'rice', 'plate', 250, null, [['rice', 70], ['peas', 40], ['onion', 15], ['spices', 2]], F('oil', 8, 14, 18)),
  D('zeera_rice', 'Zeera rice', 'jeera rice cumin rice', 'rice', 'cup', 180, null, [['rice', 60], ['spices', 1]], F('ghee', 5, 10, 12)),
  D('plain_rice', 'Plain boiled rice', 'chawal white rice basmati', 'rice', 'cup', 160, null, [['rice', 55]], NOFAT),
  D('khichdi', 'Khichdi', 'khichri', 'rice', 'katori', 250, null, [['rice', 40], ['moong', 25], ['spices', 2]], F('ghee', 6, 10, 14)),

  // Breads — one piece.
  // A Pakistani home roti is about 80 g cooked and ~200 kcal (QK's standard); a thin phulka is its own dish below.
  D('roti', 'Roti / chapati', 'chapati roti chapatti روٹی', 'bread', 'roti', 80, null, [['atta', 59]], NOFAT, { topping: ['ghee', 5, 'Ghee or butter on top'], sizes: true }),
  D('tandoori_roti', 'Tandoori roti', 'tandoor roti naan roti', 'bread', 'roti', 80, null, [['atta', 55]], NOFAT, { topping: ['butter', 6, 'Butter on top'] }),
  D('naan', 'Naan', 'plain naan butter naan khamiri', 'bread', 'naan', 140, null, [['maida', 96], ['dahi', 10], ['milk', 14], ['sugar', 3]], F('oil', 4, 5, 6), { topping: ['butter', 8, 'Butter naan'] }), // LFAC 133 g, CUH 150 g; CoFID 285, FNDDS 311 kcal/100 g
  D('paratha', 'Plain paratha', 'paratha parantha پراٹھا', 'bread', 'paratha', 100, null, [['atta', 60]], F('ghee', 10, 15, 20), { sizes: true }),
  D('aloo_paratha', 'Aloo paratha', 'aloo parantha potato paratha', 'bread', 'paratha', 150, null, [['atta', 60], ['potato', 70], ['onion', 5], ['spices', 2]], F('ghee', 12, 18, 24), { sizes: true }), // LFAC medium 103 g: Small size
  D('anda_paratha', 'Anda paratha', 'egg paratha', 'bread', 'paratha', 140, ['egg', 50], [['atta', 60]], F('ghee', 12, 20, 24)),
  D('puri', 'Puri', 'poori', 'fried', 'puri', 65, null, [['atta', 45]], F('oil', 10, 12, 13)), // LFAC 2024: halwa-puri puri 68 g; CoFID 366, FNDDS 409 kcal/100 g
  D('makki_roti', 'Makki ki roti', 'makai roti corn roti', 'bread', 'roti', 65, null, [['makki', 45]], NOFAT, { topping: ['butter', 8, 'Makhan on top'] }),
  D('roghni_naan', 'Roghni naan', 'roghni naan roghani sesame naan', 'bread', 'naan', 125, null, [['maida', 90], ['milk', 15], ['dahi', 10], ['egg', 5], ['sugar', 3], ['sesame', 3]], F('ghee', 8, 10, 12)),
  D('garlic_naan', 'Garlic naan', 'garlic naan', 'bread', 'naan', 145, null, [['maida', 96], ['dahi', 10], ['milk', 14], ['spices', 3]], F('butter', 8, 10, 12)), // same dough as naan
  D('kulcha', 'Kulcha', 'kulcha amritsari', 'bread', 'kulcha', 95, null, [['maida', 75], ['dahi', 8], ['milk', 8]], F('butter', 5, 8, 10)),
  D('taftan', 'Taftan', 'taftaan', 'bread', 'taftan', 120, null, [['maida', 85], ['milk', 30], ['egg', 5], ['sugar', 6], ['nuts', 2]], F('ghee', 6, 8, 10)),
  D('sheermal', 'Sheermal', 'shirmal sheer mal', 'bread', 'sheermal', 115, null, [['maida', 80], ['milk', 30], ['sugar', 10]], F('ghee', 10, 12, 14)),
  D('bakarkhani', 'Bakarkhani', 'baqarkhani', 'bread', 'piece', 50, null, [['maida', 36], ['sugar', 2]], F('ghee', 11, 11.5, 13)), // LFAC 2024: 47 g
  D('chapati_thin', 'Phulka (thin chapati)', 'phulka chapati patli roti', 'bread', 'phulka', 30, null, [['atta', 20]], NOFAT, { topping: ['ghee', 3, 'Ghee on top'] }),
  D('lachha_paratha', 'Lachha paratha', 'laccha paratha layered', 'bread', 'paratha', 90, null, [['atta', 25], ['maida', 25]], F('ghee', 12, 18, 24)),
  D('bread_slice', 'Bread (slice)', 'double roti toast slice', 'bread', 'slice', 28, null, [['bread', 28]], NOFAT, { topping: ['butter', 5, 'Butter or margarine'] }),

  // BBQ and kebabs.
  // A BBQ tikka is a quarter chicken: leg piece (thigh + drumstick) or chest piece (breast, the bigger one).
  D('chicken_tikka', 'Chicken tikka (leg piece)', 'tikka tandoori chicken leg piece ran bbq', 'bbq', 'piece', 160, ['chicken', 225], [['dahi', 20], ['spices', 5]], F('oil', 7, 12, 16)), // 160 g edible: FNDDS leg quarter 140 g (US bird), Pakistani pieces bigger; CoFID tandoori 214 kcal/100 g
  D('chicken_tikka_chest', 'Chicken tikka (chest piece)', 'chest piece breast tikka seena tikka', 'bbq', 'piece', 190, ['chickenBreast', 270], [['dahi', 20], ['spices', 5]], F('oil', 7, 12, 16)), // chest piece ~1.2× the leg piece
  D('chicken_boti', 'Chicken boti / malai boti (one seekh)', 'boti malai boti', 'bbq', 'seekh', 100, ['chicken', 130], [['dahi', 10], ['spices', 3]], F('oil', 4, 7, 9)),
  D('sajji', 'Sajji (chicken, quarter)', 'sajji chicken sajji roast', 'bbq', 'quarter', 200, ['chickenSkin', 220], [['spices', 3]], F('oil', 3, 4, 5)),
  D('lamb_sajji', 'Lamb sajji / namkeen tikka', 'lamb sajji namkeen tikka charsi tikka dumba', 'bbq', 'portion', 175, ['mutton', 250], [['spices', 2]], F('ghee', 10, 15, 20)),
  D('mutton_chops', 'Mutton chops (chaanp)', 'chops chaanp champ', 'bbq', 'piece', 60, ['mutton', 90], [['spices', 2]], F('oil', 4, 6, 8)),
  D('chargha', 'Chargha (half chicken)', 'chargha', 'fried', 'half', 250, ['chickenSkin', 350], [['spices', 4]], F('oil', 15, 20, 25)),
  D('fry_kebab', 'Fry kebab', 'fry kabab fried kebab', 'fried', 'kebab', 60, ['beefMince', 70], [['onion', 10], ['spices', 3]], F('oil', 8, 10, 12)),
  D('manchurian', 'Chicken manchurian', 'manchurian', 'fastfood', 'plate', 250, ['chicken', 120], [['maida', 15], ['ketchup', 30], ['capsicum', 30]], F('oil', 10, 15, 18)),
  D('afghani_burger', 'Afghani burger', 'afghani burger naan roll fries', 'street', 'burger', 250, ['chicken', 40], [['maida', 70], ['potato', 80], ['mayo', 15], ['cabbage', 20]], F('oil', 8, 10, 12)),
  D('patties', 'Chicken patties', 'patties patty puff pastry bakery', 'snack', 'piece', 70, ['chicken', 20], [['maida', 30], ['cream', 5]], F('butter', 12, 12, 12)),
  D('seekh_kebab', 'Seekh kebab', 'seekh kabab beef kebab', 'bbq', 'kebab', 70, ['beefMince', 90], [['onion', 8], ['spices', 3]], F('oil', 1.5, 3.5, 4.5)), // supplier 65-70 g/piece; CoFID kofta 290 kcal/100 g
  D('chapli_kebab', 'Chapli kebab', 'chapli kabab peshawari', 'fried', 'kebab', 120, ['beefMince', 110], [['tomato', 15], ['onion', 15], ['egg', 10], ['makki', 5], ['spices', 4]], F('ghee', 8, 15, 18)),
  D('shami_kebab', 'Shami kebab', 'shami kabab', 'fried', 'kebab', 75, ['beef', 42], [['chanaDal', 20], ['egg', 8], ['spices', 3]], F('oil', 7, 10, 12)), // LFAC 2024: 1 shami = 76 g
  D('fried_fish', 'Fried fish (Lahori)', 'lahori fish fry machli', 'fried', 'portion', 130, ['fish', 120], [['besan', 15], ['spices', 3]], F('oil', 10, 16, 18)),

  // Snacks.
  D('samosa', 'Samosa (aloo)', 'aloo samosa potato samosa سموسہ', 'fried', 'samosa', 100, null, [['maida', 33], ['potato', 55], ['peas', 7], ['spices', 3]], F('oil', 13, 15, 16)), // LFAC aloo samosa 100 g, FNDDS 100 g
  D('keema_samosa', 'Samosa (qeema)', 'keema samosa meat samosa', 'fried', 'samosa', 50, ['beefMince', 21], [['maida', 18], ['onion', 6], ['spices', 1.5]], F('oil', 6.5, 8.5, 9)), // LFAC qeema samosa 45 g
  D('pakora', 'Pakoray', 'pakora pakoda bhajia fritters', 'fried', 'plate', 100, null, [['besan', 30], ['onion', 30], ['potato', 20], ['spinach', 10], ['spices', 2]], F('oil', 14, 18, 20)),
  D('dahi_bhalla', 'Dahi bhalla', 'dahi baray dahi vada', 'fried', 'plate', 220, null, [['mash', 30], ['dahi', 120], ['sugar', 6], ['spices', 2]], F('oil', 8, 10, 12)),
  D('chana_chaat', 'Chana chaat', 'chaat chickpea chaat', 'snack', 'plate', 180, null, [['kabuli', 40], ['potato', 30], ['onion', 15], ['tomato', 20], ['sugar', 3], ['spices', 3]], NOFAT),
  // 2 puris (LFAC 68 g each) + ~110 g halwa + ~160 g cholay; fat = puri oil 20 + halwa ghee 16 + cholay oil 10 at home.
  D('halwa_puri', 'Halwa puri plate (2 puri, halwa, cholay)', 'halwa puri plate nashta thaal', 'fried', 'plate', 400, null, [['atta', 90], ['suji', 35], ['sugar', 30], ['kabuli', 45], ['onion', 25], ['tomato', 35], ['spices', 5]], F('ghee', 46, 58, 66)),
  D('suji_halwa', 'Suji halwa', 'halwa sooji halwa', 'sweet', 'katori', 110, null, [['suji', 35], ['sugar', 30]], F('ghee', 16, 20, 24)), // CoFID 17-799: 342 kcal/100 g

  // Fast food (chains). Built as recipes; official chain values can override them in js/menus.js.
  D('zinger_burger', 'Zinger / crispy chicken burger', 'zinger krunch crispy chicken burger', 'fastfood', 'burger', 200, ['chickenBreast', 110], [['bun', 60], ['maida', 15], ['mayo', 12], ['cabbage', 10]], F('oil', 8, 10, 12)),
  D('mighty_zinger', 'Double fillet burger (Mighty Zinger)', 'mighty zinger double', 'fastfood', 'burger', 300, ['chickenBreast', 210], [['bun', 65], ['maida', 28], ['mayo', 16], ['cheese', 14], ['cabbage', 12]], F('oil', 15, 18, 20)),
  D('beef_burger', 'Beef burger (two patties, cheese)', 'big mac whopper beef burger', 'fastfood', 'burger', 220, ['beefMince', 90], [['bun', 75], ['cheese', 14], ['mayo', 15], ['cabbage', 20], ['ketchup', 5]], NOFAT),
  D('chicken_burger', 'Chicken patty burger', 'mcchicken chicken burger patty', 'fastfood', 'burger', 150, ['chickenMince', 65], [['bun', 55], ['maida', 12], ['mayo', 6], ['cabbage', 10]], F('oil', 6, 6, 8)),
  D('fried_chicken', 'Fried chicken piece', 'hot and crispy piece broast fried chicken', 'fastfood', 'piece', 110, ['chickenSkin', 100], [['maida', 12], ['spices', 2]], F('oil', 8, 10, 12)),
  D('broast', 'Broast (quarter)', 'broast chicken quarter', 'fastfood', 'quarter', 260, ['chickenSkin', 200], [['maida', 25], ['spices', 3]], F('oil', 18, 22, 25)),
  D('nuggets', 'Chicken nuggets (6 pieces)', 'nuggets mcnuggets', 'fastfood', 'box', 100, ['chickenMince', 72], [['maida', 20]], F('oil', 13, 14, 15)), // FNDDS 307 kcal/100 g
  D('fries', 'French fries (regular)', 'fries chips french fries', 'fastfood', 'regular', 110, null, [['potato', 230]], F('oil', 16, 16, 18)), // FNDDS 289 (restaurant) to 312 kcal/100 g
  D('pizza_slice', 'Pizza slice (medium, chicken)', 'pizza slice chicken tikka fajita', 'fastfood', 'slice', 110, ['chicken', 15], [['maida', 40], ['mozzarella', 25], ['tomato', 15]], F('oil', 4, 5, 6)),
  D('club_sandwich', 'Club sandwich', 'club sandwich', 'fastfood', 'sandwich', 230, ['chicken', 60], [['bread', 90], ['egg', 25], ['mayo', 15], ['cheese', 14], ['cabbage', 15], ['tomato', 15]], NOFAT),
  D('sub_6', 'Sub sandwich (6 inch, chicken)', 'sub chicken tikka teriyaki', 'fastfood', 'sub', 200, ['chickenBreast', 70], [['bread', 75], ['cabbage', 25], ['tomato', 20], ['mayo', 6]], NOFAT, { topping: ['cheese', 14, 'Cheese'] }),
  D('shawarma', 'Chicken shawarma', 'shawarma shwarma wrap', 'fastfood', 'shawarma', 200, ['chicken', 70], [['maida', 50], ['mayo', 20], ['cabbage', 30], ['spices', 3]], F('oil', 4, 6, 8)),
  D('wings', 'Chicken wings (6)', 'wings hot wings korean wings', 'fastfood', 'serving', 150, ['chickenSkin', 150], [['maida', 10], ['ketchup', 15]], F('oil', 10, 12, 14)),
  D('loaded_fries', 'Loaded fries', 'loaded fries nashville bomber elote', 'fastfood', 'regular', 220, ['chicken', 40], [['potato', 230], ['cheese', 25], ['mayo', 15]], F('oil', 14, 16, 18)),
  D('creamy_pasta', 'Creamy chicken pasta', 'pasta alfredo fettuccine creamy chicken pasta', 'fastfood', 'plate', 350, ['chicken', 80], [['pasta', 90], ['cream', 40], ['cheese', 20], ['spices', 3]], F('oil', 6, 10, 12)),
  D('lasagna', 'Lasagna', 'lasagne lasagna', 'fastfood', 'portion', 300, ['beefMince', 70], [['pasta', 60], ['mozzarella', 40], ['cream', 20], ['tomato', 60]], F('oil', 6, 10, 12)),
  D('grilled_chicken_meal', 'Grilled chicken with sauce, rice and veg', 'grilled chicken steak moroccan tarragon chicken fillet cafe', 'fastfood', 'plate', 400, ['chickenBreast', 200], [['rice', 50], ['mixedVeg', 80], ['cream', 20], ['spices', 3]], F('oil', 8, 12, 15)),
  D('egg_fried_rice', 'Egg fried rice', 'egg fried rice chinese rice', 'fastfood', 'plate', 300, ['egg', 50], [['rice', 80], ['mixedVeg', 60], ['ketchup', 5]], F('oil', 10, 16, 20)),
  D('chow_mein', 'Chicken chow mein', 'chow mein chowmein noodles chinese', 'fastfood', 'plate', 350, ['chicken', 70], [['pasta', 80], ['mixedVeg', 80], ['ketchup', 10]], F('oil', 10, 16, 20)),
  D('cheesy_pizza_slice', 'Pizza slice (Pakistani, extra cheese)', 'pakistani pizza crown crust stuffed crust kabab crust cheesy', 'fastfood', 'slice', 130, ['chicken', 25], [['maida', 42], ['mozzarella', 35], ['mayo', 6], ['capsicum', 8]], F('oil', 5, 6, 7)),
  D('cola', 'Cola / soft drink (can)', 'pepsi coke 7up sprite soft drink', 'drink', 'can', 345, null, [['sugar', 36]], NOFAT),
  D('milkshake', 'Milkshake', 'shake mango shake', 'drink', 'glass', 300, null, [['milk', 250], ['sugar', 25], ['cream', 20]], NOFAT),

  // Street carts and stalls.
  D('bun_kebab', 'Bun kebab', 'bun kabab anda bun', 'street', 'bun kebab', 160, ['beefMince', 25], [['bun', 60], ['chanaDal', 20], ['egg', 25], ['onion', 15], ['ketchup', 10]], F('oil', 8, 10, 12)), // bun + lentil-heavy shami patty dipped in egg
  D('anda_shami_burger', 'Anda shami burger', 'anda shami burger egg shami', 'street', 'burger', 205, ['beef', 42], [['bun', 60], ['chanaDal', 20], ['egg', 58], ['cabbage', 15], ['ketchup', 10]], F('oil', 11, 13, 15)), // bun + 75 g shami (LFAC) + fried egg
  D('paratha_roll', 'Chicken paratha roll', 'roll paratha roll chicken roll kathi', 'street', 'roll', 190, ['chicken', 65], [['atta', 85], ['mayo', 8], ['ketchup', 8], ['onion', 20], ['spices', 3]], F('ghee', 10, 14, 16)), // LFAC kabab roll 183 g with 71 g carbs
  D('gol_gappay', 'Gol gappay (plate of 6)', 'gol gappay pani puri gol gappe', 'street', 'plate', 150, null, [['suji', 24], ['kabuli', 10], ['potato', 30], ['sugar', 8], ['spices', 3]], F('oil', 6, 7, 8)),
  D('fruit_chaat', 'Fruit chaat', 'fruit chaat', 'street', 'plate', 200, null, [['banana', 60], ['apple', 60], ['mango', 40], ['sugar', 6], ['spices', 1]], NOFAT),
  D('samosa_chaat', 'Samosa chaat', 'samosa chaat chana samosa', 'street', 'plate', 250, null, [['maida', 25], ['potato', 40], ['kabuli', 30], ['dahi', 50], ['onion', 15], ['sugar', 6], ['spices', 3]], F('oil', 10, 12, 13)),
  D('pav_bhaji', 'Pav bhaji (2 pav)', 'pav bhaji pao bhaji paav bhaji', 'street', 'plate', 300, null, [['bun', 80], ['potato', 80], ['mixedVeg', 60], ['peas', 20], ['tomato', 60], ['onion', 30], ['capsicum', 20], ['spices', 5]], F('butter', 18, 25, 30)), // bhaji ~220 g + 2 pav (40 g each), butter in the bhaji and on the pav
  D('roasted_chana', 'Roasted chana (bhunay chanay)', 'bhunay chanay bhune chane bhuna chana roasted chickpeas', 'snack', 'handful', 30, null, [['kabuli', 31]], NOFAT),
  D('bhutta', 'Bhutta (roasted corn)', 'bhutta corn cob makai', 'street', 'cob', 100, null, [['makki', 35]], NOFAT),

  // Sweets.
  D('zarda', 'Zarda (sweet rice)', 'zarda meethay chawal', 'sweet', 'plate', 200, null, [['rice', 60], ['sugar', 30], ['nuts', 5]], F('ghee', 12, 15, 18)),
  D('kunafa', 'Kunafa', 'kunafa knafeh', 'sweet', 'piece', 150, null, [['vermicelli', 40], ['mozzarella', 30], ['sugar', 30]], F('ghee', 15, 18, 20)),
  D('biscuits', 'Biscuits (3)', 'biscuit biscuits cookies rusk papay', 'sweet', 'pack', 30, null, [['maida', 20], ['sugar', 6]], F('oil', 5, 5, 5)),
  D('donut', 'Glazed donut', 'donut doughnut', 'sweet', 'donut', 55, null, [['maida', 25], ['sugar', 12], ['milk', 5]], F('oil', 9, 10, 11)),
  D('ice_cream', 'Ice cream (2 scoops)', 'ice cream icecream scoop kulfi', 'sweet', 'cup', 140, null, [['iceCream', 140]], NOFAT),
  D('rabri', 'Rabri', 'rabri rabdi', 'sweet', 'katori', 120, null, [['milk', 300], ['sugar', 20], ['nuts', 3]], NOFAT),
  D('ras_malai', 'Ras malai', 'ras malai rasmalai', 'sweet', 'piece', 60, null, [['paneer', 20], ['milk', 60], ['sugar', 10], ['nuts', 2]], NOFAT),
  D('mithai', 'Mithai (barfi, chamcham)', 'mithai barfi chamcham milk cake sweets', 'sweet', 'piece', 45, null, [['khoya', 20], ['sugar', 12]], F('ghee', 1, 1, 1)), // LFAC barfi 40 g, FNDDS 45 g at 283 kcal/100 g
  D('laddu', 'Laddu (besan / motichoor)', 'laddu ladoo laddoo motichoor besan laddu', 'sweet', 'piece', 60, null, [['besan', 25], ['sugar', 20]], F('ghee', 8, 8, 8)), // FNDDS ladoo 60 g at 411 kcal/100 g
  D('sohan_halwa', 'Sohan halwa', 'sohan halwa multani', 'sweet', 'piece', 50, null, [['sugar', 18], ['milk', 30], ['maida', 8], ['nuts', 7]], F('ghee', 8, 8, 8)), // LFAC 2024: 1 piece 50 g
  D('kulfi', 'Kulfi', 'kulfi', 'sweet', 'kulfi', 70, null, [['milk', 150], ['sugar', 12], ['nuts', 3]], NOFAT),
  D('falooda', 'Falooda', 'falooda faluda kulfi falooda', 'sweet', 'glass', 300, null, [['milk', 200], ['sugar', 25], ['iceCream', 60], ['vermicelli', 10], ['nuts', 5]], NOFAT),
  D('nankhatai', 'Nankhatai', 'nankhatai nan khatai', 'sweet', 'piece', 25, null, [['maida', 12], ['sugar', 6]], F('ghee', 6, 6, 6)),
  D('cream_roll', 'Cream roll', 'cream roll bakery', 'sweet', 'piece', 50, null, [['maida', 18], ['cream', 10], ['sugar', 8]], F('butter', 8, 8, 8)),
  D('cake_slice', 'Cake slice', 'cake slice coffee cake sponge chocolate cake fudge cake', 'sweet', 'slice', 70, null, [['maida', 25], ['sugar', 20], ['egg', 10]], F('butter', 10, 10, 10)),
  D('cake_rusk', 'Cake rusk (2)', 'rusk cake rusk', 'sweet', 'pack', 30, null, [['maida', 15], ['sugar', 6], ['egg', 5]], F('oil', 4, 4, 4)),
  D('nimko', 'Nimko (handful)', 'nimko daal moth namkeen', 'snack', 'handful', 30, null, [['besan', 15], ['spices', 1]], F('oil', 8, 8, 8)),
  D('paan', 'Paan (sweet)', 'paan pan meetha paan', 'snack', 'paan', 15, null, [['sugar', 10], ['nuts', 3]], NOFAT),
  D('kheer', 'Kheer', 'rice kheer chawal ki kheer', 'sweet', 'katori', 150, null, [['milk', 150], ['rice', 14], ['sugar', 18], ['nuts', 3]], NOFAT), // LFAC/CUH carbs imply ~160 kcal/100 g
  D('gulab_jamun', 'Gulab jamun', 'gulab jaman', 'fried', 'piece', 40, null, [['khoya', 10], ['maida', 4], ['sugar', 12]], F('ghee', 2, 2.5, 3)), // CoFID 273-306 kcal/100 g; LFAC 36 g
  D('gajar_halwa', 'Gajar ka halwa', 'gajrela carrot halwa', 'sweet', 'katori', 150, null, [['carrot', 140], ['milk', 100], ['sugar', 28], ['khoya', 15], ['nuts', 4]], F('ghee', 14, 18, 22)), // CoFID 354 kcal/100 g (CUH lower): ~290
  D('jalebi', 'Jalebi', 'jalaibi', 'fried', 'plate', 100, null, [['maida', 30], ['sugar', 45]], F('ghee', 12, 14, 15)),
  D('sheer_khurma', 'Sheer khurma', 'sheer korma seviyan', 'sweet', 'katori', 200, null, [['milk', 200], ['vermicelli', 20], ['sugar', 30], ['nuts', 10], ['dates', 10]], F('ghee', 6, 8, 10)), // LFAC 2024: 37 g carbs/100 g

  // Drinks.
  D('chai', 'Chai (doodh patti)', 'tea doodh patti chai milk tea چائے', 'drink', 'cup', 150, null, [['milk', 100], ['sugar', 10]], NOFAT),
  D('chai_no_sugar', 'Chai (no sugar)', 'chai bina cheeni sugar free chai pheeki chai tea without sugar', 'drink', 'cup', 150, null, [['milk', 100]], NOFAT),
  D('sugarcane_juice', 'Sugarcane juice (ganne ka ras)', 'ganne ka ras ganay ka ras ganna juice sugarcane juice گنے کا رس', 'drink', 'glass', 300, null, [['caneJuice', 300]], NOFAT),
  D('kehwa', 'Kehwa (green tea)', 'kehwa qehwa green tea', 'drink', 'cup', 150, null, [['sugar', 5]], NOFAT),
  D('sweet_lassi', 'Lassi (sweet)', 'meethi lassi', 'drink', 'glass', 300, null, [['dahi', 200], ['milk', 50], ['sugar', 25]], NOFAT),
  D('salted_lassi', 'Lassi (salted)', 'namkeen lassi chaas', 'drink', 'glass', 300, null, [['dahi', 200]], NOFAT),

  // Fruit and milk (by the piece or glass).
  D('banana', 'Banana (kela)', 'kela kelay banana', 'fruit', 'banana', 100, null, [['banana', 100]], NOFAT),
  D('apple', 'Apple (seb)', 'seb apple', 'fruit', 'apple', 150, null, [['apple', 150]], NOFAT),
  D('mango', 'Mango (aam)', 'aam mango', 'fruit', 'mango', 200, null, [['mango', 200]], NOFAT),
  D('orange', 'Orange (malta / kinnow)', 'malta kinnow kinu orange santra', 'fruit', 'orange', 130, null, [['orange', 130]], NOFAT),
  D('guava', 'Guava (amrood)', 'amrood guava', 'fruit', 'guava', 150, null, [['guava', 150]], NOFAT),
  D('dates', 'Dates (khajoor)', 'khajoor khajoorain dates', 'fruit', 'date', 8, null, [['dates', 8]], NOFAT),
  D('milk_glass', 'Milk (glass)', 'doodh milk glass of milk', 'drink', 'glass', 250, null, [['milk', 250]], NOFAT),

  // Eggs and sides.
  D('anda_fry', 'Fried egg (anda fry)', 'fried egg anda', 'egg', 'egg', 46, ['egg', 50], [], F('oil', 4, 6, 8)),
  D('omelette', 'Omelette (2 eggs)', 'omelet anday ka khagina', 'egg', 'omelette', 125, ['egg', 100], [['onion', 15], ['tomato', 15], ['spices', 2]], F('oil', 9, 12, 14)), // FNDDS/CoFID 191 kcal/100 g
  D('boiled_egg', 'Boiled egg', 'ublay anday egg', 'egg', 'egg', 50, ['egg', 50], [], NOFAT),
  D('raita', 'Raita', 'raita yogurt', 'side', 'katori', 100, null, [['dahi', 90], ['cucumber', 15]], NOFAT),
  D('dahi', 'Dahi (plain yogurt)', 'yogurt curd', 'side', 'katori', 150, null, [['dahi', 150]], NOFAT),
  D('salad', 'Salad (kachumber)', 'salad kachumber', 'side', 'plate', 100, null, [['tomato', 40], ['onion', 30], ['cucumber', 30]], NOFAT),
  // UAE and the Gulf: Emirati, Yemeni/Saudi rice, Levantine, Iranian, cafeteria. Serving sizes follow
  // typical UAE restaurant plates; build-ups checked against published values where they exist
  // (Saudi MOH, FatSecret, USDA hummus/tabbouleh) — see docs/NUTRITION.md.
  D('chicken_mandi', 'Chicken mandi (quarter chicken)', 'mandi mendi yemeni chicken mandi rice', 'rice', 'plate', 450, ['chicken', 150], [['rice', 100], ['onion', 15], ['nuts', 5], ['spices', 4]], F('ghee', 12, 18, 25)),
  D('lamb_mandi', 'Lamb mandi', 'mandi lamb laham mandi madfoon lamb', 'rice', 'plate', 450, ['lamb', 160], [['rice', 100], ['onion', 15], ['nuts', 5], ['spices', 4]], F('ghee', 15, 22, 30)),
  D('chicken_machboos', 'Chicken machboos', 'machboos majboos emirati chicken rice', 'rice', 'plate', 450, ['chicken', 150], [['rice', 100], ['onion', 30], ['tomato', 30], ['spices', 5]], F('ghee', 10, 15, 20)),
  D('lamb_machboos', 'Lamb machboos', 'machboos lamb majboos laham', 'rice', 'plate', 450, ['lamb', 150], [['rice', 100], ['onion', 30], ['tomato', 30], ['spices', 5]], F('ghee', 12, 18, 24)),
  D('fish_machboos', 'Fish machboos', 'machboos samak fish rice hamour kingfish', 'rice', 'plate', 450, ['fish', 140], [['rice', 100], ['onion', 30], ['tomato', 30], ['spices', 5]], F('oil', 10, 15, 20)),
  D('chicken_kabsa', 'Chicken kabsa', 'kabsa kabsah saudi chicken rice', 'rice', 'plate', 450, ['chicken', 150], [['rice', 100], ['tomato', 40], ['onion', 20], ['nuts', 5], ['spices', 4]], F('oil', 10, 15, 20)),
  D('chelo_rice', 'Chelo rice with butter', 'chelo kabab rice persian rice iranian', 'rice', 'plate', 300, null, [['rice', 100]], F('butter', 8, 12, 15)),
  D('harees', 'Harees (Emirati)', 'harees harris emirati wheat chicken', 'curry', 'bowl', 250, ['chicken', 60], [['dalia', 55]], F('ghee', 6, 10, 14)),
  D('hummus', 'Hummus', 'hummus houmous humus chickpea dip', 'side', 'plate', 150, null, [['kabuli', 35], ['tahini', 20], ['spices', 2]], F('oil', 8, 12, 15)),
  D('mutabbal', 'Mutabbal (moutabal)', 'mutabbal moutabal baba ghanoush eggplant dip', 'side', 'plate', 150, null, [['eggplant', 120], ['tahini', 15], ['dahi', 15]], F('oil', 5, 10, 12)),
  D('labneh', 'Labneh', 'labneh labne labna', 'side', 'plate', 100, null, [['greekYogurt', 80], ['cream', 15]], F('oil', 6, 10, 12)),
  D('foul_medames', 'Foul medames', 'foul ful medames fava beans', 'curry', 'bowl', 250, null, [['favaCooked', 180], ['tahini', 5], ['tomato', 20], ['spices', 2]], F('oil', 8, 12, 15)),
  D('fattoush', 'Fattoush', 'fattoush fatoush salad', 'side', 'bowl', 250, null, [['cucumber', 60], ['tomato', 60], ['cabbage', 50], ['parsley', 20], ['pita', 20]], F('oil', 10, 15, 18)),
  D('tabbouleh', 'Tabbouleh', 'tabbouleh tabouli taboule', 'side', 'bowl', 200, null, [['parsley', 100], ['tomato', 50], ['dalia', 15], ['onion', 10]], F('oil', 10, 15, 18)),
  D('falafel', 'Falafel (piece)', 'falafel falafil tamiya', 'fried', 'piece', 20, null, [['kabuli', 8], ['onion', 3], ['spices', 1]], F('oil', 3, 4, 5)),
  D('falafel_sandwich', 'Falafel sandwich', 'falafel wrap falafel sandwich', 'street', 'wrap', 200, null, [['pita', 70], ['kabuli', 30], ['tahini', 10], ['cabbage', 30], ['tomato', 20]], F('oil', 10, 14, 18)),
  D('kibbeh', 'Kibbeh (fried, piece)', 'kibbeh kubba kibbe', 'fried', 'piece', 60, ['lamb', 20], [['dalia', 20], ['onion', 5], ['nuts', 3]], F('oil', 5, 6, 8)),
  D('shish_tawook', 'Shish tawook (skewer)', 'shish tawook tawouk taouk chicken skewer', 'bbq', 'skewer', 120, ['chickenBreast', 170], [['dahi', 15], ['spices', 3]], F('oil', 5, 8, 10)),
  D('mixed_grill', 'Mixed grill (platter, meat only)', 'mixed grill arabic grill kofta tikka tawook platter', 'bbq', 'platter', 350, ['chickenBreast', 170], [['lamb', 100], ['beefMince', 100], ['onion', 20], ['spices', 4]], F('oil', 10, 15, 20)),
  D('koobideh_kebab', 'Koobideh kebab (skewer)', 'koobideh kubideh kabab persian kebab', 'bbq', 'skewer', 100, ['beefMince', 130], [['onion', 10], ['spices', 2]], NOFAT),
  D('joojeh_kebab', 'Joojeh kebab (skewer)', 'joojeh jujeh chicken kabab saffron', 'bbq', 'skewer', 200, ['chickenBreast', 250], [['spices', 3]], F('butter', 8, 10, 14)),
  D('manakish_zaatar', 'Manakish zaatar', 'manakish manakeesh manaeesh zaatar zatar', 'bread', 'piece', 120, null, [['maida', 60], ['sesame', 5]], F('oil', 8, 10, 12)),
  D('manakish_cheese', 'Manakish cheese', 'manakish cheese akkawi jibneh', 'bread', 'piece', 150, null, [['maida', 60], ['mozzarella', 50]], F('oil', 4, 5, 6)),
  D('manakish_meat', 'Lahm bi ajeen (meat manakish)', 'lahm bi ajeen lahmacun meat manakish', 'bread', 'piece', 150, ['beefMince', 50], [['maida', 60], ['onion', 10], ['tomato', 10]], F('oil', 6, 8, 10)),
  D('khameer', 'Khameer bread', 'khameer khamir emirati bread', 'bread', 'bread', 80, null, [['maida', 50], ['sugar', 5]], F('ghee', 4, 5, 6)),
  D('khubz', 'Khubz / Arabic bread', 'khubz khubus kuboos pita arabic bread lebanese bread', 'bread', 'piece', 70, null, [['pita', 70]], NOFAT),
  D('regag', 'Regag (plain)', 'regag rigag emirati thin bread', 'bread', 'sheet', 60, null, [['maida', 40]], F('ghee', 2, 3, 4)),
  D('chebab', 'Chebab (Emirati pancake)', 'chebab chabab emirati pancake', 'bread', 'pancake', 50, null, [['maida', 20], ['egg', 8], ['sugar', 3]], F('butter', 3, 4, 5)),
  D('kerala_parotta', 'Kerala parotta', 'parotta porotta malabar paratha', 'bread', 'parotta', 90, null, [['maida', 55]], F('oil', 10, 12, 14)),
  D('bun_maska', 'Bun maska', 'bun maska butter bun', 'bread', 'bun', 80, null, [['bun', 65]], F('butter', 10, 15, 18)),
  D('chips_oman_paratha', 'Chips Oman paratha', 'chips oman paratha roll cafeteria', 'street', 'roll', 140, null, [['maida', 50], ['cheese', 15], ['crisps', 25], ['ketchup', 5]], F('oil', 8, 10, 12)),
  // Café drinks (a regular/medium cup; milk is whole unless the café says otherwise)
  D('latte', 'Caffè latte', 'latte cafe latte caffe latte', 'drink', 'cup', 350, null, [['milk', 250]], NOFAT),
  D('cappuccino', 'Cappuccino', 'cappuccino capuccino', 'drink', 'cup', 240, null, [['milk', 150]], NOFAT),
  D('flat_white', 'Flat white', 'flat white', 'drink', 'cup', 180, null, [['milk', 120]], NOFAT),
  D('spanish_latte', 'Spanish latte', 'spanish latte condensed milk latte', 'drink', 'cup', 300, null, [['milk', 200], ['condensedMilk', 30]], NOFAT),
  D('iced_latte', 'Iced latte', 'iced latte cold latte', 'drink', 'cup', 350, null, [['milk', 200]], NOFAT),
  D('caramel_macchiato', 'Caramel macchiato', 'caramel macchiato', 'drink', 'cup', 350, null, [['milk', 250], ['sugar', 20]], NOFAT),
  D('frappuccino', 'Frappuccino (blended coffee)', 'frappuccino frappe blended coffee', 'drink', 'cup', 400, null, [['milk', 150], ['sugar', 40], ['cream', 20]], NOFAT),
  D('iced_capp', 'Iced Capp', 'iced capp iced cappuccino tim hortons', 'drink', 'cup', 400, null, [['cream', 50], ['milk', 100], ['sugar', 35]], NOFAT),
  D('coffee_cream_sugar', 'Coffee with cream and sugar', 'coffee double double regular coffee milk coffee', 'drink', 'cup', 300, null, [['cream', 15], ['sugar', 8]], NOFAT),
  D('fresh_juice', 'Fresh juice (orange or mixed fruit)', 'juice fresh juice cocktail juice orange juice mango juice', 'drink', 'glass', 300, null, [['orange', 250], ['sugar', 15]], NOFAT),
  D('protein_shake', 'Protein shake (whey + milk)', 'protein shake whey shake', 'drink', 'shake', 300, null, [['whey', 30], ['milkLow', 250]], NOFAT),
  D('croissant', 'Croissant (butter)', 'croissant croissan biscuit', 'snack', 'croissant', 60, null, [['maida', 30]], F('butter', 13, 13, 13)),
  D('onion_rings', 'Onion rings', 'onion rings', 'fried', 'portion', 120, null, [['onion', 60], ['maida', 25]], F('oil', 18, 22, 26)),
  D('garlic_bread', 'Garlic bread', 'garlic bread', 'bread', 'piece', 40, null, [['maida', 25], ['garlic', 2]], F('butter', 6, 8, 10)),
  D('toum', 'Garlic sauce (toum)', 'toum garlic sauce garlic dip', 'side', 'tub', 30, null, [['garlic', 5]], F('oil', 19, 19, 19)), // oil whipped with lemon juice and water: ~600 kcal per 100 g
  D('karak_chai', 'Karak chai', 'karak chai karak tea cafeteria tea', 'drink', 'cup', 150, null, [['evapMilk', 50], ['sugar', 12]], NOFAT),
  D('luqaimat', 'Luqaimat (piece)', 'luqaimat lugaimat awamat dumplings', 'sweet', 'piece', 15, null, [['maida', 8], ['dateSyrup', 4]], F('oil', 3, 3.5, 4)),
  D('balaleet', 'Balaleet', 'balaleet sweet vermicelli egg', 'sweet', 'plate', 200, null, [['vermicelli', 50], ['sugar', 20], ['egg', 50]], F('ghee', 8, 10, 12)),
  D('beef_fry', 'Kerala beef fry', 'beef fry beef ularthiyathu kerala', 'curry', 'plate', 150, ['beef', 150], [['coconut', 10], ['onion', 20], ['spices', 3]], F('oil', 10, 15, 20)),
  D('chicken_adobo', 'Chicken adobo', 'adobo filipino chicken', 'curry', 'portion', 200, ['chickenSkin', 180], [['onion', 10], ['spices', 3]], F('oil', 5, 8, 10)),
  D('sisig', 'Sisig (chicken)', 'sisig sizzling filipino', 'curry', 'plate', 200, ['chickenSkin', 150], [['mayo', 15], ['onion', 20]], F('oil', 5, 8, 10)),
  // Western café and restaurant food, as served in Pakistani cafés (Gloria Jean's, Butlers, Espresso, Cosa Nostra,
  // Tuscany Courtyard, Café Aylanto). Portions are a café plate; each line names the reference it was checked against.
  // Sides that are ordered separately (fries, mash, a soup's bread) are their own dishes.
  // Breakfast
  D('pancakes', 'Pancakes (2, with syrup and butter)', 'pancake pancakes hotcakes pan cake', 'sweet', 'plate', 190, null, [['maida', 60], ['milk', 90], ['egg', 25], ['sugar', 8], ['syrup', 30]], F('butter', 8, 12, 14)), // FNDDS pancakes w/ butter & syrup ~250 kcal/100 g; 2 pancakes + syrup ≈ 450-550
  D('waffles', 'Waffle (with syrup and butter)', 'waffle waffles belgian waffle', 'sweet', 'plate', 170, null, [['maida', 55], ['milk', 60], ['egg', 25], ['sugar', 10], ['syrup', 30]], F('butter', 12, 15, 18)), // FNDDS waffle 291 kcal/100 g (~120 g Belgian) + syrup & butter ≈ 480
  D('french_toast', 'French toast (2 slices, with syrup)', 'french toast eggy bread', 'sweet', 'plate', 175, null, [['bread', 70], ['egg', 50], ['milk', 40], ['sugar', 5], ['syrup', 20]], F('butter', 8, 10, 14)), // FNDDS french toast 229 kcal/100 g; 2 slices + syrup ≈ 400-450
  D('eggs_benedict', 'Eggs Benedict (2 eggs, hollandaise)', 'eggs benedict egg benedict eggs benny hollandaise', 'egg', 'plate', 260, ['chickenBreast', 40], [['bread', 60], ['egg', 110]], F('butter', 15, 20, 24)), // café/chain values 500-750 kcal
  D('scrambled_eggs', 'Scrambled eggs (2 eggs)', 'scrambled eggs scrambled egg anda bhurji bhurji', 'egg', 'plate', 120, ['egg', 100], [['milk', 20]], F('butter', 5, 8, 10)), // FNDDS scrambled egg 149-212 kcal/100 g
  D('english_breakfast', 'Full English breakfast', 'english breakfast full english fry up big breakfast', 'egg', 'plate', 500, ['sausage', 100], [['egg', 100], ['bakedBeans', 100], ['mushroom', 50], ['tomato', 50], ['bread', 56], ['potato', 60]], F('oil', 12, 18, 24)), // CoFID/UK chains: full English ≈ 800-1000 kcal
  D('avocado_toast', 'Avocado toast (sourdough, 1 egg)', 'avocado toast avo toast smashed avocado avocado', 'bread', 'plate', 205, null, [['bread', 70], ['avocado', 80], ['egg', 50], ['spices', 2]], F('oil', 3, 5, 7)), // café values 350-500 kcal
  D('bagel_cream_cheese', 'Bagel with cream cheese', 'bagel bagels cream cheese bagel', 'bread', 'bagel', 130, null, [['bagel', 100], ['creamCheese', 30]], NOFAT), // Starbucks plain bagel 280 + cream cheese 100
  D('oatmeal', 'Oatmeal / porridge (with milk)', 'oatmeal oats porridge overnight oats', 'sweet', 'bowl', 260, null, [['oats', 50], ['milk', 200], ['honey', 10]], NOFAT), // FNDDS oatmeal with milk ~120 kcal/100 g
  D('granola_yogurt', 'Granola with yogurt (parfait)', 'granola parfait yogurt bowl yoghurt granola muesli', 'sweet', 'bowl', 260, null, [['granola', 50], ['greekYogurt', 150], ['honey', 10], ['berries', 50]], NOFAT), // café parfaits 300-450 kcal
  D('cereal_milk', 'Cereal with milk (cornflakes)', 'cereal cornflakes corn flakes cereal milk', 'sweet', 'bowl', 245, null, [['cornflakes', 40], ['milk', 200], ['sugar', 5]], NOFAT), // 40 g flakes + 200 ml whole milk ≈ 280
  D('peanut_butter_toast', 'Peanut butter toast (2 slices)', 'peanut butter toast pb toast peanut butter sandwich', 'bread', 'serving', 88, null, [['bread', 56], ['peanutButter', 32]], NOFAT), // 2 slices (SR) + 2 tbsp peanut butter (SR) ≈ 340
  D('muffin', 'Muffin (blueberry / chocolate)', 'muffin muffins blueberry muffin chocolate muffin cupcake', 'sweet', 'muffin', 115, null, [['maida', 45], ['sugar', 25], ['egg', 15], ['milk', 20], ['berries', 15]], F('oil', 16, 16, 16)), // FNDDS blueberry muffin 377 kcal/100 g; Starbucks 360 (113 g)
  D('cinnamon_roll', 'Cinnamon roll', 'cinnamon roll cinnamon bun cinnabon', 'sweet', 'roll', 120, null, [['maida', 50], ['sugar', 25], ['milk', 20], ['egg', 8], ['creamCheese', 10]], F('butter', 15, 15, 15)), // FNDDS frosted cinnamon roll 372 kcal/100 g
  D('banana_bread', 'Banana bread (slice)', 'banana bread banana loaf banana cake', 'sweet', 'slice', 100, null, [['maida', 30], ['banana', 35], ['sugar', 20], ['egg', 10], ['nuts', 5]], F('butter', 10, 10, 10)), // FNDDS banana bread 326 kcal/100 g
  // Mains
  D('steak', 'Steak with sauce and veg', 'steak beef steak tenderloin sirloin ribeye rib eye pepper steak mushroom steak', 'fastfood', 'plate', 290, ['beefSteak', 230], [['cream', 25], ['mixedVeg', 80], ['spices', 3]], F('butter', 5, 8, 12)), // ~170 g cooked steak (SR sirloin) + sauce + veg ≈ 550-600; fries or mash logged on their own
  D('fish_and_chips', 'Fish and chips', 'fish and chips fish chips fish n chips battered fish', 'fastfood', 'plate', 400, ['fish', 180], [['maida', 30], ['potato', 250], ['mayo', 25]], F('oil', 22, 30, 36)), // CoFID fish & chips ~200-250 kcal/100 g; a plate ≈ 800-1000
  D('roast_chicken', 'Roast chicken (quarter, with potatoes)', 'roast chicken roasted chicken rotisserie chicken', 'fastfood', 'plate', 380, ['chickenSkin', 200], [['potato', 150], ['mixedVeg', 80], ['maida', 5]], F('oil', 8, 12, 16)), // FNDDS roast chicken w/ skin ~220 kcal/100 g + roast potatoes ≈ 700
  D('spaghetti_bolognese', 'Spaghetti bolognese', 'spaghetti bolognese bolognaise spag bol meat sauce pasta mince pasta', 'fastfood', 'plate', 400, ['beefMince', 100], [['pasta', 90], ['tomato', 120], ['onion', 30], ['cheese', 10]], F('oil', 6, 10, 12)), // CoFID 130-160 kcal/100 g; restaurant plates 650-850
  D('pasta_arrabbiata', 'Penne arrabbiata (red sauce pasta)', 'arrabbiata arrabiata arabiata penne red sauce pasta tomato pasta marinara', 'fastfood', 'plate', 380, null, [['pasta', 100], ['tomato', 150], ['garlic', 5], ['cheese', 8], ['spices', 3]], F('oil', 10, 15, 18)), // restaurant penne arrabbiata 500-650 kcal
  D('mac_and_cheese', 'Mac and cheese', 'mac and cheese mac n cheese macaroni cheese mac cheese macaroni', 'fastfood', 'plate', 330, null, [['pasta', 80], ['cheese', 50], ['milk', 100], ['maida', 8]], F('butter', 8, 10, 12)), // FNDDS homemade 200-220 kcal/100 g
  D('chicken_parmesan', 'Chicken parmesan (with spaghetti)', 'chicken parmesan chicken parmigiana chicken parm parmigiana', 'fastfood', 'plate', 430, ['chickenBreast', 180], [['maida', 25], ['egg', 10], ['mozzarella', 40], ['tomato', 80], ['pasta', 60]], F('oil', 12, 18, 22)), // restaurant plates 800-1100 kcal
  D('chicken_wrap', 'Chicken wrap (tortilla)', 'wrap tortilla wrap grilled chicken wrap crispy wrap', 'fastfood', 'wrap', 260, ['chickenBreast', 100], [['tortilla', 70], ['cabbage', 30], ['tomato', 20], ['mayo', 20], ['cheese', 15]], F('oil', 3, 5, 7)), // café grilled chicken wraps 450-600 kcal
  D('panini', 'Panini (chicken and cheese)', 'panini panino ciabatta pesto panini', 'fastfood', 'panini', 240, ['chickenBreast', 70], [['bread', 90], ['mozzarella', 40], ['mayo', 12], ['capsicum', 30]], F('butter', 4, 6, 8)), // Costa/Pret paninis 450-600 kcal
  D('grilled_sandwich', 'Grilled sandwich', 'grilled sandwich grill sandwich toastie toasted sandwich chicken cheese sandwich', 'fastfood', 'sandwich', 200, ['chicken', 60], [['bread', 70], ['cheese', 25], ['mayo', 15], ['cabbage', 15], ['tomato', 10]], F('butter', 6, 8, 10)), // café values 450-550 kcal
  D('hot_dog', 'Hot dog', 'hot dog hotdog', 'fastfood', 'hot dog', 160, ['sausage', 75], [['bun', 60], ['ketchup', 15], ['onion', 10]], F('oil', 2, 3, 4)), // FNDDS hot dog in bun ~290 (45 g sausage); jumbo café sausage ≈ 400
  D('caesar_salad', 'Chicken Caesar salad', 'caesar salad caesar cesar salad chicken caesar', 'side', 'plate', 300, ['chickenBreast', 100], [['cabbage', 150], ['bread', 25], ['cheese', 12], ['mayo', 30]], F('oil', 2, 4, 6)), // restaurant chicken Caesar 450-700 kcal
  D('greek_salad', 'Greek salad', 'greek salad horiatiki feta salad', 'side', 'plate', 330, null, [['cucumber', 100], ['tomato', 100], ['onion', 20], ['capsicum', 30], ['feta', 50], ['olives', 20]], F('oil', 10, 14, 18)), // restaurant Greek salad 300-450 kcal
  D('poke_bowl', 'Poke bowl (salmon, rice)', 'poke poké poke bowl salmon bowl tuna poke', 'fastfood', 'bowl', 420, ['salmon', 100], [['rice', 75], ['avocado', 40], ['cucumber', 40], ['soySauce', 15], ['mayo', 10], ['sesame', 3]], NOFAT), // poke chains 500-750 kcal
  D('quesadilla', 'Chicken quesadilla', 'quesadilla quesadillas', 'fastfood', 'plate', 280, ['chicken', 80], [['tortilla', 90], ['cheese', 60], ['capsicum', 20], ['onion', 10], ['cream', 15]], F('oil', 4, 6, 8)), // chain chicken quesadillas 600-900 kcal
  D('burrito', 'Chicken burrito', 'burrito burritos burrito bowl', 'fastfood', 'burrito', 420, ['chicken', 100], [['tortilla', 100], ['rice', 40], ['rajma', 25], ['cheese', 25], ['cream', 20], ['tomato', 40], ['cabbage', 20]], F('oil', 4, 5, 7)), // Chipotle chicken burrito ~1,000; café burritos 700-900
  D('tacos', 'Tacos (2, chicken or beef)', 'taco tacos', 'fastfood', 'plate', 230, ['chicken', 80], [['tortilla', 60], ['cheese', 20], ['cabbage', 20], ['tomato', 20], ['cream', 15]], F('oil', 3, 5, 7)), // 2 soft tacos 400-500 kcal
  D('nachos', 'Nachos (loaded, with cheese)', 'nachos nacho loaded nachos', 'fastfood', 'plate', 260, ['chicken', 50], [['tortillaChips', 80], ['cheese', 40], ['milk', 20], ['tomato', 40], ['cream', 20]], NOFAT), // FNDDS nachos with cheese ~300 kcal/100 g
  D('sushi_roll', 'Sushi roll (8 pieces)', 'sushi sushi roll maki california roll philadelphia roll uramaki', 'snack', 'roll', 230, ['salmon', 40], [['rice', 60], ['sugar', 4], ['avocado', 15], ['creamCheese', 15], ['cucumber', 15], ['soySauce', 10]], NOFAT), // California roll 8 pc ~260, Philadelphia roll ~400; sushi 150-200 kcal/100 g
  D('ramen', 'Ramen (chicken)', 'ramen raman ramen noodles japanese noodle soup', 'fastfood', 'bowl', 550, ['chicken', 80], [['pasta', 90], ['egg', 50], ['mixedVeg', 40], ['soySauce', 15]], F('oil', 6, 10, 14)), // ramen bowls 450-900 kcal (tonkotsu richest)
  D('pad_thai', 'Pad thai (chicken)', 'pad thai phad thai thai noodles', 'fastfood', 'plate', 380, ['chicken', 80], [['riceNoodles', 90], ['egg', 30], ['peanuts', 15], ['sugar', 15], ['soySauce', 15], ['mixedVeg', 50]], F('oil', 10, 15, 20)), // restaurant pad thai 700-1000 kcal
  D('teriyaki_chicken_rice', 'Teriyaki chicken with rice', 'teriyaki chicken teriyaki rice teriyaki bowl', 'fastfood', 'plate', 420, ['chicken', 150], [['rice', 80], ['soySauce', 20], ['sugar', 15], ['mixedVeg', 60], ['sesame', 3]], F('oil', 6, 10, 12)), // chain teriyaki bowls 600-750 kcal
  D('dumplings', 'Dumplings / momos (6)', 'dumplings dumpling momos momo dim sum dimsum wontons gyoza', 'snack', 'plate', 210, ['chickenMince', 80], [['maida', 60], ['cabbage', 30], ['onion', 10], ['soySauce', 10]], F('oil', 3, 5, 10)), // steamed chicken dumplings ~55-65 kcal each
  D('thai_green_curry', 'Thai green curry with rice', 'thai green curry green curry thai curry red curry', 'fastfood', 'plate', 480, ['chicken', 120], [['coconutMilk', 120], ['mixedVeg', 60], ['sugar', 5], ['spices', 8], ['rice', 75]], F('oil', 5, 8, 12)), // restaurant green curry + jasmine rice 700-900 kcal
  D('mashed_potatoes', 'Mashed potatoes', 'mashed potatoes mashed potato mash potato potato mash', 'side', 'portion', 220, null, [['potato', 200], ['milk', 30]], F('butter', 8, 12, 15)), // SR mashed potato w/ milk & butter 113 kcal/100 g
  D('tomato_soup', 'Tomato soup (cream of tomato)', 'tomato soup cream of tomato', 'side', 'bowl', 300, null, [['tomato', 250], ['onion', 30], ['cream', 20], ['sugar', 5]], F('butter', 4, 6, 8)), // CoFID cream of tomato ~50-60 kcal/100 g
  D('cream_soup', 'Cream of mushroom / chicken soup', 'cream soup cream of mushroom mushroom soup cream of chicken', 'side', 'bowl', 300, ['chicken', 30], [['mushroom', 80], ['milk', 150], ['cream', 25], ['maida', 10]], F('butter', 6, 8, 10)), // restaurant cream soups 250-400 kcal a bowl
  D('grilled_fish', 'Grilled fish (fillet, with veg and mash)', 'grilled fish fish fillet grilled fillet lemon butter fish grilled salmon fish steak', 'fastfood', 'plate', 380, ['fish', 200], [['mixedVeg', 100], ['potato', 120], ['milk', 20], ['cream', 15]], F('butter', 8, 12, 16)), // restaurant grilled fish plates 450-600 kcal
  D('peri_peri_chicken', 'Peri peri chicken (quarter)', 'peri peri piri piri peri peri chicken nandos flame grilled chicken', 'bbq', 'quarter', 140, ['chickenSkin', 150], [['spices', 3]], F('oil', 3, 5, 7)), // Nando's UK 1/4 chicken leg 336 kcal (no sides)
  D('shakshuka', 'Shakshuka (2 eggs)', 'shakshuka shakshouka eggs in tomato', 'egg', 'plate', 330, ['egg', 100], [['tomato', 200], ['capsicum', 50], ['onion', 40], ['spices', 4]], F('oil', 10, 14, 18)), // café shakshuka 300-450 kcal without bread
  D('chilli_chicken', 'Chilli chicken (dry, with veg)', 'chilli chicken chili chicken chicken chilli dry kung pao chicken kung pao szechuan chicken dragon chicken', 'fastfood', 'plate', 300, ['chicken', 150], [['capsicum', 60], ['onion', 40], ['maida', 15], ['soySauce', 15], ['sugar', 8], ['ketchup', 10]], F('oil', 12, 18, 22)), // restaurant chilli / kung pao chicken 450-650 kcal a plate (no rice)
  D('miso_soup', 'Miso soup', 'miso soup miso', 'side', 'bowl', 250, null, [['miso', 15], ['tofu', 30], ['onion', 5]], NOFAT), // FNDDS miso soup ~40 kcal a cup
  D('lamb_shank', 'Lamb shank (braised, with mash)', 'lamb shank braised lamb shank lamb shanks', 'fastfood', 'plate', 480, ['lamb', 250], [['potato', 150], ['milk', 20], ['onion', 30], ['tomato', 40], ['carrot', 30], ['spices', 4]], F('oil', 8, 12, 16)), // restaurant lamb shank with mash 800-1100 kcal
  D('fried_calamari', 'Fried calamari (starter)', 'calamari fried calamari squid rings fried squid', 'fried', 'plate', 230, ['squid', 150], [['maida', 30], ['mayo', 25]], F('oil', 14, 18, 22)), // chain fried calamari starters 500-700 kcal with dip
  D('mozzarella_sticks', 'Mozzarella sticks (6)', 'mozzarella sticks cheese sticks mozzarella fingers', 'fried', 'plate', 190, null, [['mozzarella', 120], ['maida', 30], ['egg', 10], ['ketchup', 30]], F('oil', 12, 14, 16)), // FNDDS fried mozzarella sticks ~320 kcal/100 g
  D('creme_brulee', 'Crème brûlée', 'creme brulee crème brûlée burnt cream', 'sweet', 'ramekin', 120, null, [['cream', 70], ['egg', 20], ['sugar', 18], ['milk', 10]], NOFAT), // restaurant crème brûlée 330-400 kcal
  D('tom_yum', 'Tom yum soup', 'tom yum tom yam tomyum thai soup', 'side', 'bowl', 350, ['chicken', 60], [['mushroom', 50], ['tomato', 40], ['sugar', 5], ['soySauce', 15], ['spices', 5]], F('oil', 2, 3, 5)), // clear tom yum 100-200 kcal a bowl
  D('crepe', 'Crêpe (Nutella / chocolate)', 'crepe crepes crêpe nutella crepe chocolate crepe', 'sweet', 'plate', 175, null, [['maida', 40], ['milk', 70], ['egg', 25], ['sugar', 5], ['hazelnutSpread', 35]], F('butter', 5, 6, 8)), // café Nutella crêpes 450-600 kcal
  D('sundae', 'Ice cream sundae', 'sundae sundaes hot fudge sundae', 'sweet', 'cup', 200, null, [['iceCream', 150], ['chocSauce', 30], ['cream', 15], ['nuts', 5]], NOFAT), // McDonald's hot fudge sundae 330 (180 g); café sundaes 450-550
  D('mint_lemonade', 'Mint lemonade (mint margarita)', 'mint lemonade mint margarita lemonade pudina lemonade podina margarita', 'drink', 'glass', 350, null, [['sugar', 40], ['parsley', 5]], NOFAT), // café mint margarita, sweetened: ~40-50 kcal/100 ml
  D('bubble_tea', 'Bubble tea (milk tea, pearls)', 'bubble tea boba boba tea pearl milk tea tapioca tea', 'drink', 'cup', 450, null, [['milk', 150], ['tapioca', 25], ['sugar', 25], ['cream', 10]], NOFAT), // Chatime / Boba Guys milk tea with pearls 300-450 kcal
  D('malai_boti', 'Malai tikka boti platter (8 pieces)', 'malai boti platter malai tikka reshmi boti cream boti platter', 'bbq', 'plate', 170, ['chickenBreast', 200], [['cream', 30], ['cheese', 10], ['dahi', 20], ['spices', 3]], F('oil', 8, 12, 16)), // FatSecret / restaurant malai boti 250-300 kcal/100 g
  D('risotto', 'Risotto (mushroom / chicken)', 'risotto mushroom risotto chicken risotto', 'fastfood', 'plate', 380, ['chicken', 60], [['rice', 90], ['mushroom', 60], ['cheese', 20], ['cream', 20], ['onion', 20]], F('butter', 10, 14, 18)), // restaurant risotto 600-800 kcal
  D('doner_kebab', 'Doner kebab (wrap / roll)', 'doner döner doner kebab doner roll doner wrap durum turkish kebab', 'fastfood', 'wrap', 300, ['beefMince', 110], [['pita', 90], ['cabbage', 30], ['tomato', 20], ['onion', 10], ['mayo', 20]], F('oil', 4, 6, 8)), // CoFID doner in pitta ~230-250 kcal/100 g; wraps 600-900
  D('greek_yogurt', 'Greek yogurt (low fat)', 'greek yogurt greek yoghurt strained yogurt', 'side', 'katori', 170, null, [['greekYogurt', 170]], NOFAT),
  // Desserts
  D('cheesecake', 'Cheesecake (slice)', 'cheesecake cheese cake new york cheesecake baked cheesecake', 'sweet', 'slice', 115, null, [['creamCheese', 55], ['sugar', 15], ['egg', 12], ['cream', 10], ['maida', 12]], F('butter', 6, 6, 6)), // SR cheesecake 321 kcal/100 g; café slice 350-450
  D('brownie', 'Chocolate brownie', 'brownie brownies fudge brownie', 'sweet', 'piece', 80, null, [['maida', 15], ['sugar', 25], ['chocolate', 20], ['egg', 10]], F('butter', 12, 12, 12)), // SR brownie 466 kcal/100 g
  D('chocolate_chip_cookie', 'Chocolate chip cookie (large)', 'chocolate chip cookie cookie choc chip cookie', 'sweet', 'cookie', 60, null, [['maida', 22], ['sugar', 18], ['chocolate', 10], ['egg', 4]], F('butter', 11, 11, 11)), // SR chocolate chip cookie 488 kcal/100 g
  D('tiramisu', 'Tiramisu', 'tiramisu tiramisù', 'sweet', 'slice', 120, null, [['mascarpone', 35], ['cream', 15], ['sugar', 15], ['egg', 15], ['maida', 15]], NOFAT), // FNDDS tiramisu 283 kcal/100 g
  D('lava_cake', 'Molten lava cake', 'lava cake chocolate lava cake molten cake choco lava fondant', 'sweet', 'cake', 100, null, [['chocolate', 30], ['sugar', 15], ['egg', 25], ['maida', 8]], F('butter', 15, 15, 15)), // café/chain lava cakes 350-420 kcal (100 g, without ice cream)
  // Café drinks
  D('americano', 'Americano', 'americano black coffee long black filter coffee', 'drink', 'cup', 350, null, [['espresso', 60]], NOFAT, { topping: ['milk', 30, 'Splash of milk'] }), // 2 shots in hot water: ~5 kcal (SR espresso 9 kcal/100 g)
  D('espresso', 'Espresso (shot)', 'espresso expresso doppio ristretto', 'drink', 'shot', 30, null, [['espresso', 30]], NOFAT), // SR espresso 9 kcal/100 g
  D('mocha', 'Caffè mocha', 'mocha cafe mocha caffe mocha mochaccino', 'drink', 'cup', 350, null, [['milk', 250], ['chocSauce', 25], ['espresso', 60], ['cream', 15]], NOFAT), // Starbucks grande mocha 2% w/ whip 370; whole milk ≈ 280-300
  D('hot_chocolate', 'Hot chocolate', 'hot chocolate hot choc drinking chocolate cocoa', 'drink', 'cup', 350, null, [['milk', 260], ['chocSauce', 30], ['cream', 15]], NOFAT), // Starbucks grande 2% w/ whip 370; Costa medium ≈ 300
  D('matcha_latte', 'Matcha latte', 'matcha matcha latte green tea latte', 'drink', 'cup', 350, null, [['milk', 250], ['sugar', 15]], NOFAT), // Starbucks grande matcha latte 2% 240
  D('iced_tea', 'Iced tea (sweetened)', 'iced tea ice tea peach iced tea lemon iced tea', 'drink', 'glass', 400, null, [['sugar', 32]], NOFAT), // bottled/café iced tea ~30 kcal/100 ml
  D('smoothie', 'Smoothie (fruit and yogurt)', 'smoothie smoothies fruit smoothie berry smoothie mango smoothie banana smoothie', 'drink', 'glass', 420, null, [['banana', 80], ['mango', 80], ['berries', 60], ['dahi', 120], ['milk', 60], ['honey', 15]], NOFAT), // café smoothies (16 oz) 250-350 kcal
];
export const DISH = Object.fromEntries(DISHES.map(d => [d.id, d]));
const fam = (name, ids) => FAM(name, ids.map(id => DISH[id]));
fam('Bread', ['roti', 'khubz', 'kerala_parotta', 'khameer', 'regag', 'chapati_thin', 'tandoori_roti', 'naan', 'garlic_naan', 'roghni_naan', 'kulcha', 'taftan', 'sheermal', 'paratha', 'lachha_paratha', 'aloo_paratha', 'anda_paratha', 'puri', 'makki_roti', 'bakarkhani', 'bread_slice']);
fam('Rice', ['plain_rice', 'zeera_rice', 'matar_pulao', 'chicken_pulao', 'beef_pulao', 'chicken_biryani', 'mutton_biryani', 'khichdi']);
fam('Daal', ['daal_masoor', 'daal_moong', 'daal_chana', 'daal_mash', 'daal_makhani', 'rajma', 'cholay']);
fam('Chicken salan', ['chicken_karahi', 'chicken_handi', 'chicken_qorma', 'chicken_salan', 'chicken_jalfrezi', 'butter_chicken']);
fam('Mutton and beef', ['mutton_karahi', 'mutton_qorma', 'aloo_gosht', 'palak_gosht', 'nihari', 'haleem', 'qeema', 'qeema_matar']);
fam('Kebab', ['seekh_kebab', 'chapli_kebab', 'shami_kebab']);
fam('Chicken tikka', ['chicken_tikka', 'chicken_tikka_chest', 'chicken_boti', 'malai_boti']);
fam('Pizza', ['pizza_slice', 'cheesy_pizza_slice']);
fam('Pasta', ['creamy_pasta', 'spaghetti_bolognese', 'pasta_arrabbiata', 'mac_and_cheese', 'lasagna', 'chicken_parmesan']);
fam('Asian (café)', ['chow_mein', 'chilli_chicken', 'ramen', 'pad_thai', 'teriyaki_chicken_rice', 'thai_green_curry', 'dumplings', 'sushi_roll', 'poke_bowl']);
fam('Burger', ['zinger_burger', 'mighty_zinger', 'beef_burger', 'chicken_burger', 'anda_shami_burger', 'bun_kebab']);
fam('Fried chicken', ['fried_chicken', 'broast', 'nuggets', 'wings']);
fam('Mithai', ['mithai', 'laddu', 'gulab_jamun', 'sohan_halwa']);
fam('Eggs', ['boiled_egg', 'anda_fry', 'omelette', 'scrambled_eggs', 'anda_curry']);
fam('Breakfast (café)', ['pancakes', 'waffles', 'french_toast', 'eggs_benedict', 'english_breakfast', 'avocado_toast', 'shakshuka', 'bagel_cream_cheese', 'peanut_butter_toast', 'oatmeal', 'granola_yogurt', 'cereal_milk']);
fam('Sandwiches and wraps', ['club_sandwich', 'grilled_sandwich', 'panini', 'sub_6', 'chicken_wrap', 'doner_kebab', 'hot_dog']);
fam('Mexican', ['burrito', 'tacos', 'quesadilla', 'nachos']);
fam('Café mains', ['steak', 'grilled_chicken_meal', 'roast_chicken', 'peri_peri_chicken', 'grilled_fish', 'fish_and_chips', 'lamb_shank', 'risotto']);
fam('Starters (café)', ['fried_calamari', 'mozzarella_sticks', 'onion_rings', 'garlic_bread']);
fam('Salads', ['salad', 'caesar_salad', 'greek_salad']);
fam('Soups', ['corn_soup', 'tomato_soup', 'cream_soup', 'miso_soup', 'tom_yum']);
fam('Desserts (café)', ['cheesecake', 'brownie', 'tiramisu', 'lava_cake', 'creme_brulee', 'crepe', 'sundae', 'cake_slice', 'chocolate_chip_cookie', 'muffin', 'cinnamon_roll', 'banana_bread', 'croissant', 'donut']);
fam('Gulf rice', ['chicken_mandi', 'lamb_mandi', 'chicken_machboos', 'lamb_machboos', 'fish_machboos', 'chicken_kabsa', 'chelo_rice']);
fam('Arabic grill', ['shish_tawook', 'mixed_grill', 'koobideh_kebab', 'joojeh_kebab']);
fam('Manakish', ['manakish_zaatar', 'manakish_cheese', 'manakish_meat']);
fam('Mezze', ['hummus', 'mutabbal', 'labneh', 'foul_medames', 'fattoush', 'tabbouleh', 'falafel']);
fam('Coffee', ['latte', 'cappuccino', 'flat_white', 'spanish_latte', 'iced_latte', 'caramel_macchiato', 'frappuccino', 'iced_capp', 'coffee_cream_sugar', 'americano', 'espresso', 'mocha', 'hot_chocolate', 'matcha_latte']);
fam('Lassi and drinks', ['chai', 'chai_no_sugar', 'karak_chai', 'sugarcane_juice', 'sweet_lassi', 'salted_lassi', 'milkshake', 'smoothie', 'mint_lemonade', 'bubble_tea', 'iced_tea', 'cola']);
export const family = d => (d?.fam ? DISHES.filter(x => x.fam === d.fam) : []);

// "1½ katori (≈300 g)", "2 rotis". Containers show grams so people can check against a scale.
export function serveLabel(d, n = 1) {
  const u = d.serve, many = n > 1 && u !== 'katori';
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
export const hasOilChoice = d => hasFatChoice(d) && ['curry', 'rice'].includes(d.kind);

// One dish → nutrition. opts: servings, grams (overrides servings), style, meat, oil, size, topping,
// styleKnown (the user picked who cooked it — narrows the range), portionSd (photo portions are vaguer).
// The raw ingredients behind one logged dish, in grams for the whole portion. Shared by the calorie
// estimate and the weekly report (which counts veg, dairy, lentils and fish from the same numbers).
export function dishParts(d, opts = {}) {
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
  const fat = [[d.fat.type, fatG]];
  if (opts.topping && d.topping) fat.push([d.topping[0], d.topping[1]]);
  return {
    servings,
    meat: d.meat ? [[d.meat[0], d.meat[1] * meatF * servings]] : [],
    base: d.base.map(([ing, g]) => [ing, g * gravyF * servings]),
    fat: fat.map(([ing, g]) => [ing, g * servings]),
  };
}
const total = list => list.reduce((a, [ing, g]) => sum(a, nut(ing, g)), [0, 0, 0, 0, 0]);

// One dish → nutrition. opts: servings, grams (overrides servings), style, meat, oil, size, topping,
// styleKnown (the user picked who cooked it — narrows the range), portionSd (photo portions are vaguer).
export function estimateDish(d, opts = {}) {
  const P = dishParts(d, opts), servings = P.servings;
  const meat = total(P.meat), fat = total(P.fat), all = sum(sum(meat, total(P.base)), fat);
  const kcal = all[0], fatKcal = fat[0], meatKcal = meat[0];

  // Likely range (about ±1 SD): portion error on everything, plus fat error, plus meat-share error.
  const portionSd = opts.portionSd ?? (['curry', 'rice', 'side', 'snack'].includes(d.kind) || ['plate', 'portion'].includes(d.serve) ? 0.2 : 0.1);
  const fatSd = hasFatChoice(d) ? (opts.styleKnown ? 0.25 : 0.4) : 0;
  const sd = Math.sqrt((portionSd * kcal) ** 2 + (fatSd * fatKcal) ** 2 + (0.15 * meatKcal) ** 2);
  return {
    ...pack(all), grams: d.cooked * servings,
    low: round10(Math.max(0, kcal - sd)), high: round10(kcal + sd),
    parts: { fat: fatKcal, meat: meatKcal, rest: kcal - fatKcal - meatKcal },
    fatLabel: (opts.topping && d.topping ? FATS[d.topping[0]] : FATS[d.fat.type]) || 'Fat',
    fatGrams: P.fat.reduce((a, [, g]) => a + g, 0),
  };
}
const round10 = v => Math.round(v / 10) * 10;

// Food groups for the weekly report. Potatoes count as starch, not veg (WHO 5-a-day rule).
export const GROUP = {
  veg: ['onion', 'tomato', 'spinach', 'sarson', 'peas', 'okra', 'cauliflower', 'carrot', 'capsicum', 'cucumber', 'mixedVeg', 'mushroom'],
  fruit: ['banana', 'apple', 'mango', 'dates', 'berries'],
  dairy: ['dahi', 'milk', 'paneer', 'khoya'],
  legumes: ['masoor', 'moong', 'chanaDal', 'mash', 'kabuli', 'rajma', 'besan'],
  fish: ['fish', 'salmon', 'squid'], redMeat: ['mutton', 'beef', 'beefMince', 'beefSteak', 'lamb'], poultry: ['chicken', 'chickenBreast', 'chickenMince'], egg: ['egg'],
  wholeGrain: ['atta', 'dalia', 'oats', 'makki'], refined: ['maida', 'rice', 'suji', 'vermicelli', 'bread'],
  sugar: ['sugar'], nuts: ['nuts'], fat: ['oil', 'ghee', 'butter', 'cream'],
};
export const GROUP_OF = Object.fromEntries(Object.entries(GROUP).flatMap(([g, ids]) => ids.map(id => [id, g])));
// Dairy as milk-equivalent grams (by calcium): paneer and khoya are concentrated milk.
export const MILK_EQ = { dahi: 1, milk: 1, paneer: 3, khoya: 4 };

/** Raw ingredients behind a logged food, [[ingredient, grams]], or null for INDB recipes (no breakdown). */
export function ingredientsOf(ref, opts = {}) {
  if (ref.t === 'dish') { const d = DISH[ref.id]; if (!d) return null; const P = dishParts(d, opts); return [...P.meat, ...P.base, ...P.fat]; }
  if (ref.t === 'ing') return ING[ref.id] ? [[ref.id, opts.grams ?? 100]] : null;
  return null;
}

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
  if (ref.t === 'bc') return PRODUCTS[ref.id] && { ref, name: PRODUCTS[ref.id].name, food: PRODUCTS[ref.id] };
  return null;
}
export function estimate(ref, opts = {}) {
  if (ref.t === 'dish') return estimateDish(DISH[ref.id], opts);
  if (ref.t === 'indb') return estimateIndb(INDB_BY[ref.id], opts);
  if (ref.t === 'bc') return PRODUCTS[ref.id] ? estimateProduct(PRODUCTS[ref.id], opts) : { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, grams: 0, low: 0, high: 0, parts: { fat: 0, meat: 0, rest: 0 } };
  return estimateIng(ref.id, opts.grams ?? 100);
}

// Packaged foods from a barcode (Open Food Facts). Label values are per 100 g, so they're precise.
const PRODUCTS = {};
export const registerProduct = p => { if (p?.code) PRODUCTS[p.code] = p; return p; };
export function estimateProduct(p, opts = {}) {
  const grams = opts.grams ?? (opts.servings ?? 1) * (p.servingG || 100), m = grams / 100, v = p.per100;
  const k = v.kcal * m;
  return { kcal: k, protein: v.protein * m, carbs: v.carbs * m, fat: v.fat * m, fibre: (v.fibre || 0) * m, grams,
    low: round10(k * 0.95), high: round10(k * 1.05), parts: { fat: v.fat * m * 9, meat: 0, rest: k - v.fat * m * 9 } };
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
// Daily movement from the job (Mifflin-St Jeor × these is the standard sedentary-to-active scale), and
// each training session's net cost: ~4 kcal per kg for an hour of weights and some cardio (MET ≈ 5, minus rest).
export const JOBS = [
  { id: 'desk', label: 'Desk job or student', f: 1.2 },
  { id: 'feet', label: 'On my feet a lot (teacher, shop, nurse)', f: 1.35 },
  { id: 'physical', label: 'Physical work (labour, delivery, farm)', f: 1.5 },
];
const SESSION_KCAL_PER_KG = 4;
export const kcalFloor = (sex, bmr) => Math.max(sex === 'female' ? 1200 : 1500, Math.round(bmr * 0.9));
export function maintenance(p) {
  const w = +p.weightKg, h = +p.heightCm, a = +p.age;
  if (!(w > 30 && h > 120 && a >= 14)) return null;
  const bmr = 10 * w + 6.25 * h - 5 * a + (p.sex === 'female' ? -161 : 5);
  const job = JOBS.find(j => j.id === p.job);
  // Until the client says what their job is and how often they train, the older single activity setting applies.
  const tdee = job ? bmr * job.f + Math.min(7, Math.max(0, +p.trainDays || 0)) * SESSION_KCAL_PER_KG * w / 7
    : bmr * ({ low: 1.375, mid: 1.55, high: 1.725 }[p.activity] || 1.55);
  return { bmr, tdee };
}
export function targets(p) {
  const m = maintenance(p); if (!m) return null;
  const w = +p.weightKg, { bmr, tdee } = m;
  const dg = dietGoal(p), goal = { lose: -0.2, maintain: 0, gain: 0.1 }[dg];
  // kcalAdjust comes from the two-weekly check-ins (js/adapt.js): bodies adapt, so targets move with the scale.
  // Safety floor: 90% of resting burn, and never under 1,500 (men) / 1,200 (women) kcal.
  const floor = kcalFloor(p.sex, bmr);
  const kcal = Math.max(Math.round(floor / 10) * 10, Math.round((tdee * (1 + goal) + (+p.kcalAdjust || 0)) / 10) * 10);
  // Protein per kg uses a reference weight when BMI is over 30: at 130 kg, 2 g/kg of total weight would be 260 g,
  // far more than the lean mass needs. Reference = weight at BMI 25 plus 40% of the excess. Also never over 35% of kcal.
  const hM = +p.heightCm / 100, bmi = hM ? w / (hM * hM) : 0;
  const refW = bmi > 30 ? 25 * hM * hM + 0.4 * (w - 25 * hM * hM) : w;
  const protein = Math.round(Math.min(refW * (dg === 'lose' ? 2.0 : 1.8), kcal * 0.35 / 4));
  const fat = Math.round(kcal * 0.27 / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, fat, carbs, bmr: Math.round(bmr), tdee: Math.round(tdee), adjust: +p.kcalAdjust || 0, floor: Math.round(floor / 10) * 10 };
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
