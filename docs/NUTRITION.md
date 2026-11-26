# Food tracking for desi food: which database, and why a database alone isn't enough

## The short answer

No free database gets Pakistani and Indian home and restaurant food right on its own. The data exists for **ingredients**, and partly for **standard Indian recipes**. What's missing is the thing that matters most: **how much oil or ghee went in, and how much of the katori was meat**.

So Shred uses three free sources, plus its own dish models on top:

| Source | What it gives | Licence | Used for |
|---|---|---|---|
| **Desi dish models** (`js/nutrition.js`, written for this app) | 113 Pakistani, Indian, fast-food, café and street-food dishes as recipes: meat, masala, and fat by who cooked it | Ours | Everything people eat most: karahi, qorma, nihari, haleem, biryani, pulao, daal, cholay, roti, paratha, naan, kebabs, samosa, pakoray, chai, lassi, sweets |
| **Indian Nutrient Databank (INDB)**, 2024 | 1,014 standard Indian recipes, per 100 g and per serving, built on ICMR-NIN IFCT 2017 | Open access paper and data on GitHub; **no licence file** (see below) | Search for anything the dish models don't cover (dhokla, upma, idli, regional sabzis…) |
| **USDA FoodData Central** (SR Legacy) | Raw ingredients: meat, flours, lentils, oils, dairy, vegetables | Public domain (CC0) | The ingredient values inside every dish model; searchable ingredients |

### What we looked at and didn't pick

- **USDA FoodData Central alone.** Excellent, free and CC0, but its desi dishes are few and American-style ("chicken curry, NFS").
- **Open Food Facts.** Good for **packaged** food with barcodes (Shan masala, Nestlé, biscuits). Licence ODbL, which requires sharing changes to the database. It's worth adding later as a barcode scanner. It has no home or restaurant cooking.
- **ICMR-NIN Indian Food Composition Tables 2017 (IFCT).** The best lab data for South Asian raw foods. The book and data have to be requested from NIN and aren't openly licensed for redistribution. INDB is built from it, so we get its values that way.
- **Food Composition Table for Pakistan (2001, University of Agriculture Peshawar / UNICEF).** Pakistan's only national table. It's old, covers raw foods rather than dishes, and isn't available as a clean download. A revision was planned around 2015, but we found no sign it was published.
- **MyFitnessPal / Nutritionix / FatSecret.** Mostly user-entered for desi food: ten versions of "chicken karahi" from 180 to 700 kcal. They're paid APIs with terms that don't allow copying the data.

## Why INDB can't be used blindly

1. **It has no Pakistani staples.** There's no nihari, haleem, karahi, chapli kebab or cholay, and only two biryanis.
2. **Its recipes are textbook home cooking** from Indian cookery manuals: modest oil, no restaurant or wedding versions.
3. **For deep-fried foods it counts all the frying oil as eaten.** A potato samosa comes out at **577 kcal per 100 g** (a real one is about 260–300). The import marks 71 such recipes as fried, and the app warns on them and points to its own fried-food model.

We use INDB as a **cross-check**. On 9 dishes the two share, our home-style models land within 25% of INDB per 100 g, and the median gap is about 10% (`tests/nutrition.test.mjs`).

**Licence:** the INDB GitHub repository has no licence file. The paper is open access. Before a commercial launch, email the authors (Jaacks lab, University of Edinburgh / Anuvaad Solutions) for written permission, or replace INDB with your own recipes. The dish models and USDA data don't depend on it.

## How a desi estimate is computed

Each dish is a recipe for one standard serving:

```
chicken karahi, 1 katori (≈200 g cooked)
  meat:   110 g raw chicken (edible part, bone not counted)
  base:   80 g tomato, 8 g ginger, garlic, chilli and masala
  fat:    oil — home 14 g · restaurant 28 g · shaadi/dhaba 36 g
```

The user (or the photo step) answers only what a person can tell:

| Question | Effect |
|---|---|
| **How much?** In rotis, katori, plate or pieces, with grams shown | Scales everything |
| **Who cooked it?** Home, restaurant, or shaadi/dhaba/street | Picks the fat grams: the biggest single source of error |
| **Meat or gravy?** Mostly gravy, even, or mostly meat | More meat means more protein and less gravy, so less oil |
| **Oil you can see?** Less, normal, or oil on top (tarri) | ×0.7 / ×1 / ×1.4 on the fat |
| **Size** (roti, paratha), **ghee or butter on top** | Breads |

The result always shows:
- calories with a **likely range** (about ±1 SD, from portion, fat and meat-share uncertainty)
- protein, carbs, fat and fibre
- **where the calories come from**, e.g. "Oil: 42 g, 61% of the calories"

Telling people the oil is most of the calories is often the most useful thing the app can say.

The app remembers each person's answers per dish. If your karahi is always from a restaurant, it starts there next time.

## Photo recognition that gives the same answer twice

The old ChatGPT feature asked the model for calories. A language model **samples** its answer, so the same plate gave different numbers. The new design:

1. The model only **identifies and measures**. It picks dish ids from our catalogue (a strict JSON schema with an enum), counts portions in our units, and reports visible cues (meat share, oil on top, restaurant or home setting). It is told not to give calories.
2. The server asks it **3 times in parallel**, and the app keeps the **consensus**: a dish must appear in at least half the answers, portion is the median, and cues are the majority.
3. **Calories come from the dish models**, so the same dish and portion always give the same number.
4. Results are **cached by a SHA-256 hash of the image**, so the same photo always gives the same answer, on the phone and on the server.
5. If the answers disagree, the app says **"Please check"**, and every dish can be changed in two taps. The cooking style it can't see is marked "probably restaurant" until you confirm it.

Run the server (`tools/food-vision-server.mjs`) with either key; it has no dependencies:

