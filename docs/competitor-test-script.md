# Competitor test script: Shred by QK side by side with Flo, Clue, Natural Cycles, Apple Health and others

**Purpose:** see what the apps **actually do** with the same made-up period dates, instead of relying on their websites (`docs/competitor-comparison-2026-11-27.md` was written from public descriptions only).

**What this can and can't show:**
- It shows how each app **behaves**: what it asks, what it predicts, and what it does when a period is late or forgotten.
- It does **not** show real accuracy. That would need many real people over many months.

## Before you start (privacy)
- Use a **throwaway email** for any app that needs an account. Never use your real name, real dates or real health data.
- Don't link Apple Health, Google Fit, contacts or location, and say **no** to marketing and data-sharing prompts. Screenshot each prompt first: we want to see what they ask.
- Don't pay for a subscription. If a feature is behind a paywall, screenshot the paywall and move on.
- When finished, delete each test account (use the app's own "delete account"), then delete the app.
- **Age:** enter an adult age (for example born 1995). Don't test under-age sign-ups on real services.

## Which apps
| App | Needs hardware? | What we can test |
|---|---|---|
| **Shred by QK** (ours) | No | Everything below |
| **Flo** | No | Everything below (some answers behind Premium) |
| **Clue** | No | Everything below (some behind Clue Plus) |
| **Natural Cycles** | Thermometer or wearable for its main feature | Sign-up, dates-only behaviour, modes, privacy |
| **Apple Health (Cycle Tracking)** | iPhone; Watch for temperature | Dates-only predictions, late and irregular alerts, privacy |
| **Oura**, **WHOOP** | Ring or strap | Sign-up and menus only (apps may not open fully without the device) |

Start with Shred, Flo and Clue. Add others if you have time.

## The made-up dates
"Day −28" means **28 days before the day you do the test**. Use the phone's calendar to count back.
Each period lasts **5 days** (enter an end date 4 days after the start, if the app asks).

Run the scenarios **in order, in the same test account**. Between scenarios, **delete all the period dates** you entered (each app's history or calendar lets you delete entries). If an app can't delete them, make a fresh test account for each scenario.

| Scenario | Period start dates to enter | What it tests |
|---|---|---|
| **S1. Regular** | Day −84, Day −56, Day −28 (28-day cycles) | The basic prediction |
| **S2. Late** | Day −100, Day −72, Day −44 | The next period was "due" about 16 days ago. How does the app handle a late period? |
| **S3. Forgotten log** | Day −140, Day −112, Day −84, Day −28 | One gap is 56 days, about two cycles. Does the app notice that a period may not have been logged? |
| **S4. Short and irregular** | Day −95, Day −80, Day −65, Day −30, Day −15 | Cycles of 15, 15, 35 and 15 days. Does it still give a sensible prediction or ask the right question? |
| **S5. Only one period** | Day −10 | What does it predict from a single date? |

## What to record for each app (screenshot each)
### A. Sign-up (fresh install)
1. Every question it asks, in order. Screenshot each screen.
2. Does it ask **gender or sex**? What does a man see?
3. Does it ask **age**? What happens under 18? (Read it, don't test it.)
4. Does it **require an account**? Can you use it without one?
5. Every **permission or data-sharing** prompt (notifications, Health, tracking, marketing).

### B. For each scenario S1 to S5
6. **Prediction:** a single date, or a range? Screenshot the home screen and the calendar.
7. Does it say **how sure** it is, or what it's based on?
8. **S2 (late):** what does it say? Does it mention pregnancy? Does it keep the old date or move it?
9. **S3 (forgotten log):** does it ask whether you missed logging a period? Does it treat the 56-day gap as one long cycle?
10. **S4 (irregular):** does it give a date, a range or a warning? Does it say the cycles are irregular?
11. **S5 (one period):** does it predict anything? On what basis?
12. Does it **ask you anything** (check-ins, "has your period started?")? When?

### C. Life stages and coaching
13. **Pregnancy mode:** how do you turn it on? What does it show? Screenshot.
14. **After a birth** and **perimenopause/menopause:** are there modes? Screenshot.
15. **Coaching:** any advice on training, sleep or food by cycle phase? Any AI chat? Screenshot one example.

### D. Privacy
16. Where it says your data is stored, and whether there's an **anonymous or no-account** mode.
17. **Data-sharing settings:** what's on by default?
18. **Lock-screen notification:** if you allow notifications, what does a reminder say? Does it mention periods?
19. How to **export** and **delete** your data.

## How to do the same in Shred by QK
1. Open the app on your phone (see "Opening Shred on your iPhone" below).
2. **Sign-up:** choose Woman, then 18 or over, then **Yes** to "Would you like to track your periods?".
3. Read Zara's welcome and the privacy terms, tick the box, and tap **Agree and start**.
4. **Zara's first question:** for S1, enter Day −28 as "last period" and Day −56 as "the one before", then tap **Save**. Then add Day −84 on the cycle screen: put it in the **Date** field and tap **Period started**.
5. **Between scenarios:** open **Your history** and tap **Delete** on each period. To start from scratch instead, open **Settings, export & delete** and tap **Delete all cycle data**.
6. Screenshot the same things (B6 to B12): the estimate card, any check-in cards (late, missed period, long gap), and "Why this estimate?".

## Opening Shred on your iPhone (from your Mac, on the same Wi-Fi)
This uses the HTTPS test server in `tests/ios/`. Nothing is published to the internet.
1. On the Mac, in the project folder, find the Mac's local IP: System Settings → Wi-Fi → Details (for example 192.168.1.20).
2. Make the test certificate once:
   ```bash
   bash tests/ios/make-certs.sh 192.168.1.20
   ```
3. AirDrop `tests/ios/.certs/ca.pem` to the iPhone. On the iPhone:
   - install the profile: Settings → General → VPN & Device Management;
   - turn on full trust for it: Settings → General → About → Certificate Trust Settings.
4. Start the server:
   ```bash
   node tests/ios/serve-https.mjs 192.168.1.20
   ```
5. On the iPhone, open Safari at `https://192.168.1.20:8443`.
6. When finished:
   - stop the server with Ctrl-C;
   - delete the profile on the iPhone;
   - delete `tests/ios/.certs/`.

Use the Mac's real IP in place of 192.168.1.20.

## What to send back
- Name screenshots like `flo-S2-home.png`, `clue-A-signup-3.png` or `shred-S3-missed.png`.
- Send them in one folder or ZIP, with a note of anything surprising.
- Leave out anything that shows your real email or account name.

I'll compare the apps side by side and rewrite the comparison from what they **actually do**, with "not tested" wherever a feature couldn't be reached.
