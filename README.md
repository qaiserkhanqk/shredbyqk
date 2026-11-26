# Shred by QK

An AI coaching app with QK's avatar. It watches each client's form through the phone camera, speaks corrections in real time, counts reps, detects fatigue, screens posture and keeps clients accountable.

All video is processed **on the phone** (MediaPipe Pose) and nothing is uploaded. This matters for privacy and GDPR, and it means there are no server costs per minute of video.

## Design: one clear next step

The app is built so a new client is never faced with a wall of features:
- **First run asks three things:** name, what they want help with first (get fitter, recover from pain, feel calmer), and training days.
- **Today shows one next step**, chosen by `js/today.js`: rehab morning check → recovery day → wind down after training → rehab session → today's workout (lighter if needed) → rest day. One button, one line saying why.
- **Three tabs:** Today, Train, Me. Rehab, movement tests, posture, Body check and Sukoon sit under **All tools**, ordered by what the client came for. Calm now and Body check are also one tap from Today.
- After the morning check-in, the feel buttons fold into one line, so the next step is what stands out.

## Features
- **487 exercises** (plus 45 rehab exercises): gym, bodyweight and powerlifting, **plyometrics, Olympic lifts, stretching and mobility, cardio, running, HYROX and Pilates**. Filter by training type or muscle group: chest, back, shoulders, biceps, triceps, forearms, quads, hamstrings, glutes, calves, core and full body. Search them, or filter by muscle.
  - **203 have a live camera form check**, built on 20 movement patterns: squat, hinge, lunge, hip thrust, bench and press, push-up, dip, fly, row, vertical pull, curl, triceps extension, raises, calf raise, crunch, leg raise, leg extension, leg curl and plank hold.
  - 124 of them come from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain). Each was hand-matched to a pattern the camera can check. Exercises that would be judged wrongly were left out (alternating and one-arm presses, behind-the-neck pulls, band-and-chain variants). Only names, equipment, muscles and level are used, not the database's form instructions, which contain errors.
  - **Training types without a camera check get the right kind of coaching:**
    - explosive rep pacing ("Set… Go!") for jumps, throws and Olympic lifts
    - slow counted reps for mobility and Pilates
    - hold timers for stretches
    - session timers for cardio and runs
    - work/rest intervals for sprints, rope jumping and drills
    - a stopwatch for HYROX stations, which compares each time with your last one
  - **HYROX:** the 1 km run and all 8 stations in race order. Wall balls and sandbag lunges get the camera check. Weights point to hyrox.com, since they depend on your division.
  - **Pilates:** the 34 classical mat exercises from *Return to Life Through Contrology* (1945) plus chest lift and criss-cross. The push up, leg pull front and shoulder bridge get the camera check, and the neck-loading moves carry a warning.
  - **Running:** easy, tempo, long, intervals and sprints. Treadmill runs link to the camera running-form check.
  - **18 are voice-coached for tempo** (twists, carries, wrist curls and similar). A phone camera can't judge these reliably, so the app says so instead of showing a fake form score.
- **Map my body (1 min), applied to every camera exercise.** QK guides you through standing, a toe rise, 3 squats, an overhead reach and 2 hinges side-on, then arms out and 2 squats facing the camera. It measures:
  - your proportions
  - how straight your joints go
  - squat depth, ankle, hamstring and shoulder mobility
  - knee alignment
  - your natural posture

  Every camera exercise is then judged against **your** body: lean, depth and rep counting, lockouts, hinge depth, pressing depth, raise and calf-raise height, and body line. The setup screen says exactly what was fitted for that exercise, and findings come with fixes. Technique criteria follow the NSCA (see [SCIENCE.md](SCIENCE.md) §11).
- **Camera coach (one tap):** the big button at the top of Today opens the camera straight away. Start your exercise and QK recognises it from how your joints move: which joints bend, your posture (standing, bent over, lying, hanging) and where your hands go. That takes about one rep. It then coaches live, and the reps it watched while recognising still count. Switch exercise and it notices, saves the finished set and coaches the new one. If it guesses wrong, tap **Change**. It recognises 20 movements: squat, lunge, Romanian deadlift, calf raise, overhead press, pull-up, row, curl, triceps pushdown, overhead triceps extension, lateral and front raise, push-up, bench and floor press, glute bridge, crunch, leg raise and plank.
- **"You're moving too much":** each exercise checks the parts that should stay still, against your own position at the start of the rep:
  - body swinging on curls, raises and triceps
  - heaving the torso on rows
  - leaning to one side on overhead presses
  - feet sliding or weight shifting sideways on squats

  Squats facing the camera now count reps properly: depth is read from how far the hips drop, because a front view can't see the knee bend.
