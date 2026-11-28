# ShredbyQK cycle-data research prototype (local, synthetic data only)

> **Research prototype. Not for contraception, diagnosis or medical decisions.**

An independent, research-only platform. It does five things:
- ingests wearable temperature observations and voluntarily logged cycle information;
- checks data quality;
- shows longitudinal patterns;
- produces explicitly **experimental**, uncertainty-aware research estimates;
- does it all on this computer, with **synthetic data only**.

**Not:**
- launch-ready;
- clinically validated;
- an ovulation predictor;
- equivalent to Natural Cycles or any other product.

## What already existed, and how this fits
The repository is the ShredbyQK **static phone app**: plain ES modules with no build step, Node test scripts and Playwright browser tests. It is published to GitHub Pages from `main`.

It already had an **on-device** cycle-tracking prototype (`js/cycle/`, `CYCLE.md`). That prototype is:
- encrypted in the browser and off by default;
- run by one person on their own device;
- without any server.

This research platform is a **separate** sub-project in `research/` and does not touch the phone app. It follows the existing conventions:
- vanilla JavaScript ES modules, no framework and no build step;
- Node built-in modules only (`node:http`, `node:sqlite`, `node:crypto`), with zero new dependencies;
- the same Node/Playwright test style.

The brief's Python, PostgreSQL and React stack was for an empty repository, so it was not used. Storage sits behind `research/server/store.js`, so a PostgreSQL store could replace SQLite later.

> `main` auto-deploys to GitHub Pages. If this branch were merged, the `research/` folder's static files would be published, but they hold no data and do nothing without the local server. Even so, **do not merge without deciding that** (for example, exclude `research/` from Pages).

## Run it
Requires Node 22 (tested on 22.23.4). Playwright and Chromium are needed only for the browser test.

**Demo** (fresh synthetic database, prints a one-time local password):

```bash
npm run research:demo
```

Open http://127.0.0.1:8787/ and sign in as `researcher` with the printed password. The demo has three synthetic participants:
- **A:** regular cycles with a clear synthetic rise;
- **B:** long, irregular cycles, sparse nights and an annotated fever;
- **C:** a device replacement, travel to UTC+9, and no rise.

Experimental analysis is **off** until you tick it on a participant's page.

**Tests:**

```bash
npm run research:test
```

```bash
npm run research:e2e
```

**Synthetic evaluation report** (writes `research/docs/eval-synthetic.md`):

```bash
npm run research:eval
```

**Regenerate fixtures** (deterministic):

```bash
npm run research:fixtures
```

**Your own local instance.** It is encrypted, and two-factor sign-in is required for researchers. The full procedure, including backups, restore and key rotation, is in `docs/security-operations.md`.

```bash
node research/server/cli.mjs generate-key --out ~/research-db.key
```

```bash
export RESEARCH_DB_KEY_FILE=~/research-db.key
```

```bash
RESEARCH_NEW_PASSWORD='choose-a-long-password' node research/server/cli.mjs create-user --role researcher --username me
```

```bash
node research/server/cli.mjs enroll-mfa --username me
```

Add the printed key to an authenticator app, then confirm with a current code:

```bash
RESEARCH_MFA_CODE=123456 node research/server/cli.mjs confirm-mfa --username me
```

```bash
npm run research:start
```

The demo database is encrypted too, with a key that exists only while the demo runs. Two-factor sign-in is not enforced in the demo.

**Settings** (environment variables):
- `RESEARCH_DB` (default `research/data/research.sqlite`, git-ignored)
- `RESEARCH_PORT` (8787)
- `RESEARCH_HOST` (127.0.0.1; other addresses are refused)
- `RESEARCH_SECURE_COOKIES` (1)
- `RESEARCH_TLS_CERT`, `RESEARCH_TLS_KEY` (unset = plain http; both set = HTTPS, needed for Safari). Make them with `node research/server/cli.mjs make-local-cert --dir DIR`, or run `npm run research:demo:https`. See `docs/security-operations.md` ("HTTPS").
- `RESEARCH_SESSION_IDLE_MIN` (30)
- `RESEARCH_SESSION_MAX_HOURS` (8)
- `RESEARCH_DB_KEY_FILE` (required for a database file; `RESEARCH_ALLOW_UNENCRYPTED=1` is unsupported)
- `RESEARCH_REQUIRE_MFA` (1: required for admins and researchers)
- `RESEARCH_BACKUP_KEY_FILE`, `RESEARCH_BACKUP_DIR`, `RESEARCH_BACKUP_RETENTION_DAYS` (35)
- `RESEARCH_DELETION_LEDGER` (keep it on separate storage)

