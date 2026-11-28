// Athlete Combine: sports, positions, tests, scoring and the #1 limiter.
//
// How it fits together:
//   sport → position (role) → the combine tests for that sport → each result scored 0–100 against
//   guide bands → role weights say which qualities matter most for THAT position → the biggest
//   weighted gap is the athlete's #1 limiter → plan.js builds the week around it.
//
// GUIDE BANDS ARE PROVISIONAL. They are rounded ranges in line with published team-sport testing
// data for adult amateur-to-elite athletes (see SCIENCE.md §Athlete). They are a starting point for
// QK to review, not norms from one validated dataset. Under-16s are not scored against them.
import { asymmetryPct } from './tests.js';

export const QUALITIES = {
  power: { name: 'Explosive power', short: 'Power', why: 'How much force you produce fast: jumping, first steps, heading, striking.' },
  reactive: { name: 'Reactive strength', short: 'Spring', why: 'How well your legs act like a spring. Short ground contacts make faster running and quicker feet.' },
  speed: { name: 'Top speed', short: 'Speed', why: 'Your maximum sprinting speed. Regular sprinting also gets your hamstrings used to top-speed work.' },
  agility: { name: 'Change of direction', short: 'Agility', why: 'How fast you stop, turn and go again.' },
  hamstring: { name: 'Hamstring strength', short: 'Hamstrings', why: 'Strength at long muscle length, the position where sprint hamstring injuries happen.' },
  symmetry: { name: 'Left–right balance', short: 'Balance', why: 'A big gap between legs is common (dominant side, old injuries, habits) and a common training target. If one leg hurts or feels unstable, see a physio.' },
  aerobic: { name: 'Repeat-effort fitness', short: 'Engine', why: 'How often you can sprint, recover and sprint again.' },
  upper: { name: 'Upper-body strength', short: 'Upper body', why: 'Pushing, pulling and holding off opponents.' },
  grip: { name: 'Grip strength', short: 'Grip', why: 'Holding on: the bat, the stick, the opponent.' },
  trunk: { name: 'Trunk strength', short: 'Trunk', why: 'Transfers force from legs to arms and helps you control rotation.' },
  groin: { name: 'Groin (adductor) strength', short: 'Groin', why: 'A common training target in sports with kicking, side-to-side pushes and deep lunges.' },
  bowlKnee: { name: 'Front-leg brace', short: 'Front leg', why: 'Fast bowlers who keep the front knee firm or straighten it through release tend to bowl faster in studies.' },
};

