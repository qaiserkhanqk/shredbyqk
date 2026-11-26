# Fix: band-adjusted estimate kept showing after band data went stale

Research flag `temperatureEstimate` (default OFF). Synthetic data only. Scope kept narrow: the cycle algorithm
(`predict.js`, `tempshift.js`), manual logging and the wearable default are unchanged.

## The report

Last usable overnight temperature: the night of 12 Apr. On 19 May the card still showed the 23 Apr band-adjusted date.
`adjustedEstimate()` already returned `overdue: true`, but the card never displayed it.

Reproduced first: `node tests/cycle-adjust-freshness.test.mjs` against the old code failed 17 of 26 checks (the boundary block stopped early, so fewer checks ran)
(`docs/test-logs/cycle-adjust-freshness-before-fix.log`).

## What changed (`js/cycle/adjust.js`, band-adjusted 0.2.0 → 0.3.0)

1. **Freshness is measured from the last usable night, by when it was recorded.** `lastUsableNight(s, asOf)` returns the
   newest night label of a skin-temperature summary that passes the same checks the temperature rule already uses
   (status `ok` with a value, no time-zone change, not marked disturbed by her, labelled before tomorrow). `syncedAt`,
   `connectedAt` and resends play no part, so late arrivals of old nights, duplicates and failed nights cannot make the
   data look fresh.
2. **Stale data is not used.** If there is no usable night, or it is more than `FRESHNESS.MAX_NIGHTS_SINCE_USABLE` (7)
   nights before today, the result is `not_adjusted` with reason `band_stale`: "No recent usable band data. This
   estimate is based on your logged periods." The dates-only estimate is shown as the fallback. If there aren't enough
   logged periods: "No recent usable band data, and there aren't enough logged periods yet for an estimate." No date.
3. **Recovery** needs new usable nights; after that, the existing eligibility rules decide, unchanged. A sync that brings
   only unusable nights changes nothing.
4. **Always shows the last usable reading.** Every result has `lastUsableNight` and `lastUsableText`; the card shows it
   (`#cyAdjustedLastNight`) whenever band data exists.
5. **Overdue is shown, not hidden or rolled forward.** A band-adjusted date that has passed with no new period is still
   shown, the card is marked "overdue" and asks her to log her period or confirm it hasn't started (`#cyAdjustedOverdue`).
   A passed dates-only fallback says the same.

## The freshness rule

`MAX_NIGHTS_SINCE_USABLE = 7`: the night labelled today−7 is still recent; today−8 is stale. **Provisional engineering
setting, not a clinical threshold**; configurable (`adjustedEstimate(s, today, { freshness })`). It must be validated
with the actual band before a pilot (`docs/cycle-evidence-register.md`).

## Note for the synthetic evaluation

`js/cycle/eval.js` calls `adjustedEstimate()`, so the sensor candidate now also abstains on stale data. The published
numbers in `docs/cycle-eval-synthetic.md` were produced with 0.2.0 and were not re-run as part of this fix.

## Tests (2026-11-26, this Mac, headless Chromium via Playwright)

| Command | Result | Log |
|---|---|---|
| `node tests/cycle-adjust-freshness.test.mjs` before the fix | 17 of 26 FAILED (reproduces the report) | `docs/test-logs/cycle-adjust-freshness-before-fix.log` |
| `node tests/cycle-ui-adjust.cjs` with the old `adjust.js`/`ui.js` | 6 of 16 FAILED (the new card checks) | `docs/test-logs/cycle-ui-adjust-before-fix.log` |
| `npm test` (includes the new freshness test, 28/28) | passed, 711 ok, 0 failed | `docs/test-logs/bandfix-npm-test.log` |
| `npm run research:test` | passed, 510 ok, 0 failed | `docs/test-logs/bandfix-research-test.log` |
| `npm run test:e2e` (11 suites; card test 16/16) | passed, 243 ok, 0 failed | `docs/test-logs/bandfix-test-e2e.log` |
| `npm run research:e2e` (4 suites) | passed, 65 ok, 0 failed | `docs/test-logs/bandfix-research-e2e.log` |

Not run: Firefox/WebKit browser variants, the synthetic evaluation (`npm run eval:cycle`), and the real iPhone runner.
