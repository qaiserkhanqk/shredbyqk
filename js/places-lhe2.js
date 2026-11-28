// Lahore round 2: street vendors, nashta and BBQ shops, dessert places, bakeries, cafés and fine dining not already in
// places-local.js / places-lhe.js. Researched Nov 2026 from Dawn (Epicurious and Eating Out columns), Express Tribune,
// The News, Daily Times, Arab News, Zameen, Graana, Wanderlog place pages (Google reviews), foodpanda listings and
// dnd.com.pk (the source for each place is in `url`). Each item is a QK estimate from the closest dish model unless it
// has `official` values (none of these publish nutrition). Places marked `check` were weakly sourced or possibly closed.
const I = (name, dish, opts = {}, official = null) => ({ name, dish, opts, ...(official ? { official } : {}) });
const R = { style: 'restaurant', styleKnown: true }, S = { style: 'shaadi', styleKnown: true };
const O = (kcal, protein, carbs, fat, source, url) => ({ kcal, protein, carbs, fat, source, url }); // eslint-disable-line no-unused-vars
const P = (id, name, city, area, url, items, extra = {}) => ({ id, name, type: 'Local', city, area, url, items, ...extra });
const W = (id) => `https://wanderlog.com/place/details/${id}`;
const FP = (id) => `https://www.foodpanda.pk/restaurant/${id}`;

