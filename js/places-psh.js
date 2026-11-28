// Peshawar restaurants, cafés, bakeries, sweet shops and street vendors (round 2), researched Nov 2026 from Arab News
// (Peshawar food features), Wanderlog place pages (Google reviews and the press snippets they quote), Zarrasha's
// Peshawar restaurant and menu guides (items taken from the restaurants' Foodpanda/app listings) and Bitetoo. Menu
// items are the dishes those sources actually name. Each item is a QK estimate from the closest dish model unless it
// has `official` values (none here: no Peshawar restaurant publishes nutrition). Places marked `check` were weakly
// sourced (a name in a directory list, no area, or a generic menu) or possibly closed.
// Portions: a Peshawari chapli kabab is bigger than the 120 g model (≈ 150–160 g, servings 1.3); Peshawari naan ≈ 1.3;
// "½ kg karahi" ≈ 430 g of meat in gravy (1.8 katoris); a whole chicken karahi for ~4 = 4 katoris; a full chargha /
// steam roast = 2 halves; "½ kg fish" fried ≈ 350 g edible (2.7 portions); pizzas are counted in slices.
const I = (name, dish, opts = {}, official = null) => ({ name, dish, opts, ...(official ? { official } : {}) });
const R = { style: 'restaurant', styleKnown: true }, S = { style: 'shaadi', styleKnown: true };
const O = (kcal, protein, carbs, fat, source, url) => ({ kcal, protein, carbs, fat, source, url });
const P = (id, name, city, area, url, items, extra = {}) => ({ id, name, type: 'Local', city, area, url, items, ...extra });
const W = (id) => `https://wanderlog.com/place/details/${id}`;
const Z = (slug) => `https://www.zarrasha.com/${slug}/`;
const C = 'Peshawar';
const CHECK = { check: true };

