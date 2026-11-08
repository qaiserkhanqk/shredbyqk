# The science behind Shred by QK

Each rule in the app comes from a published principle. This file maps the code to the evidence, so a physio, a sports scientist or an investor can check it.

## 1. Motor learning: how the coach gives feedback (`js/feedback.js`)

| Principle | What the app does | Evidence |
|---|---|---|
| **External focus of attention** | Cues point at the environment or the result ("push the floor away", "spread the floor"), not at muscles ("squeeze your quads"). | Wulf, G. (2013). Attentional focus and motor learning: a review of 15 years. *Int Rev Sport Exerc Psychol*. |
| **One cue at a time** | Only the single highest-priority fault is spoken per rep. | Working-memory limits during skilled movement; standard coaching practice. |
| **Priority: safety first** | Rules are ranked 1 = joint safety, 2 = effectiveness, 3 = refinement. | Coaching triage |
| **Faded / bandwidth feedback** | A fault is cued once, then only if it repeats 2 reps in a row, and at most 3× per set. Small errors inside a tolerance band are ignored. | Winstein & Schmidt (1990) on reduced feedback frequency. Sherwood (1988) on bandwidth knowledge of results. *Guidance hypothesis*: feedback on every rep creates dependence. |
| **Feedback after good trials** | When the client fixes a cued fault, the coach praises that exact fix ("That's the spot, shins vertical"). | Chiviacowsky & Wulf (2007), *Res Q Exerc Sport*. |
| **Self-controlled feedback** | Tap QK mid-set to ask "how was that?" | Chiviacowsky & Wulf (2002). Learners who choose when to get feedback retain skills better. |
| **Summary feedback (KR)** | After the set: reps, clean reps, form score vs last time, and *one* focus point. | Schmidt et al. (1989) on summary knowledge of results. |
| **OPTIMAL theory** | Autonomy (the client picks the plan and asks for feedback), enhanced expectancies (comparison with their own last score), external focus. | Wulf & Lewthwaite (2016), *Psychon Bull Rev*. |

## 2. Biomechanics and the musculoskeletal system (`js/exercises.js`, `js/bodyscan.js`)

- **Individual anthropometry.** The allowed squat forward lean is calculated from each client's own femur-to-torso ratio. Long femurs force more lean to keep the centre of mass over mid-foot, so one fixed number would be wrong for many people. Sources: Fry et al. (2003), *J Strength Cond Res*; Demers et al. (2018).
- **Hip-thrust foot position** is judged by the client's shin angle at lockout (knee about 90°, shin vertical), not by a fixed distance. "Feet forward or back" is therefore personal to their leg length. Source: Contreras et al. (2015) on glute EMG in the hip thrust.
- **Range of motion.** Depth and lockout cues favour training in the lengthened position. Sources: Kubo et al. (2019) on squat depth and glute hypertrophy; Pedrosa et al. (2022) on lengthened-partial training.
- **Joint-safety faults** (knee valgus, lumbar hyperextension, sagging plank) get the highest priority and are never faded out.
- **Posture screen.** The scan measures frontal-plane shoulder and pelvic tilt, knee alignment and weight shift. In side view it measures head position, neck angle, shoulder position and knee extension. Up to about 3° of asymmetry is treated as normal variation. The scan refuses to judge a non-neutral stance, because a lunge or raised arms would show up as false asymmetry.
- **Smoothing and confidence gating.** Landmarks are exponentially smoothed. If landmark confidence is low, the coach says nothing: no feedback is better than wrong feedback.

## 3. Exercise physiology (`js/exercises.js`, `js/feedback.js`)

- **Velocity loss → proximity to failure.** Every rep's lifting (concentric) time is measured. Rep speed loss against the fastest early rep is a validated marker of fatigue and reps in reserve. Sources: Sánchez-Medina & González-Badillo (2011), *Med Sci Sports Exerc*; González-Badillo et al. (2017).
  - At ~25% loss: "It's getting hard, two more strong reps."
  - At ~40% loss: "That's a great place to end the set." Form breaks down in grinding reps, and the extra fatigue costs more recovery than it adds in stimulus.
