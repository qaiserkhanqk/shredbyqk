# Fixes for 3 issues reported against f67000b (research prototype and js/cycle app)

## Method
- **Failing tests first.** Regression tests were written before any fix, run on unchanged `f67000b` and committed with their logs in `893cab0`:
  - `research/tests/regressions-f67000b.test.mjs`: **16 of 23 checks failed** (`research/docs/test-logs/regressions-f67000b-BEFORE-fix.log`).
  - `tests/cycle-regressions-f67000b.test.mjs`: **2 checks failed** (`docs/test-logs/cycle-regressions-f67000b-BEFORE-fix.log`).
- **No test was weakened or changed after the failing run.** Two tests were **added** for code introduced by the fixes:
  - `research/tests/migration.test.mjs` (8 checks): upgrading a database made by `f67000b`;
  - two checks in `research/tests/e2e.cjs` for the new reimport control.
- **Constraints kept.** The research prototype stays separate from the phone app. Synthetic data only. No clinical validation claimed. Nothing merged or deployed.

## Issues
| # | Failing test on f67000b (actual result) | Fix | Changed lines (after the fix) | Result |
|---|---|---|---|---|
| 1 | Withdrawing LH or hormonal consent left records whose type was spelled `" lh_test "`, `"LH_TEST"`, `"\tlh_test\n"`, `" hormonal_medication "` or `"Hormonal_Medication"` in quarantine and exports (the purge matched the raw type exactly). Without consent, `LH_TEST`, ` Lh-Test ` and `HORMONAL_MEDICATION` were not recognised as LH or hormonal content, so their cells were kept in the saved preview, quarantine and export. | **One canonical annotation type,** `canonicalType()`: trimmed, lower-case, spaces and hyphens folded to `_`. **Where it is used:** validation, consent checks, quarantine records and purges. **Where it is stored:** annotations and quarantine rows carry a `canonical_type` column, and the withdrawal purge deletes by that column. **At commit,** the transaction derives the canonical type to decide whether quarantined cells may be stored. **Rows without consent** keep only their line number and reasons (no cells, and no type). **Existing databases** get the column filled from the stored type. | `research/lib/ingest.js` 93–98, 105, 115, 158–161, 173; `research/server/store.js` 27, 29, 46–76, 147–153, 191–196 | **Pass**: after each withdrawal no LH or hormonal value remains in quarantine, annotations, previews or the export, whatever the spelling; the other scope's data and the bleeding entry are kept; unconsented rows are recognised and kept as reasons only |
| 2 | Re-uploading a file whose LH row had been rejected for missing consent was marked a duplicate even after consent was granted; there was no way to revalidate it | **Explicit, audited reimport:** `imports/preview` accepts `reimport: true` with a required `reason` code (400 without one). **Revalidation:** every row is checked again under **current** consent, and rows already stored are still skipped as duplicates. **Audit:** the preview is recorded as `import_reimport_previewed` and the commit as `import_committed`, both with `reimport: true` and the reason. **Storage:** the commit is a new batch row (`attempt` + 1, `reimport_reason`), leaving the original batch unchanged; the schema moves to version 2 with an in-place migration. **No automatic behaviour:** a plain re-upload still says duplicate (with `reimportAvailable: true`), and granting consent again never restores deleted data. **Dashboard:** a "Reimport under current consent" control with a reason, offered only after a duplicate. Participant accounts cannot import or reimport. | `research/lib/ingest.js` 126, 132–135, 177; `research/server/store.js` 9, 21–23, 46–76, 180–188; `research/server/server.js` 133–149; `research/web/app.js` 157–172 | **Pass**: reimport needs a reason; LH row accepted after consent; audited; separate marked batch; deleted data not restored on re-grant, only by explicit reimport; participant 403; unchanged file adds nothing |
| 3 | `SHIFT_VERSION` was still `three-over-six-skin-0.1.0-research` after the one-observation-per-night change | Bumped to `three-over-six-skin-0.2.0-night-aggregated-research`, with a comment saying what changed. The app's evaluation report, which records this version, was regenerated: only its version line changed, and all results are identical. | `js/cycle/tempshift.js` 21–23; `docs/cycle-eval-synthetic.md` line 5 | **Pass** |

## Results (2026-11-18, Node 22.23.4, Playwright 1.63.0 / Chromium 153, Linux)
| Command | Result |
|---|---|
| `node research/tests/regressions-f67000b.test.mjs` | before: 16 of 23 FAILED → after: **ALL PASS (23)** |
| `node tests/cycle-regressions-f67000b.test.mjs` | before: 2 FAILED → after: **ALL PASS** |
| `node research/tests/migration.test.mjs` (new) | **ALL PASS (8)** |
| `npm test` (18 app suites, including every earlier cycle regression suite) | **exit 0, 452 ok, 0 FAIL** |
| `npm run research:test` (ingest 71, analysis 51, extensions 15, API 52, b3d9589 regressions 33, f67000b regressions 23, migration 8) | **exit 0, 253 checks, 0 FAIL** |
| `npm run test:e2e` (app browser suites) | **exit 0, 86 ok** |
| `npm run research:e2e` (research dashboard, including the reimport control) | **exit 0, 26 ok** |
| `npm run eval:cycle` | Regenerated; version line only, results identical |

Logs: `research/docs/test-logs/*f67000b*`, `docs/test-logs/*f67000b*`.

## Remaining limitations
- **Canonical spellings.** The canonical form covers spacing, case and hyphen variants. A different word for the same thing (for example "ovulation test" instead of `lh_test`) is still `type_invalid`. Its cells are kept in quarantine like any unrecognised row and are **not** caught by an LH withdrawal. A synonym list would need agreeing with the study team.
- **Reimport needs the original file.** Rows rejected for missing consent were never retained, so they can only come back by reimporting the file. There is no revalidation directly from quarantine for those rows (by design: nothing was stored). Rows quarantined for other reasons keep their cells but are not automatically revalidated either.
- **Reimport reasons** are a short code, not free text, so no health content can enter the audit trail. The dashboard offers three reasons, and the API accepts any code matching `[a-z0-9_]{3,60}`.
- **Consent withdrawal** still keeps core-consent data already collected (a study-protocol decision), and cannot reach exports already downloaded or backups.
- **Migration** was tested on a database created by the exact `f67000b` store code. It has not been tested on large databases or with other processes holding the file open.

## Still untested
- Concurrent reimport and consent withdrawal from two processes on one database file.
- Safari, Firefox and real phones.
- Real device data.
- Any clinical accuracy.