- **Live form check:**
  - **Corrects you mid-rep, like a coach beside you.** Posture faults (knees caving, heels lifting, leaning, hips shooting up, no leg drive) are called out the moment they appear, interrupting whatever QK was saying. A red banner shows what's wrong and the fix, and the skeleton turns red. End-of-rep faults (depth, lockout, shoulders at the top) are cued as soon as the rep finishes. After two full cues QK switches to a short shout ("Knees out!").
  - Joint angles are drawn on the client's body, with a live depth gauge at the working joint.
  - **Motion graphics on the body** when QK cues a fault: arrows and targets that move with the joints (knees out, heels down, chest leads, pin shoulders, leg drive, glutes down), then a green check when it's fixed.
  - Squat faults: knees caving in, hips shooting up first, heels lifting, too much forward lean, depth, lockout.
  - Bench faults: shoulder blades not pinned (shoulders rolling off the bench), no leg drive, hips lifting off the bench, depth, lockout.
  - Corrections are spoken by the coach, with rep counting.
  - Tempo, rep-speed loss and reps-in-reserve are tracked. The set is recorded with the skeleton and coaching graphics burned in, and every correction is listed with its time, so you can tap it to jump straight to that moment.
  - Clients can also upload a video they filmed earlier.
- **Motion tracking.** Live movement trail of the hips or bar, range of motion per rep, partial-rep and bar-path-drift detection.
- **Gait analysis.** Record 10 seconds of walking or running on the live camera, or upload a video. You get:
  - cadence, stance time, step length, knee bend, hip extension and trunk lean
  - left/right symmetry
  - pelvic drop and knee alignment (front view)
  - overstriding (running)
  - a knee-angle chart through one stride against the typical range
  - findings, each with fixes
- **Bar speed (velocity-based training):** m/s per rep, speed loss in the set, training zone, and estimated 1-rep max from your load–speed profile. Tap a 45 cm plate to calibrate.
- **Jump test:** jump height from time in the air, precision shown for your frame rate, and day-to-day readiness against your own baseline.
- **Single-leg squat knee test:** knee drift per leg (frontal plane projection angle), hip drop, and left/right difference.
- **Guided two-view posture screen:** front and side photos merged into one report.
- **Accuracy:** 3 model sizes (precise model for uploads and tests), 60 fps capture for tests, and a recording-quality score that blocks results from bad recordings.
- **Diagnostics:** export any session (body points only, no video) and replay it on a computer to find bugs. See [TESTING.md](TESTING.md).
- **Sukoon calm session:** pick a feeling (anxiety, anger, jealousy, backbiting, focus, sleep, love, healing, mind reset), then:
  - slow breathing with a 6 breaths/min pacer and optional binaural or pulsing tones
  - a short Quran recitation matched to the goal (tones stop first, so the Quran is heard in silence)
  - a dua from the Sunnah with its source
  - tension rated before and after, with your trend
  - each tone is labelled with its evidence strength, and high distress shows support numbers first
  - one-tap **Calm now**, tap-a-number ratings, breath sounds and vibration for eyes-closed use, night mode for sleep, and a home-screen shortcut (Android)
- **Native app (optional):** `native/README.md` wraps Shred as an iPhone/Android app with a native pulse camera (flash on iPhone, higher frame rates).
- **Body check (phone only, no wearable):** fingertip heart rate in 15 seconds, a 1-minute morning HRV compared with your own normal, and the 3-minute PVT-B alertness test. Today's HRV and alertness feed the readiness card. Sukoon can measure heart rate before and after, and adds a cyclic-sighing breathing style.
- **Training flow:** Next set restarts the camera in one tap, the rest timer starts by itself, the screen stays on, a miscounted set can be corrected, and weights are logged with last time's figure shown.
- **Send my week to QK:** a one-tap text summary (days trained, form score, top fault, new best weights). No video.
- **Back up and restore** your history as a file. The app also asks the browser not to clear its saved data.
- **Rehab clinic:** 18 injuries and pain conditions:
  - lower back, neck
  - frozen shoulder, rotator cuff, tennis and golfer's elbow
  - hip, knee osteoarthritis, kneecap pain, jumper's knee, ACL, PCL, meniscus
  - hamstring, Achilles, ankle sprain, heel pain, shin splints

  Each one has:
  - a red-flag safety screen with emergency guidance
  - phased programmes passed on measured criteria
  - pain traffic lights
  - camera measurements (range of motion, hop test with left/right symmetry, calf-raise and sit-to-stand counts)
  - weekly function scores

  It supports rehab and doesn't diagnose; content must be signed off by a physio before launch.
