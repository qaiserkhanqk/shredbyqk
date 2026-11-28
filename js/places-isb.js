// Islamabad (and Rawalpindi / Bahria / DHA) cafés and restaurants, researched Nov 2026 from Wanderlog place pages
// (Google reviews and the press snippets they quote), Dawn, Arab News, ProPakistani, Zameen and Blogpakistan. Menu items
// are the dishes reviewers and articles actually name. Each item is a QK estimate from the closest dish model unless it
// has `official` values. Places marked `check` were weakly sourced or possibly closed.
const I = (name, dish, opts = {}, official = null) => ({ name, dish, opts, ...(official ? { official } : {}) });
const R = { style: 'restaurant', styleKnown: true }, S = { style: 'shaadi', styleKnown: true };
const O = (kcal, protein, carbs, fat, source, url) => ({ kcal, protein, carbs, fat, source, url });
const P = (id, name, city, area, url, items, extra = {}) => ({ id, name, type: 'Local', city, area, url, items, ...extra });
const W = (id) => `https://wanderlog.com/place/details/${id}`;

export const ISB_PLACES = [
  // Cafés, brunch and coffee
  P('isb-tuscany-courtyard', 'Tuscany Courtyard', 'Islamabad', 'Kohsar Market, F-6/3', W(2674225), [
    I('East Side Cheese Panini (beef & cheese)', 'panini', R), I('Spicy jalapeño pasta', 'creamy_pasta', { ...R, servings: 1.3 }),
    I('Pesto penne pasta (creamy pesto, mushroom, grilled chicken)', 'creamy_pasta', { ...R, servings: 1.3 }),
    I('Tuscany Special Pizza (4 slices)', 'pizza_slice', { ...R, servings: 4 }), I('Dumplings', 'dumplings', R),
    I('Fries', 'fries', R), I('Brownie skillet with ice cream', 'brownie', { servings: 1.8 })]),
  P('isb-street-1-cafe', 'Street 1 Café', 'Islamabad', 'Kohsar Market, F-6/3; G-5 Markaz', W(2674230), [
    I('Nutella French toast', 'french_toast', { ...R, servings: 1.2 }), I('Stuffed French toast', 'french_toast', { ...R, servings: 1.3 }),
    I('Philly steak / steak cheese omelette', 'omelette', { ...R, servings: 1.6 }), I('Steak', 'steak', R),
    I('Italian chicken with red sauce pasta', 'grilled_chicken_meal', { ...R, servings: 1.1 }), I('Beef burger', 'beef_burger', R),
    I('Café latte', 'latte'), I('Peach iced tea', 'iced_tea')]),
  P('isb-roasters', 'Roasters Coffee House & Grill', 'Islamabad', 'F-6 Markaz (Agha Khan Rd); Bahria Town Phase 7 (Spring North)', W(12746848), [
    I('Beef tenderloin steak', 'steak', R), I('Mashed potatoes (side)', 'mashed_potatoes', R),
    I('Italian chicken', 'grilled_chicken_meal', R), I('Buffalo wings', 'wings', R), I('Beef burger', 'beef_burger', R),
    I('Café latte', 'latte')]),
  P('isb-sage-cafe-grill', 'Sage Café & Grill (formerly Roasters F-7)', 'Islamabad', 'Bhittai Rd, F-7 Markaz', W(2674204), [
    I('Sizzling steak', 'steak', { ...R, servings: 1.1 }), I('Cappuccino', 'cappuccino'), I('Café latte', 'latte')]),
  P('isb-butlers-chocolate-cafe', 'Butlers Chocolate Café', 'Islamabad', 'School Rd, F-6 Markaz', W(5948964), [
    I('Flat white', 'flat_white'), I('French toast', 'french_toast', R),
    I('Pasta au gratin (serves ~2)', 'creamy_pasta', { ...R, servings: 1.8 }), I('Crumble chicken with fries & salad', 'chicken_parmesan', R),
    I('Smoke pizza (4 slices)', 'pizza_slice', { ...R, servings: 4 }), I('Cheesecake (slice)', 'cheesecake', { servings: 0.8 }),
    I('Hot chocolate', 'hot_chocolate')]),
  P('isb-second-cup', 'Second Cup Coffee Company', 'Islamabad', 'Super Market F-6; F-11 Markaz; Park View City', W(3064077), [
    I('Café latte', 'latte'), I('Cappuccino', 'cappuccino'), I('Mocha', 'mocha'), I('Muffin', 'muffin'),
    I('All-day breakfast', 'english_breakfast', R)]),
  P('isb-coffee-bean', 'The Coffee Bean & Tea Leaf', 'Islamabad', 'Mount View Plaza F-6 Markaz; I-8 Markaz; Olympus Mall F-11', W(3385856), [
    I('Café latte', 'latte'), I('Cappuccino', 'cappuccino'), I('Americano', 'americano'), I('Ice Blended mocha', 'frappuccino')]),
  P('isb-kaf-coffee', 'KAF Coffee', 'Islamabad', 'Roomy Signature Hotel, F-6 Markaz', W(7787839), [
    I('Iced Spanish latte', 'spanish_latte', { servings: 1.1 }), I('Dubai cake (slice)', 'cake_slice', { servings: 1.4 }),
    I('Saffron cake (slice)', 'cake_slice', { servings: 1.2 }), I('Cappuccino', 'cappuccino')]),
  P('isb-shaghf', 'Shaghf Coffee', 'Islamabad', 'Najam Market, F-8/4', W(7773381), [
    I('Café latte', 'latte'), I('Iced latte', 'iced_latte'), I('Cappuccino', 'cappuccino'), I('Americano', 'americano')]),
  P('isb-english-tea-house', 'English Tea House', 'Islamabad', 'Street 16, F-7/2', W(2849145), [
    I('English breakfast', 'english_breakfast', R), I('Tea (pot, with milk)', 'chai', { servings: 1.5 }),
    I('Club sandwich', 'club_sandwich', R), I('Cake (slice)', 'cake_slice'), I('Weekend desi breakfast (halwa puri)', 'halwa_puri', R)]),
  P('isb-eggspectation', 'Eggspectation', 'Islamabad', 'Street 10, F-6/3 (Kohsar); The Allegiance, F-9', W(5952281), [
    I('Eggs Benedict', 'eggs_benedict', R), I('Pancakes', 'pancakes', R), I('Omelette', 'omelette', R),
    I('Grilled chicken croissant', 'panini', R), I('Chicken cheese croissant melt', 'panini', { ...R, servings: 1.1 }),
    I('Lyonnaise potatoes', 'fries', { ...R, servings: 1.2 }), I('Chicken Florentine', 'grilled_chicken_meal', R),
    I('Spaghetti', 'spaghetti_bolognese', R), I('Peach iced tea', 'iced_tea')]),
  P('isb-brew', 'Brew', 'Islamabad', 'Shaheen Market, E-7', W(10700450), [
    I('Breakfast platter', 'english_breakfast', R), I('Cappuccino', 'cappuccino'), I('Doodh patti chai', 'chai')]),
  P('isb-cafe-rustic', 'Café Rustic', 'Islamabad', 'Shaheen Market, E-7', W(3064047), [
    I('Angus beef burger', 'beef_burger', { ...R, servings: 1.3 }), I('Beef steak', 'steak', R),
    I('Tomahawk steak (sharing)', 'steak', { ...R, servings: 2.5 }), I('Breakfast platter', 'english_breakfast', R), I('Fries', 'fries', R)]),
  P('isb-bistro-noir', 'Bistro Noir', 'Islamabad', 'Gol Market, F-7/3', W(5357244), [
    I('Mushroom soup', 'cream_soup', R), I('Crackling chicken (starter)', 'nuggets', { ...R, servings: 1.5 }),
    I('Margherita pizza with chicken (4 slices)', 'pizza_slice', { ...R, servings: 4 }), I('Rigatoni pasta', 'creamy_pasta', { ...R, servings: 1.3 }),
    I('Burrata salad', 'greek_salad', R), I('Steak frites', 'steak', R), I('Fries (with steak frites)', 'fries', R),
    I('Chocolate dessert with vanilla ice cream', 'lava_cake')]),
  P('isb-cannoli-cafe-soul', 'Cannoli by Café Soul', 'Islamabad', 'Gol Market F-7/3; Beverly Centre', W(2849116), [
    I('Juicy Lucy beef burger', 'beef_burger', { ...R, servings: 1.2 }), I('Spicy burger', 'beef_burger', R),
    I('Tangy tomato pasta with turkey bacon', 'pasta_arrabbiata', { ...R, servings: 1.2 }), I('Lemon & basil pasta', 'creamy_pasta', R),
    I('Herb-crusted grilled chicken', 'grilled_chicken_meal', R), I('Caesar salad', 'caesar_salad', R), I('Fries', 'fries', R),
    I('Cheesecake (slice)', 'cheesecake')]),
  P('isb-daily-deli', 'Daily Deli Co.', 'Islamabad', 'Beverly Centre, Blue Area F-6/1', W(11597373), [
    I('Sunny Rocket (double beef patty)', 'beef_burger', { ...R, servings: 1.4 }), I('Simple beef burger', 'beef_burger', R),
    I('Fries', 'fries', R), I('Waffle fries', 'fries', { ...R, servings: 1.1 })]),
  P('isb-chai-shai', 'Chai Shai', 'Islamabad', 'behind PSO pump, F-7 Markaz', W(3385827), [
    I('Papri chaat', 'samosa_chaat', R), I('Spicy chicken roll', 'paratha_roll', S), I('Aloo paratha', 'aloo_paratha', S),
    I('Cheese paratha', 'paratha', { ...S, servings: 1.4 }), I('Kashmiri chai', 'chai', { servings: 1.3 })]),

  // Desserts, bakeries, ice cream
  P('isb-hot-spot', 'The Hot Spot', 'Islamabad', 'Gol Market F-7/3; Saidpur Village; Bahria Town; F-17', W(3064057), [
    I('Fudge cake with ice cream', 'cake_slice', { servings: 1.8 }), I('Squidgy cake', 'cake_slice', { servings: 1.3 }),
    I('Brownie with vanilla ice cream', 'brownie', { servings: 1.6 }), I('Ice cream (2 scoops)', 'ice_cream'),
    I('Beef cheese burger', 'beef_burger', R), I('Neapolitan pizza (4 slices)', 'pizza_slice', { ...R, servings: 4 })]),
  P('isb-soft-swirl', 'Soft Swirl', 'Islamabad', 'Bhittai Rd, F-7 Markaz; Capital Trade Centre', W(3926794), [
    I('Soft-serve cup', 'ice_cream'), I('Brownie with soft swirl', 'brownie', { servings: 1.5 }),
    I('Molten lava cake with vanilla ice cream', 'lava_cake', { servings: 1.2 })]),
  P('isb-kaspas', "Kaspa's Desserts", 'Islamabad', 'Agha Khan Rd, F-6 Markaz', 'https://www.islamabadscene.com/?p=11955', [
    I('American waffle with toppings', 'waffles', { servings: 1.2 }), I('Ice cream sundae', 'ice_cream', { servings: 2 }),
    I('Milkshake', 'milkshake'), I('Cake (slice)', 'cake_slice')]),
  P('isb-sweetaholic', 'Sweetaholic', 'Islamabad', 'Roomy Signature Hotel, F-6 Markaz', W(8512374), [
    I('Ice cream (2 scoops)', 'ice_cream'), I('Pistachio milk cake (slice)', 'cake_slice', { servings: 1.3 }),
    I('Breakfast platter', 'english_breakfast', R)]),
  P('isb-waffles-by-waheed', 'Waffles By Waheed', 'Islamabad', 'City Center Plaza, F-10 Markaz', W(10970860), [
    I('All-topping ice cream waffle', 'waffles', { servings: 1.3 }), I('Milkshake', 'milkshake'), I('Coffee', 'cappuccino')]),
  P('isb-cinnabon', 'Cinnabon', 'Islamabad', 'Centaurus Mall F-8/4; Giga Mall DHA 2', W(10700589), [
    I('Classic Cinnabon roll', 'cinnamon_roll', { servings: 1.5 }), I('Chocobon', 'cinnamon_roll', { servings: 1.6 }),
    I('Caramel PecanBon', 'cinnamon_roll', { servings: 1.9 }), I('Minibon', 'cinnamon_roll', { servings: 0.6 }), I('Café latte', 'latte')]),
  P('isb-layers', 'Layers Bakeshop', 'Rawalpindi', 'Spring North, Bahria Town Phase 7; Central Park, DHA Phase 2', W(10937826), [
    I('Three-milk chocolate cake (slice)', 'cake_slice', { servings: 1.3 }), I('Chocolate cake (slice)', 'cake_slice', { servings: 1.2 }),
    I('Pastry', 'cake_slice', { servings: 0.9 })]),
  P('isb-united-bakery', 'United Bakery', 'Islamabad', 'School Rd, F-6 Markaz (Super Market)', W(10937827), [
    I('Plum cake (slice)', 'cake_slice'), I('Fruit cake (slice)', 'cake_slice'), I('Cake rusk (pack)', 'cake_rusk'),
    I('Croissant', 'croissant'), I('Gulab jamun', 'gulab_jamun')]),
  P('isb-bakeman', 'Bakeman Bakers & Sweets', 'Islamabad', 'I-10/1 Markaz; F-8', W(10937840), [
    I('Donut', 'donut'), I('Club sandwich', 'club_sandwich', R), I('Pastry / cake slice', 'cake_slice')]),
  P('isb-funky-bake', 'Funky Bake', 'Islamabad', 'Hilal Rd, F-11 Markaz', W(7714956), [
    I('Chocolate truffle cake (slice)', 'cake_slice', { servings: 1.3 }), I('Chocolate fudge brownie skillet', 'brownie', { servings: 1.8 }),
    I('Celebration cake (slice)', 'cake_slice', { servings: 1.2 })]),
  P('isb-obrownies', "O'Brownies", 'Islamabad', 'Kandaan Plaza, Jinnah Super Market F-7', W(7994890), [
    I('Gooey chocolate fudge brownie', 'brownie'), I('Walnut brownie', 'brownie'), I('Brownie box (4)', 'brownie', { servings: 4 })]),
  P('isb-karamel', 'Karamel', 'Islamabad', 'Beverly Centre, Blue Area F-6/1', W(3064092), [
    I('Chocolate chip cookie', 'chocolate_chip_cookie', { servings: 1.3 }), I('Double chocolate cookie', 'chocolate_chip_cookie', { servings: 1.3 }),
    I('Cake (slice)', 'cake_slice')]),

  // Western: steakhouses, Italian, burgers, Middle Eastern
  P('isb-ox-grill', 'Ox & Grill Steakhouse', 'Islamabad', 'College Rd, F-7 Markaz (Jinnah Super)', W(2674192), [
    I('Ox & Grill special steak', 'steak', { ...R, servings: 1.1 }), I('Louisiana chicken', 'grilled_chicken_meal', R),
    I('Chicken crunch burger', 'zinger_burger', R), I('Chicken parmesan', 'chicken_parmesan', R), I('Fries', 'fries', R)]),
  P('isb-el-momento', 'El Momento', 'Islamabad', 'Beverly Centre, F-6/1', W(7765414), [
    I('Steak with 5 sides', 'steak', { ...R, servings: 1.4 }), I('Alfredo pasta', 'creamy_pasta', { ...R, servings: 1.3 }),
    I('Chicken panini', 'panini', R), I('Lava cake', 'lava_cake')]),
  P('isb-porterhouse', 'Porterhouse', 'Islamabad', 'Kohsar Market, F-6/3', 'https://www.dawn.com/news/1184069', [
    I('Rib eye steak', 'steak', { ...R, servings: 1.2 }), I('Steak with mushroom sauce', 'steak', R),
    I('Steak with garlic butter', 'steak', { ...R, servings: 1.1 })]),
  P('isb-blt', 'BLT (Beef Lettuce Tomato)', 'Islamabad', 'Gol Market, F-7/3', W(3385848), [
    I('Beef burger', 'beef_burger', { ...R, servings: 1.2 }), I('Steak', 'steak', R), I('Mexican loaded fries', 'loaded_fries', R),
    I('Salad', 'salad', R), I('Kunafa', 'kunafa')]),
  P('isb-smokey-cauldron', 'The Smokey Cauldron', 'Islamabad', 'F-6 Markaz (near Pizza Hut)', 'https://www.zameen.com/blog/best-theme-restaurants-islamabad.html', [
    I('Shrieking Steak', 'steak', R), I('Dragonfire Burger', 'beef_burger', { ...R, servings: 1.2 }),
    I("Devil's Snare pasta", 'creamy_pasta', { ...R, servings: 1.3 }), I('Potion (shake-style drink)', 'milkshake')]),
  P('isb-nandos', "Nando's", 'Islamabad', 'F-6 Markaz Super Market; other branches', W(2674186), [
    I('Peri-peri quarter chicken with one side', 'peri_peri_chicken', { ...R, servings: 1.6 }), I('Peri-peri half chicken', 'peri_peri_chicken', { ...R, servings: 2 }),
    I('Peri-peri chips', 'fries', R), I('Chicken wings', 'wings', R), I('Chicken wrap', 'chicken_wrap', R)]),
  P('isb-new-yorker-pizza', 'New Yorker Pizza', 'Islamabad', 'Allah Wali Market F-8/1; Bahria Enclave', W(3357907), [
    I('New York slice', 'pizza_slice', { ...R, servings: 1.6 }), I('Empire State pizza (2 slices)', 'pizza_slice', { ...R, servings: 3.2 }),
    I('Medium pizza (6 slices)', 'pizza_slice', { ...R, servings: 6 })]),
  P('isb-14th-street-pizza', '14th Street Pizza Co.', 'Islamabad', 'Blue Area F-6/4; F-7 Markaz', W(10918250), [
    I('Chicken Extreme pizza (slice)', 'cheesy_pizza_slice', R), I('Creamy Chicken Delight (slice)', 'cheesy_pizza_slice', R),
    I('Hot Chicken Mughlai (slice)', 'pizza_slice', R), I('Wings', 'wings', R), I('Fries', 'fries', R)]),
  P('isb-italian-oven', 'Italian Oven', 'Islamabad', 'Service Rd E, F-10 Markaz', W(2925854), [
    I('All Toppings pizza (4 slices)', 'pizza_slice', { ...R, servings: 4 }), I('Chicken Tikka pizza (4 slices)', 'pizza_slice', { ...R, servings: 4 }),
    I('Beef steak', 'steak', { ...R, servings: 0.9 }), I('Chicken steak', 'grilled_chicken_meal', R),
    I('Hot & sour soup', 'corn_soup', R), I('Fish burger', 'chicken_burger', R), I('Pasta', 'creamy_pasta', R)]),
  P('isb-pappasallis', 'Pappasallis', 'Islamabad', 'Jinnah Super, F-7 Markaz; Jinnah Park Rawalpindi', 'https://images.dawn.com/news/1193389', [
    I('Margherita pizza (4 slices)', 'pizza_slice', { ...R, servings: 4 }), I('Chicken Supreme pizza (4 slices)', 'pizza_slice', { ...R, servings: 4 }),
    I('Chicken pepperoni pizza (4 slices)', 'pizza_slice', { ...R, servings: 4 }), I('Fettuccine alfredo', 'creamy_pasta', { ...R, servings: 1.3 }),
    I('Piña colada', 'smoothie')]),
  P('isb-zigolinis', "Zigolini's Italian (Marriott)", 'Islamabad', 'Islamabad Marriott, F-5/1', W(2925816), [
    I('Hand-tossed pizza (4 slices)', 'pizza_slice', { ...R, servings: 4 }), I('Pasta', 'creamy_pasta', { ...R, servings: 1.1 }),
    I('Caprese salad', 'greek_salad', R)]),
  P('isb-florida-steak-house', 'Florida Steak House', 'Islamabad', 'EOBI Building, I-8 Markaz', W(11609026), [
    I('Steak', 'steak', R), I('Garlic bread', 'garlic_bread', { servings: 3 }), I('Parmesan chicken', 'chicken_parmesan', R),
    I('Stuffed chicken fingers', 'nuggets', { ...R, servings: 1.5 }), I('Dynamite wings', 'wings', R), I('Molten lava cake', 'lava_cake')]),
  P('isb-fire-n-steak', "Fire 'n' Steak House", 'Islamabad', 'Sector E Commercial, DHA Phase 2', W(10908053), [
    I('Mushroom beef steak', 'steak', { ...R, servings: 1.1 }), I('Himalayan steak', 'steak', { ...R, servings: 1.1 }),
    I('Nachos', 'nachos', R), I('Beef burger', 'beef_burger', R), I('Salad', 'salad', R)]),
  P('isb-fat-moes', "Fat Moe's", 'Islamabad', 'Galleria Plaza, I-8 Markaz', W(3731332), [
    I('Classic smash burger', 'beef_burger', { ...R, servings: 0.9 }), I('Double cheeseburger', 'beef_burger', { ...R, servings: 1.3 }),
    I('Triple smash burger', 'beef_burger', { ...R, servings: 1.7 }), I('Smash fries', 'fries', R)]),
  P('isb-2-broke-engineers', '2 Broke Engineers', 'Islamabad', 'Bhittai Rd, F-7 Markaz', 'https://lovin.co/isloo/en/inspo/5-best-places-to-order-chinese-food', [
    I('Dragon chicken with rice', 'chilli_chicken', { ...R, servings: 1.4 }), I('Beef chilli dry', 'chilli_chicken', R), I('Chow mein', 'chow_mein', R),
    I('Chicken parmesan pasta', 'creamy_pasta', R), I('Chicken steak', 'grilled_chicken_meal', R)]),
  P('isb-arz-lebanon', 'Arz Lebanon', 'Islamabad', 'Jinnah Super Market, F-7 Markaz', 'https://arabnews.com/node/1479976', [
    I('Chicken shawarma', 'shawarma', R), I('Beef shawarma', 'shawarma', R), I('Hummus', 'hummus'),
    I('Mixed grill platter', 'mixed_grill', R), I('Shish tawook', 'shish_tawook', R)]),
  P('isb-locanta', 'Locanta Turkish Restaurant & Café', 'Islamabad', 'Beverly Centre, F-6/1', W(10813471), [
    I('Turkish döner', 'shawarma', R), I('Iskender kebab', 'shawarma', { ...R, servings: 1.5 }), I('Adana kebab (2 skewers)', 'seekh_kebab', { ...R, servings: 2 }),
    I('Lahmacun', 'manakish_meat', R), I('Pide', 'manakish_cheese', { ...R, servings: 1.5 })]),
  P('isb-mez-turkish', 'MêZ Turkish Restaurant', 'Islamabad', 'Roomy Signature Hotel, F-6 Markaz', 'https://blogpakistan.pk/turkish-restaurants-in-islamabad', [
    I('Lamb platter', 'mixed_grill', R), I('Turkish poultry platter', 'mixed_grill', R), I('Hummus', 'hummus'),
    I('Pide', 'manakish_meat', { ...R, servings: 1.5 }), I('Kunafa', 'kunafa')]),
  P('isb-al-maghreb', 'Al Maghreb (Serena)', 'Islamabad', 'Islamabad Serena Hotel, G-5/1', W(3578773), [
    I('Fattoush salad', 'fattoush'), I('Hummus', 'hummus'), I('BBQ Lebanese mixed grill', 'mixed_grill', R),
    I('Lamb chops (3)', 'mutton_chops', { ...R, servings: 3 }), I('Kunafa', 'kunafa')]),
  P('isb-the-carnivore', 'The Carnivore', 'Islamabad', 'Roomy Hotel, Super Market F-6', W(8512375), [
    I('Slow-cooked lamb shoulder (per person of a 4-share)', 'lamb_sajji', { ...R, servings: 2.1 }),
    I('Beef brisket / beef round (per person)', 'steak', { ...R, servings: 1.5 }), I('Kebabs (2)', 'seekh_kebab', { ...R, servings: 2 }),
    I('Rice', 'plain_rice', { servings: 1.5 })]),

  // Desi and BBQ
  P('isb-1969', '1969 Restaurant', 'Islamabad', 'Garden Ave, Shakarparian', W(2674193), [
    I('Mutton chops (3)', 'mutton_chops', { ...R, servings: 3 }), I('Mutton karahi (per person)', 'mutton_karahi', { ...R, servings: 1.5 }),
    I('Makhmali handi', 'chicken_handi', R), I('Malai boti', 'chicken_boti', R), I('Seekh kebab (2)', 'seekh_kebab', { ...R, servings: 2 }),
    I('Alfredo pasta', 'creamy_pasta', { ...R, servings: 1.2 }), I('Chicken fingers', 'nuggets', { ...R, servings: 1.5 }),
    I('Cheese naan', 'naan', { ...R, servings: 1.4 })]),
  P('isb-bbq-tonight', 'Bar.B.Q. Tonight', 'Islamabad', 'Sohrab Plaza, Embassy Rd, G-6/3 (Blue Area)', W(2674175), [
    I('Chicken tikka', 'chicken_tikka', R), I('Seekh kebab (2)', 'seekh_kebab', { ...R, servings: 2 }), I('Malai boti', 'chicken_boti', R),
    I('Chicken karahi (per person)', 'chicken_karahi', { ...R, servings: 1.5 }), I('Naan', 'naan', R)]),
  P('isb-tandoori', 'Tandoori Restaurant', 'Islamabad', 'Jasmine Plaza G-8 Markaz; F-10; Police Foundation (PWD)', W(7117761), [
    I('Mutton karahi (per person)', 'mutton_karahi', { ...R, servings: 1.5 }), I('Chicken karahi (per person)', 'chicken_karahi', { ...R, servings: 1.5 }),
    I('Tandoori chicken (piece)', 'chicken_tikka', R), I('Daal makhani', 'daal_makhani', R), I('Mash daal', 'daal_mash', R),
    I('Beef seekh kebab (2)', 'seekh_kebab', { ...R, servings: 2 }), I('Tandoori paratha', 'paratha', S), I('Tandoori roti', 'tandoori_roti')]),
  P('isb-darbar', 'Darbar Restaurant', 'Islamabad', 'Rawal Plaza, G-9 Markaz', W(8066187), [
    I('Butter chicken', 'butter_chicken', R), I('Chicken biryani', 'chicken_biryani', R), I('Chicken handi', 'chicken_handi', R),
    I('Daal makhani', 'daal_makhani', R), I('BBQ (chicken tikka)', 'chicken_tikka', R), I('Nachos', 'nachos', R)]),
  P('isb-usmania', 'Usmania Restaurant', 'Islamabad', 'West Jinnah Ave, Blue Area G-6/2', W(3501501), [
    I('Chicken karahi (per person)', 'chicken_karahi', { ...R, servings: 1.5 }), I('Chicken handi', 'chicken_handi', R),
    I('Mushroom steak (chicken)', 'grilled_chicken_meal', R), I('Chicken manchurian', 'manchurian', R),
    I('Chicken corn soup', 'corn_soup', R), I('Naan', 'naan', R)]),
  P('isb-lavish-dine', 'Lavish Dine', 'Islamabad', 'G-8 Markaz', W(10601152), [
    I('Palak paneer', 'palak_paneer', R), I('Daal', 'daal_mash', R), I('White karahi (per person)', 'chicken_karahi', { ...R, servings: 1.5 }),
    I('Tandoori roti', 'tandoori_roti')]),
  P('isb-wajid-fish', 'Wajid Fish Corner & Shinwari Tikka', 'Islamabad', 'I-8/1', W(10795924), [
    I('Fried fish (pao, 250 g)', 'fried_fish', { ...S, servings: 1.9 }), I('Fish tikka', 'fried_fish', { ...R, servings: 1.5 }),
    I('Shinwari tikka (lamb, per person)', 'lamb_sajji', S), I('Naan', 'naan', R)]),
  P('isb-al-ibrahimi', 'Al Ibrahimi Restaurant', 'Islamabad', 'Lake View Rd, Bahria Enclave', W(9714941), [
    I('Chicken biryani', 'chicken_biryani', R), I('Chicken chow mein', 'chow_mein', R), I('Chicken steak', 'grilled_chicken_meal', R),
    I('Special beef steak', 'steak', R), I('Hot wings', 'wings', R), I('Chicken mandi', 'chicken_mandi', R),
    I('Mutton karahi (per person)', 'mutton_karahi', { ...R, servings: 1.5 })]),

  // Chinese, Thai, Japanese, pan-Asian
  P('isb-ginyaki', 'Ginyaki', 'Islamabad', 'Bhittai Rd F-7 Markaz; EOBI Mall I-8 Markaz; Bahria Civic Centre', W(3030011), [
    I('Szechuan chicken', 'chilli_chicken', R), I('Kung pao chicken', 'chilli_chicken', R), I('Chicken chow mein', 'chow_mein', R),
    I('Egg fried rice', 'egg_fried_rice', R), I('Prawn bowl', 'egg_fried_rice', { ...R, servings: 1.3 })]),
  P('isb-chop-chop-wok', 'Chop Chop Wok', 'Islamabad', 'Agha Khan Rd, F-6 Markaz', W(7872868), [
    I('Thai beef salad', 'salad', { ...R, servings: 1.5 }), I('Beijing beef', 'manchurian', R), I('Chicken stir fry', 'manchurian', R),
    I('Korean chicken bowl with rice', 'teriyaki_chicken_rice', R), I('Egg noodles', 'chow_mein', R), I('Sushi roll', 'sushi_roll'),
    I('Chocolate cake (slice)', 'cake_slice')]),
  P('isb-mandarin-kitchen', 'Mandarin Kitchen', 'Islamabad', '4th floor, Agha Khan Rd, F-6 Markaz', W(3030010), [
    I('Dim sum platter', 'dumplings', R), I('Hot & sour soup', 'corn_soup', R), I('Salt & pepper calamari', 'fried_calamari', R),
    I('Garlic chicken', 'manchurian', R), I('Korean chicken', 'manchurian', R), I('Beef chilli dry', 'chilli_chicken', R),
    I('Garlic rice', 'egg_fried_rice', R), I('Chow mein', 'chow_mein', R)]),
  P('isb-sumo', 'Sumo Sushi', 'Islamabad', '4th floor, Agha Khan Rd, F-6 Markaz', W(3030035), [
    I('Maki roll (8 pcs)', 'sushi_roll'), I('Tempura maki roll', 'sushi_roll', { servings: 1.3 }), I('Nigiri (6 pcs)', 'sushi_roll', { servings: 0.9 })]),
  P('isb-suki-sushi', 'Suki Sushi', 'Islamabad', 'Abbasi Market F-8/3; Diplomatic Enclave; F-10 Markaz', W(2971937), [
    I('Mix sushi platter', 'sushi_roll', { servings: 1.5 }), I('Tempura maki', 'sushi_roll', { servings: 1.3 }),
    I('Hot-plate beef / chicken (teppanyaki)', 'teriyaki_chicken_rice', R), I('Soup', 'corn_soup', R)]),
  P('isb-kiku', 'Kiku Japanese Restaurant (Marriott)', 'Islamabad', 'Islamabad Marriott, F-5', W(11520976), [
    I('Sushi platter', 'sushi_roll', { servings: 2 }), I('Miso ramen', 'ramen', R), I('Chicken teriyaki', 'teriyaki_chicken_rice', R),
    I('Beef teppanyaki', 'steak', R), I('Dumplings', 'dumplings', R)]),
  P('isb-gaia', "Gai'a Japanese Fusion", 'Islamabad', 'Mount View Plaza, F-6 Markaz', W(10671891), [
    I('Sushi roll', 'sushi_roll'), I('Tempura maki', 'sushi_roll', { servings: 1.3 }), I('Noodles / ramen', 'ramen', R)]),
  P('isb-royal-elephant', 'Royal Elephant Thai (Marriott)', 'Islamabad', 'Islamabad Marriott, F-5/1', W(2674218), [
    I('Pad Thai', 'pad_thai', R), I('Red Thai curry', 'thai_green_curry', R), I('Green curry', 'thai_green_curry', R),
    I('Chicken Manchurian', 'manchurian', R), I('Oyster sauce chicken', 'manchurian', R), I('Egg fried rice', 'egg_fried_rice', R),
    I('Papaya salad', 'salad'), I('Cheesecake (slice)', 'cheesecake')]),
  P('isb-wild-rice', 'Wild Rice (Serena)', 'Islamabad', 'Islamabad Serena Hotel, G-5/1', W(2674268), [
    I('Duck dumplings', 'dumplings', R), I('Prawn tempura maki roll', 'sushi_roll', { servings: 1.2 }),
    I('Red curry lamb', 'thai_green_curry', R), I('Garlic egg fried rice', 'egg_fried_rice', R)]),
  P('isb-lanzhou-noodle', 'Lanzhou Chinese Beef Noodle', 'Islamabad', 'I-8 Markaz; F-10 Markaz', W(7111326), [
    I('Lanzhou beef noodles', 'ramen', { ...R, servings: 1.2 }), I('Dumplings (full)', 'dumplings', { ...R, servings: 2 }),
    I('Dumplings (half)', 'dumplings', R)]),
  P('isb-summis-dumplings', "Summi's Dumplings & Cuisine", 'Islamabad', 'Sector D, DHA Phase 2', W(3260482), [
    I('Steamed beef dumplings', 'dumplings', R), I('Steamed chicken dumplings', 'dumplings', R),
    I('Spicy Korean dumplings', 'dumplings', R), I('Lemon sesame chicken', 'manchurian', R), I('Egg fried rice', 'egg_fried_rice', R)]),
  P('isb-yangtze', 'Yangtze Chinese Cuisine', 'Islamabad', 'Fazilat Arcade, Markaz (beside United Bakery)', W(10728481), [
    I('Crispy spicy beef', 'manchurian', R), I('Yangtze special chow mein', 'chow_mein', R), I('Honey wings', 'wings', R),
    I('Create-your-own beef bowl', 'teriyaki_chicken_rice', R), I('Yak chilli dry', 'chilli_chicken', R)], { check: true }),
  P('isb-pf-changs', "P.F. Chang's", 'Islamabad', 'Kingsley Arcade, School Rd, F-6', W(20454081), [
    I('Sweet & sour chicken', 'manchurian', R), I('Mongolian beef', 'chilli_chicken', R), I('Fried rice', 'egg_fried_rice', R)]),
];
