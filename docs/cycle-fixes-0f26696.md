# Fixes for the 10 issues independently reproduced in snapshot 0f26696

## Method
1. **Failing tests first.** One regression test (or more) per issue went into `tests/cycle-regressions.test.mjs`. It was run against the unchanged 0f26696 code and committed with its log (`f6063cb`, `docs/test-logs/cycle-regressions-on-0f26696-BEFORE-fix.log`): 23 checks failed, covering all 10 issues.
2. **Then each fix.** Every issue's checks now pass (`docs/test-logs/cycle-regressions-AFTER-fix.log`).
3. **Features left off.** Cycle tracking, phase education, symptom forecast, one-tap suggestions, wearable-timed questions and temperature research all stay **off by default**. Nothing was merged or deployed.
4. **All data synthetic.** No result here is real-world accuracy.

Line numbers below refer to the files after the fix.

## Per issue

| # | Issue | Failing test(s) on 0f26696 | Fix | Changed files and lines | Regression result |
|---|---|---|---|---|---|
| 1 | No-Web-Locks fallback could silently lose one of two simultaneous saves; consent withdrawal could be undone by a racing save | "1 no lock: two simultaneous saves never silently lose one…" → stored `["2026-10-01"]` (one lost). "1 no lock: withdrawing reminder consent can't be undone…" → consent back on, 1 reminder | Every write is an **atomic compare-and-swap** on (generation, revision): one IndexedDB readwrite transaction in the browser; no await between check and write in memory. A lost race re-applies the change to fresh data; after 5 tries it fails with retryable `CONFLICT` and saves nothing. Deletion is an atomic "bump generation + remove record". Storage without atomic operations is refused (`STORAGE_NOT_ATOMIC`). Web Locks are kept only to reduce conflicts. | `js/cycle/store.js` 95–150 (memory + IndexedDB storage), 195–262 (repo: `sync`, `update` 237–250, `deleteAll` 253–260); `js/cycle/ui.js` 26–57 (IndexedDB storage, BroadcastChannel) | **Pass.** Node: parallel saves keep both; save-vs-delete leaves nothing; withdrawal-vs-save leaves no reminders and consent off; persistent conflict → `CONFLICT`, nothing saved. Browser: simultaneous saves and save-vs-delete pass **with and without Web Locks** |
| 2 | Simultaneous first opens could create competing keys → `DECRYPT_FAILED` after reopen | "2 the second first-opener can save, and the result still decrypts" failed | Keys are created with an **atomic create-if-absent** (generate first, then one transaction or synchronous check-and-set). **One key per generation** (`uid#gen`); deletion only destroys older generations' keys, so a tab opening during a delete can't end up with a key nobody else has. The device user ID is also created atomically in IndexedDB (two tabs could otherwise invent two IDs). | `store.js` 30–92 (key naming, `memoryKeys` 37–46, `indexedDbKeys` 71–89), 113–150 (`userId`), 189–193 (`resetCycleStorage`); `ui.js` 42–46 (`deviceUserId`) | **Pass.** Node: concurrent first opens share one key; three tabs asking for the user ID at once get one. Browser: two tabs opening at once share one user ID and key; a save from the second decrypts after reload (with and without Web Locks) |
| 3 | Purging mood history left pattern reminders, their copied text and delivery state | "3 purge: pattern reminders … are deleted"; "…origin text, delivery state and dismissals are gone"; "3 turning a category off (no purge) disables…" | Turning a category off **disables** its pattern reminders, with the visible reason "Turned off because you stopped logging mood". **Purging deletes** those reminders, their `origin` text, delivery records, dismissed insights and suggestion answers. A reminder can't be re-enabled while its category is off. | `js/cycle/model.js` 64–92 (`setCategory`, `invalidateDerived` 78–92); `js/cycle/reminders.js` 36–37, 84 | **Pass.** Node: state, export and `dueNow` are clean after purge. Browser: a seeded mood pattern reminder is shown, then gone from the reminders list, the due list and the downloaded export after purge |
| 4 | An open period counted as 7 observed days; "observed menstruation" even after the user logged `bleeding: none` | "4 explicit none…", "4 spotting…", "4 an unlogged later day…", "4 confirmed end: … spotting …" | New `observedBleeding(s, date)` → `period` / `spotting` / `none` / `unknown`. An explicit day entry always wins. "period" means the logged start day, a day inside a **confirmed** start–end, or a day logged as period. Later days of an open period are **unknown**. `periodOn` is documented as episode-only, used just to decide whether to ask "did a new period start?". Phase education uses `observedBleeding`. | `model.js` 150–181; `js/cycle/phase.js` 21–25 | **Pass** (explicit none, spotting, unlogged day, start day, confirmed end, spotting inside a confirmed period) |
| 5 | Three different moods could be reported as "low in 3 of 3 cycles" | "5 different moods…" → `"low" in 3 of 4 cycles`. "5 repeated logs…" → `"anxious" in 4 of 4` (true: 3 of 4) | Values are counted **per cycle**, each exact value once per cycle. A value is suggested only if it is the unique most common one and appeared in ≥ 3 cycles (the existing pattern minimum), with its exact count. Otherwise the combined wording is used (e.g. "low, anxious or irritable mood in 3 of 4 cycles, not always the same. How is it today?") and **nothing is pre-filled**. | `js/cycle/nudges.js` 79–100 | **Pass**, including an explicit tie (2 and 2 → no pre-fill) |
| 6 | `tEnd: Infinity` produced an "ok" night with infinite coverage | "6 tEnd = Infinity…" → `{"status":"ok","coverageMin":null}`; "6 futureEnd…" | Both endpoints must be finite; start < end (reversed and zero-length rejected); not before 2015 and not more than 5 minutes in the future; one sample may not span more than 60 minutes (`bad_duration`). Night coverage is now the **union** of intervals, so overlaps aren't double-counted. | `js/cycle/wearables.js` 24–55 (`NIGHT_PARAMS`, `timestampProblem`, `unionMinutes`), 79–84, 90–103 | **Pass** (Infinity, −Infinity, NaN start and end, future end, reversed) |
| 7 | Same value plus a new off-wrist warning was discarded as an exact duplicate | "7 … (clean then off-wrist)"; "7 … different firmware / unit / end time" (counted as duplicates) | A duplicate now needs **every** field to match (value, unit, end time, firmware, model, time-zone offset, kind, quality). If only the quality changed, the worse quality is kept in either order, plus `quality_changed`, which is excluded. Any other change is `conflict` (excluded). | `wearables.js` 56–75, 84, 99 (`isUsable`) | **Pass** (both arrival orders; firmware, unit and end-time changes) |
| 8 | 6 baseline nights + 19-night gap + 3 high nights → `detected: true` | "8 …: abstains" → `detected:true` | Adds a **continuity** check between the baseline and high windows. The allowed gap is the same number of missing nights the confirmation window already tolerated (`MAX_CONFIRM_SPAN − CONFIRM + 1`). **No new physiological threshold.** If no window can be judged it abstains ("Not judged: there are gaps…"); if some were judged it says gaps couldn't be judged. | `js/cycle/tempshift.js` 38–58 | **Pass** |
| 9 | A 2-year-old HRV baseline was called "your usual" | "9 a two-year-old HRV baseline…" → asked, saying "your usual" | The baseline uses only the **current device's** nights from the last `HRV_WINDOW_DAYS` (28, placeholder), needing ≥ 7. Otherwise it doesn't ask, and says why ("0 in the last 28 days; 7 needed"). The text gives the real basis: "your typical level over N nights from 30 Oct to 12 Nov". | `nudges.js` 21–27, 63–77 | **Pass** (old baseline; device change) |
| 10 | A period dated 1 Jan but entered 1 Jun was visible as of 15 Jan; corrections changed past forecasts | "10 … not visible as of 15 Jan"; "10 a later correction does not change…"; "10 a day backfilled later is unknown…" | Each period keeps **versions** (state after each entry or edit, with time). Day fields record when they were entered (`rec`). Wearable nights record `syncedAt`. `stateAsOf(s, asOf, { knownAt })` uses only what was entered before `knownAt` (default: start of `asOf`, UTC); later-entered values are **unknown**. Forecasts are therefore **frozen**: as-of results don't change after later corrections. Older entries without times are kept and counted in `recordTimeUnknown`. The evaluation harness now gives synthetic entries realistic entry and sync times and predicts at midday using only what was known then. | `model.js` 125–147 (`addVersion`, period functions), 179–203 (`logDay`), 236–283 (`stateAsOf`); `wearables.js` 138–141 (`mergeNights`); `js/cycle/eval.js` 18–20, 70–80 | **Pass**; evaluation leakage self-check passes |