export const LHE2_PLACES = [
  // Nashta: paye, murgh chanay, daal, nihari
  P('goga-naqibia-lhe2', 'Goga Naqibia Murgh Chanay & Bong Paaye', 'Lahore', 'Barkat Market, New Garden Town', 'https://www.dawn.com/news/1748702', [
    I('Murgh chanay (plate)', 'cholay', { ...S, servings: 1.3 }), I('Bong paaye (bowl)', 'paye', S),
    I('Khamiri naan', 'naan', R), I('Kulcha', 'kulcha', R)]),
  P('marhaba-bong-paaye-lhe2', 'Marhaba Bong Paaye & Naan Shop', 'Lahore', 'Androon Shehr (Walled City)', 'https://images.dawn.com/news/1189394', [
    I('Bakray kay paaye (bowl)', 'paye', S), I('Chholay', 'cholay', S), I('Naan', 'naan', R), I('Paratha', 'paratha', S)]),
  P('haji-sahab-bong-paye-lhe2', 'Haji Sahab Special Murgh Chanay & Bong Paye', 'Lahore', 'Lahore', FP('xjr7/haji-sahab-special-murgh-chany-and-bong-paye'), [
    I('Murgh chanay (plate)', 'cholay', { ...S, servings: 1.3 }), I('Bong paye (bowl)', 'paye', S), I('Naan', 'naan', R)], { check: true }),
  P('jattay-ki-daal-lhe2', 'Jattay ki Daal', 'Lahore', 'Mozang Adda', 'https://tribune.com.pk/story/1605494/entertainment', [
    I('Daal chana in desi ghee (plate)', 'daal_chana', S), I('Daal chana, large plate', 'daal_chana', { ...S, servings: 1.5 }),
    I('Tandoori roti', 'tandoori_roti', R), I('Naan', 'naan', R)]),
  P('dogar-lhe2', 'Dogar Restaurant', 'Lahore', 'DHA Phase 1 and other branches', FP('z14m/dogar-restaurant-phase-1-dha'), [
    I('Halwa puri nashta', 'halwa_puri', S), I('Nihari plate', 'nihari', S), I('Aloo paratha', 'aloo_paratha', S),
    I('Chicken karahi (per person)', 'chicken_karahi', { ...S, servings: 1.5 })]),
  P('lahori-murgh-pulao-lhe2', 'Lahori Murgh Pulao & Restaurant', 'Lahore', 'Lahore', FP('ifm9/lahori-murgh-pulao-and-restaurant'), [
    I('Murgh pulao (single)', 'chicken_pulao', R), I('Murgh pulao (full)', 'chicken_pulao', { ...R, servings: 1.5 }),
    I('Lahori nashta (halwa puri)', 'halwa_puri', S)], { check: true }),

  // Desi restaurants and buffets
  P('khan-baba-lhe2', 'Khan Baba Restaurant', 'Lahore', 'Chauburji and other branches', W('3258682/khan-baba-restaurant'), [
    I('Mutton desi ghee karahi (per person)', 'mutton_karahi', { ...S, servings: 1.5 }), I('Mutton qorma', 'mutton_qorma', S),
    I('Mutton chops (4 pieces)', 'mutton_chops', { ...S, servings: 4 }), I('Mutton pulao', 'beef_pulao', S),
    I('Daal', 'daal_mash', S), I('Naan', 'naan', R)]),
  P('dera-lhe2', 'Dera Restaurant', 'Lahore', 'Fort Road; Gulberg; Cavalry Ground; Faisal Town', 'https://graana.com/blog/a-guide-to-dera-restaurant-lahore', [
    I('Chicken karahi (per person)', 'chicken_karahi', { ...S, servings: 1.5 }), I('Makhan karahi (per person)', 'chicken_karahi', { ...S, servings: 1.7 }),
    I('Chanp masala (4 chops)', 'mutton_chops', { ...S, servings: 4 }), I('Seekh kebab (2)', 'seekh_kebab', { ...S, servings: 2 }),
    I('Lahori chargha (half)', 'chargha', S), I('Chicken tikka leg', 'chicken_tikka', S), I('Half chicken sajji', 'sajji', { ...S, servings: 2 }),
    I('Makhni handi (half, for 2)', 'chicken_handi', { ...S, servings: 2 }), I('Garlic naan', 'garlic_naan', R)]),
  P('ziafat-lhe2', 'Ziafat', 'Lahore', 'College Road, Gulberg II (buffet)', W('3056562/ziafat'), [
    I('Mutton paya (bowl)', 'paye', R), I('Beef nihari', 'nihari', R), I('Chicken seekh kabab (2)', 'seekh_kebab', { ...R, servings: 2 }),
    I('Chicken qorma', 'chicken_qorma', R), I('Chicken biryani', 'chicken_biryani', R)]),
  P('chandni-chowk-lhe2', 'Chandni Chowk (buffet)', 'Lahore', 'Lahore', 'https://www.zameen.com/blog/top-buffet-restaurants-lahore.html', [
    I('Mutton biryani', 'mutton_biryani', R), I('Mutton palak', 'palak_gosht', R), I('Mutton qeema', 'qeema', R),
    I('Chicken cheese karahi', 'chicken_karahi', { ...R, servings: 1.2 }), I('Beef nihari', 'nihari', R)], { check: true }),
  P('quetta-qabail-lhe2', 'Quetta Qabail', 'Lahore', '46-A MM Alam Road, Gulberg III', W(8946311), [
    I('Chicken namkeen karahi (per person)', 'chicken_karahi', { ...S, servings: 1.5 }), I('Chapli kabab', 'chapli_kebab', S),
    I('Khadi kabab (lamb)', 'lamb_sajji', { ...R, servings: 1.5 }), I('Half chicken sajji', 'sajji', { ...R, servings: 2 }),
    I('Paratha', 'paratha', S), I('Chai', 'chai')]),
  P('saggian-kababish-lhe2', 'Saggian Kababish Restaurant', 'Lahore', 'Saggian', FP('tq4t/saggian-kababish-restaurant-and-caterers'), [
    I('Chicken Shinwari namkeen karahi (half, for 2)', 'chicken_karahi', { ...S, servings: 2.5 }),
    I('Beef Shinwari karahi (half, for 2)', 'mutton_karahi', { ...S, servings: 2.5 }), I('Naan', 'naan', R), I('Tandoori roti', 'tandoori_roti', R)], { check: true }),

  // Taka tak, BBQ, sajji, chargha
  P('kaka-taka-tak-lhe2', "Kaka's Taka Tak", 'Lahore', 'Lakshmi Chowk', 'https://www.dawn.com/news/1252594', [
    I('Mutton taka tak (kidney, heart, brain; plate)', 'kaleji', { ...S, servings: 1.2 }), I('Maghz taka tak (plate)', 'kaleji', { ...S, servings: 1.2 }),
    I('Naan', 'naan', R), I('Raita', 'raita')]),
  P('akram-tikka-lhe2', 'Akram Tikka Shop', 'Lahore', 'Lahore', W('11759391/akram-tikka-shop'), [
    I('Chicken malai boti (seekh)', 'chicken_boti', S), I('Mutton tikka (plate)', 'lamb_tikka', S), I('Chicken tikka leg piece', 'chicken_tikka', S),
    I('Beef kabab (2)', 'seekh_kebab', { ...S, servings: 2 }), I('Chicken karahi (per person)', 'chicken_karahi', { ...S, servings: 1.5 }),
    I('Half chicken sajji', 'sajji', { ...S, servings: 2 })]),
  P('sureela-tikka-lhe2', 'Sureela Tikka', 'Lahore', 'Lahore', W('11759384/sureela-tikka'), [
    I('Beef seekh kabab (2)', 'seekh_kebab', { ...S, servings: 2 }), I('Chicken malai boti (seekh)', 'chicken_boti', S),
    I('Chicken tikka', 'chicken_tikka', S), I('Naan', 'naan', R)]),
  P('golden-chargha-lhe2', 'Golden Chargha', 'Lahore', 'Shalimar Link Road, Mughalpura', FP('u2kk'), [
    I('Full chargha', 'chargha', { ...S, servings: 2 }), I('Half chargha', 'chargha', S), I('Chargha leg piece (quarter)', 'chargha', { ...S, servings: 0.5 }),
    I('Raita', 'raita'), I('Naan', 'naan', R)]),
  P('balochi-sajji-lhe2', 'Balochi Sajji', 'Lahore', 'Gaddafi Road', 'https://www.zameen.com/blog/restaurants-best-desi-food-lahore.html', [
    I('Full chicken sajji', 'sajji', { ...S, servings: 4 }), I('Half chicken sajji', 'sajji', { ...S, servings: 2 }),
    I('Quarter chicken sajji', 'sajji', S), I('Naan', 'naan', R), I('Raita', 'raita')]),
  P('khalifa-sajji-lhe2', 'Khalifa Sajji', 'Lahore', 'Garhi Shahu', 'https://www.zameen.com/blog/restaurants-best-desi-food-lahore.html', [
    I('Full chicken sajji', 'sajji', { ...S, servings: 4 }), I('Half chicken sajji', 'sajji', { ...S, servings: 2 }),
    I('Naan', 'naan', R), I('Raita', 'raita')], { check: true }),
  P('shahenshah-sajji-lhe2', 'Shahenshah Sajji & Grill', 'Lahore', 'Lahore', W('8475073/shahenshah-sajji-and-grill'), [
    I('Full chicken sajji', 'sajji', { ...S, servings: 4 }), I('Half chicken sajji', 'sajji', { ...S, servings: 2 }),
    I('Quarter chicken sajji', 'sajji', S), I('Naan', 'naan', R)], { check: true }),

  // Biryani, street snacks, juice
  P('biryani-qabila-lhe2', 'Biryani Qabila', 'Lahore', 'Seven Street Bazar, near Cavalry Ground', FP('sxzm/biryani-qabila'), [
    I('Beef pulao (single)', 'beef_pulao', R), I('Beef pulao (full)', 'beef_pulao', { ...R, servings: 1.5 }),
    I('Chicken pulao', 'chicken_pulao', R), I('Chicken biryani', 'chicken_biryani', R)]),
  P('gaddafi-samosa-lhe2', 'Gaddafi Sweets Samosa', 'Lahore', 'Mozang', 'https://graana.com/blog/a-walk-through-mozang-chungi-lahore', [
    I('Aloo samosa', 'samosa', S), I('Samosa with chutney (plate of 2)', 'samosa', { ...S, servings: 2 }), I('Samosa chaat', 'samosa_chaat', S)], { check: true }),
  P('hafiz-juice-lhe2', 'Hafiz Fruit & Juice Corner', 'Lahore', 'Old Anarkali Food Street', 'https://www.thefridaytimes.com/28-May-2025/exploring-old-anarkali-food-eateries', [
    I('Fresh juice (glass)', 'fresh_juice'), I('Fruit chaat', 'fruit_chaat'), I('Banana / mango shake', 'milkshake')], { check: true }),

  // Kulfi, falooda, ice cream, desserts
  P('chaman-ice-cream-lhe2', 'Chaman Ice Cream', 'Lahore', 'Beadon Road; Saddar Cantt; Susan Road', FP('c20n/chaman-ice-cream-lahore-c20n'), [
    I('Pistachio ice cream (2 scoops)', 'ice_cream'), I('Almond / tutti frutti ice cream (2 scoops)', 'ice_cream'),
    I('Khajoor akhroot ice cream (2 scoops)', 'ice_cream', { servings: 1.1 }), I('Chaman special falooda', 'falooda'), I('Kulfa', 'kulfi', { servings: 1.5 })]),
  P('benazir-kulfa-lhe2', 'Benazir Kulfa', 'Lahore', 'Lahore', 'https://dailytimes.com.pk/?p=269104', [
    I('Kulfa (plate)', 'kulfi', { servings: 1.5 }), I('Pista kulfi', 'kulfi'), I('Kulfa falooda', 'falooda')], { check: true }),
  P('baba-lahori-rabri-lhe2', 'Baba Lahori Rabri Doodh & Special Kulfa', 'Lahore', 'Lahore', FP('mg7a/baba-lahori-rabri-doodh-and-special-kulfa'), [
    I('Rabri doodh (glass)', 'rabri', { servings: 1.5 }), I('Special kulfa', 'kulfi', { servings: 1.5 }), I('Kulfa falooda', 'falooda')], { check: true }),
  P('lasani-falooda-lhe2', 'Lasani Falooda', 'Lahore', 'Old Anarkali Road, Anarkali Bazaar', 'https://dnd.com.pk/blogs/best-falooda-shops-in-lahore-that-are-a-must-try/', [
    I('Khoya falooda', 'falooda', { servings: 1.3 }), I('Kulfi falooda', 'falooda'), I('Kulfi', 'kulfi')]),
  P('nafees-kasuri-falooda-lhe2', 'MashAllah Nafees Kasuri Faluda', 'Lahore', 'Lahore', W('11870812/mashallah-nafees-kasuri-faluda'), [
    I('Kasuri falooda', 'falooda'), I('Falooda with kulfi & rabri', 'falooda', { servings: 1.3 }), I('Kulfi', 'kulfi')], { check: true }),
  P('hot-spot-lhe2', 'The Hot Spot Café', 'Lahore', 'Gulberg; DHA Phase 2', FP('t7dj/the-hotspot-cafe-gulberg'), [
    I('Hot Spot ice cream (2 scoops)', 'ice_cream'), I('Colombian coffee ice cream (2 scoops)', 'ice_cream'),
    I('Pineapple sundae', 'sundae'), I('Mango supreme', 'sundae', { servings: 1.2 })]),
  P('sweet-factory-lhe2', 'The Sweet Factory', 'Lahore', 'DHA Phase 6; Lake City', W('3635605/the-sweet-factory-lake-city'), [
    I('Ice cream (2 scoops)', 'ice_cream'), I('Waffle with ice cream', 'waffles', { servings: 1.3 }),
    I('Brownie', 'brownie'), I('Brownie with ice cream', 'brownie', { servings: 1.8 })]),
  P('gelato-affair-lhe2', 'Gelato Affair', 'Lahore', 'Lahore (also Karachi, Islamabad)', 'https://images.dawn.com/news/1191900', [
    I('Gelato, 2 scoops (Bounty / date & nut / dark chocolate / mocca magic)', 'ice_cream'), I('Strawberry gelato (2 scoops)', 'ice_cream', { servings: 0.9 }),
    I('Waffle', 'waffles'), I('Signature sundae', 'sundae'), I('Cold coffee', 'milkshake')], { check: true }),
  P('nirala-sweets-lhe2', 'Nirala Sweets', 'Lahore', 'Johar Town (reopened 2024); formerly Fleming Road, Jail Road', FP('hgx4/nirala-sweets-johar-town'), [
    I('Halwa puri plate', 'halwa_puri', S), I('Suji halwa', 'suji_halwa', S), I('Chanay', 'cholay', S),
    I('Pera lassi', 'sweet_lassi', { servings: 1.3 }), I('Ras malai (piece)', 'ras_malai'), I('Lal jamun (piece)', 'gulab_jamun')], { check: true }),

  // Bakeries
  P('cakes-bakes-lhe2', 'Cakes & Bakes', 'Lahore', 'Gulberg and other branches', W('11140619/cakes--bakes'), [
    I('Chicken patties', 'patties'), I('Fresh cream cake (slice)', 'cake_slice'), I('Live pizza (slice)', 'pizza_slice'), I('Biscuits', 'biscuits')]),
  P('bread-beyond-lhe2', 'Bread & Beyond', 'Lahore', 'Lahore', W('10938847/bread--beyond'), [
    I('Pastry', 'pastry'), I('Cake slice', 'cake_slice'), I('Sandwich', 'grilled_sandwich'), I('Fresh bread (2 slices)', 'bread_slice', { servings: 2 })]),
  P('masooms-lhe2', "Masoom's Coffee & Bakeshop", 'Lahore', 'DHA; Gulberg III', 'https://propakistani.pk/foodnama/5-best-cheesecake-places-in-lahore/', [
    I('New York cheesecake (slice)', 'cheesecake'), I('Blueberry cheesecake (slice)', 'cheesecake', { servings: 1.1 }),
    I('Chocolate cheesecake (slice)', 'cheesecake', { servings: 1.1 }), I('Strawberry cheesecake (slice)', 'cheesecake', { servings: 1.1 }),
    I('Death by chocolate cake (slice)', 'cake_slice', { servings: 1.3 })]),
  P('kitchen-cuisine-lhe2', 'Kitchen Cuisine', 'Lahore', 'Allahu Chowk (Johar Town); Cantt; Bahria Town', FP('hhs6/kitchen-cuisine-allahu-chowk'), [
    I('Chicken croissant', 'croissant', { servings: 1.4 }), I('Chicken samosa', 'keema_samosa'), I('Bran bread (2 slices)', 'bread_slice', { servings: 2 }),
    I('Fudge pastry', 'pastry'), I('Brownie', 'brownie')], { check: true }),

  // Cafés, coffee and brunch
  P('coffee-planet-lhe2', 'Coffee Planet', 'Lahore', 'DHA Phase 3; NASTP', FP('k6jt/coffee-planet-phase-3'), [
    I('Cappuccino', 'cappuccino'), I('Caramel / hazelnut latte', 'latte', { servings: 1.1 }), I('Iced Spanish latte', 'spanish_latte'),
    I('Café mocha', 'mocha'), I('Cookies & cream frappe', 'frappuccino'), I('Green apple iced tea', 'iced_tea'),
    I('BBQ sandwich', 'grilled_sandwich', R), I('Club sandwich', 'club_sandwich', R), I('Chicken mushroom lasagna', 'lasagna', R),
    I('Chicken croissant', 'croissant', { servings: 1.4 }), I('New York cheesecake', 'cheesecake'), I('Molten lava cake', 'lava_cake')]),
  P('eggspectation-lhe2', 'Eggspectation', 'Lahore', 'Boulevard 57, Main Boulevard Gulberg', 'https://images.dawn.com/news/1188852', [
    I('Bagel breakfast sandwich', 'bagel_cream_cheese', { ...R, servings: 1.6 }), I('Eggs Benedict', 'eggs_benedict', R), I('Pancakes', 'pancakes', R),
    I('Chicken cordon bleu', 'chicken_parmesan', { ...R, servings: 0.9 }), I('Beef burger', 'beef_burger', R), I('Steak', 'steak', R)]),
  P('dalston-house-lhe2', 'Dalston House', 'Lahore', 'Off MM Alam Road, Gulberg', 'https://www.dawn.com/news/1529165', [
    I("Za'atar chicken with jeweled rice", 'grilled_chicken_meal', R), I('Mezze bowl', 'hummus', { ...R, servings: 1.5 }),
    I('Prawn linguine', 'creamy_pasta', R), I('Beef burger', 'beef_burger', R), I('Fries', 'fries', R),
    I('Eggs with sourdough & merguez sausage', 'english_breakfast', { ...R, servings: 0.8 }), I('Granola pot', 'granola_yogurt')]),

  // Fine dining
  P('fuoco-lhe2', 'Fuoco', 'Lahore', 'Gulberg (also Islamabad)', 'https://dailytimes.com.pk/1133296/fuoco-brings-its-renowned-rendition-of-modern-european-cuisine-to-lahore/amp', [
    I('Mushroom risotto', 'risotto', R), I('Beef lasagne', 'lasagna', R), I('Beef tacos', 'tacos', R),
    I('Ricotta & spinach ravioli', 'creamy_pasta', { ...R, servings: 0.9 }), I('Tortellini Bolognese', 'spaghetti_bolognese', { ...R, servings: 0.9 }),
    I('Pepperoni pizza (whole, ~4 slices)', 'pizza_slice', { ...R, servings: 4 }), I('Sea bass', 'grilled_fish', R),
    I('Mozzarella sticks', 'mozzarella_sticks', R), I('Tiramisu', 'tiramisu'), I('Crème brûlée', 'creme_brulee')]),
  P('tuscany-courtyard-lhe2', 'Tuscany Courtyard', 'Lahore', 'MM Alam Road, Gulberg', 'https://www.dawn.com/news/1505580', [
    I('Stuffed chicken', 'grilled_chicken_meal', R), I('Steak', 'steak', R), I('Pizza (4 slices)', 'pizza_slice', { ...R, servings: 4 }),
    I('Pesto penne pasta', 'creamy_pasta', { ...R, servings: 1.3 }), I('Dumplings', 'dumplings', R),
    I('Brownie skillet with ice cream', 'brownie', { servings: 1.8 })]),
  P('tai-pan-lhe2', 'Tai Pan (Pearl Continental Lahore)', 'Lahore', 'Pearl Continental Hotel, Mall Road', 'https://www.graana.com/blog/famous-chinese-restaurants-in-lahore/', [
    I('Prawn tempura', 'prawn_tempura', R), I('Steamed chicken dumplings', 'dumplings', R), I('Szechuan chicken', 'chilli_chicken', R),
    I('Dry beef chilli', 'chilli_chicken', R), I('Black pepper beef', 'chilli_chicken', R)]),
];
