# Fixes for 8 issues reported against b3d9589 (research prototype and js/cycle app)

## Method
- **Failing tests first.** Regression tests were written before any fix, run on unchanged `b3d9589`, and committed with their logs in `07447d1`:
  - `research/tests/regressions-b3d9589.test.mjs` (issues 1, 2, 5, 6, 7, 8): **27 of 33 checks failed** (`research/docs/test-logs/regressions-b3d9589-BEFORE-fix.log`);
  - `tests/cycle-regressions-b3d9589.test.mjs` (issues 3, 4): **9 checks failed** (`docs/test-logs/cycle-regressions-b3d9589-BEFORE-fix.log`).
- **Scope.** The research engine does not replace the app; the two remain separate. No clinical validation is claimed. Synthetic data only. Nothing merged or deployed.

## Test changes after the failing run (stated openly)
- **Three issue-2 checks were made more precise, not weaker.** They used the unquoted pattern `lh_test`, which also matches:
  - the reason code `lh_tests_not_consented`, which another check in the same file requires to be kept;
  - the consent-log scope name `lh_tests`.

  So they could never pass. They now match the stored data value (`"lh_test"`, `"hormonal_medication"`), and two also check that `"positive"` is absent.
- **The corrected checks still fail on unchanged `b3d9589`:** 27 of 33 fail, as before (`research/docs/test-logs/regressions-b3d9589-BEFORE-fix-corrected-pattern.log`).
- **No other test was changed.**
- **One defect in my own fix** was caught by an older test (`analysis.test.mjs` calls `placeNight` on a reading without a device block). It was fixed in the code (`quality.js:37`), and the test was not changed.

## Issues
| # | Failing test on b3d9589 (actual result) | Fix | Changed lines (after the fix) | Result |
|---|---|---|---|---|
| 1 | A participant could read `/runs` (stored experimental shift and forecast outputs) and their `/export` contained `"layer":"estimate"` and verbatim quarantine rows, although `/analysis` hid them and `/quarantine` refused them | `/runs` is researcher-only. Participant exports omit quarantine and experimental runs, and say so (`notIncluded`). A central `forParticipant()` filter runs on **every** JSON payload for a participant session: it replaces any object with `layer: estimate/forecast` and drops `verbatimSource`, so no alternate endpoint can leak them. A participant viewing `/analysis` no longer triggers stored experimental runs. | `research/server/server.js` 52, 72–75, 152, 157–159, 177–178, 204, 221–229 | **Pass**: `/runs` 403; export clean; historical `/analysis?asOf=` clean; the researcher still sees everything |
| 2 | (a) A commit after core consent was withdrawn **succeeded** (18 rows stored), and the preview survived the withdrawal. (b) Unconsented LH and hormonal rows were kept verbatim in the saved preview, quarantine and exports. (c) Withdrawing LH consent left the LH results stored and exported. (d) `commitImport` did not recheck consent. | **Inside the commit transaction:** consent is re-read; missing core consent, or LH/hormonal entries without their scope, throw `ConsentError` (HTTP 409); unconsented quarantine cells are never written. **Any withdrawal**, in one transaction, deletes all pending previews; withdrawing `lh_tests` or `hormonal_context` also deletes stored annotations of that type and their quarantined rows. **Ingest:** a row rejected for missing LH or hormonal consent keeps only its line number and reason codes (`raw: null`, `redacted: content_not_retained_without_consent`). | `research/server/store.js` 37–41, 105–125, 141–159; `research/lib/ingest.js` 146–153; `server.js` 115, 142 | **Pass**: commit refused (409) with nothing stored; no preview left; no LH/hormonal content in preview, quarantine, database or export; the store-level recheck works without the server |
| 3 | A corrected sleep session whose derived night label changed became a **second** record (`2026-10-31=34.05` and `2026-11-01=33.9`); the "after" view showed both | `mergeNights` matches records by **source-session identity**: `sessionKey` = session ID + device + model + firmware + metric + kind. The derived night is not part of it; it is used only for legacy records with no session ID. A correction replaces the current record, and the earlier version goes to `prior` (version history). | `js/cycle/wearables.js` 182–188 | **Pass**: one record; current = corrected; `prior` = original; as-known-before and after views each show one version; identical resync changes nothing |
| 4 | Three sessions on one night counted as three confirmation nights (`detected: true`, `nightsUsed: 9`); a 2-night baseline split into 6 sessions satisfied the 6-night baseline | `retrospectiveShift` aggregates to **one eligible observation per biological night** (the eligible session with the most coverage, then earliest start, then session ID: deterministic). The others are counted in `excluded.sameNightSessions`. Baseline and confirmation windows are therefore distinct nights. | `js/cycle/tempshift.js` 28–46 | **Pass**: not detected with 7 distinct nights; 2-night baseline rejected; the control (6 + 3 distinct nights) is still detected; a duplicate shorter session changes nothing |
| 5 | A daytime sleep session 08:00–16:00 was split at noon into two nights (`2026-02-09:8`, `2026-02-10:8`); a session with a mid-session time-zone change was split too | **Whole-session label:** `sessionLabels()` gives every sample of a source session (session ID within a device serial) one label: the local date of (session start − 12 h). The start is the session's earliest sample and "local" uses that sample's UTC offset. A later offset change inside the session does not move the label; it is flagged `utc_offset_changed_within_night`. This is documented in the code and the algorithm card. | `research/lib/quality.js` 29–55, 63–65 | **Pass**: one label for the noon-crossing session and for the travel session |
| 6 | The same serial and firmware with a **different model** and a +0.6 °C level offset was reported as `shift_detected` (one segment); quality did not flag the transition; provenance listed no streams | One canonical identity, `streamId` (serial, **model**, firmware, site, kind, derivation, aggregation), is used by quality grouping, transition flags (a model change is a device change), inference segments (`segKey = streamId(r.stream)`), the dashboard timeline and provenance (`provenance.streams`). | `quality.js` 1–3, 14–17, 78, 144; `research/lib/inference.js` 20–22; `research/lib/pipeline.js` 36, 43; `research/web/app.js` 91, 94 | **Pass**: transition flagged; 2 segments, no false shift; provenance lists both identities |
| 7 | A correction made **after** the cutoff changed the as-of analysis, yet the input hash stayed the same (`3aaa8707`). An entry ingested in May with `recorded_at` in March appeared in an April-cutoff analysis. | **Observations:** the store returns each observation's full correction history with times (`corrections`), and the pipeline replays exclusion as known at the cutoff. **Annotations:** they carry `ingestedAt` (their batch's commit time), and an entry is used only if **recorded and ingested** before the cutoff (`knownAt`). **Provenance:** it lists `effectiveCorrections` and `streams`; `inputHash` covers observations, known annotations (including ingestion time), corrections and streams. | `research/server/store.js` 161–172; `research/lib/pipeline.js` 1–47; `research/lib/cycles.js` 20, 34–47 | **Pass**: the as-of output is identical before and after a later correction; the hash changes once a correction applies; late-ingested entries are invisible before their ingestion |
| 8 | Self-references (`a` corrects `a`) and circular corrections (in one file and across imports) were **accepted**; malformed stored data made analysis loop until memory ran out | **Ingest:** `self_correction` is rejected. `circular_correction` is detected by following `corrects` links through the file and the stored entries (`existing.entryCorrects`), with a visited set. **Analysis:** `correctionRoot()` walks links with a visited set; entries in, or leading into, a loop are dropped and listed in `observed.malformedAnnotations`. | `research/lib/ingest.js` 107, 155–166; `research/server/store.js` 135; `research/lib/cycles.js` 22–47 | **Pass**: all rejected; malformed stored data finishes well inside 5 s and keeps only the valid entry |

