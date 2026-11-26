# Photo recognition test: 60 real web photos

**Date:** November 2026. **Photos:** 60 openly licensed photos from Wikimedia Commons, from 20 dish categories (biryani, nihari, haleem, karahi, naan, paratha, chapati, puri, samosa, pakora, shami kebab, gulab jamun, lassi, chai, palak paneer, kheer, dal, butter chicken, tandoori chicken, raita). Seven more categories got no photos because of Wikimedia rate limits.

**Method.** The photos were renamed to random numbers and shuffled; the answer key was opened only after every photo had been read. Claude (in the development session) played the recognition step with the same catalogue and rules the server sends, and its answers went through the app's real code (consensus, dish models, calories at restaurant oil levels). This measures how well a Claude model recognises desi food with this setup; it is not a test of the exact model your server will call, and web photos have no weighed calories, so it says nothing about calorie accuracy.

## Results

| | By Commons category | By what the photo actually shows |
|---|---|---|
| Meal read right | 37 / 60 (62%) | 51 / 60 (85%): includes 2 that missed a side item and 2 that were a stall or frying pan, not a plate |
| Fixable with one tap (runner-up or same family) | 16 | 8 |
| Wrong | 7 | 1 (dumba karahi read as chicken) |

The two columns differ because Commons categories are noisy: thali photos sit in the "Dal" or "Raita" category although the dal or raita is one bowl among several, and two "Nihari" photos are raw meat, one "Chapati" photo is a roti-making machine, a "Karahi" photo is a dumba (mutton) karahi. Those answers were right but scored as wrong against the category.

## What it taught us (now fixed)

- **Photos that are not one person's plate gave absurd totals**: a naan seller's stack became 15 naans (5,312 kcal), a karahi pan for a table 4 servings (2,027 kcal), a pan of frying gulab jamun 6 pieces. The model now classifies the scene (plate, shared, cooking or display, not food). Cooking and display photos are not logged unless the person says so, and shared dishes or very large totals ask "Is all of this yours?" (All, Half, A quarter, One serving).
- **Chicken vs mutton is the main confusion.** The prompt now tells the model to look at bones and meat colour, and to offer the other as the one-tap alternative.
- **Side items at the edges were missed** (a lassi glass, a raita bowl). The prompt now asks for drinks and small bowls.

## Every photo

