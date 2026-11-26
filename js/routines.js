// Warm-up drills, post-workout stretches and recovery routines that QK runs by voice.
// Built on the class engine (classes.js): a routine is a class whose block is a "flow" of timed moves.
// One-sided stretches get both sides, with QK saying "switch sides".
//  - Pre-workout drills: dynamic moves for what today's workout trains (lower, upper, full body, run).
//  - Post-workout stretch: static holds for the muscles trained today, finishing with slow breathing.
//  - Recovery routines: rest-day mobility, foam rolling, tight hips, desk back and neck, runner's
//    recovery and a bedtime stretch.
// Pure, unit tested. Static stretching is kept for after training; before training, dynamic drills
// (static holds over ~60 s right before lifting can briefly reduce strength; Behm et al. 2016).

export const MOVES = {
  // Dynamic drills
  legSwings: { name: 'Leg swings', cue: 'Hold something for balance, swing front to back, nice and loose.', lib: 'yFrontLegRaises', sides: true },
  hipOpeners: { name: 'Hip circles', cue: 'Knee up and open it out to the side, then reverse.', lib: 'yStandingHipCircles', sides: true },
  worldsGreatest: { name: 'World\'s greatest stretch', cue: 'Lunge, elbow to the instep, then rotate and reach up.', lib: 'yWorldSGreatestStretch', sides: true },
  walkouts: { name: 'Inchworm walkouts', cue: 'Walk the hands out to a plank, then walk back up.', lib: 'yInchworm' },
  airSquats: { name: 'Bodyweight squats', cue: 'Slow and deep, chest up. Wake the legs up.', lib: 'xBodyweightSquat' },
  bridgesD: { name: 'Glute bridges', cue: 'Squeeze at the top for a second.', lib: 'gluteBridge' },
  lungeTwist: { name: 'Lunge with a twist', cue: 'Step into a lunge, turn your chest over the front knee.', lib: 'yCrossoverReverseLunge' },
  armCirclesD: { name: 'Arm circles', cue: 'Small to big, forwards then backwards.', lib: 'yArmCircles' },
  pullAparts: { name: 'Band pull-aparts', cue: 'Arms straight, pull the band to your chest. No band? Squeeze the shoulder blades.', lib: 'bandPullApart' },
  catCow: { name: 'Cat-cow', cue: 'Round the back up, then let it sag. Move with your breath.', lib: 'catCamel' },
  torsoTwist: { name: 'Torso rotations', cue: 'Turn from the ribs, hips facing forward.', lib: 'yTorsoRotation' },
  shoulderRolls: { name: 'Shoulder circles', cue: 'Big slow circles, both ways.', lib: 'yShoulderCircles' },
  ankleCircles: { name: 'Ankle circles', cue: 'Draw big circles with your toes.', lib: 'yAnkleCircles', sides: true },
  skips: { name: 'A-skips', cue: 'Knee up, quick light steps, arms driving.' },
  pushUpPlus: { name: 'Easy push-ups', cue: 'A few smooth reps to warm the chest and shoulders.', lib: 'pushUp' },
  // Static stretches
  quadStretch: { name: 'Standing quad stretch', cue: 'Heel to your glute, knees together, hips forward.', lib: 'yQuadStretch', sides: true, muscles: ['Quads'] },
  hipFlexor: { name: 'Kneeling hip flexor stretch', cue: 'Back knee down, squeeze that glute, shift forward.', lib: 'yKneelingHipFlexor', sides: true, muscles: ['Quads', 'Glutes'] },
  hamStretch: { name: 'Seated hamstring stretch', cue: 'Long back, reach for your toes, don\'t bounce.', lib: 'ySeatedHamstring', muscles: ['Hamstrings', 'Calves'] },
  runnerStretch: { name: 'Runner\'s stretch', cue: 'Front leg straight, toes up, hinge forward.', lib: 'yRunnerSStretch', sides: true, muscles: ['Hamstrings', 'Calves'] },
  figure4: { name: 'Figure-four glute stretch', cue: 'Ankle over the opposite knee, pull the leg towards you.', lib: 'yAnkleOnTheKnee', sides: true, muscles: ['Glutes'] },
  calfWall: { name: 'Calf stretch on the wall', cue: 'Back heel down, lean into the wall.', lib: 'yCalfStretchHandsAgainstWall', sides: true, muscles: ['Calves'] },
  chestDoor: { name: 'Chest and shoulder stretch', cue: 'Arm on a wall or door frame, turn your body away.', lib: 'yChestAndFrontOfShoulderStretch', sides: true, muscles: ['Chest', 'Shoulders'] },
  crossBody: { name: 'Cross-body shoulder stretch', cue: 'Pull the arm across your chest, shoulder down.', lib: 'yShoulderStretch', sides: true, muscles: ['Shoulders', 'Back'] },
  latStretch: { name: 'Overhead lat stretch', cue: 'Reach up and over, feel the side of your back open.', lib: 'yOverheadLat', sides: true, muscles: ['Back', 'Triceps'] },
  tricepsStretch: { name: 'Triceps stretch', cue: 'Hand behind your head, gently press the elbow.', lib: 'yTricepsStretch', sides: true, muscles: ['Triceps'] },
  bicepsStretch: { name: 'Biceps stretch', cue: 'Arms behind you, thumbs down, open the chest.', lib: 'yStandingBicepsStretch', muscles: ['Biceps', 'Forearms'] },
  sideBend: { name: 'Standing side bend', cue: 'Reach long over to the side, don\'t lean forward.', lib: 'yStandingLateralStretch', sides: true, muscles: ['Core'] },
  cobra: { name: 'Cobra stretch', cue: 'Hips down, press up gently, open the front of your body.', lib: 'yUpwardStretch', muscles: ['Core', 'Chest'] },
  butterfly: { name: 'Butterfly stretch', cue: 'Soles together, let the knees drop.', lib: 'yLyingBentLegGroin', muscles: ['Quads'] },
  childPose: { name: 'Child\'s pose', cue: 'Sit back on your heels, arms long, breathe into your back.', lib: 'yChildSPose', muscles: ['Back', 'Glutes'] },
  neckSide: { name: 'Side neck stretch', cue: 'Ear towards your shoulder, the other shoulder down.', lib: 'ySideNeckStretch', sides: true, muscles: ['Neck'] },
  wristStretch: { name: 'Wrist stretch', cue: 'Arm straight, gently pull the fingers back.', lib: 'yKneelingForearmStretch', muscles: ['Forearms'] },
  kneesToChest: { name: 'Knees to chest', cue: 'Hug the knees in, rock gently side to side.', lib: 'yHugKneesToChest', muscles: ['Back'] },
  spinalTwist: { name: 'Lying spinal twist', cue: 'Knees fall to one side, look the other way.', lib: 'yLyingCrossover', sides: true, muscles: ['Back', 'Glutes'] },
  // Foam rolling
  rollQuads: { name: 'Foam roll quads', cue: 'Slow rolls, pause on tight spots and breathe.', lib: 'yQuadricepsSmr' },
  rollCalves: { name: 'Foam roll calves', cue: 'Roll from ankle to knee, turn the foot in and out.', lib: 'yCalvesSmr' },
  rollIT: { name: 'Foam roll outer thigh', cue: 'Side of the thigh, top leg helps take the weight.', lib: 'yIliotibialTractSmr', sides: true },
  rollGlutes: { name: 'Foam roll glutes', cue: 'Sit on the roller, ankle over the knee, lean into the hip.', lib: 'yPiriformisSmr', sides: true },
  rollUpperBack: { name: 'Foam roll upper back', cue: 'Hands behind your head, roll between the shoulder blades.', lib: 'yRhomboidsSmr' },
  rollLats: { name: 'Foam roll lats', cue: 'On your side, arm overhead, small rolls.', lib: 'yLatissimusDorsiSmr', sides: true },
  breathe: { name: 'Slow breathing', cue: 'In through the nose for four, out through the mouth for six.' },
};

