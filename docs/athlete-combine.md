# Athlete Combine

A phone-camera test battery for cricket, football, MMA, squash and field hockey. It scores each
result against provisional guide bands, picks the athlete's **#1 limiter** weighted for their
position, and builds a weekly plan around it. It is a performance screen, not an injury or medical
assessment.

Code: `js/athlete/tests.js` (camera analysis), `js/athlete/sports.js` (sports, positions, tests,
scoring, limiter), `js/athlete/plan.js` (weekly plans), `js/athlete/ui.js` (screen).
Tests: `node tests/athlete.test.mjs`.

## Flow
Body → Athlete Combine → sport → position (fast bowlers also choose an action) → sex, age, body
weight, season, sessions a week → tests → profile + #1 limiter → weekly plan → share with QK.

## Tests and how each is measured
One phone times events far better than it measures distance, so every camera test is built on
timing or joint angles.

| Test | Quality | Method | Precision |
|---|---|---|---|
| Countermovement jump | Power | Flight time, h = g·t²/8 (existing `jump.js`). Peak power in W from Sayers et al. 1999 when body weight is given | ±4 cm at 30 fps, ±1 cm at 120 fps |
| Reactive hops (10) | Spring | Contact and flight time per rebound hop. RSI = height (m) ÷ contact (s), mean of the best 5 | ±½ frame per event |
| Flying 10 m | Top speed | User taps 2 cones 10 m apart; mid-hip crossing times, interpolated | Shown per result in km/h |
| 5-0-5 | Agility | User taps the 5 m line; time between crossing it out and back | ±1 frame |
| Nordic lower | Hamstrings | Knee→shoulder angle from vertical; the break is where lowering speed jumps above 3× the controlled speed (min 60°/s) | ±a few degrees |
| Single-leg jump L/R | Balance | Two jump recordings; gap as % of the better leg | As CMJ |
| Bowling front knee | Front leg | Front-foot contact = front ankle stops; release = highest wrist; knee angle at both. ≥ +10° extender, ≤ −10° flexor, else brace | 2D screen only |
| Yo-Yo IR1, push-ups, dead hang, side plank, Copenhagen | Engine, upper, grip, trunk, groin | Entered by hand | – |

**Event timing fix:** a foot event is detected when the foot is a few pixels above the floor. That
trims flight and pads contact (by about 20 ms at hop speeds). Near the floor the foot moves at
roughly constant speed, so the time between the 2× and 1× threshold crossings is extrapolated back
to the floor. This needs no scale. On a synthetic 200 ms contact it gives 203 ms.

**Slow-motion uploads:** a slow-mo file plays slowed down, so its media time runs 4× or 8× real time.
The upload selector ("plays slowed down, 120/240 fps") divides timestamps back to real time.
Real-time uploads of tests play at half speed so the pose model sees more frames. Before this, a
slow-mo upload of the existing jump test read flight time 8× too long.

## Scoring
Each test has four guide values per sex, `[developing, solid, strong, elite]`, mapped to 25/50/75/100
and interpolated. Values below "developing" scale towards 0. **The bands are provisional:** rounded
ranges in line with published team-sport testing for adult athletes. QK should review them before
any marketing uses a band name. Under-16s are not scored against adult bands (their own progress only).

## #1 limiter
For each tested quality: gap = position weight (0–3) × (100 − score). The biggest gap is the limiter
and the next two are secondary. A left/right gap over 15% always comes first. Weights per position
are in `SPORTS[].roles[].weights` (`js/athlete/sports.js`). They are coaching judgement and the
main thing for QK to tune.

## Plans
- Every session opens with a prevention warm-up (FIFA 11+-style for field sports: Nordic, Copenhagen).
- The limiter's block comes first in every working session.
- Rotation by days: 2 = Speed & power + Strength, 3 adds Conditioning & sport, 4–5 repeat.
- In season (not cricket), sessions sit around the match: MD+1 recovery, MD-4 strength, MD-3 speed,
  MD-2 conditioning, MD-1 primer, with volume cut by about a third.
