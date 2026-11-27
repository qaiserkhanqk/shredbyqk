# Competitor comparison and the gaps we built (Hume Band, WHOOP, Oura)

> **Superseded on 2026-11-27** by `docs/competitor-comparison-2026-11-27.md` (16 products). Kept for the record of the gaps built on 2026-11-25.

**Date:** 2026-11-25.

**Sources:**
- web search: the companies' own pages, reviews, news;
- PubMed;
- links are in the chat report of the same date.

**Caveats:**
- Most competitor claims are the companies' own and were not verified.
- The ratings below are an engineering judgement against those public descriptions, not a test of their products.

## Scorecard (1 = weak or absent, 5 = strong)
| Area | Oura | WHOOP | Hume Band | **Ours (prototype)** | Why ours scores that |
|---|---|---|---|---|---|
| Cycle tracking and period prediction | 5 | 4 | 1 (none) | **3** | It works, with honest ranges from her own cycles. It is not validated and has no users. |
| Uses wearable data for the cycle | 5 | 4 | 1 (sensor, no cycle software) | **1** | No real band connected (DS07 and Hume are placeholders); demo data only. |
| Published evidence | 4 | 3 | 1 | **1** | Synthetic tests only. |
| Regulated birth control | 3 (through Natural Cycles) | 1 | 1 | **1 (by design)** | Deliberately not offered. |
| Life stages (pregnancy, perimenopause, menopause, hormonal birth control) | 5 | 3 | 1 | **2** | Situations pause or caveat estimates. There is no perimenopause mode. |
| Link to training | 3 | 5 | 2 | **4** | Camera form coaching, rehab and workouts. Training feel can now be logged as a personal pattern. No wearable recovery score. |
| Learns what helps *her* (suggest, ask, adapt) | 1 (not found) | 1 (not found) | 1 | **4 (new, prototype)** | Built in this round; unvalidated, wording awaiting clinician review. |
| Honesty about uncertainty and missing data | 3 | 3 | 2 | **5** | "Not enough data" states, no filled-in nights, and now a learning stage and band-gap messages. |
| Privacy | 2 (cloud; 2025 trust backlash) | 2 (cloud) | 2–3 (unclear) | **5** | Encrypted on the phone; no account, upload, ads or sharing. |
| Cost to the user | 2 ($349 + $70/yr) | 2 ($199–359/yr) | 4 (about $249 one-off) | **5** | The app works without a band. |
| Scale and real-world use | 5 | 5 | 3 | **0** | Not launched. |

**Reading the scorecard:**
- **The competitors are ahead** on everything that needs hardware, data, evidence or approval.
- **We are ahead** on privacy, honesty, cost and the fitness link.
- **One gap none of them was found to fill:** learning what helps her in particular.

## Gaps found, and what was built (all behind flags or opt-ins, off by default)
| Gap in the competitors | What we built | Where |
|---|---|---|
| Evidence that tracking or "cycle syncing" helps is weak and individual (BMJ analysis, 2026). Results differ between people (the clinician's point). | **Comfort suggestions that learn what helps her.** After she logs moderate or severe pain: heat, gentle movement or a warm drink, each with its published evidence. Then "did it help?" (yes, a little, no). Options are ordered by her own answers, with denominators. | `js/cycle/comfort.js`, flag `comfortSuggestions` |
| Advice can be unsafe or over-claimed | Warning signs always shown, first when pain is severe. Never medicines, supplements, doses, diets, calories or weight. Marked **awaiting clinician review**. Comfort records are deleted with pain data, or on their own. | same |
| Calibration periods are hidden or vague (WHOOP: about one cycle) | **Learning stage:** "Learning your cycle: 1 of 3 cycles". It uses the estimate's own 3-cycle minimum and keeps updating. | `js/cycle/learning.js` |
| Forgetting the band, or a flat battery | **Band-gap honesty:** nights recorded this cycle, against what the temperature research needs (6 + 3), and "your band didn't record last night". Nothing is filled in, and the period estimate doesn't depend on the band. | same |
| Temperature misled by a cold room, alcohol or a late night (the clinician's point) | **Night disruptors:** optional ticks for alcohol, a late night, or a very hot or cold room. The temperature research rule leaves those nights out (version 0.4.0). | `js/cycle/model.js`, `tempshift.js`, `nudges.js` |
| Training advice by cycle phase lacks evidence | **Training feel** category (easier, usual, harder), so her own pattern can show. No phase-based training rules. | `model.CATEGORIES.training` |
| Hume has a temperature sensor but no cycle software | **Hume Band placeholder** in the app and the research prototype. It refuses to connect until data access exists and passes the acceptance test. | `js/cycle/wearables.js`, `research/lib/adapters.js` |

**Tests:**
- `tests/cycle-missing-links.test.mjs` (53 checks) and `tests/cycle-ui-missing-links.cjs` (19 checks). They were written first; the failing runs are in `docs/test-logs/`.
- The phone-layout test now includes the comfort card.

## Not built (needs something we don't have)
| Item | Blocked by |
|---|---|
| A real band connection (DS07 or Hume) | The supplier's SDK, data access and documentation |
| A perimenopause mode | Clinician-written symptoms and wording |
| Pregnancy features, and birth control | Clinical evidence and regulatory approval (birth control is deliberately out of scope) |
| Accuracy claims of any kind | A prospective study (`research/docs/evaluation-plan.md`) |
