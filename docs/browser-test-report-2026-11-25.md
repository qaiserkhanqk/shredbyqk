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

## Re-run on 941e237 (2026-11-27): the Firefox two-tab failure is fixed
**Cause found:** the failure was not in storage. A trace of the failing tab showed this sequence:
1. the press lands on "Period started";
2. 4 ms later the page redraws, because the other tab's save had started this tab's re-read just before the press, and the re-read finished during it;
3. the release lands on a paragraph that moved under the pointer, so the browser fires no click.

So her tap was silently lost. It could happen to a real person tapping while another tab saves.

**Fix:** a redraw never happens while a finger is down. One asked for during a press, or a re-read that finishes during one, waits until the press ends and then runs after the click (`a6d5595`, `df46371`). `tests/cycle-ui-tap-during-redraw.cjs` holds the press to make it deterministic; it failed in all three browsers before the fix and passes after.

**Verification:**
- 40 repeated Firefox two-tab scenarios: 40 of 40 passed. Before any fix, 4 of 40 failed; after the first, partial fix (`a6d5595`), 11 of 40.
- 6 repeated Firefox runs of `tests/e2e.cjs`: 6 of 6 passed. Before the fix, roughly half failed.

**Full run on 941e237** (each browser test file run separately: 20 files):

| Browser | Result |
|---|---|
| WebKit 26.6 | **334 ok, 0 failures**, with the plain-http dashboard files in the labelled local-cookie mode (26, 14 and 20 checks), as before |
| Firefox 155 | **334 ok, 0 failures** |

Still not tested: real iPhone, Android or Mac Safari.

## Re-run on ed69ad6 (2026-11-27): sign-up, 18+ and premenstrual patterns
**The version tested** adds the personalised sign-up (minimum age 18), the premenstrual pattern card, and the question budget.

**Results** (each browser test file run separately: 21 files):

| Browser | Result |
|---|---|
| WebKit 26.6 | **371 ok, 0 failures**, with the plain-http dashboard files in the labelled local-cookie mode (26, 14 and 20 checks), as before |
| Firefox 155 | **371 ok, 0 failures** |

New since the last run: `tests/onboarding-ui.cjs` (27) and `tests/cycle-ui-premenstrual.cjs` (10).

Still not tested: real iPhone, Android or Mac Safari.

## Re-run on 69f1862 (2026-11-27): the merged app (cycle tracking + food, Brain, Sukoon, Fitness Age, leaderboard, new sign-up)
Chromium (the four test commands) passed in full: `npm test` 2,044, `npm run research:test` 510, `npm run test:e2e` 571 and `npm run research:e2e` 65, all with 0 failures.

**WebKit 26.6 and Firefox 155** (each browser test file run separately: 22 files):

| Browser | Result |
|---|---|
| WebKit | **582 ok, 6 failures.** 5 are the known plain-http dashboard checks; they pass in the labelled local-cookie mode (26, 14 and 20 checks), as on every run. 1 is the tap-along pulse (below). |
| Firefox | **632 ok, 3 failures** (below). |

**Every cycle-tracking, sign-up and premenstrual check passed in both browsers.** All 4 remaining failures are in features merged from `main`, which had only been tested in Chromium:

| Failure | Browser | What it is |
|---|---|---|
| Tap-along pulse: "12 taps 750 ms apart → about 80 bpm" gave **76** | WebKit, Firefox | **A test timing issue, not an app error.** The test waits 750 ms *plus* the browser's time to register each click. In these browsers the real gap was about 790 ms, which is 76 bpm. The app measured the taps correctly. The test should compare with the actual tap times. |
| "Set start: QK tells you what to do" | Firefox | **An environment limit.** Firefox here has no WebGL, so the camera coaching can't start; the test already notes this for the other camera checks. This check is not yet marked as needing WebGL. |
| "Sukoon: recitation failure offers the passage on Quran.com" | Firefox | **A real gap.** When the recitation audio can't be decoded, Firefox reports a media-sink error (`NS_ERROR_DOM_MEDIA_MEDIASINK_ERR`) but never fires the audio element's `error` event. A probe showed the screen still on "Bismillah" after 6 s, in silence, with no Quran.com link. Sukoon's fallback relies on that event. Suggested fix: a timeout (if no audio plays within a few seconds, show the link). Not fixed yet. |

