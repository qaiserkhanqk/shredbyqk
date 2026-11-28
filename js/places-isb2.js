// Islamabad and Rawalpindi street food, dhabas, BBQ, desserts, bakeries, cafés and restaurants (round 2), researched
// Nov 2026 from Wanderlog place pages (Google reviews and the press snippets they quote), BlogPakistan, Zameen Blog,
// Travelpal and Dawn Images. Menu items are the dishes reviewers and articles actually name. Each item is a QK estimate
// from the closest dish model unless it has `official` values. Places marked `check` were weakly sourced or possibly
// closed.
const I = (name, dish, opts = {}, official = null) => ({ name, dish, opts, ...(official ? { official } : {}) });
const R = { style: 'restaurant', styleKnown: true }, S = { style: 'shaadi', styleKnown: true };
const O = (kcal, protein, carbs, fat, source, url) => ({ kcal, protein, carbs, fat, source, url });
const P = (id, name, city, area, url, items, extra = {}) => ({ id, name, type: 'Local', city, area, url, items, ...extra });
const W = (id) => `https://wanderlog.com/place/details/${id}`;
const BP_RWP = 'https://blogpakistan.pk/restaurants-in-rawalpindi/';
const Z = (slug) => `https://www.zameen.com/blog/${slug}.html`;

