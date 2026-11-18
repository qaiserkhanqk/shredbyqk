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

**Your own local instance:**

```bash
RESEARCH_NEW_PASSWORD='choose-a-long-password' node research/server/cli.mjs create-user --role researcher --username me
```

```bash
npm run research:start
```

**Settings** (environment variables):
- `RESEARCH_DB` (default `research/data/research.sqlite`, git-ignored)
- `RESEARCH_PORT` (8787)
- `RESEARCH_HOST` (127.0.0.1; other addresses are refused)
- `RESEARCH_SECURE_COOKIES` (1)
- `RESEARCH_SESSION_IDLE_MIN` (30)
- `RESEARCH_SESSION_MAX_HOURS` (8)

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
    ml.js         model-card validator + registry guard (no model exists)
    synth.js      seeded synthetic data generator
  server/     store.js (SQLite, parameterised, isolation, deletion), server.js (HTTP API + static), cli.mjs
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
| `research/tests/migration.test.mjs`: upgrading a database made by the previous version (schema 1 → 2) | 9 | **all pass** |
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
| Evaluation plan for a future approved prospective study | `docs/evaluation-plan.md` |
| Supplier integration checklist | `docs/supplier-checklist.md` |
| ML extension interface and evaluation specification | `docs/ml-evaluation-spec.md` |
| Source register (what was and wasn't read) | `docs/sources.md` |
| What remains unvalidated or disabled, and known defects | `docs/unvalidated-and-disabled.md` |
| Synthetic evaluation report | `docs/eval-synthetic.md` |

## Before any real-user study (all required; none done)
1. **Approvals:** research-ethics approval, a data-protection impact assessment, a legal basis for processing special-category data, and consent materials reviewed by an ethics committee.
2. **Protocol:** a registered protocol with pre-specified endpoints (`docs/evaluation-plan.md`) and clinician ownership of all participant-facing wording.
3. **Device:** a supplier integration that passes `docs/supplier-checklist.md`, a frozen device and firmware, and the vendor's licence and data terms reviewed.
4. **Security:** encryption at rest, backups and retention that honour deletion, MFA, a hosting and TLS review, an external security test and an incident-response plan.
5. **Accessibility:** an accessibility review and a fix of the known defects in `docs/unvalidated-and-disabled.md`.
6. **Software:** freeze the software and configuration version for the study. Validate thresholds only on development data and lock the test set.