## Additional defect found while testing these fixes
- **Problem:** a redraw triggered by another tab reset the unsaved date field.
- **Found by:** the new simultaneous-save browser test, with Web Locks *available*.
- **What happened:** when tab A saved, tab B redrew its screen. B's date field went back to today, so B's click saved **today** instead of the date the person picked (reproduced in 1 of 3 runs).
- **Fix:** unsaved form inputs (date, symptom selects, unwell/travel, reminder fields) are kept across redraws (`ui.js` 82–116).
- **Test:** a deterministic browser check ("other tab saves while this tab is typing: the typed date is kept") plus 6/6 clean repro runs.

## Thresholds that still need device or clinical evidence
| Parameter | Value | Where | Why it exists |
|---|---|---|---|
| `maxSampleMin` | 60 min | `wearables.js` | Rejects one sample claiming an implausibly long duration |
| `EARLIEST` | 1 Jan 2015 | `wearables.js` | Rejects obviously wrong clocks (e.g. epoch 0) |
| `minCoverageMin`, `minSamples` | 180 min, 6 | `wearables.js` | Unchanged; still placeholders. Coverage is now the union of intervals; the night-spread check (audit 3.2) is still open |
| `MAX_JOIN_MISSING` | derived = 3 nights | `tempshift.js` | Reuses an existing tolerance; a data-continuity rule, not physiology |
| `HRV_WINDOW_DAYS` | 28 | `nudges.js` | How recent "your typical level" must be |
| Retries | 5 | `store.js` | Attempts before a retryable `CONFLICT` |
| Evaluation decision time | midday on day D | `eval.js` | Synthetic convention for "known at" |