export const ISB2_PLACES = [
  // ---------------- Rawalpindi: street food, BBQ and desi ----------------
  P('raees-tikka-shop-isb2', 'Raees Tikka Shop', 'Rawalpindi', 'Qaiser Plaza, Adam Jee Rd, Saddar', W(13239215), [
    I('Fry mutton kebab (4 pieces)', 'fry_kebab', { ...S, servings: 4 }), I('Chicken malai boti (one seekh)', 'chicken_boti', S),
    I('Beef seekh kebab (2)', 'seekh_kebab', { ...S, servings: 2 }), I('Chicken seekh kebab (2)', 'seekh_kebab', { ...S, servings: 2 }),
    I('Dry mutton boti (one seekh)', 'lamb_tikka', { ...S, servings: 0.5 }), I('Fried fish (portion)', 'fried_fish', { ...S, servings: 1.5 }),
    I('Naan', 'naan', S)]),
  P('refreshment-center-isb2', 'The Refreshment Center', 'Rawalpindi', '31-B Commercial Market Rd, Satellite Town', W(3661845), [
    I('Samosa', 'samosa', S), I('Samosa chaat', 'samosa_chaat'), I('Chana chaat', 'chana_chaat'), I('Dahi baray', 'dahi_bhalla'),
    I('Halwa puri (breakfast plate)', 'halwa_puri', S), I('Lassi', 'sweet_lassi'), I('Ice cream (2 scoops)', 'ice_cream')]),
  P('saffron-foodies-isb2', 'Saffron Foodies', 'Rawalpindi', 'Post Plaza, Commercial Market Rd, Satellite Town; Pindi Stadium Food Street, Shamsabad', W(3753827), [
    I('Chicken karahi (per person)', 'chicken_karahi', { ...R, servings: 1.2 }),
    I('Homemade butter karahi (per person)', 'chicken_karahi', { ...S, servings: 1.3 }),
    I('Achari karahi (per person)', 'chicken_karahi', { ...R, servings: 1.2 }), I('Chicken makhani', 'butter_chicken', { ...R, servings: 1.2 }),
    I('Chicken tikka biryani', 'chicken_biryani', { ...R, servings: 1.1 }), I('Chicken chow mein', 'chow_mein', R),
    I('Roghni naan', 'roghni_naan', R)]),
  P('rfd-rabri-faluda-doodh-isb2', 'RFD Rabri Faluda Doodh', 'Rawalpindi', 'Harding Rd, Saddar', W(11681022), [
    I('Rabri faluda doodh (glass)', 'falooda', { servings: 1.3 }), I('Gondh qateera doodh (glass, summer)', 'milk_glass', { servings: 1.4 }),
    I('Rabri (katori)', 'rabri')]),
  P('mamoo-burger-point-isb2', 'Mamoo Burger Point', 'Rawalpindi', 'Chandni Chowk (Asghar Mall Scheme)', W(11665587), [
    I('Bun kebab', 'bun_kebab', S), I('Zinger burger', 'zinger_burger', S), I('Chicken patty burger', 'chicken_burger', S),
    I('Chicken roll', 'paratha_roll', S), I('Fries', 'fries', S)]),
  P('china-xinjiang-isb2', 'China Xinjiang Restaurant', 'Rawalpindi', 'Rooftop, Urumqi Plaza, Gordon College Rd', W(11665589), [
    I('Mantu / dumplings (plate)', 'dumplings', R), I('Laghman (hand-pulled noodles with lamb)', 'chow_mein', { ...R, servings: 1.1 }),
    I('Kabuli pulao', 'kabuli_pulao', R)]),
  P('mei-kong-isb2', 'Mei Kong', 'Rawalpindi', '32 Haider Rd, Saddar (since the 1970s)', W(2813779), [
    I('Chicken corn soup', 'corn_soup', R), I('Special Mei Kong soup', 'hot_sour_soup', R),
    I('Kung pao chicken', 'chilli_chicken', R), I('Royal Mei Kong chicken', 'chilli_chicken', R)]),
  P('lasania-isb2', 'Lasania Restaurant', 'Rawalpindi', 'Sehgal Plaza, Murree Rd, Saddar; Rehmanabad Chowk, Satellite Town', BP_RWP, [
    I('Chicken makhni handi', 'butter_chicken', { ...R, servings: 1.2 }), I('Chicken biryani', 'chicken_biryani', R),
    I('Chicken chow mein', 'chow_mein', R), I('Fish and chips', 'fish_and_chips', R)]),
  P('xhing-xhiang-isb2', 'Xhing Xhiang China Cottage', 'Rawalpindi', 'Main Commercial Market Rd (Chandni Chowk); Bismillah Market, I-8/2 Islamabad', W(10728477), [
    I('Chicken chow mein', 'chow_mein', R), I('Beef chilli dry', 'chilli_chicken', R), I('Szechuan chicken', 'chilli_chicken', R),
    I('Kung pao chicken', 'chilli_chicken', R), I('Mongolian beef', 'chilli_chicken', R), I('Vegetable fried rice', 'egg_fried_rice', R),
    I('Dumplings', 'dumplings', R)], { check: true }),
  P('marco-polo-pc-isb2', 'Marco Polo (Pearl-Continental Rawalpindi)', 'Rawalpindi', 'The Mall, Rawalpindi', W(8659855), [
    I('Mutton handi (per person)', 'mutton_karahi', { ...R, servings: 1.2 }), I('Chicken malai handi (per person)', 'chicken_handi', { ...R, servings: 1.2 }),
    I('Samosa (lunch buffet)', 'samosa', R), I('Pakoray (lunch buffet)', 'pakora', R), I('Kheer', 'kheer'),
    I('Gulab jamun (2)', 'gulab_jamun', { servings: 2 })]),
  P('rahat-bakers-isb2', 'Rahat Bakers', 'Rawalpindi', 'Old Airport Rd (Faisal Colony); Tramari, Park Rd Islamabad', W(20344515), [
    I('Cream cake (slice)', 'cake_slice'), I('Chocolate cake (slice)', 'cake_slice', { servings: 1.2 }), I('Pastry', 'pastry'),
    I('Chicken samosa', 'keema_samosa')]),
  // Bahria Town / DHA (Rawalpindi side)
  P('sweet-creme-isb2', 'Sweet Creme', 'Rawalpindi', 'Bahria Town Phase 4', W(10937825), [
    I('Lotus cheesecake blizzard', 'sundae', { servings: 1.5 }), I('Molten lava cake', 'lava_cake'),
    I('Cheesecake with blueberry topping (small slice)', 'cheesecake', { servings: 0.8 }),
    I('Lotus cheesecake ice cream (scoop)', 'ice_cream', { servings: 0.6 }), I('Chocolate dip cone', 'ice_cream', { servings: 0.9 })]),
  P('wildmen-isb2', 'Wildmen Restaurant', 'Rawalpindi', 'Bahria Town Phase 4', W(5985731), [
    I('Beef steak', 'steak', R), I('Fried fish platter', 'fried_fish', { ...R, servings: 2 }),
    I('Chinese chicken chilli', 'chilli_chicken', R), I('Chicken parmesan pasta', 'chicken_parmesan', R),
    I('Loaded fries', 'loaded_fries', R), I('Nachos', 'nachos', R), I('Beef burger', 'beef_burger', R)]),
  P('texas-steak-house-isb2', 'Texas Steak House', 'Rawalpindi', 'Fatima Plaza, Bahria Town Phase 7 (opp. Green Valley)', W(20466127), [
    I('Pepper steak', 'steak', R), I('Mushroom steak', 'steak', { ...R, servings: 1.1 }),
    I('Chicken chunks with tartar sauce', 'nuggets', { ...R, servings: 1.5 }), I('One-bite beef burgers (3 sliders)', 'beef_burger', R)]),
  P('diva-isb2', 'Diva Restaurant', 'Rawalpindi', 'Jinnah Park, Airport Rd; Bahria Town Phase 7', BP_RWP, [
    I('Murgh karahi (per person)', 'chicken_karahi', { ...R, servings: 1.2 }), I('Mutton handi (per person)', 'mutton_karahi', { ...R, servings: 1.2 }),
    I('Chicken ginger', 'chicken_jalfrezi', { ...R, servings: 1.1 }), I('Chapati', 'roti'), I('Pasta', 'creamy_pasta', R)], { check: true }),
  P('mindanos-isb2', 'Mindanos', 'Rawalpindi', 'Bahria Food Street, Bahria Town Phase 7', BP_RWP, [
    I('Chicken grilled panini', 'panini', R), I('Caesar salad', 'caesar_salad', R), I('Molten chicken lasagne', 'lasagna', R),
    I('Cheesy chicken', 'grilled_chicken_meal', { ...R, servings: 1.1 }), I('Black pepper beef steak', 'steak', R)], { check: true }),
  P('bin-riaz-grill-isb2', 'Bin Riaz Grill', 'Rawalpindi', 'Bahria Town Phase 7; D-Block, Satellite Town', BP_RWP, [
    I('Chilman biryani', 'chicken_biryani', { ...R, servings: 1.1 }), I('Chicken cheese handi (per person)', 'chicken_handi', { ...R, servings: 1.3 }),
    I('Chicken handi (per person)', 'chicken_handi', { ...R, servings: 1.2 }), I('Chicken karahi (per person)', 'chicken_karahi', { ...R, servings: 1.2 })],
  { check: true }),
  P('kallisto-isb2', 'Kallisto', 'Rawalpindi', 'Spring North, Bahria Town Phase 7', BP_RWP, [
    I('Mutton karahi (per person)', 'mutton_karahi', { ...R, servings: 1.2 }), I('Steak', 'steak', R), I('Panini', 'panini', R)],
  { check: true }),

  // ---------------- Islamabad: street food, dhabas and nashta ----------------
  P('punjab-samosa-centre-isb2', 'Punjab Samosa Centre', 'Islamabad', 'Allah Wala Plaza, G-9 Markaz (near Karachi Company)', W(9879990), [
    I('Samosa chaat', 'samosa_chaat'), I('Chana chaat', 'chana_chaat'), I('Aloo samosa', 'samosa', S),
    I('Halwa puri (Saturdays)', 'halwa_puri', S), I('Channay', 'cholay', S), I('Meethi lassi', 'sweet_lassi'), I('Chai', 'chai')]),
  P('hanif-rajput-isb2', 'Hanif Rajput Rooftop Grill', 'Islamabad', '6th floor, Pak China Mall, Karachi Company, G-9 Markaz', 'https://travelpal.ai/destinations/asia/pakistan/islamabad/hanif-rajput-rooftop-grill-6th-floor', [
    I('Mutton karahi (half kg, serves 2)', 'mutton_karahi', { ...S, servings: 2.8 }), I('Mutton karahi (per person)', 'mutton_karahi', { ...S, servings: 1.3 }),
    I('Chicken malai boti (one seekh)', 'chicken_boti', S), I('Chicken biryani', 'chicken_biryani', R)]),
  P('quetta-tea-and-tea-isb2', 'Quetta Tea & Tea', 'Islamabad', 'Margalla Plaza, Sumbal Rd, F-10 Markaz', W(7624398), [
    I('Golden malai tea (with cream layer)', 'chai', { servings: 1.4 }), I('Doodh patti chai', 'chai'), I('Saada paratha', 'paratha', S),
    I('Cheese paratha', 'paratha', { ...S, servings: 1.5 }), I('Beef paratha', 'aloo_paratha', { ...S, servings: 1.1 }),
    I('Malai paratha (cream and sugar inside)', 'paratha', { ...S, servings: 1.6 }), I('Fried eggs (2)', 'anda_fry', { ...S, servings: 2 })]),
  P('hyderabadi-chatkhara-isb2', 'Hyderabadi Chatkhara', 'Islamabad', 'Shop 7, F-10/4', W(10601137), [
    I('Dahi bhallay', 'dahi_bhalla'), I('Gol gappay (plate)', 'gol_gappay'), I('Chana chaat', 'chana_chaat')]),
  P('karachi-nihari-f8-isb2', 'Karachi Nihari', 'Islamabad', 'F-8 Markaz (near the district courts)', W(14228954), [
    I('Beef nihari (plate)', 'nihari', { ...S, servings: 1.2 }), I('Naan', 'naan', S), I('Halwa puri', 'halwa_puri', S)]),
  P('kulcha-kebab-isb2', 'Kulcha & Kebab', 'Islamabad', 'Street 14, F-10/2', W(3260465), [
    I('Nihari', 'nihari', { ...S, servings: 1.2 }), I('Lahori cholay', 'cholay', S), I('Kulcha', 'kulcha', S), I('Halwa puri', 'halwa_puri', S)],
  { check: true }),
  P('chacha-jee-karri-pakora-isb2', 'Chacha Jee Karri Pakora', 'Islamabad', 'Street 30, G-7/3 (Blue Area)', W(10718564), [
    I('Karri pakora', 'kadhi_pakora', { ...S, servings: 1.2 }), I('Chana', 'cholay', S), I('Zarda', 'zarda')], { check: true }),
  P('shikarpuri-sweets-isb2', 'Shikarpuri Sweets', 'Islamabad', 'Hussain Plaza, G-9 Markaz', W(11141187), [
    I('Mithai / barfi (piece)', 'mithai'), I('Low-sugar barfi (piece)', 'mithai', { servings: 0.8 }), I('Rasmalai (piece)', 'ras_malai'),
    I('Aloo samosa', 'samosa', S), I('Aloo pakoray (Ramazan, plate)', 'pakora', S), I('Halwa puri', 'halwa_puri', S),
    I('Nihari', 'nihari', S), I('Paratha', 'paratha', S), I('Chana', 'cholay', S)]),
  P('modern-bakers-aabpara-isb2', 'Modern Bakers & Sweets', 'Islamabad', 'Aabpara Market, Street 44, G-6/1', W(13825730), [
    I('Khoya mithai (piece)', 'mithai'), I('Pizza (slice)', 'pizza_slice'), I('Cake (slice)', 'cake_slice'), I('Donut', 'donut'),
    I('Pastry', 'pastry')]),
  P('taimoori-roll-paratha-isb2', 'Taimoori Roll Paratha (TRP)', 'Islamabad', 'Street 54, F-10 Markaz (since 1999)', W(7624397), [
    I('Chicken malai boti paratha roll (regular)', 'paratha_roll', S), I('Chicken malai boti paratha roll (jumbo)', 'paratha_roll', { ...S, servings: 1.4 }),
    I('Boom boom chicken malai boti paratha roll', 'paratha_roll', { ...S, servings: 1.5 }),
    I('Malai garlic & cheese paratha roll', 'paratha_roll', { ...S, servings: 1.3 })]),
  P('syrian-shawarma-isb2', 'Syrian Shawarma', 'Islamabad', 'Sea Sun Complex, F-10 Markaz; Civic Center, Bahria Town', W(7715021), [
    I('Shish taouk shawarma', 'shawarma'), I('Regular chicken shawarma', 'shawarma'),
    I('Shawarma platter (with rice and pickles)', 'shawarma', { servings: 1.8 }), I('Fries', 'fries'), I('Kunafa', 'kunafa')]),
  P('hot-n-chilli-isb2', 'Hot N Chilli', 'Islamabad', 'F-10 Markaz', W(3701495), [
    I('Chicken manchurian', 'manchurian', R), I('Fried rice', 'egg_fried_rice', R),
    I('Chicken malai cheese roll', 'paratha_roll', { ...S, servings: 1.3 }), I('Roll paratha', 'paratha_roll', S),
    I('Chilman biryani', 'chicken_biryani', { ...R, servings: 1.1 }), I('Makhni handi (per person)', 'butter_chicken', { ...R, servings: 1.2 }),
    I('Chicken boti (one seekh)', 'chicken_boti', S)]),
  P('dynasty-fast-foods-g9-isb2', 'Dynasty Fast Foods', 'Islamabad', 'Bewal Market, Mangla Rd, G-9 Markaz', W(10884023), [
    I('Club sandwich', 'club_sandwich'), I('Beef cheese burger (single patty)', 'beef_burger', { servings: 0.7 }), I('Chicken burger', 'chicken_burger'),
    I('Chicken chow mein (salt n pepper)', 'chow_mein'), I('Pulao', 'chicken_pulao'), I('Egg fried rice', 'egg_fried_rice')]),
  P('tawa-ice-cream-rolls-isb2', 'Tawa Ice Cream Rolls', 'Islamabad', 'Link Rd, I-8/1', W(10970861), [
    I('Oreo biscuit ice cream roll', 'ice_cream', { servings: 1.2 }), I('Blueberry ice cream roll', 'ice_cream', { servings: 1.2 }),
    I('Ice cream roll (small)', 'ice_cream', { servings: 0.7 }), I('Cupcake', 'cupcake')]),
  // Peshawari / namak mandi style and dhabas
  P('charsi-tikka-saidpur-isb2', 'Charsi Tikka', 'Islamabad', 'Saidpur Village; F-7 Markaz', W(9699908), [
    I('Namkeen tikka (per person)', 'lamb_tikka', S), I('Patta tikka (per person)', 'lamb_tikka', S),
    I('Namkeen karahi (per person)', 'mutton_karahi', { ...S, servings: 1.3 }), I('Naan', 'naan', S)],
  { check: true }), // Peshawar namak mandi brand (Dawn Images 1175028); Saidpur branch listed as temporarily closed
  P('epice-fish-shinwari-isb2', 'Epicé Fish & Shinwari', 'Islamabad', '5G Emporium, New Islamabad Airport Rd, Top City-1', W(9086173), [
    I('Patta tikka (per person)', 'lamb_tikka', S), I('Ranjha gosht (per person)', 'mutton_karahi', { ...S, servings: 1.2 }),
    I('BBQ half platter (serves 2)', 'mixed_grill', { ...S, servings: 1.5 }), I('Fried fish (portion)', 'fried_fish', { ...S, servings: 1.5 })]),
  P('shahdara-valley-isb2', 'Shahdara Valley Restaurant', 'Islamabad', 'Shahdara Rd (tables in the stream)', W(145595), [
    I('Karahi (per person)', 'chicken_karahi', { ...S, servings: 1.2 }), I('Biryani', 'chicken_biryani', S), I('Nihari', 'nihari', S),
    I('Seekh kebab (2)', 'seekh_kebab', { ...S, servings: 2 }), I('Haleem', 'haleem', S), I('Daal makhani', 'daal_makhani', S),
    I('Fries', 'fries', S), I('Gulab jamun (2)', 'gulab_jamun', { servings: 2 }), I('Kheer', 'kheer'), I('Jalebi', 'jalebi')]),

  // ---------------- Islamabad: restaurants and fine dining ----------------
  P('basha-istanbul-isb2', 'Basha Istanbul Authentic Turkish Restaurant', 'Islamabad', '3rd floor, 6-B Bhittai Rd, F-7 Markaz', W(6308573), [
    I('Chicken hummus', 'hummus', { ...R, servings: 1.3 }), I('Chicken shawarma', 'shawarma', R),
    I('Sikandari (Iskender) kebab', 'doner_kebab', { ...R, servings: 1.4 }), I('Shish tawook (2 skewers)', 'shish_tawook', { ...R, servings: 2 }),
    I('Adana kebab (2 skewers)', 'koobideh_kebab', { ...R, servings: 2.4 }), I('Chicken cheese pide', 'pide', R), I('Kunafa', 'kunafa')]),
  P('zamana-serena-isb2', 'Zamana Café (Serena Hotel)', 'Islamabad', 'Islamabad Serena Hotel, G-5/1', W(2674174), [
    I('Haryali boti (one seekh, buffet)', 'chicken_boti', R), I('Chicken handi (buffet plate)', 'chicken_handi', R),
    I('Biryani (buffet plate)', 'chicken_biryani', { ...R, servings: 0.8 }), I('Halwa puri (brunch)', 'halwa_puri', R),
    I('Live-station omelette', 'omelette', R), I('White sauce pasta', 'creamy_pasta', { ...R, servings: 0.7 }),
    I('Gol gappay', 'gol_gappay'), I('Cheesecake (slice)', 'cheesecake'), I('Tiramisu', 'tiramisu')]),
  P('tiger-temple-isb2', 'Tiger Temple', 'Islamabad', 'Block R, F-6/4 (Blue Area)', W(3064088), [
    I('Goong tod (fried prawns)', 'prawn_tempura', R), I('Chicken & mushroom dumplings', 'dumplings', R),
    I('Chilli basil chicken', 'chilli_chicken', R)]),
  P('yum-chinese-thai-isb2', 'Yum Chinese & Thai', 'Islamabad', 'Street 16, F-7/2', W(3064075), [
    I('Kung pao chicken', 'chilli_chicken', R), I('Vegetable fried rice', 'egg_fried_rice', R),
    I('Chicken wings (buffet)', 'wings', R), I('Mint margarita (welcome drink)', 'mint_lemonade')]),
  P('dumpling-zhang-isb2', 'Dumpling Zhang Restaurant', 'Islamabad', 'Street 55, F-8/4', W(13282319), [
    I('Fried dumplings', 'dumplings', { ...R, servings: 1.1 }), I('Steamed / soup dumplings', 'dumplings', R),
    I('Egg fried rice', 'egg_fried_rice', R)]),
  P('cafe-trieste-isb2', 'Cafe Trieste', 'Islamabad', 'Street 26, Business Bay, Sector F, DHA Phase 1', W(3545330), [
    I('Mushroom steak', 'steak', { ...R, servings: 1.1 }), I('Jalapeño steak', 'steak', { ...R, servings: 1.1 }),
    I('Rattlesnake pasta', 'creamy_pasta', { ...R, servings: 1.3 }), I('Chicken nachos', 'nachos', R), I('Chocolate waffle', 'waffles', R),
    I('Mojito', 'mint_lemonade')]),
  P('lebanese-rotisserie-isb2', 'Lebanese Rotisserie', 'Islamabad', 'Capital Trade Center, F-10', Z('top-middle-eastern-restaurants-islamabad'), [
    I('Rotisserie chicken meal (quarter, vermicelli rice, hummus, garlic sauce)', 'roast_chicken', { ...R, servings: 1.4 }),
    I('Lebanese platter (shish taouk, fish, lamb chops, beef mashwi; serves 2–3)', 'mixed_grill', { ...R, servings: 2.5 }),
    I('Shish taouk (2 skewers)', 'shish_tawook', { ...R, servings: 2 }), I('Fattoush', 'fattoush'), I('Hummus', 'hummus'),
    I('Garlic sauce (tub)', 'toum')], { check: true }),
  P('al-beirut-isb2', 'Al-Beirut', 'Islamabad', 'Blue Area; F-10 Markaz', Z('top-middle-eastern-restaurants-islamabad'), [
    I('Cheese manakeesh', 'manakish_cheese', R), I('Zaatar manakeesh', 'manakish_zaatar', R), I('Chicken mandi', 'chicken_mandi', R),
    I('Grilled fish', 'grilled_fish', R), I('Chicken shawarma sandwich', 'shawarma', R)], { check: true }),
  P('serai-bistro-isb2', 'Serai Bistro', 'Islamabad', 'Street 31, G-5 (Diplomatic Enclave); Beverly Centre; Street 4, F-7/3', Z('top-middle-eastern-restaurants-islamabad'), [
    I('Shish taouk (2 skewers)', 'shish_tawook', { ...R, servings: 2 }), I('Lebanese mixed salad platter', 'fattoush', R),
    I('Hummus', 'hummus'), I('Beef burger', 'beef_burger', R), I('Steak', 'steak', R)], { check: true }),
  P('doka-mocca-isb2', 'Doka Mocca', 'Islamabad', 'Crescent Arcade, G-8 Markaz', Z('7-burger-joints-islamabad-must-visit'), [
    I('Mexican grilled burger', 'chicken_burger', { ...R, servings: 1.3 }), I('Beef burger', 'beef_burger', R), I('Panini', 'panini', R),
    I('Pasta', 'creamy_pasta', R), I('Grilled chicken', 'grilled_chicken_meal', R), I('Stuffed French toast', 'french_toast', { ...R, servings: 1.3 }),
    I('Fresh juice', 'fresh_juice')]),
  // DHA / Gulberg Greens
  P('sizzlers-dha-isb2', 'Sizzlers Grill & Coffee House', 'Islamabad', 'Opp. Roots Ivy, Sector A, DHA Phase 2', Z('most-popular-restaurants-dha-islamabad'), [
    I('American breakfast platter', 'english_breakfast', R), I('French toast', 'french_toast', R), I('Pancakes', 'pancakes', R),
    I('Eggs Benedict', 'eggs_benedict', R), I('Omelette', 'omelette', R), I('Chicken karahi (per person)', 'chicken_karahi', { ...R, servings: 1.2 }),
    I('Steak', 'steak', R), I('Burger', 'beef_burger', R)], { check: true }),
  P('mattanys-dha-isb2', "Mattany's", 'Islamabad', 'Adjacent Al Ghurair Giga head office, DHA Phase 2', Z('most-popular-restaurants-dha-islamabad'), [
    I('Deep-dish pizza, small 6" (whole)', 'cheesy_pizza_slice', { ...R, servings: 2 }),
    I('Deep-dish pizza, regular 8" (whole)', 'cheesy_pizza_slice', { ...R, servings: 3.5 }),
    I('Deep-dish pizza, large 12" (whole)', 'cheesy_pizza_slice', { ...R, servings: 7 }),
    I('Alfredo pasta', 'creamy_pasta', { ...R, servings: 1.2 }), I('Zinger burger', 'zinger_burger', R),
    I('Fried chicken (2 pieces)', 'fried_chicken', { ...R, servings: 2 }), I('Chicken wings', 'wings', R)], { check: true }),
  P('crema-gulberg-isb2', 'CREMA', 'Islamabad', 'Main Islamabad Expressway, Gulberg Greens', W(3385799), [
    I('Lotus cheesecake (slice)', 'cheesecake'), I('Breakfast platter', 'english_breakfast', R), I('Molten lava cake', 'lava_cake'),
    I('Panini', 'panini', R), I('Club sandwich', 'club_sandwich', R), I('Café latte', 'latte')]),
  P('capresso-cafe-isb2', 'Capresso Cafe', 'Islamabad', 'Downtown Giga, Sector A, DHA Phase 2', W(4112177), [
    I('Affogato (vanilla ice cream + espresso)', 'ice_cream', { servings: 0.5 }), I('Café latte', 'latte'), I('Cappuccino', 'cappuccino'),
    I('Americano', 'americano')], { check: true }),
  P('the-coffee-house-i9-isb2', 'The Coffee House', 'Islamabad', '349 Street 1, I-9/3 (industrial area)', W(10700588), [
    I('Café latte', 'latte'), I('Cappuccino', 'cappuccino'), I('Iced latte', 'iced_latte'), I('Tea', 'chai')], { check: true }),
];
