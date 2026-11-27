# Shred by QK compared with Flo, Oura, WHOOP and 13 other cycle products

**Date:** 2026-11-27. This replaces the scorecard in `docs/competitor-gaps.md` (2026-11-25), which covered only Oura, WHOOP and the Hume Band.

**Sources:**
- Public web sources only: official pages, help centres, FDA records, peer-reviewed papers, and reputable reporting.
- The full sourced notes (one section per product, each claim with its URL) are in `docs/competitor-research-2026-11-27.md`.
- **Caveat:** pages on ouraring.com and whoop.com could not be opened directly, so those details come from search-engine copies and press coverage. They should be checked on the live sites.

**Rules for this comparison:**
- Competitor accuracy figures are **theirs**, from their own studies, populations and reference tests. They say nothing about Shred by QK, and we do not borrow them.
- Our only accuracy figure comes from our own test on one public research dataset (Marquette, dates only). It is not clinical validation.
- The scores are an engineering judgement against public descriptions, not a test of the competitors' products.

## 1. What each product is, in one line
| Product | What it is | Regulated? |
|---|---|---|
| **Flo** | The most-used logging app: periods, symptoms, trying to conceive, pregnancy, perimenopause; AI assistant; partner sharing | Wellness only |
| **Oura** | Ring: finger temperature + heart signals; period and fertile-window predictions; ovulation confirmed after the fact; pregnancy and perimenopause insights; AI Advisor | Wellness; contraception only via Natural Cycles |
| **WHOOP** | Strap: recovery, sleep and strain coaching adjusted by cycle phase; life-stage toggles; blood tests; Natural Cycles included since Aug 2026 | Wellness (FDA warning letter in 2025 about its blood-pressure feature) |
| **Clue** | Logging app (Berlin, GDPR); conceive, pregnancy and perimenopause modes | Birth Control mode FDA-cleared 2021; may no longer be available |
| **Natural Cycles** | Temperature (thermometer or wearable) + optional LH tests; contraception, conception, pregnancy, postpartum, perimenopause | **FDA-authorised contraception** (2018, updated 2026) |
| **Apple Health** | Logging + Apple Watch wrist temperature; ovulation estimated after the fact; alerts for irregular patterns | Wellness |
| **Fitbit / Google** | Basic logging and predictions; Flo data sync planned for 2027 | Wellness |
| **Garmin** | Logging, pregnancy tracking, menopause symptom logging; skin temperature on some watches | Wellness |
| **Samsung Health** | Logging + skin temperature using a Natural Cycles-derived algorithm | Cleared in Korea; "registered" in the US |
| **Ultrahuman** | Ring; temperature-based ovulation patterns (Pro) | Wellness |
| **Stardust, Ovia, Glow** | Logging apps with forecasts, social or employer features | Wellness |
| **Tempdrop** | Armband for overnight basal temperature | "Registered", not cleared |
| **Mira, Inito, Proov, Kegg** | At-home hormone tests or a vaginal sensor | Proov is FDA-cleared to help confirm ovulation |
| **Balance** | Menopause symptom tracking and education | Wellness |

## 2. Scorecard (1 = weak or absent, 5 = strong)
| Area | Flo | Oura | WHOOP | Natural Cycles | Apple | Clue | **Shred by QK (prototype)** |
|---|---|---|---|---|---|---|---|
| Next-period estimate from logged dates | 4 | 4 | 3 | 4 | 4 | 4 | **4.** Median of her last 6 cycles; tested walk-forward on 159 real women (Marquette): 2.2 days average error. The range covered the real start 83.5% of the time on held-out women. One dataset, dates only. |
| Honest range and "not enough data" states | 2 | 3 | 2 | 3 | 3 | 3 | **5.** Calibrated range with its coverage stated; no date before one cycle; no range when cycles vary too much; overdue shown, never rolled forward. |
| Uses wearable signals | 1 (2027 via Google) | 5 | 5 | 5 | 4 | 2 | **1.** Band estimate built, tested on synthetic data, **off**. No real band connected. |
| Ovulation / fertile window | 3 (calendar) | 4 (after the fact) | 2 | 5 | 4 (after the fact) | 3 | **1, by design.** Not offered. |
| Contraception | 1 | 3 (via NC) | 3 (via NC) | 5 | 1 | 2 (unclear) | **1, by design.** Not offered. |
| Life stages | 4 | 4 | 4 | 5 | 3 | 4 | **4.** First period to menopause: regular cycles, pregnancy (due date, weekly check-ins, warning signs), postpartum (recovery, mood, periods returning), perimenopause/menopause (STRAW+10 descriptions, MRS-based symptoms). All prototypes, wording awaiting clinician review. No teen-specific mode yet. |
| Logging accuracy help (check-ins, real start day, missed logs) | 3 | 2 | 2 | 3 | 3 (irregularity alerts) | 3 | **5.** Asks for the real start day; gentle late check-ins; asks about a forgotten period; shows when an unusual gap is left out. |
| Personal coaching / adjusting her plan | 3 (AI assistant) | 4 (AI Advisor) | 5 (phase-based strain and sleep) | 2 | 1 | 2 | **3.** Zara check-ins; comfort suggestions that learn what helps her; training-feel logging; camera form coaching and rehab. **No phase-based training rules** (the evidence is weak); no AI chatbot. |
| Learns what helps *her* | 1 | 1 | 1 | 1 | 1 | 1 | **4.** "Did it help?" after comfort suggestions; her own answers reorder the list. Unvalidated. |
| Privacy | 2 (FTC 2021; $59.5M settlements; 2025 Meta verdict) | 3 | 3 | 4 | 5 (end-to-end encrypted) | 4 (GDPR) | **5.** Encrypted on the phone; no account, upload, ads, analytics or sharing; nothing sensitive in notifications by default. |
| Published evidence | 2 (no peer-reviewed model study) | 4 (company-authored) | 1 (none found) | 5 (FDA review) | 4 (company-funded) | 3 | **2.** Our own real-data test on one public dataset, plus synthetic stress tests. No prospective study. |
| Cost | 4 (free + $40–60/yr) | 2 ($349–399 + $70/yr) | 2 ($199–239/yr) | 2 ($150–195/yr) | 4 (free with iPhone) | 4 | **5.** Works without any hardware. |
| Scale and real-world use | 5 | 5 | 5 | 5 | 5 | 5 | **0.** Not launched. |

