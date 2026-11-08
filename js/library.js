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
  // ---- Rehab & prehab exercises (used by the Rehab clinic programmes; rehab: true keeps them grouped) ----
  // Spine & neck
  X('catCamel', 'Cat-Camel', ['Core', 'Back'], 'Bodyweight', null, { rehab: true, guide: 'On hands and knees, slowly round your back up, then let it dip. Move gently, only as far as is comfortable.' }),
  X('birdDog', 'Bird Dog', ['Core', 'Glutes'], 'Bodyweight', null, { rehab: true, guide: 'On hands and knees, reach one arm and the opposite leg out long. Keep your back still, like balancing a cup on it. Hold for 5 seconds.' }),
  X('mcgillCurlUp', 'McGill Curl-up', ['Core'], 'Bodyweight', null, { rehab: true, guide: 'Lie down, one knee bent, hands under your lower back. Lift your head and shoulders a few centimetres, keeping your neck still. Hold 8–10 seconds.' }),
  X('hipHingeDowel', 'Hip Hinge with Dowel', ['Hamstrings', 'Glutes', 'Back'], 'Dowel', 'rdl', { rehab: true, setup: 'Side-on, a broomstick held along your back touching head, upper back and tailbone.' }),
  X('walk', 'Brisk Walk', ['Full body'], 'None', null, { rehab: true, hold: 600, guide: 'Walk at a pace where you can talk but not sing. Walking is one of the best treatments for back pain.' }),
  X('chinTuck', 'Chin Tuck', ['Back'], 'Bodyweight', null, { rehab: true, guide: 'Sit tall. Glide your chin straight back, making a double chin, without tipping your head. Hold 5 seconds.' }),
  X('neckIso', 'Neck Isometrics', ['Back'], 'Bodyweight', null, { rehab: true, guide: 'Press your hand gently against your forehead, then the side and back of your head, without letting your head move. Hold each for 10 seconds at about 30% effort.' }),
  X('thoracicExt', 'Thoracic Extension on Roller', ['Back'], 'Foam roller', null, { rehab: true, guide: 'Lie with the roller across your upper back, hands supporting your head. Gently extend over it, then move it up a few centimetres.' }),
  X('bandPullApart', 'Band Pull-apart', ['Shoulders', 'Back'], 'Band', 'raise', { rehab: true, setup: 'Facing the camera, arms straight out in front holding the band.' }),
  // Shoulder
  X('pendulum', 'Pendulum Swings', ['Shoulders'], 'Bodyweight', null, { rehab: true, guide: 'Lean on a table with your good arm. Let the painful arm hang loose and swing it in small circles. Relax your shoulder completely.' }),
  X('tableSlide', 'Table Slide', ['Shoulders'], 'Table', null, { rehab: true, guide: 'Sit by a table, hand on a towel. Slide your hand forward as you lean your body forward, then back. Stay within mild discomfort.' }),
  X('wallSlide', 'Wall Slide', ['Shoulders'], 'Wall', 'raise', { rehab: true, setup: 'Side-on to the camera, facing a wall, forearms on the wall.' }),
  X('crossBody', 'Cross-body Stretch', ['Shoulders'], 'Bodyweight', null, { rehab: true, hold: 30, guide: 'Bring your arm across your chest and gently hold it with the other hand. Mild stretch only, never sharp pain.' }),
  X('towelBehindBack', 'Towel Stretch Behind Back', ['Shoulders'], 'Towel', null, { rehab: true, hold: 30, guide: 'Hold a towel behind your back, top hand over the shoulder. Gently pull the lower hand up with the top hand.' }),
  X('isoER', 'External Rotation Isometric', ['Shoulders'], 'Wall', null, { rehab: true, hold: 30, guide: 'Elbow bent to 90° at your side, back of the hand against a door frame. Push outward at about 30–50% effort without moving. 5 holds.' }),
  X('isoAbd', 'Abduction Isometric', ['Shoulders'], 'Wall', null, { rehab: true, hold: 30, guide: 'Stand side-on to a wall, elbow bent, press the outside of your elbow into the wall at 30–50% effort. 5 holds.' }),
  X('bandER', 'Band External Rotation', ['Shoulders'], 'Band', null, { rehab: true, guide: 'Elbow at your side bent to 90°, a towel under the elbow. Rotate your forearm outward against the band, slowly back. 3 seconds each way.' }),
  // Elbow & wrist
  X('isoWristExt', 'Wrist Extension Isometric', ['Forearms'], 'Dumbbell', null, { rehab: true, hold: 45, guide: 'Forearm on a table, palm down. Hold a light weight with the wrist level, or push up into your other hand. 5 holds; mild pain up to 5/10 is OK.' }),
  X('eccWristExt', 'Eccentric Wrist Extension', ['Forearms'], 'Dumbbell', null, { rehab: true, guide: 'Palm down, use your other hand to lift the weight up, then lower it with the sore wrist over 4 seconds. 3×15.' }),
  X('isoWristFlex', 'Wrist Flexion Isometric', ['Forearms'], 'Dumbbell', null, { rehab: true, hold: 45, guide: 'Forearm on a table, palm up. Hold a light weight with the wrist level. 5 holds.' }),
  X('eccWristFlex', 'Eccentric Wrist Flexion', ['Forearms'], 'Dumbbell', null, { rehab: true, guide: 'Palm up, lift with the other hand, lower slowly over 4 seconds with the sore wrist. 3×15.' }),
  X('gripSqueeze', 'Grip Squeeze', ['Forearms'], 'Ball', null, { rehab: true, guide: 'Squeeze a soft ball or rolled towel for 5 seconds, relax. Stay at a comfortable effort.' }),
  // Hip
  X('clamshell', 'Clamshell', ['Glutes'], 'Band', null, { rehab: true, guide: 'Lie on your side, knees bent, feet together. Lift the top knee without rolling your hips back. Slow, 3 seconds up and down.' }),
  X('sideLyingAbd', 'Side-lying Hip Abduction', ['Glutes'], 'Bodyweight', null, { rehab: true, guide: 'Lie on your side, bottom knee bent. Lift the straight top leg slightly behind you, toes forward. Lower over 3 seconds.' }),
  X('isoHipAbd', 'Standing Hip Abduction Isometric', ['Glutes'], 'Wall', null, { rehab: true, hold: 45, guide: 'Stand side-on to a wall, press the outside of your knee into a folded towel against the wall. Keep hips level. 5 holds.' }),
  X('sitToStand', 'Sit to Stand', ['Quads', 'Glutes'], 'Chair', 'squat', { rehab: true, setup: 'Side-on to the camera, sitting on a firm chair.' }),
  // Knee
  X('quadSet', 'Quad Set', ['Quads'], 'Towel', null, { rehab: true, guide: 'Sit with your leg straight, a rolled towel under the knee. Tighten your thigh to push the knee down. Hold 5 seconds. Aim for full straightening.' }),
  X('straightLegRaise', 'Straight Leg Raise', ['Quads'], 'Bodyweight', 'legRaise', { rehab: true, setup: 'Lying side-on to the camera, the working leg nearest the camera.' }),
  X('heelSlide', 'Heel Slide', ['Quads', 'Hamstrings'], 'Bodyweight', 'kneeFlex', { rehab: true, setup: 'Lying or sitting side-on to the camera, the working leg nearest the camera.' }),
  X('terminalKneeExt', 'Terminal Knee Extension', ['Quads'], 'Band', null, { rehab: true, guide: 'Band behind your knee anchored in front. Bend the knee slightly, then straighten it fully against the band and squeeze 2 seconds.' }),
  X('spanishSquat', 'Spanish Squat Hold', ['Quads'], 'Band', null, { rehab: true, hold: 45, guide: 'Strong band behind both knees anchored in front. Sit back, shins vertical, to a pain-free depth and hold. Mild pain up to 5/10 is OK for tendon pain.' }),
  X('stepDown', 'Step-down', ['Quads', 'Glutes'], 'Step', 'lunge', { rehab: true, setup: 'Facing the camera on a low step. Lower one heel to the floor slowly, knee over the middle toes.' }),
  X('declineSquat', 'Single-leg Decline Squat', ['Quads'], 'Slant board', 'squat', { rehab: true, setup: 'Side-on to the camera, standing on a 25° slant board or a plate under your heel.' }),
  X('singleLegBalance', 'Single-leg Balance', ['Calves', 'Core'], 'Bodyweight', null, { rehab: true, hold: 30, guide: 'Stand on one leg, knee soft. When easy, close your eyes or stand on a cushion. Switch legs.' }),
  X('hopDrill', 'Hop Drill (low level)', ['Quads', 'Calves', 'Full body'], 'Bodyweight', null, { rehab: true, guide: 'Small hops on the spot on two legs, then one leg, landing softly with the knee over the toes. Stop if pain rises above 3/10.' }),
  // Hamstring
  X('hamIso', 'Hamstring Bridge Isometric', ['Hamstrings', 'Glutes'], 'Bodyweight', null, { rehab: true, hold: 30, guide: 'Lie on your back, heel on a bench, knee slightly bent. Lift your hips and hold. Pain-free effort only in the early phase.' }),
  X('extender', 'Askling Extender', ['Hamstrings'], 'Bodyweight', null, { rehab: true, guide: 'Lie on your back holding your thigh at 90°. Slowly straighten the knee as far as comfortable, then lower. No pain allowed.' }),
  X('diver', 'Askling Diver', ['Hamstrings', 'Glutes'], 'Bodyweight', null, { rehab: true, guide: 'Stand on one leg and tip forward like a dive, arms reaching ahead, the back leg lifting, standing knee slightly bent.' }),
  X('glider', 'Askling Glider', ['Hamstrings'], 'Bodyweight', null, { rehab: true, guide: 'Feet hip-width, one foot on a towel. Slide it back slowly into a long stride, then pull back with your arms helping on a rail.' }),
  // Ankle & foot
  X('ankleAlphabet', 'Ankle Alphabet', ['Calves'], 'Bodyweight', null, { rehab: true, guide: 'Sit with your foot off the floor and trace the letters A to Z with your big toe. Gentle, pain-free movement.' }),
  X('isoCalf', 'Calf Isometric', ['Calves'], 'Bodyweight', null, { rehab: true, hold: 45, guide: 'Rise halfway onto your toes (or push against a wall) and hold. 5 holds; mild tendon pain up to 5/10 is OK if it settles by the next morning.' }),
  X('heelDrop', 'Eccentric Heel Drop', ['Calves'], 'Step', 'calf', { rehab: true, setup: 'Side-on to the camera on a step edge. Rise on both feet, lower slowly on one.' }),
  X('calfStretch', 'Calf Stretch', ['Calves'], 'Wall', null, { rehab: true, hold: 30, guide: 'Hands on a wall, the back leg straight with the heel down. Lean in until you feel a stretch. Then repeat with the back knee bent.' }),
  X('plantarStretch', 'Plantar Fascia Stretch', ['Calves'], 'Bodyweight', null, { rehab: true, hold: 30, guide: 'Sit, cross the foot over your knee, pull your toes back towards you until you feel a stretch under the arch. First thing in the morning helps most.' }),
  X('towelHeelRaise', 'High-load Heel Raise (towel under toes)', ['Calves'], 'Step', 'calf', { rehab: true, setup: 'Side-on to the camera, toes on a rolled towel on a step. 3 seconds up, 2 at the top, 3 down.' }),
];

export const LIB = Object.fromEntries(LIBRARY.map(x => [x.id, x]));

// Engine definition for a library exercise: the movement pattern with this exercise's name and setup.
export function exFor(id) {
  const item = LIB[id]; if (!item?.pattern) return null;
  const base = EXERCISES[item.pattern];
  return { ...base, name: item.name, setup: item.setup || base.setup, patternKey: item.pattern, libId: id };
}

export const tracked = id => !!LIB[id]?.pattern;
