# Fixes for issues independently reproduced in snapshot 80ea40f

## Method
- **Failing tests first.** Regression tests for issues 1–6 went into `tests/cycle-regressions-80ea40f.test.mjs`. They were run on unchanged 80ea40f and committed with the log before any fix: commit `72d4763`, log `docs/test-logs/cycle-regressions-on-80ea40f-BEFORE-fix.log`. **19 checks failed**, covering all 6 issues.
- **Guards.** The checks that already passed are deliberate guards. A temperature "control" makes sure the fix doesn't simply turn the feature off; the deletion and purge checks make sure history-keeping never keeps deleted data.
- **Features left off.** Cycle tracking and every experimental feature stay **off by default**. Nothing was deployed. No real health data was used.
- **No accuracy claims.** Nothing here is clinical accuracy. Wearable integration (SWL DS07) and clinical validation remain **incomplete**.

Line numbers refer to the files after the fix.

## Issues 1–6

| # | Failing test(s) on 80ea40f (actual output) | Fix | Changed files and lines | Result |
|---|---|---|---|---|
| 1 | Six 30-min readings marked `poor` → `{"status":"ok","rejected":0}`; mixed night used 12 samples; a shift could be triggered by poor readings | `vendor_poor` is excluded from all inference, because there is no clinically validated quality policy; using such readings would need device-specific validation. Each night records `rejectedBy` (count per reason). | `js/cycle/wearables.js` 93–103 (`EXCLUDING`, `isUsable`, `rejectionReasons`), 129 | **Pass:** all-poor night → `no_usable_data`, `rejectedBy.vendor_poor = 6`; mixed night uses only good readings; poor nights can't produce a shift |
| 2 | August rise that returned to baseline → `"Possibly after ovulation (estimate)"` in November; contradictory and missing evidence also produced estimates | `retrospectiveShift` reports the **historical event** plus what happened afterwards (`stillElevated`, `returnedOn`, `lastValidNight`). The new `temperatureEligibility` decides whether it may describe **today**, and abstains with a stated reason when evidence is **contradictory** (back to baseline by the rule's own definition), **missing** (no usable reading last night) or **stale** (no usable estimate, or today is past the person's longest recent cycle). **No physiological threshold was added.** | `js/cycle/tempshift.js` 51–57; `js/cycle/phase.js` 19–51; `js/cycle/ui.js` 182–183 | **Pass:** August→November, contradictory and missing all abstain; the control (rise present last night, within usual length) is still shown as an estimate |
| 3 | 3 low-energy entries on day 24 across 6 cycles, nothing else logged → pattern found, and "0% of your logs at other times" | The outside rate is `null` (**unknown**) when there are no outside observations. A pattern needs outside-window logs in ≥ 3 observed cycles (the existing `MIN_OBSERVED`; no new number). Otherwise the status is "insufficient", with the reason. The text states observed **and** missing cycles. | `js/cycle/patterns.js` 31–60, 87–97, 114 | **Pass** |
| 4 | Six 28-day cycles → headline "Estimated range" for "22 Jul – 22 Jul"; one 40-day cycle → invented ±2-day padding | No padding. The result is labelled `calibrated: false`, `intervalSource: 'past-cycles-only'`. A single date is shown as one date and never called a range. The visible text always says *"Your next period may come earlier or later than this… not a prediction interval… not validated"*. Any interval must come from held-out validation (none exists yet). | `js/cycle/predict.js` 1–21, 56–74, 79; `js/cycle/ui.js` 151 | **Pass** (Node). Browser: the "earlier or later" line is **visible** with all sections closed |
| 5 | Identical June resync overwrote the January `syncedAt`, and the January view lost the night | An identical resync keeps the night and its first-known `syncedAt`. A material change becomes current, and the earlier version is kept in `prior` with its own time. `stateAsOf` picks the version known then. | `js/cycle/wearables.js` 147–167; `js/cycle/model.js` 279–282 | **Pass:** the January view keeps the night, and the January value after a June change |
| 6 | January mood corrected in June → January view showed the June value | Each day field keeps a version history (`hist`: value + entry time). `stateAsOf` uses the value known then. **Deleting an entry, purging a category or withdrawing consent removes its history too.** | `js/cycle/model.js` 191–204, 266–275 | **Pass:** current and historical views tested separately; deletion and purge honoured in both |

