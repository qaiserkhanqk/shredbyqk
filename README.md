# Shred by QK

An AI coaching app with QK's avatar. It watches each client's form through the phone camera, speaks corrections in real time, counts reps, detects fatigue, screens posture and keeps clients accountable.

All video is processed **on the phone** (MediaPipe Pose) and nothing is uploaded. This matters for privacy and GDPR, and it means there are no server costs per minute of video.

## Features
- **84 exercises for every muscle group:** chest, back, shoulders, biceps, triceps, forearms, quads, hamstrings, glutes, calves, core and full body. Search them, or filter by muscle.
  - **66 have a live camera form check**, built on 20 movement patterns: squat, hinge, lunge, hip thrust, bench and press, push-up, dip, fly, row, vertical pull, curl, triceps extension, raises, calf raise, crunch, leg raise, leg extension, leg curl and plank hold.
  - **18 are voice-coached for tempo** (twists, carries, wrist curls and similar). A phone camera can't judge these reliably, so the app says so instead of showing a fake form score.
- **Map my body (30 s):** stand side-on, do 3 slow bodyweight squats, turn to face the camera and do 2 more. QK measures:
  - thigh-to-torso proportions
  - the depth you can comfortably reach
  - ankle mobility (shin angle, heel rise)
  - your natural knee alignment

  From then on, squats are judged against **your** body. Long thighs get more forward lean allowed. Depth and rep counting follow your own range, so a stiff lifter's reps still count. Knee caving is measured from your own standing alignment. Each finding is explained in plain words, with fixes such as heel plates or ankle and hip work. Re-map as mobility improves.
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
| `js/library.js` | 84 exercises mapped to patterns, muscles and equipment |
| `js/bodymap.js` | Map my body: measures proportions and mobility, turns them into personal thresholds |
| `js/fx.js` | Motion graphics drawn on the body for each cued fault, and the depth gauge |
| `js/feedback.js` | Motor-learning feedback scheduler: what to say and when to stay quiet |
| `js/coach.js` | Avatar plus voice: recorded clip, then cloned TTS, then device voice |
| `js/motion.js` | Movement trails, range of motion per rep, bar-path drift |
| `js/gait.js` | Gait events, gait metrics, symmetry, findings, simulated walker |
| `js/demo.js` | Demo athletes that feed the real camera pipeline |
| `js/bodyscan.js` | Posture screen and body-fat calculation |
| `js/store.js` | Local storage (replace with a backend for the coach dashboard) |
