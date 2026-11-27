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

## Food: desi calorie estimates (`js/nutrition.js`, `js/foodphoto.js`)

The full reasoning and the database comparison are in [docs/NUTRITION.md](docs/NUTRITION.md).

| Rule | Why |
|---|---|
| Desi dishes are computed from a recipe (raw meat + base ingredients + fat), not read from one database row | The same karahi ranges from about 280 to 480 kcal per katori depending on the oil. A single value is wrong for most plates |
| Fat per serving depends on who cooked it (home / restaurant / shaadi-dhaba) | Fat is the largest and least visible source of error. Home values are set so home-style dishes match INDB recipes (9 dishes within 25%, median ≈10%) |
| Meat share moves the gravy, and the oil moves with the gravy | A katori of mostly pieces carries less masala and oil. Fat scales as 0.3 + 0.7 × gravy share, because pieces stay coated |
| Meat is counted raw and edible (bone excluded); cooked weight ≈ 70% of raw | USDA yield tables for stewed and grilled meat |
| Fried foods count oil **absorbed**, not oil in the pan | INDB counts all frying oil, giving 577 kcal/100 g for a samosa; absorbed-oil models land at 260–330 |
| Every estimate shows a likely range: √((portion SD × total)² + (fat SD × fat kcal)² + (0.15 × meat kcal)²) | Portion SD is 10% for counted items, 20% for katori and plate, 30% from a photo. Fat SD is 25% if you said who cooked it, 40% if not. The day's range combines dishes as √Σsd², since errors on separate dishes partly cancel |
| Photo: the model identifies and measures only; calories come from the dish models | Asking a language model for calories gives a different number each time. Fixed catalogue ids, a strict schema, 3 samples with majority dish and median portion, and caching by image hash make the same plate give the same answer |
| Targets: Mifflin-St Jeor × activity (1.375 / 1.55 / 1.725), −20% to lose fat, +10% to gain | Mifflin-St Jeor is the most accurate of the common resting-energy equations in non-obese adults (Frankenfield et al. 2005, J Am Diet Assoc) |
| Protein 1.8 g/kg (2.0 g/kg when losing fat) | Gains plateau around 1.6 g/kg, with a 95% CI up to 2.2 (Morton et al. 2018, Br J Sports Med); higher intakes help keep muscle in a deficit (ISSN position stand 2017) |

| One-tap photo logging, fixed afterwards if needed | Logging that takes seconds is done more often. Consistent logging matters more for results than per-meal precision, and the weekly report's weight check corrects for systematic error |
| Fast food and street food are recipe models labelled "QK estimate"; official chain values override them when added | Few chains publish Pakistani nutrition values; a recipe model is closer than a user-typed number |
| Weekly report: veg and fruit target 400 g a day, potatoes excluded | WHO healthy diet fact sheet (at least 400 g of fruit and vegetables a day) |
| Fibre about 14 g per 1,000 kcal | Dietary Guidelines for Americans 2020–2025 |
| Water about 35 ml per kg (8–16 glasses), plus 2 on training days | EFSA 2010 adequate intakes (2.0 L women, 2.5 L men, from drinks and food); sweat losses in training |
| Iron advice for women, with chai an hour away from meals | Women's iron needs are about twice men's; tea polyphenols reduce non-haem iron absorption (Hurrell et al. 1999, Br J Nutr) |
| Vitamin D and B12 are "worth asking your doctor to test", never prescribed | Vitamin D deficiency is very common in South Asia; supplements and doses are a doctor's call |
| Real maintenance = average logged intake − weight change × 7,700 kcal/kg | Energy content of body-weight change (~7,700 kcal/kg, Hall 2008). It needs 2+ weeks of weigh-ins and 5+ logged days, and corrects any steady under- or over-logging |
| Report tone: wins first, at most two focus points, each an addition or swap; no blaming words (tested) | Gain-framed, autonomy-supportive feedback sustains behaviour change better than criticism (self-determination theory; Teixeira et al. 2012, IJBNPA) |
| Recipe models are validated against chains' published values | Across 20 items (McDonald's, KFC, Hardee's, Burger King, Subway, Dunkin', Krispy Kreme, Baskin-Robbins), the median error is 10% and the worst 30% (KFC regular fries are a smaller portion). Checked in `tests/menus.test.mjs` |
| Another country's official value gets a ±10% range | Same recipe, but Pakistani portions and suppliers can differ |
| Personal portion calibration: median of (weighed ÷ photo grams), per kind of food, after 3 weighings, latest 15, clamped ×0.6–×1.6 | People serve themselves consistently, and the camera misjudges the same katori the same way. The median resists one-off mistakes |
| Steps: under 5,000 a day is low, 5,000–10,000 moderate, over 10,000 active; training 4+ days moves you up a level | Tudor-Locke et al. 2011 (IJBNPA) step-count bands |
| A 15-minute walk after the biggest meal when steps are low | Light walking after meals lowers the blood-sugar rise (Buffey et al. 2022, Sports Medicine) |

