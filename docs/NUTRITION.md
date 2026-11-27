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

Run the server (`tools/food-vision-server.mjs`) with any one of these keys; it has no dependencies. **Gemini has a free tier**, good for testing. On the free tier Google may use what you send to improve its products, so switch to a paid key (Gemini, Claude or OpenAI) before real clients upload meal photos:

```bash
GEMINI_API_KEY=... node tools/food-vision-server.mjs
```


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

## Calories that keep up with the body

**Starting target** (`maintenance()` and `targets()` in `js/nutrition.js`):
- **Resting burn:** Mifflin-St Jeor, from weight, height, age and sex.
- **Daily movement, by job:** desk or student ×1.2, on their feet ×1.35, physical work ×1.5.
- **Training:** each session adds about 4 kcal per kg, spread over the week. Training days default to the client's training plan.
- **Goal:** −20% to lose, +10% to gain. Protein is 2.0 g/kg when losing and 1.8 g/kg otherwise.
- **Floor:** never below 90% of resting burn, and never below 1,500 kcal (men) or 1,200 kcal (women).

**Two-weekly check-ins** (`js/adapt.js`). Bodies adapt: a lighter body burns less, so a target that worked stops working. Every 14 days the app asks for a morning weigh-in and reads the trend from the last 2–3 weeks of weigh-ins, ignoring day-to-day water swings. Then it offers a small next step, and the client chooses:

| Last two weeks | What QK offers |
|---|---|
| Cutting, weight held steady | First, kindly: walk 2,000 more steps a day (food stays the same). Or eat 150 kcal less, or give it two more weeks |
| Cutting, losing 0.15–1% of body weight a week | Keep going as is, or one small step: 1,500 more steps or 100 kcal less |
| Cutting, losing over 1% a week | Eat 150 kcal more to protect muscle |
| Bulking, not gaining / gaining over 0.6% a week | 150 kcal more / 100 kcal less |
| Maintaining, drifting more than 0.3% a week | ±100 kcal (or more steps if drifting up) |

Guardrails:
- Changes are capped at ±600 kcal in total.
- "Eat less" is never offered below the floor or during rehab.
- Messages are worded to motivate, never to blame.

Reminders reach the phone even when the app is closed. Web Push (`js/push.js`, `tools/webpush.mjs`, `tools/push-checkins.mjs`) runs from a daily GitHub Actions job, with no server to keep running; setup is in supabase/README.md, step 6. There's also an in-app notice and an optional calendar reminder every two weeks. QK sees each client's last check-in choice on the dashboard.

**Weight graph:** every weigh-in is kept, with ranges of 1 month, 3 months, 1 year and all time, a 7-day smoothed trend line, and the change over the range and since the client started.

## Diet plans

The questionnaire QK used to send by form is now in the app (Food → Your diet plan). It asks:
- what the client eats (everything, no beef, chicken and fish only, vegetarian with or without eggs)
- meals a day (3, 4 or 5)
- the breakfasts, lunches, dinners and snacks they like
- anything they can't eat (dairy, gluten, nuts, eggs)

Plans start from what Pakistanis actually eat. Research on everyday eating (Gallup Pakistan, dietitian and coach pages) shaped the meals:
- **Breakfast:** paratha and anda, anda and roti, bread with peanut butter and eggs, chana chaat, lassi. Oats, cereal and dahi bowls are there for those who like them.
- **Lunch and dinner:** roti or chapati with chicken tikka, boti, seekh, karahi, salan, qeema, daal or sabzi. There's also a biryani day, plus salad and raita.
- **Snacks:** chai with nuts, fruit, boiled eggs, chana chaat.
- **Choosing foods:** the client picks from chips like "BBQ (tikka, boti, seekh)" or "Karahi", and each chip covers the matching foods.

`js/dietplan.js` then builds the plan:
- **Each meal gets a share of the day's targets** (calories, protein, carbs, fat from Mifflin-St Jeor).
- **Each meal offers up to 3 options of the same size**, built from foods the client likes.
- **Every food gets an exact amount on real portion steps**: 25 g of chicken, whole eggs, whole rotis, half katoris. A small search finds the amounts closest to the calories and protein first, then carbs and fat.
- **Meat is given raw**, with the cooked weight beside it, plus the oil to cook it in.
- **Values come from the same USDA ingredients and home-cooked dish models as the rest of the app.** "I ate this" therefore logs exactly what was planned.
- **Tests check the results** for five client types (`tests/dietplan.test.mjs`): calories within 8% of target, diet and allergies respected, and logged numbers equal to planned numbers.

QK sees each client's plan (calories, protein, meals) on the coach dashboard. QK editing a client's plan from the dashboard is the next step. It needs a coach-writable table, because today the database only lets coaches send messages.

## Say where you ate it

Clients can say or type where the food came from, and every dish in the sentence takes that place's portion, oil level and official numbers (`js/foodtext.js`, tested in `tests/placemeal.test.mjs`):

| Said | Logged as |
|---|---|
| "Nagina se anda shami burger khaya" | Nagina Burger Point's anda shami burger |
| "Ravi restaurant se chicken karahi aur 2 naan" | Ravi's karahi and 2 of Ravi's naans |
| "big mac from mcdonalds" | McDonald's Big Mac, official values |
| "zinger burger from Burger Hub" (not on their menu) | A zinger cooked restaurant-style, labelled Burger Hub |
| "beef burger at Johnny Rockets" (not in the database) | Restaurant-style, with the place's name kept |
| "ghar ka daal chawal" / "karahi from a dhaba" | Home cooking / dhaba oil levels |