- Every position has its own sport block (e.g. wrist spinners: shoulder and wrist; full-backs:
  overlap repeats; drag-flickers: trunk and groin).
- Safety notes: mixed bowling action → coach review before adding bowling volume; bowling workload
  spikes; drag-flick load; sparring counts as conditioning; under-16 technique first.

## Not done / to confirm
- The camera tests are checked on synthetic athletes with known answers, not yet against timing
  gates, a jump mat or a lab. A validation session (phone vs gates/mat, 10–20 athletes) is needed
  before any accuracy claim.
- Guide bands and position weights need QK's review.
- The bowling action type is self-reported. One side-on camera can't judge hip–shoulder separation.
- Club programmes (Real Madrid, Bayern) are not published and are not named anywhere in the app.

## Biomechanics lab (`js/athlete/lab.js`, tests: `tests/lab.test.mjs`)
Evidence: `docs/biomech-research/cricket.md`, `football-hockey.md`, `mma-squash.md` (PubMed-checked, with "unverified" marked).

The athlete films the movement their sport depends on. The lab measures it, flags faults against
published ranges, and each fault carries what to strengthen, exercises, a cue and its source. The two
most important faults (fix before watch) become a "Fix your movement" block in every working session.

| Screen | Who | Measures | Flags (basis) |
|---|---|---|---|
| Fast bowling, side-on | Pace | Front knee at FFC and release; Portus 4-pattern class from the minimum knee angle; plant angle; back knee after BFC; stride % height (height from leg length ÷ 0.491) | Flexor collapse (study), stride >85% (study) or <70% (coaching), plant <20° (coaching), back knee <130° (coaching) |
| Fast bowling, from behind | Pace | Trunk side-bend at release | ≥50° (adolescent group means 40° vs 50°, Bayne 2016) |
| Top-speed sprint | Football, hockey, cricket batters/pace | S-MAS-style items: foot ahead of hips, thigh separation, hip drop, trunk lean | Coaching lines; S-MAS points linked with hamstring injury (Bramah 2026) |
| Drop landing, front | Field sports, squash, MMA | FPPA, knee–ankle width ratio, trunk side lean | FPPA >10° or ratio <0.8 (coaching); lean >10° (LESS) |
| Drop landing, side | Same | Knee bend at contact and after | <30° / <45° (LESS items) |
| Squash lunge | Squash | Depth, trunk lean, depth lost first → last | Depth lost ≥10° (study, badminton analogue); others coaching |
| Punch | MMA strikers | Lead-knee give at impact | ≥10° (coaching) |

Design rules from the research:
- A straighter front knee = pace but also more lumbar load (Crewe 2013), so only a collapse is flagged.
  Extender and brace score the same.
- Not measured, and the app says so: shoulder counter-rotation, hip–shoulder separation, action type,
  elbow legality (ICC lab only), fist speed, rotation sequence. 2D/IMU error there is 10–22°.
- A "hard landing" isn't a fault by itself: faster bowlers brake harder but load more slowly. The lab
  shows plant angle and knee pattern, not force.
- Side-plank endurance did not relate to side strain (Nealon 2018). Don't claim it prevents it.
- No markerless method is validated in cricket bowling. Every lab result says "not yet checked against
  lab equipment". Validation study needed before any accuracy claim (D-013).

### Compliance pass on the lab (2026-11-28)
- Flag lines without a published cut-off are badged "coaching guide": plant angle, back knee, overstride,
  front-side, hip drop, knee valgus, trunk lean, stiff landing, lunge fatigue and side-bend. Citations in
  the "why" text describe what the study found, not a risk number for the user.
- No injury-prediction wording. Knee valgus cites Sigward 2015 (knee load), not Hewett 2005 (ACL, 3D,
  female-only). Side-bend and front-knee collapse are "watch" items.
- Female bowlers see a note that the bowling ranges come from male bowlers.
- Still to verify: the LESS 30°/45° item definitions (Padua 2009) against the original paper, and the
  stride estimate (±5–10%), which is about as large as the 85% line's margin.
- Publication stays blocked by D-010 and D-013.