## 3. Where we are ahead
1. **Honesty about uncertainty.** Competitors give a date, often with no range. We give a range and say how often a range like that held in real data. We refuse to estimate when the data can't support it.
2. **Logging quality.** Real-start-day check-ins, missed-period questions, and the long-gap notice address the main real-world error source we measured (late logging raised error from 2.21 to 2.99 days). We found no competitor that asks about a likely forgotten period. Apple's irregularity alerts are the closest.
3. **Privacy.** Flo's history (FTC order, settlements, the 2025 verdict against Meta over Flo users' data) and Stardust's disputed encryption claims show what goes wrong. Our design never uploads cycle data.
4. **Learning what helps her.** No competitor was found to ask "did it help?" and adapt to her answers.
5. **The fitness link.** Camera form coaching, rehab and workouts in the same app, without making up cycle-phase training rules.

## 4. Where they are ahead, and what it would take
| Gap | Who leads | What it would take for us |
|---|---|---|
| Wearable temperature and heart signals | Oura, WHOOP, Apple, Natural Cycles | A real band with data access (DS07/Hume SDK), then real-data testing of the band estimate (mcPHASES once PhysioNet approves). |
| Ovulation confirmation and contraception | Natural Cycles (FDA) | Out of scope by decision. It would need a clinical trial and regulatory clearance. |
| Phase-based training coaching | WHOOP | Evidence is weak; we log her own training feel instead. Could offer "your own pattern" insights once she has several cycles of data. |
| AI assistant | Flo, Oura, Google | Would need a safe, reviewed design. No sensitive data in AI prompts by default (your rule). Not started. |
| Partner sharing | Flo, Stardust | Needs separate explicit consent and an integration (your rule). Not started. |
| Teen mode | None found with a dedicated mode | Open decision: age range and teen consent. |
| Published, independent evidence | Nobody has much | A prospective study (`research/docs/evaluation-plan.md`). |
| Scale | Everyone | Launch, after the privacy and clinical reviews. |

## 5. What the independent evidence says about the whole category
- **Calendar-only predictions are weak for ovulation:** no better than about 21% for the exact day (Johnson 2018; its authors work for Clearblue's maker). Only 4 of 53 sites and apps gave the correct fertile window even for a textbook 28-day cycle (Setton 2016, independent). Apps disagreed with each other for anything but the most regular cycles (Worsfold 2021).
- **Temperature and hormone methods report smaller errors,** but almost all figures are company-authored or company-funded, and most use LH tests, not ultrasound, as the reference.
- **Temperature mostly confirms ovulation after it happened.** It does not predict it in advance.
- **For us:** this supports our decisions not to predict ovulation or fertile days from dates, and not to make accuracy claims beyond what our own data shows.

## 6. Suggested next steps (for the product owner to decide)
1. **Teen mode:** the biggest life-stage gap, and nobody owns it. Needs your decision on the age range and consent.
2. **"Your own pattern" training insights:** compare her logged training feel across her own cycles, with no general rules. This builds on what exists and keeps the accountability idea.
3. **Real band data:** keep pushing the DS07/Hume SDK and PhysioNet. Without real data, the wearable gap stays.
4. **A clinician review** of all prototype wording (pregnancy, postpartum, midlife, comfort, Zara). It's needed before any real user.
5. **Not recommended:** contraception or fertile-window predictions from dates; the evidence above shows why.