Limits: the fat grams per dish are modelling assumptions until real plates are weighed. That is the most useful next step. Photo portions of curries are rough (±30%). Counted items (rotis, kebabs, samosas) are much better. Ingredient values are rounded USDA SR Legacy figures, and mutton uses goat meat.

## Athletes (`js/athletes.js`, `js/library-athlete.js`)

Sport → position/style → season phase. Each role's exercises come from a research brief (PubMed + reviews);
the app shows an evidence note wherever studies are thin. No trials test position-specific gym programmes,
so these are evidence-informed choices, not proven prescriptions.

| Sport | Key evidence used |
|---|---|
| Cricket | Mixed (counter-rotating) fast-bowling actions are linked to lumbar stress injury (Elliott 2000, doi:10.1080/026404100446784; review doi:10.1136/bjsports-2012-091782). Injured bowlers: more thorax side-flexion at release, lower back-extensor endurance (Bayne, doi:10.1016/j.jsams.2015.02.011). Bowling-load spikes and <3.5 rest days between bowling days raise risk (doi:10.1136/bjsports-2013-092524; doi:10.1136/bjsm.2005.018515). Faster bowlers: more relative mid-thigh-pull force and jump height (doi:10.1123/ijspp.2021-0140). |
| Football | FIFA 11+ (IRR 0.61, doi:10.1136/bjsports-2016-097066); Nordic programmes halve hamstring injuries (doi:10.1136/bjsports-2018-100045); Copenhagen adduction −41% groin problems (doi:10.1136/bjsports-2017-098937); ACL neuromuscular training (doi:10.1002/jor.24043); positional running demands (Bradley 2009, doi:10.1080/02640410802512775); 1 in-season session/week maintains strength (doi:10.1519/JSC.0b013e31822dcd96). |
| Field hockey | Crouched dribbling raises lumbar load (doi:10.1080/15438627.2024.2309400); prevention borrowed from football (not yet tested in hockey). |
| MMA / boxing | Lower-body power and relative strength relate to punch impact and level (doi:10.1519/JSC.0000000000001075; doi:10.1123/ijspp.2016-0373); MMA work:rest ~1:2–1:4 (doi:10.2466/05.25.PMS.112.2.639-648). Neck training may reduce head acceleration (doi:10.1136/bjsports-2024-108847) but is not proven to prevent concussion (doi:10.3390/jfmk6010008). No weight-cut protocols; extreme cuts need medical supervision (doi:10.1186/1550-2783-9-52). |
| Padel / tennis / squash | OSTRC shoulder programme −28% (doi:10.1136/bjsports-2016-096226); external-rotation ratio and scapular dyskinesis predict tennis shoulder problems (doi:10.1177/23259671251351322); ankle balance training −35% re-sprains (doi:10.1136/bmj.b2684); squash: ~92% HRmax, one match drops knee-extensor strength 16% (doi:10.1519/R-20306.1; doi:10.1016/j.jsams.2008.11.002). Padel evidence is mostly surveys. |

Phases: off-season 3 days (strength + power + prevention), pre-season 2 days (power, low reps), in-season 2 short
maintenance days. Injury-prevention work runs in every phase.

### Sports screens (`js/sportsbio.js`)

Camera joint tracking used as biomechanics: 2D angles from one phone camera, no forces, so each screen is a
screen and not a diagnosis.

