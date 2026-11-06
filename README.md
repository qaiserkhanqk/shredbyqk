# Shred by QK

An AI coaching app with QK's avatar. It watches each client's form through the phone camera, speaks corrections in real time, counts reps, detects fatigue, screens posture and keeps clients accountable.

All video is processed **on the phone** (MediaPipe Pose) and nothing is uploaded. This matters for privacy and GDPR, and it means there are no server costs per minute of video.

## Features in this prototype
- **Live form check** for 7 lifts: squat, hip thrust, push-up, RDL, lunge, bicep curl and overhead press.
  - Joint angles are drawn on the client's body.
  - Corrections are spoken by the coach, with rep counting.
  - Tempo, rep-speed loss and reps-in-reserve are tracked, and the set can be recorded and played back.
  - Clients can also upload a video they filmed earlier.
- **Body scan.** Shows a posture picture with joint angles and asymmetries, plus fixes, and gives body fat by the US Navy method. Readings from a smart scale or InBody can be logged.
- **Accountability.** Training plan (implementation intention), plan-aware streak, weekly goal and supportive nudges.
- **Progress.** Body-fat trend, recurring form faults and session history.

The reasoning and references for every rule are in **[SCIENCE.md](SCIENCE.md)**.

## Run it
Camera access needs `https` or `localhost`.

```bash
npm start
```

Then open http://localhost:8080. To test on a phone, deploy the folder to any static host, such as Netlify, Vercel or Cloudflare Pages. It is a plain static site with no build step.

```bash
npm test
```

This simulates a full hip-thrust set and checks the coach's cueing logic.

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
| `js/exercises.js` | Per-exercise metrics, fault rules, rep/tempo/velocity engine |
| `js/feedback.js` | Motor-learning feedback scheduler: what to say and when to stay quiet |
| `js/coach.js` | Avatar plus voice: recorded clip, then cloned TTS, then device voice |
| `js/bodyscan.js` | Posture screen and body-fat calculation |
| `js/store.js` | Local storage (replace with a backend for the coach dashboard) |
