// Chinese and pan-Asian restaurants (desi-Chinese, Cantonese/Szechuan, Thai, Japanese/sushi, Korean, noodle houses) in
// Karachi, Lahore, Islamabad, Rawalpindi and Peshawar, researched Nov 2026 from Wanderlog place pages (Google reviews
// and the press snippets they quote), foodpanda listings (as quoted in search results), Dawn/Images, The News (TNS),
// Express Tribune, Mangobaaz and Restaurant Guru. Menu items are the dishes those sources actually name. Each item is a
// QK estimate from the closest dish model unless it has `official` values (none of these places publish nutrition).
// Portions: desi-Chinese "full"/family plates are shared by 2-3 people, so they are named "(full, serves 2)" and carry
// the whole plate; single-portion pan-Asian places use about one model serving. Places marked `check` were weakly
// sourced or possibly closed / unclear branch.
const I = (name, dish, opts = {}, official = null) => ({ name, dish, opts, ...(official ? { official } : {}) });
const R = { style: 'restaurant', styleKnown: true }, S = { style: 'shaadi', styleKnown: true };
const O = (kcal, protein, carbs, fat, source, url) => ({ kcal, protein, carbs, fat, source, url });
const P = (id, name, city, area, url, items, extra = {}) => ({ id, name, type: 'Local', city, area, url, items, ...extra });
const W = (id) => `https://wanderlog.com/place/details/${id}`;

