# Pre-hardware hardening: security, band acceptance test, browsers and phones

This round covers the three software items to finish before the SWL DS07 (or another band) arrives. All work used **synthetic data only**.
- Nothing was deployed or merged.
- No real health data was used.
- No clinical, accuracy or device claim is made.

Every item was done test-first: the failing tests were committed before the code that makes them pass.

| Commit | What |
|---|---|
| `f1aac7a` | **Failing** tests: encryption at rest, two-factor sign-in, password change, sessions, encrypted backups (Node and browser) |
| `b4e37f3` | Security features, operator CLI, schema 4, docs |
| `4e4c997` | **Failing** tests: supplier acceptance test |
| `92de3db` | Supplier acceptance test tool and synthetic example |
| `27a5cae` | **Failing** phone-layout test (`tests/mobile-layout.cjs`) and browser selection helper |
| the commit that adds this document | Phone-layout fixes, old-browser notice, compatibility audit, cross-browser scripts, docs |

## 1. Security in the research prototype (`research/`)
| Feature | Before | Now | Evidence |
|---|---|---|---|
| **Encryption at rest** | None: a plain SQLite file | AES-256-GCM field encryption with an envelope key. Keyed indexes for values that must stay comparable. Old databases are encrypted in place and their files rewritten. The server refuses a database file without a key. | `research/tests/security.test.mjs` checks this directly: no synthetic payload marker can be found in the database, WAL or SHM files. Analysis output is identical with and without encryption. Duplicates, conflicts, corrections and consent purges still work. Wrong or missing keys are refused. |
| **Two-factor sign-in** | None | Time-based codes (RFC 6238), each usable once, plus 10 hashed recovery codes. Required for admins and researchers. Participants can enrol themselves. Wrong codes count towards the lockout. | RFC 6238 test vectors. Tested: replay, recovery codes, lockout, required roles, self-enrolment, and that no secret appears in logs or audits. |
| **Password change, sessions** | None | An Account page: change password, list sessions, sign out other sessions | API and browser tests (`research/tests/e2e-account.cjs`) |
| **Backups** | None | Encrypted with a separate key and integrity-checked. Retention pruning (default 35 days). **A restore re-applies every deletion**, so a deleted participant never comes back. | Tested: tampered and wrong-key backups write nothing; retention; the restore re-applies a deletion made after the backup. |
| **Operations** | — | CLI commands: `generate-key`, `enroll-mfa`, `confirm-mfa`, `disable-mfa`, `set-password`, `backup`, `verify-backup`, `restore`, `prune-backups`, `rotate-key` | `research/docs/security-operations.md` |

**Still open:**
- **Not encrypted:** pseudonymous refs, usernames, consent scope names, record times and counts.
- **Not built:** WebAuthn or passkeys, a backup scheduler, a restore drill.
- **Not done:** an external security review or penetration test.

## 2. Supplier acceptance test for the band
`research/tools/supplier-acceptance.mjs` takes a supplier's sample (mapped to our documented file format) plus evidence files: a re-sync export, reference-clock pairs, a wear log and bench thermometer readings. It runs them through every checklist item a file can show:
- schema;
- device identity and firmware;
- UTC offsets;
- sampling interval;
- documented quality flags;
- 10 consecutive nights on 3+ people, with at least 90% of worn nights good or limited;
- clock within 2 minutes;
- off-wrist periods flagged;
- firmware and time-zone changes visible;
- units against a bench reference;
- no duplicates on re-sync.

It also lists the 8 items that need a written, reviewed supplier answer: licence, data ownership and cloud, platform route, vendor validation, change control, and so on.

**How it decides:**
- Pass criteria are the numbers already in `supplier-checklist.md`; no tolerance is invented. Bench differences are reported for a person to judge.
- Missing evidence is "not tested", never a pass.
- The verdict is *technically verified* only when every file check passes **and** every supplier answer has been reviewed.

**What it does not do:**
- The report is technical only. It does not change any adapter: the SWL DS07 is still a stub.

**Evidence:** `research/tests/acceptance.test.mjs` (29 checks) passes good synthetic data and fails each broken variant on its own item. A synthetic example and its report are in `research/fixtures/acceptance-synthetic/`.

## 3. Browsers and phones
**Phone layout** (`tests/mobile-layout.cjs`). Emulated iPhone SE, iPhone 13 and Pixel 7, on every main tab and on the cycle screens with synthetic data. The failing run found 28 problems, now fixed in `css/styles.css`:

| Problem | Effect on a real phone | Fix |
|---|---|---|
| Text fields and menus used 12.8 px text | iPhone zooms the whole page every time a field is tapped | Fields use at least 16 px |
| "Listen", "Add more detail", "Delete", section headers and checkbox labels were 18–23 px tall | Hard to tap (below the WCAG 2.2 minimum of 24×24 px) | Minimum 24 px |
| Period start and end dates overflowed on a 320 px screen | Sideways scrolling on the smallest iPhones | Date fields may shrink |

**Compatibility audit** (`tools/compat-audit.mjs`, using MDN browser-compat-data 8.1.9). This writes `docs/browser-compat.md`. The app needs:
- iOS / iPadOS **15.4** or later (every browser on iPhone uses Safari's engine);
- Chrome 98, Firefox 95 or Samsung Internet 18.

The binding features are `structuredClone`, `crypto.randomUUID` and `Array.prototype.at`. Optional features (Web Locks, BroadcastChannel, notifications, camera, recording, voice) are checked for before use.

Fixes found by the audit:
- **Old-browser notice** (`js/compat-check.js`): a classic script that shows a plain message on older browsers instead of a half-broken app. It is tested in `tests/compat-check.test.mjs`.
- **Blur effect:** the `-webkit-` prefix was added, so the blur works on Safari before version 18.
- **Coach mute crash:** muting the coach no longer throws where speech synthesis does not exist.
- **Recording check:** voice recording now checks for support first.
- **Offline cache:** the cache version was bumped, so phones pick up the new files.

**Important for the band:** Web Bluetooth does not exist on iPhone, iPad or Firefox. A Bluetooth band on iPhone therefore needs either a native app or wrapper with the supplier's SDK, or a supplier server route. This is the `platform_route` question in the acceptance test.

**Other browsers.** Every browser test now runs in the browser named by `E2E_BROWSER`:
- `npm run test:e2e:firefox` / `npm run test:e2e:webkit`;
- `npm run research:e2e:firefox` / `npm run research:e2e:webkit`.

They were **not run here**, because only Chromium is installed in this environment. If the browser is missing, the test says so and fails; it never falls back to another browser silently.

**Real phones:** `docs/real-phone-testing.md` is the checklist for a person with devices.

## Found but not changed (needs a decision)
- **iPhone storage eviction.** In a Safari tab (not installed to the Home Screen), Safari may delete a site's stored data after 7 days without a visit. The app does not yet request persistent storage (`navigator.storage.persist()`) or warn about this. For a health log this is a real data-loss risk. **Recommendation:** request persistence after consent, and advise installing the app and exporting regularly.
- **Google Fonts.** `index.html` loads fonts from `fonts.googleapis.com`, so each visit sends the user's IP address to Google. For a health app, self-hosting the fonts would remove that third-party request. Fonts were not changed because that affects the design and the Pages deployment.

## Test results (2026-11-19, Node 22.23.4, Playwright 1.63.0 / Chromium 153, Linux)
See the logs in `docs/test-logs/` and `research/docs/test-logs/` (`*-pre-hardware.log`, `*-BEFORE-*`, `*-AFTER-*`).

| Command | Result |
|---|---|
| `npm test` (app, Node) | exit 0, **469 ok** (was 460; plus the 9 checks for the old-browser notice) |
| `npm run research:test` | exit 0, **496 checks** (was 365; plus 102 security and 29 acceptance checks) |
| `npm run test:e2e` (app, Chromium) | exit 0, **160 ok** (was 93; plus the 67 phone-layout checks) |
| `npm run research:e2e` (dashboard, Chromium) | exit 0, **60 ok** (was 40; plus the 20 account checks) |
| `tests/mobile-layout.cjs` before the fixes | **28 of 67 failed** (`docs/test-logs/mobile-layout-BEFORE-fix.log`) |
| `research/tests/security.test.mjs` before the implementation | **55 of 81 failed** |
| `research/tests/acceptance.test.mjs` before the implementation | **26 of 30 failed** |
| Firefox, WebKit, real phones | **not run** (not installed or not available here) |

**Test changes:**
- One earlier assertion now expects schema version 4 instead of 3 (`research/tests/migration.test.mjs`).
- The browser tests now start their browser through `tests/browser.cjs`. With no `E2E_BROWSER` set, this is still Chromium.