## Architecture
```
research/
  lib/        pure modules (no I/O)
    policy.js     central output-policy layer: label, forbidden wording, experimental/uncertainty rules, prohibited features
    config.js     versioned, hashed engineering assumptions (all need validation)
    csv.js        strict CSV/JSON parsing with limits; formula-safe CSV export
    units.js      °C/°F normalisation (source values kept, units never guessed)
    ingest.js     schema validation, duplicate/conflict detection, quarantine, preview
    quality.js    night placement (sleep session or configured window, DST/travel), per-stream nightly quality + features
    cycles.js     append-only annotation history ("as known at"), cycle segmentation from logged bleeding
    inference.js  descriptive trend; EXPERIMENTAL sustained-shift rule; EXPERIMENTAL next-period forecast
    pipeline.js   one participant's analysis as known at a cutoff, with provenance and input hashes
    evaluate.js   leakage-checked forecast evaluation; shift-rule evaluation against synthetic events
    adapters.js   documented-file adapter; vendor STUBS with integration questions
    acceptance.js supplier acceptance test: runs a supplier's sample through the checklist (files only; never marks a device verified)
    ml.js         model-card validator + registry guard (no model exists)
    synth.js      seeded synthetic data generator
  server/     store.js (SQLite, parameterised, isolation, deletion, field encryption), server.js (HTTP API + static), cli.mjs (operator commands),
              keys.js (key files, envelope and field encryption), totp.js (RFC 6238 codes), backup.js (encrypted backups, retention, restore with deletion ledger)
  web/        dashboard (index.html, app.js, styles.css): strict CSP, no inline code, no external requests
  fixtures/   synthetic ingestion fixtures + MANIFEST.json (hashes, purpose, generator)
  tools/      make-fixtures, seed, demo, evaluate
  tests/      ingest, analysis, extensions, api (Node) and e2e.cjs (Playwright)
  docs/       see below
```

**Layers** are kept apart in the API (`observed`, `descriptive`, `estimates`, `forecasts`, `provenance`) and on screen:
- experimental cards have dashed amber borders and an "Experimental" tag;
- the timeline has a separate experimental band.

