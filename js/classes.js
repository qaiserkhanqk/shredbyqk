// QK classes: on-demand classes that QK runs by voice, any time, with no live host.
// A class is a warm-up, blocks of timed moves, a finisher you can score, and a cool-down.
// Formats: intervals (work/rest), Tabata (8 × 20 s on / 10 s off), EMOM (every minute on the minute)
// and an AMRAP finisher ("as many rounds as possible") whose score you try to beat next time.
// Pure data and timeline builder, unit tested; the player lives in app.js.

// Moves: name, a short cue QK says as the move starts, optional `lib` (library id, for form check and
// video-free demos) and `jump` (high impact; quiet versions swap these out for apartments).
export const MOVES = {
  jacks: { name: 'Jumping jacks', cue: 'Light on your toes, arms all the way up.', jump: true, quiet: 'stepJacks' },
  stepJacks: { name: 'Step jacks', cue: 'Step out wide, arms overhead. No jumping.' },
  highKnees: { name: 'High knees', cue: 'Knees to hip height, pump your arms.', jump: true, quiet: 'marchKnees' },
  marchKnees: { name: 'Fast knee march', cue: 'Drive the knees up, quick arms.' },
  buttKicks: { name: 'Butt kicks', cue: 'Heels to glutes, stay tall.', jump: true, quiet: 'marchKnees' },
  skaters: { name: 'Skaters', cue: 'Leap side to side, land soft on one leg.', jump: true, quiet: 'curtsyLunge' },
  curtsyLunge: { name: 'Curtsy lunges', cue: 'Step back and across, chest up.' },
  squats: { name: 'Squats', cue: 'Sit back and down, chest proud.', lib: 'xBodyweightSquat' },
  jumpSquats: { name: 'Jump squats', cue: 'Squat, explode up, land soft.', lib: 'jumpSquat', jump: true, quiet: 'pulseSquats' },
  pulseSquats: { name: 'Squat pulses', cue: 'Stay low and pulse. Feel the burn.' },
  lunges: { name: 'Reverse lunges', cue: 'Step back, back knee just above the floor.', lib: 'reverseLunge' },
  jumpLunges: { name: 'Jump lunges', cue: 'Switch legs in the air, land soft.', jump: true, quiet: 'lunges' },
  pushUps: { name: 'Push-ups', cue: 'Body in one line. Knees down if you need to.', lib: 'pushUp' },
  burpees: { name: 'Burpees', cue: 'Chest to the floor, jump at the top.', lib: 'burpee', jump: true, quiet: 'squatThrusts' },
  squatThrusts: { name: 'Step-back burpees', cue: 'Hands down, step back, step in, stand.' },
  climbers: { name: 'Mountain climbers', cue: 'Hips low, drive the knees fast.', lib: 'mountainClimber' },
  plankJacks: { name: 'Plank jacks', cue: 'Hold the plank, jump the feet in and out.', jump: true, quiet: 'plankTaps' },
  plankTaps: { name: 'Plank shoulder taps', cue: 'Tap opposite shoulder, hips still.' },
  plank: { name: 'Plank hold', cue: 'Squeeze your glutes, brace your stomach.', lib: 'plank' },
  bearCrawl: { name: 'Bear crawl', cue: 'Knees just off the floor, small steps.' },
  bridges: { name: 'Glute bridges', cue: 'Drive through your heels, squeeze at the top.', lib: 'gluteBridge' },
  crunches: { name: 'Crunches', cue: 'Ribs to hips, slow on the way down.', lib: 'crunch' },
  russianTwist: { name: 'Russian twists', cue: 'Lean back, turn from the ribs.', lib: 'russianTwist' },
  flutterKicks: { name: 'Flutter kicks', cue: 'Lower back pressed down, small fast kicks.' },
  tuckJumps: { name: 'Tuck jumps', cue: 'Knees to chest, land soft.', lib: 'yKneeTuckJump', jump: true, quiet: 'pulseSquats' },
  inchworm: { name: 'Inchworms', cue: 'Walk the hands out, walk them back.', lib: 'yInchworm' },
  armCircles: { name: 'Arm circles', cue: 'Big circles, both directions.' },
  hipCircles: { name: 'Hip openers', cue: 'Knee up, open it out to the side.' },
  breathe: { name: 'Breathe and stretch', cue: 'Slow breath in through the nose, long breath out.' },
  // Dumbbell moves (home dumbbells).
  dbThruster: { name: 'Dumbbell thrusters', cue: 'Squat, then drive the weights overhead in one move.', lib: 'thruster' },
  dbRow: { name: 'Dumbbell rows', cue: 'Flat back, pull to your hip.', lib: 'dbRow' },
  dbSwing: { name: 'Dumbbell swings', cue: 'Hinge, snap the hips, arms just guide it.', lib: 'kbSwing' },
  dbPress: { name: 'Dumbbell press', cue: 'Press straight up, ribs down.', lib: 'dbShoulderPress' },
  dbRdl: { name: 'Dumbbell Romanian deadlifts', cue: 'Weights close to your legs, back flat.', lib: 'xStiffLeggedDumbbellDeadlift' },
  dbLunge: { name: 'Dumbbell lunges', cue: 'Step back, stay tall.', lib: 'xDumbbellForwardLunge' },
  dbRenegade: { name: 'Renegade rows', cue: 'Plank on the weights, row one side at a time.' },
  // Home strength moves.
  chairDips: { name: 'Chair dips', cue: 'Hands on the chair edge, elbows straight back.', lib: 'benchDip' },
  pikePushUps: { name: 'Pike push-ups', cue: 'Hips high, lower your head between your hands.' },
  superman: { name: 'Supermans', cue: 'Lift arms and legs, squeeze your back.', lib: 'superman' },
  wallSit: { name: 'Wall sit', cue: 'Back flat on the wall, thighs parallel. Hold.', lib: 'wallSit' },
  sideLunge: { name: 'Side lunges', cue: 'Step wide, sit into one hip, chest up.' },
};

