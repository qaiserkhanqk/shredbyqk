// QK programs: original training plans, each built for one goal with its own volume, rep ranges and
// exercises. They draw on publicly documented training methods (named in `method`), not on any
// coach's paid programme. The rep targets feed the progression engine, so QK still picks the weight.
//
// Item: [exerciseId, sets, reps, restSeconds, note?]
//   reps: '5' fixed · '8-12' range (double progression) · '30s' time · '400m' distance · '10/side'
// Volume is summarised per program as working sets per week, so programs can be compared.

const d = (name, focus, items) => ({ name, focus, items });

export const PROGRAMS = [
  {
    id: 'gainsEngine', name: 'Gains Engine', goal: 'Gains', level: 'Beginner', days: 3, weeks: 8,
    tagline: 'Three full-body days. Add weight almost every session.',
    method: 'Novice linear progression: a few big lifts, low volume, small jumps every session.',
    plan: [
      d('Day A', 'Squat · bench · row', [['squat', 3, '5', 180], ['benchPress', 3, '5', 180], ['bentRow', 3, '8', 120], ['plank', 3, '30s', 60]]),
      d('Day B', 'Deadlift · press · pull', [['deadlift', 2, '5', 180], ['press', 3, '5', 180], ['latPulldown', 3, '10', 90], ['legRaise', 3, '10', 60]]),
      d('Day C', 'Squat · bench · hinge', [['squat', 3, '5', 180], ['benchPress', 3, '5', 180], ['rdl', 3, '8', 120], ['facePull', 2, '15', 60]]),
    ],
  },
  {
    id: 'powerPump', name: 'Power & Pump', goal: 'Power building', level: 'Intermediate', days: 4, weeks: 10,
    tagline: 'Heavy first, then chase the pump. Strength and size together.',
    method: 'Power-hypertrophy split: each day opens with a heavy compound (4–6 reps) then moves to 8–15 rep bodybuilding work.',
    plan: [
      d('Upper power', 'Heavy bench and rows', [['benchPress', 4, '4-6', 180], ['bentRow', 4, '4-6', 180], ['press', 3, '6-8', 120], ['pullUp', 3, '6-10', 120], ['skullCrusher', 3, '8-12', 75], ['barbellCurl', 3, '8-12', 75]]),
      d('Lower power', 'Heavy squats and pulls', [['squat', 4, '4-6', 180], ['deadlift', 3, '3-5', 210], ['legPress', 3, '8-12', 120], ['lyingLegCurl', 3, '10-12', 75], ['calfRaise', 4, '10-15', 60]]),
      d('Upper pump', 'Volume for chest, back, arms', [['inclinePress', 4, '8-12', 90], ['cableRow', 4, '10-12', 90], ['dbShoulderPress', 3, '10-12', 90], ['cableFly', 3, '12-15', 60], ['lateralRaise', 4, '12-15', 45], ['pushdown', 3, '12-15', 45, '', 'A'], ['hammerCurl', 3, '12-15', 45, '', 'A']]),
      d('Lower pump', 'Volume for legs and glutes', [['hackSquat', 4, '8-12', 120], ['rdl', 3, '8-12', 120], ['bulgarian', 3, '10-12', 90], ['legExtension', 3, '12-15', 60], ['seatedLegCurl', 3, '12-15', 60], ['hipThrust', 3, '10-12', 90]]),
    ],
  },
  {
    id: 'hypertrophyLab', name: 'Hypertrophy Lab', goal: 'Muscle building', level: 'Intermediate', days: 5, weeks: 12,
    tagline: 'Five days, every muscle twice a week, 12–20 hard sets each.',
    method: 'Research-led hypertrophy: 10–20 weekly sets per muscle, 8–15 reps taken close to failure, each muscle trained twice a week.',
    plan: [
      d('Push', 'Chest, shoulders, triceps', [['dbBench', 4, '8-12', 90], ['inclinePress', 3, '8-12', 90], ['dbShoulderPress', 3, '10-12', 90], ['cableFly', 3, '12-15', 60], ['lateralRaise', 4, '12-20', 45, '', 'A'], ['ohExtension', 3, '10-15', 60, '', 'A']]),
      d('Pull', 'Back, rear delts, biceps', [['latPulldown', 4, '8-12', 90], ['chestRow', 4, '8-12', 90], ['dbRow', 3, '10-12', 75], ['rearDeltFly', 3, '12-20', 45], ['preacherCurl', 3, '10-12', 60], ['hammerCurl', 3, '12-15', 60]]),
      d('Legs', 'Quads, hamstrings, calves', [['hackSquat', 4, '8-12', 120], ['rdl', 4, '8-12', 120], ['legExtension', 3, '12-15', 60], ['lyingLegCurl', 3, '10-15', 60], ['seatedCalf', 4, '12-20', 45]]),
      d('Upper', 'Chest, back, arms', [['benchPress', 3, '6-10', 120], ['cableRow', 3, '10-12', 90], ['xMachineShoulderPress', 3, '10-12', 75], ['pecDeck', 3, '12-15', 60], ['cableCurl', 3, '12-15', 45], ['pushdown', 3, '12-15', 45]]),
      d('Lower', 'Glutes, quads, hamstrings', [['legPress', 4, '10-15', 120], ['hipThrust', 4, '8-12', 90], ['bulgarian', 3, '10-12', 75], ['seatedLegCurl', 3, '12-15', 60], ['calfRaise', 4, '12-20', 45]]),
    ],
  },
  {
    id: 'platformPrep', name: 'Platform Prep', goal: 'Powerlifting', level: 'Advanced', days: 4, weeks: 12,
    tagline: 'Squat, bench, deadlift. Heavy triples, bench three times a week.',
    method: 'Powerlifting frequency and wave loading: competition lifts trained often with low reps (1–5), plus close variations to fix weak points.',
    plan: [
      d('Squat + bench', 'Heavy squat, volume bench', [['squat', 5, '3', 240], ['benchPress', 5, '5', 180], ['xBoxSquat', 3, '3', 180], ['dbRow', 4, '8-10', 90]]),
      d('Deadlift', 'Heavy pull, posterior chain', [['deadlift', 4, '2', 270], ['goodMorning', 3, '6', 150], ['latPulldown', 4, '8-10', 90], ['abWheel', 3, '10', 60]]),
      d('Bench', 'Heavy bench, triceps', [['benchPress', 6, '3', 210], ['closeGrip', 4, '5', 150], ['press', 3, '6', 120], ['pushdown', 3, '10-15', 60]]),
      d('Squat + bench', 'Volume squat, paused bench', [['squat', 4, '5', 210], ['benchPress', 4, '4', 180], ['rdl', 3, '6', 150], ['facePull', 3, '15', 45]]),
    ],
  },
  {
    id: 'shredCircuit', name: 'Shred Circuit', goal: 'Fat loss', level: 'All levels', days: 4, weeks: 8,
    tagline: 'Fast circuits, short rest, and a finisher that keeps you burning.',
    method: 'Metabolic resistance training: big-muscle moves in circuits of 12–15 reps with 30–45 s rest, then a short conditioning finisher.',
    plan: [
      d('Full body A', 'Squat-push-pull circuit', [['gobletSquat', 4, '12-15', 30], ['pushUp', 4, '10-15', 30], ['dbRow', 4, '12-15', 30], ['kbSwing', 4, '15', 45], ['burpee', 3, '30s', 30, 'Finisher']]),
      d('Full body B', 'Hinge-press-lunge circuit', [['rdl', 4, '12-15', 30], ['dbShoulderPress', 4, '12', 30], ['reverseLunge', 4, '10/side', 30], ['mountainClimber', 4, '30s', 30], ['yRowingStationary', 1, '500m', 0, 'Row it hard']]),
      d('Conditioning', 'Intervals', [['runIntervals', 1, '6 rounds', 0], ['plank', 3, '45s', 30], ['russianTwist', 3, '20', 30]]),
      d('Full body C', 'Total-body burn', [['thruster', 4, '12', 45], ['latPulldown', 4, '12-15', 30], ['stepUp', 4, '10/side', 30], ['farmerCarry', 4, '40m', 45], ['yRopeJumping', 5, '40s', 20, 'Finisher']]),
    ],
  },
  {
    id: 'inferno', name: '10×10 Inferno', goal: 'Muscle building', level: 'Intermediate', days: 4, weeks: 6,
    tagline: 'Ten sets of ten. Same weight. Brutal, simple, it works.',
    method: 'German Volume Training (popularised by Charles Poliquin): 10 × 10 at about 60% of max with 60–90 s rest, paired with an opposing muscle.',
    plan: [
      d('Chest + back', '10 × 10 pair', [['dbBench', 10, '10', 90, 'Same weight all 10 sets'], ['chestRow', 10, '10', 90], ['inclinePress', 3, '10-12', 60], ['cableRow', 3, '10-12', 60]]),
      d('Legs + abs', '10 × 10 squat', [['squat', 10, '10', 90, 'Start at ~60% of your max'], ['lyingLegCurl', 10, '10', 90], ['calfRaise', 3, '15-20', 60], ['hangingRaise', 3, '10-15', 60]]),
      d('Off', 'Rest', []),
      d('Arms + shoulders', '10 × 10 arms', [['closeGrip', 10, '10', 90], ['barbellCurl', 10, '10', 90], ['lateralRaise', 3, '12-15', 60], ['rearDeltFly', 3, '12-15', 60]]),
    ].filter(x => x.items.length),
  },
  {
    id: 'athleteMode', name: 'Athlete Mode', goal: 'Strength & conditioning', level: 'Intermediate', days: 3, weeks: 8,
    tagline: 'Lift heavy, then jump. Strength that turns into speed.',
    method: 'Contrast training: a heavy lift (3 reps) paired with an explosive jump or throw, plus sprints. Builds force and the speed to use it.',
    plan: [
      d('Lower power', 'Squat contrast + sprints', [['squat', 4, '3', 150], ['yFrontBoxJump', 4, '5', 90, 'Right after each squat set'], ['bulgarian', 3, '6/side', 90], ['runSprints', 1, '6 × 20 s', 0]]),
      d('Upper power', 'Press contrast + throws', [['benchPress', 4, '3', 150], ['yMedicineBallChestPass', 4, '6', 90, 'Right after each bench set'], ['pullUp', 4, '5', 120], ['yOverheadSlam', 3, '8', 60]]),
      d('Total athlete', 'Clean, hinge, carry', [['yHangClean', 5, '3', 150], ['rdl', 3, '5', 150], ['yLateralBound', 3, '5/side', 90], ['farmerCarry', 4, '30m', 90], ['pallof', 3, '10/side', 45]]),
    ],
  },
  {
    id: 'springLoaded', name: 'Spring Loaded', goal: 'Plyometrics', level: 'Intermediate', days: 2, weeks: 6,
    tagline: 'Jump higher, run faster. Low reps, full rest, every rep fast.',
    method: 'Progressive plyometrics: foot contacts build from about 80 to 120 per session, from low-intensity hops to bounds and depth jumps, with full recovery.',
    plan: [
      d('Vertical', 'Jumps and hops', [['yKneeTuckJump', 3, '5', 60], ['yFrontBoxJump', 4, '5', 90], ['yHurdleHops', 4, '6', 90], ['yLinearDepthJump', 3, '4', 120, 'Step off, land, jump straight up'], ['singleCalf', 3, '12/side', 45]]),
      d('Horizontal', 'Bounds and throws', [['yLateralBound', 4, '5/side', 90], ['ySingleLegHopProgression', 3, '4/side', 90], ['yMedicineBallChestPass', 4, '6', 60], ['yPlyoPushUp', 3, '6', 90], ['runSprints', 1, '6 × 20 s', 0]]),
    ],
  },
  {
    id: 'raceReady', name: 'Race Ready', goal: 'HYROX', level: 'All levels', days: 4, weeks: 10,
    tagline: 'Run, station, run. Train the race the way it\'s raced.',
    method: 'HYROX-specific training: 8 × 1 km runs, each followed by a functional station. Builds running under fatigue ("compromised running").',
    plan: [
      d('Engine', 'Intervals + stations', [['runIntervals', 1, '6 rounds', 0], ['hyroxSki', 4, '250m', 60], ['hyroxWallBalls', 4, '20', 60]]),
      d('Strength', 'Race strength', [['squat', 4, '6', 150], ['deadlift', 3, '5', 180], ['hyroxSledPush', 4, '20m', 90], ['hyroxSledPull', 4, '20m', 90], ['hyroxFarmers', 3, '50m', 60]]),
      d('Compromised run', 'Run between stations', [['hyroxRun', 4, '1 km', 0, 'Straight into the station'], ['hyroxBurpeeBJ', 4, '20m', 0], ['hyroxRow', 4, '500m', 0], ['hyroxLunges', 4, '20m', 0]]),
      d('Long run', 'Aerobic base', [['runLong', 1, '50 min', 0], ['plank', 3, '45s', 45]]),
    ],
  },
  {
    id: 'engineIron', name: 'Engine & Iron', goal: 'Hybrid', level: 'Intermediate', days: 5, weeks: 12,
    tagline: 'Strong and fit at the same time. Lift three days, run three.',
    method: 'Concurrent (hybrid) training: heavy, low-volume lifting kept apart from mostly easy running, so strength and endurance both improve.',
    plan: [
      d('Lift: lower', 'Heavy legs', [['squat', 4, '5', 180], ['rdl', 3, '6', 150], ['bulgarian', 3, '8/side', 90], ['sidePlank', 3, '30s', 30]]),
      d('Run: easy', 'Zone 2', [['runEasy', 1, '40 min', 0]]),
      d('Lift: upper', 'Heavy push and pull', [['benchPress', 4, '5', 180], ['pullUp', 4, '6-8', 120], ['press', 3, '6-8', 120], ['dbRow', 3, '8-10', 90]]),
      d('Run: quality', 'Tempo', [['runTempo', 1, '25 min', 0], ['singleCalf', 3, '12/side', 45]]),
      d('Lift + long run', 'Full body, then go long', [['deadlift', 3, '3', 210], ['dbBench', 3, '8-10', 90], ['farmerCarry', 3, '40m', 60], ['runLong', 1, '60 min', 0, 'Later in the day or the next morning']]),
    ],
  },
  {
    id: 'barSpeed', name: 'Bar Speed', goal: 'Olympic lifting', level: 'Intermediate', days: 3, weeks: 8,
    tagline: 'Snatch, clean & jerk. Technique first, then load.',
    method: 'Classic weightlifting cycle: competition lifts in doubles and triples, pulls slightly heavier than the lifts, and front and overhead squats for position.',
    plan: [
      d('Snatch', 'Snatch + squat', [['yPowerSnatch', 5, '2', 120], ['ySnatchDeadlift', 4, '3', 120], ['yOverheadSquat', 4, '3', 120], ['backExt', 3, '10', 60]]),
      d('Clean & jerk', 'Clean, jerk, front squat', [['yHangClean', 5, '2', 120], ['yPushPress', 4, '3', 120], ['frontSquat', 4, '3', 150], ['pullUp', 3, '6', 90]]),
      d('Full lifts', 'Both lifts, then pulls', [['ySnatch', 6, '1', 120], ['yCleanAndJerk', 6, '1', 150], ['yCleanPull', 3, '3', 120], ['deadBug', 3, '10/side', 45]]),
    ],
  },
  {
    id: 'strengthBuilder', name: 'Strength Builder', goal: 'Strength', level: 'Intermediate', days: 4, weeks: 10,
    tagline: 'Four days. One heavy main lift each day. Stronger every week.',
    method: 'Upper/lower strength split: each day opens with one main lift for 4–5 sets of 3–6, then a second compound and 2–3 accessories for weak points.',
    plan: [
      d('Heavy squat', 'Squat, then single-leg and hamstrings', [['squat', 5, '3-5', 210], ['xBoxSquat', 3, '5', 150], ['bulgarian', 3, '8', 90], ['lyingLegCurl', 3, '8-10', 75], ['abWheel', 3, '8-12', 60]]),
      d('Heavy bench', 'Bench, then rows and triceps', [['benchPress', 5, '3-5', 210], ['bentRow', 4, '6-8', 120], ['closeGrip', 3, '6-8', 120], ['chinUp', 3, '6-10', 90], ['facePull', 3, '15', 45]]),
      d('Heavy deadlift', 'Deadlift, then the posterior chain', [['deadlift', 4, '3-5', 240], ['frontSquat', 3, '5', 150], ['goodMorning', 3, '8', 120], ['backExt', 3, '10-12', 60], ['plank', 3, '45s', 45]]),
      d('Heavy press', 'Overhead press, then pulling', [['press', 5, '3-5', 180], ['pullUp', 4, '5-8', 120], ['dbBench', 3, '8-10', 90], ['dbRow', 3, '8-10', 75], ['shrug', 3, '10-12', 60]]),
    ],
  },
  {
    id: 'massMonster', name: 'Mass Monster', goal: 'Muscle building', level: 'Intermediate', days: 4, weeks: 10,
    tagline: 'Heavy compounds, high volume, big pumps. Built to add size.',
    method: 'Mass-gain upper/lower: heavy compounds for 6–10 reps, then high-volume accessories, about 15–20 hard weekly sets for the big muscles.',
    plan: [
      d('Upper mass', 'Chest and back, heavy', [['benchPress', 4, '6-8', 150], ['bentRow', 4, '6-8', 150], ['inclinePress', 3, '8-10', 120], ['latPulldown', 3, '8-10', 90], ['chestDip', 3, '8-12', 90], ['barbellCurl', 3, '8-10', 60, '', 'A'], ['skullCrusher', 3, '8-10', 60, '', 'A']]),
      d('Lower mass', 'Squat-led legs', [['squat', 4, '6-8', 180], ['rdl', 4, '8-10', 150], ['legPress', 3, '10-15', 120], ['legExtension', 3, '12-15', 60], ['seatedLegCurl', 3, '10-12', 60], ['calfRaise', 4, '10-15', 45]]),
      d('Upper volume', 'Shoulders, back, arms', [['dbShoulderPress', 4, '8-12', 90], ['cableRow', 4, '10-12', 90], ['dbFly', 3, '12-15', 60], ['xChestSupportedTBarRow', 3, '10-12', 75], ['lateralRaise', 4, '12-15', 45], ['xEzBarCurl', 3, '10-12', 45, '', 'A'], ['pushdown', 3, '10-12', 45, '', 'A']]),
      d('Lower volume', 'Hinge-led legs and glutes', [['deadlift', 3, '5-6', 210], ['hackSquat', 4, '10-12', 120], ['hipThrust', 3, '8-12', 90], ['xDumbbellSplitSquat', 3, '10-12', 75], ['lyingLegCurl', 3, '12-15', 60], ['seatedCalf', 4, '12-20', 45]]),
    ],
  },
  {
    id: 'elitePhysique', name: 'Elite Physique', goal: 'Physique', level: 'Intermediate', days: 5, weeks: 12,
    tagline: 'Wide shoulders, full chest, wide back, sharp arms. The V-taper plan.',
    method: 'Physique emphasis: extra volume for side delts, upper chest, lats and arms to build the V-taper, 8–20 reps taken close to failure, legs trained twice a week.',
    plan: [
      d('Chest + back', 'Upper chest and lat width', [['xInclineBarbellBenchPress', 4, '6-10', 120], ['xWideGripLatPulldown', 4, '8-12', 90], ['xInclineDumbbellFly', 3, '10-15', 60], ['xMachineHighRow', 3, '10-12', 75], ['straightArmPulldown', 3, '12-15', 45], ['cableLateral', 3, '15-20', 30]]),
      d('Legs', 'Quads and hamstrings', [['hackSquat', 4, '8-12', 120], ['rdl', 3, '8-10', 120], ['legExtension', 3, '12-15', 60, '', 'A'], ['seatedLegCurl', 3, '12-15', 60, '', 'A'], ['seatedCalf', 4, '15-20', 30], ['hangingRaise', 3, '10-15', 45]]),
      d('Shoulders + arms', 'Side delts, biceps, triceps', [['xSeatedBarbellPress', 3, '8-10', 120], ['lateralRaise', 4, '12-20', 45], ['rearDeltFly', 3, '15-20', 45], ['xInclineDumbbellCurl', 3, '10-12', 45, '', 'A'], ['xOverheadCableTricepsExtension', 3, '10-12', 45, '', 'A'], ['xRopeHammerCurl', 3, '12-15', 45, '', 'B'], ['pushdown', 3, '12-15', 45, '', 'B']]),
      d('Back + chest', 'Back thickness and chest', [['pullUp', 4, '6-10', 120], ['chestRow', 3, '8-12', 90], ['xNeutralGripInclineDumbbellPress', 3, '8-12', 90], ['xLowToHighCableFly', 3, '12-15', 60], ['facePull', 3, '15-20', 45], ['xSeatedLateralRaise', 3, '12-15', 45]]),
      d('Glutes + legs', 'Glutes, hamstrings, waist', [['hipThrust', 4, '8-12', 90], ['bulgarian', 3, '10-12', 75], ['lyingLegCurl', 3, '10-15', 60], ['legPress', 3, '12-15', 90], ['calfRaise', 3, '12-15', 30], ['abWheel', 3, '8-12', 45]]),
    ],
  },
  {
    id: 'gluteLab', name: 'Glute Lab', goal: 'Glutes', level: 'All levels', days: 3, weeks: 10,
    tagline: 'Build the glutes from every angle: thrust, hinge, lunge, abduct.',
    method: 'Glute-focused training: hip thrusts and bridges for the top of the movement, hinges and lunges for the stretch, abduction for the upper glutes.',
    plan: [
      d('Thrust day', 'Heavy hip thrusts', [['hipThrust', 4, '6-10', 120], ['rdl', 3, '8-10', 120], ['bulgarian', 3, '10/side', 90], ['hipAbduction', 3, '15-20', 45], ['bandedWalk', 2, '20/side', 30]]),
      d('Squat day', 'Deep squats and lunges', [['gobletSquat', 4, '8-12', 90], ['reverseLunge', 3, '10/side', 75], ['xCablePullThrough', 3, '12-15', 60], ['cableKickback', 3, '12-15/side', 45], ['singleLegBridge', 2, '12/side', 45]]),
      d('Pump day', 'High reps, short rest', [['xBarbellGluteBridge', 4, '12-15', 60], ['stepUp', 3, '12/side', 60], ['backExt', 3, '15', 45], ['hipAbduction', 4, '20', 30], ['clamshell', 2, '20/side', 30]]),
    ],
  },
  {
    id: 'coreControl', name: 'Core Control', goal: 'Pilates & mobility', level: 'All levels', days: 3, weeks: 6,
    tagline: 'A strong, steady core and hips that move freely.',
    method: 'Pilates mat work (controlled breathing, precise reps) combined with mobility drills for the hips, spine and shoulders.',
    plan: [
      d('Core flow', 'Classic mat series', [['pilHundred', 1, '100 beats', 30], ['pilRollUp', 2, '6', 30], ['pilOneLegStretch', 2, '10/side', 30], ['pilDoubleLegStretch', 2, '8', 30], ['pilCrissCross', 2, '10/side', 30], ['pilShoulderBridge', 2, '8', 30]]),
      d('Mobility', 'Hips, spine, shoulders', [['yInchworm', 2, '6', 30], ['yKneelingHipFlexor', 2, '45s/side', 15], ['y9090Hamstring', 2, '45s/side', 15], ['catCamel', 2, '10', 15], ['thoracicExt', 2, '10', 15], ['wallSlide', 2, '10', 30]]),
      d('Control', 'Balance and anti-rotation', [['pilSwimming', 3, '20', 30], ['pilSideKick', 2, '10/side', 30], ['deadBug', 3, '10/side', 30], ['birdDog', 3, '8/side', 30], ['sidePlank', 3, '30s', 30], ['pilTeaser', 3, '5', 45]]),
    ],
  },
  {
    id: 'anywhereBurn', name: 'Anywhere Burn', goal: 'Fat loss · home', level: 'All levels', days: 4, weeks: 6, home: 'none',
    tagline: 'No equipment, no excuses. Twenty-five minutes anywhere.',
    method: 'Bodyweight conditioning: timed rounds of full-body moves with short rest, getting harder each week by adding rounds or reps.',
    plan: [
      d('Legs + lungs', 'Squats, lunges, jumps', [['xBodyweightSquat', 4, '20', 30], ['xBodyweightWalkingLunge', 4, '12/side', 30], ['jumpSquat', 4, '10', 45], ['wallSit', 3, '45s', 30], ['burpee', 3, '10', 45]]),
      d('Upper + core', 'Push-ups and planks', [['pushUp', 4, '10-20', 45], ['benchDip', 4, '12-15', 45], ['superman', 3, '12', 30], ['mountainClimber', 4, '30s', 30], ['plank', 3, '45s', 30]]),
      d('Cardio', 'Easy run or walk', [['runEasy', 1, '25 min', 0]]),
      d('Total body', 'Everything, fast', [['burpee', 5, '10', 30], ['reverseLunge', 4, '10/side', 30], ['xWidePushUp', 4, '12', 30], ['singleLegBridge', 3, '12/side', 30], ['yKneeTuckJump', 3, '8', 45]]),
    ],
  },
  {
    id: 'dumbbellDen', name: 'Dumbbell Den', goal: 'Muscle · home', level: 'All levels', days: 4, weeks: 8, home: 'dumbbells',
    tagline: 'A pair of dumbbells and a floor. Real muscle-building at home.',
    method: 'Upper/lower split with dumbbells only: floor presses, rows, goblet squats and split squats in 8–15 reps, with slow lowering to make lighter weights work harder.',
    plan: [
      d('Upper A', 'Press and pull', [['xDumbbellFloorPress', 4, '8-12', 90], ['xBentOverDumbbellRow', 4, '8-12', 90], ['xStandingDumbbellShoulderPress', 3, '10-12', 75], ['lateralRaise', 3, '12-15', 45], ['hammerCurl', 3, '10-12', 45]]),
      d('Lower A', 'Squat and hinge', [['gobletSquat', 4, '10-15', 90], ['xStiffLeggedDumbbellDeadlift', 4, '8-12', 90], ['xDumbbellSplitSquat', 3, '10/side', 75], ['singleLegBridge', 3, '12/side', 45], ['xStandingDumbbellCalfRaise', 3, '15-20', 45]]),
      d('Upper B', 'Volume', [['pushUp', 4, '10-20', 60], ['dbRow', 4, '10-12', 75], ['xLyingDumbbellTricepsExtension', 3, '10-12', 60], ['curl', 3, '10-12', 45], ['xBandedLateralRaise', 2, '15-20', 30]]),
      d('Lower B', 'Single leg and glutes', [['reverseLunge', 4, '10/side', 75], ['xPliDumbbellSquat', 3, '12-15', 75], ['xStiffLeggedDumbbellDeadlift', 3, '12', 75], ['deadBug', 3, '10/side', 30], ['sidePlank', 2, '30s', 30]]),
    ],
  },
  {
    id: 'bandStrong', name: 'Band Strong', goal: 'Strength · home', level: 'Beginner', days: 3, weeks: 6, home: 'bands',
    tagline: 'Resistance bands and bodyweight. Stronger anywhere, kind on the joints.',
    method: 'Full-body sessions with bands and bodyweight: controlled reps, a pause at the hardest point, then progress to a stronger band or more reps.',
    plan: [
      d('Full body A', 'Squat, push, pull', [['xBandedSquat', 3, '12-15', 60], ['pushUp', 3, '8-15', 60], ['bandPullApart', 3, '15-20', 45], ['xBandedHipThrust', 3, '12-15', 60], ['plank', 3, '30s', 30]]),
      d('Full body B', 'Hinge, press, glutes', [['xBandGoodMorning', 3, '12-15', 60], ['xBandedShoulderPress', 3, '10-15', 60], ['reverseLunge', 3, '10/side', 60], ['bandedWalk', 3, '15/side', 30], ['superman', 3, '12', 30]]),
      d('Full body C', 'Legs and core', [['xBandedSquat', 3, '15', 60], ['singleLegBridge', 3, '12/side', 45], ['xBandedLateralRaise', 3, '15', 45], ['xBandedCalfRaise', 3, '20', 30], ['deadBug', 3, '10/side', 30]]),
    ],
  },
];

