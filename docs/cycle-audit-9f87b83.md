# Audit of commit 9f87b83, with fix status

The findings below were reproduced against commit `9f87b83`. Line numbers refer to that commit.

## Fix status (current branch)
| ID | Status | Where | Regression tests |
|---|---|---|---|
| 1.1 Stale tab writes deleted data back | **Fixed** | `js/cycle/store.js`: a generation counter is bumped before deletion; stale saves are refused with `STALE_SESSION` and wiped from memory; records from older generations are discarded unread. `js/cycle/ui.js`: the `storage` listener refreshes or clears the other tab. | `tests/cycle-integration.test.mjs` "1.1 …" (with and without a lock); `tests/e2e.cjs` "two tabs: the other tab clears itself…", "…nothing comes back…" |
| 1.2 Delete during an outstanding save | **Fixed** | `store.js`: one operation queue per tab plus a cross-tab lock (Web Locks); a post-write generation check removes a write that raced a delete | "1.2 delete during a save…", "1.2 save in another tab racing a delete…" |
| 1.3 Cross-tab lost update | **Fixed** | `store.js`: each save re-reads and decrypts the latest stored revision before applying the change; revision and generation are bound into the AAD | "1.3 two tabs: both entries kept…"; e2e "two tabs: entries from both tabs are kept" |
| 1.4 No recovery from unreadable data | **Fixed** | `store.js` `resetCycleStorage`; `ui.js` reset button on the "unavailable" card | "1.4 …"; e2e "unreadable data: a reset button is offered…" |
| 1.6 User switch in another tab | **Fixed** | `ui.js`: reopens when `shred_cycle_uid` changes or storage is cleared; `ensureRepo` checks the uid | Covered by inspection and the storage-event path; no dedicated test |
| 1.5 Local ID is not authentication | Open (design) | Needs accounts and a backend | n/a |
| 2.x, 3.x, 4.x, 5.x, 6.x | **Open** | Not changed. Several fixes need thresholds that must come from evidence. | n/a |

Original probe re-run after the fix:
- `crosstab.cjs` lost update now keeps both entries.
- After a delete, the second tab can no longer reach the log form, because it clears itself to the consent screen.


- **Scope:** the cycle tracking code at commit `9f87b83` on `claude/intelligent-ritchie-lvg4o5`, audited in a clean detached worktree.
- **Date:** 2026-11-14.
- **Changes made:** nothing was merged, deployed or enabled. **No code or thresholds were changed.** Every fix below is a *proposal*. Where a fix needs a threshold, the threshold is marked as needing evidence.

## What was run
| Run | Command | Result |
|---|---|---|
| Existing suites on the exact commit | `npm test` (inside the extracted ZIP) | exit 0, 244 `ok` lines (cycle: 103 unit, 27 integration) |
| Node probes | `node audit/audit_probes.mjs <worktree>` and `node audit/audit_probes2.mjs <worktree>` | Output reproduced below per finding |
| Real-browser two-tab test | `node audit/crosstab.cjs <worktree>` (Chromium, real IndexedDB and localStorage) | Lost update and delete-resurrection both reproduced |
| ZIP verification | `git archive` → extract → `diff -rq` against the worktree, then `npm test` | Identical tree, tests pass |

All inputs are synthetic. Classes: **D** = reproduced defect · **L** = design limitation (works as written, but the design is weak) · **H** = untested hypothesis.