## Test results (run 2026-11-18, Node 22.23.4, Playwright 1.63.0 / Chromium 153, Linux)
| Suite | Checks | Result |
|---|---|---|
| `research/tests/ingest.test.mjs`: policy, units, CSV safety, ingestion fixtures, fixture provenance | 71 | **all pass** |
| `research/tests/analysis.test.mjs`: night placement (midnight, daylight saving, travel), quality, device and firmware changes, cross-site separation, segmentation and corrections, shift rule (clear, flat, noisy, gradual, fever, device change, sparse, empty), forecast (short history, irregular, stale), leakage, reproducibility | 51 | **all pass** |
| `research/tests/extensions.test.mjs`: vendor stubs, ML card guard | 15 | **all pass** |
| `research/tests/api.test.mjs`: real HTTP server; auth, lockout, CSRF, isolation, roles, consent, import preview and commit, duplicates, quarantine, size limits, prohibited features, experimental gating, versioned runs, corrections, participant view, exports, CSV injection, forbidden-phrase scan of every response, log content, deletion of raw and derived data | 52 | **all pass** |
| `research/tests/regressions-b3d9589.test.mjs`: participant permissions on /runs and /export, consent rechecked at commit and on withdrawal, no unconsented LH or hormonal data retained, session night labels, canonical stream identity including model, reproducible as-of history, self and circular corrections (see `docs/fixes-b3d9589.md`) | 33 | **all pass** |
| `research/tests/regressions-f67000b.test.mjs`: canonical annotation types in consent checks and withdrawal purges (LH and hormonal, any spelling; previews, quarantine, exports); explicit, audited reimport under current consent; no automatic restoration (see `docs/fixes-f67000b.md`) | 23 | **all pass** |
| `research/tests/regressions-21317c5.test.mjs`: Boolean-only consent and feature flags; legacy consent reconciliation on upgrade; server-side preview binding; prototype names; full-metadata conflicts; tied corrections; strict timestamps; vendor-night cutoff; sampling bounds and crash safety; CSV quoting and JSON limits; onset interval, gap abstention and timing exclusion (see `docs/fixes-21317c5.md`) | 111 | **all pass** |
| `research/tests/e2e-races.cjs`: dashboard with delayed and reordered responses; stale page, home and logout races; preview bound to participant, file and type | 14 | **all pass** |
| `research/tests/migration.test.mjs`: upgrading a database made by an earlier version (schema 1 → 4) | 9 | **all pass** |
| `research/tests/security.test.mjs`: encryption at rest (no payload readable in the database files; identical analysis; duplicates, conflicts, corrections and consent purges still work; wrong or missing key refused; key rotation; in-place encryption of an old database), key files, RFC 6238 vectors, two-factor sign-in (replay, recovery codes, lockout, enrolment, required roles), password change, session list and sign-out of others, encrypted backups (tamper and wrong-key refusal, retention, restore re-applies deletions), CLI | 102 | **all pass** |
| `research/tests/acceptance.test.mjs`: supplier acceptance test passes good synthetic band data and fails each broken variant on its own checklist item (schema, identity, offsets, sampling, undocumented flags, too few nights, clock drift, unflagged off-wrist, missing firmware or time-zone change, re-sync conflicts, units); missing evidence is "not tested"; unreviewed supplier answers block the verdict; CLI | 29 | **all pass** |
| `research/tests/e2e-account.cjs`: two-step sign-in, Account page, session sign-out, password change, participant self-enrolment, in Chromium | 20 | **all pass** |
| `research/tests/e2e.cjs`: dashboard in headless Chromium with Secure cookies (each participant page is marked with `data-participant`); label, can/cannot panel, timeline, experimental separation, device-change marker, UI import, duplicate detection, explicit reimport, CSV export, participant self-view and API refusal, UI deletion, no external requests, clean logs, no script or CSP errors | 26 | **all pass** |

**What these results do and don't show:**
- Synthetic tests prove **code behaviour only, not clinical accuracy**.
- The synthetic evaluation (`docs/eval-synthetic.md`) reports abstention, conditional error, range coverage and shift-rule behaviour, with denominators. It is not real-world performance.

**Not run:**
- Firefox, Safari and mobile browsers;
- a load test;
- a penetration test;
- an accessibility audit.

## Documents
| Deliverable | File |
|---|---|
| Data dictionary and ingestion specification | `docs/data-dictionary.md` |
| Algorithm card (verified science vs engineering assumptions vs unknowns) | `docs/algorithm-card.md` |
| Threat model and privacy checklist | `docs/threat-model.md` |
| Security operations: keys, two-factor, backups, restore, rotation | `docs/security-operations.md` |
| Evaluation plan for a future approved prospective study | `docs/evaluation-plan.md` |
| Supplier integration checklist, and how to run the acceptance test on a supplier's sample | `docs/supplier-checklist.md` (example: `fixtures/acceptance-synthetic/`) |
| ML extension interface and evaluation specification | `docs/ml-evaluation-spec.md` |
| Source register (what was and wasn't read) | `docs/sources.md` |
| What remains unvalidated or disabled, and known defects | `docs/unvalidated-and-disabled.md` |
| Synthetic evaluation report | `docs/eval-synthetic.md` |

## Before any real-user study (all required; none done)
1. **Approvals:** research-ethics approval, a data-protection impact assessment, a legal basis for processing special-category data, and consent materials reviewed by an ethics committee.
2. **Protocol:** a registered protocol with pre-specified endpoints (`docs/evaluation-plan.md`) and clinician ownership of all participant-facing wording.
3. **Device:** a supplier integration that passes `docs/supplier-checklist.md`, a frozen device and firmware, and the vendor's licence and data terms reviewed.
4. **Security:** a hosting and TLS review, an external security test, a scheduled backup job with a restore drill, and an incident-response plan. (Encryption at rest, two-factor sign-in and backups that honour deletion now exist in the prototype, tested automatically only.)
5. **Accessibility:** an accessibility review and a fix of the known defects in `docs/unvalidated-and-disabled.md`.
6. **Software:** freeze the software and configuration version for the study. Validate thresholds only on development data and lock the test set.
