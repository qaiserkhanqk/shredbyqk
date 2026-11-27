# Browser test report: Chromium, WebKit (Safari's engine) and Firefox

**Date:** 2026-11-25. **Data:** synthetic only.

**Setup:**
- Playwright 1.63, on Linux.
- Browsers: Chromium (pre-installed), WebKit 26.6 and Firefox 155. WebKit and Firefox were installed this day with the product owner's approval.
- How it ran: `node tools/run-browser-suites.mjs <browser> <folder>` runs **every browser test file separately**. The npm scripts stop at the first failing file, so on its own a failure could hide the others.
- Also run: the accessibility audit (`tests/a11y.cjs`) in each browser.

**Results:** every browser test file passes in all three browsers. Per browser: 14 files and 294 checks, plus the 6-check accessibility audit, with 0 failures. In WebKit, the research dashboard files ran in the labelled local-http cookie mode (finding 3).
- The pregnancy browser test was re-run after commit `0a09d05`. In the main run it failed once in WebKit: its privacy check counted in-memory `blob:` addresses, which never leave the device. It passes in all three browsers after the fix.
- **Firefox:** secure dashboard sign-in over local http works, unlike WebKit.
- **Node suites:** 658 app checks and 496 research checks, all passing.

## What WebKit is, and isn't
- **WebKit is the engine inside Safari.** Playwright's Linux WebKit is the closest to Safari that can run here.
- **It is not iPhone Safari.** It has a different operating system, media stack, storage rules and touch input.
- **Real iPhones still need the manual checklist** in `docs/real-phone-testing.md`. It covers the cycle, pregnancy and postpartum flows.

## Findings
| # | Browser | What happened | Cause | What was done |
|---|---|---|---|---|
| 1 | WebKit | Camera features showed "Camera blocked". | WebKit has no fake-camera switch, so permission was never granted in the test. The app's message was **correct**. | The test now grants camera permission in WebKit, like a person tapping "Allow" (`tests/e2e.cjs`). The camera features then run. |
| 2 | WebKit | Recording a coaching line failed. | Playwright's Linux WebKit build has no `MediaRecorder`; Safari has had it since 14.1. The app said "allow microphone access", which was **misleading**. | **App fix:** a browser that can't record now says "This browser can't record audio." The test checks this message there, and logs that recording itself was not tested in that browser. |
| 3 | WebKit | Research dashboard: sign-in did not stick over `http://127.0.0.1`. | Safari does not keep `Secure` cookies on plain http, even locally. **A real Safari difference.** | **Resolved by serving the dashboard over HTTPS** (`research/server/tls.js`, `RESEARCH_TLS_CERT`/`RESEARCH_TLS_KEY`, `npm run research:demo:https`). The Secure default is unchanged. `research/tests/e2e-https.cjs` passes in WebKit, Chromium and Firefox with the default Secure cookie. Over plain http, the WebKit dashboard tests still need the labelled local mode (`RESEARCH_E2E_INSECURE_COOKIES=1`); the failing default-mode log is kept. |
| 4 | Firefox | Photo scan said "That file couldn't be read". | Headless Firefox here has no WebGL. MediaPipe needs WebGL even on its CPU path: creation "succeeds" and the first analysis throws. **A real robustness gap** for any browser without graphics acceleration. | **App fix:** `js/pose.js` checks for WebGL first. The camera, video and photo screens now say the browser needs graphics acceleration (WebGL), instead of blaming the file or the camera. The Firefox test checks this message and logs that pose analysis was not tested there. |

## Not tested
- **iPhone Safari, iPad and Android phones** (no devices here). Use `docs/real-phone-testing.md`.
- **Microphone recording in WebKit**, and **pose analysis in Firefox**: the browser builds here lack `MediaRecorder` and WebGL respectively.
- **Notifications on a Home Screen app**, and **Safari's 7-day storage eviction**: manual only.

## How to repeat
```bash
npx playwright install --with-deps webkit firefox
```

```bash
npm install --no-save axe-core@4.10.2
```

```bash
npm run test:browsers
```

For the research dashboard in WebKit over local http, set `RESEARCH_E2E_INSECURE_COOKIES=1` (see finding 3).

## Re-run on d96884a (2026-11-26): WebKit 26.6 and Firefox 155
**The version tested** includes the stale-band fix, the band eligibility fixes and the calibrated dates-only range.

**Results:**
- Every browser test file passed separately in both browsers: 16 files and **308 checks per browser**, plus the 6-check accessibility audit. There were 0 failures.
- New since the first run: `tests/cycle-ui-adjust-freshness.cjs` (8) and `research/tests/e2e-https.cjs` (5). The HTTPS dashboard test passed in WebKit with the default Secure cookie.

**As before:**
- In WebKit, the plain-http dashboard files ran in the labelled local-cookie mode.
- Not tested here, because the browser builds lack the feature: recording in WebKit (no MediaRecorder) and pose analysis in Firefox (no WebGL). Each log says so in a `note` line.
- Still not tested: real iPhone or Mac Safari.

## Re-run on afef86e (2026-11-27): WebKit 26.6 and Firefox 155
**The version tested** includes the period-start check-ins (`a531ff2`) and the fixes reported against them (`afef86e`).

**Results** (each browser test file run separately: 18 files, 330 checks per browser):

| Browser | Result |
|---|---|
| WebKit | **330 ok, 0 failures.** The 3 plain-http dashboard files failed in the default Secure-cookie mode, as on every earlier run (finding 3). They passed in the labelled local-cookie mode (`RESEARCH_E2E_INSECURE_COOKIES=1`): 26, 14 and 20 checks. The HTTPS dashboard test passed with the default Secure cookie. |
| Firefox | **329 ok, 1 failure, in `tests/e2e.cjs`.** All other 17 files passed. |

**The Firefox failure: an intermittent two-tab race, already present before these changes.**
- **What fails:** one of the two-tab checks in `tests/e2e.cjs`, a different one on different runs:
  - "simultaneous saves (Web Locks removed): neither period is lost". One of the two periods saved at the same moment was missing.
  - "simultaneous save + delete (Web Locks available)".
- **On afef86e:** it failed in the main run and in 2 of 3 re-runs; 1 re-run passed (66/66).
- **On a531ff2, before the fixes:** the same failure happened in 2 of 4 runs; the other 2 passed. So the fixes did not cause it.
- **On d96884a:** it passed in the single run.
- **Status:** not fixed and not explained yet. It may be a real lost update in the store's fallback path when two Firefox tabs save at the same moment, or the test may not wait long enough. It needs its own investigation. The test has not been weakened.

**As before:**
- Not tested here, because the browser builds lack the feature: recording in WebKit (no MediaRecorder) and pose analysis in Firefox (no WebGL).
- Still not tested: real iPhone, Android or Mac Safari.