export const PSH_PLACES = [
  // Old city: Qissa Khwani, Namak Mandi, Chowk Nasir Khan, Bara Road
  P('al-sheikh-chargha-house-psh', 'Al-Sheikh Chargha House', C, 'Qissa Khwani Bazaar', 'https://www.arabnews.pk/pakistan/peshawar-home-to-unique-culinary-gems-1203096', [
    I('Chargha (half chicken)', 'chargha', S), I('Chargha (full chicken)', 'chargha', { ...S, servings: 2 }),
    I('Chargha (quarter)', 'chargha', { ...S, servings: 0.5 })]),
  P('safi-degi-chargha-psh', "Rafi Ullah Safi's Degi Chargha", C, 'Qissa Khwani Bazaar', 'https://www.arabnews.pk/node/2595535', [
    I('Degi chargha (whole chicken, fried then steamed in spiced yoghurt)', 'chargha', { ...S, servings: 2 }),
    I('Degi chargha (half)', 'chargha', S), I('Degi chargha (quarter)', 'chargha', { ...S, servings: 0.5 })]),
  P('lahori-sweet-house-psh', 'Lahori Sweet House (since 1925)', C, 'Qissa Khwani Bazaar, Pipal Mandi', W(11556337), [
    I('Halwa puri (breakfast plate)', 'halwa_puri', S), I('Samosa', 'samosa', S), I('Gajar halwa (gajrela)', 'gajar_halwa'),
    I('Jalebi', 'jalebi'), I('Gulab jamun (2)', 'gulab_jamun', { servings: 2 }), I('Mithai (per piece)', 'mithai')]),
  P('peshawari-khalis-foods-psh', 'Peshawari Khalis Foods', C, 'Kochi Bazaar, Chowk Nasir Khan (near Namak Mandi)', Z('halwa-puri-in-peshawar'), [
    I('Desi ghee halwa puri (2 puri, halwa, channa)', 'halwa_puri', S), I('Extra puri (desi ghee)', 'puri', S),
    I('Channa (katori)', 'cholay', S)]),
  P('umar-kabab-house-psh', 'Umar Kabab House', C, 'Bara Road, near Bara Gate (Umeedabad)', 'https://www.arabnews.pk/pakistan/peshawar-home-to-unique-culinary-gems-1203096', [
    I('Chapli kabab', 'chapli_kebab', { ...S, servings: 1.3 }), I('Chapli kabab (2 kababs)', 'chapli_kebab', { ...S, servings: 2.6 }),
    I('Naan', 'naan', { servings: 1.3 })]),
  P('taj-mahal-kabab-house-psh', 'Taj Mahal Kabab House', C, 'Yusufabad / Fidabad, near Namak Mandi', Z('best-chapli-kabab-peshawar'), [
    I('Chapli kabab', 'chapli_kebab', { ...S, servings: 1.3 }), I('Chapli kabab (2 kababs)', 'chapli_kebab', { ...S, servings: 2.6 }),
    I('Naan', 'naan', { servings: 1.3 })], CHECK),

  // Chapli kabab names on the main roads
  P('lal-zada-chapli-kabab-psh', 'Lal Zada Chapli Kabab', C, 'Faqeerabad Road, Zaryab Colony (Dalazak Road side)', Z('best-chapli-kabab-peshawar'), [
    I('Chapli kabab', 'chapli_kebab', { ...S, servings: 1.3 }), I('Chapli kabab (2 kababs)', 'chapli_kebab', { ...S, servings: 2.6 }),
    I('Naan', 'naan', { servings: 1.3 })], CHECK),
  P('bakshi-pul-chapli-kabab-psh', 'Bakshi Pul Chapli Kabab House (1930)', C, 'GT Road, Nasirpur (Bakhshu Pul)', Z('best-chapli-kabab-peshawar'), [
    I('Chapli kabab', 'chapli_kebab', { ...S, servings: 1.3 }), I('Chapli kabab (2 kababs)', 'chapli_kebab', { ...S, servings: 2.6 }),
    I('Naan', 'naan', { servings: 1.3 })], CHECK),
  P('rambail-kabab-psh', 'Rambail Kabab', C, 'Peshawar–Rawalpindi road, Tarnab', Z('best-chapli-kabab-peshawar'), [
    I('Chapli kabab', 'chapli_kebab', { ...S, servings: 1.3 }), I('Chapli kabab (2 kababs)', 'chapli_kebab', { ...S, servings: 2.6 }),
    I('Naan', 'naan', { servings: 1.3 })], CHECK),
  P('malang-ustad-chapli-kabab-psh', 'Malang Ustad Chapli Kabab', C, 'University Road, Tehkal', Z('best-chapli-kabab-peshawar'), [
    I('Chapli kabab', 'chapli_kebab', { ...S, servings: 1.3 }), I('Chapli kabab (2 kababs)', 'chapli_kebab', { ...S, servings: 2.6 }),
    I('Naan', 'naan', { servings: 1.3 })], CHECK),
  P('speen-zar-chapli-kabab-psh', 'Speen Zar Restaurant & Chapli Kabab', C, 'Hayatabad Phase 4', Z('best-chapli-kabab-peshawar'), [
    I('Chapli kabab', 'chapli_kebab', { ...S, servings: 1.3 }), I('Chapli kabab (2 kababs)', 'chapli_kebab', { ...S, servings: 2.6 }),
    I('Naan', 'naan', { servings: 1.3 })], CHECK),
  P('mohmand-toray-kabab-psh', 'Mohmand Toray Kabab House', C, 'Branch 8 Civil Quarters (Saddar); Charsadda Road; Warsak Road; Zaryab Colony', Z('mohmand-toray-kabab-saddar'), [
    I('Special chapli kabab', 'chapli_kebab', { ...S, servings: 1.3 }),
    I('Special egg chapli kabab (egg cooked on the kabab)', 'chapli_kebab', { ...S, servings: 1.7 }),
    I('Sada Kabuli pulao (plate)', 'kabuli_pulao', S), I('Special Kabuli pulao (plate)', 'kabuli_pulao', { ...S, servings: 1.2 }),
    I('Chicken tikka (leg piece)', 'chicken_tikka', S), I('Chicken reshmi kabab (2)', 'reshmi_kebab', S),
    I('Seekh kabab (per seekh)', 'seekh_kebab', S), I('Batair (2)', 'batair', S),
    I('Chicken karahi (full, serves ~4)', 'chicken_karahi', { ...S, servings: 4 }), I('Chicken white handi (half)', 'chicken_handi', { ...S, servings: 2 }),
    I('Special rosh (per person)', 'mutton_rosh', S), I('Balochi special sajji (quarter)', 'sajji', S),
    I('Daal mash', 'daal_mash', S), I('Sada naan', 'naan')]),
  P('insaf-hotel-psh', 'Insaf Hotel', C, '', 'https://www.bitetoo.com/blog/affordable-restaurants-in-peshawar', [
    I('Special chapli kabab', 'chapli_kebab', { ...S, servings: 1.3 }), I('Chapli kabab tarka', 'chapli_kebab', { ...S, servings: 1.5 }),
    I('Seekh kabab tarka (2 seekh)', 'seekh_kebab', { ...S, servings: 2 }), I('Pulao (plate)', 'beef_pulao', S),
    I('Lobia karahi', 'rajma', S)], CHECK),
  P('chaupal-restaurant-psh', 'Chaupal Restaurant', C, '', 'https://www.bitetoo.com/blog/affordable-restaurants-in-peshawar', [
    I('Kabuli pulao (plate)', 'kabuli_pulao', S), I('Chapli kabab', 'chapli_kebab', { ...S, servings: 1.3 }),
    I('Chicken karahi (per person)', 'chicken_karahi', { ...S, servings: 1.5 }), I('Chicken lum karahi (per person)', 'chicken_karahi', { ...S, servings: 1.5 }),
    I('Chicken pulao (plate)', 'chicken_pulao', S)], CHECK),
  P('chicken-inn-bbq-psh', 'Chicken Inn BBQ & Platter House', C, 'Gulberg', 'https://www.bitetoo.com/blog/affordable-restaurants-in-peshawar', [
    I('Chicken leg piece (BBQ)', 'chicken_tikka', R), I('Chicken breast piece (BBQ)', 'chicken_tikka_chest', R),
    I('Chicken malai boti (plate)', 'malai_boti', R), I('Seekh kabab (per seekh)', 'seekh_kebab', R),
    I('Kabuli pulao (plate)', 'kabuli_pulao', R), I('Sajji (quarter)', 'sajji', R)]),
  P('bannu-beef-pulao-university-road-psh', 'Bannu Beef Pulao', C, 'University Road (opposite Chief Burger)', Z('restaurants-in-peshawar'), [
    I('Bannu beef pulao (plate)', 'beef_pulao', S), I('Bannu beef pulao (full plate)', 'beef_pulao', { ...S, servings: 1.5 }),
    I('Raita', 'raita')]),

  // Saddar / Cantt
  P('khaane-khaas-psh', 'Khaane Khaas Restaurant', C, 'Saddar Road', Z('restaurants-in-peshawar'), [
    I('Steam roast (whole chicken)', 'chargha', { ...R, servings: 2 }), I('Chapli kabab', 'chapli_kebab', { ...S, servings: 1.3 }),
    I('Kabuli pulao (plate)', 'kabuli_pulao', R), I('Balochi sajji (quarter)', 'sajji', R),
    I('Mutton Shinwari karahi (per person)', 'mutton_karahi', { ...S, servings: 1.5 }), I('Mutton namkeen (per person)', 'mutton_rosh', S),
    I('Chicken chow mein', 'chow_mein', R)]),
  P('shinwari-jongara-psh', 'Shinwari Jongara', C, 'Phase 3 Chowk, Jamrud Road, Hayatabad; Saddar Road (opp. Cantt railway station)', Z('shinwari-jongara-menu-peshawar'), [
    I('Laham dampokht (per person)', 'dampukht', { ...S, servings: 1.5 }), I('Shinwari Jongara pulao (plate)', 'kabuli_pulao', S),
    I('Mutton karahi (½ kg)', 'mutton_karahi', { ...S, servings: 1.8 }), I('Chicken white karahi (per person)', 'white_karahi', S),
    I('Mutton tikka (plate)', 'lamb_tikka', S), I('Chicken malai boti (plate)', 'malai_boti', R),
    I('Chicken tikka (leg piece)', 'chicken_tikka', R), I('Seekh kabab (per seekh)', 'seekh_kebab', R),
    I('Reshmi kabab (2)', 'reshmi_kebab', R), I('Chapli kabab', 'chapli_kebab', { ...S, servings: 1.3 }),
    I('Naan', 'naan', { servings: 1.3 }), I('Raita', 'raita')]),
  P('silver-dragon-psh', 'Silver Dragon', C, 'GT Road, Tehkal', Z('silver-dragon-peshawar-menu'), [
    I('Egg fried rice', 'egg_fried_rice', R), I('Chicken fried rice', 'egg_fried_rice', { ...R, servings: 1.1 }),
    I('Chicken chow mein', 'chow_mein', R), I('Beef chow mein', 'chow_mein', R), I('Chicken Manchurian', 'manchurian', R),
    I('Chicken chilli dry', 'chilli_chicken', R), I('Kung pao chicken', 'chilli_chicken', R), I('Beef chilli dry', 'chilli_chicken', R),
    I('Chicken shashlik with rice', 'grilled_chicken_meal', R), I('Hot & sour soup', 'hot_sour_soup'), I('Chicken corn soup', 'corn_soup')]),
  P('hong-kong-chinese-psh', 'Hong Kong Chinese Restaurant', C, 'The Mall, Peshawar Cantt', W(10188283), [
    I('Hot & sour soup', 'hot_sour_soup'), I('Chicken fried rice', 'egg_fried_rice', { ...R, servings: 1.1 }),
    I('Chicken chow mein', 'chow_mein', R), I('Chicken Manchurian', 'manchurian', R), I('Chilli chicken', 'chilli_chicken', R)], CHECK),
  P('asian-wok-psh', 'Asian Wok (by Monal)', C, 'Mall Road, Peshawar Cantt', W(7424347), [
    I('Tom yum soup', 'tom_yum'), I('Asian Wok special beef (crispy, sweet)', 'manchurian', R),
    I('Chicken chow mein', 'chow_mein', R), I('Egg fried rice', 'egg_fried_rice', R),
    I('Mint margarita', 'mint_lemonade'), I('Kehwa (green tea)', 'kehwa')]),
  P('jans-bakers-saddar-psh', "Jan's Bakers", C, '6 Sunehri Masjid Road (Benevolent Fund), Saddar', Z('jans-bakery-peshawar-saddar'), [
    I('Pistachio butter biscuits (3)', 'biscuits', { servings: 1.5 }), I('Cream roll', 'cream_roll'), I('Pink pastry', 'pastry'),
    I('Cream puff', 'pastry', { servings: 0.8 }), I('Donut', 'donut'), I('Brownie', 'brownie'), I('Cake (slice)', 'cake_slice'),
    I('Barfi / pateesa (piece)', 'mithai'), I('Sohan halwa (piece)', 'sohan_halwa')]),
  P('pak-bakers-psh', 'Pak Bakers', C, '32 The Mall, Peshawar Cantt; Spogmai Plaza, University Road', W(11464359), [
    I('Chocolate almond cake (slice)', 'cake_slice', { servings: 1.2 }), I('Pastry', 'pastry'), I('Chicken samosa', 'keema_samosa'),
    I('Rasmalai (2)', 'ras_malai', { servings: 2 }), I('Mixed biscuits (3)', 'biscuits'), I('Plain cake (slice)', 'cake_slice'),
    I('Ice cream (2 scoops)', 'ice_cream'), I('Bread (slice)', 'bread_slice')]),

  // University Road / University Town / Tehkal
  P('cafe-crunch-psh', 'Café Crunch', C, '45 Old Jamrud Road, University Town', W(10188246), [
    I('Cream of chicken soup', 'cream_soup', R), I('Steak', 'steak', R), I('Chicken tikka (BBQ)', 'chicken_tikka', R),
    I('Pizza (2 slices)', 'pizza_slice', { ...R, servings: 2 }), I('Creamy chicken pasta', 'creamy_pasta', R),
    I('Chicken shawarma', 'shawarma', R), I('Beef burger', 'beef_burger', R), I('Cake (slice)', 'cake_slice'), I('Pastry', 'pastry')]),
  P('lokanta-foodawa-psh', 'LOKANTA by Foodawa', C, 'City Towers, University Town', Z('lokanta-peshawar-menu'), [
    I('Turkish seekh kabab (2 seekh)', 'seekh_kebab', { ...R, servings: 2 }), I('Chicken malai boti (plate)', 'malai_boti', R),
    I('Chicken achari boti (seekh)', 'chicken_boti', R), I('White handi (half, for 2)', 'white_karahi', { ...R, servings: 2 }),
    I('Red handi (half, for 2)', 'chicken_handi', { ...R, servings: 2 }), I('Chicken noodles', 'chow_mein', R),
    I('Beef chilli dry', 'chilli_chicken', R), I('Stuffed chicken with mustard sauce & broccoli', 'grilled_chicken_meal', R),
    I('Mexican / mushroom steak', 'steak', R), I('Alfredo pasta', 'creamy_pasta', R),
    I('Crown pizza (medium, 6 slices)', 'cheesy_pizza_slice', { ...R, servings: 6 }), I('Saucy nachos', 'nachos', R)]),
  P('food-punch-psh', 'Food Punch', C, 'Al-Haaj Tower, University Road, University Town', Z('food-punch-peshawar-menu'), [
    I('Zinger burger', 'zinger_burger', R), I('Beef burger', 'beef_burger', R), I('Chicken burger', 'chicken_burger', R),
    I('Stuffed crust pizza (medium, 6 slices)', 'cheesy_pizza_slice', { ...R, servings: 6 }), I('Chicken shawarma', 'shawarma', R),
    I('Club sandwich', 'club_sandwich', R), I('Crispy fried chicken (piece)', 'fried_chicken', R), I('Nuggets', 'nuggets', R),
    I('Wings (6)', 'wings', R), I('Loaded fries', 'loaded_fries', R), I('Fresh juice', 'fresh_juice'), I('Sweet lassi', 'sweet_lassi')]),
  P('ghwakhe-steakhouse-psh', 'Ghwakhe Steakhouse', C, 'Arbab Plaza, University Road, Canal Town (near Phase 3 Chowk)', Z('ghwakhe-steakhouse-menu-peshawar'), [
    I('Tenderloin steak (salt bae / normal / filet mignon)', 'steak', R), I('Ribeye steak', 'steak', { ...R, servings: 1.2 }),
    I('Tomahawk steak (sharing, 2–3 people)', 'steak', { ...R, servings: 2.8 }), I('Philly cheesesteak burger', 'beef_burger', R),
    I('Smashed beef burger', 'beef_burger', { ...R, servings: 0.9 }), I('Beef bone marrow burger', 'beef_burger', { ...R, servings: 1.2 }),
    I('Crispy fried fish burger', 'zinger_burger', R), I('Fettuccine Alfredo', 'creamy_pasta', R), I('Beef burrito', 'burrito', R),
    I('Chicken quesadilla', 'quesadilla', R), I('Fish & chips', 'fish_and_chips', R), I('Ultimate nachos', 'nachos', R),
    I('Mashed potatoes (side)', 'mashed_potatoes', R), I('Mint margarita', 'mint_lemonade')]),
  P('bait-al-arab-mandi-psh', 'Bait Al Arab Mandi', C, 'Hamayun Tower, University Road, Tehkal', W(10902582), [
    I('Chicken mandi (quarter)', 'chicken_mandi', R), I('Chicken mandi (half chicken)', 'chicken_mandi', { ...R, servings: 1.6 }),
    I('Lamb mandi (plate)', 'lamb_mandi', R), I('Lamb mandi platter (sharing, ~4)', 'lamb_mandi', { ...R, servings: 4 })]),
  P('chief-grill-psh', 'Chief Grill', C, 'Bhittani Plaza, 3-A Park Avenue, University Town', W(10902583), [
    I('Chicken tikka (leg piece)', 'chicken_tikka', R), I('Chicken tikka (chest piece)', 'chicken_tikka_chest', R),
    I('Seekh kabab (2 seekh)', 'seekh_kebab', { ...R, servings: 2 }), I('Chicken boti (seekh)', 'chicken_boti', R),
    I('Malai boti (plate)', 'malai_boti', R), I('Naan', 'naan')]),
  P('shinwari-restaurant-university-road-psh', 'Shinwari Restaurant (University Road)', C, 'University Road near Liberty Mall, Tehkal', Z('traditional-pakistani-cuisine/shinwari-restaurant-university-road-peshawar'), [
    I('Kabuli beef pulao (plate)', 'kabuli_pulao', S), I('Kabuli chicken pulao (plate)', 'kabuli_pulao', S),
    I('Shinwari chicken karahi (half)', 'chicken_karahi', { ...S, servings: 2 }), I('Chicken white karahi (per person)', 'white_karahi', S),
    I('Lahori chicken karahi (per person)', 'chicken_karahi', { ...S, servings: 1.5 }), I('Namkeen gosht (per person)', 'mutton_rosh', S),
    I('Chicken qorma', 'chicken_qorma', S), I('Chicken handi', 'chicken_handi', S), I('Seekh kabab (per seekh)', 'seekh_kebab', S),
    I('Malai boti (plate)', 'malai_boti', R), I('Naan', 'naan', { servings: 1.3 }), I('Lassi', 'sweet_lassi')]),
  P('dehleez-food-psh', 'Dehleez Food', C, '2 Gulbahar Road (Hussain Abad); University Town', Z('dehleez-food-gulbahar'), [
    I('Chef Special pizza (large, 8 slices)', 'cheesy_pizza_slice', { ...R, servings: 8 }), I('Zinger cheese burger', 'zinger_burger', { ...R, servings: 1.1 }),
    I('Chicken shawarma', 'shawarma', R), I('Fries', 'fries', R)]),
  P('shereen-mahal-psh', 'Shereen Mahal Sweets & Bakers', C, 'University Road, University Town', W(2907521), [
    I('Cake (slice)', 'cake_slice'), I('Pastry', 'pastry'), I('Cookies (3)', 'biscuits', { servings: 1.3 }), I('Samosa', 'samosa', S)]),
  P('badayuni-paira-house-psh', 'Badayuni Paira House', C, 'University Road, opposite Total Parco pump, University Town', W(11556366), [
    I('Badayuni paira (2 pieces)', 'mithai'), I('Dry fruit pateesa (piece)', 'mithai'), I('Assorted sweets (250 g box)', 'mithai', { servings: 5.5 })]),
  P('bakeology-psh', 'Bakeology (Town branch)', C, 'Saif Marina Heights, Old Bara Road, University Town', Z('bakeries-in-peshawar'), [
    I('Cake (slice)', 'cake_slice'), I('Pastry', 'pastry'), I('Brownie', 'brownie'), I('Cookie', 'chocolate_chip_cookie'),
    I('Croissant', 'croissant'), I('Donut', 'donut'), I('Muffin', 'muffin')]),
  P('crave-bake-shop-psh', 'Crave Bake Shop', C, 'Spogmay Plaza, University Town', Z('bakeries-in-peshawar'), [
    I('Premium cake (slice)', 'cake_slice', { servings: 1.3 }), I('Brownie', 'brownie'), I('Cupcake', 'cupcake'), I('Muffin', 'muffin'),
    I('Cookie', 'chocolate_chip_cookie'), I('Sundae', 'sundae'), I('Éclair', 'pastry', { servings: 0.8 }), I('Donut', 'donut')]),
  P('forest-sweets-bakers-psh', 'Forest Sweets & Bakers', C, 'Rahat Abad, near Agricultural University', W(11556339), [
    I('Samosa', 'samosa', S), I('Red mithai', 'mithai'), I('Cream roll', 'cream_roll'), I('Brownie', 'brownie'),
    I('Cake (slice)', 'cake_slice'), I('Cookies (3)', 'biscuits', { servings: 1.3 })]),

  // Hayatabad
  P('piyali-hayatabad-psh', 'Piyali', C, 'D Chowk near Shalman Park, Hayatabad Phase 2', W(7696706), [
    I('Desi breakfast: halwa puri', 'halwa_puri', R), I('Channay', 'cholay', R), I('Lachha paratha', 'lachha_paratha', R),
    I('Chicken karahi (half)', 'chicken_karahi', { ...R, servings: 2 }), I('Butter tawa chicken (plate)', 'tawa_chicken', R),
    I('Chicken handi', 'chicken_handi', { ...R, servings: 1.5 }), I('Malai boti (plate)', 'malai_boti', R),
    I('Fried rice', 'egg_fried_rice', R), I('Roghni naan', 'roghni_naan'), I('Gol gappay', 'gol_gappay'),
    I('Quesadilla', 'quesadilla', R)]),
  P('chick-n-fire-psh', 'Chick n Fire', C, 'Yousafzai Market, Hayatabad Phase 3', Z('chick-n-fire-menu-hayatabad'), [
    I('Lebanese pizza (medium, 6 slices)', 'pizza_slice', { ...R, servings: 6 }), I('Crown crust pizza (medium, 6 slices)', 'cheesy_pizza_slice', { ...R, servings: 6 }),
    I('Zinger burger', 'zinger_burger', R), I('Mighty Zinger with cheese', 'mighty_zinger', { ...R, servings: 1.1 }),
    I('Stuffed beef cheese burger', 'beef_burger', R), I('Mayo wings (6)', 'wings', R), I('Zinger paratha roll', 'paratha_roll', { ...R, servings: 1.1 }),
    I('Chicken garlic shawarma', 'shawarma', R), I('Loaded curly fries', 'loaded_fries', R), I('Italian lasagna', 'lasagna', R)]),
  P('downtown-bistro-psh', 'Downtown Bistro', C, 'Durrani Plaza, Hayatabad Phase 2 (J-1); Tehkal Payan, University Road', Z('downtown-bistro-peshawar-menu'), [
    I('Apache Burger (loaded beef)', 'beef_burger', { ...R, servings: 1.4 }), I('Wanted Burger', 'beef_burger', R),
    I('Frisco Chicken Burger', 'chicken_burger', R), I('Mexican Chicken Schnitzel Burger', 'zinger_burger', R),
    I('All the Meat pizza (medium, 6 slices)', 'cheesy_pizza_slice', { ...R, servings: 6 }), I('Fajita pizza (medium, 6 slices)', 'pizza_slice', { ...R, servings: 6 }),
    I('Chick N Lick steak (chicken)', 'grilled_chicken_meal', R), I('Pepper butter steak', 'steak', R),
    I('Wings (6)', 'wings', R), I('Fries', 'fries', R)]),
  P('mr-cod-psh', 'Mr. Cod', C, 'Street 2, Hayatabad Phase 2/6; Iqra Chowk, University Town', W(2814516), [
    I('Fish & chips', 'fish_and_chips', R), I('Fish burger', 'zinger_burger', R), I('Fried chicken (piece)', 'fried_chicken', R),
    I('Tikka pizza (medium, 6 slices)', 'pizza_slice', { ...R, servings: 6 }), I('Nuggets', 'nuggets', R), I('Fries', 'fries', R)]),
  P('shah-gee-halwa-pori-psh', 'Shah Gee Halwa Pori', C, 'Super Market, Sector D-2, Hayatabad Phase 1', Z('halwa-puri-in-peshawar'), [
    I('Halwa puri plate', 'halwa_puri', S), I('Extra puri', 'puri', S), I('Channa (katori)', 'cholay', S)], CHECK),
  P('chacha-halwa-pori-psh', 'Chacha Halwa Pori', C, 'Nawab Market, Sector F-9, Hayatabad Phase 6', Z('halwa-puri-in-peshawar'), [
    I('Halwa puri plate', 'halwa_puri', S), I('Extra puri', 'puri', S), I('Samosa', 'samosa', S)], CHECK),
  P('chai-spot-hayatabad-psh', 'Chai Spot', C, 'Bismillah Market, Hayatabad Phase 4 (24 hours)', Z('halwa-puri-in-peshawar'), [
    I('Halwa puri with channa', 'halwa_puri', S), I('Doodh patti chai', 'chai'), I('Naan', 'naan'), I('Cheese naan', 'cheese_naan')], CHECK),

  // Ring Road (Achini Payan, Hazar Khwani, Hayatabad Toll Plaza)
  P('hujra-restaurant-psh', 'Hujra Restaurant', C, 'Ring Road, Achini Payan (near Hayatabad)', W(3205227), [
    I('Mutton rosh (per person)', 'mutton_rosh', S), I('Lamb karahi (½ kg)', 'mutton_karahi', { ...S, servings: 1.8 }),
    I('Chapli kabab', 'chapli_kebab', { ...S, servings: 1.3 }), I('Chicken karahi (half)', 'chicken_karahi', { ...S, servings: 2 }),
    I('Mutton tikka (plate)', 'lamb_tikka', S), I('Seekh kabab (per seekh)', 'seekh_kebab', S),
    I('Fried fish (½ kg)', 'fried_fish', { ...S, servings: 2.7 }), I('Chicken burger', 'chicken_burger', R), I('Naan', 'naan', { servings: 1.3 })]),
  P('zaiqa-restaurant-ring-road-psh', 'Zaiqa Restaurant', C, 'Ring Road, Achini Payan (near HBK)', W(6133684), [
    I('Peshawari fish fry (½ kg)', 'fried_fish', { ...S, servings: 2.7 }), I('Angara fish (½ kg)', 'fried_fish', { ...R, servings: 2.5 }),
    I('Mutton rosh (per person)', 'mutton_rosh', S), I('Dum pukht (per person)', 'dampukht', { ...S, servings: 1.5 }),
    I('Dumba karahi (½ kg)', 'mutton_karahi', { ...S, servings: 1.8 }), I('Kabuli pulao (plate)', 'kabuli_pulao', S),
    I('Chicken tikka (leg piece)', 'chicken_tikka', S), I('Seekh kabab (per seekh)', 'seekh_kebab', S), I('Naan', 'naan', { servings: 1.3 })]),
  P('traskoon-restaurant-psh', 'Traskoon Restaurant', C, 'Ring Road, Achini Payan', W(10188277), [
    I('Mutton tikka (plate)', 'lamb_tikka', S), I('Mutton karahi (½ kg)', 'mutton_karahi', { ...S, servings: 1.8 }),
    I('Chicken tikka (leg piece)', 'chicken_tikka', S), I('Beef tikka (plate)', 'lamb_tikka', S),
    I('Angara fish (½ kg)', 'fried_fish', { ...R, servings: 2.5 }), I('Seekh kabab (per seekh)', 'seekh_kebab', S),
    I('Kabuli pulao (plate)', 'kabuli_pulao', S), I('Naan', 'naan', { servings: 1.3 }), I('Lassi', 'sweet_lassi'), I('Peshawari kahwa', 'kehwa')]),
  P('yaseen-malak-psh', 'Yaseen Malak Restaurant', C, 'Hazar Khwani Chowk, Ring Road', Z('yaseen-malak-restaurant-peshawar'), [
    I('Shashlik (green) tikka (seekh)', 'chicken_boti', { ...R, servings: 1.5 }), I('Seekh kabab (per seekh)', 'seekh_kebab', S),
    I('Peshawari chapli kabab', 'chapli_kebab', { ...S, servings: 1.3 }), I('Kabuli pulao (plate)', 'kabuli_pulao', S),
    I('Balochi sajji (quarter)', 'sajji', S), I('Mutton dum pukht (per person)', 'dampukht', { ...S, servings: 1.5 }),
    I('Mint margarita', 'mint_lemonade')]),
  P('new-khyber-shinwari-psh', 'New Khyber Shinwari Tikka & Karahi Shop', C, 'Ring Road next to Inspire Super Market, Hayatabad Toll Plaza', Z('new-khyber-shinwari-tikka-karahi-shop'), [
    I('Special chapli kabab', 'chapli_kebab', { ...S, servings: 1.3 }), I('Special chicken karahi (serves ~4)', 'chicken_karahi', { ...S, servings: 4 }),
    I('Special chicken Kabuli pulao (plate)', 'kabuli_pulao', S), I('Special beef Kabuli pulao (plate)', 'kabuli_pulao', S),
    I('Shinwari special patta tikka (liver in fat)', 'kaleji', S), I('Chicken BBQ chest piece', 'chicken_tikka_chest', S),
    I('Special chicken malai tikka (plate)', 'malai_boti', R), I('Chicken white handi (per person)', 'white_karahi', { ...S, servings: 1.5 }),
    I('Chicken qorma', 'chicken_qorma', S), I('Dal mash', 'daal_mash', S), I('Double naan', 'naan', { servings: 2 }), I('Special raita', 'raita')]),
  P('kdf-khyber-darbar-psh', 'KDF (Khyber Darbar Foodies)', C, 'Kohat Road near Salman Wedding Hall; Canal Chowk, Ring Road', Z('kdf-peshawar-menu-kohat-road'), [
    I('Chicken boti masala', 'chicken_karahi', { ...R, servings: 1.5 }), I('KDF Kabuli chicken pulao (plate)', 'kabuli_pulao', R),
    I('Chicken fried rice', 'egg_fried_rice', { ...R, servings: 1.1 }), I('KDF Special Zinger', 'zinger_burger', R),
    I('Double Tower burger', 'mighty_zinger', R), I('Zinger piece', 'fried_chicken', R), I('Large fries', 'fries', { ...R, servings: 1.5 }),
    I('Turkish grilled shawarma', 'doner_kebab', R), I('Chicken shawarma', 'shawarma', R),
    I('KDF Supreme pizza (medium, 6 slices)', 'cheesy_pizza_slice', { ...R, servings: 6 })]),

  // Gulbahar, Shami Road, Bashirabad, other bakeries and cafés
  P('salman-bakers-psh', 'Salman Sweets & Bakers', C, 'Circular Road, Qissa Khwani; Gulbahar; Dalazak Road; Asia Gate', Z('salman-bakery-peshawar-menu'), [
    I('Salman Special pizza (small, 4 slices)', 'pizza_slice', { ...R, servings: 4 }), I('Crown crust pizza (medium, 6 slices)', 'cheesy_pizza_slice', { ...R, servings: 6 }),
    I('Shami burger', 'anda_shami_burger', R), I('Zinger burger', 'zinger_burger', R), I('Chicken grilled sandwich', 'grilled_sandwich', R),
    I('Panini grilled sandwich', 'panini', R), I('Wings (6)', 'wings', R), I('Fries', 'fries', R),
    I('Umami Smash beef burger', 'beef_burger', { ...R, servings: 0.9 }), I('Milky cake (slice)', 'cake_slice'), I('Cream roll', 'cream_roll'),
    I('Mithai (per piece)', 'mithai')]),
  P('gelato-house-black-cafe-psh', 'Gelato House Black Café', C, '1 Ishrat Cinema Road, Gulbahar', W(10865187), [
    I('Waffle', 'waffles'), I('Special pizza (medium, 6 slices)', 'pizza_slice', { ...R, servings: 6 }),
    I('Gelato / ice cream (2 scoops)', 'ice_cream'), I('Chicken tikka (BBQ)', 'chicken_tikka', R)], CHECK),
  P('bread-chef-psh', 'Bread Chef Café & Bakers', C, 'Sher Khan Road near Garrison Park, Bashirabad; Yousafzai Road, Hayatabad Phase 3', W(2814551), [
    I('Cappuccino', 'cappuccino'), I('Café latte', 'latte'), I('Pastry', 'pastry'), I('Cake (slice)', 'cake_slice'),
    I('Pizza (medium, 6 slices)', 'pizza_slice', { ...R, servings: 6 }), I('Steak', 'steak', R)]),
];