## Older tests changed on purpose (they asserted the old behaviour)
- `cycle.test.mjs`, "no 28-day default…": asserted the invented ±2-day padding (day 38–42). It now asserts day 40 only.
- `cycle.test.mjs`, "phase: an estimate only with…": passed a bare `{detected:true}`. It now supplies full current evidence. A new check asserts that the bare object abstains.
- `cycle.test.mjs`, "pattern: text…": wording changed to state the denominator honestly.
- `tests/e2e.cjs`: headline changed from "Estimated range" to "From your past cycles", plus a visibility check for the "earlier or later" line.

## Item 7: status of the other open audit items

| Audit item | Status | What was done, or what is needed |
|---|---|---|
| 2.1 one-day "range" from identical cycles | **Fixed** (issue 4) | Shown as one date from past cycles, never as an interval |
| 2.2 period-check reminder stopped when overdue, saying "Paused." | **Fixed** | Check-ins continue while overdue, until a period is logged or the estimate becomes stale; true reason shown (`reminders.js` 50–53, 91, 107). Test: "7 (audit 2.2)" |
| 2.3 disclaimer collapsed, "covers that spread" | **Fixed** (issue 4) | Visible "earlier or later" line; wording changed |
| 2.4 no overdue state | **Fixed** | `overdue` flag, headline "Later than your recent cycles"; uses the person's own longest recent cycle, no new threshold. Test: "7 (audit 2.4)" |
| 2.5 no "did you miss a log?" prompt | **Open: needs evidence** | Would need a rule such as "a cycle about 2× the usual length". Not created without clinical input |
| 2.6 corrections couldn't be replayed | **Fixed** | 0f26696 issue 10, plus day-value history (issue 6 here) |
| 3.1 overlapping readings double-counted | **Fixed** earlier | Union of intervals (0f26696 issue 6) |
| 3.2 3 of 8 hours counted as a full night | **Open: needs device evidence** | Needs a validated rule for how readings must be spread across the night |
| 3.3 missing time zone treated as UTC | **Fixed** | Flagged `tz_unknown` and excluded; counted in `rejectedBy` (`wearables.js` 86). Test: "7 (audit 3.3)" |
| 3.4 firmware change mid-night | **Partly mitigated** | Summaries split by firmware; each half must meet the night rules on its own. A dedicated "partial night" state still needs device evidence (3.2) |
| 3.5 clock drift | **Open: needs a real SDK** | Can't be tested on the synthetic mock |
| 4.1 old rise shown as current | **Fixed** (issue 2) | |
| 4.2 3-night blip called "sustained" | **Fixed** (issue 2) | Wording no longer says "sustained"; eligibility requires the rise to still be present |
| 4.3 unflagged fever read as a rise | **Open: needs clinical evidence** | Would need a validated upper bound or illness detector. Mitigation: the flag is off, and a fever that subsides is "contradictory", so it abstains |
| 4.4 misleading reason when data is short | **Fixed** earlier | 0f26696 issue 8 |
| 5.1 selective logging creates patterns | **Fixed** (issue 3) | |
| 5.2 false patterns in users with no real pattern | **Open: needs a statistical method and an agreed target** | Re-measured on the same synthetic setup: **27% before and after** (20% at a 30% logging rate). Issue 3's rule doesn't address the many-windows problem. Needs, for example, a permutation test against each person's own data and a clinically or product-agreed acceptable false-alert rate. No threshold invented. Pattern-based features stay off by default |
| 5.3 denominator hides unlogged cycles | **Fixed** | Text states missing cycles. Test: "7 (audit 5.3/5.4)" |
| 5.4 "cycle days 24–24" | **Fixed** | "cycle day 24" |
| 6.1 entry-time leakage | **Fixed** earlier | 0f26696 issue 10; extended by issues 5–6 here |
| 6.2 cycles scored against the wrong outcome around missed logs | **Fixed** | Excluded and counted (synthetic cohort: 3 excluded, 335 scored) (`eval.js` 130–133). Test: "7 (audit 6.2)" |
| 6.3 narrow leakage check | **Fixed** | Every test participant, 3 dates each, both models; also scrambles period ends, `missedBefore`, version history and day values (`eval.js` 240–254) |
| 6.4 exclusions not reported | **Fixed** | Report lists nights by status and rejected readings by reason (`eval.js` 256–265) |
| 6.5 circular synthetic assumptions | **Open: inherent** | Synthetic data can't validate the sensor model. Needs the clinician-led study (`docs/cycle-validation-plan.md`) |
| 1.5 device ID is not authentication | **Open: by design** | Needs accounts and a backend |
| Wearable integration (SWL DS07) | **Incomplete** | No SDK; the adapter refuses to connect |
| Clinical validation | **Incomplete** | Not started; plan only |