- **Tempo.** If the lowering (eccentric) phase drops under 0.6 s on two reps running, the coach cues control. Controlled eccentrics keep load on the muscle and lower injury risk.
- **Rest intervals.** About 2 min for compound lifts and about 75 s for isolation work, plus extra when the set went close to failure. Source: Schoenfeld et al. (2016), *J Strength Cond Res*.
- **Body composition.** Uses the US Navy circumference method, which has a typical error of ±3–4% body fat against DEXA (Hodgdon & Beckett, 1984).
  - **Body water, muscle density and bone mass cannot be measured from a camera.** They need bioimpedance (an InBody or smart scale) or DEXA. The app logs those device readings rather than inventing numbers.
  - Photo-based body-fat AI does exist. The best validated is Amazon's visual body composition model, at about 2.2% mean error vs DEXA (Majmudar et al., 2022, *npj Digital Medicine*). It is a candidate for a later version, via a licensed API.

## 4. Behaviour change and accountability (`js/app.js`, `js/store.js`)

| Principle | What the app does | Evidence |
|---|---|---|
| **Implementation intentions** | The client sets days, time and place, and the app restates it as "On Mon, Wed, Fri at 18:00, I train at PureGym." | Gollwitzer & Sheeran (2006), meta-analysis: medium-to-large effect (d ≈ 0.65) on goal attainment. |
| **Self-Determination Theory** | Language supports autonomy ("you planned it, keep that promise to yourself") instead of controlling or shaming. Competence: form-score progress. Relatedness: QK's face and voice. | Ryan & Deci (2000), *Am Psychol*. |
| **Habit formation and "never miss twice"** | Missing one day is framed as normal. Unplanned rest days don't break the streak; only missing a planned day does. | Lally et al. (2010): habits take a median of ~66 days, and a single missed day does not derail habit formation. |
| **Identity-based framing** | "That's a vote for the person you're becoming." | Identity-based motivation (Oyserman, 2009). |
| **Social presence** | A familiar coach's face and voice, plus a recorded-voice option. | Social facilitation and the working alliance in coaching: the reason people pay for in-person PT. |

## 5. Motion tracking (`js/motion.js`)

- **Movement path.** One key point is traced through every rep: the hips for squats, hip thrusts and lunges, the wrist (bar) for RDLs, curls and presses, and the shoulder for push-ups. In squats and deadlifts an efficient bar path stays close to vertical over mid-foot. Sideways drift of more than about 25% of torso length is flagged in the set summary.
- **Range of motion per rep.** Each rep's joint range is measured. A rep under 85% of the set's best range counts as a partial rep. Partial reps reduce the training stimulus, especially in the lengthened position (Pedrosa et al. 2022).

## 6. Gait analysis (`js/gait.js`)

| Measure | How it's measured | Typical range | Evidence |
|---|---|---|---|
| Gait events | Heel strike is the foot's most-forward point relative to the pelvis; toe-off is its most-backward point. | — | Zeni, Richards & Higginson (2008), *Gait & Posture*: coordinate-based event detection |
| Cadence | Median step time | Walk 100–125, run 160–190 steps/min | Perry & Burnfield, *Gait Analysis* |
| Stance time | Heel strike to toe-off, as a % of the stride | Walk ~60% | Perry & Burnfield |
| Knee bend in swing | Peak knee flexion between toe-off and the next heel strike | Walk ~55–70° | Perry & Burnfield |
| Hip extension | Thigh angle behind vertical in late stance | Walk 8°+ | Reduced hip extension is linked to tight hip flexors and shorter stride |
| Left/right symmetry | Robinson symmetry index | Under 10% | Robinson et al. (1987) |
| Pelvic drop (front view) | Hip-line tilt during single-leg stance | Under 5° | Trendelenburg sign; glute medius weakness |
| Overstriding (running) | Foot lands far ahead of the hips with a near-straight knee | — | Heiderscheit et al. (2011): a 5–10% cadence increase lowers knee and hip loading |

Each finding maps to corrective exercises. Results are flagged as a screen: a phone gives a 2D estimate, not a 3D gait-lab measurement.

## 7. Exercise library (`js/library.js`)

84 exercises are grouped by **movement pattern**. A pattern is defined by the joint that moves, how a rep is counted and which faults matter. Different exercises in the same pattern share the same biomechanics (for example, a cable row and a dumbbell row are both horizontal pulls), so they share the same checks. Movements the camera can't measure reliably from one 2D view are **tempo-coached by voice instead**, with no form score shown: rotation (Russian twist), loaded carries, small wrist movements and machine hip abduction. Tempo coaching uses about 3 s lowering, 1 s pause and 1 s lifting. Controlled eccentrics increase time under tension and lower injury risk.

## 8. Single-camera measurement tests (`js/vbt.js`, `js/jump.js`, `js/kneetest.js`, `js/measure.js`)