export const ASIAN_PLACES = [
  // ---------------- Rawalpindi ----------------
  P('mei-kong-rwp-as', 'Mei Kong', 'Rawalpindi', '32 Haider Rd, Saddar (since the early 1970s); Corniche Rd, Bahria Town Phase 4', W(2813779), [
    I('Special Mei Kong soup (bowl)', 'corn_soup', { ...R, servings: 1.1 }), I('Hot and sour soup (bowl)', 'hot_sour_soup', R),
    I('Egg drop soup (bowl)', 'corn_soup', R),
    I('Chicken chow mein (full, serves 2)', 'chow_mein', { ...R, servings: 2 }),
    I('Mei Kong special chow mein (full, serves 2)', 'chow_mein', { ...R, servings: 2.2 }),
    I('Egg fried rice (full, serves 2)', 'egg_fried_rice', { ...R, servings: 2 }),
    I('Chicken fried rice (full, serves 2)', 'egg_fried_rice', { ...R, servings: 2.1 }),
    I('Mei Kong special chicken (full plate)', 'manchurian', { ...R, servings: 2 }),
    I('Mongolian beef', 'chilli_chicken', { ...R, servings: 1.5 })]),
  P('chung-pa-rwp-as', 'Chung Pa Chinese Restaurant', 'Rawalpindi', 'Majeed Plaza, Bank Rd (opp. City Centre), Saddar', W(10883959), [
    I('Chicken chow mein (full, serves 2)', 'chow_mein', { ...R, servings: 2 }),
    I('Chung Pa special fried rice (full, serves 2)', 'egg_fried_rice', { ...R, servings: 2.2 }),
    I('Vegetable fried rice (full, serves 2)', 'egg_fried_rice', { ...R, servings: 1.8 }),
    I('Szechuan red prawn', 'chilli_chicken', { ...R, servings: 1.5 }),
    I('Fish with garlic sauce', 'manchurian', { ...R, servings: 1.5 })], { check: true }),
  P('jik-jik-rwp-as', 'Jik Jik Chinese Restaurant', 'Rawalpindi', 'Scheme III / Jinnah Park area; branch 2 at Soan Gardens (Islamabad)', W(10691808), [
    I('Chicken chowmein (full)', 'chow_mein', { ...R, servings: 1.6 }), I('Chicken Manchurian (full)', 'manchurian', { ...R, servings: 1.6 }),
    I('Chicken masala rice (full)', 'egg_fried_rice', { ...R, servings: 1.6 }), I('Chicken shashlik', 'chilli_chicken', { ...R, servings: 1.3 }),
    I('Hot and sour soup (bowl)', 'hot_sour_soup', R), I('Special soup with chicken & prawns (bowl)', 'corn_soup', { ...R, servings: 1.2 }),
    I('Chicken drumsticks (6)', 'wings', { ...R, servings: 1.3 })]),

  // ---------------- Islamabad ----------------
  P('chinatown-isb-as', 'Chinatown (Jinnah Avenue)', 'Islamabad', 'Shahid Plaza, D-Chowk, Jinnah Ave (Blue Area); Centaurus Mall', W(3064040), [
    I('Specialty hot and sour soup (bowl)', 'hot_sour_soup', R), I('Chinatown special soup (bowl)', 'corn_soup', { ...R, servings: 1.1 }),
    I('Kung pao chicken', 'chilli_chicken', { ...R, servings: 1.3 }), I('Beef chilli dry', 'chilli_chicken', { ...R, servings: 1.3 }),
    I('Shanghai special chicken', 'manchurian', { ...R, servings: 1.3 }), I('Hot and spicy braised prawns', 'chilli_chicken', { ...R, servings: 1.2 }),
    I('Dynamite shrimps', 'dynamite_shrimp', R)]),
  P('nom-nom-wok-isb-as', 'Nom Nom Wok', 'Islamabad', 'Kohsar Market (original); Central Park, DHA Phase 2', 'https://www.thenews.com.pk/tns/detail/568549-mixing-nom-nom-wok', [
    I('Hot n sour soup (bowl)', 'hot_sour_soup', R), I('Tom yum soup, chicken or prawn (bowl)', 'tom_yum', R),
    I('Prawn tempura', 'prawn_tempura', R), I('Golden silk prawns', 'prawn_tempura', R), I('Chicken satay', 'chicken_boti', { ...R, servings: 1.5 }),
    I('Chicken or prawn dumplings', 'dumplings', R), I('Build-your-own bowl (e.g. kung pao chicken on egg-fried rice)', 'teriyaki_chicken_rice', { ...R, servings: 1.2 }),
    I('Thai green / red curry with rice', 'thai_green_curry', R), I('Mongolian beef', 'chilli_chicken', { ...R, servings: 1.2 }),
    I('Pad thai', 'pad_thai', R), I('Nasi goreng', 'egg_fried_rice', { ...R, servings: 1.3 }), I('Chicken chow mein', 'chow_mein', R)]),
  P('xinhua-isb-as', 'Xinhua Cuisine', 'Islamabad', 'Imperial Square, E-11/3 Markaz', W(3613315), [
    I('Chicken chowmein', 'chow_mein', { ...R, servings: 1.4 }), I('Meat bean stew (dry)', 'chilli_chicken', { ...R, servings: 1.3 }),
    I('Xinhua unique soup (bowl)', 'corn_soup', { ...R, servings: 1.1 }), I('Kung pao fish', 'chilli_chicken', { ...R, servings: 1.2 })], { check: true }),
  P('tiger-temple-isb-as', 'Tiger Temple', 'Islamabad', 'Beverly Centre, Jinnah Ave, F-6/4 (Blue Area)', 'https://tribune.com.pk/story/1252486/restaurant-review-tiger-temple', [
    I('Goong tohd prawns (panko jumbo prawns)', 'prawn_tempura', R), I('Chicken & mushroom dumplings', 'dumplings', R),
    I('Tom kha kai (coconut soup, bowl)', 'cream_soup', { ...R, servings: 1.1 }), I('Chili & basil chicken', 'chilli_chicken', R),
    I('Steamed rice (with the chili basil chicken)', 'plain_rice', { servings: 1.2 }), I('Pad thai', 'pad_thai', R),
    I('Green curry with rice', 'thai_green_curry', R), I('Tamarind fish', 'manchurian', R), I('Bao (2)', 'bao', R)]),

  // ---------------- Lahore ----------------
  P('veera-5-lhe-as', 'Veera 5 Thai and Chinese', 'Lahore', 'Building 80, Street 6, CCA, Phase 5 DHA', W(2670121), [
    I('Thai green curry with prawns (with rice)', 'thai_green_curry', R), I('Pan-seared prawns in hot Thai chili', 'chilli_chicken', R),
    I('Bian chao beef with chillies', 'chilli_chicken', R), I('Chow mein', 'chow_mein', R), I('Wontons', 'dumplings', R)]),
  P('w-by-wasabi-lhe-as', 'W by Wasabi', 'Lahore', 'MM Alam Rd, Gulberg III; DHA', W(2846806), [
    I('Sushi roll (8 pcs)', 'sushi_roll', R), I('Prawn sushi roll (8 pcs)', 'sushi_roll', R), I('Ramen (bowl)', 'ramen', R),
    I('Prawn tempura', 'prawn_tempura', R), I('Dynamite prawns', 'dynamite_shrimp', R),
    I('Bento box (teriyaki chicken, rice & sides)', 'teriyaki_chicken_rice', { ...R, servings: 1.2 }),
    I('Teppanyaki chicken with rice', 'teriyaki_chicken_rice', R)]),
  P('red-lotus-lhe-as', 'Red Lotus (Four Points by Sheraton)', 'Lahore', 'Four Points by Sheraton, 25 Egerton Rd', W(3037521), [
    I('Hot and sour soup (bowl)', 'hot_sour_soup', R), I('Chicken dumplings', 'dumplings', R),
    I('Chicken chowmein', 'chow_mein', { ...R, servings: 1.3 }), I('Kung pao chicken', 'chilli_chicken', { ...R, servings: 1.3 }),
    I('Basil chicken', 'chilli_chicken', { ...R, servings: 1.2 })]),
  P('sichuan-lhe-as', 'Sichuan Chinese Restaurant', 'Lahore', '28-L College Rd (MM Alam / Mini Market), Gulberg; Johar Town', W(3499167), [
    I('Hot and sour soup (bowl)', 'hot_sour_soup', R), I('19 B soup (house special, bowl)', 'corn_soup', { ...R, servings: 1.1 }),
    I('Honey glazed drumsticks (6)', 'wings', { ...R, servings: 1.3 }), I('Spring rolls (2)', 'samosa', { ...R, servings: 1.2 }),
    I('American chop suey', 'chow_mein', { ...R, servings: 1.4 }), I('Beef with onion', 'chilli_chicken', { ...R, servings: 1.5 }),
    I('Mongolian chicken', 'chilli_chicken', { ...R, servings: 1.5 }), I('Thai honey chicken', 'manchurian', { ...R, servings: 1.3 }),
    I('Chicken chowmein', 'chow_mein', { ...R, servings: 1.5 })]),
  P('dynamite-chow-lhe-as', 'Dynamite Chow', 'Lahore', 'Bank Square, Block C, Model Town (Model Town Link Rd)', W(3610697), [
    I('Tom yum soup (bowl)', 'tom_yum', R), I('Hot and sour soup (bowl)', 'hot_sour_soup', R),
    I('Chicken noodle soup (bowl)', 'corn_soup', { ...R, servings: 1.2 }), I('Dynamite prawns', 'dynamite_shrimp', R),
    I('Shifu wings (6)', 'wings', R), I('Chicken drumsticks', 'wings', { ...R, servings: 1.2 }),
    I('Beef chilli dry', 'chilli_chicken', { ...R, servings: 1.3 }), I('Kung pao chicken', 'chilli_chicken', { ...R, servings: 1.3 }),
    I('Mao chowmein', 'chow_mein', { ...R, servings: 1.3 })]),
  P('xiwang-lhe-as', 'Xiwang Restaurant', 'Lahore', 'Allama Iqbal Rd, Allama Iqbal Town; MM Alam Rd, Gulberg III', W(3610786), [
    I('Xiwang special soup (one bowl of the 4-bowl medium)', 'corn_soup', { ...R, servings: 1.1 }), I('Chicken hot & sour soup (bowl)', 'hot_sour_soup', R),
    I('Chicken corn soup (bowl)', 'corn_soup', R), I('Xiwang special chicken Manchurian', 'manchurian', { ...R, servings: 1.5 }),
    I('Chicken chowmein', 'chow_mein', { ...R, servings: 1.5 }), I('Chicken egg fried rice', 'egg_fried_rice', { ...R, servings: 1.5 }),
    I('Chicken chilli dry', 'chilli_chicken', { ...R, servings: 1.5 }), I('Szechuan chicken', 'chilli_chicken', { ...R, servings: 1.5 }),
    I('Sweet and sour prawns', 'manchurian', { ...R, servings: 1.3 }), I('Almond chicken', 'manchurian', { ...R, servings: 1.3 }),
    I('Chicken drumsticks', 'wings', { ...R, servings: 1.2 })]),
  P('taoyuan-lhe-as', 'Taoyuan Chinese', 'Lahore', 'Ijaz Centre, Main Blvd Gulberg; Street 6, R2 Johar Town', W(10870842), [
    I('Hot n sour soup (bowl)', 'hot_sour_soup', R), I('Sweet and sour chicken', 'manchurian', { ...R, servings: 1.5 }),
    I('Chicken chow mein', 'chow_mein', { ...R, servings: 1.5 }), I('Chicken fried rice', 'egg_fried_rice', { ...R, servings: 1.5 })]),
  P('mei-kong-lhe-as', 'Mei Kong Faisal Town', 'Lahore', '1-D Abul Hassan Isfahani Rd, Faisal Town; Barkat Market, Garden Town', W(8659127), [
    I('Chicken chow mein', 'chow_mein', { ...R, servings: 1.5 }), I('Egg fried rice', 'egg_fried_rice', { ...R, servings: 1.5 }),
    I('Special hot & sour soup (bowl)', 'hot_sour_soup', { ...R, servings: 1.1 }), I('Chicken drumsticks', 'wings', { ...R, servings: 1.3 })]),
  P('dynasty-avari-lhe-as', 'Dynasty Avari Lahore', 'Lahore', 'Avari Hotel, Shahrah-e-Quaid-e-Azam (Mall Rd)', 'https://tribune.com.pk/story/692080/entertainment', [
    I('Steamed prawn dumplings', 'dumplings', R), I('Silk-coated prawns (shredded-potato crust)', 'prawn_tempura', R),
    I('Chicken chops with chilli honey sauce', 'manchurian', R), I('Prawn coriander soup (bowl)', 'tom_yum', R), I('Chow mein', 'chow_mein', R)]),
  P('lius-kim-mun-lhe-as', "Liu's Kim Mun", 'Lahore', 'Mian Mehmood Ali Kasoori Rd, Gulberg III (takeaway); Johar Town (dine-in)', 'https://www.mangobaaz.com/best-chinese-restaurants-in-lahore', [
    I('Butterfly prawns (batter-fried)', 'prawn_tempura', R), I('Special prawn chowmein', 'chow_mein', { ...R, servings: 1.5 }),
    I('Chicken & prawn chow mein', 'chow_mein', { ...R, servings: 1.5 }), I('Chicken Manchurian (family serving)', 'manchurian', { ...R, servings: 2 }),
    I('Kung pao chicken', 'chilli_chicken', { ...R, servings: 1.5 }), I('Chicken with mushroom and vegetables', 'manchurian', { ...R, servings: 1.3 })]),
  P('new-beijing-lhe-as', 'New Beijing Chinese Restaurant', 'Lahore', 'Block A, Gulberg 2', W(10870844), [
    I('Golden silk prawns', 'prawn_tempura', R), I('Spring rolls (2)', 'samosa', { ...R, servings: 1.2 }),
    I('Fried finger chicken', 'nuggets', { ...R, servings: 1.3 }), I('Hot n sour soup (bowl)', 'hot_sour_soup', R),
    I('Chicken cashew nuts', 'manchurian', { ...R, servings: 1.3 }), I('Kung pao chicken', 'chilli_chicken', { ...R, servings: 1.3 }),
    I('Prawn chow mein', 'chow_mein', { ...R, servings: 1.3 })]),
  P('dan-dan-lhe-as', 'Dan Dan', 'Lahore', '49-L, Block L, Gulberg 2', W(9751162), [
    I('Dan Dan chicken', 'chilli_chicken', R), I('Dan Dan prawns', 'chilli_chicken', R), I('Laksa prawn (noodle soup)', 'ramen', R),
    I('Assorted dumplings', 'dumplings', R), I('Sweet and sour chicken', 'manchurian', R), I('Black pepper beef', 'chilli_chicken', { ...R, servings: 1.1 }),
    I('Mint margarita', 'mint_lemonade')]),
  P('panda-kitchen-lhe-as', 'Panda Kitchen', 'Lahore', 'Allama Iqbal Rd, near Police Station, Garhi Shahu', W(3610684), [
    I('Hot and sour soup (bowl)', 'hot_sour_soup', R), I('Hot chilli wings (6)', 'wings', R),
    I('Kung pao chicken', 'chilli_chicken', { ...R, servings: 1.3 }), I('Chicken Manchurian', 'manchurian', { ...R, servings: 1.3 }),
    I('Egg fried rice (with the Manchurian)', 'egg_fried_rice', { ...R, servings: 1.2 }),
    I('Spicy basil noodles (plate, enough for 2)', 'chow_mein', { ...R, servings: 2 }), I('Chicken chowmein', 'chow_mein', { ...R, servings: 1.3 })]),
  P('lanzhou-lamian-lhe-as', 'Lanzhou Lamian', 'Lahore', '436-A, Abdullah St, Block B2, Johar Town Phase 1', W(7502961), [
    I('Beef lamian (hand-pulled noodle soup, big bowl)', 'ramen', { ...R, servings: 1.2 }), I('Kung pao chicken', 'chilli_chicken', { ...R, servings: 1.3 }),
    I('Onion fried beef', 'chilli_chicken', { ...R, servings: 1.3 }), I('Lanzhou special rice', 'egg_fried_rice', { ...R, servings: 1.3 }),
    I('Beef fungus noodles', 'chow_mein', { ...R, servings: 1.3 }), I('Chowmein', 'chow_mein', { ...R, servings: 1.3 })]),

  // ---------------- Karachi ----------------
  P('china-town-khi-as', 'China Town (Clifton)', 'Karachi', 'Block 2, Clifton (since the late 1980s)', W(3058161), [
    I('Hot and sour soup (bowl)', 'hot_sour_soup', R), I('Fish soup (bowl)', 'corn_soup', { ...R, servings: 1.1 }),
    I('Sizzling chicken Manchurian', 'manchurian', { ...R, servings: 1.5 }), I('Chicken Manchurian with rice', 'manchurian', { ...R, servings: 1.3 }),
    I('Egg fried rice (with the Manchurian)', 'egg_fried_rice', { ...R, servings: 1.2 }), I('Shrimp fried rice', 'egg_fried_rice', { ...R, servings: 1.5 }),
    I('Kung pao chicken', 'chilli_chicken', { ...R, servings: 1.5 }), I('Chicken chow mein', 'chow_mein', { ...R, servings: 1.5 })]),
  P('imperial-court-khi-as', 'Imperial Court Chinese Restaurant', 'Karachi', '180-A, PECHS Block 2 (off Tariq Rd)', W(10160260), [
    I('Special hot and sour soup (bowl)', 'hot_sour_soup', R), I('Chicken corn soup (bowl)', 'corn_soup', R), I('Thai soup (bowl)', 'tom_yum', R),
    I('Chicken & prawn fried rice (serves 2-3)', 'egg_fried_rice', { ...R, servings: 2.3 }), I('Egg fried rice (serves 2-3)', 'egg_fried_rice', { ...R, servings: 2.3 }),
    I('American chopsuey', 'chow_mein', { ...R, servings: 1.5 }), I('Beef chilli chowmein', 'chow_mein', { ...R, servings: 1.5 }),
    I('Chicken Manchurian', 'manchurian', { ...R, servings: 1.5 }), I('Kung pao chicken', 'chilli_chicken', { ...R, servings: 1.5 }),
    I("General Tso's chicken", 'manchurian', { ...R, servings: 1.5 })]),
  P('zhongguo-cai-khi-as', 'Zhongguo Cai', 'Karachi', '97, 9th Commercial St, DHA Phase 4', W(7765136), [
    I('Singaporean rice (plate, enough for 2-3)', 'egg_fried_rice', { ...R, servings: 2.5 }), I('Hot and sour soup (bowl)', 'hot_sour_soup', R),
    I('Chicken Schezwan', 'chilli_chicken', { ...R, servings: 1.5 }), I('Egg fried rice', 'egg_fried_rice', { ...R, servings: 1.5 }),
    I('Sticky chicken', 'manchurian', { ...R, servings: 1.3 }), I('Kung pao chicken', 'chilli_chicken', { ...R, servings: 1.5 }),
    I('Dumplings', 'dumplings', R), I('Schezwan noodles', 'chow_mein', { ...R, servings: 1.5 })]),
  P('shanghai-social-khi-as', 'Shanghai Social', 'Karachi', 'Com3 Mall, Block 6 Clifton; Tipu Sultan Rd', W(10600579), [
    I('Spicy hot and sour soup (bowl)', 'hot_sour_soup', R), I('Shanghai noodle soup (bowl)', 'ramen', { ...R, servings: 0.8 }),
    I('Mala chicken with peanuts', 'chilli_chicken', { ...R, servings: 1.2 }), I('Smoked garlic rice', 'egg_fried_rice', { ...R, servings: 1.2 }),
    I('Chilli butter shrimp with noodles', 'chow_mein', { ...R, servings: 1.3 }), I('Chicken chowmein', 'chow_mein', { ...R, servings: 1.3 }),
    I('Chilli fried rice', 'egg_fried_rice', { ...R, servings: 1.2 }), I('Social bowl (wok-fried noodles or rice with protein)', 'chow_mein', { ...R, servings: 1.2 }),
    I('Crispy beef', 'manchurian', { ...R, servings: 1.2 })]),
  P('cafe-sino-khi-as', 'Cafe Sino', 'Karachi', 'Creek Walk Food Street, DHA Phase 8; Zamzama, DHA Phase 5', W(3458891), [
    I('Salmon maki (8 pcs)', 'sushi_roll', R), I('Spicy tuna maki (8 pcs)', 'sushi_roll', R), I('Salmon nigiri (2 pcs)', 'sushi_roll', { ...R, servings: 0.3 }),
    I('Dynamite shrimps', 'dynamite_shrimp', R), I('Crispy calamari', 'fried_calamari', R), I('Grilled jumbo prawns (plate)', 'grilled_fish', R)], { check: true }),
  P('yoshis-khi-as', "Yoshi's", 'Karachi', 'Khadda Market, DHA Phase 5', 'https://images.dawn.com/news/1182779', [
    I('Japanese fried chicken (karaage)', 'nuggets', { ...R, servings: 1.5 }), I('Dumplings', 'dumplings', R), I('Ramen (bowl)', 'ramen', R),
    I('Yuzunade', 'mint_lemonade')], { check: true }),
  P('dong-bunsik-khi-as', 'Dong Bunsik (Korean)', 'Karachi', 'Service Rd, Defence View Phase 2 (near DHA)', W(11863192), [
    I('Korean ramen (bowl)', 'ramen', { ...R, servings: 0.9 }), I('Kimchi fried rice (kimchi bokkeumbap)', 'egg_fried_rice', { ...R, servings: 0.9 }),
    I('Bibimbap', 'teriyaki_chicken_rice', { ...R, servings: 0.9 }), I('Beef bulgogi with rice', 'teriyaki_chicken_rice', { ...R, servings: 0.9 }),
    I('Spicy chicken rice bowl', 'teriyaki_chicken_rice', { ...R, servings: 0.9 }), I('Chicken gangjeong (Korean fried chicken)', 'wings', R),
    I('Oreo / dalgona bingsu', 'ice_cream', { servings: 1.3 })]),
  P('banchan-khi-as', 'Banchan (Korean BBQ)', 'Karachi', 'Karachi', 'https://restaurantguru.com/Banchan-Karachi', [
    I('Beef bulgogi with steamed rice', 'teriyaki_chicken_rice', { ...R, servings: 1.1 }), I('Angus bulgogi with rice', 'teriyaki_chicken_rice', { ...R, servings: 1.1 }),
    I('Bibimbap', 'teriyaki_chicken_rice', R), I('Grilled chicken (Korean BBQ, no rice)', 'chicken_boti', { ...R, servings: 2 })], { check: true }),

  // ---------------- Peshawar ----------------
  P('chinese-hub-psh-as', 'Chinese Hub', 'Peshawar', 'Gulshan Iqbal Town, near Maki Masjid, Arbab Rd', 'https://www.foodpanda.pk/restaurant/n25v/chinese-hub-n25v', [
    I('Chicken Manchurian (full, serves 2)', 'manchurian', { ...R, servings: 2 }), I('Special chowmein (full, serves 2)', 'chow_mein', { ...R, servings: 2 }),
    I('Special chowmein (half)', 'chow_mein', R), I('Chicken chowmein (full, serves 2)', 'chow_mein', { ...R, servings: 2 }),
    I('Chicken chilli dry', 'chilli_chicken', { ...R, servings: 1.5 })], { check: true }),
];