```bash
ANTHROPIC_API_KEY=... node tools/food-vision-server.mjs
```

```bash
OPENAI_API_KEY=... OPENAI_MODEL=gpt-4o node tools/food-vision-server.mjs
```

Then set `PHOTO_CONFIG.endpoint` in `js/foodphoto.js`. Keep the key on the server, never in the app.

## FatSecret and MyFitnessPal

- **FatSecret's** API is free, including for commercial use, but its terms allow keeping its data for at most 24 hours (except fields marked storable, like the food ID). Copying it into our own database isn't allowed. It *can* be used as a live fallback search through the same server, with only the food ID saved in the log.
- **MyFitnessPal** has no public API: access is partner-only and its licence is personal use. Its data can't be extracted.
- Their desi entries are mostly typed in by users anyway, which is the problem this app solves.

## No weighing: one-tap photos and the weekly report

Clients don't weigh anything. A photo is logged in one tap, and each dish can be fixed with a tap. One photo is roughly ±25–30% for curries and much better for counted items (rotis, kebabs, pieces). Across a week the errors partly cancel. The weigh-ins then show whether the logs run high or low: the report works out real maintenance calories from the logs and the scale (`js/weekly.js`).

The weekly report:
- opens with what went well
- gives at most two things to add next week (protein, veg and fruit, water, dairy, iron for women, fibre, fish, or one easy swap when cutting), with the nutrients each brings and a desi way to do it
- adds gentle notes about vitamin D and B12 tests

During rehab it never pushes a calorie cut.

## Places: chains, restaurants and carts

No public database lists Pakistani restaurant and cart menus with nutrition. `js/menus.js` seeds:
- the big chains
- well-known desi restaurants
- the street-food formats every cart sells

Every item points at a dish model with that place's portion and oil level. When a chain publishes official values, add them as `official` on the item and they replace the estimate. Clients add their own places with **Add a place**: they pick the closest dish, so the numbers stay realistic. Places are stored on the phone for now. With a backend, places added by one client could be shared with all (after QK reviews them).

## Making it more accurate over time

- **Weigh real plates.** Order or cook each top dish a few times, weigh the katori, and skim and weigh the oil. Then adjust the fat grams in `DISHES`. This is the single biggest accuracy gain, and the tests show how far each change moves away from INDB.
- **QK's own recipes.** Add your meal plans as dish models (exact grams), so clients following them log with zero error.
- **Barcode scanning** with Open Food Facts for packaged food.
- **Let users save their own recipes** from ingredients (the engine already supports it: a recipe is just ingredients and fat).

## How Shred compares (November 2026)

Facts about other apps come from their store listings and press coverage (see the sources in the chat history), not from testing them side by side. "Not mentioned" means their listing doesn't describe it, not that it's missing.

| | **Shred** | **Calorify** (PK) | **Kalorist** (PK) | **MyFitnessPal** | **HealthifyMe** | **MacroFactor** |
|---|---|---|---|---|---|---|
| Desi dishes | 113 recipe models + 1,014 INDB recipes | 750+ home and street dishes | Desi foods | User-entered | Large Indian database | Generic |
| Oil, who cooked it, meat vs gravy | **Yes, with a range** | Not mentioned | Not mentioned | No | Not mentioned | No |
| Restaurants and carts | 45 places / 170 items, 20 with official values; clients add their own | **223 chains / 12,500+ items** | Local cafés | Large, mostly Western | Indian chains | Few |
| Photo logging | One tap, same answer every time, learns your portions | Not mentioned | Not mentioned | Meal Scan + Cal AI | Snap | Yes |
| Say it / type the meal (Urdu, Roman Urdu) | **Yes** | Not mentioned | Not mentioned | English voice | Ria AI chat | Text describe |
| Barcode | Yes (Open Food Facts) | Not mentioned | Not mentioned | Yes | Yes | Yes |
| Calories needed, from weight trend | Yes | Not mentioned | Not mentioned | No | No | **Yes** |
| Weekly coaching report | **Wins first, two additions, nutrients, rehab-aware** | Not mentioned | KalCoach AI | Basic reports | Coach (paid) | Weekly check-in |
| Coach sees clients' food | **Yes (QK's dashboard)** | No | No | Friends only | Paid coaches | No |
| Training, form camera, rehab | **Yes** | No | No | Basic | Workouts | No |
| Urdu interface | Food screen | Not mentioned | Not mentioned | No | Hindi | No |
| Published accuracy check | Recipe models vs 20 published values: 10% median | Labels each value official / derived / estimated | Not mentioned | Third-party tests | 60–70% recognition at launch | Third-party tests |

### Where Shred is ahead
- It estimates the oil, the main source of error in desi food, and says so ("Oil: 42 g, 61% of the calories").
- Photos give the same answer every time and learn each person's portions from weighings.
- You can log a whole meal by saying or typing it in Roman Urdu or Urdu.
- Food, training, rehab and coaching are in one app. QK sees each client's food week next to their training, and the weekly report is written to motivate, not to judge.

### Where it is still behind
- **Restaurant coverage.** Calorify has about 70 times more menu items. Closing the gap is data work: collect chain menus (foodpanda pages, menus) and map each item to a dish model, as `js/menus.js` does. Client-added places, reviewed by QK, help grow it.
- **Proof of accuracy on desi plates.** The tooling exists (weigh-to-calibrate and the CSV export). The 50–100 plate study itself still has to be done with a scale and real food.
- **Packaged food breadth.** Open Food Facts covers fewer Pakistani products than MyFitnessPal's 20 million entries. FatSecret's live fallback helps.
- **Untested pieces.** The native steps plugins are uncompiled. Photo recognition and FatSecret haven't run against the live services yet.
