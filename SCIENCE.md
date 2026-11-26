# The science behind Shred by QK

Each rule in the app comes from a published principle. This file maps the code to the evidence, so a physio, a sports scientist or an investor can check it.

## 1. Motor learning: how the coach gives feedback (`js/feedback.js`)

| Principle | What the app does | Evidence |
|---|---|---|
| **External focus of attention** | Cues point at the environment or the result ("push the floor away", "spread the floor"), not at muscles ("squeeze your quads"). | Wulf, G. (2013). Attentional focus and motor learning: a review of 15 years. *Int Rev Sport Exerc Psychol*. |
| **One cue at a time** | Only the single highest-priority fault is spoken per rep. | Working-memory limits during skilled movement; standard coaching practice. |
| **Priority: safety first** | Rules are ranked 1 = joint safety, 2 = effectiveness, 3 = refinement. | Coaching triage |
| **Immediate correction, then shorter cues** | Every faulty rep is corrected straight away, mid-rep where the fault can be seen during the movement, like an in-person coach. After two full cues the coach switches to a short shout ("Knees out!"), so feedback gets lighter as the lifter learns it. Small errors inside a tolerance band are ignored. Trade-off: research favours reducing feedback over time for long-term learning, so the short shout is a compromise; if lifters come to depend on the cues, switch back to cueing less often. | Winstein & Schmidt (1990) on reduced feedback frequency. Sherwood (1988) on bandwidth knowledge of results. *Guidance hypothesis*: feedback on every rep creates dependence. |
| **Feedback after good trials** | When the client fixes a cued fault, the coach praises that exact fix ("That's the spot, shins vertical"). | Chiviacowsky & Wulf (2007), *Res Q Exerc Sport*. |
| **Self-controlled feedback** | Tap QK mid-set to ask "how was that?" | Chiviacowsky & Wulf (2002). Learners who choose when to get feedback retain skills better. |
| **Summary feedback (KR)** | After the set: reps, clean reps, form score vs last time, and *one* focus point. | Schmidt et al. (1989) on summary knowledge of results. |
| **OPTIMAL theory** | Autonomy (the client picks the plan and asks for feedback), enhanced expectancies (comparison with their own last score), external focus. | Wulf & Lewthwaite (2016), *Psychon Bull Rev*. |

## 2. Biomechanics and the musculoskeletal system (`js/exercises.js`, `js/bodyscan.js`)

- **Individual anthropometry.** The allowed squat forward lean is calculated from each client's own femur-to-torso ratio. Long femurs force more lean to keep the centre of mass over mid-foot, so one fixed number would be wrong for many people. Sources: Fry et al. (2003), *J Strength Cond Res*; Demers et al. (2018).
- **Hip-thrust foot position** is judged by the client's shin angle at lockout (knee about 90°, shin vertical), not by a fixed distance. "Feet forward or back" is therefore personal to their leg length. Source: Contreras et al. (2015) on glute EMG in the hip thrust.
- **Range of motion.** Depth and lockout cues favour training in the lengthened position. Sources: Kubo et al. (2019) on squat depth and glute hypertrophy; Pedrosa et al. (2022) on lengthened-partial training.
- **Map my body: personal limits for every camera exercise (`js/bodymap.js`).** A one-minute guided calibration. Side-on: stand still, rise onto the toes, 3 slow squats, reach overhead, 2 slow hinges. Facing the camera: stand still, arms out and up, 2 slow squats. It measures:
  - limb proportions (thigh-to-torso, arm-to-torso)
  - how straight the knees, hips and elbows go standing relaxed, and the standing body line
  - toe-rise height
  - comfortable squat depth, shin angle at depth (an ankle-dorsiflexion proxy) and heel rise
  - shoulder flexion and abduction range
  - hinge range (trunk-to-thigh angle with soft knees, a hamstring-length proxy)
  - knee width standing and at depth

  `personalFor(pattern, body)` turns these into limits for each of the 20 movement patterns, so every one of the 66 camera exercises is judged against the lifter's body. Limits move only where the body explains it, and never ask for more range than the person showed:

  | Pattern | What's personal | Why |
  |---|---|---|
  | Squat | Lean allowed, depth target and rep counting, knee-caving limit, lockout | Long femurs need more lean (Fry 2003; Demers 2018); limited dorsiflexion reduces depth and adds lean (Kim 2015; Macrum 2012; Dill 2014) |
  | Lunge | Torso lean, depth | Same proportions and ankle effects |
  | RDL / hinge | Depth target (new rule: only judged once the body map knows hamstring length), lockout | RDL depth ends where the spine would round, which hamstring length sets |
  | Bench, push-up | Pressing depth from arm-to-torso length | Long arms travel further; short arms reach the chest with less elbow bend |
  | Overhead press, dip, triceps, pull-down, row, curl | Lockout / full stretch against how straight their elbows go | Elbow extension varies (0° typical; a few degrees of hyperextension or a lack of full extension are both normal), so nobody is told to straighten past their joint |
  | Raises | Height target if shoulder range is limited | Normal shoulder flexion/abduction ≈ 180° (AAOS) |
  | Calf raise | Top height from their own toe rise | Plantarflexion range varies |
  | Leg raise | Height from hamstring length | Straight-leg height is limited by the hamstrings |
  | Leg extension / curl, hip thrust | Lockout against their straight knee / hip | Knee recurvatum and hip posture vary |
  | Plank, push-up | Body line from their standing posture | Natural spinal curves differ |
  | Fly, crunch | Nothing | Nothing measured changes what's correct |

  Simulated people with long thighs, tight ankles, tight hamstrings, short arms and elbows that don't fully straighten show why this matters (`tests/bodymap.test.mjs`). With textbook numbers, some of their full-range reps never count, or they're told to "lock out" past what their joints allow. With their body map those reps count and are clean. They're still cued when they fall short of their own range.

