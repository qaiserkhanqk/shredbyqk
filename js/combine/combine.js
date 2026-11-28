// Athlete Combine: tests, scoring and the #1 limiter, for the sports and positions in athletes.js.
//
// sport + position (athletes.js) → the combine tests for that sport → each result scored 0–100 against
// guide bands → position weights say which qualities matter most → the biggest weighted gap is the
// athlete's #1 limiter → athletes.buildProgram puts work for it at the top of every session.
//
// GUIDE BANDS ARE PROVISIONAL: rounded ranges in line with published team-sport testing for adult
// athletes, for QK to review. Not a validated norm. Under-16s are not scored against them.
// Position weights (0–3) are coaching judgement built from each role's description in athletes.js.
import { asymmetryPct } from './tests.js';

export const QUALITIES = {
  power: { name: 'Explosive power', short: 'Power', why: 'How much force you produce fast: jumping, first steps, heading, striking.' },
  reactive: { name: 'Reactive strength', short: 'Spring', why: 'How well your legs act like a spring. Short ground contacts make faster running and quicker feet.' },
  speed: { name: 'Top speed', short: 'Speed', why: 'Your maximum sprinting speed. Regular sprinting also gets your hamstrings used to top-speed work.' },
  agility: { name: 'Change of direction', short: 'Agility', why: 'How fast you stop, turn and go again.' },
  hamstring: { name: 'Hamstring strength', short: 'Hamstrings', why: 'Strength at long muscle length, the position hamstrings work in at top speed.' },
  symmetry: { name: 'Left–right balance', short: 'Balance', why: 'A big gap between legs is common (dominant side, old injuries, habits) and a common training target. If one leg hurts or feels unstable, see a physio.' },
  aerobic: { name: 'Repeat-effort fitness', short: 'Engine', why: 'How often you can sprint, recover and sprint again.' },
  upper: { name: 'Upper-body strength', short: 'Upper body', why: 'Pushing, pulling and holding off opponents.' },
  grip: { name: 'Grip strength', short: 'Grip', why: 'Holding on: the bat, the stick, the racket, the opponent.' },
  trunk: { name: 'Trunk strength', short: 'Trunk', why: 'Transfers force from legs to arms and helps you control rotation.' },
  groin: { name: 'Groin (adductor) strength', short: 'Groin', why: 'A common training target in sports with kicking, side-to-side pushes and deep lunges.' },
};