const WARM = [['jacks', 40], ['armCircles', 30], ['hipCircles', 30], ['squats', 40], ['inchworm', 40]];
const COOL = [['breathe', 60], ['hipCircles', 30], ['breathe', 30]];

// Block types:
//   { type: 'intervals', rounds, work, rest, moves, restAfter }   each move for `work` s, `rest` s between
//   { type: 'tabata', move(s), restAfter }                          8 × 20 s on / 10 s off
//   { type: 'emom', minutes, moves: [[move, reps], ...] }           do the reps at the top of each minute
//   { type: 'amrap', secs, moves: [[move, reps], ...] }             score = rounds completed
export const CLASSES = [
  {
    id: 'ignite20', name: 'Ignite 20', level: 'Beginner', equipment: 'none', tagline: 'Your first HIIT class. 30 seconds on, 30 off. Go at your pace.',
    blocks: [
      { type: 'intervals', name: 'Block 1', rounds: 2, work: 30, rest: 30, moves: ['squats', 'jacks', 'pushUps', 'climbers'], restAfter: 60 },
      { type: 'intervals', name: 'Block 2', rounds: 2, work: 30, rest: 30, moves: ['lunges', 'highKnees', 'bridges', 'plank'], restAfter: 60 },
    ],
  },
  {
    id: 'fullThrottle30', name: 'Full Throttle 30', level: 'Intermediate', equipment: 'none', tagline: 'Full-body HIIT. 40 on, 20 off, and a finisher to beat.',
    blocks: [
      { type: 'intervals', name: 'Lower', rounds: 3, work: 40, rest: 20, moves: ['jumpSquats', 'lunges', 'skaters'], restAfter: 60 },
      { type: 'intervals', name: 'Upper and core', rounds: 3, work: 40, rest: 20, moves: ['pushUps', 'plankJacks', 'climbers'], restAfter: 60 },
      { type: 'amrap', name: 'Finisher', secs: 240, moves: [['burpees', 5], ['squats', 10], ['climbers', 20]] },
    ],
  },
  {
    id: 'tabataTorch', name: 'Tabata Torch', level: 'Advanced', equipment: 'none', tagline: 'Four Tabatas. 20 seconds all-out, 10 seconds rest. Short and brutal.',
    blocks: [
      { type: 'tabata', name: 'Tabata 1', moves: ['jumpSquats', 'pushUps'], restAfter: 60 },
      { type: 'tabata', name: 'Tabata 2', moves: ['highKnees', 'climbers'], restAfter: 60 },
      { type: 'tabata', name: 'Tabata 3', moves: ['jumpLunges', 'plankJacks'], restAfter: 60 },
      { type: 'tabata', name: 'Tabata 4', moves: ['burpees', 'tuckJumps'] },
    ],
  },
  {
    id: 'minuteMaker', name: 'Minute Maker', level: 'Intermediate', equipment: 'none', tagline: 'EMOM: do the reps at the top of every minute, rest for what\'s left.',
    blocks: [
      { type: 'emom', name: 'EMOM 20', minutes: 20, moves: [['burpees', 10], ['squats', 20], ['pushUps', 12], ['climbers', 30]] },
    ],
  },
  {
    id: 'livingRoom', name: 'Living Room Shred', level: 'All levels', equipment: 'none', quiet: true, home: true, tagline: 'No jumping, no noise. Apartment-friendly HIIT that still burns.',
    blocks: [
      { type: 'intervals', name: 'Block 1', rounds: 3, work: 40, rest: 20, moves: ['squats', 'stepJacks', 'pushUps', 'plankTaps'], restAfter: 60 },
      { type: 'intervals', name: 'Block 2', rounds: 3, work: 40, rest: 20, moves: ['curtsyLunge', 'marchKnees', 'bridges', 'flutterKicks'], restAfter: 60 },
    ],
  },
  {
    id: 'dumbbellBlitz', name: 'Dumbbell Blitz', level: 'Intermediate', equipment: 'dumbbells', home: true, tagline: 'Two dumbbells, thirty minutes. Strength and sweat in one.',
    blocks: [
      { type: 'intervals', name: 'Strength', rounds: 3, work: 45, rest: 15, moves: ['dbThruster', 'dbRow', 'dbRdl', 'dbPress'], restAfter: 60 },
      { type: 'intervals', name: 'Burn', rounds: 2, work: 40, rest: 20, moves: ['dbSwing', 'dbLunge', 'dbRenegade', 'climbers'], restAfter: 60 },
      { type: 'amrap', name: 'Finisher', secs: 180, moves: [['dbThruster', 8], ['burpees', 6]] },
    ],
  },
  {
    id: 'legBurner', name: 'Leg Burner', level: 'All levels', equipment: 'none', home: true, quiet: true, tagline: 'Legs and glutes at home. No jumping, no equipment, lots of burn.',
    blocks: [
      { type: 'intervals', name: 'Legs', rounds: 3, work: 45, rest: 15, moves: ['squats', 'lunges', 'sideLunge', 'bridges'], restAfter: 60 },
      { type: 'intervals', name: 'Burnout', rounds: 2, work: 40, rest: 20, moves: ['pulseSquats', 'curtsyLunge', 'wallSit'] },
    ],
  },
  {
    id: 'upperHome', name: 'Upper Body at Home', level: 'All levels', equipment: 'none', home: true, quiet: true, tagline: 'Chest, shoulders, arms and back with just a chair.',
    blocks: [
      { type: 'intervals', name: 'Push', rounds: 3, work: 40, rest: 20, moves: ['pushUps', 'pikePushUps', 'chairDips'], restAfter: 60 },
      { type: 'intervals', name: 'Back and core', rounds: 3, work: 40, rest: 20, moves: ['superman', 'plankTaps', 'bearCrawl'] },
    ],
  },
  {
    id: 'fullBody20', name: '20-Minute Full Body', level: 'All levels', equipment: 'none', home: true, tagline: 'No time? Twenty minutes, whole body, done.',
    warmup: [['jacks', 30], ['inchworm', 30], ['squats', 30]],
    blocks: [
      { type: 'intervals', name: 'Circuit', rounds: 3, work: 40, rest: 20, moves: ['squats', 'pushUps', 'lunges', 'climbers', 'bridges'], restAfter: 45 },
      { type: 'amrap', name: 'Finisher', secs: 120, moves: [['burpees', 5], ['squats', 10]] },
    ],
  },
  {
    id: 'coreCrusher', name: 'Core Crusher 15', level: 'All levels', equipment: 'none', home: true, tagline: 'Fifteen minutes of abs and core. Add it on after any workout.',
    warmup: [['climbers', 30], ['inchworm', 30]],
    blocks: [
      { type: 'intervals', name: 'Core', rounds: 3, work: 40, rest: 20, moves: ['crunches', 'russianTwist', 'flutterKicks', 'plankTaps'], restAfter: 30 },
    ],
  },
];