## Scores (Today, and per client on the dashboard)

`js/scores.js` works out each score over the last 7 days, so one bad meal or night doesn't swing it.

| Score | From | Unlocks after |
|---|---|---|
| Nutrition | calories near target (35%), protein (30%), veg and fruit (20%), logging (15%) | 3 logged days |
| Recovery | the one-tap morning card (sleep, tiredness, stress, soreness) against the client's own baseline; −8 if under 6.5 h sleep | 3 mornings |
| Activity | steps against the step goal (8,000 a day until a check-in sets one) | 3 days of steps |
| Workout | training days vs plan (50%), clean reps (25%), strength trend (25%) | the first workout |
| Health | the others, weighted: nutrition 30%, workout 25%, recovery 25%, activity 20% | 2 of the above |
| Fitness age | an estimate from age, sex, waist, resting heart rate and training (HUNT Fitness Study, Nes et al. 2011) | waist + resting HR measured |

**Colours:**
- **75+ green, "Strong".**
- **50–74 amber, "Building".**
- **Under 50 red, "Needs attention".** It always comes with the one fix that would raise it most ("Fix first: aim for 7–8 hours…").

Why this differs slightly from a plain "red = danger":
- **The word.** Red says "Needs attention", not "danger". It motivates without frightening anyone off the app.
- **Missing data is grey.** A new client sees "not enough data yet", never red for something they haven't logged.
- **A score turns red only on a pattern**, over 7 days, never from one day.
- **One fix, the most useful one.** Not a list of everything wrong.

Fitness age is labelled as an estimate everywhere and is not a medical test. QK sees each client's score chips, and a health chip in the client list.

## Signals, not paperwork

The app reads the small signals a coach watches, from what clients already do (`js/signals.js`). Nothing extra to type:

| Signal | Comes from | What changes |
|---|---|---|
| Logging | food logs, weigh-ins, sessions, morning cards | A warm "no catching up needed" line after 3 quiet days. A check-in with few logs says it's reading the scale, not the meals |
| Sleep and stress | the one-tap morning "How do you feel?" card | A stall during a rough week: no cut; keep the plan and protect sleep |
| Strength | the best lift of each exercise, last 2 weeks vs the 4 before | Losing weight while lifts drop 5%+: a little more food is offered first |
| Cycle (women, opt-in, one tap a month, stays on the phone) | "Period started today" | A stall in the week before or the first days of a period: nothing changes ("water weight, not fat") |

QK sees logging, sleep, rough mornings and strength on the dashboard. The cycle is never synced.

**Notifications stay few.** Clients choose under Your targets → Reminders from QK:
- **Just the essentials** (the default): the check-in every two weeks, and QK's plan updates.
- **A gentle nudge too:** adds at most one reminder a week, only after 3 days without logging food, never on a check-in day. The wording never blames.
- **Off.**

Whatever they choose, they never get more than one notification a day; QK's plan update beats a check-in, which beats a nudge.

## QK edits plans on the dashboard

Each client's plan shows on the coach dashboard. QK can do all of this, and every total updates as he types:
- change any amount
- remove a food
- add a food from the plan list
- write a note

When QK saves, the client's app shows "Edited by QK" with the note, and they get a notification. The app never overwrites QK's version with its own: not when the client's targets change, and not when they ask for other options.

## The UAE

For clients in Dubai, Abu Dhabi and Sharjah:
- **36 Gulf, Levantine, Iranian and cafeteria dishes** are modelled from their ingredients, the same way as the desi ones. They include mandi, machboos, kabsa, harees, hummus, mutabbal, falafel, manakish, shish tawook, mixed grill, koobideh, karak chai, luqaimat and Kerala parotta. The UAE build-ups were checked against published values where they exist (Saudi MOH, FatSecret, USDA hummus and tabbouleh).
- **15 café and chain foods** were added too, including lattes, Spanish latte, Iced Capp, croissant and toum.
- **89 places with 358 items are in `js/places-uae.js`.** Of these:
  - **30 are chains.** Dubai requires calories on chain menus, but most chains don't publish them online. Only 18 items have official values so far (Papa John's UAE, Calo, Kcal, Five Guys, two McDonald's UAE items via a third-party calculator, one Zaatar w Zeit item). The rest are marked `check`, to fill in from the menus or the delivery apps.
  - **59 are local places:** Ravi, Karachi Darbar, Al Ustad, Bait Al Mandi, Al Fanar, Logma, Al Mallah and more.
- **When the client's city is in the UAE, UAE branches and places come first**, and Pakistani ones come first in Pakistan.
- **Menu calories from clients.** UAE menus must show calories, so when an item has no official number, clients can type in the one on the menu. That number is used for the item from then on, and it syncs to QK for review, so the chain list fills in as clients eat. The one official number is split into protein, carbs and fat the way the dish model splits them.

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
| Restaurants and carts | 45 chains (170 items, 20 with official values) + 259 local places in 11 cities (646 items); clients add their own | **223 chains / 12,500+ items** | Local cafés | Large, mostly Western | Indian chains | Few |
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
