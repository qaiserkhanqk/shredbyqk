# Dates-only estimate on real cycle lengths (Marquette, Fehring 2012)

**This is a test of software behaviour on real, anonymised cycle-length data. It is not a clinical validation, it says
nothing about any band feature (this data has no temperature), and it may not apply to other groups of women.**

- Data: 159 participants, 1637 cycles used (4 participants' sequences stopped at a gap or repeated cycle number).
- Algorithm: `dates-only-2.0.0` (app code, unchanged). Walk-forward: only her past cycles are used at each point.
- Error = real start − the estimate's typical date (median of her recent cycles), in days.
- "Shown range" = the shortest to longest of her recent cycles, as the app displays it. It is not a confidence interval.
- Baselines for comparison only: a fixed 28-day guess (the app never uses one) and "same length as her last cycle".

## Estimate made the day after her period started
(The dates-only estimate does not change during the cycle, so this is also what she sees later in the cycle.)

| History | Cycles | Gave a date | Average error (days) | Within ±1 / ±2 / ±3 days | Real start inside the shown range | Median range width (days) | Fixed 28-day guess: average error | "Same as last cycle": average error |
|---|---|---|---|---|---|---|---|---|
| 1 past cycle | 144 | 100.0% | 2.76 | 39.6% / 60.4% / 68.8% | 79.2% | 9 | 2.99 | 2.76 |
| 2 past cycles | 131 | 100.0% | 2.29 | 47.3% / 69.5% / 81.7% | 84.7% | 7 | 2.97 | 2.78 |
| 3–5 past cycles | 352 | 100.0% | 2.33 | 45.7% / 67.9% / 79.0% | 81.8% | 7 | 2.97 | 2.84 |
| 6+ past cycles | 851 | 99.4% | 2.04 | 53.9% / 72.1% / 81.3% | 83.1% | 7 | 2.72 | 2.78 |
| All with ≥1 past cycle | 1478 | 99.7% | 2.20 | 50.0% / 69.7% / 79.6% | 82.6% | 7 | 2.83 | 2.79 |

With no completed cycle yet (159 cycles): a date was given 0 times (should be 0).
Statuses: none 159, early 275, estimate 1037, variable 161, too_variable 5.

## Checks on the app's behaviour
All passed on every cycle: no range with its start after its end; no date before she has a completed cycle; only her own cycle lengths used; the learning stage counted exactly her completed cycles.

## What this means (plain language)
- **The logic behaves correctly on real data.** All behaviour checks passed on all 1,637 cycles:
  - it never gave a date before a woman had at least one completed cycle;
  - it only ever used her own cycle lengths;
  - the learning stage counted her completed cycles exactly.
- **The date:** on average **2.2 days** from the real start, and **2.0 days** with 6 or more past cycles. That beats two simple guesses:
  - a fixed 28-day guess: 2.83 days average error;
  - "same as last cycle": 2.79 days.
- **The range** (calibrated, since `dates-only-2.0.0`) held the real start about **8 in 10** times at every stage, including after a single cycle (79%). Before, the range caught the real start only 19% of the time after one cycle. Its typical width is 7–9 days.
  - These whole-dataset figures include the 44 women whose data set the range, so they are slightly flattering.
  - The honest figure is the held-out test group in `docs/design-comparison-marquette.md`: **83.5%**.
- **It rarely refused:** "too variable" occurred 5 times out of 1,478.

## Limits
- **One population:** women in a US natural-family-planning study around 2012. Their cycles may be more regular than the app's intended users, who range from teenagers to perimenopause and include people after a pregnancy.
- **Dates only:** no band or temperature feature was tested. That needs a dataset with wrist temperature, such as PhysioNet mcPHASES, which needs credentialed access.
- **Simulated logging:** the starts were laid end to end from the recorded lengths, as if she logged every period on the right day. Real logging has late and missed entries.
- **What these figures are:**
  - real-data software behaviour, not a clinical validation or an accuracy claim for the product;
  - not comparable one-to-one with the synthetic evaluation (`docs/cycle-eval-synthetic.md`).

## Data handling
- **Source:** Fehring RJ, *Menstrual Cycle Data*, Marquette University (2012), https://epublications.marquette.edu/data_nfp/7.
  - The page says participants agreed to data reuse in their consent form.
  - No open licence is stated, so the raw data is **not** stored in this repository or in review packages.
- **What was read:** only the anonymous participant code, the cycle number and the cycle length. All other columns, which include sensitive personal details, were ignored.
- **What is kept:** this report contains aggregate figures only.
- **To reproduce:**

  ```bash
  node tools/real-data-eval.mjs <path to FedCycleData071012 (2).csv>
  ```
