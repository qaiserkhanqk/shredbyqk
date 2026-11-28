// Lahore cafés and restaurants, researched Nov 2026 from foodpanda listings, Dawn, Express Tribune, The News, Daily Times,
// ProPakistani, Graana, Samaa and Wanderlog (the source for each place is in `url`). Each item is a QK estimate from the
// closest dish model unless it has `official` values. Places marked `check` were weakly sourced or possibly closed.
const I = (name, dish, opts = {}, official = null) => ({ name, dish, opts, ...(official ? { official } : {}) });
const R = { style: 'restaurant', styleKnown: true }, S = { style: 'shaadi', styleKnown: true };
const O = (kcal, protein, carbs, fat, source, url) => ({ kcal, protein, carbs, fat, source, url });
const P = (id, name, city, area, url, items, extra = {}) => ({ id, name, type: 'Local', city, area, url, items, ...extra });
export const LHE_PLACES = [
  // Cafés, coffee and brunch
  P('mocca-lhe', 'Mocca Coffee', 'Lahore', 'Gulberg III; DHA Phase 6; Mall 94', 'https://www.foodpanda.pk/restaurant/v3rx/mocca-coffee-phase-6', [
    I('Mocca Brunch', 'english_breakfast', R), I('Waffles', 'waffles', R), I('Pancakes', 'pancakes', R),
    I('Brownie melt', 'brownie', { servings: 1.5 }), I('Tres leches cake', 'cake_slice', { servings: 1.3 }),
    I('Spicy chicken thin-crust pizza (whole)', 'pizza_slice', { ...R, servings: 4 }), I('Stuffed chicken', 'grilled_chicken_meal', R),
    I('Mochaccino', 'mocha'), I('Caramelito', 'caramel_macchiato'), I('Hazel Nocciola', 'latte', { servings: 1.1 })]),
  P('coco-cubano-lhe', 'Coco Cubano', 'Lahore', 'Off MM Alam Road, Gulberg', 'https://www.dawn.com/news/1534672', [
    I('Chicken Cubano sandwich', 'panini', { ...R, servings: 1.2 }), I('Southern fried chicken tacos', 'tacos', R), I('Fish tacos', 'tacos', R),
    I('Burrito', 'burrito', R), I('Nachos', 'nachos', R), I('Chicken schnitzel', 'chicken_parmesan', { ...R, servings: 0.9 }), I('Cuban coffee', 'espresso')]),
  P('butlers-lhe', 'Butlers Chocolate Café', 'Lahore', 'Gulberg III (Block C3); Packages Mall', 'https://www.foodpanda.pk/restaurant/s4cc/butlers-chocolate-cafe-lahore', [
    I('Butlers signature hot chocolate (milk / white / dark)', 'hot_chocolate'), I('Signature milk chocolate shake', 'milkshake', { servings: 1.2 }),
    I('Mac & cheese', 'mac_and_cheese', { ...R, servings: 1.2 }), I('Butlers club sandwich', 'club_sandwich', R), I('Irish breakfast', 'english_breakfast', R),
    I('Pasta au gratin', 'creamy_pasta', { ...R, servings: 1.3 }), I('Three egg omelette', 'omelette', { ...R, servings: 1.5 }),
    I('Philly steak sandwich', 'sub_6', { ...R, servings: 1.2 }), I('Chocolate lava cake', 'lava_cake'), I('Latte', 'latte')]),
  P('english-tea-house-lhe', 'English Tea House', 'Lahore', 'Gulberg III; DHA', 'https://www.foodpanda.pk/restaurant/v2d2/english-tea-house', [
    I('Buttermilk pancakes', 'pancakes', R), I('Egg royale', 'eggs_benedict', R), I('Waffles', 'waffles', R), I('Omelette', 'omelette', R),
    I('Fettuccine Alfredo', 'creamy_pasta', { ...R, servings: 1.3 }), I('Spaghetti carbonara', 'creamy_pasta', { ...R, servings: 1.3 }),
    I('Stuffed chicken', 'grilled_chicken_meal', R), I('Grilled lamb chops (4)', 'mutton_chops', { ...R, servings: 4 }), I('Cappuccino', 'cappuccino')]),
  P('third-culture-lhe', 'Third Culture Coffee', 'Lahore', 'Cantt; Gulberg; DHA; Model Town', 'https://www.foodpanda.pk/restaurant/xqgz/third-culture-coffee-cantt', [
    I('Iced Spanish latte', 'spanish_latte'), I('Iced tiramisu latte', 'spanish_latte', { servings: 1.1 }), I('Iced sea salt matcha vanilla', 'matcha_latte', { servings: 1.1 }),
    I('Beef brisket sandwich', 'grilled_sandwich', { ...R, servings: 1.2 }), I('Carrot cake', 'cake_slice', { servings: 1.3 }), I('Sugar-free keto brownie', 'brownie')]),
  P('coffee-tea-company-lhe', 'Coffee Tea & Company', 'Lahore', 'Gulberg III', 'https://www.foodpanda.pk/restaurant/rr38/coffee-tea-and-company-ctc', [
    I('Grilled chicken club sandwich', 'club_sandwich', R), I('Omelette', 'omelette', R), I('Waffles', 'waffles', R), I('Steak and eggs', 'steak', R),
    I('Desi nashta (halwa puri)', 'halwa_puri', R), I('Cappuccino', 'cappuccino')]),
  P('cafe-barbera-lhe', 'Café Barbera', 'Lahore', 'Mahmood Kasuri Road, Gulberg', 'https://wanderlog.com/place/details/10837229/caf%C3%A9-barbera', [
    I('Thin-crust pizza (whole)', 'pizza_slice', { ...R, servings: 3 }), I('Omelette', 'omelette', R), I('Espresso', 'espresso'), I('Cappuccino', 'cappuccino'), I('Latte', 'latte')]),
  P('the-pantry-lhe', 'The Pantry by The Polo Lounge', 'Lahore', 'Mall 1, Main Boulevard Gulberg III', 'https://www.foodpanda.pk/restaurant/d3rr/the-pantry-mall-1', [
    I('Chicken jalapeño grilled sandwich', 'grilled_sandwich', R), I('Herbed chicken grilled sandwich', 'grilled_sandwich', R),
    I('Pantry special pasta', 'creamy_pasta', { ...R, servings: 1.2 }), I('Cappuccino', 'cappuccino'), I('Café latte', 'latte'), I('Mocha latte', 'mocha')]),
  P('deja-lhe', 'Deja by Khadija', 'Lahore', 'Sui Gas Society', 'https://tribune.com.pk/story/2108484/table-talk-deja', [
    I('Toastie', 'grilled_sandwich', R), I('Eggs (scrambled)', 'scrambled_eggs', R), I('Croissant', 'croissant'), I('Breakfast platter', 'english_breakfast', { ...R, servings: 0.8 })]),
  P('cafe-upstairs-lhe', 'The Café Upstairs', 'Lahore', '11-C Main Gulberg', 'https://tribune.com.pk/story/328945/entertainment', [
    I('Pizza (whole)', 'pizza_slice', { ...R, servings: 4 }), I('Mushroom & truffle fettuccine', 'creamy_pasta', { ...R, servings: 1.3 }),
    I('Florentine pasta', 'creamy_pasta', { ...R, servings: 1.3 }), I('Steak', 'steak', R), I('Red velvet cake', 'cake_slice', { servings: 1.2 }),
    I('Chocolate Explosion', 'cake_slice', { servings: 1.4 })], { check: true }),
  P('peerus-lhe', "Peeru's Café", 'Lahore', 'Green Acres, Raiwind Road; CSD Mall, Cavalry Ground', 'https://thefridaytimes.com/17-Jan-2023/peeru-s-cafe-opens-second-branch-of-experiential-restaurant-in-lahore', [
    I("Chef's special BBQ platter", 'mixed_grill', R), I('Beef mushroom steak', 'steak', R), I('Cheesecake with strawberry sauce', 'cheesecake')]),
  P('freddys-lhe', "Freddy's Café", 'Lahore', 'MM Alam Road, Gulberg III', 'https://app.wanderlog.com/place/details/2670151', [
    I('Steak', 'steak', R), I('Margherita pizza (whole)', 'pizza_slice', { ...R, servings: 4 }), I('Pasta', 'creamy_pasta', { ...R, servings: 1.3 })], { check: true }),

  // Bakeries and desserts
  P('jalal-sons-lhe', 'Jalal Sons', 'Lahore', 'Gulberg Main Market; DHA Phase 4/6/8; Model Town; Johar Town; Cantt and more', 'https://www.foodpanda.pk/restaurant/lyl2/jalal-sons-main-market-gulberg-2', [
    I('Chicken fajita sandwich', 'grilled_sandwich', R), I('Crispy chicken burger', 'zinger_burger', R), I('Pizza (small, whole)', 'pizza_slice', { ...R, servings: 3 }),
    I('Milk cake (slice)', 'cake_slice'), I('Mithai (piece)', 'mithai')]),
  P('shezan-bakers-lhe', 'Shezan Bakers', 'Lahore', 'Cantt; Cavalry Ground; Defence', 'https://www.foodpanda.pk/restaurant/g9h3/shezan-bakers-cantt', [
    I('Chicken sandwiches (4 pieces)', 'club_sandwich', { servings: 0.6 }), I('Chicken patties', 'patties'), I('Chicken cheese patties', 'patties', { servings: 1.1 }),
    I('Chicken pie', 'patties'), I('Chicken roll', 'patties', { servings: 0.9 }), I('Croissant', 'croissant'), I('Chocolate croissant', 'croissant', { servings: 1.2 }),
    I('Chocolate Swiss roll', 'cream_roll'), I('Bakarkhani', 'bakarkhani')]),
  P('layers-lhe', 'Layers Bakeshop', 'Lahore', 'Allama Iqbal Town; Johar Town; Model Town; DHA and more (also other cities)', 'https://www.foodpanda.pk/restaurant/mf1t/layers-bakeshop-allama-iqbal-town', [
    I('Nutella-filled chocolate chunk cookie', 'chocolate_chip_cookie', { servings: 1.5 }), I('Triple chocolate cookie', 'chocolate_chip_cookie', { servings: 1.5 }),
    I('Milky malt cake (slice)', 'cake_slice', { servings: 1.2 }), I('Three milk cake (slice)', 'cake_slice', { servings: 1.3 }), I('Brownie', 'brownie'), I('Cupcake', 'cake_slice')]),
  P('sweet-creme-lhe', 'Sweet Creme', 'Lahore', 'Gulberg; Cantt; Mumtaz Market; Raiwind Road', 'https://www.foodpanda.pk/restaurant/arns/sweet-creme-gulberg', [
    I('Super cup', 'ice_cream'), I('Molten lava with vanilla base', 'lava_cake', { servings: 1.3 }), I('Brownie with vanilla base', 'brownie', { servings: 1.4 }),
    I('Super Sonic super fudge loaded sundae', 'sundae'), I('Oreo blizzard', 'ice_cream', { servings: 2 })]),
  P('frosti-lhe', 'Frosti', 'Lahore', '', 'https://thenews.com.pk/tns/detail/566710-frosti-bites', [
    I('Soft-serve in waffle cone', 'ice_cream'), I('Cake ice cream sundae', 'sundae', { servings: 0.65 }), I('Lotus / salted caramel ice cream', 'ice_cream')], { check: true }),

  // Continental, steak and burgers
  P('the-brasserie-lhe', 'The Brasserie', 'Lahore', 'Mall 1, Main Boulevard Gulberg III', 'https://dailytimes.com.pk/138504/french-food-arrives-brasserie/', [
    I('Cheese & mushroom omelette', 'omelette', R), I('English breakfast', 'english_breakfast', R), I('Nutella French toast', 'french_toast', { ...R, servings: 1.2 }),
    I('BBQ wings', 'wings', R), I('Chicken lasagne', 'lasagna', R), I('Chicken with sundried tomato sauce', 'grilled_chicken_meal', R),
    I('Greek lamb chops (4)', 'mutton_chops', { ...R, servings: 4 })]),
  P('arcadian-lhe', 'Arcadian Café', 'Lahore', 'Packages Mall; Sir Syed Road, Gulberg II; Emporium Mall (Signature)', 'https://www.foodpanda.pk/restaurant/is4o/arcadian-cafe-packages-mall-is4o/reviews', [
    I('Loaded fries', 'loaded_fries', R), I('Thai basil chicken', 'manchurian', R), I('Arcadian special pizza (whole)', 'pizza_slice', { ...R, servings: 4 }),
    I('Molten lava cake', 'lava_cake'), I('Hot & sour soup', 'corn_soup'), I('Open face sandwich', 'grilled_sandwich', R),
    I('Chicken hot garlic', 'manchurian', R), I('Fish hot garlic', 'manchurian', R)]),
  P('polo-lounge-lhe', 'Polo Lounge', 'Lahore', 'Lahore Polo Ground, Cantt', 'https://tribune.com.pk/story/78976/entertainment', [
    I('Gourmet beef burger', 'beef_burger', { ...R, servings: 1.3 }), I('Mongolian chicken', 'chilli_chicken', R), I('Puddle cake', 'lava_cake'), I('Steak', 'steak', R)]),
  P('el-momento-lhe', 'El Momento', 'Lahore', 'MM Alam Road, Gulberg II', 'https://wanderlog.com/place/details/7624526', [
    I('Beef steak', 'steak', R), I('Chicken chilli dry', 'chilli_chicken', R), I('Alfredo pasta', 'creamy_pasta', { ...R, servings: 1.3 }), I('Fries', 'fries', R)]),
  P('karnivora-lhe', 'Karnivora Steakhouse', 'Lahore', 'Near Mall One, Gulberg; Bahria Town (Tulip Block)', 'https://propakistani.pk/2025/04/12/fine-dining-gets-fierce-karnivora-now-open-in-gulberg/', [
    I('Australian beef steak', 'steak', R), I('Fillet mignon', 'steak', { ...R, servings: 0.9 }), I('Rib-eye steak', 'steak', { ...R, servings: 1.2 }),
    I('T-bone steak', 'steak', { ...R, servings: 1.5 }), I('Beef burger', 'beef_burger', { ...R, servings: 1.2 }), I('Shake', 'milkshake')]),
  P('gun-smoke-lhe', 'Gun Smoke', 'Lahore', '', 'https://dawn.com/news/1175440', [
    I('Original Gun Smoke cowboy steak (300 g)', 'steak', { ...R, servings: 1.2 }), I('Sizzler steak with cheese', 'steak', { ...R, servings: 1.3 }),
    I('Mud pie', 'cake_slice', { servings: 1.5 })], { check: true }),
  P('pasta-la-vista-lhe', 'Pasta La Vista', 'Lahore', 'DHA', 'https://wanderlog.com/place/details/4350564/pasta-la-vista', [
    I('Aglio olio', 'pasta_arrabbiata', { ...R, servings: 1.3 }), I('Tandoori pasta', 'creamy_pasta', { ...R, servings: 1.2 }),
    I('Margherita pizza (whole)', 'pizza_slice', { ...R, servings: 4 }), I('3 cheese pizza (whole)', 'cheesy_pizza_slice', { ...R, servings: 4 }),
    I('Smash burger', 'beef_burger', R), I('Stuffed garlic bread', 'garlic_bread', { servings: 3 }), I('New York cheesecake', 'cheesecake'), I('Carrot cake', 'cake_slice', { servings: 1.3 })]),
  P('daily-deli-lhe', 'Daily Deli Co.', 'Lahore', 'Gulberg; Johar Town (Khayaban-e-Firdousi); Lake City; Cantt', 'https://www.foodpanda.pk/restaurant/t2ul/daily-deli-co-johar-town', [
    I('The Messi (beef)', 'beef_burger', { ...R, servings: 1.2 }), I('DD Classic burger', 'beef_burger', R), I('DD Smokey House burger', 'beef_burger', { ...R, servings: 1.2 }),
    I('The Sunny Rocket (beef, egg)', 'beef_burger', { ...R, servings: 1.3 }), I('Chicken Thunder fillet', 'zinger_burger', R),
    I('Chicken Alfredo pasta', 'creamy_pasta', { ...R, servings: 1.2 }), I('Onion rings', 'onion_rings', R), I('Fries', 'fries', R)]),
  P('melt-lhe', 'Melt', 'Lahore', 'DHA Phase 4', 'https://samaa.tv/2087315038-melt-where-smash-burgers-reign-supreme', [
    I('Melt smash beef burger', 'beef_burger', R), I('Melt chicken burger', 'zinger_burger', R), I('Chicken wrap', 'chicken_wrap', R),
    I('Crinkle-cut fries', 'fries', R), I('Loaded fries (beef / chicken)', 'loaded_fries', R), I('Shake', 'milkshake')]),
  P('wild-wings-lhe', 'Wild Wings', 'Lahore', 'Lahore (also Islamabad F-11)', 'https://tribune.com.pk/story/2015713/10-table-talk-wild-wings/', [
    I('Traditional wings (10)', 'wings', { ...R, servings: 1.7 }), I('Traditional wings (5)', 'wings', { ...R, servings: 0.85 }), I('Original naked wings (10)', 'wings', { servings: 1.5 }),
    I('Chilli Cheetos burger', 'zinger_burger', { ...R, servings: 1.2 }), I('Spicy grilled chicken burger', 'chicken_burger', { ...R, servings: 1.3 }),
    I('Chicken Alfredo fettuccine', 'creamy_pasta', { ...R, servings: 1.2 }), I('Shake', 'milkshake')]),
  P('fatburger-lhe', 'Fatburger', 'Lahore', 'Z Block Commercial, DHA Phase 3', 'https://www.qsrmagazine.com/news/fat-burger-opens-newest-pakistani-location-lahore', [
    I('Fatburger (beef)', 'beef_burger', { ...R, servings: 1.3 }), I('Onion rings', 'onion_rings', R), I('Fries', 'fries', R),
    I('Chicken strips', 'nuggets', R), I('Shake (chocolate / Maui banana)', 'milkshake', { servings: 1.2 })], { check: true }),
  P('shezan-restaurant-lhe', 'Shezan Restaurant', 'Lahore', 'Fortress Stadium', 'https://www.foodpanda.pk/restaurant/hoo7/shezan-restaurant-fortress', [
    I('Classic club sandwich', 'club_sandwich', R), I('Chicken biryani', 'chicken_biryani', R), I('Shezan supreme chicken steak', 'grilled_chicken_meal', R),
    I('Shezan Surprise ice cream', 'ice_cream', { servings: 1.3 })]),
  P('nisa-sultan-lhe', 'Nisa Sultan', 'Lahore', 'Lahore (also a mall branch)', 'https://www.thenews.pk/tns/detail/556414-new-wave-turks-town', [
    I('Chicken doner roll', 'doner_kebab', R), I('Lamb doner roll', 'doner_kebab', { ...R, servings: 1.1 }), I('Chicken shish platter', 'shish_tawook', { ...R, servings: 2 }),
    I('Lahmacun pide', 'manakish_meat', R), I('Hummus', 'hummus'), I('Turkish kunefe', 'kunafa'), I('Fries', 'fries', R)]),

  // Chinese, Thai and Japanese
  P('yum-chinese-lhe', 'Yum Chinese & Thai', 'Lahore', '24-K Gulberg; DHA', 'https://www.foodpanda.pk/restaurant/t5jc/yum-chinese-gulberg', [
    I('Chicken Manchurian', 'manchurian', R), I('Kung pao chicken', 'chilli_chicken', R), I('Mongolian beef', 'chilli_chicken', R), I('Chicken with cashew nuts', 'manchurian', R),
    I('Thai basil chicken', 'manchurian', R), I('Tom yum gai soup', 'tom_yum'), I('Pad Thai chicken', 'pad_thai', R), I('Egg fried rice', 'egg_fried_rice', R), I('Chicken chow mein', 'chow_mein', R)]),
  P('fuchsia-lhe', 'Fuchsia Kitchen', 'Lahore', 'Hali Road, Gulberg', 'https://wanderlog.com/place/details/2670182/fuchsia-kitchen', [
    I('Crispy honey beef', 'manchurian', R), I('Cashew nut chicken', 'manchurian', R), I('Sweet & sour chicken', 'manchurian', R), I('Crispy lemon chicken', 'manchurian', R),
    I('Tom yum soup', 'tom_yum'), I('Pad Thai', 'pad_thai', R), I('Crunchy maki sushi', 'sushi_roll'), I('Fried rice', 'egg_fried_rice', R)]),
  P('mandarin-kitchen-lhe', 'Mandarin Kitchen', 'Lahore', 'Gulberg; DHA Phase 3', 'https://www.foodpanda.pk/restaurant/uzue/mandarin-kitchen-gulberg-uzue', [
    I('Crunchy honey beef', 'manchurian', R), I("Chef's special chicken", 'manchurian', R), I('Kung pao chicken', 'chilli_chicken', R), I('Mongolian beef', 'chilli_chicken', R),
    I('Mandarin Manchurian', 'manchurian', R), I('Steamed dumplings', 'dumplings'), I('Hot & sour soup', 'corn_soup'), I('Thai clear soup', 'corn_soup', { servings: 0.8 }),
    I('Egg fried rice', 'egg_fried_rice', R), I('Chicken chow mein', 'chow_mein', R), I('Pad Thai', 'pad_thai', R), I('Katsu maki', 'sushi_roll')]),
  P('pf-changs-lhe', "P.F. Chang's", 'Lahore', '17-C1 MM Alam Road, Gulberg III', 'https://en.dailypakistan.com.pk/15-Jun-2018/pf-chang-s-first-restaurant-opening-up-in-lahore', [
    I('Mongolian beef', 'chilli_chicken', R), I('The Original Dynamite Shrimp', 'manchurian', R), I("Chang's spicy chicken", 'manchurian', R), I('Cheng-du lamb', 'manchurian', R),
    I('Pad Thai (shrimp)', 'pad_thai', R), I('Fried rice', 'egg_fried_rice', R), I('Dim sum', 'dumplings'), I('Sushi roll', 'sushi_roll')]),
  P('sumo-lhe', 'Sumo', 'Lahore', '57-L Gulberg II; DHA Phase 3', 'https://wanderlog.com/place/details/3029035/sumo', [
    I('Dynamite sushi roll', 'sushi_roll', { servings: 1.2 }), I('Crunchy maki', 'sushi_roll', { servings: 1.1 }), I('Nigiri platter', 'sushi_roll'),
    I('Salmon teriyaki', 'teriyaki_chicken_rice', R), I('Chicken teriyaki', 'teriyaki_chicken_rice', R), I('Teppanyaki (chicken / beef)', 'teriyaki_chicken_rice', R)]),
  P('fujiyama-lhe', 'Fujiyama (Avari Lahore)', 'Lahore', 'Avari Hotel, Mall Road', 'https://urbanduniya.com/?p=5388', [
    I('California maki roll', 'sushi_roll'), I('Sushi moriawase platter', 'sushi_roll', { servings: 2 }),
    I('Chicken teppanyaki', 'teriyaki_chicken_rice', R), I('Beef teppanyaki', 'teriyaki_chicken_rice', R)]),
  P('aoki-lhe', 'AoKi Pan Asian', 'Lahore', '', 'https://wanderlog.com/place/details/11488652/aoki-pan-asian-restaurant-best-japanese-restaurant-in-lahore', [
    I('Chicken teriyaki', 'teriyaki_chicken_rice', R), I('Teppanyaki', 'teriyaki_chicken_rice', R), I('Udon noodles', 'ramen', R), I('Sushi roll', 'sushi_roll'), I('Crispy chicken', 'manchurian', R)]),
  P('tokyo-lhe', 'Tokyo Japanese Restaurant', 'Lahore', 'C-Block, Gulberg', 'https://www.dawn.com/news/1190974/tokyo-ultimate-place-for-a-classy-japanese-meal-in-style', [
    I('Sushi roll', 'sushi_roll'), I('Teppanyaki', 'teriyaki_chicken_rice', R), I('Udon', 'ramen', R)], { check: true }),

  // Desi, BBQ and kebabs
  P('spice-bazaar-lhe', 'Spice Bazaar', 'Lahore', '1-T Gulberg (off MM Alam Road); DHA Phase 6', 'https://tribune.com.pk/story/928068/entertainment', [
    I('Tawa chicken (per person)', 'chicken_karahi', { ...R, servings: 1.3 }), I('Nihari', 'nihari', R), I('Malai boti', 'chicken_boti', { ...R, servings: 2 }),
    I('Palak paneer', 'palak_paneer', R), I('Shami kebab', 'shami_kebab', R), I('Dahi bhallay', 'dahi_bhalla', R), I('Naan', 'naan', R)]),
  P('baranh-lhe', 'Baranh — Exotic Cuisine of Old Lahore', 'Lahore', 'Gaddafi Stadium', 'https://www.dawn.com/news/1411631', [
    I('Tawa chicken (per person)', 'chicken_karahi', { ...R, servings: 1.3 }), I('Tawa qeema', 'qeema', R), I('Sultani haleem', 'haleem', R),
    I('Galouti kebab (2)', 'shami_kebab', { ...R, servings: 2 }), I('Aatay ki puri', 'puri', R), I('Pathooray chanay', 'cholay', R), I('Halwa puri plate', 'halwa_puri', R)]),
  P('zouq-e-saeed-lhe', 'Zouq-e-Saeed', 'Lahore', 'Gulberg III', 'https://www.foodpanda.pk/restaurant/j2ew/zouq-e-saeed', [
    I('Chicken cheese kebab (2)', 'seekh_kebab', { ...R, servings: 2 }), I('Kakori beef kabab (2)', 'seekh_kebab', { ...R, servings: 2 }),
    I('Murgh tikka boti', 'chicken_boti', { ...R, servings: 2 }), I('BBQ platter (for 3)', 'mixed_grill', { ...R, servings: 3 }),
    I('Mutton karahi (per person)', 'mutton_karahi', { ...R, servings: 1.5 }), I('Butter chicken handi', 'butter_chicken', R), I('Weekend breakfast platter (halwa puri)', 'halwa_puri', R)]),
  P('bagh-lhe', 'Bagh — The Desi Experience', 'Lahore', 'HEC Park, off MM Alam Road, Gulberg III', 'https://wanderlog.com/place/details/3578431/bagh-the-desi-experience', [
    I('Mutton karahi (per person)', 'mutton_karahi', { ...R, servings: 1.5 }), I('Patiala handi', 'chicken_handi', R), I('BBQ platter (for 2)', 'mixed_grill', { ...R, servings: 2 }),
    I('Mutton chops (4)', 'mutton_chops', { ...R, servings: 4 })]),
  P('chili-chutney-lhe', 'Chili Chutney', 'Lahore', 'Johar Town (near Doctors Hospital)', 'https://tribune.com.pk/story/1081212/entertainment', [
    I('Khas chili kebab (2)', 'seekh_kebab', { ...R, servings: 2 }), I('Black pepper chicken handi', 'chicken_handi', R), I('Garlic naan', 'garlic_naan', R),
    I('Roghni naan', 'roghni_naan', R), I('Chicken chow mein', 'chow_mein', R)]),
  P('siddique-bhaiya-kabab-lhe', 'Siddique Bhaiya Kabab', 'Lahore', 'Model Town', 'https://www.foodpanda.pk/restaurant/j6ba/siddique-bhaiya-kabab-model-town', [
    I('Beef seekh kabab', 'seekh_kebab', S), I('Chicken seekh kabab', 'seekh_kebab', { ...S, servings: 0.9 }), I('Mutton seekh kabab', 'seekh_kebab', S)]),
  P('bhatti-tikka-lhe', 'Bhatti Tikka House', 'Lahore', '', 'https://wanderlog.com/place/details/11759393/bhatti-tikka-house', [
    I('Chicken tikka', 'chicken_tikka', S), I('Chicken boti', 'chicken_boti', S), I('Chicken karahi (per person)', 'chicken_karahi', { ...S, servings: 1.5 })]),
  P('meeruth-kabab-lhe', 'Jehangir Meeruth Kabab House', 'Lahore', '', 'https://tribune.com.pk/story/823429/the-best-bbq', [
    I('Seekh kabab (2)', 'seekh_kebab', { ...S, servings: 2 }), I('Chicken tikka', 'chicken_tikka', S), I('Chicken boti', 'chicken_boti', S)], { check: true }),
];