const R = (id, name, tagline, moves, extra = {}) => ({ id, name, tagline, level: 'All levels', equipment: 'none', routine: true, warmup: [], cooldown: [], blocks: [{ type: 'flow', name, moves }], ...extra });

/** Recovery routines for rest days. */
export const ROUTINES = [
  R('restDay15', 'Rest-Day Mobility', 'Fifteen easy minutes to loosen everything up on a rest day.', [['catCow', 60], ['worldsGreatest', 45], ['hipOpeners', 40], ['figure4', 45], ['hipFlexor', 45], ['hamStretch', 60], ['latStretch', 40], ['chestDoor', 40], ['spinalTwist', 45], ['childPose', 60], ['breathe', 60]], { kind: 'recovery' }),
  R('foamRoll10', 'Foam Roll 10', 'Ten minutes on the foam roller for sore legs and a tight back.', [['rollCalves', 60], ['rollQuads', 75], ['rollIT', 45], ['rollGlutes', 45], ['rollUpperBack', 60], ['rollLats', 40], ['breathe', 45]], { kind: 'recovery', equipment: 'foam roller' }),
  R('tightHips', 'Tight Hips', 'Sitting all day? Open the hips back up in eight minutes.', [['hipOpeners', 40], ['hipFlexor', 60], ['figure4', 60], ['butterfly', 60], ['worldsGreatest', 40], ['spinalTwist', 45], ['breathe', 45]], { kind: 'recovery' }),
  R('deskReset', 'Desk Back & Neck', 'For desk days: neck, upper back and shoulders, seven minutes.', [['shoulderRolls', 40], ['neckSide', 30], ['chestDoor', 40], ['crossBody', 35], ['catCow', 60], ['latStretch', 35], ['childPose', 60], ['breathe', 40]], { kind: 'recovery' }),
  R('runnerRecovery', 'Runner\'s Recovery', 'After a run: calves, hamstrings, hips and quads.', [['calfWall', 45], ['runnerStretch', 45], ['quadStretch', 40], ['hipFlexor', 45], ['figure4', 45], ['kneesToChest', 45], ['breathe', 45]], { kind: 'recovery' }),
  R('bedtime', 'Bedtime Stretch', 'Slow, quiet stretches to switch off before sleep.', [['childPose', 60], ['kneesToChest', 60], ['spinalTwist', 50], ['figure4', 45], ['butterfly', 60], ['breathe', 90]], { kind: 'recovery', calm: true }),
];