- **Recognising the exercise (`js/detect.js`).** The detector works on a sliding 3.5-second window. It uses:
  - posture: torso and thighs relative to vertical tell standing, bent over, lying or hanging apart
  - the range each joint angle moves through (90th minus 10th percentile, so jitter is ignored)
  - where the hands are relative to the head, shoulders and elbows
  - whether the body travels while the hands stay fixed (that's a pull-up)
  - at least one full cycle of the main joint

  It recognises 20 movements within about one rep (`tests/detect.test.mjs`), including with ±4 px of simulated camera jitter, and ignores standing still or half a rep. Pairs a 2D camera can't separate, such as a seated overhead press and a lat pulldown, come with a one-tap alternative. While a new exercise is being recognised, the old one's rules are paused so they don't misread it.
- **Moving too much (steadiness checks).** Each is measured against the lifter's own position at the start of the rep (`ctx.top`), in torso lengths, so build, stance and camera distance don't matter. Only movement during the rep counts:
  - torso swing over 12° or hip travel over 0.15 torso lengths on curls and triceps (10° on raises)
  - torso angle change over 15° on rows
  - side tilt over 10° on overhead presses
  - feet sliding over 0.2 torso lengths, or hips shifting sideways over 0.12, on squats

  Clean reps with camera jitter don't trigger them (`tests/steady.test.mjs`).
- **Squat depth facing the camera.** The knee bends towards the lens, so the 2D knee angle barely changes. Depth comes from how far the hips drop towards the ankles, scaled by shin length, and is mapped onto the same knee-angle thresholds.
- **Squat: hips rising first.** Judged early in the drive up (40% of the way from the bottom to standing). If the torso has tipped forward more than 10° compared with the bottom position, the hips are rising ahead of the chest and the squat is turning into a good morning, which moves load to the lower back. Comparing with the lifter's own bottom position, not a fixed angle, keeps this fair for long femurs.
- **Squat: heels lifting.** The heel's height above the toe, as a fraction of foot length, is compared with the lifter's own standing value at the start of the set (so camera tilt cancels out). A rise of more than 0.3 of foot length at the bottom is flagged. Only on free-standing squats, not on a leg press, hack squat or slant board.
- **Bench: shoulder blades (scapular retraction).** A side-on 2D camera can't see the shoulder blades, so this is a proxy: if the shoulder point rises off the bench by more than 20% of upper-arm length between the bottom and lockout, the shoulders have rolled forward (protracted) instead of staying pinned. Treat it as a screen until it's validated on filmed lifts.
- **Bench: leg drive.** A camera can't measure force through the feet. It can see whether the feet are set to drive: feet under or slightly behind the knees (knee angle under 140°) and on the floor (ankles below the bench line). Hips lifting off the bench by more than 10% of torso length during the press is flagged separately. Not applied on the decline press, where the feet are hooked.
- **Motion graphics (`js/fx.js`).** When QK cues a fault, an animated graphic on the body shows the correction (knees pushed out, heel pressed down, chest leading, shoulders pinned, feet driving). It appears at the same moment as the voice, every time a fault is cued, and it shows the target rather than the error (external focus, Wulf 2013). A fixed fault gets a green check, and a clean rep a short green ring.
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

## 10. Sukoon calm session (`js/sukoon.js`, `js/calm.js`)

A 5–15 minute session: rate tension (0–10) → slow breathing with optional tones → a short Quran recitation → a dua from the Sunnah → rate tension again. Evidence, strongest first:

| Component | What the app does | Evidence | Strength |
|---|---|---|---|
| **Slow breathing** | On-screen pacer, 5 s in / 5 s out = 6 breaths/min, for 2–10 minutes. | Breathing near 6/min maximises heart-rate variability and baroreflex sensitivity (Lehrer & Gevirtz 2014, *Front Psychol*). Reciting prayer and mantras slows breathing to about 6/min (Bernardi et al. 2001, *BMJ* 323:1446). | Strong |
| **Listening to the Quran** | A passage matched to the goal by meaning, streamed verse by verse from EveryAyah. | Systematic review of 28 trials: anxiety fell in almost all of them; many were small or weakly designed (Ghiasi & Keramat 2018, [doi:10.4103/ijnmr.IJNMR_173_17](https://doi.org/10.4103/ijnmr.IJNMR_173_17)). RCTs before chemotherapy ([doi:10.1002/nop2.781](https://doi.org/10.1002/nop2.781)), after surgery ([doi:10.1016/j.jopan.2022.02.006](https://doi.org/10.1016/j.jopan.2022.02.006)) and during MRI ([doi:10.1177/13591053261489102](https://doi.org/10.1177/13591053261489102)). | Moderate |
| **Binaural beats** | Two sine tones, one per ear, differing by the beat rate (delta 2, theta 6, alpha 10, gamma 40 Hz). Pulsing (isochronic) mode for phone speakers. Volume capped and faded in over 4 s. | Meta-analysis of 22 studies, g = 0.45 for anxiety, pain and cognition (Garcia-Argibay et al. 2019, [doi:10.1007/s00426-018-1066-8](https://doi.org/10.1007/s00426-018-1066-8)). Perioperative meta-analysis of 15 RCTs: less anxiety and pain, but high heterogeneity (Xiong et al. 2025, [doi:10.1016/j.ctim.2025.103299](https://doi.org/10.1016/j.ctim.2025.103299)). | Moderate |
| **432 Hz, 528 Hz, 7.83 Hz** | Used only for "Love" and "Healing", and labelled **weak evidence** in the app. | Two small 432 Hz pilots ([doi:10.1016/j.explore.2019.04.001](https://doi.org/10.1016/j.explore.2019.04.001), [doi:10.23750/abm.v93iS2.12915](https://doi.org/10.23750/abm.v93iS2.12915)). One 528 Hz trial found saliva-marker changes but no cognitive change ([doi:10.1002/brb3.71452](https://doi.org/10.1002/brb3.71452)). No human trials for the Schumann resonance. | Weak |
| **40 Hz for focus** | Gamma tone for "Focus & study", labelled weak. | 40 Hz stimulation is studied mainly in Alzheimer's disease. Benefits for study in healthy people are unproven. | Weak |

**Usability choices (from the research in `.claude/agents/ux-researcher.md`)**
- Default breathing is 5 minutes: a 2023 review found sessions under 5 minutes differed from 5 minutes or more, with little gained beyond that ([Brain Sci 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10741869/)).
- A rising/falling chime and a vibration mark each breath, so the pacer works with eyes closed. Haptic or combined guidance produced cardiac coherence at 6 breaths/min ([PMC10181630](https://pmc.ncbi.nlm.nih.gov/articles/PMC10181630)). iPhone browsers can't vibrate, so the sound is the main cue there.
- Ratings are one tap on a 0–10 row with nothing pre-selected, so the "after" answer isn't anchored to the "before" one. Both can be skipped.

**Religious design choices**
- No verse or hadith assigns a frequency to a surah. Surahs are matched to a goal by their meaning only, and the app says so.
- Tones stop (3 s fade) before the recitation starts, so the Quran is listened to in silence (7:204). There is deliberately no option to play tones under the recitation.
- Every dua shows its source: Bukhari 6369, 6115, 6324, 5743; Tirmidhi 3433; Quran 3:173, 18:39, 20:114, 25:74. Notes cite Abu Dawud 4782 and 3855, Ibn Majah 3509, Tirmidhi 2892 and Bukhari 5017, 5736.
- **A qualified scholar should review the surah pairings, the dua texts and translations before public release.**

**Safety**
- A tension rating of 9–10 (before or after) shows emergency numbers and a helpline finder before anything else. "I'm not OK" is always visible during the session.
- The screen states that Sukoon is a wellbeing exercise, not treatment for anxiety disorders, depression or panic.
- The before/after ratings are self-reported. The trend ("works best for you") needs at least 2 sessions per goal.

## 11. Technique sources and the exercise database

- **Technique criteria follow the NSCA**: the *Exercise Technique Manual for Resistance Training* (4th ed., Human Kinetics 2022, 100 exercises with checklists) and *Essentials of Strength Training and Conditioning* (4th ed., Haff & Triplett 2016, ch. 15). These are the references certified strength coaches (CSCS) are trained on. They're copyrighted, so the app encodes their checkpoints as its own rules and wording rather than copying text. NASM's overhead-squat compensations are used only as vocabulary for camera-visible faults.
- **Normal joint ranges** used in explanations follow AAOS / Norkin & White (shoulder flexion and abduction ≈ 180°, elbow extension 0°, knee extension 0°). Population data: CDC normal joint range of motion study (Soucie et al. 2010).
- **Open exercise databases were reviewed and not used for form cues.**
  - free-exercise-db is public domain (876 entries), but its instructions contain errors. For example, it says knees past the toes in a squat is wrong, which Fry et al. 2003 contradicts.
  - wger is CC-BY-SA, so derived data would have to share alike.
  - ExRx, ACE and ACSM are all rights reserved.
  - The open data is suitable for exercise names and muscle metadata only.
- **Imported exercises (`js/library-extra.js`).** 124 exercises from free-exercise-db (Unlicense, public domain).
  - `tools/exercise-candidates.py` sorted its 622 strength and powerlifting entries into 324 pattern candidates by name.
  - Each candidate was then reviewed by hand (`KEEP` list in `tools/import-exercises.py`). Left out:
    - duplicates of existing exercises
    - band, chain and speed variants
    - Olympic and get-up movements
    - alternating or one-arm presses, pulls and curls, which the camera's evenness and side-picking logic would miscount
    - behind-the-neck pulls
    - kneeling or overhead-cable curls and crunches, where the camera angle doesn't match the pattern
  - Each kept exercise inherits its pattern's NSCA-based rules and the lifter's personal limits.
  - Flags on each exercise scope the rules: free-standing squat, bench with feet down, or a rule that doesn't apply. For example, a preacher curl's arm rests on the pad at an angle, so the "elbow swing" check is off. That also fixed two existing false alarms, on the preacher curl and the conventional deadlift. A deadlift's knees bend by design, so "squatting, not hinging" no longer fires on it or on the kettlebell swing.
- **More training types (`js/library-more.js`, `js/library.js`).**
  - From free-exercise-db: plyometrics (58), Olympic lifts (35), stretching and mobility (121) and cardio (14). Strongman entries are left out, and only names, equipment, muscles and level are used.
  - `tools/import-categories.py` gives each one a coaching mode and a guide in the app's own words. Olympic squat, press and hinge variants use the matching camera checks; the full lifts are labelled as needing a coach, because they're too fast and complex for a phone to judge reliably.
  - Running sessions and HYROX are hand-written. HYROX uses the race order and distances (8 × 1 km run plus SkiErg, sled push, sled pull, burpee broad jump, row, farmer's carry, sandbag lunges and wall balls); weights vary by division, so the app points to hyrox.com.
  - Pilates follows the classical mat order from Joseph Pilates' *Return to Life Through Contrology* (1945), with guides in the app's own words.
- **Not yet verified:** NSCA text, wording against the manual itself (it couldn't be fetched); the exact ankle dorsiflexion cut-off (no consensus value was found, so the app uses a conservative 28° shin angle and doesn't quote a "typical" number).

### NSCA-based rules (built from the sources above, read directly)

Eleven NSCA documents were read in full, and 220 checkpoints were extracted: 190 a 2D camera can check, 30 it can't. NSCA's article pages (Kinetic Select) refuse automated access, so the Romanian deadlift and kettlebell swing pages weren't used. Rules cite their source with `src` in `js/exercises.js`, and the set summary names it.

| Rule | What QK says | NSCA source |
|---|---|---|
| `sq_valgus`, `sq_heels`, `sq_depth` | knees caving in, heels lifting, depth | TSAC Exercise Technique module 3.2-5 (S1) |
| `sq_chest` | chest up | PTQ 1.3, barbell back squat form (S3) |
| `fsq_elbows` (new) | front squat: elbows up | S1, "elbow position not maintained" |
| `dl_hips_first` (new) | deadlift: chest and hips rise together | Weightlifting position statement 2023, movement errors (S2) |
| `rdl_bar` (new) | keep the bar close to the legs | S2 "inability to keep the bar close"; S1 "bar doesn't travel in a straight line" |
| `rdl_arms` (new) | straight arms in the pull | S1 "elbow position not maintained" |
| `rdl_locked` (new) | Romanian/stiff-leg deadlift: soft knees | S1 "maintain slight knee flexion" |
| `lu_stride` (new), `lu_depth` | longer step; back knee to the floor | PTQ 4.4 "The Undervalued Lunge", Table 1 (S7) |
| `bp_head` (new), `bp_butt`, `bp_legs`, `bp_depth` | five points of contact; touch the chest | S1 bench press key points and errors |
| `pr_stack` (new) | wrists over elbows | S1 "hands, elbows, shoulders not in the same vertical plane" |
| `row_angle` (new), `row_body` | torso near parallel; no swinging | S1 bent-over row |
| `pu_hands` (new), `pu_sag`, `pu_pike` | hands under shoulders; rigid body | PTQ 10.2 teaching progressions (S9) |

**Tips the camera can't check**, such as bracing, grip, head position and pulling in front of the neck, appear on the setup screen as "NSCA tips" (`TIPS` in `js/exercises.js`).

**Where NSCA disagrees with other evidence, or with itself, and what QK does** (decided by the owner on 2026-11-26):
1. **Knees past toes:** not cued. NSCA lists it as an error, but restricting forward knee travel shifts load to the hips and lower back (Fry et al. 2003). A test confirms no rule cues it.
2. **Lunge torso:** forward lean is allowed, within the body-map limit. "The Undervalued Lunge" wants an upright torso, while PTQ 1.3 recommends about 45°; both cite the same study.
3. **Squat depth:** NSCA's "thighs parallel" is the minimum target, never a maximum. Deeper is allowed (Hartmann et al. 2013).
4. **Bench arch:** only the buttocks lifting off the bench is flagged, not a moderate arch.
5. **Lat pulldown:** full arm extension by default. For anyone on the frozen-shoulder or rotator-cuff rehab plan, QK stops short of full extension (TSAC Report 80, S8).
6. **Breathing:** the tip covers both groups. Brace and hold on heavy sets (NSCA Coach 4.1, S5), but breathe out as you lift if over 65 or with high blood pressure or a heart condition (older-adults position statement, S6).

## 12. Body check: heart rate, HRV and alertness with only the phone (`js/hr.js`, `js/vitals.js`)

No wearable is needed. All processing happens on the phone.

| Measure | How | Accuracy (published) | Our own check |
|---|---|---|---|
| **Heart rate** (15 s) | Fingertip over the back camera, flash on where the browser allows. Each beat darkens the red image; beats are found, timed and averaged. Noisy or irregular recordings are rejected, not reported. | Fingertip camera apps: within about 2–4.5 bpm of ECG ([Coppetti 2017](https://doi.org/10.1177/2047487317702044)); within about 1 bpm with a regular rhythm, worse with an irregular one ([Pipitprapat 2018](https://doi.org/10.1080/07853890.2018.1531144)). Face-scanning apps were worse (7–8 bpm), so only the fingertip method is used. | Synthetic signals 48–165 bpm: within ±2 bpm. Fake-camera videos through the real browser: 52, 64, 72, 110 bpm read 52, 64, 73, 110. |
| **HRV, RMSSD** (1 min, morning) | Same recording for 60 s. Each beat is timed by matching an average beat shape across the whole waveform, refined between frames, because a single peak sample is too noisy at 30 fps. Readings with more than 10% irregular beats are rejected. | Phone-camera HRV correlates strongly with ECG but reads high ([Comfort 2026](https://doi.org/10.1007/s00406-026-02239-5)). A 60 s recording is long enough: ECG RMSSD from 30 s already agrees well with 5 minutes, and 120 s almost perfectly ([Munoz 2015](https://doi.org/10.1371/journal.pone.0138921)). | Reads 0–11 ms high, most when HRV is low, because of frame timing and camera noise. **So it is only ever compared with the person's own last 30 days (normal = within 1 SD, after 5 readings), never with norms or other devices.** |
| **Alertness** (3 min) | PVT-B: numbers start counting at random every 2–5 s; tap as fast as possible. Lapse = 355 ms or slower; false start = early tap or under 100 ms. Response speed (1/RT) is the main measure. | The 3-minute phone PVT tracked 38 h of sleep loss against the 10-minute lab test ([Grant 2017](https://doi.org/10.3758/s13428-016-0763-8)); negligible practice effect over 16 repeats ([Basner 2018](https://doi.org/10.1093/sleep/zsx187)). Night shifts slowed doctors from 257 to 283 ms ([Weetman 2024](https://doi.org/10.1136/oemed-2023-109311)). | Screens add device-specific delay, so results are only compared on the same phone. The shorter adaptive version (PVT-BA) needs a published algorithm we don't have, so the validated 3 minutes is kept. |

**Accuracy upgrades** (all checked with `tests/hr.test.mjs` and the real-browser camera check):
- **Frame rate:** the camera is asked for 60 fps; beat timing uses the camera's real rate instead of resampling to 30, so a 60 fps phone keeps its finer timing.
- **Locked camera:** once the fingertip settles, exposure, white balance and focus are locked where the browser allows (Chrome on Android), so automatic brightness changes don't look like pulse waves.
- **Best colour channel:** red and green are both analysed and the cleaner one is used (a strong flash can max out red). A completely flat signal is now rejected; before, it could be mistaken for a 200 bpm pulse.
- **Live quality line** during the reading: "Good signal", "Press a little lighter", "Hold still".
- **2-minute HRV option:** ECG RMSSD from 120 s agrees almost perfectly with 5 minutes ([Munoz 2015](https://doi.org/10.1371/journal.pone.0138921)).
- **7-day average** shown as the number to watch, the way morning HRV is used in sport.

Results on fake fingertip videos through the real app in Chromium (`tools/make-pulse-video.py` → `tests/camera-pulse.cjs`):

| True | 30 fps | 60 fps |
|---|---|---|
| HRV 4.8 ms (very low) | 5.4 ms (was 15–16 ms before these changes) | 5.2 ms |
| HRV 14.5 ms, heart rate 58 bpm | – | 14.4 ms, 58 bpm |

Real fingers are noisier than these videos, so the real-world check below still matters.

**Checking against a chest strap:** Body check → *Check it against a chest strap*. After each reading the client types in the strap's value for the same minute. With 10+ HRV pairs, `fitCorrection` (in `js/hr.js`) fits ln(strap) = a + b·ln(camera) and the client can turn the correction on; raw values are always kept. Comparisons export as CSV for `npm run validate` (bias, MAE, limits of agreement, ICC).

**Native app** (`native/README.md`): a Capacitor wrapper with a native pulse-camera plugin (flash on iPhone, up to 120–240 fps, locked exposure). The JavaScript side uses it automatically. The Swift and Kotlin plugins have not yet been compiled or tested on a device.

**Where it's used:** the Body check screen; the Today readiness card adds today's HRV and alertness against the client's normal; Sukoon can measure heart rate before and after.

**Cyclic sighing** (Sukoon breathing style): 2 s breath in, 1 s top-up breath in, 6 s slow breath out (about 6.7 breaths/min). Five minutes a day improved mood more than mindfulness meditation in a Stanford RCT ([Balban 2023](https://doi.org/10.1016/j.xcrm.2022.100895)); one trial, not yet independently repeated.

**Safety:** nothing here diagnoses. The app tells people to see a doctor if resting heart rate is often above 100 or below 40 without a reason, or if they feel their heart racing or skipping.

**Reproducing the camera check:** `python3 tools/make-pulse-video.py out.y4m 72 30` makes a fake fingertip video with a known heart rate and HRV; `node tests/camera-pulse.cjs out.y4m hrv` runs it through the app in Chromium.

## 13. Known limits (honest list)

- A 2D camera can't see rotation well. One angle per exercise is the best it can do, so the setup instructions tell the client where to put the phone.
- The body map is a bodyweight measurement. Under a heavy bar, depth and lean can differ, so re-map every few weeks. Some limits are estimates from 2D proportions (pressing depth from arm length); validate them on filmed lifts. Dip depth (limited by shoulder extension) isn't measured yet.
- Thresholds are evidence-informed starting points. **They must be tuned on real client footage reviewed by QK**, and this is the most important next step.
- The posture scan is a screen, not a diagnosis. Anyone with pain is told to see a physio.


## Progression: how QK picks the next weight (`js/progression.js`)

| Rule | Why |
|---|---|
| Beginners add weight every session while reps are hit cleanly (3 × 8) | Linear and undulating periodisation give the same 1RM gains in untrained people (Moesgaard et al. 2022, Sports Med, doi:10.1007/s40279-021-01636-1) |
| After two misses a barbell lift moves to a weekly wave: heavy 4 × 5 (×1.10), medium 3 × 8, light 3 × 12 (×0.85) | Undulating beat linear for 1RM in trained lifters, ES 0.61 (Moesgaard 2022). Older review: no difference (Harries 2015, doi:10.1519/JSC.0000000000000712) |
| Dumbbell, machine, cable and isolation lifts: double progression in 8–12 reps, then the smallest weight step | Rep progression and load progression gave similar results (Plotkin et al. 2022, PeerJ, doi:10.7717/peerj.14142) |
| The jump depends on last time: reps hit, rep-speed loss under 30%, 80%+ reps clean | Autoregulated loading matches or beats fixed loading (Hickmott 2022, doi:10.1186/s40798-021-00404-9; Zhang 2021, doi:10.3389/fphys.2021.651112). Velocity loss tracks reps in reserve (González-Badillo 2017, doi:10.1055/s-0042-120324; Rodríguez-Rosell 2020, doi:10.1519/JSC.0000000000002881) |
| Steps: lower-body barbell 5 kg / 10 lb, upper-body barbell 2.5 kg / 5 lb, dumbbell & machine 2.5 kg / 5 lb, isolation 1 kg / 2.5 lb. Barbells round to 2.5 kg / 5 lb | Smallest loadable jumps in a normal gym |
| Two misses in a row: back off 10% | Common coaching practice; lets the lifter rebuild momentum |
| Light week every ~7 training weeks, or when 2+ lifts backed off in 3 weeks: same weight, a third fewer sets | A full week off cost strength (Coleman et al. 2024, PeerJ, doi:10.7717/peerj.16777); coaches mostly cut volume 0–25% (De Marco 2024, doi:10.1519/JSC.0000000000004932) |
| Strength chart: estimated 1RM (Epley, up to 12 reps), best per session / week / month | Standard estimate; reps above 12 are too unreliable |

Limits: the trials are short (5–10 weeks) and mostly young men. The coach or lifter can override any weight.