export const byId = id => CLASSES.find(c => c.id === id);
const mv = (id, quiet) => (quiet && MOVES[id]?.jump && MOVES[id].quiet ? MOVES[id].quiet : id);

/**
 * The class as a list of timed segments.
 * @param o { quiet } swap jumping moves for quiet versions
 * @returns { segs: [{ kind: 'warmup'|'work'|'rest'|'emom'|'amrap'|'cooldown', move?, secs, reps?, label, block, round? }], total }
 */
export function timeline(cls, { quiet = !!cls.quiet } = {}) {
  const segs = [], add = s => segs.push(s);
  for (const [m, s] of cls.warmup || WARM) add({ kind: 'warmup', move: mv(m, quiet), secs: s, label: 'Warm-up', block: 'Warm-up' });
  cls.blocks.forEach((b, bi) => {
    if (b.type === 'intervals') {
      for (let r = 1; r <= b.rounds; r++) b.moves.forEach((m, i) => {
        add({ kind: 'work', move: mv(m, quiet), secs: b.work, label: b.name, block: b.name, round: r, of: b.rounds });
        const last = r === b.rounds && i === b.moves.length - 1;
        if (!last && b.rest) add({ kind: 'rest', secs: b.rest, label: 'Rest', block: b.name });
      });
    } else if (b.type === 'tabata') {
      for (let i = 0; i < 8; i++) {
        add({ kind: 'work', move: mv(b.moves[i % b.moves.length], quiet), secs: 20, label: b.name, block: b.name, round: i + 1, of: 8 });
        if (i < 7) add({ kind: 'rest', secs: 10, label: 'Rest', block: b.name });
      }
    } else if (b.type === 'emom') {
      for (let i = 0; i < b.minutes; i++) { const [m, reps] = b.moves[i % b.moves.length]; add({ kind: 'emom', move: mv(m, quiet), reps, secs: 60, label: b.name, block: b.name, round: i + 1, of: b.minutes }); }
    } else if (b.type === 'amrap') {
      add({ kind: 'amrap', moves: b.moves.map(([m, reps]) => [mv(m, quiet), reps]), secs: b.secs, label: b.name, block: b.name });
    }
    if (b.restAfter && bi < cls.blocks.length - 1) add({ kind: 'rest', secs: b.restAfter, label: 'Block rest', block: b.name });
  });
  for (const [m, s] of cls.cooldown || COOL) add({ kind: 'cooldown', move: m, secs: s, label: 'Cool-down', block: 'Cool-down' });
  return { segs, total: segs.reduce((a, s) => a + s.secs, 0) };
}