Version strings were bumped where behaviour changed:
- `nightly-quality-1.1.0`
- `sustained-shift-rule-1.1.0`
- `descriptive-trend-1.1.0`
- `segmentation-1.1.0`
- `pipeline-1.1.0`

## Results (2026-11-18, Node 22.23.4, Playwright 1.63.0 / Chromium 153, Linux)
| Command | Result |
|---|---|
| `node research/tests/regressions-b3d9589.test.mjs` | before: 27 of 33 FAILED → after: **ALL PASS (33)** |
| `node tests/cycle-regressions-b3d9589.test.mjs` | before: 9 FAILED → after: **ALL PASS** |
| `npm test` (17 suites: the app, including all earlier cycle regression suites, plus the new one) | **exit 0, 449 ok, 0 FAIL** |
| `npm run research:test` (ingest 71, analysis 51, extensions 15, API 52, regressions 33) | **exit 0, 222 checks, 0 FAIL** |
| `npm run test:e2e` (app browser suites) | **exit 0, 86 ok** |
| `npm run research:e2e` (research dashboard) | **exit 0, 24 ok** |
| `npm run research:eval`, `npm run eval:cycle` | Regenerated; **output unchanged** (the synthetic device changes already used a new serial; no synthetic cycle had two sessions on one night) |

## Remaining limitations
- **Withdrawing core consent** stops imports and clears previews, but keeps data already collected (study-protocol decision; full deletion is separate).
- **Optional-scope withdrawal** deletes LH or hormonal data, but cannot reach exports already downloaded or database backups.
- **Choosing one session per night** keeps the most-covered session. Whether a second session (for example a split sleep) should instead be combined is a clinical/device question, left as a documented data rule.
- **Session labels** use the offset of the session's first sample; this is a labelling convention, not physiology.
- **Annotation knowledge time** uses the batch commit time. Entries imported before this change have it too (it comes from the existing batch table), so no migration was needed.
- **No old-database migration** was needed for the schema. The JSON helpers rely on SQLite's built-in `json_extract`.

## Still untested
- Safari, Firefox and real phones.
- Concurrent consent withdrawal and commit from two processes on one database file. The recheck is inside a `BEGIN IMMEDIATE` transaction, but only single-process tests were run.
- Real device sessions; no vendor session classification has been verified.
- Any clinical accuracy.
