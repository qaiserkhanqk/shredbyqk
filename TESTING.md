# Testing and finding problems

Shred is tested at four levels. Each one catches a different kind of problem.

| Level | What it catches | Command | When it runs |
|---|---|---|---|
| **1. Unit tests** | Maths and logic errors: angles, rep counting, bar speed, jump height, knee angle, gait events, quality checks. Synthetic data with a **known true answer**, so the error is measured exactly. | `npm test` | Every push (GitHub Actions). A failure blocks deploy. |
| **2. Regression tests** | A bug that was fixed coming back. Replays recorded sessions in `tests/fixtures/` and checks the stored correct answer. | `npm test` (included) | Every push |
| **3. End-to-end tests** | Integration problems: buttons that do nothing, screens that don't open, camera start-up, crashes. Runs the real app in Chrome with a fake camera. | `npm run test:e2e` | Every push (separate job; doesn't block deploy) |
| **4. Validation study** | How accurate the app is on real people, compared with lab equipment. | `npm run validate results.csv` | Before making accuracy claims, then once a year |

## The workflow when a client reports a problem

Example: *"It missed my third rep"* or *"my jump height looks wrong"*.

1. **Export the session.** On the client's phone: Today → App health & diagnostics → **Export last session**. The file holds the body-point positions for every frame, the settings and the result. It never contains video.
2. **Replay it.**
   ```bash
   npm run replay -- shred-session-123.json --trace
   ```
   This runs the exact same analysis code and prints every frame: joint angle, state-machine phase, each rep and fault. You can see exactly where the logic went wrong, such as the knee only reaching 118° so the bottom was never confirmed.
3. **Check the recording quality** in the same output: frame rate, visibility, camera view. Many reported problems turn out to be filming problems. The app's quality score and tips should then be improved so the client is told what to fix.
4. **Fix the logic** if it's a real bug.
5. **Lock it in.** Copy the session into `tests/fixtures/`, add `"expect": {...}` with the correct answer to its `meta`, and run `npm test`. The bug can never come back without a failing test.

Crashes are logged on the device. **Export error log** in the same panel gives the error, the file and line, and the app version.

## Validation study (accuracy on real people)

1. Partner with a university biomechanics or sports-science lab.
2. Record 20–30 people with Shred **and** the reference system at the same time:
   - joint angles: marker-based motion capture
   - jump height: force plate
   - bar speed: linear position transducer
   - gait: instrumented treadmill or gait walkway
3. Put the paired results in a CSV:
   ```
   subject,metric,app,reference
   S01,jump_height_cm,38.1,39.0
   S01,knee_min_angle,84.2,86.0
   ```
4. Run `npm run validate results.csv`. For each metric it gives:
   - bias (average difference)
   - MAE and RMSE (typical size of the error)
   - 95% limits of agreement (Bland–Altman)
   - Pearson r
   - ICC(2,1) (absolute agreement), rated poor, moderate, good or excellent
5. Retune any thresholds that show bias, then publish the numbers. Those figures are what back an accuracy claim.

## What each automated test checks

- **`tests/simulate.mjs`:** coach feedback timing on a scripted hip-thrust set: faded cues, praise after a fix, fatigue detection.
- **`tests/gait.mjs`:** simulated walker: cadence, and finding a right-hip restriction built into it.
- **`tests/library.mjs`:** all 84 exercises map to a working movement pattern, and every muscle group has exercises.
- **`tests/squatTracker.test.ts`:**
  - squat depth, knee caving and tempo
  - side and front views
  - 20 random noise patterns
- **`tests/measurement.test.mjs`:**
  - bar speed (with jitter), velocity loss and 1-rep max
  - jump height at 30, 60, 120 and 240 fps
  - knee angle on a single-leg squat, left/right
  - plate and height scaling
  - every quality-check rule
- **`tests/regression.test.mjs`:** replays every fixture, and checks the validation statistics against data with known properties.
- **`tests/e2e.cjs`:**
  - demo set and exercise library
  - live camera and calibration
  - gait report
  - knee-test capture, scan rejection and diagnostics export
  - zero JavaScript errors