/** Reps text → numeric scheme for the progression engine, or null for time / distance work. */
export function scheme(sets, reps) {
  const m = /^(\d+)(?:-(\d+))?$/.exec(String(reps).trim());
  return m ? { sets, lo: +m[1], hi: +(m[2] || m[1]) } : null;
}

/** Working sets per week (for comparing volume). */
export const weeklySets = p => p.plan.reduce((a, day) => a + day.items.reduce((b, it) => b + it[1], 0), 0) * p.days / p.plan.length;

/** The day a lifter is on: rotates through the plan each time a training day is logged. */
export function currentDay(prog, active) {
  if (!prog || !active) return null;
  // After the days a week change, the rotation restarts at session 1 (log entries before `restartAt` are history).
  const log = (active.log || []).slice(active.restartAt || 0), today = new Date().toDateString();
  const last = log[log.length - 1];
  if (last && new Date(last.at).toDateString() === today) { const i = last.day % prog.plan.length; return { index: i, day: prog.plan[i], doneToday: true, n: log.length }; }
  const index = log.length ? (last.day + 1) % prog.plan.length : 0;
  return { index, day: prog.plan[index], doneToday: false, n: log.length };
}

export const byId = id => PROGRAMS.find(p => p.id === id);

/**
 * How the Train tab groups programs. Each program sits in exactly one collection.
 * A program's `desc` (optional) is the longer description shown on its card and page; until it is
 * written, the tagline is shown instead.
 */