// m = adult male, f = adult female: [developing, solid, strong, elite]. higher: is a bigger number better?
export const TESTS = {
  cmj: { name: 'Countermovement jump', quality: 'power', kind: 'camera', mode: 'cmj', unit: 'cm', higher: true, bands: { m: [30, 36, 42, 48], f: [22, 27, 32, 37] },
    how: ['Phone on the floor, side-on, 2–3 m away, feet in view.', 'Hands on hips. Stand still for a second, dip and jump straight up. Land with straight legs.', '3 jumps. A slow-motion upload gives a steadier reading.'] },
  hops: { name: 'Reactive hops (10 hops)', quality: 'reactive', kind: 'camera', mode: 'hops', unit: 'RSI', higher: true, bands: { m: [1.2, 1.6, 2.0, 2.5], f: [1.0, 1.4, 1.8, 2.2] },
    how: ['Same set-up as the jump. Hands on hips.', 'Hop 10 times as high as you can with the least time on the ground. Stiff ankles, straight legs.', 'Slow-motion upload strongly advised: ground contacts are about 0.2 s.'] },
  fly10: { name: 'Flying 10 m sprint', quality: 'speed', kind: 'camera', mode: 'fly10', unit: 'km/h', higher: true, bands: { m: [26, 29, 31.5, 33.5], f: [23, 25.5, 27.5, 29.5] },
    how: ['Put 2 cones exactly 10 m apart. Phone on a tripod side-on, 10–15 m back, both cones in frame.', 'Build up over 20–30 m before the first cone, sprint flat out through the second.', 'Upload the slow-motion video, then tap the two cones.'] },
  s505: { name: '5-0-5 change of direction', quality: 'agility', kind: 'camera', mode: 's505', unit: 's', higher: false, bands: { m: [2.75, 2.55, 2.4, 2.25], f: [3.0, 2.8, 2.65, 2.5] },
    how: ['Mark a turn line, and a cone line 5 m before it. Start 10 m before the cone line.', 'Phone side-on to the cone line. Sprint through it, turn on the turn line, sprint back through.', 'Upload the video and tap the cone line. Test turning off each foot.'] },
  nordic: { name: 'Nordic hamstring lower', quality: 'hamstring', kind: 'camera', mode: 'nordic', unit: '°', higher: true, bands: { m: [30, 45, 60, 75], f: [25, 40, 55, 70] },
    how: ['Kneel on a mat, a partner holding your ankles (or ankles hooked under something solid).', 'Phone side-on at knee height. Body straight from knees to head, arms ready to catch.', 'Lower forward as slowly as you can. The angle where you lose control is your score.'] },
  slHop: { name: 'Single-leg jump, left vs right', quality: 'symmetry', kind: 'camera', mode: 'slHop', unit: '% gap', higher: false, bands: { m: [20, 15, 10, 5], f: [20, 15, 10, 5] },
    how: ['Same set-up as the jump test.', 'Jump straight up on one leg, hands on hips, 3 times. Then the other leg.', 'The gap between legs is the score. Under 10% is the usual target.'] },
  yoyo: { name: 'Yo-Yo intermittent recovery (level 1)', quality: 'aerobic', kind: 'manual', unit: 'm', higher: true, bands: { m: [800, 1200, 1600, 2200], f: [480, 720, 1000, 1400] },
    how: ['Run the Yo-Yo IR1 audio test on a 20 m shuttle with a 5 m recovery zone.', 'Enter the total distance covered when you drop out.'] },
  pushups: { name: 'Max push-ups', quality: 'upper', kind: 'manual', unit: 'reps', higher: true, bands: { m: [15, 25, 35, 45], f: [8, 15, 22, 30] },
    how: ['Chest to a fist-height target, full lockout, body in one line.', 'As many as you can without resting. Enter the number.'] },
  deadHang: { name: 'Dead hang', quality: 'grip', kind: 'manual', unit: 's', higher: true, bands: { m: [30, 45, 60, 90], f: [20, 30, 45, 70] },
    how: ['Hang from a pull-up bar, straight arms, feet off the floor.', 'Enter how many seconds you held on.'] },
  sidePlank: { name: 'Side plank (weaker side)', quality: 'trunk', kind: 'manual', unit: 's', higher: true, bands: { m: [45, 60, 90, 120], f: [40, 55, 80, 110] },
    how: ['Forearm under the shoulder, body straight, hips lifted.', 'Time each side. Enter the shorter of the two.'] },
  copenhagen: { name: 'Copenhagen plank (weaker side)', quality: 'groin', kind: 'manual', unit: 's', higher: true, bands: { m: [10, 20, 30, 45], f: [8, 15, 25, 40] },
    how: ['Side plank with your top foot (or knee, if that\'s too hard) on a bench, bottom leg off the floor.', 'Time each side. Enter the shorter of the two, and note if you used the knee.'] },
  bowlKnee: { name: 'Bowling front-knee check', quality: 'bowlKnee', kind: 'camera', mode: 'bowl', unit: '', higher: true,
    how: ['Phone on a tripod side-on to the crease, 8–10 m away, slow-motion.', 'Film your last 3 strides through to the follow-through at full pace.', 'QK times front-foot contact and release and measures the front knee at both.'] },
};

// Bowling knee is a pattern, not a number on a scale.
// Extender and brace score the same: a straightening knee helps pace but has also been linked with
// low-back load. Physio review pending before either is ranked above the other.
const BOWL_SCORE = { extender: 70, brace: 70, flexor: 35 };

