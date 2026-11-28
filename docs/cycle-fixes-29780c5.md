# Fixes for issues independently reproduced in snapshot 29780c5

## Method
- **Failing tests first.** Regression tests were written before any fix and run on unchanged 29780c5, then committed with their log (`d447810`, `docs/test-logs/cycle-regressions-on-29780c5-BEFORE-fix.log`). **16 Node checks and 1 browser check failed**, covering all 5 issues.
  - Issues 1–4: `tests/cycle-regressions-29780c5.test.mjs`.
  - Issue 5: browser test `tests/cycle-ui-regressions.cjs`.
- **Constraints kept.** Cycle tracking and every research or experimental feature stay **off by default**. Synthetic data only. Nothing deployed. No physiological threshold was invented.
- **No validation claimed.** No clinical or device validation is claimed. Wearable integration (SWL DS07) and clinical validation remain **incomplete**.

Line numbers refer to the files after the fix.

## Issues

| # | Failing test on 29780c5 (actual output) | Fix | Changed lines | Result |
|---|---|---|---|---|
| 1 | 3 raw samples at 33 °C + 3 vendor-derived at 37 °C → one `ok` night of **35 °C labelled "raw"**; unknown `kind` became `raw`; two models with the same device ID were pooled | The measurement kind must be exactly `raw` or `vendor_derived`; otherwise `kind: 'unknown'`, flagged `kind_unknown`, never used. Nights are grouped by **sleep session × device × model × firmware × metric × kind**, so incompatible subsets are never combined, and neither insufficient half is accepted. Segments and device-change flags use the same identity. | `js/cycle/wearables.js` 43–44, 103–106, 135–160, 183–184, 205–210 | **Pass** (mixed kinds → two `insufficient_wear` summaries; unknown kinds unusable; two models not pooled; six compatible samples still form a night) |
| 2 | Six samples 14:00–17:00 local → a valid "overnight" summary; naps and unlabelled night samples summarised too | An **overnight extraction contract**: a night summary is built only from readings the source attributes to a **verified main-sleep session** (`sleepSessionId` + `sleepMain: true`). There is **no built-in sleep window**. Readings without sleep information are quarantined (`no_sleep_context`), and naps are not used (`not_main_sleep`). The session label is the local date of its first reading minus 12 h, a filing convention and not a window. The mock device labels its synthetic nights as sessions; a real SDK must provide and verify these (`docs/wearable-sdk-requirements.md`). | `wearables.js` 15–27, 103–104, 114–116, 126–131, 272–274 | **Pass**: daytime-only abstains; night-time without sleep info abstains; mixed batch uses only the sleep session; a **shift worker's** daytime main sleep is used; a nap is not |
| 3 | `tzOffsetMin` NaN or ±Infinity → `RangeError: Invalid time value` (the whole batch crashed); 100000 minutes → a November reading filed under **10 Jan 2027** | `validTzOffset`: a whole number of minutes, a multiple of 15, within UTC−12:00…UTC+14:00 (the range of real civil time zones; not a physiological threshold). Anything else is flagged `tz_invalid`, kept only as `originalTz`, and never used to compute a date. Each packet is processed inside its own try/catch, so malformed packets are counted (`stats.malformed`) and the rest of the batch continues. Readings that can't be placed are quarantined **before** grouping and reported by reason (`summariseNights(...).quarantined`). | `wearables.js` 34–42, 69, 100–108, 114–116, 126–131, 135–143, 160 | **Pass**: NaN, ±Infinity, 100000, 7, "60", −721 and 841 are all quarantined as `tz_invalid`; −720, +840 and +345 are accepted; null, string and throwing packets don't crash the batch |
| 4 | A 2 March historical forecast changed from **"early" to "paused"** after pregnancy was marked in April | Situations are **versioned**: `setSituation` logs every change (`situationLog`), and `stateAsOf` rebuilds the situations known at that time. The **current** view applies a change at once, so pregnancy pauses estimates now. Unticking is a later change, so history keeps the earlier state. `eraseSituation` ("Delete (entered by mistake)") removes the situation and its whole history. Delete-all (consent withdrawal) removes everything. | `js/cycle/model.js` 44, 98–118, 303–308; `js/cycle/ui.js` 250–251, 306, 346 | **Pass**, tested separately: later change, current safety (paused now), "no longer" doesn't rewrite history, deletion as a mistake, consent withdrawal |
| 5 | With only cycle tracking on, the browser showed "You logged lower energy around…" (pattern card and insight), although `symptomForecast` was off | A separate research flag, **`patternInsights`**, default **off**. Pattern findings and the "around now" insight render only when it's on; the card is then labelled "research, unvalidated", with a note on the synthetic false-pattern rate. | `js/cycle/flags.js` 8; `ui.js` 89–90, 212–213, 260 | **Pass** (browser): hidden with the flag off; shown and labelled with it on |

## Tests changed on purpose
- **Older tests' synthetic packets** (in `cycle.test.mjs`, `cycle-regressions.test.mjs` and `cycle-regressions-80ea40f.test.mjs`) now include a synthetic verified sleep session. Without one, those packets are now quarantined, so some older tests would have **passed for the wrong reason**. For example, "tEnd = Infinity → never ok" would pass because there was no sleep session, not because of the timestamp check. With sessions, each test again exercises the property it was written for.
- **80ea40f "audit 3.3":** a reading with no offset is now quarantined before grouping instead of being grouped and rejected. The test checks `quarantined.tz_unknown`.
- **`cycle.test.mjs`:** the flag count went from 6 to 7.
- **`tests/e2e.cjs`:** the symptom step now checks that patterns are hidden by default, then turns the research flag on and checks the labelled card.
- **Tightened after the failing run** (stated openly):
  - The issue-5 browser control originally passed on 29780c5 only because the word "research" appeared elsewhere on the page. It now checks inside the pattern card.
  - The issue-3 reason check now covers every invalid offset, the real edge offsets and malformed packets.