export const COLLECTIONS = [
  { key: 'muscle', name: 'Build muscle', sub: 'Size, shape and definition', ids: ['massMonster', 'elitePhysique', 'hypertrophyLab', 'inferno', 'gainsEngine'] },
  { key: 'strength', name: 'Get strong', sub: 'Heavier every week', ids: ['strengthBuilder', 'powerPump', 'platformPrep'] },
  { key: 'lean', name: 'Lose fat', sub: 'Burn hard, keep your muscle', ids: ['shredCircuit'] },
  { key: 'athletic', name: 'Athletic', sub: 'Power, speed and spring', ids: ['athleteMode', 'springLoaded', 'barSpeed'] },
  { key: 'engine', name: 'Fitness & races', sub: 'HYROX and hybrid', ids: ['raceReady', 'engineIron'] },
  { key: 'shape', name: 'Shape & mobility', sub: 'Glutes, core and hips', ids: ['gluteLab', 'coreControl'] },
  { key: 'home', name: 'At home', sub: 'No gym needed', ids: ['anywhereBurn', 'dumbbellDen', 'bandStrong'] },
];
/** The collection a program belongs to. */
export const collectionOf = id => COLLECTIONS.find(c => c.ids.includes(id)) || null;

/** Sign-up goals and the program each one starts. `beginner` is used for people new to lifting. */
export const GOALS = [
  { key: 'lose', label: 'Lose fat', sub: 'Gym circuits that burn', program: 'shredCircuit' },
  { key: 'muscle', label: 'Build muscle', sub: 'Size, shape and definition', program: 'hypertrophyLab', beginner: 'gainsEngine' },
  { key: 'powerbuild', label: 'Strong and muscular', sub: 'Power building', program: 'powerPump', beginner: 'gainsEngine' },
  { key: 'strength', label: 'Get stronger', sub: 'Heavy squat, bench, deadlift and press', program: 'strengthBuilder', beginner: 'gainsEngine' },
  { key: 'powerlifting', label: 'Compete in powerlifting', sub: 'Squat, bench, deadlift for a meet', program: 'platformPrep', beginner: 'gainsEngine' },
  { key: 'mass', label: 'Get bigger, fast', sub: 'Heavy, high-volume mass training', program: 'massMonster', beginner: 'gainsEngine' },
  { key: 'physique', label: 'Aesthetic physique', sub: 'Shoulders, chest, back and arms: the V-taper', program: 'elitePhysique', beginner: 'gainsEngine' },
  { key: 'athlete', label: 'Perform better at my sport', sub: 'Cricket, football, MMA, boxing, padel and more', program: 'athleteMode' },
  { key: 'hyrox', label: 'Race HYROX', sub: 'Running and stations', program: 'raceReady' },
  { key: 'hybrid', label: 'Strong and fit', sub: 'Lifting and running together', program: 'engineIron' },
  { key: 'glutes', label: 'Build my glutes', sub: 'Glute-focused training', program: 'gluteLab' },
  { key: 'olympic', label: 'Olympic lifting', sub: 'Snatch and clean & jerk', program: 'barSpeed' },
  { key: 'jump', label: 'Jump higher, run faster', sub: 'Plyometrics', program: 'springLoaded' },
  { key: 'core', label: 'Core and mobility', sub: 'Pilates and stretching', program: 'coreControl' },
  { key: 'home', label: 'Train at home, no equipment', sub: 'Bodyweight workouts', program: 'anywhereBurn' },
  { key: 'homeDb', label: 'Build muscle at home', sub: 'With a pair of dumbbells', program: 'dumbbellDen' },
  { key: 'homeBand', label: 'Get stronger at home', sub: 'With resistance bands', program: 'bandStrong' },
];
/** The program for a goal; people new to lifting get the beginner program where one exists. */
export function pickProgram(goalKey, isNew = false) {
  const g = GOALS.find(x => x.key === goalKey); if (!g) return null;
  return isNew && g.beginner ? g.beginner : g.program;
}
/** Default training days for a program, if the lifter hasn't picked any: spread through the week. */
export const defaultDays = n => ({ 1: [3], 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 5, 6], 6: [1, 2, 3, 4, 5, 6] }[n] || [1, 3, 5]);