## Summary
| ID | Class | Severity | One line |
|---|---|---|---|
| 1.1 | D | High | Deleting in one tab, then saving in another, writes the deleted data back; the feature then stays locked |
| 1.2 | D | High | Deleting while a save is in flight brings the data back (in memory and on disk) |
| 1.3 | D | High | Two tabs overwrite each other's changes (lost update) |
| 1.4 | D | Medium | No in-app recovery once the data can't be decrypted (the delete button is unreachable) |
| 1.5 | L | Info | The local user ID is not authentication; there is no multi-user isolation on a shared profile |
| 1.6 | L | Low | A tab keeps writing to the old user slot after a user switch (no storage-event handling) |
| 2.1 | D | High | Identical cycles produce a 1-day "range"; the real next period (29 d) falls outside it |
| 2.2 | D | Medium | The "When my range begins" reminder stops once the range has passed (when it's most useful), and the reason says "Paused." |
| 2.3 | L | Medium | The envelope is not a calibrated interval; the disclaimer is hidden in a collapsed section, and "covers that spread" is ambiguous |
| 2.4 | L | Medium | Overdue: a passed range keeps showing for about 25 days until "stale" |
| 2.5 | L | Medium | An unmarked missed log makes the estimate "too variable"; the app never asks "did you miss a log?" |
| 2.6 | L | Medium | No edit history: past estimates can't be reproduced after corrections |
| 3.1 | D | High | Sensor coverage sums overlapping durations: 6 readings in 6 minutes count as 1,080 min, and the night is marked `ok` |
| 3.2 | D | Medium | 3 measured hours out of an 8-hour night is marked `ok` with a nightly value; nothing checks how the night is covered |
| 3.3 | D | Low | A missing time-zone offset is silently treated as UTC (wrong night assigned) |
| 3.4 | L | Low | A firmware update mid-night produces two `ok` summaries for the same night |
| 3.5 | L | Info | Clock drift between watch and phone isn't handled (timestamps trusted) |
| 4.1 | D | High | A temperature rise from 65 days ago still yields "Possibly after ovulation" today |
| 4.2 | D | High | A 3-night blip is reported as a "sustained rise" |
| 4.3 | D | High | An unflagged fever (+1.4 °C) is reported as a possible ovulation-related rise |
| 4.4 | D | Low | With too few baseline nights, the reason shown is "No sustained rise", not "not enough data" |
| 4.5 | L | Medium | Only the first rise is reported; later rises are ignored |
| 4.6 | L | Low | Baseline nights may span a 12-day window with a 6-night gap |
| 4.7 | — | OK | Flags are off by default; the wording never says "confirmed", "safe" or "fertile" |
| 5.1 | D | High | Selective logging (only bad days) creates a pattern from 3 log entries in total |
| 5.2 | D | High | About 27% of synthetic users with **no** real pattern get at least one pattern (many-windows problem) |
| 5.3 | D | Medium | The denominator hides cycles without window logs ("3 of your last 3" when there were 6 cycles) |
| 5.4 | D | Low | Text "cycle days 24–24" |
| 6.1 | D | High (for study use) | `stateAsOf` uses event dates, not entry dates: backfilled or corrected entries leak into earlier forecasts |
| 6.2 | L | Medium | Cycles spanning a missed log are scored against the wrong outcome |
| 6.3 | L | Medium | The leakage self-check is narrow (1 participant; does not scramble days, ends or flags) |
| 6.4 | L | Medium | Failed or excluded recordings aren't counted in the period-endpoint report |
| 6.5 | L | High (for interpretation) | The synthetic generator and the sensor model share the same structural assumption (circular) |
| 6.6 | — | OK | Period, ovulation and symptom endpoints are separate functions with separate outputs; no fitted parameters, so participant leakage can't occur in the current design |

---

## 1. Encryption and isolation

### Threat model (what the commit actually provides)
**Protects against:**
- reading cycle data from a raw copy of `localStorage` without the IndexedDB key;
- other websites (same-origin policy);
- accidental mixing of two `userId` slots in code (AAD binding plus an owner check);
- silent tampering with stored ciphertext (AES-GCM authentication).

**Does not protect against:**
- anyone using the same browser profile on the unlocked device;
- any script running on the app's origin (XSS, a compromised vendored file). A non-extractable key can't be exported, but it **can be used** to decrypt;
- malicious browser extensions with site access;
- malware;
- device backups that contain both `localStorage` and IndexedDB.

**Local user-ID separation vs authenticated isolation:**
- `localUserId()` (`js/cycle/store.js:54–58`) is a random UUID stored in `localStorage`. It identifies a *browser profile*, not a person.
- There is no login, no secret and no server.
- "Cross-user isolation" in the tests means: two different `userId` strings can't read each other's records **through this API**. It is *not* authenticated isolation between people.
- Real per-person isolation needs authentication plus server-side authorisation (not built).

### 1.1 D: Deleted data written back by a second tab; the feature then stays locked
- **Where:** `store.js:89–92` (`update` writes unconditionally), `store.js:98–99` (`deleteAll`), `ui.js:21, 29–32` (one cached `repo` per tab).
- **Input:** two tabs open on the Cycle screen. Tab A: Settings → Delete all. Tab B (opened earlier): logs spotting.
- **Actual:**
  - Node: `slotExistsAfter: true`, and reopening throws `DECRYPT_FAILED`.
  - Real browser: `slotsAfterStaleSave: 1`; after reloading A, the screen shows *"Cycle tracking is unavailable. Your saved cycle data could not be unlocked on this device."*
  - Tab B still holds the old key and the full deleted state in memory, so it can still display and export the deleted data until it is closed.
- **Expected:** after a deletion, no tab can write. Other tabs drop their in-memory state and show the consent screen.
- **Fix:**
  - Keep a deletion generation counter, e.g. `shred_cycle_gen:<uid>` in localStorage, written by `deleteAll`.
  - `update()` re-reads it before `storage.set`, refuses with `STALE_SESSION` if it changed, and clears in-memory state.
  - Listen for the `storage` event (or a `BroadcastChannel`) in `ui.js` to re-open the repo.
- **Regression test** (integration): open A and B on the same storage and key store → `A.deleteAll()` → `B.update(...)` rejects with `STALE_SESSION` → `storage.raw.has(slot) === false` → reopening gives an empty state. Add the browser two-tab version to `e2e.cjs`.

### 1.2 D: Delete during an outstanding save
- **Where:** `store.js:92`. `await storage.set(slot, await encrypt(...)); state = draft` runs after `deleteAll` has finished.
- **Input:** `p = repo.update(log 2026-10-01)` (not awaited) → `await repo.deleteAll()` → `await p`.
- **Actual:** `inMemoryAfter: ["2026-10-01"]`, `slotExistsAfter: true`, and reopening throws `DECRYPT_FAILED`.
- **Expected:** the deletion wins. The pending save is discarded, and memory and disk stay empty.
- **Fix:**
  - Serialise every operation through one promise queue inside the repo, so `deleteAll` waits for pending writes and then deletes.
  - Plus the generation check from 1.1, so a write that started before the delete is dropped.
- **Regression test:** the exact sequence above → expect `read().periods.length === 0`, no slot, and reopening gives an empty state.

### 1.3 D: Cross-tab lost update
- **Where:** `store.js:89–92`. A whole-state overwrite from an in-memory copy, with no version check.
- **Input:** tab A logs 2026-10-01; tab B (stale) logs 2026-11-01.
- **Actual:** real browser `storedAfterReload: ["2026-11-01"]`. Tab A's entry was silently lost. Node gives the same result.
- **Expected:** both entries kept, or B's write refused and re-applied on fresh state.
- **Fix:**
  - Store a monotonically increasing `rev` inside the ciphertext envelope.
  - `update()` re-reads and decrypts the stored record before applying `fn`: read-modify-write on the latest data, with a compare of `rev` before writing.
  - Use the Web Locks API (`navigator.locks.request`) where available to serialise across tabs.
- **Regression test:** two repos on one storage → A logs X, B logs Y → reopen → both X and Y present.

### 1.4 D: No recovery path from `DECRYPT_FAILED`
- **Where:** `ui.js:44`. The error card has no actions.
- **Input:** any state from 1.1 or 1.2.
- **Actual:** the error card is shown, but Settings → Delete all isn't rendered, so the user can't reset.
- **Expected:** "Reset cycle data on this device" (removes the slot and key, then re-consents), with an explanation.
- **Regression test:** put an undecryptable blob in the slot → render → the reset button exists → after the reset, the consent screen shows.

### 1.5 L: The user ID is not authentication
- **Probe:** a second person on the same browser profile reads `shred_cycle_uid` and gets the data (`reads: ["2026-10-01"]`). Setting the uid to someone else's ID on the same device would open their slot, because the keys are indexed by uid.
- **Fix:** document this; real accounts need a backend. Optionally add a device-level app lock (WebAuthn / passkey user verification gating key use).
- **Test:** none possible without authentication. Document it as out of scope.

### 1.6 L: User switch in another tab
- **Where:** `ui.js:21, 29–32`. The `repo` is cached; there's no `storage` listener.
- **Behaviour (by inspection, not executed):** if `shred_cycle_uid` changes, an open tab keeps writing to the old slot.
- **Fix:** listen for `storage` events on `shred_cycle_uid`, `shred_cycle_v1:*` and the generation key, then re-open.
- **Test:** a browser test that changes the uid in tab B and checks that tab A re-renders the consent screen.

---

## 2. Envelope vs calibrated interval

**Distinction:**
- The commit's "range" is the **min–max envelope of the last ≤ 6 usable cycle lengths**, shifted to the last start (`predict.js:53`). It describes past variation.
- It has no stated coverage probability, it was never calibrated, and with few or identical cycles it is narrower than any honest interval.
- A calibrated prediction interval would need a stated target coverage (e.g. 80%) and empirical validation that it achieves it on held-out, time-ordered data.

### 2.1 D: Identical cycles give a 1-day "range" that misses the next period
- **Where:** `predict.js:53` (no minimum width), `predict.js:58` (text).
- **Input:** six 28-day cycles; the real next cycle is 29 days.
- **Actual:**
  - `rangeStart = rangeEnd = 2026-09-13` (width 1 day); `actualNext 2026-09-14`; `covered: false`.
  - Text: "between 28 and 28 days … The range covers that spread."
  - After the 29-day cycle, the width is 2 days.
- **Expected:** never show a one-day "range" as if it were a range. Show a minimum width or no point-like range, and wording that says the next period may fall outside it.
- **Fix:** a minimum displayed width. The value needs evidence: it should come from the validation study (target coverage on held-out data). Until then, use a clearly labelled placeholder, e.g. ±2 days, the same as `EARLY_PAD`. **Not changed here**, per your instruction.
- **Regression test:** six 28-day cycles → `diffDays(rangeStart, rangeEnd) + 1 >= MIN_WIDTH`, and the detail must not match `/covers/`.

### 2.2 D: The period-check reminder stops when the period is overdue
- **Where:** `reminders.js:48` (`date <= est.rangeEnd`) and `reminders.js:86` (fallback reason `'Paused.'`).
- **Input:** 5 cycles of 30 days; today = day 35 (range passed).
- **Actual:** `nextFire → { next: null, why: "Paused." }`. The reminder is not paused.
- **Expected:** keep a check-in going while overdue (e.g. every 2–3 days, a user setting), and give the true reason.
- **Fix:** extend the window to `rangeEnd + overdueDays` (user-controlled), and add a correct reason ("Your estimated range has passed…").
- **Regression test:** the same input → `next` is not null; `why` does not equal `'Paused.'`.

### 2.3 L: The UI can still read as a promise
- **Where:** `ui.js:99` ("A date range, not a date."), `predict.js:58` ("The range covers that spread"), and the disclaimer only inside the collapsed "Why this estimate?".
- **Fix:**
  - Show one always-visible line under the range: "Based on your past cycles. Your next period may come earlier or later."
  - Change the detail to "Your last N cycles ranged from X to Y days."
- **Regression test:** an e2e check that the visible `#cyEstimate` text (details closed) contains "may come earlier or later".

### 2.4 L: Overdue display
- **Input:** 5 cycles of 30 days; today = day 59.
- **Actual:** status `estimate`, headline "Estimated range" with a range dated 30 days earlier (`beyondRange: true`). It becomes `stale` only on day 61 (`predict.js:44`, 2 × max(30, 9) = 60).
- **Expected:** a distinct `overdue` state, e.g. "Your period hasn't been logged and your usual range has passed", without re-showing the old range as the estimate.
- **Regression test:** day 35 → `status === 'overdue'`; the headline doesn't contain "Estimated".

### 2.5 L: Missed logs
- **Input:** cycles 28, 29, 56 (one period never logged), 28, 29.
- **Actual:** `too_variable`, 28–56 days. No prompt asks whether a period was missed.
- **Expected:** when a cycle is about 2× the user's median, ask "Did you miss logging a period between X and Y?" and offer "missed a log" or "this is right". That ratio is a placeholder needing review.
- **Regression test:** the same input → `pendingPrompts` contains a `confirmGap` prompt.

### 2.6 L: Later corrections
- **Input:** 4 cycles of 30 days; an estimate as of 2026-07-10; then the third start is corrected by 6 days.
- **Actual:** the estimate for the same `asOf` changes from `07-30–07-30` to `07-24–08-05`. There is no record of what was shown before.
- **Expected for audit and evaluation:** an append-only change log (`recordedAt`, before, after) so "what the app showed on date D" can be reproduced. See 6.1.

---

## 3. Overnight sensor quality

### 3.1 D: Overlapping readings are counted many times
- **Where:** `wearables.js:77`. `coverageMin = Σ(tEnd − tStart)` without merging overlaps.
- **Input:** 6 readings that start 1 minute apart, each claiming 3 hours.
- **Actual:** `status: "ok"`, `coverageMin: 1080`, `samples: 6`.
- **Expected:** coverage = the length of the *union* of intervals (≈ 186 min), and overlapping long-duration readings flagged.
- **Fix:** sort and merge intervals before summing; flag readings whose duration exceeds the declared sampling interval.
- **Regression test:** exactly this input → `coverageMin <= 190`, and the status reflects the union.

### 3.2 D: A partly measured night is reported as a full night
- **Where:** `wearables.js:80`. `enough = samples ≥ 6 && coverage ≥ 180`, with no check on how the night is covered.
- **Input:** 18 ten-minute samples from 23:00 to 02:00, nothing afterwards.
- **Actual:** `status: "ok"`, nightly value 33.9 °C.
- **Expected:** a nightly value only when the samples span the sleep window (e.g. samples in at least K of the night's hourly bins, or coverage ≥ X% of the detected sleep period). Otherwise `partial_night`, with no value.
- **Fix:** add `spanMin`, `hourlyBinsCovered` and `largestGapMin` to the summary, and require thresholds. **The thresholds need evidence** from device testing (`docs/wearable-sdk-requirements.md`).
- **Regression test:** the same input → status `partial_night` and value `null`. Record the largest gap.

### 3.3 D: A missing time-zone offset is treated as UTC
- **Where:** `wearables.js:61` (`tzOffsetMin ?? 0`).
- **Input:** a reading at 13:00 UTC from a phone in UTC+11 (local 00:00 the next day), with no offset.
- **Actual:** assigned to night 2026-11-02, by UTC. Correct depends on the zone.
- **Expected:** flag `tz_unknown`; exclude it from nightly values unless the device's zone is known from context.
- **Regression test:** a reading without an offset → flags include `tz_unknown`, and the night isn't `ok`.

### 3.4 L: Firmware change mid-night
- **Actual:** two `ok` summaries for night 2026-11-01 (`f` and `f2`, 240 minutes each).
- **Expected:** neither half is a full night. Mark both `partial_night`, and start a new segment on the next full night.
- **Regression test:** the same input → no `ok` summary for that night.

### 3.5 L: Handling as documented vs actual
| Topic | Behaviour at 9f87b83 |
|---|---|
| Gaps | Missing nights → `no_data`, never interpolated (correct). Gaps *within* a night are not measured (see 3.2). |
| Coverage | Sum of durations; overlaps double-counted (3.1). |
| Clock | Timestamps trusted. Future (> now + 5 min) and inverted intervals are flagged (`wearables.js:48`). No drift detection; no check that sample intervals are regular. |
| Device change | Summaries keyed by device + firmware; `segments()` splits analyses; the temperature rule uses only the last segment (correct). |
| Firmware change | Same as device change, but mid-night changes yield two summaries (3.4). |
| Travel | A change in `tzOffsetMin` between nights gives `tz_change`, which is excluded from the temperature rule. |
| Missing offset | Treated as UTC (3.3). |

---

## 4. Temperature and phases

**4.7 OK:**
- `readFlags()` defaults: `phaseEducation: false` and `temperatureResearch: false` (probe 4a). They stay disabled; I didn't enable them.
- The wording scan of the phase label and text found no "confirm", "safe", "fertile" or "infertile".
- `PHASE_EDUCATION` calls the four-phase model "a simplification".

### 4.1 D: An old rise is reported as the current phase
- **Where:** `ui.js:54` passes `retrospectiveShift(s, est.lastStart, today+1)`; `phase.js:22` shows it with no recency limit.
- **Input:** rise on days 15–28, back to baseline, today = cycle day 80 (no new period logged).
- **Actual:** `detected: true` from 2026-08-15; phase label "Possibly after ovulation (estimate)".
- **Expected:** no phase estimate when the rise is older than the plausible length of the post-ovulation phase, when the temperature has returned to baseline, or when the estimate state is `stale` or `overdue`. Show "Not enough data".
- **Fix:** require that the rise is still elevated over the last few valid nights and is recent. **Limits need clinical input.**
- **Regression test:** the same input → `phaseInfo(...).status === 'not_enough_data'`.

### 4.2 D: "Sustained" isn't checked
- **Where:** `tempshift.js:38–43`. It returns on the first 3 nights over the baseline, with no check that the elevation persists.
- **Input:** nights 9–11 at +0.5 °C, then back to baseline.
- **Actual:** `detected: true`, why: "A sustained rise was seen…".
- **Expected:** only report after continued elevation over the following nights, or don't use the word "sustained".
- **Regression test:** the same input → `detected: false`.

### 4.3 D: Unflagged illness
- **Input:** +1.4 °C for 4 nights (a fever-like jump); the user did not mark "unwell".
- **Actual:** `detected: true`, and the phase shows "Possibly after ovulation".
- **Expected:**
  - Implausibly large or abrupt jumps are flagged `possible_illness` and excluded.
  - The user is asked "Were you unwell?" instead of being shown a phase.
  - The upper bound needs evidence.
- **Regression test:** the same input → `detected: false`, plus a flag or prompt.

### 4.4 D: The reason hides a data shortage
- **Where:** `tempshift.js:47`.
- **Input:** 4 valid baseline nights, then 18 high nights.
- **Actual:** `detected: false`, why: "No sustained rise seen in this cycle so far."
- **Expected:** "Not enough baseline nights before the rise to judge."
- **Regression test:** the same input → why matches `/not enough/i`.

### 4.5 L: Only the first rise is reported
- **Input:** a rise on days 10–13, back down, a rise again from day 21.
- **Actual:** `firstHighNight 2026-10-10`; the later rise is ignored.
- **Fix:** return all candidate rises, and if there is more than one, say "unclear pattern" and give no estimate.

### 4.6 L: Gappy baseline
- **Input:** 4 valid nights, a 6-night gap, 2 valid nights, then high.
- **Actual:** detected, because `MAX_BASELINE_SPAN = 12` allows it.
- **Fix:** decide the maximum gap using evidence.

---

## 5. Symptom patterns

### 5.1 D: Selective logging creates a pattern
- **Where:** `patterns.js:40–41`. `outsideRate = 0` when nothing is logged outside the window, which passes `< 0.5`.
- **Input:** 3 complete cycles, and the only logs are one "low energy" per cycle on day 24.
- **Actual:** `found: true`; "You logged lower energy around cycle days 24–24 in 3 of your last 3 recorded cycles…"; `daysLogged: 3`.
- **Expected:**
  - "Not enough data: you mostly log on days you notice something, so we can't tell if this time is different."
  - Require a minimum number of outside-window logs, including non-notable ones, per cycle (e.g. ≥ N days logged per cycle).
  - **N needs evidence.** Placeholder until tested against personal baselines.
- **Regression test:** the same input → `found: false`, and `patternStatus` says insufficient or selective logging.

### 5.2 D: Chance patterns from scanning many windows
- **Where:** `patterns.js:56` scans 35 windows × each category.
- **Input:** 300 synthetic users, 6 complete cycles, 60% of days logged, "low" at a random 15%, **no real pattern**.
- **Actual:** **80 of 300 (27%)** got at least one "pattern".
- **Expected:** a false-pattern rate controlled to a pre-stated level.
- **Fix:**
  - Compare the in-window rate with the person's own out-of-window rate using a permutation test across cycle-day alignments.
  - Or require replication: found in the earlier cycles, confirmed in the most recent cycle.
  - Report the rate in the evaluation harness. The target rate is a product/clinical decision.
- **Regression test:** this simulation as a test: false-pattern rate ≤ the agreed target (it currently fails at 27%).

### 5.3 D: The denominator hides unlogged cycles
- **Where:** `patterns.js:80` (text).
- **Input:** 6 complete cycles; only 3 had any log in the window (all "low").
- **Actual:** `completeCycles 6, observed 3`; text: "in 3 of your last 3 recorded cycles with energy logs there".
- **Expected:** "In 3 of the 3 cycles where you logged energy around these days (you have 6 complete cycles; 3 had no energy logs then)." Probably also require observed/complete ≥ some share.
- **Regression test:** the same input → the text mentions 6 complete cycles and 3 without logs.

### 5.4 D: The text shows "cycle days 24–24"
- **Fix:** use "cycle day 24" when `from === to`.
- **Regression test:** the text matches `/cycle day 24 /`.

---

## 6. Evaluation

**6.6 OK:**
- `evaluatePeriods`, `evaluateShift` and `evaluateSymptoms` are separate functions with separate outputs.
- No parameters are fitted, so participant leakage through fitting can't occur.
- The split is deterministic by ID hash (9 development / 31 test).

### 6.1 D: Entry-time leakage and post-hoc corrections
- **Where:** `model.js:197–199`. `stateAsOf` filters by *event* date only.
- **Input:** start 2026-07-31, typed in on 2026-08-20 (`createdAt`); forecast as of 2026-08-10.
- **Actual:** the forecast as of 08-10 already uses the 07-31 start (`lastStartUsed: 2026-07-31`).
- **Expected:** for real-data evaluation, an entry is visible only if `recordedAt < asOf` **and** its event date is before `asOf`. Corrections apply from their correction time.
- **Fix:**
  - Add `recordedAt` to every entry plus an append-only edit log.
  - Make `stateAsOf(s, asOf, { byRecordTime: true })` replay the log.
  - The synthetic harness is unaffected (all entries are generated "on time"), but a real study would be biased in the app's favour.
- **Regression test:** the same input with `byRecordTime` → the last start used is 07-01.

### 6.2 L: Wrong outcomes around missed logs
- **Where:** `eval.js:121` (`actual = logged[k+1]`).
- **Input:** participant P005 has 1 unlogged period.
- **Actual:** the cycle spanning it is scored against the *following* logged start (≈ 2 cycles later), inflating the error.
- **Fix:** score against the true start when known (synthetic), or exclude and count cycles whose outcome is uncertain (real data). Report both.
- **Regression test:** with a missed-log participant, the number of scored cycles excludes the gap, and the exclusion is counted in the report.

### 6.3 L: The leakage self-check is narrow
- **Where:** `eval.js:201–207`.
- **Behaviour:** it checks one participant and one `asOf`, and scrambles only period starts and night values.
- **Fix:** run it for every test participant at several `asOf` values, and also scramble days, period ends, `missedBefore`/`lengthConfirmed` and night flags.
- **Regression test:** the extended check passes, and a deliberately leaky model (one that reads `s.periods` without `stateAsOf`) fails it.

### 6.4 L: Failed recordings aren't reported for the period endpoint
- **Behaviour:** the sensor model silently drops non-`ok` nights. The report gives `sensorUsedPct` but not the counts of nights excluded (insufficient wear, flags, firmware) or the fall-back reasons. Only the ovulation endpoint reports firmware exclusions.
- **Fix:** report per-reason exclusion counts for every endpoint.

### 6.5 L: Synthetic assumptions (circular for the sensor model)
Assumptions in `eval.js:44–56` and the `MockWearable`:
- Cycle lengths are normal and independent, with no autocorrelation.
- The luteal phase is 13 ± 1.5 days.
- A clean **+0.3 °C step** runs from ovulation + 1 day to the day before the next start, with independent nightly noise of 0.12.
- No illness, alcohol, room temperature or seasonal effects.
- Constant offsets on device changes.
- Missing nights happen at random.
- Symptoms are injected start-aligned or pre-menstrual at 85%.

The sensor candidate assumes exactly this structure, so its advantage in the synthetic report is **by construction**. The report already says so. No conclusion about real devices may be drawn from it.

---

## Untested hypotheses (H)
| ID | Hypothesis | How to test |
|---|---|---|
| H1 | Safari / iOS storage eviction (e.g. after a period of inactivity) may delete the IndexedDB key or the localStorage data separately, leaving undecryptable data (same symptom as 1.1) | Device test on iOS Safari as an installed PWA |
| H2 | Clearing "cookies and site data" in some browsers may remove only one of localStorage and IndexedDB | Manual browser matrix |
| H3 | Phone-vs-watch clock skew of minutes to hours may misassign nights | Needs a real SDK (`wearable-sdk-requirements.md`) |
| H4 | The pattern false-positive rate under realistic logging (more selective than 60% random) is higher than 27% | Extend the 5.2 simulation with logging that depends on symptoms |
| H5 | Private browsing: keys may be lost at the end of the session while the user believes data is saved | Browser test |

## Proposed order of fixes (not applied)
1. **Data integrity:** 1.1, 1.2, 1.3, 1.4. A serialised, versioned, generation-checked repo, plus a reset path.
2. **Misleading output:** 2.1, 2.2, 2.3, 4.1–4.3, 5.1–5.3. Some need thresholds, which must come from evidence or be clearly labelled placeholders.
3. **Sensor quality:** 3.1–3.3.
4. **Evaluation fidelity:** 6.1–6.4.

## Files in this package
- `audit/audit_probes.mjs`, `audit/audit_probes2.mjs`: the Node probes (pass the path to the source tree).
- `audit/crosstab.cjs`: the real-browser two-tab test.
- `audit/probes.out`: the raw output of the run reported here.