// m = adult male, f = adult female: [developing, solid, strong, elite]. higher: is a bigger number better?
export const TESTS = {
  cmj: { name: 'Countermovement jump', quality: 'power', kind: 'camera', unit: 'cm', higher: true, bands: { m: [30, 36, 42, 48], f: [22, 27, 32, 37] },
    how: ['Phone on the floor, side-on, 2–3 m away, feet in view.', 'Hands on hips. Stand still for a second, dip and jump straight up. Land with straight legs.', '3 jumps. A slow-motion upload gives a steadier reading.'] },
  hops: { name: 'Reactive hops (10 hops)', quality: 'reactive', kind: 'camera', unit: 'RSI', higher: true, bands: { m: [1.2, 1.6, 2.0, 2.5], f: [1.0, 1.4, 1.8, 2.2] },
    how: ['Same set-up as the jump. Hands on hips.', 'Hop 10 times as high as you can with the least time on the ground. Stiff ankles, straight legs.', 'Slow-motion upload strongly advised: ground contacts are about 0.2 s.'] },
  fly10: { name: 'Flying 10 m sprint', quality: 'speed', kind: 'camera', unit: 'km/h', higher: true, upload: true, gates: 2, bands: { m: [26, 29, 31.5, 33.5], f: [23, 25.5, 27.5, 29.5] },
    how: ['Put 2 cones exactly 10 m apart. Phone on a tripod side-on, 10–15 m back, both cones in frame.', 'Build up over 20–30 m before the first cone, sprint flat out through the second.', 'Upload the slow-motion video, then tap the two cones.'] },
  s505: { name: '5-0-5 change of direction', quality: 'agility', kind: 'camera', unit: 's', higher: false, upload: true, gates: 1, bands: { m: [2.75, 2.55, 2.4, 2.25], f: [3.0, 2.8, 2.65, 2.5] },
    how: ['Mark a turn line, and a cone line 5 m before it. Start 10 m before the cone line.', 'Phone side-on to the cone line. Sprint through it, turn on the turn line, sprint back through.', 'Upload the video and tap the cone line. Test turning off each foot.'] },
  nordic: { name: 'Nordic hamstring lower', quality: 'hamstring', kind: 'camera', unit: '°', higher: true, bands: { m: [30, 45, 60, 75], f: [25, 40, 55, 70] },
    how: ['Kneel on a mat, a partner holding your ankles (or ankles hooked under something solid).', 'Phone side-on at knee height. Body straight from knees to head, arms ready to catch.', 'Lower forward as slowly as you can. The angle where you lose control is your score.'] },
  slHop: { name: 'Single-leg jump, left vs right', quality: 'symmetry', kind: 'camera', unit: '% gap', higher: false, sides: true, bands: { m: [20, 15, 10, 5], f: [20, 15, 10, 5] },
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
};

const T = 'cmj hops fly10 s505 nordic slHop yoyo';
export const SPORT_TESTS = {
  cricket: `${T} sidePlank pushups`, football: `${T} copenhagen sidePlank`, hockey: 'cmj fly10 s505 nordic slHop yoyo copenhagen sidePlank',
  mma: 'cmj hops slHop yoyo pushups deadHang sidePlank', boxing: 'cmj hops slHop yoyo pushups sidePlank',
  padel: 'cmj hops s505 slHop yoyo sidePlank', tennis: 'cmj hops s505 slHop yoyo sidePlank pushups', squash: 'cmj hops s505 slHop yoyo sidePlank copenhagen',
};
export const testsFor = sport => (SPORT_TESTS[sport] || '').split(' ').filter(Boolean);

// Position weights, keyed sport:role (role ids from athletes.js). 3 = key quality, 0/absent = not weighted.
const w = s => Object.fromEntries(s.split(' ').map(p => { const [k, v] = p.split(':'); return [k, +v]; }));
export const WEIGHTS = {
  'cricket:fastSide': w('power:2 reactive:2 hamstring:2 symmetry:3 trunk:3 aerobic:2 speed:1 upper:1 groin:1'),
  'cricket:fastFront': w('power:2 reactive:2 hamstring:2 symmetry:3 trunk:3 aerobic:2 speed:1 upper:1 groin:1'),
  'cricket:fastMixed': w('power:2 reactive:2 hamstring:2 symmetry:3 trunk:3 aerobic:2 speed:1 upper:1 groin:1'),
  'cricket:spin': w('trunk:2 symmetry:2 aerobic:2 power:1 agility:1 upper:2 grip:2'),
  'cricket:batPower': w('power:3 trunk:3 upper:2 grip:2 speed:2 agility:2 symmetry:1'),
  'cricket:batClassic': w('aerobic:2 speed:2 agility:2 trunk:2 power:1 grip:1 symmetry:1 hamstring:2'),
  'cricket:keeper': w('agility:3 power:2 reactive:2 trunk:2 symmetry:2 aerobic:1 groin:2'),
  'cricket:allrounder': w('power:2 trunk:3 symmetry:2 aerobic:2 hamstring:2 speed:1 agility:1 upper:1'),
  'football:gk': w('power:3 reactive:2 agility:3 upper:2 trunk:2 symmetry:2 speed:1 aerobic:1 hamstring:1 groin:2'),
  'football:cb': w('power:3 speed:2 agility:2 hamstring:2 aerobic:2 trunk:2 groin:2 upper:1 symmetry:2 reactive:1'),
  'football:fb': w('speed:3 aerobic:3 agility:2 hamstring:3 reactive:2 groin:2 symmetry:2 power:1 trunk:1'),
  'football:cdm': w('aerobic:3 trunk:3 agility:2 groin:2 power:2 hamstring:2 symmetry:2 speed:1 upper:1'),
  'football:wide': w('speed:3 agility:3 reactive:2 hamstring:3 aerobic:2 symmetry:2 power:1 groin:1'),
  'football:st': w('speed:3 power:3 agility:2 hamstring:3 reactive:2 trunk:1 symmetry:2 aerobic:1 upper:1'),
  'hockey:gk': w('power:2 agility:3 symmetry:2 trunk:2 groin:2 aerobic:1'),
  'hockey:def': w('speed:2 agility:2 aerobic:2 trunk:2 groin:2 hamstring:2 power:2 symmetry:2'),
  'hockey:mid': w('aerobic:3 speed:2 agility:2 hamstring:2 groin:2 trunk:2 symmetry:2'),
  'hockey:fwd': w('speed:3 agility:3 power:2 hamstring:3 aerobic:2 symmetry:2'),
  'mma:striker': w('power:3 reactive:3 aerobic:3 trunk:2 symmetry:2 upper:2 grip:1'),
  'mma:grappler': w('grip:3 upper:3 trunk:3 power:2 aerobic:3 symmetry:1'),
  'mma:allround': w('power:2 aerobic:3 grip:2 upper:2 trunk:2 reactive:2 symmetry:2'),
  'boxing:out': w('aerobic:3 reactive:3 symmetry:2 upper:2 trunk:1 power:1'),
  'boxing:pressure': w('aerobic:3 trunk:3 power:2 upper:2 reactive:1 symmetry:1'),
  'boxing:power': w('power:3 upper:3 trunk:2 reactive:2 aerobic:1 symmetry:1'),
  'padel:left': w('power:3 agility:2 reactive:2 trunk:2 symmetry:2 aerobic:1'),
  'padel:right': w('agility:3 aerobic:2 reactive:2 symmetry:2 trunk:1 power:1'),
  'tennis:aggressive': w('power:3 reactive:2 agility:2 trunk:2 upper:2 symmetry:1 aerobic:1'),
  'tennis:counter': w('agility:3 aerobic:3 reactive:2 symmetry:2 trunk:1 power:1'),
  'squash:attack': w('agility:3 power:2 reactive:2 trunk:2 symmetry:2 aerobic:2 groin:1'),
  'squash:retrieve': w('aerobic:3 agility:3 symmetry:3 groin:2 trunk:1 reactive:1'),
};
export const weightsFor = (sport, role) => WEIGHTS[`${sport}:${role}`] || {};

// Work for each quality when it is the limiter: library ids from library.js / library-athlete.js.
// cat is the dose category athletes.buildProgram uses for it.
export const LIMITER_WORK = {
  power: { cat: 'power', ex: ['trapBarJump', 'yFrontBoxJump'] },
  reactive: { cat: 'power', ex: ['pogoJumps', 'yLateralBound'] },
  speed: { cat: 'condition', ex: ['yFastSkipping', 'runSprints'] },
  agility: { cat: 'power', ex: ['dropStick', 'skaterBounds'] },
  hamstring: { cat: 'protect', ex: ['nordic', 'singleLegRdl'] },
  symmetry: { cat: 'strength', ex: ['bulgarian', 'dropStick'] },
  aerobic: { cat: 'condition', ex: ['runIntervals'] },
  upper: { cat: 'strength', ex: ['pullUp', 'landminePress'] },
  grip: { cat: 'protect', ex: ['deadHang', 'towelPullUp'] },
  trunk: { cat: 'trunk', ex: ['sidePlank', 'pallof'] },
  groin: { cat: 'protect', ex: ['copenhagen', 'lateralLunge'] },
};

/** Raw value from a stored result. slHop stores { L, R }. */
export function valueOf(testId, res) {
  if (res == null) return null;
  if (testId === 'slHop') return asymmetryPct(res.L, res.R);
  return Number.isFinite(res.value) ? res.value : null;
}

/** Score 0–100 against the guide bands: developing=25, solid=50, strong=75, elite=100. */
export function scoreTest(testId, value, sex = 'm') {
  const t = TESTS[testId]; if (!t || value == null) return null;
  const b = t.bands[sex === 'f' ? 'f' : 'm'];
  const better = (x, y) => (t.higher ? x >= y : x <= y);
  if (better(value, b[3])) return 100;
  if (!better(value, b[0])) return Math.max(0, Math.round(25 - Math.abs(value - b[0]) / (Math.abs(b[1] - b[0]) || 1) * 25));
  const pts = [25, 50, 75, 100];
  for (let i = 0; i < 3; i++) if (better(value, b[i]) && !better(value, b[i + 1])) return Math.round(pts[i] + 25 * (value - b[i]) / (b[i + 1] - b[i]));
  return 100;
}

export const bandName = s => s == null ? '–' : s >= 90 ? 'Elite' : s >= 70 ? 'Strong' : s >= 45 ? 'Solid' : s >= 20 ? 'Developing' : 'Priority';

/**
 * Profile: a score per tested quality, then the limiter = the biggest (position weight × gap to 100).
 * A leg gap over 15% always comes first. Under-16s get no band scores, so no limiter.
 * @param c { sport, role, sex: 'm'|'f', age, results: { testId: {value} | {L,R} } }
 */
export function profile(c) {
  const tests = testsFor(c.sport), weights = weightsFor(c.sport, c.role);
  const youth = c.age > 0 && c.age < 16;
  const qualities = tests.map(id => {
    const t = TESTS[id], value = valueOf(id, c.results?.[id]);
    return { test: id, quality: t.quality, value, score: youth ? null : scoreTest(id, value, c.sex), weight: weights[t.quality] || 0 };
  });
  const ranked = qualities.filter(q => q.score != null && q.weight > 0).map(q => ({ ...q, gap: q.weight * (100 - q.score) })).sort((a, b) => b.gap - a.gap);
  const asym = qualities.find(q => q.test === 'slHop' && q.value != null && q.value > 15);
  if (asym && !youth) { const i = ranked.findIndex(q => q.test === 'slHop'); if (i > 0) ranked.unshift(...ranked.splice(i, 1)); }
  return {
    tests, qualities, youth, done: qualities.filter(q => q.value != null).length, total: tests.length,
    limiter: ranked[0]?.gap > 0 ? ranked[0] : null,
    next: ranked.slice(1, 3).filter(q => q.gap > 0),
    strengths: qualities.filter(q => q.score >= 70).sort((a, b) => b.score - a.score).slice(0, 2),
  };
}

/**
 * What the Combine adds to the athlete's programme (athletes.buildProgram focus), or null if nothing yet.
 * fixes: faults from the movement checks (screens.js topFixes), each { title, ex: [[id, dose]...] }.
 */
export function programFocus(c, fixes = []) {
  if (!c?.sport || !c?.role) return null;
  const p = profile(c), q = p.limiter?.quality;
  const limiter = q ? { name: QUALITIES[q].name, cat: LIMITER_WORK[q].cat, ex: LIMITER_WORK[q].ex } : null;
  const fx = fixes.map(f => ({ title: f.title, ex: f.ex.map(([id]) => id) }));
  return limiter || fx.length ? { limiter, fixes: fx } : null;
}
