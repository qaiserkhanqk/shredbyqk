# Cycle tracking (prototype)

> **Status: prototype, off by default, synthetic data only.** Not clinically validated. Not a medical device.
> Not contraception, not pregnancy detection, not a diagnosis of any condition (including PCOS).
> Do not ingest real client data until the privacy, security and clinical reviews in [Open items](#open-items-and-blockers) are done.

## Contents
1. [What was built](#what-was-built)
2. [Turning it on (feature flags)](#feature-flags)
3. [Core experience](#core-experience)
4. [Next-period estimate: the algorithm](#next-period-estimate-the-algorithm)
5. [Personal patterns](#personal-patterns)
6. [Phases and temperature](#phases-and-temperature)
7. [Wearables](#wearables)
8. [Reminders](#reminders)
9. [Data flow](#data-flow)
10. [Privacy and safety controls](#privacy-and-safety-controls)
11. [Assumptions](#assumptions)
12. [Tests and evaluation](#tests-and-evaluation)
13. [Limitations](#limitations)
14. [Open items and blockers](#open-items-and-blockers)

Related: [audit and fix status](docs/cycle-audit-9f87b83.md) · [validation plan](docs/cycle-validation-plan.md) · [evidence register](docs/cycle-evidence-register.md) · [wearable SDK requirements](docs/wearable-sdk-requirements.md) · [synthetic evaluation report](docs/cycle-eval-synthetic.md)

## What was built

It uses the existing stack: a static PWA with vanilla ES modules, no build step and no new dependencies. All logic is pure and runs in Node for tests.

| File | Job |
|---|---|
| `js/cycle/dates.js` | Local calendar-date maths (DST- and travel-safe), time-zone helpers |
| `js/cycle/flags.js` | Feature flags, all default **off** |
| `js/cycle/model.js` | Data model: consent, periods, spotting, day logs, symptom categories, confirmation prompts, cycles, `stateAsOf` (no-leakage view) |
| `js/cycle/predict.js` | Dates-only next-period estimate with explicit states |
| `js/cycle/patterns.js` | Explainable personal patterns; experimental check-in forecast |
| `js/cycle/phase.js` | Optional phase education with "not enough data" and unsupported situations |
| `js/cycle/reminders.js` | Reminder scheduling: quiet hours, pause, delete, "why", neutral lock-screen text |
| `js/cycle/wearables.js` | Adapter contract, normalisation, nightly summaries, mock device, SWL DS07 placeholder |
| `js/cycle/tempshift.js` | **Research only:** retrospective temperature-rise detector |
| `js/cycle/store.js` | Encrypted per-user repository: AES-GCM, consent, export, delete; serialised and versioned across tabs |
| `js/cycle/nudges.js` | Low-effort mode logic: wearable-timed questions and one-tap suggestions (no screen yet) |
| `js/cycle/eval.js`, `tools/cycle-eval.mjs` | Reproducible evaluation harness (synthetic cohort) |
| `js/cycle/ui.js` | The Cycle screen (Body → Cycle tracking) |
| `tests/cycle.test.mjs`, `tests/cycle-integration.test.mjs` | Unit and integration tests; cycle steps added to `tests/e2e.cjs` |

Existing features were not changed. Changes to shared files are small:
- `index.html`: one Body tile, one screen and a flag checkbox in Diagnostics.
- `js/app.js`: imports, the tab mapping and the flag wiring.
- `css/styles.css`: appended rules.
- `sw.js`: new files cached and the cache version bumped.
- `package.json`: the new test suites and the eval script.

## Feature flags

| Flag | Default | What it controls |
|---|---|---|
| `cycleTracking` | off | The whole feature. Toggle: You → App health & diagnostics → "Cycle tracking prototype". |
| `phaseEducation` | off | Phase card (settings inside the Cycle screen) |
| `symptomForecast` | off | Experimental "you may want to check in about X" suggestions |
| `temperatureResearch` | off | Retrospective temperature-rise display. Never feeds the period estimate. |
| `quickSuggestions` | off | Low-effort mode: one-tap pre-filled answers from the person's own patterns. **Logic only, no screen yet.** |
| `sensorPrompts` | off | Low-effort mode: wearable-timed questions. **Logic only, no screen yet.** |

Flags live in `localStorage['shred_flags_v1']` because they are not health data. `main` auto-deploys to GitHub Pages, and the default-off flag means a merge does not expose the feature to real users.

## Core experience

- **Log and edit periods.** You can log a start, an end, any correction and deletions. Overlaps, future dates and an end before the start are refused. Editing replaces the wrong value.
- **Spotting is separate from bleeding.** Spotting is a day entry and never starts a cycle.
- **Missing means unknown.** A day without an entry is never treated as "no bleeding" or "no symptom". "Not yet" in the check-in records an explicit "no bleeding" only for that day.
- **The app asks; it never assumes.**
  - If you log period-type bleeding outside a logged period, it asks "Did a period start?".
  - Inside your estimated range (or once it has passed), it asks "Has your period started?" with Yes / Spotting only / Not yet / Ask later.
  - It asks "Has your period ended?" for the latest period, from 7 to 20 days after its start.
  - It never invents an end date.
- **A watch does not detect bleeding.** Wearable data never creates, ends or edits a period.
- **Optional symptoms.** Pain, energy, mood, cravings and sleep are each off until switched on, and each has a one-line explanation. Turning one off stops collection and asks whether to delete past entries. Mood is self-reported only; nothing is inferred from sensors.
- **History.** You can see and edit periods, cycle lengths (marked as used or not used), and day logs per cycle, including the current one.

## Next-period estimate: the algorithm

`predict.js`, version `dates-only-1.0.0`. It uses **only the user's own confirmed period starts**.

1. **Pick the cycles.** A cycle runs from one logged start to the next. It is usable unless:
   - the user marked "missed a log before this", or
   - its length is outside 15–90 days and the user hasn't confirmed it. Such cycles are kept and shown, but marked "check this".
2. **Take the recent ones.** Use the last ≤ 6 usable cycles. The **typical length** is their median.
3. **Range** = last start + shortest … last start + longest.
4. **States:**

| State | When | Shown |
|---|---|---|
| `none` | 0 usable cycles | "Not enough data yet". No range. |
| `early` | 1–2 usable cycles | Range padded ±2 days, with an explanation |
| `estimate` | ≥ 3 cycles, spread ≤ 9 days | Range |
| `variable` | spread 10–20 days | Wide range, labelled variable |
| `too_variable` | spread > 20 days | **No range.** A check-in is offered instead. |
| `stale` | last start more than 2× the longest cycle (minimum 18 days) ago | No estimate from old data |
| `paused` | user said pregnant | Estimates and period check-ins paused |

No 28-day default and no ovulation day are ever used. Wearable data is not an input.

The range describes the person's own recent history. It is **not** a statistical confidence interval, has not been validated, and is not a guarantee. The UI says so, and "Why this estimate?" lists the cycles used and the ones left out, with reasons.

All the parameters (`PARAMS` in `predict.js`) are placeholders chosen for clarity, not fitted to data.

## Personal patterns

`patterns.js` reports a pattern for a symptom at cycle days *from–to* only when **all** of these hold:
- It uses only **complete, usable** cycles (the last ≤ 6).
- A cycle counts only if that symptom was **actually logged** in the window. Unlogged cycles are excluded, never counted as "didn't happen".
- At least 3 observed cycles had the notable value, and that is at least 75% of observed cycles.
- The notable value was **not common at other times** (under 50% of other logged days).

The text is in the past tense and shows its working: *"You logged lower energy around cycle days 24–25 in 3 of your last 4 recorded cycles…"*, followed by how many cycles, how many logged days, and how often it occurred outside the window. Merged ranges are trimmed back to the days actually recorded.

If there isn't enough data, the app says so ("we need 3 complete cycles with energy logs; you have 1"). If the pattern is inconsistent, it says "no consistent pattern". In both cases it offers a check-in reminder, never a prediction. Insights can be dismissed and categories disabled.

The **experimental forecast** (`symptomForecast`, off) only suggests a check-in on days a found pattern covers. It stays off until prospective testing shows it beats each person's own simple baseline (see the evaluation).

## Phases and temperature

`phase.js` (`phaseEducation`, off) shows:
- **Menstruation (observed)** on days the user logged a period, explained as the first part of the follicular phase.
- **"Possibly after ovulation (estimate)"** only if the research temperature flag is on **and** a retrospective rise was found in this cycle. It comes with the caveat "not proof, only visible afterwards".
- Otherwise **"Not enough data"**. Dates alone can't show when ovulation happens, so there is no day-14 rule and no counting back.
- **Nothing at all** when the user reports hormonal contraception, pregnancy, postpartum or breastfeeding, perimenopause, or another condition.

No phase is ever labelled "confirmed", and no training or nutrition prescription is attached to a phase. The card also explains that the four-phase model is a simplification.

`tempshift.js` (`temperatureResearch`, off) is a three-over-six style rule on nightly wrist skin temperature:
- It flags three consecutive valid nights above the highest of the previous six, with a mean rise ≥ 0.15 °C (placeholder).
- It is **retrospective by construction**: it can only be confirmed on the third high night.
- It uses one device and firmware segment only. Nights that are not `ok`, nights with a time-zone change, and days marked unwell or travelling are excluded.
- The output says "may be consistent with a past ovulation; not proof".
- **Next-period forecasting, retrospective shift and ovulation are kept separate.** The shift is never used for the app's estimate; the sensor-assisted period model exists **only in the evaluation harness**.

## Wearables

See [docs/wearable-sdk-requirements.md](docs/wearable-sdk-requirements.md).

- **Adapter contract** (`WearableAdapter`): capabilities, connect/disconnect, and `fetchPackets()` returning timestamped packets with device ID, model, firmware, metric, value, unit, UTC times, time-zone offset, and raw-vs-vendor-derived.
- **`MockWearable`**: seeded **synthetic** data with missing nights, short nights, duplicate packets, glitches, °F firmware, device and firmware changes, and travel. The UI labels it "synthetic demo, not your measurements".
- **`SwlDs07Adapter`**: a placeholder that **refuses to connect** (`NOT_VERIFIED`). We have no SDK or documentation confirming overnight sampling, timestamps, units, firmware reporting or data access. **The DS07 integration does not work and is not claimed to.**
- **Normalisation:**
  - exact duplicates are dropped;
  - same-timestamp conflicts keep the first value and are flagged;
  - °F is converted to °C, keeping the original value and unit;
  - non-finite, out-of-range, off-wrist and future or inverted timestamps are flagged and excluded.
- **Nightly summaries** per night × device × firmware × metric: median, sample count, rejected count, coverage, first/last time and flags. A night is `ok` only with ≥ 6 samples and ≥ 180 min coverage. Otherwise it is `insufficient_wear` and has **no value**.
- **Missing nights are shown as "No data". Nothing is interpolated.**
- **Flags:** time-zone change (travel), device change and firmware change. Analyses never mix device or firmware segments.
- **Labels:** wrist skin temperature is labelled "not core body temperature". Heart-rate variability is labelled vendor-derived.
- **Data minimisation:** only nightly summaries are stored; raw samples are discarded.

## Low-effort mode (logic and tests only; no screen yet)

`js/cycle/nudges.js`. The aim is less typing without the app recording anything on its own. **Nothing here writes data.**

- **"Has your period started?" timed by the wearable.** The question is asked when last night's wrist skin temperature is ≥ 0.2 °C below the mean of the previous 5 valid nights, from cycle day 15 onwards, and not within 10 days of a logged period.
  - Only the person's "Yes" records a period, marked `source: 'sensor_prompt'`.
  - It is off for pregnancy and hormonal contraception.
  - It needs wearable consent.
  - Nights that are missing, flagged, from a device change, or marked unwell or travelling are ignored.
- **"How are you feeling?" timed by HRV.** Asked when last night's HRV is ≥ 20% below the person's own median of up to 14 nights (7 needed).
  - The text never names or guesses a mood, and says that training, sleep, alcohol, illness and stress also cause this.
- **One-tap suggestions.** "Energy: around this time you logged 'lower than usual' in 4 of 4 cycles. Same today?"
  - These come only from a found personal pattern.
  - "Yes" saves with `source: 'suggestion'`; "No" saves nothing.
- **Every entry records where it came from:** `typed`, `suggestion`, `range_prompt` or `sensor_prompt`.
  - Pattern evidence states how many entries were accepted suggestions, which guards against self-reinforcing patterns.
- **Why it isn't switched on:** all thresholds are placeholders. The audit (`docs/cycle-audit-9f87b83.md`) found weaknesses these rules inherit: the night-coverage rule (3.1–3.2) and pattern false positives (5.1–5.3). Fix those first.
- **The synthetic evaluation** compares this prompt with a dates-only range prompt. See `docs/cycle-eval-synthetic.md`; it is synthetic, so the wearable prompt looks good **by construction**.

## Reminders

`reminders.js`. Optional, and they need their own consent.

- **Kinds:** daily log, weekly check-in, "when my estimated range begins" (with an offset of 0–7 days; it waits if there is no range and is paused in pregnancy), and pattern check-ins created from an insight.
- **The user controls:** the time, quiet hours (which may cross midnight; reminders inside them **move** to the end of the quiet period), pausing one reminder or all of them, deleting, and turning reminders off (which deletes them all).
- **"Why am I seeing this?"** appears on every reminder, e.g. "Your estimated range starts on 13 Nov. You asked for a check-in 1 day before…".
- **Lock-screen text is neutral by default:** "Shred by QK: You have a check-in." The opt-in detail mode still never includes symptom values or dates.
- **Time zone:** reminder times are wall-clock in the phone's current zone.
- **Delivery:**
  - There is an in-app "Check-ins due" card.
  - If the user allows notifications, a local notification is shown **only while the app is open**.
  - There is no push server, so nothing arrives while the app is closed (see blockers).
  - **No SMS. No sharing** with partners, coaches, advertisers or anyone else.

## Data flow

```
User input ──► model.js (validation, consent checks, codes-only errors)
                 │
Mock adapter ──► wearables.normalise ──► summariseNights ──┐
(DS07: refuses)                                            ▼
                         store.js  repo.update(fn)  ── atomic ──► AES-GCM-256 encrypt (AAD = user ID)
                                                                   │
                         localStorage['shred_cycle_v1:<uid>'] ◄────┘   key: non-extractable CryptoKey in IndexedDB
                                │
                     repo.read() ──► predict / patterns / phase / reminders / tempshift (pure) ──► ui.js
                                │
                    export (user-initiated JSON download)   ·   deleteAll (record + key destroyed)

Nothing flows to: the main store shred_qk_v1, window.__shred, the session recorder, the error log text,
the coach voice / TTS endpoint, analytics (none exist), AI prompts (none exist) or any network request.
```

## Privacy and safety controls

| Control | Where |
|---|---|
| Informed consent before any write. Per-category opt-in. Separate consent for wearable and reminders. Consent log is visible in settings. | `model.js`, consent screen |
| Withdrawing wearable or reminder consent deletes that data. Turning off a category offers to delete its entries. | `model.js` |
| Minimum data: symptom categories off by default; only nightly wearable summaries kept | model, wearables |
| Encryption at rest (AES-GCM-256, random IV, non-extractable key). **No plaintext fallback:** if WebCrypto is missing, the feature refuses to store anything. | `store.js` |
| Per-user isolation: separate slot and key per user, user ID bound as AAD, owner check on read and write | `store.js`, integration tests |
| Multi-tab safety: operations queued in each tab and locked across tabs (Web Locks); every save re-reads the latest stored version (no lost updates); revision and generation are bound into the AAD | `store.js`, integration and e2e tests |
| Deletion can't be undone by another tab or a pending save: a generation counter is bumped first; stale tabs are refused (`STALE_SESSION`) and clear themselves; records from an older generation are discarded unread | `store.js`, `ui.js` (storage events) |
| Recovery: unreadable data shows a "Reset cycle data on this device" button | `resetCycleStorage`, e2e |
| Tampered ciphertext rejected (GCM authentication) | integration tests |
| Export everything (JSON, with a "keep this private" note) | `repo.exportData()` |
| Delete everything, including destroying the key, so old ciphertext copies become unreadable | `repo.deleteAll()` |
| Errors carry codes only (`cycle:OVERLAP`), so the existing error log never captures health data | `CycleError` |
| No cycle content to TTS, analytics, AI prompts, session exports or `window.__shred` | `ui.js`; e2e asserts the main store and error log are clean |
| Neutral notification text by default | `reminders.js` |
| In transit: there is no network transfer of cycle data. The app is served over HTTPS (GitHub Pages). | n/a |

**Backup limitations (also shown in the app):**
- Deletion can't reach files the user exported, or device or browser backups made before deletion. Those hold ciphertext, but a backup may also hold the IndexedDB key.
- Clearing site data in the browser also deletes the key, which makes stored data unrecoverable. That is intended.
- The service-worker cache holds app code only, never user data.

**Threat model in one line:** a random ID identifies the **browser profile**, not a person, so anyone using the same profile is the "same user". Real per-person isolation needs login plus server-side authorisation (not built).

**What the encryption does *not* protect against:** malware on the device, someone using the unlocked phone, or a malicious script running on the same origin. It is not a substitute for server-side access control once a backend exists.

## Assumptions

1. **Single user per device.** "Per-user" is enforced in the storage layer (and tested with two users), but the app has no accounts. `localUserId()` is a random ID per browser.
2. **Local calendar dates are the source of truth** for logs. Day maths runs on dates, not timestamps, so DST and travel don't move entries. Reminder times follow the device's current zone.
3. **The first day of period-type bleeding is cycle day 1.** Spotting is not.
4. **The thresholds are placeholders:** 15/90-day plausibility, 9/20-day variability, ±2 early padding, the pattern rules (3 cycles, 75%, under 50% outside) and the temperature rule (6/3/0.15 °C). They are documented, versioned and not fitted. They must be reviewed by a clinician and pre-registered before any study.
5. **The wearable contract** is our assumption of what a real SDK must provide. It is not based on any vendor's documentation.
6. **The synthetic generator's physiology is invented** for software testing only.

## Tests and evaluation

```bash
npm test
```

This runs all existing suites (296 checks in total) plus the cycle suites: `tests/cycle.test.mjs` (103 checks), `tests/cycle-integration.test.mjs` (46 checks, including deletion and multi-tab regressions with and without a cross-tab lock) and `tests/cycle-nudges.test.mjs` (33 checks).

```bash
npm run test:e2e
```

This runs the browser flow (53 checks), including 21 cycle checks, with two real tabs.

```bash
npm run eval:cycle
```

This writes the synthetic evaluation report; the current output is in `docs/cycle-eval-synthetic.md`.

The tests cover:
- irregular and long cycles
- missing, corrected, implausible and missed-log entries
- spotting and the confirmation prompts
- sparse history and stale history
- time zones, DST and travel
- consent changes and withdrawal
- notifications: neutral text, quiet hours across midnight, pause, delete, delivered once, waiting without a range, pregnancy pause
- missing, bad, duplicate, °F, conflicting and future sensor readings
- missing wear, device and firmware changes, illness exclusion
- the DS07 refusal
- export and deletion (including key destruction)
- cross-user isolation (separate slots, AAD binding, owner reassignment, tampering)
- the no-WebCrypto refusal
- leakage
- feature flags

**Evaluation harness** (`js/cycle/eval.js`):
- **Frozen config:** cohort, seed, device model and firmware, algorithm versions and parameters.
- **Participant-separated split:** a hash-based development/test split. Nothing is fitted, and only test participants are scored.
- **Walk-forward predictions:** one every day of every scored cycle, using only data before that day.
- **Built-in leakage self-check:** future data is scrambled, and the output must be identical.

It reports:
- period-start error (MAE), the share within ±1/2/3 days, range coverage and width, lead time and the no-prediction rate, broken down by lead-time bucket and by regular, variable and long cycles;
- a **separate** temperature-rise vs synthetic-ovulation endpoint;
- symptom-forecast precision, recall and false alerts per cycle against two personal baselines.

**Every number it produces is synthetic.** The sensor candidate looks better there *by construction*, because the generator puts a temperature step before each period. That shows the harness works and says nothing about real devices. **Do not quote any of it as accuracy.**

## Limitations

- **Not validated** on real people. Every range and pattern is an unvalidated description of the user's own logs.
- **Cycle-day alignment is coarse for variable cycles.** Patterns are aligned from day 1, so pre-period symptoms in variable cycles may be missed.
- **Reminders can't arrive while the app is closed.**
- **The UI is functional rather than polished,** and has not been through an accessibility audit.
- **Some phrasing still needs review:** the "Not yet" check-in, the "usual range has passed" message and the consent copy need clinical, legal and plain-language review.

## Open items and blockers

| Item | Status | Needed |
|---|---|---|
| SWL DS07 integration | **Blocked.** No SDK or documentation. | Vendor SDK and documentation, plus the checks in `docs/wearable-sdk-requirements.md` |
| Background reminders | **Blocked.** No push server. | A Web Push backend (VAPID) with neutral payloads, or a native wrapper. Needs your approval (new infrastructure and data flow). |
| Real per-user access control and multi-device sync | **Not built.** Device-local only. | Backend with authentication, server-side authorisation, encryption and a DPIA. Needs your approval. |
| Privacy review / DPIA, lawful basis (GDPR Art. 9 explicit consent), retention policy, privacy notice | **Not done** | DPO or legal |
| Clinical review of the copy, thresholds and the phase education | **Not done** | Clinician sign-off |
| Regulatory assessment (medical-device software qualification) | **Not done** | Regulatory advice before any claim beyond logging |
| Real-world evaluation | **Not started** | [Validation plan](docs/cycle-validation-plan.md) |
| Deployment | **Not done.** Pushed to a feature branch only. Merging to `main` deploys the app, but the feature stays off by flag. | Your approval |