- **Bowling action (cricket).** Side-on: QK finds release (bowling hand at its highest above the shoulder) and
  front-foot contact (front ankle reaching the ground in the 0.35 s before release), then classifies the
  front knee from contact to release as braced, straightening (≥10° straighter), collapsing (≥10° more bent)
  or flex-then-extend. A firmer front leg goes with faster ball release in fast bowlers (Worthington et al.
  2013, doi:10.1123/jab.29.1.78; Wormgoor et al. 2010, doi:10.1080/02640411003774537). Trade-off: in adolescent
  bowlers a more extended front knee also went with higher lumbar loads (Crewe et al. 2013,
  doi:10.1080/02640414.2012.762601), so QK pairs a braced front leg with trunk and back work and does not push
  a straighter knee on young bowlers without a coach. From behind: trunk side-bend at release; injured adolescent fast
  bowlers averaged ~50° and uninjured ~40° (Bayne et al. 2016, doi:10.1016/j.jsams.2015.02.011), so >45°
  is flagged for trunk work and a coach review. Normal 30 fps video is too slow for release timing, so QK
  asks for slow motion (120–240 fps).
- **Landing test.** Front-on drop landing from about 30 cm: peak knee frontal-plane projection angle in
  the 0.3 s after landing for each leg. Inward knee motion on landing is a known ACL-injury risk factor:
  in a prospective 3D study of 205 female athletes, those who later tore the ACL landed with ~8° more knee
  abduction (Hewett et al. 2005, doi:10.1177/0363546504269591). QK's 2D angle is a simpler proxy for this. >10°
  is flagged, and a left–right difference >5° is flagged for extra work on the weaker side.

## Days a week (`js/frequency.js`)

Most adjustable programs start at 5 days a week, and clients can choose anything from 3 to 6. Beginner programs start
on their own 3 days. With weekly sets equal, training a muscle 1, 2 or 3+ times a week gives about the same
growth (Schoenfeld et al. 2019, doi:10.1080/02640414.2018.1555906), and strength frequency effects disappear
when volume is equated (Grgic et al. 2018, doi:10.1007/s40279-018-0872-x). More weekly sets do give more
growth (Schoenfeld et al. 2017, doi:10.1080/02640414.2016.1210197). So fewer days keep each muscle's weekly
sets and pack them into fewer, longer sessions:

- Main lifts keep every set and land on different days; superset pairs move together; no exercise twice in
  a session.
- Practical limits (not research findings): 10 sets per muscle per session for accessories, and sessions
  up to 85 / 75 / 70 / 65 minutes at 3 / 4 / 5 / 6 days (or the longest original session if longer). Past them, QK
  trims accessories one set at a time, never below 2, starting with the muscle that has kept the most of
  its weekly sets. Tested: every muscle stays within 15% of its weekly sets at 3, 4, 5 and 6 days.
- Circuit, sport, HYROX, plyometric and the 10×10 programs keep their own days, because moving their pieces
  would break how they work.

**QK judges the days itself**, and only on a clear pattern:
- It counts complete weeks only, never the current week, and never the first partial week of a program or
  after a change.
- Weeks with no sessions (holiday, illness) are skipped, not counted as zero.
- It needs three counted weeks that are all below the plan (or all above it). Any mixed pattern means no
  change. Going down, it picks the most the client did in those weeks; going up, the least. The range is 3–6.
