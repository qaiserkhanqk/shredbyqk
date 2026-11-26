// Famous local places, city by city: what Pakistanis actually search for ("Nagina burger", "Kala Khan
// nihari", "Sadiq halwa puri"). Researched Nov 2026 from Dawn, Tribune, Arab News, ProPakistani, Graana,
// Zameen, Wanderlog and foodpanda listings (the source for each is in `url`). None publish nutrition,
// so every item is a QK estimate from the closest dish, at the oil level such places usually cook with.
// Places marked `check` were reported as possibly closed or weakly sourced: confirm before promoting them.
const I = (name, dish, opts = {}) => ({ name, dish, opts });
const R = { style: 'restaurant', styleKnown: true }, S = { style: 'shaadi', styleKnown: true };
const P = (id, name, city, area, url, items, extra = {}) => ({ id, name, type: 'Local', city, area, url, items, ...extra });

export const LOCAL_PLACES = [
  // Rawalpindi
  P('kala-khan', 'Kala Khan Nihari', 'Rawalpindi', 'Kartarpura', 'https://wanderlog.com/place/details/2907165/kala-khan-nehari-house', [I('Beef nihari', 'nihari', S), I('Nalli nihari', 'nihari', { ...S, servings: 1.3 }), I('Maghz nihari', 'nihari', { ...S, servings: 1.2 }), I('Khamiri roti / naan', 'naan', R)]),
  P('majeed-nihari', 'Majeed Nihari', 'Rawalpindi', 'Sabzi Mandi', 'https://dawn.com/news/1276148/a-plate-of-nihari-is-a-joy-forever', [I('Beef nihari', 'nihari', S), I('Nalli / maghz nihari', 'nihari', { ...S, servings: 1.3 }), I('Naan', 'naan', R)]),
  P('sheikh-lassi', 'Sheikh Lassi Master', 'Rawalpindi', 'Kartarpura', 'https://blogpakistan.pk/?p=37113', [I('Special malai lassi', 'sweet_lassi', { servings: 1.3 }), I('Dry fruit lassi', 'sweet_lassi', { servings: 1.2 }), I('Chocolate / coffee lassi', 'sweet_lassi', { servings: 1.2 })]),
  P('pehalwan-kheer', 'Pehalwan Ji Kheer House', 'Rawalpindi', 'Bhabra Bazaar', 'https://wanderlog.com/place/details/10971997/pehalwan-ji-kheer-house', [I('Kheer (kunna)', 'kheer'), I('Gajar halwa', 'gajar_halwa', R)]),
  P('lucky-dahi-baray', 'Lucky Dahi Baray', 'Rawalpindi', 'Bhabra Bazaar', 'https://www.dawn.com/news/1374457', [I('Dahi baray', 'dahi_bhalla', S)]),
  P('dilbar-hotel', 'Dilbar Hotel', 'Rawalpindi', 'Raja Bazaar', 'https://www.arabnews.pk/node/2424981/pakistan', [I('Gushtaba', 'gushtaba', R), I('Aab gosht', 'gushtaba', R), I('Rogan josh', 'gushtaba', R), I('Harissa', 'hareesa', R), I('Palak gosht', 'palak_gosht', R)]),
  P('corner-sweet', 'Corner Sweet House', 'Rawalpindi', 'Urdu Bazaar', 'https://www.arabnews.pk/node/2637143', [I('Pistachio barfi', 'mithai'), I('Ras malai', 'ras_malai')]),
  P('basho-chaat', 'Basho Chaat', 'Rawalpindi', 'Afshan Colony', 'https://tribune.com.pk/story/992119/entertainment', [I('Dahi bhallay', 'dahi_bhalla', S), I('Papri chaat', 'samosa_chaat', S)]),
  P('lahori-samosa', 'Lahori Samosa Shop', 'Rawalpindi', 'College Road', 'https://www.dawn.com/news/1132071', [I('Aloo samosa', 'samosa', S), I('Samosa with chutney (plate of 2)', 'samosa', { ...S, servings: 2 })]),
  P('yakhni-center', 'Chicken Yakhni Center', 'Rawalpindi', 'Saddar', 'https://arab.news/5pqxa', [I('Desi chicken yakhni', 'yakhni'), I('Yakhni with chicken pieces', 'yakhni', { servings: 1.8 })]),
  P('tehzeeb', 'Tehzeeb Bakers', 'Rawalpindi', 'Hospital Road; Islamabad Blue Area, G-9, F-11', 'https://propakistani.pk/foodnama/restaurants/tehzeeb-bakers/', [I('Chicken patties', 'patties'), I('Chicken & mushroom patties', 'patties', { servings: 1.1 }), I('Cream roll', 'cream_roll'), I('Pista nankhatai', 'nankhatai'), I('Chicken & cottage cheese pie', 'patties', { servings: 1.3 })]),
  P('jamil-sweets', 'Jamil Sweets', 'Rawalpindi', 'Saddar, Chaklala; Islamabad Blue Area, F-11', 'https://www.foodpanda.pk/restaurant/hvm4/jamil-sweets-saddar', [I('Halwa puri plate', 'halwa_puri', S), I('Suji halwa', 'suji_halwa', S), I('Cholay', 'cholay', S), I('Gulab jamun', 'gulab_jamun'), I('Mixed mithai (piece)', 'mithai')]),
  P('krc', 'KRC Refreshment', 'Rawalpindi', 'Bank Road, Saddar', 'https://www.foodpanda.pk/chain/ci6dj/krc-refreshment', [I('Dahi bhallay', 'dahi_bhalla', S), I('Samosa chaat', 'samosa_chaat', S)]),
  P('bala-tikka', 'Bala Tikka House', 'Rawalpindi', 'near Kartarpura food street', 'https://issuu.com/fascinatingpakistan/docs/fp_mag_apr2023_web/s/22636032', [I('Makhni karahi (per person)', 'chicken_handi', { ...S, servings: 1.5 }), I('Chicken tikka', 'chicken_tikka', S), I('Chicken grill burger', 'chicken_burger', R)], { check: true }),

  // Islamabad
  P('nagina-burger', 'Nagina Burger Point', 'Islamabad', 'F-10 Markaz (Double Road); also searched from Rawalpindi', 'https://wanderlog.com/place/details/7624382/nagina-burger-point', [I('Anda shami burger', 'anda_shami_burger', S), I('Double anda shami burger', 'anda_shami_burger', { ...S, servings: 1.5 }), I('Chicken anda shami burger', 'anda_shami_burger', S), I('Beef burger', 'beef_burger', { ...S, servings: 0.8 }), I('Chicken burger', 'chicken_burger', S)]),
  P('kabul-restaurant', 'Kabul Restaurant', 'Islamabad', 'F-7 Markaz, Jinnah Super', 'https://graana.com/blog/all-you-need-to-know-about-kabul-restaurant-islamabad', [I('Kabuli pulao (single)', 'kabuli_pulao', R), I('Kabuli pulao (full)', 'kabuli_pulao', { ...R, servings: 1.6 }), I('Namkeen tikka (seekh)', 'lamb_sajji', R), I('Afghani naan', 'tandoori_roti', { servings: 2 })]),
  P('saddams-corner', "Saddam's Corner", 'Islamabad', 'G-9, near Karachi Company', 'https://wanderlog.com/place/details/10601145/saddams-corner-afghani-burger', [I('Afghani burger', 'afghani_burger', S), I('Fries with green chutney', 'fries', S)]),
  P('b4u', 'B4U (Burger For You) Roll Inn', 'Islamabad', 'G-9 Markaz', 'https://www.dawn.com/news/1712935', [I('Afghani burger', 'afghani_burger', S), I('Chicken roll', 'paratha_roll', S)]),
  P('street-burger', 'Street Burger', 'Islamabad', '', 'https://www.dawn.com/news/1310172/street-burger-gives-the-old-standard-a-new-look', [I('Black bun beef burger', 'beef_burger', R), I('Double black bun burger', 'beef_burger', { ...R, servings: 1.4 })], { check: true }),
  P('cgc', 'CGC (Char Grill Central)', 'Islamabad', 'Gol Market, F-7/3', 'https://www.zameen.com/blog/7-burger-joints-islamabad-must-visit.html', [I('Beef burger', 'beef_burger', R), I('Chicken burger', 'zinger_burger', R), I('Fries', 'fries', R)]),
  P('cheema-chattha', 'Cheema & Chattha', 'Islamabad', 'F-11/2', 'https://wanderlog.com/place/details/1970602/cheema--chattha', [I('Beef nihari', 'nihari', R), I('Paye', 'paye', R), I('Halwa puri plate', 'halwa_puri', R), I('Desi ghee tandoori paratha', 'paratha', S)]),
  P('dilli-darwaza', 'Dilli Darwaza (The Nihari Shop)', 'Islamabad', 'Allah Wali Market, F-8/1', 'https://wanderlog.com/place/details/9699902/dilli-darwaza-the-nihari-shop', [I('Beef nihari', 'nihari', S), I('Halwa puri plate', 'halwa_puri', S)]),
  P('chattas', "Chatta's", 'Islamabad', 'Tariq Market, F-10/2', 'https://www.graana.com/blog/best-desi-restaurants-in-islamabad/', [I('Halwa puri plate', 'halwa_puri', R), I('Daal makhni', 'daal_makhani', R), I('Palak paneer', 'palak_paneer', R)]),
  P('chashni', 'Chashni', 'Islamabad', '', 'https://propakistani.pk/foodnama/best-desi-breakfast-places-in-islamabad-to-try-this-weekend/', [I('Mithai (piece)', 'mithai'), I('Halwa puri plate', 'halwa_puri', R), I('Beef nihari', 'nihari', R), I('Paaye', 'paye', R)], { check: true }),
  P('bengali-samosa', 'Bengali Samosa (Ustad Allah Ditta)', 'Islamabad', 'Farooqia Market, F-6/1', 'https://tribune.com.pk/story/27996/entertainment', [I('Mini samosa (plate of 6)', 'samosa', { ...S, servings: 2 }), I('Bun kebab', 'bun_kebab', S)], { check: true }),
  P('abey-khao', 'Abey Khao', 'Islamabad', 'Bhittai Road, F-7', 'https://www.graana.com/blog/street-food-in-islamabad-and-rawalpindi/', [I('Loaded fries', 'loaded_fries', S)], { check: true }),
  P('pan-corner', 'Pan Corner', 'Islamabad', '', 'https://www.graana.com/blog/street-food-in-islamabad-and-rawalpindi/', [I('Roll paratha', 'paratha_roll', S), I('Shawarma', 'shawarma', S), I('Paan', 'paan')], { check: true }),
  P('melody', 'Melody Food Park', 'Islamabad', 'G-6 Markaz, near Aabpara (food street)', 'https://wanderlog.com/place/details/797319/melody-food-park', [I('Chicken karahi (per person)', 'chicken_karahi', { ...S, servings: 1.5 }), I('Chicken tikka', 'chicken_tikka', S), I('Gol gappay', 'gol_gappay', S)]),
  P('haleem-ghar', 'Haleem Ghar', 'Islamabad', 'Blue Area; Peshawar Warsak Road', 'https://www.foodpanda.pk/restaurant/t4bh/haleem-ghar-warsak-road', [I('Beef haleem', 'haleem', R), I('Special chicken haleem', 'haleem', R)]),

  // Lahore
  P('phajja', 'Phajja Siri Paye', 'Lahore', 'Kali Beri Bazaar, Walled City', 'https://www.zameen.com/blog/desi-breakfast-lahore.html', [I('Siri paye', 'paye', S), I('Paye', 'paye', S), I('Khamiri roti / kulcha', 'kulcha', R)]),
  P('muhammadi-nihari', 'Muhammadi Nihari', 'Lahore', 'Mozang; Johar Town, Gulberg, DHA', 'https://www.zameen.com/blog/restaurants-best-desi-food-lahore.html', [I('Beef nihari', 'nihari', S), I('Maghz nihari', 'nihari', { ...S, servings: 1.2 }), I('Nalli nihari', 'nihari', { ...S, servings: 1.3 })]),
  P('bashir-darulmahi', 'Bashir Dar-ul-Mahi', 'Lahore', 'Mozang', 'https://www.zameen.com/blog/historic-food-streets-lahore.html', [I('Fried fish (pao, 250 g)', 'fried_fish', { ...S, servings: 1.9 }), I('Fish with chutney & naan', 'fried_fish', S)]),
  P('khalifa', 'Khalifa Bakers', 'Lahore', 'Old City, near Akbari Gate', 'https://theculturetrip.com/asia/pakistan/articles/a-journey-through-culinary-lahore-exploring-the-city-s-gastronomic-soul', [I('Nankhatai', 'nankhatai')]),
  P('amritsari-hareesa', 'Amritsari Hareesa', 'Lahore', 'Nisbat Road, Lakshmi Chowk, Gawalmandi', 'https://www.zameen.com/blog/5-popular-food-streets-lahore.html', [I('Hareesa', 'hareesa', S), I('Kulcha', 'kulcha', R)]),
  P('sadiq-halwa-puri', 'Sadiq Halwa Puri', 'Lahore', 'Gawalmandi; Ferozepur Road, Iqbal Town', 'https://images.dawn.com/news/1173976', [I('Halwa puri plate', 'halwa_puri', S), I('Extra puri', 'puri', S), I('Cholay', 'cholay', S)]),
  P('taj-mahal-sweets', 'Taj Mahal Sweets', 'Lahore', 'Lakshmi Chowk', 'https://images.dawn.com/news/1173976', [I('Halwa puri plate', 'halwa_puri', S), I('Mithai (piece)', 'mithai')]),
  P('butt-sweets', 'Butt Sweets', 'Lahore', 'Lakshmi Chowk', 'https://images.dawn.com/news/1173976', [I('Halwa puri plate', 'halwa_puri', S), I('Lassi', 'sweet_lassi')]),
  P('zafar-halwa-puri', 'Zafar Halwa Puri', 'Lahore', 'Anarkali', 'https://images.dawn.com/news/1173976', [I('Whole-wheat puri (2)', 'puri', { ...S, servings: 2 }), I('Halwa', 'suji_halwa', S)]),
  P('feeka-lassi', 'Feeka Lassi', 'Lahore', 'Gawalmandi', 'https://www.zameen.com/blog/5-popular-food-streets-lahore.html', [I('Peray wali lassi', 'sweet_lassi', { servings: 1.5 })]),
  P('jeda-lassi', 'Jeda Lassi', 'Lahore', 'Gumti Bazaar', 'https://migrationology.com/best-street-food-lahore/', [I('Sweet lassi with malai', 'sweet_lassi', { servings: 1.3 })]),
  P('riaz-falooda', 'Riaz Falooda', 'Lahore', 'Anarkali', 'https://www.zameen.com/blog/restaurants-best-desi-food-lahore.html', [I('Kulfi falooda', 'falooda')]),
  P('yousaf-falooda', 'Yousaf Falooda', 'Lahore', 'Old Anarkali', 'https://www.graana.com/blog/food-street-lahore/', [I('Falooda with rabri & kulfi', 'falooda', { servings: 1.3 })]),
  P('haji-sardar-fish', 'Haji Sardar Fish', 'Lahore', 'Gawalmandi Food Street', 'https://www.zameen.com/blog/historic-food-streets-lahore.html', [I('Fried fish (pao, 250 g)', 'fried_fish', { ...S, servings: 1.9 })]),
  P('babaji-kulfi', 'Baba Ji Kulfi Walay', 'Lahore', 'Muslim Town', 'https://www.zameen.com/blog/restaurants-best-desi-food-lahore.html', [I('Kulfi', 'kulfi')]),

  // Karachi
  P('waheed-kabab', 'Waheed Kabab House', 'Karachi', 'Burns Road', 'https://www.thefridaytimes.com/19-Jul-2025/karachi-s-burns-road-preserves-partition-era-flavours-in-every-bite', [I('Fry kabab (plate of 2)', 'fry_kebab', { ...S, servings: 2 }), I('Nihari', 'nihari', S)]),
  P('delhi-rabri', 'Delhi Rabri House', 'Karachi', 'Burns Road', 'https://dawn.com/news/676243/eating-out-the-wonders-of-burnes-road', [I('Rabri', 'rabri'), I('Rabri kheer', 'kheer', { servings: 1.4 })]),
  P('fresco', 'Fresco Sweets', 'Karachi', 'Burns Road, Saddar, PECHS', 'https://dawn.com/news/676243/eating-out-the-wonders-of-burnes-road', [I('Jalebi (100 g)', 'jalebi', S), I('Mithai (piece)', 'mithai')]),
  P('azad-bun-kabab', 'Azad Bun Kabab', 'Karachi', 'Burns Road', 'https://www.graana.com/blog/a-guide-to-burns-road-karachi', [I('Bun kabab', 'bun_kebab', S), I('Double anda bun kabab', 'bun_kebab', { ...S, servings: 1.3 })]),
  P('babu-bhai', 'Babu Bhai Bun Kabab', 'Karachi', 'Burns Road', 'https://www.brandsynario.com/featured/5-places-to-find-the-best-bun-kababs-in-karachi/', [I('Anday wala bun kabab', 'bun_kebab', S)]),
  P('al-rehman-biryani', 'Al-Rehman Biryani', 'Karachi', 'Kharadar', 'https://food.tribune.com.pk/en/blog/the-famous-al-rehman-biryani-the-legendary-eats-of-karachi', [I('Chicken biryani (single)', 'chicken_biryani', S), I('Chicken biryani (full plate)', 'chicken_biryani', { ...S, servings: 1.6 })]),
  P('zahid-nihari', 'Zahid Nihari', 'Karachi', 'Tariq Road', 'https://www.dawn.com/news/1140694/the-ultimate-guide-to-the-best-desi-food-in-karachi', [I('Beef nihari', 'nihari', S), I('Nalli nihari', 'nihari', { ...S, servings: 1.3 }), I('Taftan', 'taftan', R)]),
  P('sabri-nihari', 'Sabri Nihari', 'Karachi', 'M.A. Jinnah Road', 'https://www.dawn.com/news/1140694/the-ultimate-guide-to-the-best-desi-food-in-karachi', [I('Beef nihari', 'nihari', S), I('Maghz nihari', 'nihari', { ...S, servings: 1.2 })]),
  P('ghaffar-kabab', 'Ghaffar Kabab House', 'Karachi', '', 'https://www.dawn.com/news/1140694/the-ultimate-guide-to-the-best-desi-food-in-karachi', [I('Fried fish (plate)', 'fried_fish', S), I('Kebab', 'seekh_kebab', S)]),
  P('hanif-bun-kabab', 'Hanif Super Biryani & Bun Kabab', 'Karachi', 'Pakistan Chowk', 'https://www.brandsynario.com/lifestyle/food/best-bun-kabab-in-karachi/', [I('Bun kabab', 'bun_kebab', S), I('Biryani', 'chicken_biryani', S)]),
  P('burger-point-khi', 'Burger Point', 'Karachi', 'Pakistan Chowk', 'https://www.brandsynario.com/featured/5-places-to-find-the-best-bun-kababs-in-karachi/', [I('Chicken bun kabab', 'bun_kebab', S)]),
  P('cafe-lazeez', 'Cafe Lazeez', 'Karachi', 'Tariq Road', 'https://www.brandsynario.com/lifestyle/food/best-bun-kabab-in-karachi/', [I('Anday wala burger', 'anda_shami_burger', S)]),
  P('bbq-tonight', 'BBQ Tonight', 'Karachi', 'Boat Basin, Clifton', 'https://www.zameen.com/blog/top-bbq-restaurants-karachi.html', [I('Chicken tikka', 'chicken_tikka', R), I('Seekh kebab', 'seekh_kebab', R), I('Mutton chops (piece)', 'mutton_chops', R), I('Malai boti', 'chicken_boti', R)]),
  P('rehmat-e-shereen', 'Rehmat-e-Shereen', 'Karachi', 'Tariq Road, PECHS', 'https://www.foodpanda.pk/chain/cj7mf/rehmat-e-shereen-tariq-road', [I('Cake rusk (2)', 'cake_rusk'), I('Milk cake (piece)', 'mithai')]),
  P('dilpasand', 'Dilpasand Sweets', 'Karachi', '', 'https://propakistani.pk/foodnama/10-best-mithai-shops-in-karachi/', [I('Imarti (100 g)', 'jalebi'), I('Nimko (handful)', 'nimko'), I('Mithai (piece)', 'mithai')]),

  // Peshawar
  P('nisar-charsi', 'Nisar Charsi Tikka', 'Peshawar', 'Namak Mandi', 'https://migrationology.com/charsi-tikka-peshawar/', [I('Charsi tikka (portion)', 'lamb_sajji', S), I('Dumba karahi (per person)', 'mutton_karahi', { ...S, servings: 1.5 }), I('Peshawari naan', 'naan', { servings: 1.3 })]),
  P('jalil-kabab', 'Jalil Kabab House', 'Peshawar', 'Firdous', 'https://www.dawn.com/news/1196602/khybers-most-delicious-export', [I('Chapli kabab', 'chapli_kebab', S), I('Naan', 'naan', R)]),
  P('toray-kababi', 'Toray Kababi', 'Peshawar', '', 'https://arabnews.com/node/1203096', [I('Chapli kabab', 'chapli_kebab', S)]),
  P('zaika-chawal', 'Zaika Chawal Restaurant', 'Peshawar', 'Qissa Khwani Bazaar', 'https://davidsbeenhere.com/2021/05/28/video-street-food-in-peshawar-giant-pulao-pakistan-street-food-tour-in-qissa-kwani-bazaar-pakistan', [I('Beef pulao', 'beef_pulao', S)]),
  P('baba-wali', 'Baba Wali Afghan Restaurant', 'Peshawar', '', 'https://thefridaytimes.com/10-Nov-2017/rice-fit-for-a-lord', [I('Kabuli pulao', 'kabuli_pulao', R)]),
  P('chacha-ali-milk', 'Chacha Ali Ahmad Milk Shop', 'Peshawar', 'Qissa Khwani Bazaar', 'https://www.arabnews.pk/node/2603806', [I('Sweet milk dessert bowl', 'kheer')]),
  P('chief-burger', 'Chief Burger', 'Peshawar', 'G.T. Road, University Town', 'https://www.journeum.com/dst/Asia/Pakistan/North-West%20Frontier%20Province/Peshawar/Eat', [I('Chicken burger', 'zinger_burger', R), I('Beef burger', 'beef_burger', R)], { check: true }),

  // Faisalabad
  P('chamma-dal-chawal', 'Chamma Dal Chawal', 'Faisalabad', 'near Ghanta Ghar', 'https://www.zameen.com/blog/ghanta-ghar-faisalabad.html', [I('Dal chawal (plate)', 'daal_masoor', { ...S, servings: 1 }), I('Rice', 'plain_rice', { servings: 1.5 }), I('Raita', 'raita')]),
  P('munna-dal-chawal', 'Munna Dal Chawal', 'Faisalabad', 'near Ghanta Ghar', 'https://www.zameen.com/blog/ghanta-ghar-faisalabad.html', [I('Dal chawal (plate)', 'daal_masoor', S), I('Rice', 'plain_rice', { servings: 1.5 })]),
  P('al-jannat-fish', 'Al Jannat Fried Fish', 'Faisalabad', '', 'https://wanderlog.com/place/details/10808406/al-jannat-fried-fish', [I('Fried fish (pao, 250 g)', 'fried_fish', { ...S, servings: 1.9 })]),
  P('jalandhar-fish', 'Jalandhar Fish Shop & Fish BBQ', 'Faisalabad', 'Bhawana Bazaar', 'https://www.zameen.com/blog/ghanta-ghar-faisalabad.html', [I('Fried fish (pao, 250 g)', 'fried_fish', { ...S, servings: 1.9 }), I('Fish BBQ (pao)', 'fish_curry', { ...R, servings: 1.2 })]),
  P('huzaifa-kasuri', 'Huzaifa Kasuri Fish', 'Faisalabad', 'Susan Road', 'https://www.zameen.com/blog/ghanta-ghar-faisalabad.html', [I('Kasuri fried fish (pao, 250 g)', 'fried_fish', { ...S, servings: 1.9 })]),
  P('food-center-fsd', 'Food Center Restaurant', 'Faisalabad', 'Jhang Bazaar', 'https://www.zameen.com/blog/ghanta-ghar-faisalabad.html', [I('Mutton karahi (per person)', 'mutton_karahi', { ...S, servings: 1.5 })]),
  P('chacha-samosay', 'Chacha Samosay Wala', 'Faisalabad', 'D-Ground', 'https://www.graana.com/blog/d-ground-faisalabad-a-hub-of-activity-and-culture/amp', [I('Samosa', 'samosa', S)]),
  P('bangali-milk', 'Bangali Milk Shop', 'Faisalabad', 'Ghanta Ghar chowk', 'https://en.wikivoyage.org/wiki/Faisalabad', [I('Lassi', 'sweet_lassi')]),
  P('nirala-sweets', 'Nirala Sweets', 'Faisalabad', '', 'https://en.wikivoyage.org/wiki/Faisalabad', [I('Mithai (piece)', 'mithai')]),

  // Multan
  P('hafiz-sohan', 'Hafiz Sohan Halwa', 'Multan', 'Hussain Agahi', 'https://en.wikipedia.org/wiki/Hafiz_Sohan_Halwa', [I('Sohan halwa (piece)', 'sohan_halwa'), I('Dry fruit sohan halwa (piece)', 'sohan_halwa', { servings: 1.1 })]),
  P('ahmad-sohan', 'Ahmad Sohan Halwa', 'Multan', '', 'https://arab.news/yqbr9', [I('Sohan halwa (piece)', 'sohan_halwa'), I('Falooda', 'falooda')]),
  P('al-khair', 'Al-Khair Sweets & Bakers', 'Multan', '', 'https://arab.news/yqbr9', [I('Sohan halwa (piece)', 'sohan_halwa')]),
  P('hafiz-ka-dera', 'Hafiz Ka Dera', 'Multan', 'near Chowk Kumharanwala', 'https://travelsetu.com/guide/multan-tourism/food-in-multan', [I('Mutton sajji (portion)', 'lamb_sajji', S), I('Mutton chops (piece)', 'mutton_chops', S)]),
  P('shahjahan-grill', 'Shahjahan Grill', 'Multan', 'Aziz Hotel Chowk', 'https://travelsetu.com/guide/multan-tourism/food-in-multan', [I('Grilled fish (pao)', 'fish_curry', { ...R, servings: 1.2 }), I('Chargha (half)', 'chargha', R)]),
  P('shangrilla', 'Shangrilla Chinese', 'Multan', 'Saddar, Multan Cantt', 'https://graana.com/blog/best-restaurants-in-multan', [I('Chicken manchurian', 'manchurian', R), I('Egg fried rice', 'egg_fried_rice', R)], { check: true }),
  P('sabun-wali-gali', 'Sabun Wali Gali', 'Multan', 'near Haram Gate (food street)', 'https://tribune.com.pk/story/2494573/sabun-wali-gali-multans-iconic-culinary-haunt', [I('Nihari', 'nihari', S), I('Siri paye', 'paye', S), I('Halwa puri plate', 'halwa_puri', S), I('Lassi', 'sweet_lassi')]),

  // Hyderabad
  P('bombay-bakery', 'Bombay Bakery', 'Hyderabad', 'Saddar', 'https://en.wikipedia.org/wiki/Bombay_Bakery', [I('Coffee cake (slice)', 'cake_slice')], { check: true }),
  P('haji-rabri', 'Haji Rabri', 'Hyderabad', 'Shahi Bazaar', 'https://en.wikipedia.org/wiki/Haji_Rabri', [I('Rabri', 'rabri')]),
  P('hafiz-rabri', 'Hafiz Rabri', 'Hyderabad', 'Jail Road', 'https://artsandculture.google.com/story/WgUBlQNxVlC6Kg', [I('Rabri', 'rabri')]),
  P('lal-qila-hyd', 'Lal Qila', 'Hyderabad', 'Auto Bahn Road', 'https://graana.com/blog/exploring-restaurants-in-hyderabad-a-culinary-journey', [I('Biryani', 'chicken_biryani', R), I('Chicken karahi (per person)', 'chicken_karahi', { ...R, servings: 1.5 })]),
  P('khanji', 'Khanji Restaurant', 'Hyderabad', 'Qasimabad', 'https://graana.com/blog/exploring-restaurants-in-hyderabad-a-culinary-journey', [I('Sindhi biryani', 'chicken_biryani', R), I('Mutton khichra', 'haleem', R), I('Chicken karahi (per person)', 'chicken_karahi', { ...R, servings: 1.5 })]),
  P('zamindar-hyd', 'Zamindar Restaurant', 'Hyderabad', 'Qasimabad Main Road', 'https://graana.com/blog/exploring-restaurants-in-hyderabad-a-culinary-journey', [I('Mutton chops (piece)', 'mutton_chops', R), I('Chicken seekh kabab', 'seekh_kebab', R), I('Beef nihari', 'nihari', R)]),
  P('al-manzar', 'Al-Manzar', 'Hyderabad', 'Jamshoro Road', 'https://graana.com/blog/exploring-restaurants-in-hyderabad-a-culinary-journey', [I('Mutton karahi (per person)', 'mutton_karahi', { ...R, servings: 1.5 }), I('Sajji (quarter)', 'sajji', R), I('Chicken handi (per person)', 'chicken_handi', { ...R, servings: 1.5 })]),
  P('thaggu-samose', 'Thaggu Ke Samose', 'Hyderabad', 'Latifabad', 'https://graana.com/blog/exploring-restaurants-in-hyderabad-a-culinary-journey', [I('Samosa', 'samosa', S), I('Chaat', 'chana_chaat'), I('Dahi bhalla', 'dahi_bhalla', S)]),

  // Quetta
  P('lehri-sajji', 'Lehri Sajji House', 'Quetta', 'off Jinnah Road; Sariab Road', 'https://www.dawn.com/news/1327326', [I('Lamb sajji (portion)', 'lamb_sajji', R), I('Chicken sajji (quarter)', 'sajji', R), I('Karahi (per person)', 'mutton_karahi', { ...R, servings: 1.5 }), I('Kaak / naan', 'naan', R)]),
  P('mir-afzal', 'Mir Afzal Karahi', 'Quetta', 'Jinnah Road', 'https://www.dawn.com/news/1327326', [I('Mutton karahi (per person)', 'mutton_karahi', { ...S, servings: 1.5 }), I('Namkeen karahi (per person)', 'mutton_karahi', { ...R, servings: 1.5 })]),
  P('usmania-quetta', 'Usmania Restaurant', 'Quetta', 'Jinnah Road', 'https://www.journeum.com/dst/Asia/Pakistan/Balochistan/Quetta/Eat', [I('Kabuli pulao', 'kabuli_pulao', R), I('Sajji (quarter)', 'sajji', R)]),
  P('bolan-sajji', 'Bolan Sajji House', 'Quetta', 'Brewery Road', 'https://travelsetu.com/guide/quetta-tourism/food-in-quetta', [I('Sajji (quarter)', 'sajji', R)], { check: true }),
  P('cafe-china-quetta', 'Cafe China', 'Quetta', '', 'https://www.dawn.com/news/1327326', [I('Chicken corn soup', 'corn_soup'), I('Chicken chow mein', 'chow_mein', R)]),
  P('babu-jani', 'Babu Jani Bar-B-Que', 'Quetta', 'Circular Road', 'https://www.apricottours.pk/food-in-quetta/', [I('Namkeen tikka boti (portion)', 'lamb_sajji', R), I('Chaanp (piece)', 'mutton_chops', R)]),
  P('alamdar-hotel', 'Alamdar Hotel', 'Quetta', 'Alamdar Road', 'https://travelsetu.com/guide/quetta-tourism/food-in-quetta', [I('Dampukht (portion)', 'dampukht', R)], { check: true }),

  // Sialkot and Gujranwala
  P('inayat-sweets', 'Inayat Sweets', 'Sialkot', '', 'https://www.arabnews.pk/node/2631129', [I('Ras malai', 'ras_malai'), I('Gajar halwa', 'gajar_halwa', R), I('Halwa puri plate', 'halwa_puri', S)]),
  P('fatoor', 'Fatoor Sialkot', 'Sialkot', 'Rauf Plaza, Allama Iqbal Road', 'https://www.foodpanda.pk/restaurant/pmsl/fatoor-sialkot', [I('Halwa puri plate', 'halwa_puri', R), I('Halwa', 'suji_halwa', R)]),
  P('nawab-din', 'Nawab Din Kulfi & Faloda House', 'Sialkot', 'Katikan Wala Bazar', 'https://www.foodpanda.pk/restaurant/olxz/nawab-din-kulfi-and-faloda-house', [I('Kulfi falooda', 'falooda'), I('Kulfi', 'kulfi')]),
  P('shahbaz-tikka', 'Shahbaz Tikka', 'Gujranwala', 'Old Town', 'https://www.migrationology.com/gujranwala-food-tour/', [I('Mutton karahi (per person)', 'mutton_karahi', { ...S, servings: 1.5 }), I('Mutton tikka (seekh)', 'lamb_sajji', { ...S, servings: 0.7 }), I('Lamb chops (piece)', 'mutton_chops', S), I('Boneless chicken handi (per person)', 'chicken_handi', { ...S, servings: 1.5 })]),
  P('khizer-tikka', 'Khizer Tikka Shop', 'Gujranwala', '', 'https://www.migrationology.com/gujranwala-food-tour/', [I('Mutton tikka (seekh)', 'lamb_sajji', { ...S, servings: 0.7 })]),
  P('allah-rakha', 'Allah Rakha', 'Gujranwala', 'Sialkoti Darwaza', 'https://blogpakistan.pk/street-foods-in-gujranwala', [I('Chicken karahi (per person)', 'chicken_karahi', { ...S, servings: 1.5 }), I('Seekh kabab', 'seekh_kebab', S)]),
  P('amritsari-hareesa-grw', 'Amritsari Hareesa (Gujranwala)', 'Gujranwala', 'Guru Nanakpura', 'https://tribune.com.pk/story/2485295/gujranwalas-favourite-comfort-food', [I('Hareesa', 'hareesa', S)]),
  P('yousuf-jalebi', 'Yousuf Jalebiyanwala', 'Gujranwala', 'Guru Nanakpura', 'https://tribune.com.pk/story/2485295/gujranwalas-favourite-comfort-food', [I('Jalebi (100 g)', 'jalebi', S)]),
];