- **Demo modes.** Simulated athletes (hip thrust, squat, bench press) and a walker run through the real engine, so you can show clients how it works without a camera.
- **Body scan.** Shows a posture picture with joint angles and asymmetries, plus fixes, and gives body fat by the US Navy method. Readings from a smart scale or InBody can be logged.
- **Accountability.** Training plan (implementation intention), plan-aware streak, weekly goal and supportive nudges.
- **Progress.** Body-fat trend, recurring form faults and session history.

The reasoning and references for every rule are in **[SCIENCE.md](SCIENCE.md)**.

## Go live on GitHub Pages (free)
1. Create a GitHub repo and push this folder to `main`.
2. In the repo, go to Settings → Pages and set Source to **GitHub Actions**.
3. The included workflow (`.github/workflows/pages.yml`) runs the tests and publishes the app at `https://<you>.github.io/<repo>/`.
4. Open that link on your phone and use Share → **Add to Home Screen**. It then opens full-screen like an app and works offline at the gym.

## Run it locally
Camera access needs `https` or `localhost`.

```bash
npm start
```

Then open http://localhost:8080. To test on a phone, deploy the folder to any static host, such as Netlify, Vercel or Cloudflare Pages. It is a plain static site with no build step.

```bash
npm test
```

This simulates a full hip-thrust set (checks the coach's cueing logic) and a walker with a known hip restriction (checks the gait analysis).

## Make the avatar really QK
1. **Face:** Coach → Profile & coach settings → upload QK's photo.
2. **Voice, best option:** QK records each cue once as an MP3 named after its id (for example `ht_feet_far.mp3`), saves it in `audio/cues/`, and adds the id to `audio/cues/manifest.json`. The app plays QK's real voice and falls back to synthetic speech for anything not recorded. All cue ids are in `js/exercises.js` and `js/feedback.js`.
3. **Voice, cloned:** set `CONFIG.ttsEndpoint` in `js/coach.js` to your own server route that calls ElevenLabs or a similar service with QK's cloned voice. Keep the API key on the server.
4. **Video avatar (later):** a talking-head video of QK, using HeyGen **LiveAvatar** (the older Interactive Avatar SDK was retired on 31 March 2026) or pre-rendered clips.

## Code map
| File | Job |
|---|---|
| `js/pose.js` | Loads the on-device pose model and draws the skeleton |
| `js/angles.js` | Joint-angle geometry, side and view detection, smoothing |
| `js/exercises.js` | 20 movement patterns: metrics, fault rules, rep/tempo/velocity engine |
| `js/library.js` | Gym and rehab exercises mapped to patterns, muscles and equipment |
| `js/library-more.js` | Plyometrics, Olympic lifts, stretching and cardio from free-exercise-db, generated by `tools/import-categories.py` |
| `js/library-extra.js` | 124 exercises from free-exercise-db, generated by `tools/import-exercises.py` from a reviewed keep list |
| `js/detect.js` | Camera coach: recognises the exercise from the movement |
| `js/bodymap.js` | Map my body: measures proportions and mobility, turns them into personal thresholds |
| `js/fx.js` | Motion graphics drawn on the body for each cued fault, and the depth gauge |
| `js/feedback.js` | Motor-learning feedback scheduler: what to say and when to stay quiet |
| `js/coach.js` | Avatar plus voice: recorded clip, then cloned TTS, then device voice |
| `js/motion.js` | Movement trails, range of motion per rep, bar-path drift |
| `js/gait.js` | Gait events, gait metrics, symmetry, findings, simulated walker |
| `js/demo.js` | Demo athletes that feed the real camera pipeline |
| `js/bodyscan.js` | Posture screen and body-fat calculation |
| `js/store.js` | Local storage (replace with a backend for the coach dashboard) |