- After a change it needs three new full weeks before judging again. The client is told why ("You trained
  3, 3, 3 days the last 3 weeks"), and one tap keeps the old days and pauses judging for 4 weeks.
- Reminder days follow the weekdays the client actually trains on.

## Making it personal (`js/personal.js`, `js/voicecmd.js`, `js/coach-ur.js`)

All of this is plain logic that runs on the phone: no AI model and no server. The same situation always
gives the same answer, and QK always says why it changed something.

- **Readiness.** The 3-tap check before a workout covers sleep, soreness and energy, plus resting heart rate
  if the client measured it today with the camera. Self-reported wellbeing tracks training stress better
  than most objective markers (Saw et al. 2016, doi:10.1136/bjsports-2015-094758). A rough day takes 5–10%
  off the weights and one set off the extras; main lifts keep their sets. QK never pushes past the plan on a
  good day: that is the progression engine's job. If the morning "How do you feel?" card on Today was
  answered, QK uses it instead of asking again.
- **Equipment.** Exercises the client can't do with their kit are swapped for the closest alternative
  (same movement first, then same main muscle), keeping sets and reps.
- **Pain.** Loaded moves for a sore area (for example, overhead pressing and dips for a shoulder) are
  swapped, and two gentle rehab moves are added at the start. This is not a diagnosis: the app tells
  clients to see a physio or doctor for sharp pain, swelling, numbness or pain past two weeks.
- **Likes and skips.** An exercise skipped twice in 4 weeks is swapped out from then on. Favourites (done
  on 4+ days in 8 weeks) are kept when the monthly refresh rotates exercises.
- **Where to start.** New lifters and those aged 50+ do one set fewer on the extras in month 1, and those
  aged 50+ get a light week every 5 weeks instead of 7. These are conservative practical rules.
- **Weak points.** A form fault in 3+ sets in 4 weeks with a known fix (for example, shifting to one side
  in the squat leads to single-leg work), or a lift whose estimated 1RM hasn't moved in 6 weeks while the
  others rose 3%+, adds one exercise next month and says why. If everything stalls together, nothing is
  blamed on one lift.
- **Missed sessions.** If the week can't fit the remaining sessions, today also gets the next session's main
  lifts (one set lighter, within the time limit). Only days after the program started count as missed.
- **Time per day, machine taken, voice and Urdu.** A per-weekday minute budget trims accessories first. "Machine
  taken" swaps an exercise for today only. Voice commands are opt-in and use the phone's speech recognition
  (on most Android phones Google turns the audio into text). Urdu covers short spoken cues only (counts,
  sets, rest, go, done); a set summary with a form tip stays English so the tip is never lost.

## QK remembers, and the gaps it closes (`js/memory.js`, `js/personal.js`)

**Follow-ups.** QK asks about what the client told it, one question at a time on Today, and says it once:
- **Pain:** asked after 3 days, then weekly. "Better" brings those exercises back at 80% for two weeks.
  "Same" twice, or "Worse", gives a clear "see a physio or doctor".
- **Other follow-ups:**
  - a rough day yesterday
  - a new personal best last session
  - an exercise skipped once ("swap it for good?")
  - a missed week
  - the end of a trip or of Ramadan
  - one month with QK

**Coming back after a break.** Maximal strength held fairly steady through lockdown-length breaks
(Washif et al. 2026, doi:10.5114/biolsport.2026.153307), so the cuts are modest and ramp back quickly:
- after 2–4 weeks off: 90% of the old weights, back to full over 2 sessions
- after 4–8 weeks off: 85%, with one set fewer on the extras, back to full over 3 sessions
- after 8+ weeks off: 75%, back to full over 4 sessions

These percentages are practical rules, not research findings.

**Ramadan mode** (30 days): sessions up to 45 minutes and one set fewer on the extras. Cutting volume by about
22% during Ramadan improved strength and power in footballers (Rebaï et al. 2014, doi:10.1055/s-0033-1353216).
Strength gains were better when people trained after iftar than while fasting (Triki et al. 2023,
doi:10.1123/ijspp.2022-0268), so QK suggests training after iftar.

**Smaller gaps.**
- **Home weights ceiling:** at the heaviest dumbbell or kettlebell the client owns, QK progresses with reps and
  a 3-second lowering instead.
- **Micro plates:** 1 kg barbell press jumps.
- **Early light week:** offered after 3 rough days in a week, or when every lift has stalled for 6 weeks
  (fatigue, sleep or food, not one weak lift).
- **Travel mode:** switches equipment for 3–14 days and switches back by itself.
- **Classes follow the profile:** quiet (no jumping) mode is on for a sore knee or hip, and dumbbell classes
  are hidden without dumbbells.
- **"How was today's workout?":** two "too hard" answers in a row mean one set fewer on the extras; two
  "too easy" answers add one.

### More gaps closed
- **Supersets before cutting:** when a session doesn't fit the time allowed, QK first pairs extras for
  different muscles into supersets, then trims sets. Supersets give similar adaptations in about half the time
  (Mang et al. 2025, doi:10.1519/JSC.0000000000005246).
- **First time on a weighted exercise:** QK asks how many more reps were left and sets the next set's weight
  aiming for about 2 in reserve. Trained lifters judge this to within about one rep (Refalo et al. 2024,
  doi:10.1519/JSC.0000000000004653). Beginners never get more than a 10% jump from one answer.
- **Bodyweight and holds progress:** +2 reps or +5 seconds when every set hit the target. At 25 reps or 90
  seconds, the exercise is made harder with a slower tempo instead.
- **Sore spots in classes and drills:** hands-on-floor moves are swapped for wrist, elbow or shoulder pain;
  lunges and jumps for knee or hip pain. The Swap button follows equipment and pain too.
- **Follow-ups:** reminders that don't match when the client actually trains (1.5+ hours off over 8+
  sessions), a finished program, and a 3-monthly "same goal?" check.