const R = (id, name, weights, focus, extra = {}) => ({ id, name, weights, focus, ...extra });
const EVID = {
  fifa11: 'In one trial with girls aged 13–17 playing football, the FIFA 11+ warm-up was linked with fewer overall and severe injuries (Soligard et al., BMJ 2008).',
  nordic: 'Programmes that included Nordic curls had about half the hamstring injuries in a review of 15 studies (van Dyk et al., BJSM 2019).',
  copen: 'A programme built on the Copenhagen adduction exercise was linked with fewer self-reported groin problems in semi-professional male footballers (Harøy et al., BJSM 2019).',
  workload: 'Sudden jumps in bowling workload were linked with more injuries in elite fast bowlers (Hulin et al., BJSM 2014).',
  mixed: 'A mixed bowling action (hips and shoulders twisting against each other) is linked in studies with more lower-back stress injuries (Portus et al., 2004). Get your action reviewed by a qualified bowling coach.',
  position: 'Match-tracking studies show wide players and full-backs do the most high-speed running and centre-backs the least (Bradley et al., J Sports Sci 2009).',
};

export const SPORTS = [
  { id: 'cricket', name: 'Cricket', tests: ['cmj', 'hops', 'fly10', 's505', 'nordic', 'slHop', 'yoyo', 'sidePlank', 'pushups', 'bowlKnee'], evidence: [EVID.workload],
    roles: [
      R('pace', 'Fast bowler', { power: 2, reactive: 2, hamstring: 2, symmetry: 3, trunk: 3, aerobic: 2, speed: 1, bowlKnee: 3, upper: 1, groin: 1 },
        'A firm front leg, a strong trunk for rotation, and legs that tolerate bowling workload.', { actions: ['Side-on', 'Front-on', 'Semi-open', 'Mixed', 'Not sure'] }),
      R('fingerSpin', 'Finger spinner', { trunk: 2, symmetry: 2, aerobic: 2, power: 1, agility: 1, upper: 1, grip: 2 }, 'Trunk rotation, a stable front leg and fingers and shoulders that last long spells.'),
      R('wristSpin', 'Wrist spinner', { trunk: 2, upper: 2, grip: 2, symmetry: 2, aerobic: 2, power: 1, agility: 1 }, 'Shoulder and wrist resilience for heavy wrist and shoulder load, plus front-leg bracing.'),
      R('topBatter', 'Top-order batter', { aerobic: 2, speed: 2, agility: 2, trunk: 2, power: 1, grip: 1, symmetry: 1, hamstring: 1 }, 'Batting long: quick singles, fast turns and repeat sprints between the wickets.'),
      R('finisher', 'Middle-order / finisher', { power: 3, trunk: 3, upper: 2, grip: 2, speed: 2, agility: 2, symmetry: 1 }, 'Rotational power and bat speed for boundary hitting, and fast running between wickets.'),
      R('keeper', 'Wicketkeeper', { agility: 3, power: 2, reactive: 2, trunk: 2, symmetry: 2, aerobic: 1, groin: 2 }, 'Hundreds of squats a day, explosive dives and fast lateral steps.'),
    ] },
  { id: 'football', name: 'Football', tests: ['cmj', 'hops', 'fly10', 's505', 'nordic', 'slHop', 'yoyo', 'copenhagen', 'sidePlank'], evidence: [EVID.fifa11, EVID.nordic, EVID.copen, EVID.position],
    roles: [
      R('gk', 'Goalkeeper', { power: 3, reactive: 2, agility: 3, upper: 2, grip: 1, trunk: 2, symmetry: 2, speed: 1, aerobic: 1, hamstring: 1, groin: 2 }, 'Explosive dives off both legs, fast lateral push-offs and a strong upper body for catching and landing.'),
      R('cb', 'Centre-back', { power: 3, speed: 2, agility: 2, hamstring: 2, aerobic: 2, trunk: 2, groin: 2, upper: 1, symmetry: 2, reactive: 1 }, 'Winning headers and duels, short accelerations and recovery sprints.'),
      R('fb', 'Full-back / wing-back', { speed: 3, aerobic: 3, agility: 2, hamstring: 3, reactive: 2, groin: 2, symmetry: 2, power: 1, trunk: 1 }, 'The most sprinting on the pitch: up and down the line, again and again.'),
      R('cdm', 'Defensive midfielder (CDM)', { aerobic: 3, trunk: 3, agility: 2, groin: 2, power: 2, hamstring: 2, symmetry: 2, speed: 1, upper: 1 }, 'A big engine and a strong base: duels, screening and constant short changes of direction.'),
      R('cm', 'Central midfielder', { aerobic: 3, agility: 2, speed: 2, hamstring: 2, groin: 2, symmetry: 2, power: 1, reactive: 1, trunk: 1 }, 'The highest running load: box to box, with repeated accelerations.'),
      R('winger', 'Winger / attacking midfielder', { speed: 3, agility: 3, reactive: 2, hamstring: 3, aerobic: 2, symmetry: 2, power: 1, groin: 1 }, 'Top speed, sharp cuts and the ability to repeat them late in the game.'),
      R('st', 'Striker', { speed: 3, power: 3, agility: 2, hamstring: 3, reactive: 2, trunk: 1, symmetry: 2, aerobic: 1, upper: 1 }, 'First-step acceleration, jumping and holding off defenders.'),
    ] },
  { id: 'mma', name: 'MMA', tests: ['cmj', 'hops', 'slHop', 'yoyo', 'pushups', 'deadHang', 'sidePlank'], evidence: [],
    roles: [
      R('striker', 'Striker', { power: 3, reactive: 3, agility: 2, aerobic: 3, trunk: 2, symmetry: 2, upper: 2, grip: 1 }, 'Fast, powerful strikes and footwork you can keep up for every round.'),
      R('grappler', 'Grappler / wrestler', { grip: 3, upper: 3, trunk: 3, power: 2, aerobic: 3, symmetry: 1, groin: 1 }, 'Grip, pulling strength and a strong trunk for takedowns and scrambles.'),
      R('allround', 'All-rounder', { power: 2, aerobic: 3, grip: 2, upper: 2, trunk: 2, reactive: 2, symmetry: 2 }, 'A balance of striking power, grappling strength and an engine for the full fight.'),
    ] },
  { id: 'squash', name: 'Squash', tests: ['cmj', 'hops', 's505', 'slHop', 'yoyo', 'sidePlank', 'copenhagen'], evidence: [],
    roles: [
      R('player', 'Squash player', { agility: 3, aerobic: 3, reactive: 2, power: 2, symmetry: 3, trunk: 2, groin: 2, hamstring: 1, speed: 1 }, 'Explosive lunges to the corners, fast recovery to the T and the engine for long rallies.'),
    ] },
  { id: 'hockey', name: 'Hockey (field)', tests: ['cmj', 'fly10', 's505', 'nordic', 'slHop', 'yoyo', 'copenhagen', 'sidePlank'], evidence: [EVID.nordic, EVID.copen],
    roles: [
      R('gk', 'Goalkeeper', { power: 2, agility: 3, reactive: 2, symmetry: 2, trunk: 2, groin: 2, aerobic: 1 }, 'Fast lateral saves and getting down and up again, in heavy kit.'),
      R('def', 'Defender', { speed: 2, agility: 2, aerobic: 2, trunk: 2, groin: 2, hamstring: 2, power: 2, symmetry: 2 }, 'Staying low, tackling, and recovery sprints.'),
      R('mid', 'Midfielder', { aerobic: 3, speed: 2, agility: 2, hamstring: 2, groin: 2, trunk: 2, symmetry: 2 }, 'The biggest running load, in a low, bent-over position.'),
      R('fwd', 'Forward', { speed: 3, agility: 3, power: 2, hamstring: 3, reactive: 2, aerobic: 2, symmetry: 2 }, 'Acceleration, top speed and sharp changes of direction in the circle.'),
      R('dragFlicker', 'Drag-flicker', { trunk: 3, power: 2, groin: 2, symmetry: 2, upper: 1, hamstring: 1, agility: 1 }, 'A deep lunge and violent trunk rotation. The lower back and groin need the most care.'),
    ] },
];
export const SPORT = Object.fromEntries(SPORTS.map(s => [s.id, s]));
export const roleOf = (sportId, roleId) => SPORT[sportId]?.roles.find(r => r.id === roleId) || null;

