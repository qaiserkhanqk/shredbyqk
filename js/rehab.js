// Shred Rehab Clinic: evidence-based rehabilitation SUPPORT. Not diagnosis, not treatment.
//
// How it works (mirrors how physiotherapy clinics run rehab):
//   1. Safety first. Red-flag questions for every condition. Any "yes" stops the programme and
//      tells the person where to go (emergency services, same-day GP, or physio first).
//   2. Programmes are phased. A phase is passed on CRITERIA (pain, measured movement, strength,
//      symmetry, function), with a minimum time. Calendar time alone is not enough.
//   3. Load is guided by pain (pain-monitoring model, Silbernagel et al. 2007): some pain during
//      exercise is acceptable if it stays under the limit and settles by the next morning.
//   4. Progress is measured. Camera tests (rom.js) and the Patient-Specific Functional Scale (PSFS;
//      Stratford et al. 1995) track change against the person's own baseline and other side.
//   5. After surgery, or for any injury not yet assessed, the surgeon's or physio's plan overrides this one.
// Content summarises mainstream clinical guidelines (NICE, JOSPT clinical practice guidelines, BJSM
// consensus statements). It must be reviewed and signed off by a registered physiotherapist before release.

// ---------------- Safety screening ----------------
// level: 'emergency' (call 999 / A&E now), 'urgent' (see a doctor today), 'assess' (get diagnosed by a physio/doctor first)
export const GENERAL_FLAGS = [
  { q: 'Do you feel generally unwell, have a fever, or have you lost weight without trying?', level: 'urgent' },
  { q: 'Have you ever had cancer, or do you have pain at night that doesn\'t ease in any position?', level: 'urgent' },
  { q: 'Is the area hot, red and swollen?', level: 'urgent' },
  { unchecked: true, q: 'Did this start with a big fall, crash or impact?', level: 'assess' },
  { q: 'Is numbness, pins and needles or weakness getting worse?', level: 'urgent' },
];

const R = {
  spine: [
    { q: 'Numbness around your bottom or genitals, or new problems controlling your bladder or bowels?', level: 'emergency', why: 'This can be cauda equina syndrome, which needs emergency surgery.' },
    { q: 'Weakness or numbness in both legs, or a foot that slaps or drags?', level: 'emergency' },
    { q: 'Do you have osteoporosis or take long-term steroids, and did the pain start suddenly?', level: 'urgent', why: 'This can be a spinal fracture.' },
  ],
  neck: [
    { q: 'Dizziness, double vision, trouble speaking or swallowing, or sudden falls?', level: 'emergency', why: 'These can mean a problem with the blood supply to the brain.' },
    { q: 'Clumsy hands, pins and needles in both arms, or changes in your walking?', level: 'urgent', why: 'This can mean pressure on the spinal cord.' },
  ],
  shoulder: [
    { q: 'Shoulder or arm pain together with chest pain, breathlessness or sweating?', level: 'emergency', why: 'This can be a heart problem.' },
    { unchecked: true, q: 'After a fall or injury, can you not lift your arm at all, or does the shoulder look out of place?', level: 'urgent', why: 'This can be a dislocation, fracture or large tendon tear.' },
  ],
  elbow: [
    { unchecked: true, q: 'After a fall, can you not fully straighten or bend your elbow, or is it very swollen?', level: 'urgent', why: 'This can be a fracture.' },
    { q: 'Numbness in your ring and little finger, or a weak grip that\'s getting worse?', level: 'assess' },
  ],
  hip: [
    { unchecked: true, q: 'After a fall, can you not put weight on the leg?', level: 'emergency', why: 'This can be a hip fracture.' },
    { q: 'Groin pain with a limp in a child or teenager?', level: 'urgent' },
  ],
  knee: [
    { unchecked: true, q: 'Is your knee locked (you can\'t straighten it), or did it swell up within a few hours of an injury?', level: 'urgent', why: 'A locked knee or fast swelling can mean a ligament, meniscus or bone injury that needs a scan.' },
    { unchecked: true, q: 'Can you not take 4 steps, or is there pain right on the kneecap bone after an impact?', level: 'urgent', why: 'This can be a fracture (Ottawa knee rules).' },
    { q: 'Is your calf swollen, hot or tender, especially after surgery or a long journey?', level: 'emergency', why: 'This can be a blood clot (DVT).' },
  ],
  thigh: [
    { unchecked: true, q: 'Did you feel a pop at your sitting bone, with a large bruise and a gap you can feel?', level: 'urgent', why: 'This can be a tendon pulled off the bone, which may need surgery.' },
  ],
  ankle: [
    { unchecked: true, q: 'Could you not take 4 steps straight after the injury, or is there pain on the bony bumps of the ankle?', level: 'urgent', why: 'This can be a fracture and needs an X-ray (Ottawa ankle rules).' },
    { unchecked: true, q: 'Did you feel or hear a snap at the back of the ankle, like being kicked?', level: 'emergency', why: 'This can be an Achilles tendon rupture, which needs treatment within days.' },
    { q: 'Is your calf swollen, hot or tender?', level: 'emergency', why: 'This can be a blood clot (DVT).' },
  ],
  shin: [
    { q: 'Is there sharp pain on one spot of the bone, pain at rest or at night, or pain that makes you limp?', level: 'urgent', why: 'This can be a stress fracture.' },
  ],
};

