# Doctor summary and optional ovulation-test (LH) logging

Two additions suggested by the Natural Cycles comparison (`docs/comparison-natural-cycles.md`). Both add **no medical claims**. Cycle tracking stays off by default, and LH logging sits behind its own research flag, also off by default. Synthetic data only. Nothing deployed.

## Method
- **Tests first.** Tests were written before any code and run on unchanged `4107959`: **26 Node checks and 2 browser checks failed**. They were committed with their logs in `b405ac1` (`docs/test-logs/*-BEFORE-implementation.log`).
- **One check changed after that run** (stated openly). Browser check L4 originally failed on the existing sentence "no assumed ovulation day", a negation in the estimate's method note that was there before any LH entry. It now compares fertility and ovulation wording **before and after** a positive result is saved, and still forbids "fertile", "safe day", "ovulated" and "ovulating" anywhere.

## 1. Summary for a doctor (`js/cycle/summary.js`)
| What it includes | What it leaves out |
|---|---|
| Periods in the chosen window (3, 6, 12 or 24 months). An open period shows "end not logged yet"; **no end date is invented**. | Next-period estimate and range dates |
| Cycle lengths. Cycles flagged for checking are listed with their reason and kept out of the figures (shortest, longest, count). | Pattern findings and forecasts |
| Spotting days | Wearable and temperature data |
| Counts per value for symptom categories **currently switched on** (a category switched off is not summarised) | Anything about fertility, ovulation timing or contraception |
| Situations marked, with the date marked | |
| LH results, **only while LH logging is on**, listed as recorded and labelled "not interpreted" | |

The text says it was made on request from the person's own entries, is not a diagnosis, contains no predictions, has not been clinically reviewed, and that days without an entry are unknown, not "none".

**How it's handled:**
- It is built on each view and never stored.
- Print uses print-only styles that show only the summary.
- "Save as text file" creates a local download. Nothing is sent anywhere; the browser test confirms no off-site request is made when the summary is created.
- The on-screen note says a printed or saved copy is not encrypted.

## 2. Ovulation-test (LH) results (research flag `lhTests`, off)
**How it's stored:**
- `M.LH_RESULTS`: positive, negative or invalid/unclear. Saved as a day field `lh` with source, entry time and correction history, like other day fields.
- It needs a separate consent scope, `lhTests`. Logging without it fails with `LH_OFF`. Turning it off deletes every result and its history, and the consent record notes the change.
- Export includes it, and delete-all removes it.

**It is deliberately not a symptom category**, so pattern, suggestion and forecast code never scan it. The tests show:
- the estimate, phase output and pattern findings are **identical** with or without many positive results;
- no page wording about fertility or ovulation appears after a positive result.

**Why it exists:** to collect the kind of reference data the validation plan needs. LH tests are an imperfect reference, not an exact ovulation time. The app does not turn them into fertile days or an ovulation day.

## Results (2026-11-18)
| Command | Result |
|---|---|
| `node tests/cycle-summary-lh.test.mjs` | before: 26 FAILED; after: **45 ok, ALL PASS** |
| `node tests/cycle-ui-summary-lh.cjs` (headless Chromium) | before: 2 FAILED; after: **17 ok, ALL PASS** |
| `npm test` (16 suites) | **exit 0** |
| `npm run test:e2e` (3 browser suites) | **exit 0, 86 ok** |

**Also changed:**
- `tests/cycle.test.mjs`: the flag count went from 7 to 8.
- `sw.js`: the cache went to `shred-qk-v7` and now includes `summary.js`.

**Not done:** clinician review of the summary's wording and layout; testing in Safari, Firefox and on real phones.