| # | Photo (source) | Licence | Category | QK read | kcal | Verdict |
|---|---|---|---|---|---|---|
| 1 | [Afgani leg with green chutney.jpg](https://commons.wikimedia.org/wiki/File:Afgani_leg_with_green_chutney.jpg) | CC BY-SA 4.0 | Tandoori chicken | chicken_tikka ×1 | 259 | exact |
| 2 | [Finger licking Shami Kababs.jpg](https://commons.wikimedia.org/wiki/File:Finger_licking_Shami_Kababs.jpg) | CC BY-SA 4.0 | Shami kebab | shami_kebab ×3, paratha ×2 | 1015 | exact |
| 3 | [Crab Masala & Shamee Kebab.JPG](https://commons.wikimedia.org/wiki/File:Crab_Masala_%26_Shamee_Kebab.JPG) | CC BY-SA 4.0 | Shami kebab | shami_kebab ×4, other: crab masala ×1 | 596 | exact |
| 4 | [A kind of Assamese veg thali with moog dal, Red da](https://commons.wikimedia.org/wiki/File:A_kind_of_Assamese_veg_thali_with_moog_dal,_Red_dal,_Black_dal_with_elephant_apple,_alloo_sabji,_banana_blosom_sabji,,_couliflower_sabjipumpkin_sabji,_mixed_saag_sabji,_aloo_pitika_..raw_banana_fry_and_cucumbrer_slices.jpg) | CC BY-SA 4.0 | Dal | plain_rice ×1, daal_masoor ×1, mix_sabzi ×1 | 716 | right (a thali: rice, dal, sabzi) |
| 5 | [After fry.jpg](https://commons.wikimedia.org/wiki/File:After_fry.jpg) | CC BY-SA 4.0 | Paratha | lachha_paratha ×1 | 334 | one tap (lachha vs plain paratha) |
| 6 | [Dumba Karahi 20210605.jpg](https://commons.wikimedia.org/wiki/File:Dumba_Karahi_20210605.jpg) | CC BY-SA 4.0 | Karahi | mutton_karahi ×4 | 1646 | exact (it is a dumba/mutton karahi) |
| 7 | [1 Gulab Jamun Mithai Sweets of India.jpg](https://commons.wikimedia.org/wiki/File:1_Gulab_Jamun_Mithai_Sweets_of_India.jpg) | CC BY 2.0 | Gulab jamun | gulab_jamun ×6 | 1118 | exact |
| 8 | [202404151547 IMG 1801.jpg](https://commons.wikimedia.org/wiki/File:202404151547_IMG_1801.jpg) | CC BY-SA 4.0 | Butter chicken | daal_masoor ×1, naan ×1, raita ×1, butter_chicken ×0.5 | 882 | one tap (butter chicken read as a side) |
| 9 | [A traditional Bengali dish served on a banana leaf](https://commons.wikimedia.org/wiki/File:A_traditional_Bengali_dish_served_on_a_banana_leaf_surrounded_by_flower_petals.jpg) | CC BY-SA 4.0 | Dal | plain_rice ×1, chicken_salan ×1, daal_masoor ×0.5 | 678 | right (a thali) |
| 10 | [2013 Sechseläuten - 'Samosa' und 'Pakora' - Limmat](https://commons.wikimedia.org/wiki/File:2013_Sechsel%C3%A4uten_-_%27Samosa%27_und_%27Pakora%27_-_Limmatquai_2013-04-14_17-35-59_(P7700).JPG) | CC BY-SA 3.0 | Pakora | samosa ×1, pakora ×0.5 | 389 | right (samosa and pakora both read) |
| 11 | [14-baliyatra 2011.jpg](https://commons.wikimedia.org/wiki/File:14-baliyatra_2011.jpg) | CC BY-SA 3.0 | Puri (food) | puri ×3 | 390 | exact |
| 12 | [2013 Sechseläuten - 'Samosa' und 'Pakora' - Limmat](https://commons.wikimedia.org/wiki/File:2013_Sechsel%C3%A4uten_-_%27Samosa%27_und_%27Pakora%27_-_Limmatquai_2013-04-14_17-37-42_(P7700).JPG) | CC BY-SA 3.0 | Pakora | samosa ×1, pakora ×0.5 | 389 | right (samosa and pakora both read) |
| 13 | [4th October 2012 Shami Kebab.jpg](https://commons.wikimedia.org/wiki/File:4th_October_2012_Shami_Kebab.jpg) | CC BY-SA 3.0 | Shami kebab | shami_kebab ×2, fries ×1 | 616 | exact |
| 14 | ["Amazing Aloo Paratha and Lovely Lassi".jpg](https://commons.wikimedia.org/wiki/File:%22Amazing_Aloo_Paratha_and_Lovely_Lassi%22.jpg) | CC BY-SA 4.0 | Lassi | aloo_paratha ×5, raita ×2 | 1924 | aloo paratha right; lassi glasses missed |
| 15 | [Bombay Haleem.JPG](https://commons.wikimedia.org/wiki/File:Bombay_Haleem.JPG) | CC BY-SA 4.0 | Haleem | haleem ×1 | 515 | exact |
| 16 | [A North Indian lunch plate.jpg](https://commons.wikimedia.org/wiki/File:A_North_Indian_lunch_plate.jpg) | CC BY-SA 4.0 | Raita | matar_pulao ×1, raita ×1, boiled_egg ×3 | 692 | right (pulao, raita, eggs) |
| 17 | [A Biryani.jpg](https://commons.wikimedia.org/wiki/File:A_Biryani.jpg) | CC BY-SA 4.0 | Biryani | chicken_biryani ×1 | 599 | exact |
| 18 | [Dumba Karahi 20200627.jpg](https://commons.wikimedia.org/wiki/File:Dumba_Karahi_20200627.jpg) | CC BY-SA 4.0 | Karahi | chicken_karahi ×4, roti ×4 | 2027 | wrong meat (dumba karahi read as chicken) |
| 19 | [14-FEB-2024 - UA863 SFO-SYD (N2138U - B777-300ER) ](https://commons.wikimedia.org/wiki/File:14-FEB-2024_-_UA863_SFO-SYD_(N2138U_-_B777-300ER)_(02).jpg) | CC BY 4.0 | Butter chicken | butter_chicken ×1, plain_rice ×1 | 555 | exact |
| 20 | [A Whole Meal.JPG](https://commons.wikimedia.org/wiki/File:A_Whole_Meal.JPG) | CC BY-SA 4.0 | Biryani | chicken_biryani ×1, raita ×1 | 656 | exact |
| 21 | [202402172035 IMG 4212.jpg](https://commons.wikimedia.org/wiki/File:202402172035_IMG_4212.jpg) | CC BY-SA 4.0 | Lassi | sweet_lassi ×1 | 249 | exact |
| 22 | [202408191934 IMG 1998.jpg](https://commons.wikimedia.org/wiki/File:202408191934_IMG_1998.jpg) | CC BY-SA 4.0 | Dal | daal_masoor ×1, chicken_salan ×1, plain_rice ×1, salad ×1 | 848 | exact |
| 23 | [A beautiful day with my friends.jpg](https://commons.wikimedia.org/wiki/File:A_beautiful_day_with_my_friends.jpg) | CC BY-SA 4.0 | Paratha | aloo_paratha ×3 | 1086 | one tap (aloo vs plain paratha) |
| 24 | [Cottage cheese in spinach gravy(palak paneer).jpg](https://commons.wikimedia.org/wiki/File:Cottage_cheese_in_spinach_gravy(palak_paneer).jpg) | CC BY-SA 4.0 | Palak paneer | palak_paneer ×1, plain_rice ×1 | 579 | exact |
| 25 | [A Naan and Cottage Cheese Naan from Tuen Mun Curry](https://commons.wikimedia.org/wiki/File:A_Naan_and_Cottage_Cheese_Naan_from_Tuen_Mun_Curry_House.jpg) | CC BY-SA 4.0 | Naan | naan ×3 | 1062 | exact |
| 26 | [2 Chapati warm and ready to be eaten.jpg](https://commons.wikimedia.org/wiki/File:2_Chapati_warm_and_ready_to_be_eaten.jpg) | CC BY-SA 2.0 | Chapati | roti ×3 | 306 | exact |
| 27 | [Dumba Karahi ready 20210605 02.jpg](https://commons.wikimedia.org/wiki/File:Dumba_Karahi_ready_20210605_02.jpg) | CC BY-SA 4.0 | Karahi | chicken_karahi ×1, naan ×1 | 759 | one tap (dumba karahi read as chicken; mutton offered) |
| 28 | [Beef Nihari Meat.JPG](https://commons.wikimedia.org/wiki/File:Beef_Nihari_Meat.JPG) | CC0 | Nihari | other: raw meat ×1 | 0 | right: raw meat, nothing logged |
| 29 | [20191205 Sprzedawca masala czaj w Starym Delhi 060](https://commons.wikimedia.org/wiki/File:20191205_Sprzedawca_masala_czaj_w_Starym_Delhi_0604_6737.jpg) | CC BY-SA 4.0 | Masala chai | chai ×1 | 100 | exact |
| 30 | [2015-3 Budhanilkantha,Nepal-DSCF5263.JPG](https://commons.wikimedia.org/wiki/File:2015-3_Budhanilkantha,Nepal-DSCF5263.JPG) | CC BY-SA 4.0 | Samosas | pakora ×2, samosa ×3, puri ×4 | 1840 | dish right, but a stall display |
| 31 | [Anar Kheer.JPG](https://commons.wikimedia.org/wiki/File:Anar_Kheer.JPG) | CC0 | Kheer | kheer ×2 | 421 | exact |
| 32 | [Aloo puri thali.jpg](https://commons.wikimedia.org/wiki/File:Aloo_puri_thali.jpg) | CC BY-SA 4.0 | Kheer | puri ×3, aloo_matar ×1, kheer ×1 | 860 | right (aloo puri thali with kheer) |
| 33 | [Beef Nihari.JPG](https://commons.wikimedia.org/wiki/File:Beef_Nihari.JPG) | CC0 | Nihari | nihari ×1 | 539 | exact |
| 34 | [1 Gulab Jamun Mithai Sweets of India cropped.jpg](https://commons.wikimedia.org/wiki/File:1_Gulab_Jamun_Mithai_Sweets_of_India_cropped.jpg) | CC BY 2.0 | Gulab jamun | gulab_jamun ×6 | 1118 | exact |
| 35 | [A variety of naan (8608405187).jpg](https://commons.wikimedia.org/wiki/File:A_variety_of_naan_(8608405187).jpg) | CC BY-SA 2.0 | Naan | naan ×15 | 5312 | dish right, but a seller's stack logged as 15 naans |
| 36 | [A traditional south Indian home cooked meal.jpg](https://commons.wikimedia.org/wiki/File:A_traditional_south_Indian_home_cooked_meal.jpg) | CC BY-SA 4.0 | Raita | plain_rice ×1, daal_masoor ×1, mix_sabzi ×1 | 716 | main meal right; raita bowl missed |
| 37 | [A scene of Puri.JPG](https://commons.wikimedia.org/wiki/File:A_scene_of_Puri.JPG) | CC BY-SA 3.0 | Puri (food) | puri ×5 | 649 | exact |
| 38 | [A cup of chai.JPG](https://commons.wikimedia.org/wiki/File:A_cup_of_chai.JPG) | Public domain | Masala chai | chai ×1 | 100 | exact |
| 39 | [2024-01-16 - Kashmir Café - Samosas.jpg](https://commons.wikimedia.org/wiki/File:2024-01-16_-_Kashmir_Caf%C3%A9_-_Samosas.jpg) | CC BY-SA 3.0 | Samosas | samosa ×3 | 705 | exact |
| 40 | [20191205 Sprzedawca masala czaj w Starym Delhi 060](https://commons.wikimedia.org/wiki/File:20191205_Sprzedawca_masala_czaj_w_Starym_Delhi_0602_6732.jpg) | CC BY-SA 4.0 | Masala chai | chai ×1 | 100 | exact |
| 41 | [A Whole Meal.JPG](https://commons.wikimedia.org/wiki/File:A_Whole_Meal.JPG) | CC BY-SA 4.0 | Raita | chicken_biryani ×1, raita ×1 | 656 | right (biryani and raita) |
| 42 | [Cooking forty Haleem pots in Hamedan 1 (Mehr, 2025](https://commons.wikimedia.org/wiki/File:Cooking_forty_Haleem_pots_in_Hamedan_1_(Mehr,_2025).jpg) | CC BY 4.0 | Haleem | haleem ×1 | 515 | exact |
| 43 | [1 bajre ki roti .bthuve ki sbji.desi tindi gi v ls](https://commons.wikimedia.org/wiki/File:1_bajre_ki_roti_.bthuve_ki_sbji.desi_tindi_gi_v_lssi_ka_gilas.jpg) | CC BY-SA 4.0 | Lassi | sarson_saag ×1, makki_roti ×2, salted_lassi ×1 | 695 | one tap (bajra roti is not in the catalogue; lassi salted vs sweet) |
| 44 | [A Tandoori Parata.jpg](https://commons.wikimedia.org/wiki/File:A_Tandoori_Parata.jpg) | CC BY-SA 4.0 | Paratha | naan ×1 | 354 | one tap (tandoori paratha read as naan) |
| 45 | [A complete meal.jpg](https://commons.wikimedia.org/wiki/File:A_complete_meal.jpg) | CC BY-SA 4.0 | Puri (food) | halwa_puri ×1 | 963 | exact (a full halwa puri plate) |
| 46 | [202408191828 IMG 1988.jpg](https://commons.wikimedia.org/wiki/File:202408191828_IMG_1988.jpg) | CC BY-SA 4.0 | Samosas | chana_chaat ×1 | 200 | one tap (samosa chaat was the runner-up) |
| 47 | [Al haaj bundoo khan's haleem.jpg](https://commons.wikimedia.org/wiki/File:Al_haaj_bundoo_khan%27s_haleem.jpg) | CC BY 2.0 | Haleem | haleem ×1 | 515 | exact |
| 48 | [Afgani leg.jpg](https://commons.wikimedia.org/wiki/File:Afgani_leg.jpg) | CC BY-SA 4.0 | Tandoori chicken | chicken_tikka ×1 | 259 | exact |
| 49 | [2020-02-22 20 57 16 Butter chicken in tomato sauce](https://commons.wikimedia.org/wiki/File:2020-02-22_20_57_16_Butter_chicken_in_tomato_sauce_with_fenugreek_at_Karma_Modern_Indian_in_Washington,_D.C.jpg) | CC BY-SA 4.0 | Butter chicken | butter_chicken ×1 | 354 | exact |
| 50 | [A piece of a tandoori chicken.JPG](https://commons.wikimedia.org/wiki/File:A_piece_of_a_tandoori_chicken.JPG) | CC BY-SA 4.0 | Tandoori chicken | chicken_tikka ×1 | 259 | exact |
| 51 | [A vegetarian plate of food.jpg](https://commons.wikimedia.org/wiki/File:A_vegetarian_plate_of_food.jpg) | CC BY-SA 4.0 | Naan | daal_makhani ×1, other: paneer butter masala ×1, naan ×1, plain_rice ×1 | 890 | right (every item on the plate read) |
| 52 | [Chapati palak paneer and brinjal semi gravy homema](https://commons.wikimedia.org/wiki/File:Chapati_palak_paneer_and_brinjal_semi_gravy_homemade_by_Sujatha_aunty_karnataka.jpg_02.jpg) | CC BY-SA 4.0 | Palak paneer | palak_paneer ×1, paratha ×1 | 663 | exact |
| 53 | [2020-05-08 19 30 21 Chapati in the Franklin Farm s](https://commons.wikimedia.org/wiki/File:2020-05-08_19_30_21_Chapati_in_the_Franklin_Farm_section_of_Oak_Hill,_Fairfax_County,_Virginia.jpg) | CC BY-SA 4.0 | Chapati | roti ×1 | 102 | exact |
| 54 | [1st Roti Machine Design 2013.jpg](https://commons.wikimedia.org/wiki/File:1st_Roti_Machine_Design_2013.jpg) | CC BY-SA 4.0 | Chapati | (no food) | 0 | right: a roti machine, nothing logged |
| 55 | [Bhong Ka Gosht.JPG](https://commons.wikimedia.org/wiki/File:Bhong_Ka_Gosht.JPG) | Public domain | Nihari | other: raw meat ×1 | 0 | right: raw meat, nothing logged |
| 56 | [Aam Kheer (Mango Kheer).jpg](https://commons.wikimedia.org/wiki/File:Aam_Kheer_(Mango_Kheer).jpg) | CC BY-SA 4.0 | Kheer | kheer ×2 | 421 | exact |
| 57 | [Awadhi palak paneer paratha dahi.jpg](https://commons.wikimedia.org/wiki/File:Awadhi_palak_paneer_paratha_dahi.jpg) | CC BY 2.0 | Palak paneer | paratha ×2, sarson_saag ×1, dahi ×0.5 | 862 | one tap (palak paneer read as saag; offered) |
| 58 | [Achari Biryani.JPG](https://commons.wikimedia.org/wiki/File:Achari_Biryani.JPG) | CC0 | Biryani | chicken_biryani ×2 | 1198 | exact |
| 59 | [2013 Sechseläuten - 'Samosa' und 'Pakora' - Limmat](https://commons.wikimedia.org/wiki/File:2013_Sechsel%C3%A4uten_-_%27Samosa%27_und_%27Pakora%27_-_Limmatquai_2013-04-14_17-37-05_(P7700).JPG) | CC BY-SA 3.0 | Pakora | pakora ×1, samosa ×0.5 | 425 | exact |
| 60 | [*Gulabjamun*.jpg](https://commons.wikimedia.org/wiki/File:*Gulabjamun*.jpg) | CC BY-SA 4.0 | Gulab jamun | gulab_jamun ×6 | 1118 | dish right, but a frying pan, not a plate |

## First live run: Gemini 3 Flash (26 November 2026)

Run through the real recognition server with a free Gemini key (`gemini-3-flash-preview`, 3 samples per photo).
54 of the 60 photos downloaded this time. **The free tier stopped the run after 17 photos**: it allows 20 requests
per model per day, and each photo uses 3, so about 6 photos a day per model.

| Of the 17 photos it finished | |
|---|---|
| Main dish right | **12 (71%)**: all three haleem, both rotis, three chapli kebabs, two gulab jamun, two jalebi |
| Fixable with one tap | 4: two parathas read as tandoori roti or aloo paratha (same bread family), pakoray as samosa + pakoray, kheer behind puri and aloo matar |
| Wrong | 1: a chai photo read as plain rice |

Too few photos to compare with the earlier blind read; finish the run with a paid key. The free tier can't serve
clients either: even one client logging three meals a day would use up the daily limit.

## Repeat it against the live server

```bash
python3 tools/fetch-test-photos.py test-photos
```

```bash
GEMINI_API_KEY=... node tools/food-vision-server.mjs
```

```bash
node tools/photo-test.mjs test-photos http://localhost:8787/food-vision
```

The script scores against the Commons category, so read its "wrong" lines before trusting the number.