/** Tests for a sport and role. The bowling check is for fast bowlers only. */
export function testsFor(sportId, roleId) {
  const s = SPORT[sportId]; if (!s) return [];
  return s.tests.filter(t => t !== 'bowlKnee' || roleId === 'pace');
}

/** Raw value from a stored result. slHop stores { L, R }; bowlKnee stores the pattern. */
export function valueOf(testId, res) {
  if (res == null) return null;
  if (testId === 'slHop') return asymmetryPct(res.L, res.R);
  if (testId === 'bowlKnee') return res.pattern ?? null;
  return Number.isFinite(res.value) ? res.value : null;
}

/** Score 0–100 against the guide bands: developing=25, solid=50, strong=75, elite=100. */
export function scoreTest(testId, value, sex = 'm') {
  const t = TESTS[testId]; if (!t || value == null) return null;
  if (testId === 'bowlKnee') return BOWL_SCORE[value] ?? null;
  const b = t.bands[sex === 'f' ? 'f' : 'm'];
  const pts = [[b[0], 25], [b[1], 50], [b[2], 75], [b[3], 100]];
  const v = value;
  const better = (x, y) => (t.higher ? x >= y : x <= y);
  if (better(v, b[3])) return 100;
  if (!better(v, b[0])) { // below "developing": scale down towards 0
    const span = Math.abs(b[1] - b[0]) || 1;
    return Math.max(0, Math.round(25 - Math.abs(v - b[0]) / span * 25));
  }
  for (let i = 0; i < 3; i++) {
    const [x0, s0] = pts[i], [x1, s1] = pts[i + 1];
    if (better(v, x0) && !better(v, x1)) return Math.round(s0 + (s1 - s0) * (v - x0) / (x1 - x0));
  }
  return 100;
}