export const minutes = cls => Math.round(timeline(cls).total / 60);
/** Work-to-rest summary for the class card, e.g. "40 on / 20 off". */
export function format(cls) {
  const t = cls.blocks.map(b => (b.type === 'intervals' ? `${b.work} on / ${b.rest} off` : b.type === 'tabata' ? 'Tabata' : b.type === 'emom' ? 'EMOM' : 'AMRAP finisher'));
  return [...new Set(t)].join(' · ');
}

/** What QK says as a segment starts. */
export function callout(seg, next) {
  const name = m => MOVES[m]?.name || m;
  if (seg.kind === 'rest') return `Rest. ${next?.move ? `Next up: ${name(next.move)}.` : ''}`.trim();
  if (seg.kind === 'emom') return `Minute ${seg.round}. ${seg.reps} ${name(seg.move).toLowerCase()}. Go!`;
  if (seg.kind === 'amrap') return `Finisher! As many rounds as you can: ${seg.moves.map(([m, r]) => `${r} ${name(m).toLowerCase()}`).join(', ')}. Tap the screen after every round. Go!`;
  const m = MOVES[seg.move];
  return `${m?.name || seg.move}. ${m?.cue || ''}`.trim();
}

/** Last time's finisher score for a class, from saved class results. */
export const bestScore = (results, id) => Math.max(0, ...results.filter(r => r.class === id && r.score != null).map(r => r.score));
