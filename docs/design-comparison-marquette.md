# Alternative period-estimate designs compared on real data (Marquette)

**Real, anonymised cycle lengths (Fehring 2012). A comparison of software designs on one population; not clinical
validation; dates only (no band data).**

- 159 participants (4 sequences stopped at a gap or repeated cycle number). Split by ID hash:
  development 44 participants / 441 predictions (tuning only), test 100 participants / 1032 predictions (scoring only).
- The current app (D0 date + R_app range, settings z 1.2, population spread 2.94) was checked against the app's own code on every point: identical. The app gave no date on 5 test points (cycles too variable); those are left out for every design.
- Settings tuned on development only: D4 recency weight = 0.9; D5 strength = 2 (population mean 29.31 days from development); R1 multiplier = 1.20 (80% coverage on development; population within-person SD 2.94 days).

## Point estimate: average error in days on the TEST group (lower is better)
| Design | 1 past cycle | 2 | 3–5 | 6+ | All | Within ±2 days (all) | Difference vs current, 95% interval | Verdict |
|---|---|---|---|---|---|---|---|---|
| D0_current_median_last6 | 2.76 | 2.18 | 2.30 | 1.98 | 2.15 | 71.3% | – | reference |
| D1_mean_last6 | 2.76 | 2.18 | 2.27 | 1.99 | 2.15 | 70.4% | -0.04 to 0.04 | no clear difference |
| D2_median_last3 | 2.76 | 2.18 | 2.39 | 2.17 | 2.28 | 69.3% | 0.07 to 0.18 | worse |
| D3_median_all_history | 2.76 | 2.18 | 2.30 | 1.98 | 2.15 | 70.5% | -0.04 to 0.05 | no clear difference |
| D4_recency_weighted | 2.76 | 2.20 | 2.23 | 1.98 | 2.13 | 70.9% | -0.06 to 0.02 | no clear difference |
| D5_shrink_to_population | 2.48 | 2.11 | 2.29 | 1.98 | 2.11 | 70.6% | -0.11 to 0.03 | no clear difference |

## Range shown to her: coverage / average width on the TEST group
| Design | 1 past cycle | 2 | 3–5 | 6+ | All |
|---|---|---|---|---|---|
| R0_previous_app_shortest_to_longest | 20.0% / 1.00 d | 53.4% / 3.68 d | 64.3% / 5.81 d | 80.8% / 6.68 d | 68.7% / 5.67 d |
| R_app_calibrated_fixed | 80.0% / 9.00 d | 85.2% / 7.84 d | 82.4% / 7.60 d | 84.3% / 7.10 d | 83.5% / 7.46 d |
| R1_calibrated_80 | 80.0% / 9.00 d | 85.2% / 7.84 d | 82.4% / 7.60 d | 84.3% / 7.10 d | 83.5% / 7.46 d |

## Designs
- **D0 (current app):** median of her last 6 cycles.
- **D1:** mean of her last 6.
- **D2:** median of her last 3.
- **D3:** median of her whole history.
- **D4:** recency-weighted mean of her last 6; the most recent cycle counts most.
- **D5:** her median pulled towards the population average when she has few cycles. **This uses a population number, which the app deliberately does not do today.** Adopting it would be a product decision.
- **R0 (previous app, before dates-only-2.0.0):** shortest to longest of her last 6 cycles.
- **R_app (current app):** the calibrated range with the settings fixed in the app (z 1.2, population spread 2.94 days, worth 3 cycles).
- **R1:** a range around her median whose width comes from her own spread, steadied by the population's spread when she has few cycles, set for about 80% coverage. It also uses a population number.

## What this shows (plain language)
**1. The current way of picking the date is as good as the alternatives.**
- On the 100 women held back for scoring, the current design was off by **2.15 days** on average.
- No alternative was clearly better. Every difference was within the margin of error, apart from "last 3 cycles only", which was **worse**.
- Pulling early estimates towards the population average (D5) helped a little in the first cycle: 2.48 vs 2.76 days. That gain was small and not clearly beyond chance. It would also mean using a population number, which the app deliberately avoids today.

**2. The range shown to her can be made much more honest.**
- **Today's range** ("shortest to longest of her cycles") caught the real start only **20%** of the time after 1 cycle, and **69%** overall.
- **The calibrated range (R1)** caught it **80–85%** of the time at every stage. That is close to the 80% target it was set for, and it held on women it had never seen.
- **The cost is width:**
  - after 1 cycle, a 9-day range instead of a single day;
  - overall, about 7.5 days instead of 5.7.
- R1 also uses a population number, the typical cycle-to-cycle spread of 2.9 days, measured on the development group only.

## Decision (2026-11-26)
The product owner chose the calibrated range. It is now in the app (`dates-only-2.0.0`), with the settings shown above as R_app; it gives the same results as R1. The recommendations below are kept as they were made.

### Recommendation as made
- **Keep the current date estimate.** Nothing beat it clearly on real data.
- **Consider switching the shown range to the calibrated version (R1),** especially for the first cycles. This turns the range into a real "about 8 in 10 periods start inside this window" instead of a narrow window that is right only 1 time in 5 at first.
- **Doing it needs two decisions:**
  - allowing one population figure (cycle spread) into the app;
  - re-checking the wording, so the range is described as "about 8 in 10" only after confirming it on a second dataset.
- **Re-run this comparison on mcPHASES** (real temperature data) before deciding anything about the band.

## Limits
- **One population:** a 2012 US natural-family-planning study, with fairly regular cycles of 18–54 days.
- **Small groups:** 100 test participants.
- **Ideal logging:** every period is assumed logged on the right day.
- **Dates only.**

## Reproduce

```bash
node tools/compare-designs.mjs "<path to FedCycleData071012 (2).csv>"
```

The raw data is not stored in this repository.