export const bandName = s => s == null ? '–' : s >= 90 ? 'Elite' : s >= 70 ? 'Strong' : s >= 45 ? 'Solid' : s >= 20 ? 'Developing' : 'Priority';

/**
 * The athlete's profile: a score per tested quality, then the limiter.
 * Limiter = the quality with the biggest (role weight × gap to 100). A leg gap over 15% always
 * comes first: building on an imbalance means the strong side keeps doing the work.
 * @param athlete { sport, role, sex, age, results: { testId: {value}|{L,R}|{pattern} } }
 */
export function profile(athlete) {
  const role = roleOf(athlete.sport, athlete.role);
  const tests = testsFor(athlete.sport, athlete.role);
  const youth = athlete.age > 0 && athlete.age < 16;
  // Youth are tracked against their own history only: no band scores, so no adult-band limiter.
  const qualities = [];
  for (const id of tests) {
    const t = TESTS[id], value = valueOf(id, athlete.results?.[id]);
    const score = youth ? null : scoreTest(id, value, athlete.sex);
    qualities.push({ test: id, quality: t.quality, value, score, weight: role?.weights[t.quality] || 0 });
  }
  const scored = qualities.filter(q => q.score != null && q.weight > 0);
  const ranked = scored.map(q => ({ ...q, gap: q.weight * (100 - q.score) })).sort((a, b) => b.gap - a.gap);
  const asym = qualities.find(q => q.test === 'slHop' && q.value != null && q.value > 15);
  if (asym) { const i = ranked.findIndex(q => q.test === 'slHop'); if (i > 0) ranked.unshift(...ranked.splice(i, 1)); }
  const done = qualities.filter(q => q.value != null).length;
  return {
    role, tests, qualities, youth, done, total: tests.length,
    limiter: ranked[0] && ranked[0].gap > 0 ? ranked[0] : null,
    next: ranked.slice(1, 3).filter(q => q.gap > 0),
    strengths: [...scored].sort((a, b) => b.score - a.score).filter(q => q.score >= 70).slice(0, 2),
  };
}