- **The coach sees what to know:** sore areas, rough days this week, travel and Ramadan, as labels and
  counts only.

## Fitness Age

**What it is.** Your estimated aerobic fitness (VO2peak, mL/kg/min), shown as the age whose healthy average matches it. Code: `js/fitnessage.js` (maths, tested in `tests/fitnessage.test.mjs`) and `js/fitage-ui.js` (screen).

**Step 1: estimated fitness.** The HUNT Study non-exercise model (Nauman et al. 2017), with coefficients exactly as printed in three open-access papers: Frontiers in Behavioral Neuroscience 2019 (doi:10.3389/fnbeh.2019.00053), JAHA 2019 (doi:10.1161/JAHA.118.010293) and Scientific Reports 2025 (doi:10.1038/s41598-025-29410-7).

- Men: 105.91 − 0.334·age − 0.402·waist(cm) − 0.144·resting HR + 3.102·PA (goodness of fit 0.58, SEE 5.88)
- Women: 78.00 − 0.297·age − 0.270·waist(cm) − 0.110·resting HR + 2.674·PA (goodness of fit 0.52, SEE 5.37)
- PA = 1 if the person meets 150 min moderate or 75 min vigorous activity a week, else 0.

We use this version rather than the 2011 version with a graded activity index because every term is fully specified in print. Activity is pre-filled from the training log: average training days over the last full weeks (at least 2) × session length (the time cap, else 50 min) ≥ 150. The client can override it with one tap. Resting HR is the lowest camera reading in the last 30 days, or a fresh one.

**Step 2: Fitness Age.** The mean VO2max of 4,631 healthy HUNT 3 adults by sex and decade (Aspenes et al. 2011, PLOS ONE, doi:10.1371/journal.pone.0064319, Table 2):

| Age | Men | Women |
|---|---|---|
| 20–29 | 54.4 | 43.0 |
| 30–39 | 49.1 | 40.0 |
| 40–49 | 47.2 | 38.4 |
| 50–59 | 42.6 | 34.4 |
| 60–69 | 39.2 | 31.1 |
| 70+ | 35.3 | 28.3 |

Each group mean sits at its mid-age (25, 35, … 75). We interpolate linearly between points and carry the end slopes beyond them. Fitness Age is the age at which this curve equals your estimate, rounded and kept between 18 and 90. The same paper reports VO2max falling about 3.5 mL/kg/min per decade in both sexes. "% of average" is your estimate divided by the curve at your real age.

**Why it matters.** Estimated fitness from this model predicts mortality: each 1 MET (3.5 mL/kg/min) higher goes with about 15% lower all-cause mortality in men (Nes et al. 2014, doi:10.1249/MSS.0000000000000219).

**What would make you younger.** The model is re-run with one change at a time, and a change shows only if it is worth at least a year:

- meeting the activity guideline
- 5 cm off the waist (only above the WHO raised-risk cut-offs: 94 cm men, 80 cm women)
- 5 bpm lower resting HR (only above 60)

**Extra checks.** Optional, and not part of the number:

- Push-ups in one go: men doing over 40 had 96% fewer cardiovascular events over 10 years than those doing 10 or fewer (Yang et al. 2019, doi:10.1001/jamanetworkopen.2018.8341). The study was in men, so this check is shown only to men.
- Sit-and-rise score, 0–10: each point is linked to 21% lower mortality, and 8–10 is the lowest-risk group (Brito et al. 2012, doi:10.1177/2047487312471759).
- Resting HR: each 10 bpm higher goes with about 9% higher all-cause mortality (Zhang et al. 2016, doi:10.1503/cmaj.150535).