## Investigation: the synthetic false-pattern rate (issue 5)
`npm run sim:patterns` (`tools/pattern-null-sim.mjs`) simulates 200 people per row who have **no real pattern**: each logged day is "notable" with the same probability on every cycle day. Every finding is therefore false by construction.

| Complete cycles | Days logged | "Notable" rate | People with ≥ 1 false pattern (all windows scanned) | False patterns per person | False pattern in ONE pre-chosen window |
|---|---|---|---|---|---|
| 3 | 30% | 10% | 1.5% | 0.01 | 0% |
| 3 | 30% | 15% | 6% | 0.07 | 1% |
| 3 | 30% | 25% | 12% | 0.14 | 0.5% |
| 3 | 60% | 10% | 8% | 0.08 | 1% |
| 3 | 60% | 15% | 19% | 0.22 | 1.5% |
| 3 | 60% | 25% | 68% | 1.01 | 4.5% |
| 3 | 90% | 10% | 22% | 0.24 | 0.5% |
| 3 | 90% | 15% | 55% | 0.74 | 4.5% |
| 3 | 90% | 25% | 91.5% | 2 | 17% |
| 6 | 30% | 10% | 7.5% | 0.07 | 0% |
| 6 | 30% | 15% | 23% | 0.25 | 0.5% |
| 6 | 30% | 25% | 63% | 0.96 | 5.5% |
| 6 | 60% | 10% | 10.5% | 0.11 | 0% |
| 6 | 60% | 15% | 26.5% | 0.31 | 1.5% |
| 6 | 60% | 25% | 78.5% | 1.35 | 6.5% |
| 6 | 90% | 10% | 12% | 0.13 | 0% |
| 6 | 90% | 15% | 38% | 0.44 | 1.5% |
| 6 | 90% | 25% | 94.5% | 2.13 | 14.5% |

**What it shows (about the rule on synthetic data, not about real people):**
- **The earlier "27%" was one point on a wide curve.** It matches the row with 6 cycles, 60% of days logged and a 15% notable rate (26.5%). Across these rows the rate ranges from **1.5% to 94.5%**.
- **The rate is driven mostly by how common the "notable" value is, and by how much is logged.**
  - A 3-day window catches a common value by chance in most cycles: with a 25% rate and daily logs, about 58% per cycle.
  - The "< 50% at other times" check doesn't block this, because the base rate is under 50%.
- **Scanning about 35 windows per category multiplies the problem.** With one window chosen in advance the rate is 0–17%: still non-zero, and high when the value is common.
- **It is not a real-world error rate.** Real logging is not random (people log more on bad days) and real symptoms are correlated day to day; either could make real rates higher or lower.

**What a sound rule would need (not implemented; no threshold invented):**
- a test of each window against the person's own rate under a proper null model, for example permuting cycle-day alignment;
- correction for scanning many windows;
- an **agreed acceptable false-alert rate**, a product and clinical decision;
- prospective testing against simple personal baselines (`docs/cycle-validation-plan.md` Q5).

Until then, pattern findings stay behind `patternInsights` (off).

## What was run (2026-11-15)
Environment:
- Linux 6.18; Node v22.23.4.
- Playwright 1.63.0 with Chromium 153.0.8010.12 (pre-installed here; CI pins Playwright 1.49.1).

| Command | Result |
|---|---|
| `node tests/cycle-regressions-29780c5.test.mjs` and `node tests/cycle-ui-regressions.cjs` on unchanged 29780c5 | **16 FAILED** (Node) + **1 FAILED** (browser); log committed in `d447810` |
| `node tests/cycle-regressions-29780c5.test.mjs` after the fixes | **ALL PASS** |
| `npm test` (15 suites) | **exit 0, 392 ok lines, 0 FAIL** |
| `npm run test:e2e` (= `node tests/e2e.cjs && node tests/cycle-ui-regressions.cjs`), real headless Chromium, run here | **exit 0, 69 ok (66 + 3), ALL PASS in both, no JavaScript errors** |
| `npm run eval:cycle` | exit 0; leakage check (every test participant, 3 dates, both models) passed. **Synthetic, not accuracy.** |
| `npm run sim:patterns` | Table above. **Synthetic, not a real-world rate.** |

**Browser scenarios in that run:**
- **Privacy:** stored data encrypted in IndexedDB; nothing cycle-related in the main store or error log.
- **Deletion:** delete all, then consent asked again; the reset path for unreadable data.
- **Purge:** through the UI, checking reminders, the due list and the export.
- **Two tabs:** no lost update; the other tab clears after a delete; nothing comes back after reload.
- **Concurrency, each with and without Web Locks:** simultaneous first opens, simultaneous saves, typing while the other tab saves, and save + delete.
- **Pattern gate:** off by default, labelled when on.

**Blocked or not run:** Safari, Firefox, real phones, private browsing and storage eviction. Only Chromium is available in this environment.