## Thresholds and what evidence they need (none added in this change)
| Parameter | Value | Evidence needed |
|---|---|---|
| `minCoverageMin`, `minSamples`, `maxSampleMin` | 180 min, 6, 60 min | Device testing against reference recordings (`docs/wearable-sdk-requirements.md`) |
| Night spread (audit 3.2) | none set | The same device testing |
| `SHIFT_PARAMS` (`DELTA` 0.15 °C, 6/3 nights, spans) | unchanged placeholders | A clinician-designed reference study (LH plus ultrasound), pre-registered (`docs/cycle-validation-plan.md` Q3–Q4) |
| Temperature eligibility | **no thresholds**: uses the rule's own baseline max, last night, and the person's own longest cycle | Whether wrist temperature indicates phase at all: the same reference study |
| Pattern rules (3 cycles, 75%, < 50%) | unchanged placeholders | Prospective comparison against personal baselines, plus an agreed false-alert rate (5.2) |
| Predicted-period interval | **none shown** | Held-out validation in a real study; synthetic "window coverage" is reported only to show how such an interval would be derived |
| `HRV_WINDOW_DAYS` | 28 | Device and clinical evidence |

## What was run (2026-11-15)
Environment:
- Linux 6.18; Node v22.23.4.
- Playwright 1.63.0 with Chromium 153 (pre-installed in this environment; CI pins Playwright 1.49.1).

| Command | Result |
|---|---|
| `node tests/cycle-regressions-80ea40f.test.mjs` on unchanged 80ea40f | **19 FAILED** (log committed in 72d4763) |
| `node tests/cycle-regressions-80ea40f.test.mjs` after the fixes | **28 ok, ALL PASS** |
| `npm test` (14 suites) | **exit 0, 366 ok lines, 0 FAIL** |
| `node tests/e2e.cjs` (real headless Chromium, run here) | **exit 0, 64 ok, ALL PASS, no JavaScript errors** |
| `node tools/cycle-eval.mjs` | exit 0; broadened leakage check **passed**; 335 cycles scored, 3 excluded; `docs/cycle-eval-synthetic.md` regenerated. **Synthetic, not accuracy.** |
| Pattern false-positive re-measurement (`fp_rate.mjs` in scratch; method in item 5.2) | 27% / 20%, unchanged |

**Browser scenarios covered in that run:**
- two tabs with no lost update;
- the other tab clearing after a delete;
- delete + reload;
- the reset of unreadable data;
- purge through the UI;
- simultaneous first opens, simultaneous saves, typing while the other tab saves, and save + delete, each **with and without Web Locks**.

**Blocked or not run:** Safari, Firefox, real phones, private browsing and storage eviction. Only Chromium is available here.