export const FLAG_ADVICE = {
  emergency: { title: 'Get emergency help now', text: 'Call 999 (UK) or your local emergency number, or go to A&E. Don\'t exercise.' },
  urgent: { title: 'See a doctor today', text: 'Contact your GP for a same-day appointment, or NHS 111. Don\'t start this programme until you\'ve been checked.' },
  assess: { title: 'Get assessed first', text: 'See a physiotherapist or doctor to confirm what\'s wrong before starting. They can then approve this programme.' },
};

/**
 * Worst level among the answered "yes" flags, or null if all clear.
 * Flags marked `unchecked` describe how an injury happened (a fall, a snap, swelling after injury). They exist to
 * send an UNASSESSED injury to a clinician, so they don't block someone whose injury has already been
 * diagnosed. Symptom flags (bladder changes, DVT, chest pain, fever) always apply.
 */
export function triage(answers, { diagnosed = false } = {}) {
  const order = { emergency: 3, urgent: 2, assess: 1 };
  let worst = null;
  for (const a of answers) {
    if (!a.yes || (diagnosed && (a.unchecked || a.level === 'assess'))) continue;
    if (!worst || order[a.level] > order[worst]) worst = a.level;
  }
  return worst;
}

// ---------------- Pain monitoring ----------------
/**
 * Traffic light from a check-in (0–10 scales). limit = the condition's acceptable pain during exercise.
 * green: carry on or progress · amber: keep the same load · red: reduce load for the next session.
 */
export function painLight({ during, after, nextMorning, usualMorning = null }, limit = 3) {
  const worseNextDay = nextMorning != null && usualMorning != null ? nextMorning > usualMorning + 1 : nextMorning != null && nextMorning > limit;
  if (during > limit + 2 || worseNextDay || (after != null && after > limit + 2)) return { light: 'red', advice: 'Pain went too high or hadn\'t settled by the next morning. Next session: reduce the load (fewer sets, lighter, smaller range) and check in again.' };
  if (during > limit || (after != null && after > limit)) return { light: 'amber', advice: 'A little above your pain limit. Keep the same load next time, don\'t progress yet.' };
  return { light: 'green', advice: 'Pain stayed within your limit and settled. Carry on, and progress when the phase criteria are met.' };
}

// ---------------- Conditions ----------------
// Phase exercises: [libraryId, dose]. Criteria: {type, ...} evaluated by canProgress().
const P = (name, minWeeks, goal, exercises, criteria) => ({ name, minWeeks, goal, exercises, criteria });
const pain = (max = 3) => ({ type: 'pain', max });
const test = (id, op, v, label) => ({ type: 'test', test: id, op, v, label });
const sym = (id, min, label) => ({ type: 'lsi', test: id, min, label });
const psfs = min => ({ type: 'psfs', min });