const LOWER = ['Quads', 'Hamstrings', 'Glutes', 'Calves'];
const UPPER = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms'];

/** Muscles worked by a list of library ids, most-worked first. */
export function musclesOf(ids, lib) {
  const n = {}; for (const id of ids) (lib[id]?.muscles || []).forEach((m, i) => { n[m] = (n[m] || 0) + (i === 0 ? 2 : 1); });
  return Object.entries(n).sort((a, b) => b[1] - a[1]).map(([m]) => m);
}

/** What kind of session: 'run', 'lower', 'upper' or 'full'. */
export function sessionType(ids, lib) {
  if (ids.length && ids.every(id => ['run', 'hyrox', 'cardio'].includes(lib[id]?.kind))) return 'run';
  // By each exercise's main muscle, so a deadlift's lower back doesn't make leg day look like upper body.
  const m = ids.map(id => lib[id]?.muscles?.[0]).filter(Boolean), lo = m.filter(x => LOWER.includes(x)).length, up = m.filter(x => UPPER.includes(x)).length;
  return lo && !up ? 'lower' : up && !lo ? 'upper' : 'full';
}

const DRILLS = {
  lower: [['ankleCircles', 20], ['legSwings', 25], ['hipOpeners', 25], ['worldsGreatest', 30], ['airSquats', 40], ['bridgesD', 30], ['lungeTwist', 40]],
  upper: [['armCirclesD', 30], ['shoulderRolls', 30], ['pullAparts', 40], ['catCow', 40], ['torsoTwist', 30], ['walkouts', 40], ['pushUpPlus', 30]],
  full: [['armCirclesD', 30], ['legSwings', 20], ['hipOpeners', 20], ['worldsGreatest', 30], ['walkouts', 40], ['airSquats', 30], ['pullAparts', 30]],
  run: [['ankleCircles', 20], ['legSwings', 25], ['hipOpeners', 20], ['lungeTwist', 40], ['skips', 40], ['airSquats', 30]],
};

/** Pre-workout drills for today's exercises (about 5 minutes). */
export function warmupFor(ids, lib) {
  const t = sessionType(ids, lib);
  const label = { lower: 'Leg-day', upper: 'Upper-body', full: 'Full-body', run: 'Run' }[t];
  return R('drills-' + t, `${label} warm-up drills`, 'Dynamic moves to get you ready. QK keeps the static stretching for after.', DRILLS[t], { kind: 'drills', for: t });
}

/** Post-workout stretch for the muscles trained (about 6–8 minutes). */
export function stretchFor(ids, lib, { hold = 40, max = 7 } = {}) {
  const want = musclesOf(ids, lib), picked = [], covered = new Set();
  for (const m of want) {
    if (picked.length >= max) break;
    if (covered.has(m)) continue;
    const s = Object.entries(MOVES).find(([k, mv]) => mv.muscles?.includes(m) && !picked.some(p => p[0] === k));
    if (s) { picked.push([s[0], hold]); s[1].muscles.forEach(x => covered.add(x)); }
  }
  if (!picked.length) picked.push(['hamStretch', hold], ['chestDoor', hold], ['figure4', hold]);
  picked.push(['childPose', 45], ['breathe', 45]);
  return R('stretch-' + want.slice(0, 3).join('-').toLowerCase(), 'Cool-down stretch', `Stretches for what you trained: ${want.slice(0, 3).join(', ').toLowerCase() || 'full body'}.`, picked, { kind: 'stretch' });
}
