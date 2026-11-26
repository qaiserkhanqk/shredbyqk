// Exercise library: every exercise maps to a movement pattern in exercises.js.
//  - pattern set  → QK checks form with the camera (rep counting, joint angles, cues, tempo, fatigue).
//  - pattern null → QK guides tempo by voice (no camera). Used where a phone camera can't measure the
//    movement reliably (rotation, carries, small wrist movements), so we never fake a form score.
// Muscles: first entry is the main target.
import { EXERCISES } from './exercises.js';
import { EXTRA } from './library-extra.js';
import { MORE } from './library-more.js';

// Training types shown as extra filters next to the muscle groups.
export const KINDS = { Plyometrics: 'plyo', Olympic: 'olympic', Stretching: 'stretch', Cardio: 'cardio', Running: 'run', HYROX: 'hyrox', Pilates: 'pilates' };

export const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core', 'Full body'];

const X = (id, name, muscles, equipment, pattern, extra = {}) => ({ id, name, muscles, equipment, pattern, ...extra });

export const LIBRARY = [
  // Chest
  X('benchPress', 'Barbell Bench Press', ['Chest', 'Triceps', 'Shoulders'], 'Barbell', 'bench', { bench: 'feet' }),
  X('dbBench', 'Dumbbell Bench Press', ['Chest', 'Triceps', 'Shoulders'], 'Dumbbells', 'bench', { bench: 'feet' }),
  X('inclinePress', 'Incline Dumbbell Press', ['Chest', 'Shoulders', 'Triceps'], 'Dumbbells', 'bench', { bench: 'feet' }),
  X('declinePress', 'Decline Bench Press', ['Chest', 'Triceps'], 'Barbell', 'bench', { bench: 'scap' }),
  X('machinePress', 'Machine Chest Press', ['Chest', 'Triceps'], 'Machine', 'bench', { setup: 'Side-on, camera at chest height, arms in frame.' }),
  X('pushUp', 'Push-up', ['Chest', 'Triceps', 'Core'], 'Bodyweight', 'pushUp'),
  X('inclinePushUp', 'Incline Push-up', ['Chest', 'Triceps'], 'Bench', 'pushUp'),
  X('chestDip', 'Chest Dip', ['Chest', 'Triceps', 'Shoulders'], 'Dip bars', 'dip'),
  X('cableFly', 'Cable Fly', ['Chest'], 'Cable', 'fly'),
  X('dbFly', 'Dumbbell Fly', ['Chest'], 'Dumbbells', 'fly', { setup: 'Camera above or at the end of the bench, both arms in frame.' }),
  X('pecDeck', 'Pec Deck', ['Chest'], 'Machine', 'fly'),

  // Back
  X('deadlift', 'Deadlift', ['Back', 'Glutes', 'Hamstrings'], 'Barbell', 'rdl', { skipRules: ['rdl_squat'], setup: 'Side-on, camera at hip height, bar and whole body in frame.' }),
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
  X('preacherCurl', 'Preacher Curl', ['Biceps'], 'EZ bar', 'curl', { skipRules: ['cu_swing'] }), // arm rests on the pad at an angle
  X('cableCurl', 'Cable Curl', ['Biceps'], 'Cable', 'curl'),
  X('pushdown', 'Triceps Pushdown', ['Triceps'], 'Cable', 'triExt'),
  X('ohExtension', 'Overhead Triceps Extension', ['Triceps'], 'Dumbbell', 'triExt'),
  X('skullCrusher', 'Skull Crusher', ['Triceps'], 'EZ bar', 'triExt', { setup: 'Side-on, camera at bench height.' }),
  X('benchDip', 'Bench Dip', ['Triceps', 'Chest'], 'Bench', 'dip'),
  X('closeGrip', 'Close-grip Bench Press', ['Triceps', 'Chest'], 'Barbell', 'bench', { bench: 'feet' }),
  X('wristCurl', 'Wrist Curl', ['Forearms'], 'Dumbbells', null, { guide: 'Forearms on your thighs. Curl the weight with your wrists only, full range, slow on the way down.' }),
  X('farmerCarry', 'Farmer\'s Carry', ['Forearms', 'Core', 'Full body'], 'Dumbbells', null, { hold: 40, guide: 'Heavy weights, stand tall, short quick steps, shoulders down and back.' }),

  // Quads
  X('squat', 'Back Squat', ['Quads', 'Glutes', 'Core'], 'Barbell', 'squat', { free: true }),
  X('frontSquat', 'Front Squat', ['Quads', 'Glutes', 'Core'], 'Barbell', 'squat', { free: true }),
  X('gobletSquat', 'Goblet Squat', ['Quads', 'Glutes'], 'Dumbbell', 'squat', { free: true }),
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
  X('kbSwing', 'Kettlebell Swing', ['Glutes', 'Hamstrings', 'Full body'], 'Kettlebell', 'rdl', { skipRules: ['rdl_squat'], setup: 'Side-on, camera at hip height, whole body in frame.' }),
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
  X('thruster', 'Thruster', ['Full body', 'Quads', 'Shoulders'], 'Dumbbells', 'squat', { free: true }),
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
  // ---- Running (hand-written). Timers and intervals; treadmill runs link to the running-form check. ----
  X('runEasy', 'Easy Run', ['Full body', 'Quads', 'Calves'], 'No equipment', null, { kind: 'run', coach: 'timer', mins: 30, guide: 'Conversational pace: you can talk in full sentences (zone 2). Relaxed shoulders, quick light steps.' }),
  X('runTempo', 'Tempo Run', ['Full body', 'Quads', 'Calves'], 'No equipment', null, { kind: 'run', coach: 'timer', mins: 20, guide: 'Comfortably hard: you can say a few words, not full sentences. Warm up with 10 minutes of easy running first.' }),
  X('runIntervals', 'Interval Run (6 × 2 min)', ['Full body', 'Quads', 'Calves'], 'No equipment', null, { kind: 'run', coach: 'intervals', work: 120, rest: 90, rounds: 6, guide: 'Hard but even: run every rep at the same pace. Walk or jog slowly during the rest.' }),
  X('runSprints', 'Sprints (8 × 20 s)', ['Full body', 'Quads', 'Hamstrings'], 'No equipment', null, { kind: 'run', coach: 'intervals', work: 20, rest: 100, rounds: 8, guide: 'Close to full speed with a relaxed face and hands. Rest fully so every sprint stays fast. Warm up well first.' }),
  X('runLong', 'Long Run', ['Full body', 'Quads', 'Calves'], 'No equipment', null, { kind: 'run', coach: 'timer', mins: 60, guide: 'Easy, steady pace the whole way. Sip water every 15 to 20 minutes on warm days.' }),
  X('runTreadmill', 'Treadmill Run', ['Full body', 'Quads', 'Calves'], 'Treadmill', null, { kind: 'run', coach: 'timer', mins: 20, formTest: 'run', guide: 'Steady pace. Use "Check my running form" first to see your cadence, stride and knee angle on camera.' }),
  // ---- HYROX (hand-written). Race order: 8 × (1 km run + station). Distances from the race format;
  // weights depend on division, so the guides point to hyrox.com rather than quoting them. ----
  X('hyroxRun', 'HYROX Run (1 km)', ['Full body', 'Quads', 'Calves'], 'No equipment', null, { kind: 'hyrox', coach: 'stopwatch', guide: 'Run 1 km at race pace. Settle your breathing in the first 200 metres; races are won on the runs between stations.' }),
  X('hyroxSki', 'SkiErg (1000 m)', ['Back', 'Shoulders', 'Core'], 'SkiErg', null, { kind: 'hyrox', coach: 'stopwatch', guide: 'Station 1. Hinge at the hips and drive the handles down with your lats and core, not just your arms. Long, powerful pulls.' }),
  X('hyroxSledPush', 'Sled Push (4 × 12.5 m)', ['Quads', 'Glutes', 'Calves'], 'Sled', null, { kind: 'hyrox', coach: 'stopwatch', guide: 'Station 2. Low body angle, arms locked, short powerful steps through the balls of your feet. Weight depends on your division: check hyrox.com.' }),
  X('hyroxSledPull', 'Sled Pull (4 × 12.5 m)', ['Back', 'Biceps', 'Hamstrings'], 'Sled', null, { kind: 'hyrox', coach: 'stopwatch', guide: 'Station 3. Sit back into a low stance and pull hand over hand, using your legs as well as your arms. Weight depends on your division: check hyrox.com.' }),
  X('hyroxBurpeeBJ', 'Burpee Broad Jump (80 m)', ['Full body', 'Quads', 'Chest'], 'Bodyweight', null, { kind: 'hyrox', coach: 'stopwatch', guide: 'Station 4. Chest to the floor, then jump forward with both feet. Find a steady rhythm you can hold for the whole 80 metres.' }),
  X('hyroxRow', 'Rowing (1000 m)', ['Back', 'Quads', 'Full body'], 'Rower', null, { kind: 'hyrox', coach: 'stopwatch', guide: 'Station 5. Legs, then body, then arms; reverse on the way back. Strong, steady strokes rather than fast, short ones.' }),
  X('hyroxFarmers', 'HYROX Farmer\'s Carry (200 m)', ['Forearms', 'Core', 'Full body'], 'Kettlebells', null, { kind: 'hyrox', coach: 'stopwatch', guide: 'Station 6. Tall posture, shoulders down, quick steps. Grip hard and try not to put the kettlebells down. Weight depends on your division: check hyrox.com.' }),
  X('hyroxLunges', 'Sandbag Lunges (100 m)', ['Quads', 'Glutes', 'Core'], 'Sandbag', 'lunge', { kind: 'hyrox', setup: 'Side-on to the camera. QK checks your lunge depth and torso while you lunge on the spot; the race version travels 100 m.', guide: 'Station 7. Back knee touches the floor each step, torso tall. Weight depends on your division: check hyrox.com.' }),
  X('hyroxWallBalls', 'Wall Balls (100 reps)', ['Quads', 'Glutes', 'Shoulders'], 'Medicine ball', 'squat', { kind: 'hyrox', free: true, setup: 'Side-on to the camera, a step back from the wall, whole body in frame. QK counts your reps and checks your squat depth.', guide: 'Station 8. Full squat to below parallel, then drive up and throw in one smooth movement. Break the 100 reps into sets you can hold. Ball weight and target height depend on your division: check hyrox.com.' }),
  // ---- Pilates (hand-written). The classical mat sequence from Joseph Pilates' Return to Life Through
  // Contrology (1945), plus two modern staples. Guides are the app's own; three use the camera checks. ----
  X('pilHundred', 'The Hundred', ['Core'], 'Mat', null, { kind: 'pilates', coach: 'hold', hold: 100, level: 'beginner', guide: 'Head and shoulders lifted, legs in tabletop or extended. Pump your straight arms by your sides: breathe in for five pumps, out for five. Ten breaths make a hundred.' }),
  X('pilRollUp', 'Roll Up', ['Core', 'Hamstrings'], 'Mat', null, { kind: 'pilates', coach: 'mobility', reps: 6, gap: 6, level: 'beginner', guide: 'Peel up off the mat one vertebra at a time, reach for your toes, then roll back down just as slowly. Bend your knees if you need to.' }),
  X('pilRollOver', 'Roll Over', ['Core', 'Back'], 'Mat', null, { kind: 'pilates', coach: 'mobility', reps: 5, gap: 7, level: 'advanced', guide: 'Advanced: it loads the neck. Lift your legs over your head with control, then roll down one vertebra at a time. Skip it if you have neck or back problems.' }),
  X('pilLegCircle', 'One Leg Circle', ['Core', 'Glutes'], 'Mat', null, { kind: 'pilates', coach: 'mobility', reps: 10, gap: 3, level: 'beginner', guide: 'One leg to the ceiling, the other long on the mat. Draw small circles with the raised leg while your pelvis stays completely still. Five each way, then switch legs.' }),
  X('pilRolling', 'Rolling Like a Ball', ['Core', 'Back'], 'Mat', null, { kind: 'pilates', coach: 'mobility', reps: 8, gap: 3, level: 'beginner', guide: 'Sit in a tight ball, balance just behind your sit bones, roll back to your shoulder blades (not your neck) and roll up to balance again.' }),
  X('pilOneLegStretch', 'One Leg Stretch', ['Core'], 'Mat', null, { kind: 'pilates', coach: 'mobility', reps: 10, gap: 2, level: 'beginner', guide: 'Head and shoulders lifted, hug one knee in while the other leg reaches long. Switch with control, keeping your lower back on the mat.' }),
  X('pilDoubleLegStretch', 'Double Leg Stretch', ['Core'], 'Mat', null, { kind: 'pilates', coach: 'mobility', reps: 8, gap: 4, level: 'beginner', guide: 'From a tight curl, reach your arms and legs away at the same time, circle your arms round and hug back in. Keep your lower back down.' }),
  X('pilSpineStretch', 'Spine Stretch Forward', ['Back', 'Hamstrings'], 'Mat', null, { kind: 'pilates', coach: 'mobility', reps: 5, gap: 6, level: 'beginner', guide: 'Sit tall, legs a little wider than your hips. Breathe out and round forward as if over a beach ball, then stack back up to sitting tall.' }),
  X('pilOpenRocker', 'Rocker with Open Legs', ['Core', 'Hamstrings'], 'Mat', null, { kind: 'pilates', coach: 'mobility', reps: 6, gap: 4, level: 'intermediate', guide: 'Balance holding your ankles with your legs in a V. Roll back to your shoulder blades and back up to balance without dropping your legs.' }),
  X('pilCorkscrew', 'Corkscrew', ['Core'], 'Mat', null, { kind: 'pilates', coach: 'mobility', reps: 6, gap: 5, level: 'advanced', guide: 'Legs together to the ceiling, circle them to one side, down and round, keeping your shoulders heavy on the mat. Make the circle only as big as you can control.' }),
  X('pilSaw', 'The Saw', ['Back', 'Hamstrings'], 'Mat', null, { kind: 'pilates', coach: 'mobility', reps: 6, gap: 5, level: 'beginner', guide: 'Sit tall with legs wide and arms out. Twist, then reach your hand past the opposite little toe as if sawing it off. Stack back up and twist the other way.' }),
  X('pilSwan', 'Swan Dive', ['Back', 'Glutes'], 'Mat', null, { kind: 'pilates', coach: 'mobility', reps: 5, gap: 5, level: 'intermediate', guide: 'Lying face down, press up through your hands into a long arch, lengthening rather than crunching your lower back. Beginners stop at the press-up.' }),
  X('pilOneLegKick', 'One Leg Kick', ['Hamstrings', 'Glutes'], 'Mat', null, { kind: 'pilates', coach: 'mobility', reps: 10, gap: 2, level: 'beginner', guide: 'Prop on your forearms, belly lifted. Kick one heel towards your seat twice, then switch, keeping your hips pressed into the mat.' }),
  X('pilDoubleKick', 'Double Kick', ['Hamstrings', 'Back'], 'Mat', null, { kind: 'pilates', coach: 'mobility', reps: 6, gap: 5, level: 'intermediate', guide: 'Face down, hands clasped on your back. Kick both heels in three times, then stretch the legs long and lift your chest as your arms reach back.' }),
  X('pilNeckPull', 'Neck Pull', ['Core', 'Back'], 'Mat', null, { kind: 'pilates', coach: 'mobility', reps: 5, gap: 7, level: 'intermediate', guide: 'Hands lightly behind your head, never pulling. Roll up with your abs, hinge back with a flat back, then roll down slowly.' }),
  X('pilScissors', 'Scissors', ['Core', 'Hamstrings'], 'Mat', null, { kind: 'pilates', coach: 'mobility', reps: 10, gap: 2, level: 'advanced', guide: 'Hips supported, legs to the ceiling. Split the legs like scissors, one towards you and one away, switching smoothly. Keep your neck free.' }),
  X('pilBicycle', 'Bicycle', ['Core', 'Glutes'], 'Mat', null, { kind: 'pilates', coach: 'mobility', reps: 10, gap: 3, level: 'advanced', guide: 'From the scissors position, pedal your legs in long, slow bicycle strides. Keep the weight on your shoulders, not your neck.' }),
  X('pilShoulderBridge', 'Shoulder Bridge', ['Glutes', 'Hamstrings', 'Core'], 'Mat', 'hipThrust', { kind: 'pilates', level: 'beginner', setup: 'Lying side-on to the camera, camera on the floor about two metres away.', guide: 'Feet hip-width, peel your spine up into a bridge and lower it one vertebra at a time. QK checks your hip lift on camera.' }),
  X('pilSpineTwist', 'Spine Twist', ['Core', 'Back'], 'Mat', null, { kind: 'pilates', coach: 'mobility', reps: 6, gap: 4, level: 'beginner', guide: 'Sit tall, legs together, arms out. Breathe out to twist from your waist, keeping your hips still, then return to centre growing taller.' }),
  X('pilJackKnife', 'Jack Knife', ['Core', 'Back'], 'Mat', null, { kind: 'pilates', coach: 'mobility', reps: 4, gap: 8, level: 'advanced', guide: 'Advanced: it loads the neck. Roll your legs over, then shoot them up to the ceiling and roll down slowly. Skip it if you have neck problems.' }),
  X('pilSideKick', 'Side Kick', ['Glutes', 'Core'], 'Mat', null, { kind: 'pilates', coach: 'mobility', reps: 10, gap: 2, level: 'beginner', guide: 'Lying on your side in a straight line, swing the top leg forward twice and back once, keeping your torso completely still. Switch sides.' }),
  X('pilTeaser', 'Teaser', ['Core'], 'Mat', null, { kind: 'pilates', coach: 'mobility', reps: 5, gap: 6, level: 'intermediate', guide: 'Roll up into a V, balancing on your sit bones with arms reaching parallel to your legs. Roll down with control. Bend your knees to make it easier.' }),
  X('pilHipTwist', 'Hip Twist', ['Core'], 'Mat', null, { kind: 'pilates', coach: 'mobility', reps: 6, gap: 5, level: 'advanced', guide: 'Sit leaning back on your hands, legs lifted together. Circle the legs to one side and round, keeping your chest open and steady.' }),
  X('pilSwimming', 'Swimming', ['Back', 'Glutes'], 'Mat', null, { kind: 'pilates', coach: 'hold', hold: 30, level: 'beginner', guide: 'Face down, lift your arms, chest and legs. Flutter opposite arm and leg quickly and lightly, breathing in for five and out for five.' }),
  X('pilLegPullFront', 'Leg Pull Front', ['Core', 'Shoulders', 'Glutes'], 'Mat', 'plank', { kind: 'pilates', level: 'intermediate', guide: 'Hold a straight plank on your hands, then lift one leg at a time without letting your hips sag or rock. QK checks your body line on camera.' }),
  X('pilLegPullBack', 'Leg Pull Back', ['Glutes', 'Hamstrings', 'Shoulders'], 'Mat', null, { kind: 'pilates', coach: 'mobility', reps: 6, gap: 4, level: 'intermediate', guide: 'Reverse plank on your hands, body in one straight line. Kick one leg up and lower it without dropping your hips.' }),
  X('pilKneelingSideKick', 'Kneeling Side Kick', ['Glutes', 'Core'], 'Mat', null, { kind: 'pilates', coach: 'mobility', reps: 8, gap: 3, level: 'intermediate', guide: 'Kneel and place one hand on the mat. Lift the top leg to hip height and swing it forward and back, keeping your body in one plane.' }),
  X('pilSideBend', 'Side Bend', ['Core', 'Shoulders'], 'Mat', null, { kind: 'pilates', coach: 'mobility', reps: 5, gap: 5, level: 'intermediate', guide: 'From a side sit, press up into a side plank and arc your top arm over your head, then lower with control. Switch sides.' }),
  X('pilBoomerang', 'Boomerang', ['Core', 'Hamstrings'], 'Mat', null, { kind: 'pilates', coach: 'mobility', reps: 4, gap: 9, level: 'advanced', guide: 'Advanced: it loads the neck. Roll over with crossed legs, switch the cross, roll up into a teaser, then lower with your arms reaching back.' }),
  X('pilSeal', 'The Seal', ['Core'], 'Mat', null, { kind: 'pilates', coach: 'mobility', reps: 8, gap: 3, level: 'beginner', guide: 'Hold your ankles from inside your knees, clap your feet three times, roll back to your shoulder blades and roll up to balance and clap again.' }),
  X('pilCrab', 'The Crab', ['Core'], 'Mat', null, { kind: 'pilates', coach: 'mobility', reps: 5, gap: 5, level: 'advanced', guide: 'Like the seal with crossed legs: roll back, switch the cross, then roll forward onto your knees with control. Protect your neck.' }),
  X('pilRocking', 'Rocking', ['Back', 'Glutes'], 'Mat', null, { kind: 'pilates', coach: 'mobility', reps: 5, gap: 3, level: 'advanced', guide: 'Face down holding your ankles, lift into a bow and rock forward and back on your belly. Stop if your lower back pinches.' }),
  X('pilControlBalance', 'Control Balance', ['Core', 'Hamstrings'], 'Mat', null, { kind: 'pilates', coach: 'mobility', reps: 4, gap: 7, level: 'advanced', guide: 'Advanced: it loads the neck. From a roll over, hold one foot and lift the other leg to the ceiling, switching with control.' }),
  X('pilPushUp', 'Pilates Push Up', ['Chest', 'Triceps', 'Core'], 'Mat', 'pushUp', { kind: 'pilates', level: 'intermediate', setup: 'Side-on to the camera, camera on the floor about two metres away.', guide: 'Roll down to the mat, walk your hands into a plank, do three slow push-ups with elbows close to your ribs, then walk back and roll up. QK checks each push-up on camera.' }),
  X('pilChestLift', 'Chest Lift', ['Core'], 'Mat', null, { kind: 'pilates', coach: 'mobility', reps: 10, gap: 4, level: 'beginner', guide: 'Knees bent, hands behind your head. Breathe out to curl your head and shoulders up, keeping your lower back on the mat, then lower slowly.' }),
  X('pilCrissCross', 'Criss-Cross', ['Core'], 'Mat', null, { kind: 'pilates', coach: 'mobility', reps: 12, gap: 2, level: 'intermediate', guide: 'Head and shoulders lifted, rotate your ribs towards the opposite knee as the other leg reaches long. Turn from your waist, not your elbows.' }),
  // ---- From free-exercise-db (public domain), each hand-matched to a camera-checked pattern ----
  ...EXTRA.map(([id, name, muscles, equipment, pattern, extra]) => X(id, name, muscles, equipment, pattern, extra)),
  // ---- Plyometrics, Olympic lifts, stretching/mobility and cardio from free-exercise-db ----
  ...MORE.map(([id, name, muscles, equipment, pattern, extra]) => X(id, name, muscles, equipment, pattern, extra)),
];

export const LIB = Object.fromEntries(LIBRARY.map(x => [x.id, x]));

// Engine definition for a library exercise: the movement pattern with this exercise's name and setup.
export function exFor(id) {
  const item = LIB[id]; if (!item?.pattern) return null;
  const base = EXERCISES[item.pattern];
  return { ...base, name: item.name, setup: item.setup || base.setup, patternKey: item.pattern, libId: id, free: item.free, bench: item.bench, skipRules: item.skipRules, kind: item.kind };
}

export const tracked = id => !!LIB[id]?.pattern;