**Follow-up.** The first test is offered after two weeks of training (when age is known). After that, a retest reminder comes every 30 days through QK remembers. The trend line appears from the second test. The coach sees the latest Fitness Age as a chip.

## When training stops: Fitness Age goes up (`js/fitnessage.js` liveFitAge, `tools/push-checkins.mjs` lapseMsg)
The HUNT model has an activity term: meeting the 150/75-minute guideline adds 3.102 mL/kg/min for men and 2.674 for women (see Fitness Age above). After 14 days with no training or classes, the app re-scores the latest test with that term switched off.

Fourteen days means one busy week never counts against anyone. This is the model's own term, not an extra detraining guess. The result moves by the size of that term, usually 2–4 years.

- **On the phone:** a "QK remembers" card says "Your Fitness Age has gone up to X (from Y)", and the Fitness Age screen shows the new number with the reason.
- **When the app stays closed:** the server gets the "if they stop" age (`care.fitAge.ifStopped`) and the last training day. The daily push job then sends "Your Fitness Age went up to X" at most every 14 days, within the one-notification-a-day budget, and never to people who turned notifications off.

## Mind check (`js/mind.js`)
- **When QK asks:** on 2 or more of the last 4 days, the morning check showed sleep quality or stress at 5+ on the Hooper 1–7 scale (or the "rough" one-tap answer), or the training check said "slept badly". QK then asks "How are you doing, honestly?" At most every 5 days.
- **The answer is built from their own numbers:** training days in the last 2–4 weeks, resting heart rate against their own last month, Fitness Age and calm sessions. Only things that are true and going well are mentioned. If nothing is logged, it gives a plain, kind line.
- **"A bit low":** today's session is made lighter, and QK suggests a 10-minute calm session before bed.
- **"Struggling":** QK says how they feel matters more than any number. It asks them to talk to a person today (friend, family, doctor) and to call their local emergency number if they ever feel unsafe. It offers a helpline finder (findahelpline.com) and "Let QK know".
- **"Let QK know"** shares only "Asked for support" with the coach, for a week, never the answers or numbers.
- QK does not diagnose and never claims to replace a person.

## Leaderboard (`js/leaderboard.js`, server: `leaderboard()` in supabase/schema.sql)
A weekly health score out of 100, reset every Monday. It is built to be fair at any age: Fitness Age counts against your own age, recovery against your own scale, and most points come from showing up and checking in.

| Part | Points | How |
|---|---|---|
| Training | 35 | training days ÷ planned days (capped) |
| Fitness Age | 20 | 10 years younger than your age = 20, 10 older = 0; a test older than 45 days scores 0 (retest monthly) |
| Recovery | 15 | morning check fatigue/soreness (Hooper 1–7, 1 best), × days checked in ÷ 5 |
| Sleep | 15 | morning check sleep quality, same scaling |
| Stress & mind | 15 | morning check stress, same scaling, +2 per calm session |

The app shows the five parts and the top ways to earn more this week.

- **Ranking:** done on the server, among one coach's clients. It returns the top 50 plus your own row, so someone in 70th place sees "#70".
- **Board name:** nickname, else first name + last initial, or "Anonymous" if hidden. Scores' health details are never visible to other clients.
- **Month:** the sum of weekly scores for weeks starting in that month.
- **Trust:** scores are computed on the phone. The coach sees each client's real training on the dashboard to sanity-check the top 3 before recording prizes.

## Broadcasts (`js/coach-extra.js`, `js/dash.js` audienceOf, `tools/push-checkins.mjs` broadcastJobs)
- **Delivery:** the coach writes one message, which is stored as one `messages` row per client (kind `broadcast`, with a title). The app says it and shows it at the next sync. The push job, now hourly for broadcasts only, sends it as a phone notification and stamps `pushed_at`.
- **{name}** is filled with each client's first name.
- **Audiences:** everyone, not trained in 7+ days, trained this week, or this week's top 10.
- **Notifications off:** clients who turned notifications off still see it in the app.
- **Templates:** ready-made ones in QK's voice (Roman Urdu and English), e.g. "Dr. Doom aa gaya lekin tum gym nahi aaye, {name}?".