export const CONDITIONS = [
  { id: 'lbp', name: 'Lower back pain', area: 'Lower back', flags: R.spine, painLimit: 3, tests: ['trunkFlexion', 'trunkExtension'],
    about: 'Most back pain is "non-specific": no single damaged structure, and it usually improves within weeks. Staying active and graded exercise work better than rest.',
    evidence: 'NICE NG59 (2016, updated 2020): exercise, self-management and staying active first; no routine scans; rest and passive treatment alone not recommended.',
    phases: [
      P('Calm it down and keep moving', 1, 'Reduce pain and fear of moving; daily walking.', [['walk', '10–30 min daily'], ['catCamel', '2×10'], ['birdDog', '2×6 each side'], ['mcgillCurlUp', '3×5 holds']], [pain(3), psfs(4)]),
      P('Build strength and control', 2, 'Strengthen the hips and trunk; restore bending.', [['gluteBridge', '3×12'], ['deadBug', '3×8 each side'], ['sidePlank', '3×20 s each side'], ['hipHingeDowel', '3×10'], ['gobletSquat', '3×10']], [pain(3), test('trunkFlexion', '>=', 70, 'Forward bend 70°+ or back to your baseline'), psfs(7)]),
      P('Return to full load', 3, 'Lift, carry and train normally.', [['rdl', '3×8'], ['backExt', '3×12'], ['farmerCarry', '3×40 s'], ['squat', '3×8']], [pain(2), psfs(9)]),
    ] },
  { id: 'neck', name: 'Neck pain', area: 'Neck', flags: R.neck, painLimit: 3, tests: [],
    about: 'Usually mechanical and improves with movement, strength for the neck and upper back, and posture variety (not one "perfect" posture).',
    evidence: 'JOSPT neck pain clinical practice guideline (2017): exercise (deep neck flexor, scapular and upper-back strength) plus manual therapy for most groups.',
    phases: [
      P('Ease and move', 1, 'Gentle movement and deep neck muscle activation.', [['chinTuck', '3×10'], ['neckIso', '5×10 s each direction'], ['thoracicExt', '2×10'], ['walk', '20 min daily']], [pain(3), psfs(5)]),
      P('Upper-back strength', 2, 'Strengthen the muscles that support the neck.', [['bandPullApart', '3×15'], ['facePull', '3×15'], ['cableRow', '3×12'], ['chinTuck', '3×10']], [pain(2), psfs(7)]),
      P('Full strength', 2, 'Return to all lifting and sport.', [['dbRow', '3×10'], ['press', '3×8'], ['shrug', '3×12'], ['farmerCarry', '3×40 s']], [pain(1), psfs(9)]),
    ] },
  { id: 'frozenShoulder', name: 'Frozen shoulder', area: 'Shoulder', flags: R.shoulder, painLimit: 3, tests: ['shoulderFlexion', 'shoulderAbduction'],
    about: 'The shoulder capsule becomes inflamed then stiff. It goes through painful, stiff and thawing stages and usually recovers over 1–3 years. More common with diabetes and thyroid problems.',
    evidence: 'Gentle stretching within tolerance in the painful stage, more stretching as it stiffens. Steroid injection can help pain early on (ask your GP); manipulation or surgery only if not improving.',
    phases: [
      P('Painful stage: protect and keep moving', 2, 'Keep the movement you have without flaring it.', [['pendulum', '2 min, 3× daily'], ['tableSlide', '2×10'], ['isoER', '5×20 s'], ['walk', 'daily']], [pain(3), psfs(4)]),
      P('Stiff stage: regain movement', 4, 'Stretch firmly but not into sharp pain.', [['wallSlide', '3×10'], ['crossBody', '3×30 s'], ['towelBehindBack', '3×30 s'], ['bandER', '3×12']], [pain(3), test('shoulderFlexion', '>=', 140, 'Forward raise 140°+'), psfs(6)]),
      P('Thawing: strength and full use', 4, 'Rebuild strength through the new range.', [['lateralRaise', '3×12 light'], ['dbShoulderPress', '3×10 light'], ['cableRow', '3×12'], ['bandER', '3×15']], [pain(2), sym('shoulderAbduction', 90, 'Side raise within 10% of your other arm'), psfs(8)]),
    ] },
  { id: 'cuff', name: 'Shoulder pain lifting the arm (rotator cuff)', area: 'Shoulder', flags: R.shoulder, painLimit: 4, tests: ['shoulderFlexion', 'shoulderAbduction'],
    about: 'Pain at the top or side of the shoulder when lifting the arm, often from overload of the rotator cuff tendons. Progressive strengthening is the main treatment.',
    evidence: 'Exercise is first-line. In the CSAW trial (Lancet 2018), decompression surgery was no better than placebo surgery for this type of shoulder pain.',
    phases: [
      P('Settle and activate', 2, 'Load the tendons gently with holds.', [['isoER', '5×30 s'], ['isoAbd', '5×30 s'], ['pendulum', '1–2 min'], ['walk', 'daily']], [pain(4), psfs(5)]),
      P('Strengthen', 3, 'Progressive rotator cuff and shoulder blade strength.', [['bandER', '3×15'], ['lateralRaise', '3×12 light'], ['cableRow', '3×12'], ['wallSlide', '3×10'], ['inclinePushUp', '3×10']], [pain(3), test('shoulderFlexion', '>=', 160, 'Forward raise 160°+'), psfs(7)]),
      P('Overhead and full load', 3, 'Return to pressing, throwing and sport.', [['dbShoulderPress', '3×10'], ['facePull', '3×15'], ['pushUp', '3×12'], ['latPulldown', '3×10']], [pain(2), sym('shoulderAbduction', 95, 'Side raise within 5% of your other arm'), psfs(9)]),
    ] },
  { id: 'tennisElbow', name: 'Tennis elbow', area: 'Elbow', flags: R.elbow, painLimit: 5, tests: [],
    about: 'Overload of the tendon on the outside of the elbow from gripping and lifting with the wrist. It usually settles over months; gradual loading speeds it up.',
    evidence: 'Education and progressive loading. Steroid injections helped short-term but did worse at 1 year than wait-and-see or physio (Coombes, Lancet 2010; Bisset, BMJ 2006).',
    phases: [
      P('Calm the tendon', 2, 'Isometric holds; reduce aggravating gripping.', [['isoWristExt', '5×45 s'], ['gripSqueeze', '3×10'], ['walk', 'daily']], [pain(5), psfs(5)]),
      P('Load the tendon', 4, 'Slow lowering strength for the wrist extensors.', [['eccWristExt', '3×15'], ['wristCurl', '3×15'], ['hammerCurl', '3×12 light'], ['gripSqueeze', '3×10']], [pain(4), psfs(7)]),
      P('Full grip strength', 3, 'Return to lifting and racket sport.', [['farmerCarry', '3×40 s'], ['dbRow', '3×10'], ['eccWristExt', '3×15 heavier'], ['pullUp', 'as able']], [pain(2), psfs(9)]),
    ] },
  { id: 'golfersElbow', name: 'Golfer\'s elbow', area: 'Elbow', flags: R.elbow, painLimit: 5, tests: [],
    about: 'Overload of the tendon on the inside of the elbow from gripping and wrist bending. Treated like tennis elbow, loading the wrist flexors instead.',
    evidence: 'Progressive tendon loading; education; avoid repeated injections.',
    phases: [
      P('Calm the tendon', 2, 'Isometric holds.', [['isoWristFlex', '5×45 s'], ['gripSqueeze', '3×10']], [pain(5), psfs(5)]),
      P('Load the tendon', 4, 'Slow lowering strength.', [['eccWristFlex', '3×15'], ['wristCurl', '3×15'], ['curl', '3×12 light']], [pain(4), psfs(7)]),
      P('Full strength', 3, 'Return to sport and lifting.', [['farmerCarry', '3×40 s'], ['chinUp', 'as able'], ['eccWristFlex', '3×15 heavier']], [pain(2), psfs(9)]),
    ] },
  { id: 'glutealTendon', name: 'Pain on the side of the hip (gluteal tendinopathy)', area: 'Hip', flags: R.hip, painLimit: 4, tests: [],
    about: 'Overload of the gluteal tendons on the side of the hip. Pressure positions make it worse: lying on that side, crossing your legs, standing hanging on one hip.',
    evidence: 'LEAP trial (BMJ 2018): education plus progressive exercise beat steroid injection and wait-and-see at 8 weeks and 1 year.',
    phases: [
      P('Offload and hold', 2, 'Avoid compression positions; isometric loading.', [['isoHipAbd', '5×45 s'], ['gluteBridge', '3×12'], ['walk', 'daily, flat']], [pain(4), psfs(5)]),
      P('Strengthen', 4, 'Progressive hip strength in standing.', [['sitToStand', '3×10'], ['stepUp', '3×10 each'], ['singleLegBridge', '3×10 each'], ['bandedWalk', '3×10 steps each way']], [pain(3), psfs(7)]),
      P('Full function', 4, 'Single-leg strength and return to running.', [['bulgarian', '3×8'], ['singleLegRdl', '3×8'], ['hipThrust', '3×10']], [pain(2), psfs(9)]),
    ] },
  { id: 'oa', name: 'Hip or knee osteoarthritis', area: 'Knee', flags: R.knee, painLimit: 4, tests: ['chairStand30', 'kneeFlexion'],
    about: 'Joint changes that are very common with age. Pain is not a sign of damage getting worse: strengthening and staying active are the most effective treatments.',
    evidence: 'NICE NG226 (2022): therapeutic exercise and weight management first-line. Arthroscopy is not recommended for osteoarthritis.',
    phases: [
      P('Get moving', 2, 'Build confidence and daily activity.', [['sitToStand', '3×10'], ['gluteBridge', '3×12'], ['quadSet', '3×10'], ['walk', '20–30 min daily']], [pain(4), psfs(5)]),
      P('Build strength', 4, 'Progressive leg strength.', [['sitToStand', '3×12 slower'], ['stepUp', '3×10'], ['legExtension', '3×12'], ['legPress', '3×10'], ['singleLegBalance', '3×30 s']], [pain(4), test('chairStand30', '>=', 12, '30-second sit-to-stand: 12+ or better than your baseline'), psfs(7)]),
      P('Keep it strong', 4, 'Long-term strength habit (2–3×/week, for life).', [['gobletSquat', '3×10'], ['reverseLunge', '3×8'], ['rdl', '3×10'], ['calfRaise', '3×15']], [pain(3), psfs(8)]),
    ] },
  { id: 'pfp', name: 'Pain at the front of the knee (patellofemoral)', area: 'Knee', flags: R.knee, painLimit: 3, tests: ['kneeFlexion'],
    about: 'Pain around or behind the kneecap with stairs, squats, running or long sitting. Very common in runners and teenagers. Responds well to hip and knee strengthening.',
    evidence: 'Consensus (Crossley et al., BJSM 2016): combined hip and knee exercise therapy is first-line; short-term taping or foot orthoses can be added.',
    phases: [
      P('Calm and strengthen around it', 2, 'Strength without flaring the knee.', [['wallSit', '5×30 s at a pain-free depth'], ['clamshell', '3×15'], ['sideLyingAbd', '3×12'], ['quadSet', '3×10'], ['legExtension', '3×12 (0–45° range)']], [pain(3), psfs(5)]),
      P('Build loaded strength', 3, 'Squat and step strength with good knee control.', [['gobletSquat', '3×10 pain-free depth'], ['stepUp', '3×10'], ['stepDown', '3×8'], ['singleLegBridge', '3×10'], ['bandedWalk', '3×10 each way']], [pain(3), { type: 'kneeTest', max: 10, label: 'Single-leg squat knee drift under 10° (Tests tab)' }, psfs(7)]),
      P('Return to running and sport', 3, 'Single-leg power and landing control.', [['bulgarian', '3×8'], ['lunge', '3×10'], ['singleLegRdl', '3×8'], ['hopDrill', '3×20 s']], [pain(2), psfs(9)]),
    ] },
  { id: 'patellarTendon', name: 'Jumper\'s knee (patellar tendinopathy)', area: 'Knee', flags: R.knee, painLimit: 5, tests: [],
    about: 'Pain just below the kneecap with jumping and squatting, from overload of the patellar tendon. Tendons respond to gradual, heavy loading.',
    evidence: 'Progressive tendon loading: isometric, then heavy slow, then energy storage, then return to sport (Malliaras et al. 2015). Pain up to 5/10 is OK if it settles within 24 hours.',
    phases: [
      P('Isometric loading', 2, 'Reduce pain with long holds.', [['spanishSquat', '5×45 s'], ['wallSit', '5×45 s'], ['calfRaise', '3×15']], [pain(5), psfs(5)]),
      P('Heavy slow strength', 4, 'Build tendon capacity (3 s down, 3 s up).', [['legPress', '4×8 heavy, slow'], ['declineSquat', '3×10'], ['legExtension', '3×10 slow'], ['bulgarian', '3×8']], [pain(4), psfs(7)]),
      P('Spring and return to sport', 4, 'Jumping, landing and sport-specific load.', [['jumpSquat', '3×6'], ['hopDrill', '3×20 s'], ['lunge', '3×10'], ['squat', '3×6 heavy']], [pain(3), psfs(9)]),
    ] },
  { id: 'acl', name: 'ACL injury or reconstruction', area: 'Knee', flags: R.knee, painLimit: 3, postOp: true, tests: ['kneeExtension', 'kneeFlexion', 'hop', 'landingFPPA'],
    about: 'The ACL controls twisting of the knee. Rehab is long (9–12 months after surgery for sport). Strength, control and passing return-to-sport tests matter more than time alone.',
    evidence: 'Meeting return-to-sport criteria (hop and strength symmetry ≥90%) and waiting ≥9 months after surgery greatly reduced re-injury (Grindem, BJSM 2016). Neuromuscular training reduces ACL injuries (FIFA 11+).',
    phases: [
      P('Swelling down, knee straight', 2, 'Full straightening, quad activation, walking without a limp.', [['quadSet', '5×10, several times daily'], ['heelSlide', '3×15'], ['straightLegRaise', '3×10'], ['terminalKneeExt', '3×15']], [pain(3), test('kneeExtension', '<=', 3, 'Knee straightens to within 3°'), test('kneeFlexion', '>=', 110, 'Knee bends 110°+')]),
      P('Strength and control', 6, 'Rebuild quad and hip strength; single-leg control.', [['legPress', '3×10'], ['gobletSquat', '3×10'], ['stepUp', '3×10'], ['singleLegBridge', '3×10'], ['singleLegBalance', '3×30 s'], ['calfRaise', '3×15']], [pain(2), test('kneeFlexion', '>=', 130, 'Knee bends 130°+'), { type: 'kneeTest', max: 10, label: 'Single-leg squat knee drift under 10°' }]),
      P('Running and power', 8, 'Start running, then jumping and landing.', [['bulgarian', '3×8'], ['singleLegRdl', '3×8'], ['nordic', '3×5'], ['jumpSquat', '3×6'], ['hopDrill', '3×20 s']], [pain(2), sym('hop', 80, 'Hop distance 80%+ of your other leg')]),
      P('Return to sport', 8, 'Pass return-to-sport tests; sport-specific training.', [['squat', '3×6 heavy'], ['lunge', '3×10'], ['burpee', '3×8'], ['hopDrill', '4×20 s']], [pain(1), sym('hop', 90, 'Hop distance 90%+ of your other leg'), test('landingFPPA', '<=', 10, 'Landing knee drift under 10°'), psfs(9)]),
    ] },
  { id: 'pcl', name: 'PCL injury', area: 'Knee', flags: R.knee, painLimit: 3, postOp: true, tests: ['kneeExtension', 'kneeFlexion', 'hop'],
    about: 'The PCL stops the shin sliding backwards. Most isolated PCL injuries are treated without surgery. Early rehab focuses on the quads and avoids heavy hamstring curls and deep loaded knee bending.',
    evidence: 'Quad-focused rehabilitation; avoid isolated hamstring loading early (it pulls the shin backwards). Programmes are physio-led and often use a brace in the early weeks.',
    phases: [
      P('Protect and activate', 3, 'Straighten the knee; quads working; no hamstring curls.', [['quadSet', '5×10'], ['straightLegRaise', '3×10'], ['legExtension', '3×12 light'], ['wallSit', '5×30 s shallow']], [pain(3), test('kneeExtension', '<=', 3, 'Knee straightens to within 3°')]),
      P('Strength', 6, 'Quad strength; squats to about 70° knee bend.', [['legPress', '3×10 to 70°'], ['stepUp', '3×10'], ['gluteBridge', '3×12'], ['singleLegBalance', '3×30 s']], [pain(2), test('kneeFlexion', '>=', 125, 'Knee bends 125°+')]),
      P('Power and return to sport', 6, 'Full-range strength, then running and jumping.', [['gobletSquat', '3×10'], ['lunge', '3×10'], ['singleLegRdl', '3×8'], ['hopDrill', '3×20 s']], [pain(1), sym('hop', 90, 'Hop distance 90%+ of your other leg'), psfs(9)]),
    ] },
  { id: 'meniscus', name: 'Meniscus tear (degenerative)', area: 'Knee', flags: R.knee, painLimit: 3, tests: ['kneeFlexion', 'kneeExtension'],
    about: 'Wear-related meniscus tears are very common in adults over 40, often painless. Exercise therapy is the first treatment.',
    evidence: 'Exercise therapy matched arthroscopic partial meniscectomy for degenerative tears (Kise et al., BMJ 2016). A knee that LOCKS needs assessment.',
    phases: [
      P('Settle and move', 2, 'Reduce swelling, restore movement.', [['quadSet', '3×10'], ['heelSlide', '3×15'], ['gluteBridge', '3×12'], ['walk', 'daily']], [pain(3), test('kneeExtension', '<=', 5, 'Knee straightens to within 5°')]),
      P('Strength', 4, 'Progressive leg strength.', [['sitToStand', '3×12'], ['stepUp', '3×10'], ['legPress', '3×10'], ['singleLegBalance', '3×30 s']], [pain(3), test('kneeFlexion', '>=', 125, 'Knee bends 125°+'), psfs(7)]),
      P('Full function', 4, 'Return to sport and full squatting.', [['gobletSquat', '3×10'], ['reverseLunge', '3×8'], ['hopDrill', '3×20 s']], [pain(2), psfs(9)]),
    ] },
  { id: 'hamstring', name: 'Hamstring strain', area: 'Thigh', flags: R.thigh, painLimit: 0, tests: [],
    about: 'A tear in the hamstring muscle, usually while sprinting or overstretching. Return is guided by pain-free strength and sprinting, not time alone.',
    evidence: 'Lengthening-focused rehab (Askling L-protocol) returned athletes faster than conventional rehab (Askling, BJSM 2013). Nordic curls roughly halve hamstring injuries (van Dyk, BJSM 2019).',
    phases: [
      P('Protect and activate', 1, 'Pain-free holds and walking. No stretching into pain.', [['hamIso', '5×20 s pain-free'], ['gluteBridge', '3×12'], ['walk', 'daily']], [pain(0), psfs(5)]),
      P('Lengthening strength', 2, 'The L-protocol, done pain-free.', [['extender', '3×12, twice daily'], ['diver', '3×6'], ['glider', '3×4'], ['singleLegBridge', '3×10']], [pain(0), psfs(7)]),
      P('Heavy strength and sprinting', 3, 'Build to full-speed sprinting.', [['nordic', '3×5'], ['rdl', '3×8'], ['singleLegRdl', '3×8'], ['hopDrill', '3×20 s']], [pain(0), psfs(9)]),
    ] },
  { id: 'achilles', name: 'Achilles tendinopathy', area: 'Ankle & foot', flags: R.ankle, painLimit: 5, tests: ['calfRaiseEndurance', 'ankleDorsiflexion'],
    about: 'Overload of the Achilles tendon: morning stiffness and pain when starting to run. Tendons need progressive load. Complete rest makes them weaker.',
    evidence: 'JOSPT Achilles clinical practice guideline (2018): progressive loading, including eccentric and heavy slow resistance. Pain-monitoring model (Silbernagel 2007): up to 5/10 is OK if it settles by the next morning.',
    phases: [
      P('Isometric loading', 2, 'Reduce pain; keep active with tolerable load.', [['isoCalf', '5×45 s'], ['calfRaise', '3×15 two legs'], ['walk', 'daily']], [pain(5), psfs(5)]),
      P('Heavy slow strength', 6, 'Build tendon capacity.', [['heelDrop', '3×15 straight and bent knee'], ['singleCalf', '3×12 slow'], ['seatedCalf', '3×15 heavy'], ['legPress', '3×10']], [pain(4), sym('calfRaiseEndurance', 80, 'Calf raise reps 80%+ of the other leg')]),
      P('Spring and running', 6, 'Hopping, then a graded return to running.', [['hopDrill', '3×20 s'], ['singleCalf', '3×15 weighted'], ['jumpSquat', '3×6']], [pain(3), test('calfRaiseEndurance', '>=', 25, '25+ single-leg calf raises'), sym('calfRaiseEndurance', 90, 'Within 10% of the other leg')]),
    ] },
  { id: 'ankleSprain', name: 'Ankle sprain', area: 'Ankle & foot', flags: R.ankle, painLimit: 3, tests: ['ankleDorsiflexion', 'hop'],
    about: 'Overstretching of the outer ankle ligaments. Early movement and balance training speed recovery and cut the chance of spraining it again.',
    evidence: 'Early weight-bearing and exercise; balance training reduced repeat sprains (Hupperets, BMJ 2009). Ottawa ankle rules decide whether an X-ray is needed.',
    phases: [
      P('Protect and move', 1, 'Walk as able, reduce swelling, regain movement.', [['ankleAlphabet', '2× daily'], ['calfStretch', '3×30 s'], ['calfRaise', '3×15 two legs'], ['walk', 'as able']], [pain(3), sym('ankleDorsiflexion', 85, 'Ankle bend 85%+ of the other side')]),
      P('Balance and strength', 2, 'Single-leg balance and calf strength.', [['singleLegBalance', '3×30 s, then eyes closed'], ['singleCalf', '3×12'], ['bandedWalk', '3×10 each way'], ['stepUp', '3×10']], [pain(2), sym('ankleDorsiflexion', 95, 'Ankle bend 95%+ of the other side')]),
      P('Hops and return to sport', 2, 'Hopping, cutting and sport drills.', [['hopDrill', '3×20 s'], ['lunge', '3×10'], ['jumpSquat', '3×6']], [pain(1), sym('hop', 90, 'Hop distance 90%+ of your other leg')]),
    ] },
  { id: 'plantarHeel', name: 'Heel pain (plantar fasciitis)', area: 'Ankle & foot', flags: R.ankle, painLimit: 4, tests: ['ankleDorsiflexion'],
    about: 'Pain under the heel, worst with the first steps in the morning. Usually settles with stretching, strength work, good footwear and load management.',
    evidence: 'Stretching, plus high-load strength (heel raises with a towel under the toes; Rathleff et al. 2015), supportive shoes or insoles, and weight management. Most cases improve within a year.',
    phases: [
      P('Settle', 2, 'Stretch and reduce aggravating load.', [['plantarStretch', '3×30 s, before first steps'], ['calfStretch', '3×30 s'], ['isoCalf', '5×30 s']], [pain(4), psfs(5)]),
      P('High-load strength', 4, 'Build foot and calf strength.', [['towelHeelRaise', '3×12 (3 s up, 2 s hold, 3 s down) every other day'], ['singleCalf', '3×12'], ['plantarStretch', 'daily']], [pain(3), psfs(7)]),
      P('Return to running', 4, 'Graded return to impact.', [['hopDrill', '3×20 s'], ['towelHeelRaise', '3×10 weighted'], ['walk', 'build time on feet']], [pain(2), psfs(9)]),
    ] },
  { id: 'shinSplints', name: 'Shin splints (medial tibial stress)', area: 'Shin', flags: R.shin, painLimit: 3, tests: ['calfRaiseEndurance'],
    about: 'Pain along the inner shin bone from running load the bone can\'t yet tolerate. Reduce running, build calf and hip strength, then return gradually.',
    evidence: 'Load management and graded return to running; calf and hip strengthening; increasing cadence 5–10% reduces impact. Rule out a stress fracture (pinpoint bone pain).',
    phases: [
      P('Offload', 2, 'Cross-train without pain; strength.', [['calfRaise', '3×20'], ['seatedCalf', '3×15'], ['sideLyingAbd', '3×15'], ['walk', 'pain-free']], [pain(2), psfs(5)]),
      P('Strength', 3, 'Build calf and hip capacity.', [['singleCalf', '3×15'], ['stepUp', '3×10'], ['singleLegBalance', '3×30 s'], ['hopDrill', '2×15 s']], [pain(2), test('calfRaiseEndurance', '>=', 25, '25+ single-leg calf raises')]),
      P('Return to running', 4, 'Walk-run programme, 10% weekly increase, higher cadence.', [['hopDrill', '3×20 s'], ['singleCalf', '3×15 weighted'], ['bulgarian', '3×8']], [pain(1), psfs(9)]),
    ] },
];