Still not tested: real iPhone, Android or Mac Safari.

## Re-run on 064ecab (2026-11-28): main's camera-accuracy update merged, all browser failures resolved
**Chromium** (the four test commands): `npm test` 2,211, `npm run research:test` 510, `npm run test:e2e` 615 and
`npm run research:e2e` 65, all with **0 failures**.

**WebKit 26.6:** the main app test (`tests/e2e.cjs`) **254 ok, 0 failures**. **Firefox 155:** the same file **253 ok, 0
failures, in two runs in a row**. `tests/sukoon-fallback.cjs` (5) and `tests/camera-live.cjs` (3) pass in all three
browsers (logs in `docs/test-logs/`).

What happened to each failure from the 69f1862 run, and the ones found since:

| Failure | Browser | Cause | Resolution |
|---|---|---|---|
| Sukoon: no Quran.com link when the recitation can't play | Firefox | **Real gap**: Firefox never reports the failed audio | App fixed: 8 s safety net (`STALL_MS`, js/calm.js). Test first: `tests/sukoon-fallback.cjs`. The main test now waits up to 10 s for it. |
| Tap-along pulse gave 76, not 80 | WebKit, Firefox | Test timing (the real gap between taps was ~790 ms) | Test now compares with the pulse the taps really gave, ±1 bpm |
| "Set start: QK tells you what to do" | Firefox | No WebGL in this Firefox | Marked as needing WebGL, like the other camera checks |
| Coach dashboard: "QK can record the top 3" | all | **main's own test**: it assumed no ties | Fixed on main (ties share a place); came in with the merge |
| Plate calibration: second tap lost | Firefox | **Real**: the tap hit Firefox's own Picture-in-Picture button over the camera video, so the video popped out | App fixed: `disablepictureinpicture` on the camera video. Test first: `tests/camera-live.cjs` |
| Rep line ("Rep 8 · full range …") carried over to a new set | all | **Real** bug in main's new camera update | App fixed: cleared when a set starts. Test first: `tests/camera-live.cjs` |
| Brain tracker: "3 followed balls" not perfect, now and then | Firefox | Test: balls finish in random places and can overlap, so a tap at a ball's centre could hit another ball | Test taps the exact ball; the scoring check is unchanged |
| "InvalidStateError: Navigated away from page" console errors, now and then | Firefox | **Real, harmless to the user**: the Sukoon tones player never handled a refused sound start (`AudioContext.resume()`); when the page is left mid-request Firefox refuses it. Found by locating the text in Firefox's own Web Audio code | App fixed: refusals handled quietly in js/sukoon.js (and `close()` in js/lab-ui.js). Test first: `tests/sukoon-audio.test.mjs` forces the refusal every time |

`main`'s `sw.js` still did not parse (a line of file names sat before `const SHELL = [`); the merge rebuilt it (cache v46,
136 files, every one exists) and `tests/sw.test.mjs` checks that it parses.

Still not tested: real iPhone, Android or Mac Safari.

## Re-run on 208f949 (2026-11-28): main's 3D Lab and cafés merged, Sukoon sound-start fix
Chromium: `npm test` 2,324 and `npm run test:e2e` 636, 0 failures; `npm run research:test` 510 and
`npm run research:e2e` 65, 0 failures (run on ae3a2ae; nothing in the research platform changed after it).
Main app test (`tests/e2e.cjs`): **WebKit 263 ok, 0 failures; Firefox 262 ok, 0 failures, two runs in a row.**

Still not tested: real iPhone, Android or Mac Safari.