| Test | Method | Evidence | Measured accuracy on known-answer synthetic tests |
|---|---|---|---|
| **Bar speed (VBT)** | Bar tracked through the wrists (or shoulders for squats). A 45 cm plate tapped on screen converts pixels to metres. Mean concentric velocity is timed over the upward movement only, so pauses don't count. | Load–velocity relationship and minimum velocity thresholds: González-Badillo & Sánchez-Medina 2010; Jovanović & Flanagan 2014. Velocity zones: Mann. | 0.64 vs true 0.625 m/s (+2.5%); within 0.05 m/s with jitter; 1-rep max exact on a known line |
| **Jump height** | Flight time: h = g·t²/8 (Bosco 1983). Take-off and landing are interpolated between frames; the hip rise cross-checks for tucked legs. | Basis of jump mats and the validated My Jump app | ±0.6 cm at 240 fps, ±1.2 at 120, ±2.3 at 60, ±4.7 at 30 |
| **Knee test** | Frontal plane projection angle on a single-leg squat, measured at the deepest point, per leg | Willson & Davis 2008; Munro et al. 2012 | Within 1.5° clean, 2.5° with jitter |
| **Scale** | Plate taps (exact) or height × 0.779 shoulder-to-ankle (Drillis & Contini), used only for standing lifts | Anthropometric segment tables | Exact maths; height method ±5% between people |
| **Recording quality** | Score from frame rate, joint visibility, body in frame and camera view. Results are blocked below 40/100. | — | Every rule unit-tested |

These are tests against simulated movement with known answers: they prove the maths, not real-world accuracy. Real-world accuracy comes from the validation study in TESTING.md.

## 9. Rehab clinic (`js/rehab.js`, `js/rom.js`)

Rehab **support**, modelled on how physiotherapy clinics run rehabilitation. It doesn't diagnose, and it doesn't "cure everything". No clinic can promise that, and claiming it would be unsafe and misleading.

**18 conditions** across 9 body areas:
- **Back and neck:** lower back pain, neck pain.
- **Shoulder and elbow:** frozen shoulder, rotator cuff pain, tennis elbow, golfer's elbow.
- **Hip and knee:** gluteal tendinopathy, hip/knee osteoarthritis, patellofemoral pain, patellar tendinopathy, ACL, PCL, degenerative meniscus tear.
- **Thigh, leg and foot:** hamstring strain, Achilles tendinopathy, ankle sprain, plantar heel pain, shin splints.

| Component | How it works | Basis |
|---|---|---|
| **Safety screen** | General and region-specific red flags. Emergency signs (bladder or bowel changes, DVT signs, chest pain, neck-artery symptoms) stop the programme and show the emergency number. Questions about how an injury happened send unassessed injuries to a clinician, but don't block someone already diagnosed. ACL, PCL and meniscus require a diagnosis before starting. | Standard musculoskeletal red-flag screening; Ottawa ankle and knee rules |
| **Phased programmes** | 3–4 phases per condition. A phase is passed on **criteria**, with a minimum time: pain, measured movement, side-to-side symmetry and daily function. | Criteria-based progression (e.g. Grindem 2016 for ACL return to sport) |
| **Pain monitoring** | Traffic light from pain during exercise, after it, and the next morning, with a limit per condition: 3/10 generally, up to 5/10 for tendon problems, 0 for hamstring strain. | Pain-monitoring model (Silbernagel et al. 2007) |
| **Function** | Patient-Specific Functional Scale: 1–3 of the client's own activities rated 0–10, re-rated weekly. | Stratford et al. 1995 |
| **Camera measurements** | Shoulder raise forward and sideways; forward and backward bend; knee bend and straightening; knee-to-wall ankle bend; 30-second sit-to-stand; single-leg calf-raise endurance; single-leg hop distance; drop-landing knee drift. The 95th-percentile peak is used so one jittery frame can't inflate a result. Left and right are compared as a limb symmetry index. | Standard clinical tests; LSI ≥90% as a common return-to-sport criterion |
| **After surgery** | ACL and PCL are marked as physio-led. The surgeon's protocol overrides the app. | — |

Each condition's evidence summary (NICE NG59, NG226; JOSPT clinical practice guidelines; CSAW, LEAP, Kise, Coombes, Askling, Grindem and others) is shown in the app.

**All rehab content must be reviewed and signed off by a registered physiotherapist before public release.**

## 10. Known limits (honest list)

- A 2D camera can't see rotation well. One angle per exercise is the best it can do, so the setup instructions tell the client where to put the phone.
- Thresholds are evidence-informed starting points. **They must be tuned on real client footage reviewed by QK**, and this is the most important next step.
- The posture scan is a screen, not a diagnosis. Anyone with pain is told to see a physio.
