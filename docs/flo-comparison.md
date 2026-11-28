# Flo (Flo Health): research, and how we can be better

**Date:** 2026-11-25.

**Sources:**
- web search: company pages, app store, reviews, legal news, trial registry;
- PubMed: Flo-affiliated research.

**Caveats:**
- Company and blog figures are unverified unless a paper or registry is cited.
- Prices and features change often.

## What Flo is
**Scale:** Flo's About page says 420 million downloads and 77 million monthly active users. Wikipedia: 380M+ downloads, 70M+ monthly users (Nov 2024). It is roughly **10 times** the "7 million" figure.

**Free features** (per reviews and app-store listings):
- period and ovulation predictions;
- calendar;
- symptom tracking and reminders;
- "Secret Chats" (community);
- Anonymous Mode;
- basic pregnancy week tracking.

**Premium features** (about $59.99 a year in the US; varies by region):
- cycle patterns and trends;
- the "Health Assistant" chat;
- an expert content library;
- a doctor's report;
- a symptom checker;
- in-depth pregnancy and fertility features;
- a Perimenopause Score.

**Also:**
- **Flo for Partners** (2023): data sharing with a partner.
- **Birth control:** **not** FDA-cleared. Flo is sponsoring the **FOCUS trial** of a "Flo Digital Contraceptive" (ClinicalTrials.gov NCT07630064; start April 2026, estimated completion January 2028).

**Algorithms (company or contractor claims):**
- A contractor case study says a neural network cut error for irregular-cycle predictions from 5.6 to 2.6 days.
- Engineering case studies describe a "cycle prediction model" and a "mode switch prediction model" on a shared machine-learning feature platform.
- **No independent validation found.**

**Research** (PubMed; Flo-affiliated, often with university co-authors):
| Study | Finding |
|---|---|
| Cycle patterns in **19 million** users aged 18–55 (Sci Rep 2024) [DOI](https://doi.org/10.1038/s41598-024-60373-3) | Cycles get shorter and then, around 40–44, longer and more variable. Irregular cycles were most common at 51–55 (44.7%). |
| Premenstrual symptoms in 238,114 users (Arch Womens Ment Health 2022) [DOI](https://doi.org/10.1007/s00737-022-01261-5) | Cravings 85%, mood swings or anxiety 64%, fatigue 57%. 29% said symptoms interfere with daily life every cycle. |
| Perimenopause and social determinants of health, with the Mayo Clinic (Climacteric 2026) [DOI](https://doi.org/10.1080/13697137.2026.2682228) | 12,382 women completed the **Menopause Rating Scale**. Healthcare access and income were most strongly associated with symptom burden. |
| Exercise across the cycle, 5,703 users (Women's Health 2026) [DOI](https://doi.org/10.1177/17455057261473456) | Phase effects on steps and energy were "small" with "minimal clinical or practical relevance". |
| Self-reported knowledge gains, 2,212 users (JMIR mHealth 2023) [DOI](https://doi.org/10.2196/40427) | 89% reported better cycle knowledge; stronger in premium and long-term users. |
| PCOS symptoms through an in-app chatbot (RB&E 2021) [DOI](https://doi.org/10.1186/s12958-021-00719-y) | Large self-reported dataset; bloating was the top symptom reported by women with PCOS. |

## Where Flo is weak
1. **Privacy history.**
   - 2021 FTC settlement over sharing health data with analytics companies, including Facebook (no admission of wrongdoing).
   - In 2025 Flo settled a class action the day before the verdict (reported as $8M), and a jury found **Meta** liable for intercepting Flo users' reproductive-health data (August 2025).
   - Data lives in Flo's cloud.
2. **Paywall and billing complaints:** one review roundup lists paywall, renewal and cancellation problems among the top complaints.
3. **Prediction complaints**, and no independent validation; ovulation timing from calendar data alone is known to be limited.
4. **An AI "Health Assistant"** that answers health questions: a safety and liability risk.
5. **One-size content.** Even Flo's own exercise study shows phase effects are small, which argues for personal learning, not generic advice.

## How our app can be better (and what's already built)
| Our advantage | Status |
|---|---|
| **Private by architecture:** encrypted on the phone; no account, upload, ads or third-party trackers | Built |
| **Honest predictions:** her own ranges, "not enough data" and "too variable" states, and a learning stage | Built |
| **Learns what helps *her*:** comfort suggestions with "did it help?" | Built (prototype, awaiting clinician review) |
| **A caring companion:** check-ins from Zara (she can rename her) on her period days. Her answers stay on her phone. It asks, never guesses, and shows at most one message a day. | Built (prototype, awaiting clinician review) |
| **Perimenopause mode from published criteria:** STRAW+10, with sources shown to her | Built (prototype, awaiting clinician review) |
| **Fitness built in:** camera form coaching, rehab, training-feel patterns. Pregnancy and postpartum workouts would be a real differentiator. | App exists; pregnancy and postpartum next |
| **Fair pricing:** core tracking free, simple pricing, easy cancellation | A business decision |
| **Personal, band-adjusted estimate:** re-centred on her own temperature rise and her own past rise-to-period gaps | Built behind a research switch (off); synthetic evidence only |
| **Wearable temperature (SWL DS07 or Hume)** | Waiting for the supplier's software kit |

## Where Flo will stay ahead for now
- **Scale and data:** 19M+ users in their studies.
- **Content and community.**
- **A research team** with university and Mayo Clinic partners.
- **Partner sharing.**
- **A birth-control trial already running.**

None of these can be matched by software alone. They need users, consented data, clinicians and studies.

## Not to copy
- an AI chatbot giving health answers;
- third-party analytics SDKs;
- aggressive paywalls;
- open community chat (moderation and safety, especially for teenagers).