## What was run
- `node tests/cycle-regressions.test.mjs` on unchanged 0f26696: **23 FAILED** (log committed).
- The same after the fixes: **41 ok, ALL PASS**. That is the 10-issue set plus extra checks for ties, persistent conflicts, non-atomic storage, concurrent user-ID creation, legacy migration and export after purge.
- `npm test` (all 13 suites): **exit 0, 337 ok lines**.
- `npm run test:e2e`: **ran in real Chromium (Playwright, headless) in this environment: 63 ok, exit 0, no JavaScript errors.** It includes, in two fresh contexts (Web Locks available, and Web Locks removed):
  - simultaneous first opens;
  - simultaneous saves;
  - typing while the other tab saves;
  - simultaneous save + delete;
  - purge through the UI (reminders, due list, export);
  - deletion and the reset path.
- **No browser test was blocked here.**
- **Not tested:**
  - Safari, Firefox and real mobile devices (only Chromium was available);
  - IndexedDB behaviour under private browsing or storage eviction;
  - true multi-*process* timing beyond what Chromium's tabs in one context exercise.
- `npm run eval:cycle`: regenerated `docs/cycle-eval-synthetic.md`; leakage self-check passed. **Synthetic, not accuracy.**

## Still open (from the earlier audit, not part of this list)
- Estimate wording and the minimum range width (2.x).
- Night-spread coverage (3.2).
- Remaining temperature issues: old rises shown, "sustained" not checked after confirmation, unflagged fever (4.1–4.3).
- Pattern false-positive rate, selective logging and the denominator (5.1–5.3).
- Wrong outcomes around missed logs and the exclusion counts in the evaluation (6.2–6.4).
- See `docs/cycle-audit-9f87b83.md`.
