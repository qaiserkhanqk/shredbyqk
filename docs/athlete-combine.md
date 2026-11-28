# Athlete Combine

Tools → **Athlete Combine** (also linked under "Train for your sport"). It tests the athlete on camera,
finds the #1 limiter for their position, and puts work for it at the top of every session of their
athlete programme (`js/athletes.js`). It is a performance screen, not an injury or medical assessment.

Code: `js/combine/combine.js` (tests, bands, position weights, limiter, programme focus),
`js/combine/tests.js` (camera analysis), `js/combine/screens.js` (one-phone movement checks and
fixes), `js/combine/ui.js` (screen). Tests: `tests/combine.test.mjs`, `tests/combine-screens.test.mjs`.
Evidence: `docs/biomech-research/` (cricket, football-hockey, mma-squash; PubMed-checked).

## How it connects to the athlete section
- Sport and position come from `athletes.js` (8 sports, 30 positions). Every position has combine weights.
- `athletes.buildProgram(sport, role, phase, lib, focus)` takes an optional focus from
  `combine.programFocus()`: the limiter's exercises open every day, then up to two movement-fix
  exercises; role picks that duplicate them are dropped. The programme's "How it works" says why.
- The focus applies only when the programme is for the same sport and position as the combine.
- Main's own checks stay where they were: front-knee bowling pattern and front-on landing
  (`sportsbio.js`, "Test how you move"), two-camera 3D analysis (Biomechanics Lab).

## Tests
| Test | Quality | Method |
|---|---|---|
| Countermovement jump | Power | Flight time (`jump.js`); peak power estimate from Sayers 1999 |
| Reactive hops (10) | Spring | Contact and flight per rebound hop; RSI = height ÷ contact, best 5 |
| Flying 10 m | Top speed | User taps 2 cones on the uploaded video; mid-hip crossing times |
| 5-0-5 | Agility | User taps the 5 m line; time between crossing it out and back |
| Nordic lower | Hamstrings | Knee→shoulder angle where lowering speed jumps (break point) |
| Single-leg jump L/R | Balance | Two jump recordings; gap as % of the better leg |
| Yo-Yo IR1, push-ups, dead hang, side plank, Copenhagen | Engine, upper, grip, trunk, groin | Entered |

Foot events are extrapolated to floor height (2× and 1× threshold crossings), so contact times
aren't padded. On a synthetic 200 ms contact the result is 203 ms.

**Guide bands are provisional** (rounded team-sport ranges, adult only) and **position weights are
coaching judgement**: both are for QK to review. Under-16s aren't scored against them.

## Movement checks (one phone)
Fast-bowling stride (plant angle, stride % of height, back knee, front-knee pattern), top-speed
sprint (S-MAS-style items), side-on drop landing (LESS-based), court lunge, and punch lead leg. Every
flag is labelled study line or coaching guide. Rotational markers (counter-rotation, action type,
elbow legality, fist speed) are not measured with one phone, and the app says so.

## Also in this change
- **Slow-motion uploads:** a slowed-down slow-mo file made every timed event read 4–8× too long
  (jump test included). Uploads now have "it plays slowed down (120/240 fps)", which divides media
  time back to real time; real-time test uploads play at half speed so more frames are analysed.
- **sw.js was a syntax error on main:** the JS file list sat outside the SHELL array, so the
  service worker never installed (no offline mode). Fixed, the combine modules were added, cache v48.
  Verified: it installs and caches 124 files.
- **Compliance wording** in `sportsbio.js`, `lab3d.js` and `kneetest.js`: no ACL-risk or injury
  prediction claims (Sigward 2015 knee-load wording; Bayne 2016 as a coaching watch-point).
- 3 exercises added to `library-athlete.js`: squash ghosting, sprawl, dead hang.

## Not done
- No validation against timing gates, a jump mat or 3D capture; no real-phone run of the combine.
- Publication blocked by D-010 and D-013.