export const AREAS = ['Lower back', 'Neck', 'Shoulder', 'Elbow', 'Hip', 'Knee', 'Thigh', 'Ankle & foot', 'Shin'];
export const COND = Object.fromEntries(CONDITIONS.map(c => [c.id, c]));

// ---------------- Progress logic ----------------
/**
 * Evaluate a phase's criteria against the plan's data. Returns [{label, met, detail}] and allMet.
 * plan: { startedAt, phaseStartedAt, checkins:[{at,during,after,nextMorning}], tests:[{at,test,side,value,L,R}],
 *         psfs:[{at, score}], kneeTests:[{at, L, R}], injured: 'L'|'R'|null }
 */
export function evaluatePhase(cond, phaseIdx, plan, now = Date.now()) {
  const phase = cond.phases[phaseIdx], out = [];
  const weeks = (now - (plan.phaseStartedAt || plan.startedAt)) / (7 * 864e5);
  out.push({ label: `At least ${phase.minWeeks} week${phase.minWeeks > 1 ? 's' : ''} in this phase`, met: weeks >= phase.minWeeks, detail: `${Math.floor(weeks * 7)} days so far` });
  const recent = (plan.checkins || []).filter(c => c.at >= (plan.phaseStartedAt || 0)).slice(-3);
  const latest = (testId) => [...(plan.tests || [])].reverse().find(t => t.test === testId);
  for (const c of phase.criteria) {
    if (c.type === 'pain') {
      const ok = recent.length >= 3 && recent.every(r => r.during <= c.max && (r.nextMorning == null || r.nextMorning <= Math.max(c.max, 1)));
      out.push({ label: c.max === 0 ? 'Pain-free during exercise (last 3 check-ins)' : `Pain ${c.max}/10 or less during exercise (last 3 check-ins)`, met: ok, detail: recent.length < 3 ? `${recent.length}/3 check-ins` : recent.map(r => r.during).join(', ') });
    } else if (c.type === 'psfs') {
      const p = (plan.psfs || []).slice(-1)[0];
      out.push({ label: `Daily activities rated ${c.min}/10 or better`, met: !!p && p.score >= c.min, detail: p ? `latest ${p.score}/10` : 'not rated yet' });
    } else if (c.type === 'test') {
      const t = latest(c.test), v = t ? (t.value ?? (plan.injured ? t[plan.injured] : Math.max(t.L ?? -Infinity, t.R ?? -Infinity))) : null;
      const met = v != null && (c.op === '>=' ? v >= c.v : v <= c.v);
      out.push({ label: c.label, met, detail: v == null ? 'not tested yet' : `latest ${v}`, test: c.test });
    } else if (c.type === 'lsi') {
      const inj = plan.injured;
      const tests = (plan.tests || []).filter(t => t.test === c.test);
      let ratio = null;
      const two = [...tests].reverse().find(t => t.L != null && t.R != null);
      if (inj && two) ratio = Math.round((inj === 'L' ? two.L / two.R : two.R / two.L) * 100);
      else if (inj) {
        const a = [...tests].reverse().find(t => t.side === inj), b = [...tests].reverse().find(t => t.side && t.side !== inj);
        if (a && b && b.value) ratio = Math.round(a.value / b.value * 100);
      }
      out.push({ label: c.label, met: ratio != null && ratio >= c.min, detail: !inj ? 'set your injured side' : ratio == null ? 'test both sides' : `${ratio}%`, test: c.test });
    } else if (c.type === 'kneeTest') {
      const k = (plan.kneeTests || []).slice(-1)[0], v = k ? (plan.injured ? k[plan.injured] : Math.max(k.L ?? 0, k.R ?? 0)) : null;
      out.push({ label: c.label, met: v != null && v <= c.max, detail: v == null ? 'do the knee test' : `latest ${v}°` });
    }
  }
  return { items: out, allMet: out.every(i => i.met) };
}

/** PSFS score: mean of the 1–3 activities the person chose (0 = unable, 10 = as before injury). */
export const psfsScore = ratings => (ratings.length ? Math.round(ratings.reduce((s, v) => s + v, 0) / ratings.length * 10) / 10 : null);
