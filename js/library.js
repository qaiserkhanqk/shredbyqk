// Exercise library: every exercise maps to a movement pattern in exercises.js.
//  - pattern set  → QK checks form with the camera (rep counting, joint angles, cues, tempo, fatigue).
//  - pattern null → QK guides tempo by voice (no camera). Used where a phone camera can't measure the
//    movement reliably (rotation, carries, small wrist movements), so we never fake a form score.
// Muscles: first entry is the main target.
import { EXERCISES } from './exercises.js';

export const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core', 'Full body'];

const X = (id, name, muscles, equipment, pattern, extra = {}) => ({ id, name, muscles, equipment, pattern, ...extra });

export const LIBRARY = [
  // Chest
  X('benchPress', 'Barbell Bench Press', ['Chest', 'Triceps', 'Shoulders'], 'Barbell', 'bench'),
  X('dbBench', 'Dumbbell Bench Press', ['Chest', 'Triceps', 'Shoulders'], 'Dumbbells', 'bench'),
  X('inclinePress', 'Incline Dumbbell Press', ['Chest', 'Shoulders', 'Triceps'], 'Dumbbells', 'bench'),
  X('declinePress', 'Decline Bench Press', ['Chest', 'Triceps'], 'Barbell', 'bench'),
  X('machinePress', 'Machine Chest Press', ['Chest', 'Triceps'], 'Machine', 'bench', { setup: 'Side-on, camera at chest height, arms in frame.' }),
  X('pushUp', 'Push-up', ['Chest', 'Triceps', 'Core'], 'Bodyweight', 'pushUp'),
  X('inclinePushUp', 'Incline Push-up', ['Chest', 'Triceps'], 'Bench', 'pushUp'),
  X('chestDip', 'Chest Dip', ['Chest', 'Triceps', 'Shoulders'], 'Dip bars', 'dip'),
  X('cableFly', 'Cable Fly', ['Chest'], 'Cable', 'fly'),
  X('dbFly', 'Dumbbell Fly', ['Chest'], 'Dumbbells', 'fly', { setup: 'Camera above or at the end of the bench, both arms in frame.' }),
  X('pecDeck', 'Pec Deck', ['Chest'], 'Machine', 'fly'),

  // Back
  X('deadlift', 'Deadlift', ['Back', 'Glutes', 'Hamstrings'], 'Barbell', 'rdl', { setup: 'Side-on, camera at hip height, bar and whole body in frame.' }),
  X('bentRow', 'Barbell Bent-over Row', ['Back', 'Biceps'], 'Barbell', 'row'),
  X('dbRow', 'One-arm Dumbbell Row', ['Back', 'Biceps'], 'Dumbbell', 'row'),
  X('cableRow', 'Seated Cable Row', ['Back', 'Biceps'], 'Cable', 'row'),
  X('chestRow', 'Chest-supported Row', ['Back', 'Biceps'], 'Machine', 'row'),
  X('pullUp', 'Pull-up', ['Back', 'Biceps'], 'Pull-up bar', 'vPull'),
  X('chinUp', 'Chin-up', ['Back', 'Biceps'], 'Pull-up bar', 'vPull'),
  X('latPulldown', 'Lat Pulldown', ['Back', 'Biceps'], 'Cable', 'vPull'),
  X('facePull', 'Face Pull', ['Shoulders', 'Back'], 'Cable', 'row'),
  X('backExt', 'Back Extension', ['Back', 'Glutes', 'Hamstrings'], 'Hyperextension bench', 'rdl', { setup: 'Side-on to the camera, whole body in frame.' }),
  X('superman', 'Superman Hold', ['Back', 'Glutes'], 'Bodyweight', null, { hold: 30, guide: 'Lift arms and legs a hand-width off the floor. Squeeze your glutes and keep your neck long.' }),

  // Shoulders
  X('press', 'Overhead Press', ['Shoulders', 'Triceps'], 'Barbell', 'press'),
  X('dbShoulderPress', 'Seated Dumbbell Press', ['Shoulders', 'Triceps'], 'Dumbbells', 'press'),
  X('arnoldPress', 'Arnold Press', ['Shoulders', 'Triceps'], 'Dumbbells', 'press'),
  X('lateralRaise', 'Lateral Raise', ['Shoulders'], 'Dumbbells', 'raise', { setup: 'Facing the camera, arms fully in frame.' }),
  X('cableLateral', 'Cable Lateral Raise', ['Shoulders'], 'Cable', 'raise', { setup: 'Facing the camera, arms fully in frame.' }),
  X('frontRaise', 'Front Raise', ['Shoulders'], 'Dumbbells', 'raise', { setup: 'Side-on to the camera, arm fully in frame.' }),
  X('rearDeltFly', 'Rear Delt Fly', ['Shoulders', 'Back'], 'Dumbbells', 'raise', { setup: 'Facing the camera while bent over, arms in frame.' }),
  X('uprightRow', 'Upright Row', ['Shoulders'], 'Barbell', null, { guide: 'Pull to lower-chest height with elbows leading. Stop if your shoulders pinch.' }),
  X('shrug', 'Shrug', ['Shoulders', 'Back'], 'Dumbbells', null, { guide: 'Lift your shoulders straight up to your ears, pause for one second, lower slowly.' }),

  // Biceps / Triceps / Forearms
  X('curl', 'Dumbbell Curl', ['Biceps', 'Forearms'], 'Dumbbells', 'curl'),
  X('barbellCurl', 'Barbell Curl', ['Biceps', 'Forearms'], 'Barbell', 'curl'),
  X('hammerCurl', 'Hammer Curl', ['Biceps', 'Forearms'], 'Dumbbells', 'curl'),
  X('preacherCurl', 'Preacher Curl', ['Biceps'], 'EZ bar', 'curl'),
  X('cableCurl', 'Cable Curl', ['Biceps'], 'Cable', 'curl'),
  X('pushdown', 'Triceps Pushdown', ['Triceps'], 'Cable', 'triExt'),
  X('ohExtension', 'Overhead Triceps Extension', ['Triceps'], 'Dumbbell', 'triExt'),
  X('skullCrusher', 'Skull Crusher', ['Triceps'], 'EZ bar', 'triExt', { setup: 'Side-on, camera at bench height.' }),
  X('benchDip', 'Bench Dip', ['Triceps', 'Chest'], 'Bench', 'dip'),
  X('closeGrip', 'Close-grip Bench Press', ['Triceps', 'Chest'], 'Barbell', 'bench'),
  X('wristCurl', 'Wrist Curl', ['Forearms'], 'Dumbbells', null, { guide: 'Forearms on your thighs. Curl the weight with your wrists only, full range, slow on the way down.' }),
  X('farmerCarry', 'Farmer\'s Carry', ['Forearms', 'Core', 'Full body'], 'Dumbbells', null, { hold: 40, guide: 'Heavy weights, stand tall, short quick steps, shoulders down and back.' }),

  // Quads
  X('squat', 'Back Squat', ['Quads', 'Glutes', 'Core'], 'Barbell', 'squat'),
  X('frontSquat', 'Front Squat', ['Quads', 'Glutes', 'Core'], 'Barbell', 'squat'),
  X('gobletSquat', 'Goblet Squat', ['Quads', 'Glutes'], 'Dumbbell', 'squat'),
  X('legPress', 'Leg Press', ['Quads', 'Glutes'], 'Machine', 'squat', { setup: 'Side-on to the machine, hips, knees and ankles in frame.' }),
  X('hackSquat', 'Hack Squat', ['Quads', 'Glutes'], 'Machine', 'squat'),
  X('lunge', 'Walking Lunge', ['Quads', 'Glutes'], 'Dumbbells', 'lunge'),
  X('reverseLunge', 'Reverse Lunge', ['Quads', 'Glutes'], 'Dumbbells', 'lunge'),
  X('bulgarian', 'Bulgarian Split Squat', ['Quads', 'Glutes'], 'Bench', 'lunge'),
  X('stepUp', 'Step-up', ['Quads', 'Glutes'], 'Box', 'lunge'),
  X('legExtension', 'Leg Extension', ['Quads'], 'Machine', 'kneeExt'),
  X('wallSit', 'Wall Sit', ['Quads'], 'Wall', null, { hold: 45, guide: 'Back flat on the wall, thighs parallel to the floor, knees over ankles.' }),

  // Hamstrings
  X('rdl', 'Romanian Deadlift', ['Hamstrings', 'Glutes', 'Back'], 'Barbell', 'rdl'),
  X('singleLegRdl', 'Single-leg RDL', ['Hamstrings', 'Glutes'], 'Dumbbell', 'rdl'),
  X('goodMorning', 'Good Morning', ['Hamstrings', 'Back'], 'Barbell', 'rdl'),
  X('lyingLegCurl', 'Lying Leg Curl', ['Hamstrings'], 'Machine', 'kneeFlex'),
  X('seatedLegCurl', 'Seated Leg Curl', ['Hamstrings'], 'Machine', 'kneeFlex'),
  X('nordic', 'Nordic Curl', ['Hamstrings'], 'Bodyweight', null, { guide: 'Lower yourself as slowly as you can, about five seconds. Catch yourself with your hands, then push back up.' }),

  // Glutes
  X('hipThrust', 'Hip Thrust', ['Glutes', 'Hamstrings'], 'Barbell', 'hipThrust'),
  X('gluteBridge', 'Glute Bridge', ['Glutes', 'Hamstrings'], 'Bodyweight', 'hipThrust', { setup: 'Lying side-on to the camera, camera on the floor about two metres away.' }),
  X('singleLegBridge', 'Single-leg Glute Bridge', ['Glutes'], 'Bodyweight', 'hipThrust', { setup: 'Lying side-on to the camera, working leg nearest the camera.' }),
  X('kbSwing', 'Kettlebell Swing', ['Glutes', 'Hamstrings', 'Full body'], 'Kettlebell', 'rdl', { setup: 'Side-on, camera at hip height, whole body in frame.' }),
  X('cableKickback', 'Cable Kickback', ['Glutes'], 'Cable', null, { guide: 'Brace your core and drive your heel back without arching your lower back. Squeeze for a second.' }),
  X('hipAbduction', 'Hip Abduction', ['Glutes'], 'Machine', null, { guide: 'Push your knees out, pause for a second, and control the way back in.' }),
  X('bandedWalk', 'Banded Lateral Walk', ['Glutes'], 'Band', null, { guide: 'Stay in a half squat. Step wide, keep tension on the band, toes forward.' }),

  // Calves
  X('calfRaise', 'Standing Calf Raise', ['Calves'], 'Machine', 'calf'),
  X('singleCalf', 'Single-leg Calf Raise', ['Calves'], 'Step', 'calf'),
  X('seatedCalf', 'Seated Calf Raise', ['Calves'], 'Machine', null, { guide: 'Full stretch at the bottom, pause at the top. Slow and controlled, no bouncing.' }),

  // Core
  X('plank', 'Plank', ['Core'], 'Bodyweight', 'plank'),
  X('sidePlank', 'Side Plank', ['Core'], 'Bodyweight', null, { hold: 30, guide: 'Stack your feet, lift your hips into a straight line from head to heels. Switch sides halfway.' }),
  X('crunch', 'Crunch', ['Core'], 'Bodyweight', 'torsoCurl'),
  X('situp', 'Sit-up', ['Core'], 'Bodyweight', 'torsoCurl'),
  X('legRaise', 'Lying Leg Raise', ['Core'], 'Bodyweight', 'legRaise'),
  X('hangingRaise', 'Hanging Leg Raise', ['Core'], 'Pull-up bar', 'legRaise'),
  X('deadBug', 'Dead Bug', ['Core'], 'Bodyweight', null, { guide: 'Lower back pressed into the floor. Reach opposite arm and leg away slowly, then switch.' }),
  X('russianTwist', 'Russian Twist', ['Core'], 'Plate', null, { guide: 'Lean back slightly with a tall chest. Rotate from your ribs, not just your arms.' }),
  X('abWheel', 'Ab Wheel Rollout', ['Core', 'Shoulders'], 'Ab wheel', null, { guide: 'Roll out only as far as you can keep your lower back flat. Pull back with your abs.' }),
  X('pallof', 'Pallof Press', ['Core'], 'Cable', null, { guide: 'Press straight out and hold for two seconds. Don\'t let the cable turn you.' }),
  X('mountainClimber', 'Mountain Climbers', ['Core', 'Full body'], 'Bodyweight', null, { hold: 30, guide: 'Hands under shoulders, hips level, drive your knees to your chest quickly.' }),

  // Full body
  X('thruster', 'Thruster', ['Full body', 'Quads', 'Shoulders'], 'Dumbbells', 'squat'),
  X('burpee', 'Burpee', ['Full body'], 'Bodyweight', null, { guide: 'Chest to the floor, jump your feet in, explode up. Land softly.' }),
  X('jumpSquat', 'Jump Squat', ['Full body', 'Quads', 'Glutes'], 'Bodyweight', 'squat'),
];

export const LIB = Object.fromEntries(LIBRARY.map(x => [x.id, x]));

// Engine definition for a library exercise: the movement pattern with this exercise's name and setup.
export function exFor(id) {
  const item = LIB[id]; if (!item?.pattern) return null;
  const base = EXERCISES[item.pattern];
  return { ...base, name: item.name, setup: item.setup || base.setup, patternKey: item.pattern, libId: id };
}

export const tracked = id => !!LIB[id]?.pattern;
