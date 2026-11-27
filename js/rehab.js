// Shred Rehab: evidence-informed rehabilitation exercise SUPPORT. Not diagnosis, not treatment, no clinician involved
// unless one uses clinician mode. Don't call it a clinic, care plan or treatment: see the 2026-11-27 compliance review.
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

// Emergency and same-day advice depends on where the person is. The owner is in the UAE, where 999 is
// police and 998 is the ambulance, and the NHS doesn't exist. Region comes from the device time zone
// and language; when unknown, the common numbers are listed rather than guessing one.
const US_ZONES = /^America\/(New_York|Chicago|Denver|Phoenix|Los_Angeles|Anchorage|Detroit|Indiana|Kentucky|Boise|Toronto|Vancouver|Edmonton|Winnipeg|Halifax)|^Pacific\/Honolulu/;
export function emergencyInfo({ timeZone, lang } = {}) {
  // Read the device only when the caller gives neither, so a caller (or test) can state a region exactly.
  if (timeZone === undefined && lang === undefined) {
    try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* no Intl */ }
    try { lang = globalThis.navigator?.language; } catch { /* no navigator */ }
  }
  const tz = timeZone || '', lg = lang || '';
  const doctorToday = 'Don\'t start this programme until you\'ve been checked.';
  if (tz === 'Asia/Dubai' || /-AE$/i.test(lg)) return { region: 'UAE', number: '998',
    text: 'Call 998 for an ambulance (999 is police), or go to the nearest emergency department. Don\'t exercise.',
    urgent: `See a doctor today: a same-day GP appointment or an urgent care clinic. ${doctorToday}`, numberNote: 'UAE ambulance. 999 is police.' };
  if (tz === 'Europe/London' || /-GB$/i.test(lg)) return { region: 'UK', number: '999',
    text: 'Call 999 or go to A&E. Don\'t exercise.',
    urgent: `Contact your GP for a same-day appointment, or NHS 111. ${doctorToday}`, numberNote: 'UK emergency number.' };
  if (US_ZONES.test(tz) || /-(US|CA)$/i.test(lg)) return { region: 'US', number: '911',
    text: 'Call 911 or go to the emergency room. Don\'t exercise.',
    urgent: `See a doctor today: your doctor or an urgent care clinic. ${doctorToday}`, numberNote: 'US and Canada emergency number.' };
  return { region: null, number: null,
    text: 'Call your local emergency number (998 ambulance in the UAE, 999 in the UK, 911 in the US, 112 in the EU) or go to an emergency department. Don\'t exercise.',
    urgent: `See a doctor today: a same-day appointment or an urgent care clinic. ${doctorToday}`, numberNote: '' };
}

export function flagAdvice(level, info = emergencyInfo()) {
  if (level === 'emergency') return { title: 'Get emergency help now', text: info.text, number: info.number, numberNote: info.numberNote };
  if (level === 'urgent') return { title: 'See a doctor today', text: info.urgent };
  return { title: 'Get assessed first', text: 'See a physiotherapist or doctor to confirm what\'s wrong before starting. Then ask them whether this programme suits you.' };
}
export const FLAG_ADVICE = Object.fromEntries(['emergency', 'urgent', 'assess'].map(l => [l, flagAdvice(l)]));

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
  return { light: 'green', advice: 'Pain stayed within your limit. Carry on, and progress when the phase checks are met.' };
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
    about: 'The shoulder capsule becomes inflamed then stiff. It goes through painful, stiff and thawing stages and often improves over 1–3 years, though some people keep some stiffness. More common with diabetes and thyroid problems.',
    evidence: 'Gentle stretching within tolerance in the painful stage, more stretching as it stiffens. Ask your doctor whether an injection suits you; manipulation or surgery is only considered if it isn\'t improving.',
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
    about: 'Overload of the tendon on the outside of the elbow from gripping and lifting with the wrist. It usually settles over months; gradual loading is the usual approach.',
    evidence: 'Education and progressive loading. Steroid injections helped short-term but did worse at 1 year than wait-and-see or physio (Bisset, BMJ 2006; review by Coombes, Lancet 2010).',
    phases: [
      P('Calm the tendon', 2, 'Isometric holds; reduce aggravating gripping.', [['isoWristExt', '5×45 s'], ['gripSqueeze', '3×10'], ['walk', 'daily']], [pain(5), psfs(5)]),
      P('Load the tendon', 4, 'Slow lowering strength for the wrist extensors.', [['eccWristExt', '3×15'], ['wristCurl', '3×15'], ['hammerCurl', '3×12 light'], ['gripSqueeze', '3×10']], [pain(4), psfs(7)]),
      P('Full grip strength', 3, 'Return to lifting and racket sport.', [['farmerCarry', '3×40 s'], ['dbRow', '3×10'], ['eccWristExt', '3×15 heavier'], ['pullUp', 'as able']], [pain(2), psfs(9)]),
    ] },
  { id: 'golfersElbow', name: 'Golfer\'s elbow', area: 'Elbow', flags: R.elbow, painLimit: 5, tests: [],
    about: 'Overload of the tendon on the inside of the elbow from gripping and wrist bending. Treated like tennis elbow, loading the wrist flexors instead.',
    evidence: 'Progressive tendon loading and education, as for tennis elbow.',
    phases: [
      P('Calm the tendon', 2, 'Isometric holds.', [['isoWristFlex', '5×45 s'], ['gripSqueeze', '3×10']], [pain(5), psfs(5)]),
      P('Load the tendon', 4, 'Slow lowering strength.', [['eccWristFlex', '3×15'], ['wristCurl', '3×15'], ['curl', '3×12 light']], [pain(4), psfs(7)]),
      P('Full strength', 3, 'Return to sport and lifting.', [['farmerCarry', '3×40 s'], ['chinUp', 'as able'], ['eccWristFlex', '3×15 heavier']], [pain(2), psfs(9)]),
    ] },
  { id: 'glutealTendon', name: 'Pain on the side of the hip (gluteal tendinopathy)', area: 'Hip', flags: R.hip, painLimit: 4, tests: [],
    about: 'Overload of the gluteal tendons on the side of the hip. Pressure positions make it worse: lying on that side, crossing your legs, standing hanging on one hip.',
    evidence: 'LEAP trial (BMJ 2018): education plus progressive exercise beat steroid injection and wait-and-see on overall improvement at 8 weeks and 1 year.',
    phases: [
      P('Offload and hold', 2, 'Avoid compression positions; isometric loading.', [['isoHipAbd', '5×45 s'], ['gluteBridge', '3×12'], ['walk', 'daily, flat']], [pain(4), psfs(5)]),
      P('Strengthen', 4, 'Progressive hip strength in standing.', [['sitToStand', '3×10'], ['stepUp', '3×10 each'], ['singleLegBridge', '3×10 each'], ['bandedWalk', '3×10 steps each way']], [pain(3), psfs(7)]),
      P('Full function', 4, 'Single-leg strength and return to running.', [['bulgarian', '3×8'], ['singleLegRdl', '3×8'], ['hipThrust', '3×10']], [pain(2), psfs(9)]),
    ] },
  { id: 'oa', name: 'Hip or knee osteoarthritis', area: 'Knee', flags: [...R.knee, ...R.hip], painLimit: 4, tests: ['chairStand30', 'kneeFlexion'],
    about: 'Joint changes that are very common with age. Pain doesn\'t always mean more damage. Guidelines recommend strengthening and staying active first.',
    evidence: 'NICE NG226 (2022): therapeutic exercise and weight management first-line. Arthroscopic washout is not recommended for osteoarthritis. The 2019 American College of Rheumatology/Arthritis Foundation guideline (Kolasinski et al., Arthritis Care Res 2020) strongly recommends exercise, and weight loss where relevant, for hip and knee osteoarthritis.',
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
    evidence: 'Progressive tendon loading: isometric, then heavy slow, then energy storage, then return to sport (Malliaras et al., JOSPT 2015). Some pain is OK if it settles within 24 hours.',
    phases: [
      P('Isometric loading', 2, 'Reduce pain with long holds.', [['spanishSquat', '5×45 s'], ['wallSit', '5×45 s'], ['calfRaise', '3×15']], [pain(5), psfs(5)]),
      P('Heavy slow strength', 4, 'Build tendon capacity (3 s down, 3 s up).', [['legPress', '4×8 heavy, slow'], ['declineSquat', '3×10'], ['legExtension', '3×10 slow'], ['bulgarian', '3×8']], [pain(4), psfs(7)]),
      P('Spring and return to sport', 4, 'Jumping, landing and sport-specific load.', [['jumpSquat', '3×6'], ['hopDrill', '3×20 s'], ['lunge', '3×10'], ['squat', '3×6 heavy']], [pain(3), psfs(9)]),
    ] },
  { id: 'acl', name: 'ACL injury or reconstruction', area: 'Knee', flags: R.knee, painLimit: 3, postOp: true, needsDate: true, tests: ['kneeExtension', 'kneeFlexion', 'hop', 'landingFPPA'],
    about: 'The ACL controls twisting of the knee. Rehab is long (9–12 months after surgery for sport). Strength, control and passing return-to-sport tests matter more than time alone.',
    evidence: 'Meeting return-to-sport criteria (hop and strength symmetry ≥90%) and waiting ≥9 months after surgery were linked with fewer re-injuries in a cohort study (Grindem, BJSM 2016). Neuromuscular warm-ups like FIFA 11+ have lowered injury rates in team-sport studies.',
    phases: [
      P('Swelling down, knee straight', 2, 'Full straightening, quad activation, walking without a limp.', [['quadSet', '5×10, several times daily'], ['heelSlide', '3×15'], ['straightLegRaise', '3×10'], ['terminalKneeExt', '3×15']], [pain(3), test('kneeExtension', '<=', 3, 'Knee straightens to within 3°'), test('kneeFlexion', '>=', 110, 'Knee bends 110°+')]),
      P('Strength and control', 6, 'Rebuild quad and hip strength; single-leg control.', [['legPress', '3×10'], ['gobletSquat', '3×10'], ['stepUp', '3×10'], ['singleLegBridge', '3×10'], ['singleLegBalance', '3×30 s'], ['calfRaise', '3×15']], [pain(2), test('kneeFlexion', '>=', 130, 'Knee bends 130°+'), { type: 'kneeTest', max: 10, label: 'Single-leg squat knee drift under 10°' }]),
      P('Running and power', 8, 'Start running, then jumping and landing.', [['bulgarian', '3×8'], ['singleLegRdl', '3×8'], ['nordic', '3×5'], ['jumpSquat', '3×6'], ['hopDrill', '3×20 s']], [pain(2), sym('hop', 80, 'Hop distance 80%+ of your other leg')]),
      P('Return to sport', 8, 'Pass return-to-sport tests; sport-specific training.', [['squat', '3×6 heavy'], ['lunge', '3×10'], ['burpee', '3×8'], ['hopDrill', '4×20 s']], [pain(1), { type: 'since', months: 9, label: 'At least 9 months since surgery (or injury, if no surgery)' }, sym('hop', 90, 'Hop distance 90%+ of your other leg'), test('landingFPPA', '<=', 10, 'Landing knee drift under 10°'), psfs(9)]),
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
    evidence: 'Exercise therapy matched arthroscopic partial meniscectomy for degenerative tears in middle-aged adults at 2 years (Kise et al., BMJ 2016). A knee that LOCKS needs assessment.',
    phases: [
      P('Settle and move', 2, 'Reduce swelling, restore movement.', [['quadSet', '3×10'], ['heelSlide', '3×15'], ['gluteBridge', '3×12'], ['walk', 'daily']], [pain(3), test('kneeExtension', '<=', 5, 'Knee straightens to within 5°')]),
      P('Strength', 4, 'Progressive leg strength.', [['sitToStand', '3×12'], ['stepUp', '3×10'], ['legPress', '3×10'], ['singleLegBalance', '3×30 s']], [pain(3), test('kneeFlexion', '>=', 125, 'Knee bends 125°+'), psfs(7)]),
      P('Full function', 4, 'Return to sport and full squatting.', [['gobletSquat', '3×10'], ['reverseLunge', '3×8'], ['hopDrill', '3×20 s']], [pain(2), psfs(9)]),
    ] },
  { id: 'hamstring', name: 'Hamstring strain', area: 'Thigh', flags: R.thigh, painLimit: 0, tests: [],
    about: 'A tear in the hamstring muscle, usually while sprinting or overstretching. Return is guided by pain-free strength and sprinting, not time alone.',
    evidence: 'Lengthening-focused rehab (Askling L-protocol) returned elite footballers to play faster than conventional rehab (Askling, BJSM 2013). Nordic curls roughly halve hamstring injuries (van Dyk, BJSM 2019).',
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
    about: 'Overstretching of the outer ankle ligaments. Early movement and balance training are the usual first steps.',
    evidence: 'Early weight-bearing and exercise; balance training reduced repeat sprains (Hupperets, BMJ 2009). Ottawa ankle rules decide whether an X-ray is needed.',
    phases: [
      P('Protect and move', 1, 'Walk as able, reduce swelling, regain movement.', [['ankleAlphabet', '2× daily'], ['calfStretch', '3×30 s'], ['calfRaise', '3×15 two legs'], ['walk', 'as able']], [pain(3), sym('ankleDorsiflexion', 85, 'Ankle bend 85%+ of the other side')]),
      P('Balance and strength', 2, 'Single-leg balance and calf strength.', [['singleLegBalance', '3×30 s, then eyes closed'], ['singleCalf', '3×12'], ['bandedWalk', '3×10 each way'], ['stepUp', '3×10']], [pain(2), sym('ankleDorsiflexion', 95, 'Ankle bend 95%+ of the other side')]),
      P('Hops and return to sport', 2, 'Hopping, cutting and sport drills.', [['hopDrill', '3×20 s'], ['lunge', '3×10'], ['jumpSquat', '3×6']], [pain(1), sym('hop', 90, 'Hop distance 90%+ of your other leg')]),
    ] },
  { id: 'plantarHeel', name: 'Heel pain (plantar fasciitis)', area: 'Ankle & foot', flags: R.ankle, painLimit: 4, tests: ['ankleDorsiflexion'],
    about: 'Pain under the heel, worst with the first steps in the morning. Usually settles with stretching, strength work, good footwear and load management.',
    evidence: 'Stretching, plus high-load strength (heel raises with a towel under the toes; Rathleff et al. 2015), supportive shoes or insoles, and weight management.',
    phases: [
      P('Settle', 2, 'Stretch and reduce aggravating load.', [['plantarStretch', '3×30 s, before first steps'], ['calfStretch', '3×30 s'], ['isoCalf', '5×30 s']], [pain(4), psfs(5)]),
      P('High-load strength', 4, 'Build foot and calf strength.', [['towelHeelRaise', '3×12 (3 s up, 2 s hold, 3 s down) every other day'], ['singleCalf', '3×12'], ['plantarStretch', 'daily']], [pain(3), psfs(7)]),
      P('Return to running', 4, 'Graded return to impact.', [['hopDrill', '3×20 s'], ['towelHeelRaise', '3×10 weighted'], ['walk', 'build time on feet']], [pain(2), psfs(9)]),
    ] },
  { id: 'shinSplints', name: 'Shin splints (medial tibial stress)', area: 'Shin', flags: R.shin, painLimit: 3, tests: ['calfRaiseEndurance'],
    about: 'Pain along the inner shin bone from running load the bone can\'t yet tolerate. Reduce running, build calf and hip strength, then return gradually.',
    evidence: 'Load management and graded return to running; calf and hip strengthening; increasing cadence 5–10% can reduce loading. Rule out a stress fracture (pinpoint bone pain).',
    phases: [
      P('Offload', 2, 'Cross-train without pain; strength.', [['calfRaise', '3×20'], ['seatedCalf', '3×15'], ['sideLyingAbd', '3×15'], ['walk', 'pain-free']], [pain(2), psfs(5)]),
      P('Strength', 3, 'Build calf and hip capacity.', [['singleCalf', '3×15'], ['stepUp', '3×10'], ['singleLegBalance', '3×30 s'], ['hopDrill', '2×15 s']], [pain(2), test('calfRaiseEndurance', '>=', 25, '25+ single-leg calf raises')]),
      P('Return to running', 4, 'Walk-run programme, 10% weekly increase, higher cadence.', [['hopDrill', '3×20 s'], ['singleCalf', '3×15 weighted'], ['bulgarian', '3×8']], [pain(1), psfs(9)]),
    ] },
];

// ---------------- Programmes from the camera movement check ----------------
// For people who don't know what's wrong. They target what was MEASURED (range, side-to-side difference,
// strength), never a diagnosis, and a physio can switch the person to a named programme once confirmed.
const CHECK_ABOUT = part => `Built from your movement check. It works on what was measured in your ${part}, not on a diagnosis. If a physio or doctor confirms what it is, they can switch you to that programme.`;
CONDITIONS.push(
  { id: 'kneeCheck', general: true, name: 'Knee pain (movement check)', area: 'Knee', flags: R.knee, painLimit: 3, tests: ['kneeFlexion', 'kneeExtension', 'chairStand30'],
    about: CHECK_ABOUT('knee'),
    evidence: 'Exercise is the first approach in guidelines for common causes of knee pain (NICE NG226 for osteoarthritis; Crossley et al., BJSM 2016 for pain at the front of the knee). Your goals come from your own measurements.',
    phases: [
      P('Settle and get it moving', 2, 'Calm it down and move it more.', [['quadSet', '3×10'], ['heelSlide', '3×15'], ['gluteBridge', '3×12'], ['walk', '10–30 min daily']], [pain(3), psfs(5)]),
      P('Strength and control', 3, 'Leg strength and knee control.', [['sitToStand', '3×10'], ['stepUp', '3×10'], ['wallSit', '4×30 s'], ['singleLegBalance', '3×30 s'], ['clamshell', '3×15']], [pain(3), psfs(7)]),
      P('Back to full activity', 3, 'Single-leg strength for daily life and sport.', [['gobletSquat', '3×10'], ['reverseLunge', '3×8'], ['stepDown', '3×8'], ['singleLegRdl', '3×8']], [pain(2), psfs(9)]),
    ] },
  { id: 'shoulderCheck', general: true, name: 'Shoulder pain (movement check)', area: 'Shoulder', flags: R.shoulder, painLimit: 3, tests: ['shoulderFlexion', 'shoulderAbduction'],
    about: CHECK_ABOUT('shoulder'),
    evidence: 'Progressive strengthening is the usual first approach for shoulder pain without a recent injury. Your goals come from your own measurements.',
    phases: [
      P('Settle and keep moving', 2, 'Keep the movement you have without flaring it.', [['pendulum', '1–2 min'], ['isoER', '5×30 s'], ['tableSlide', '2×10'], ['walk', 'daily']], [pain(3), psfs(5)]),
      P('Strength', 3, 'Rotator cuff and shoulder blade strength.', [['bandER', '3×15'], ['wallSlide', '3×10'], ['cableRow', '3×12'], ['lateralRaise', '3×12 light']], [pain(3), psfs(7)]),
      P('Overhead and full use', 3, 'Pressing and full use of the arm.', [['dbShoulderPress', '3×10'], ['facePull', '3×15'], ['pushUp', '3×10']], [pain(2), psfs(9)]),
    ] },
  { id: 'ankleCheck', general: true, name: 'Ankle or foot pain (movement check)', area: 'Ankle & foot', flags: R.ankle, painLimit: 3, tests: ['ankleDorsiflexion'],
    about: CHECK_ABOUT('ankle'),
    evidence: 'Early movement, calf strength and balance training are the usual first steps for ankle problems (Hupperets, BMJ 2009, for balance training after a sprain). Your goals come from your own measurements.',
    phases: [
      P('Settle and move', 1, 'Regain movement and walk as able.', [['ankleAlphabet', '2× daily'], ['calfStretch', '3×30 s'], ['calfRaise', '3×15 two legs'], ['walk', 'as able']], [pain(3), psfs(5)]),
      P('Balance and strength', 2, 'Single-leg balance and calf strength.', [['singleLegBalance', '3×30 s'], ['singleCalf', '3×12'], ['stepUp', '3×10'], ['bandedWalk', '3×10 each way']], [pain(2), psfs(7)]),
      P('Hops and full activity', 2, 'Hopping and sport movements.', [['hopDrill', '3×20 s'], ['lunge', '3×10'], ['singleCalf', '3×15 weighted']], [pain(1), psfs(9)]),
    ] },
  { id: 'hipCheck', general: true, name: 'Hip pain (movement check)', area: 'Hip', flags: R.hip, painLimit: 3, tests: ['chairStand30'],
    about: CHECK_ABOUT('hip'),
    evidence: 'Exercise is the first approach in guidelines for common causes of hip pain (NICE NG226 for osteoarthritis; LEAP trial, BMJ 2018, for pain on the side of the hip). Your goals come from your own measurements.',
    phases: [
      P('Settle and activate', 2, 'Gentle hip strength and daily walking.', [['gluteBridge', '3×12'], ['isoHipAbd', '5×30 s'], ['walk', 'daily']], [pain(3), psfs(5)]),
      P('Strength', 3, 'Progressive hip strength in standing.', [['sitToStand', '3×10'], ['stepUp', '3×10'], ['bandedWalk', '3×10 steps each way'], ['clamshell', '3×15']], [pain(3), psfs(7)]),
      P('Full function', 3, 'Single-leg strength.', [['bulgarian', '3×8'], ['singleLegRdl', '3×8'], ['gobletSquat', '3×10']], [pain(2), psfs(9)]),
    ] },
);

/** Camera movement check per body area: about 1–2 minutes of recording. Empty = no reliable camera test. */
const SCREENS = {
  Knee: [['kneeFlexion', 'L'], ['kneeFlexion', 'R'], ['kneeExtension', 'L'], ['kneeExtension', 'R'], ['chairStand30']],
  Shoulder: [['shoulderAbduction'], ['shoulderFlexion', 'L'], ['shoulderFlexion', 'R']],
  'Lower back': [['trunkFlexion'], ['trunkExtension']],
  'Ankle & foot': [['ankleDorsiflexion', 'L'], ['ankleDorsiflexion', 'R']],
  Hip: [['chairStand30']],
};
export const screenQueue = area => (SCREENS[area] || []).map(([test, side]) => ({ test, side: side || null }));
export const screenConditionFor = area => ({ Knee: 'kneeCheck', Shoulder: 'shoulderCheck', 'Lower back': 'lbp', Neck: 'neck', 'Ankle & foot': 'ankleCheck', Hip: 'hipCheck' })[area] || null;

// How each measurement is described and judged. target = typical full range; baseline = recorded, not judged.
const META = {
  kneeFlexion: { part: 'knee', verb: 'bend', higher: true, target: 130, norm: '135°+ is a full bend' },
  kneeExtension: { part: 'knee', verb: 'straightening', higher: false, target: 3, norm: 'fully straight is 0°' },
  shoulderFlexion: { part: 'shoulder', verb: 'forward raise', higher: true, target: 160, norm: '160–180° is typical' },
  shoulderAbduction: { part: 'shoulder', verb: 'side raise', higher: true, target: 160, norm: '160–180° is typical' },
  ankleDorsiflexion: { part: 'ankle', verb: 'bend', higher: true, target: null, norm: 'compare sides' },
  trunkExtension: { part: 'back', verb: 'backward bend', higher: true, target: 20, norm: 'about 20–30° is typical' },
  trunkFlexion: { baseline: 'forward bend', unit: '°' },
  chairStand30: { baseline: 'sit-to-stands in 30 seconds', unit: '' },
};
const SIDE = { L: 'left', R: 'right' };
const cap = s => s[0].toUpperCase() + s.slice(1);

/**
 * Turn movement-check results into plain findings. Each deficit carries a goal (criterion) for the
 * affected side. Findings describe what was measured; they never name a condition.
 */
export function screenFindings(results) {
  const by = {};
  for (const r of results) {
    const m = (by[r.test] ||= {});
    for (const s of ['L', 'R']) { const v = sideValue(r, s); if (v != null) m[s] = v; }
    if (!r.side && r.value != null && r.L == null && r.R == null) m.value = r.value;
  }
  const out = [];
  // A movement the person couldn't do is information too, not a failed recording.
  for (const r of results.filter(x => x.skipped)) {
    const name = (TEST_NAMES[r.test] || [r.test])[0], where = r.side ? ` (${SIDE[r.side]})` : '';
    out.push({ test: r.test, side: r.side || null, skipped: true, reason: r.reason || 'cant', criterion: null,
      text: r.reason === 'pain' ? `${name}${where}: too painful to do. Worth showing a physio.` : `${name}${where}: couldn't get into position or do the movement. You'll retry it as you improve.` });
  }
  for (const [test, v] of Object.entries(by)) {
    const k = META[test]; if (!k) continue;
    if (k.baseline) { const val = v.value ?? v.L ?? v.R; if (val != null) out.push({ test, text: `Baseline ${k.baseline}: ${val}${k.unit}. You'll retest this.`, criterion: null }); continue; }
    const deg = x => `${Math.round(x)}°`;
    if (v.L != null && v.R != null) {
      const [worse, better] = k.higher ? (v.L <= v.R ? ['L', 'R'] : ['R', 'L']) : (v.L >= v.R ? ['L', 'R'] : ['R', 'L']);
      const W = cap(SIDE[worse]);
      if (k.higher && v[worse] / v[better] < 0.9) {
        const pct = Math.round((1 - v[worse] / v[better]) * 100);
        out.push({ test, side: worse, text: `${W} ${k.part} ${k.verb}: ${deg(v[worse])}, ${pct}% less than your ${SIDE[better]} (${deg(v[better])}).`,
          criterion: { type: 'lsi', test, min: 90, side: worse, label: `${W} ${k.part} ${k.verb} within 10% of your ${SIDE[better]}` } });
      } else if (!k.higher && v[worse] - v[better] >= 5) {
        out.push({ test, side: worse, text: `${W} ${k.part} stops ${deg(v[worse])} short of straight; your ${SIDE[better]} gets to within ${deg(v[better])}.`,
          criterion: { type: 'test', test, op: '<=', v: Math.max(3, Math.round(v[better]) + 2), side: worse, label: `${W} ${k.part} straightens to within ${Math.max(3, Math.round(v[better]) + 2)}°` } });
      } else if (k.target != null && (k.higher ? Math.max(v.L, v.R) < k.target : Math.min(v.L, v.R) > k.target)) {
        out.push({ test, side: 'both', text: `Both ${k.part}s are short of the typical range (${deg(v.L)} left, ${deg(v.R)} right; ${k.norm}).`,
          criterion: { type: 'test', test, op: k.higher ? '>=' : '<=', v: k.target, side: 'both', label: `Both ${k.part}s ${k.verb} ${k.higher ? `${k.target}°+` : `within ${k.target}°`}` } });
      } else out.push({ test, text: `${cap(k.part)} ${k.verb}: ${deg(v.L)} left, ${deg(v.R)} right. Even, and within range.`, criterion: null });
    } else {
      const s = v.L != null ? 'L' : v.R != null ? 'R' : null, val = s ? v[s] : v.value;
      if (val == null) continue;
      const short = k.target != null && (k.higher ? val < k.target : val > k.target);
      const who = s ? `${cap(SIDE[s])} ${k.part}` : `Your ${k.part}`;
      out.push({ test, side: s || 'both', text: `${who} ${k.verb}: ${deg(val)}${short ? ` (${k.norm})` : ', within the typical range'}.`,
        criterion: short ? { type: 'test', test, op: k.higher ? '>=' : '<=', v: k.target, side: s || 'both', label: `${who} ${k.verb} ${k.higher ? `${k.target}°+` : `within ${k.target}°`}` } : null });
    }
  }
  return out;
}

/**
 * How the movement check changes the start. Anything not done → gentle start. A test too painful to do, or 2+
 * tests not done → advise a physio assessment (the programme can still start gently in phase 1).
 */
export function screenAdjust(results) {
  const skipped = results.filter(r => r.skipped), pain = skipped.filter(r => r.reason === 'pain');
  const reasons = [];
  if (pain.length) reasons.push(`${pain.length} movement${pain.length > 1 ? 's were' : ' was'} too painful to do.`);
  if (skipped.length - pain.length) reasons.push(`${skipped.length - pain.length} movement${skipped.length - pain.length > 1 ? 's' : ''} couldn't be done.`);
  return { gentle: skipped.length > 0, physioAdvised: pain.length >= 1 || skipped.length >= 2, reasons };
}

/** The side the deficits are on, when they all point to one side. */
export function affectedSide(findings) {
  const sides = new Set(findings.filter(f => f.criterion && (f.side === 'L' || f.side === 'R')).map(f => f.side));
  return sides.size === 1 ? [...sides][0] : null;
}

/** Measured goals become extra checks at the end of the strength phase (phase 2), before full activity. */
export const screenCriteria = findings => ({ 1: findings.filter(f => f.criterion).map(f => f.criterion) });

export const AREAS = ['Lower back', 'Neck', 'Shoulder', 'Elbow', 'Hip', 'Knee', 'Thigh', 'Ankle & foot', 'Shin'];
export const COND = Object.fromEntries(CONDITIONS.map(c => [c.id, c]));

// ---------------- Progress logic ----------------
/**
 * Evaluate a phase's criteria against the plan's data. Returns [{label, met, detail}] and allMet.
 * plan: { startedAt, phaseStartedAt, checkins:[{at,during,after,nextMorning}], tests:[{at,test,side,value,L,R}],
 *         psfs:[{at, score}], kneeTests:[{at, L, R}], injured: 'L'|'R'|null }
 */
const DAY = 864e5;
const dayKey = at => { const d = new Date(at); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };

/**
 * One record per calendar day: the WORST pain of that day, and its next-morning answer if any was given.
 * Several check-ins on one day count once, so tapping "check in" three times can't pass a 3-session rule.
 */
export function checkinDays(checkins = [], since = 0) {
  const by = new Map();
  for (const k of checkins) {
    if (k.at < since) continue;
    const key = dayKey(k.at), d = by.get(key);
    if (!d) { by.set(key, { ...k }); continue; }
    d.at = Math.max(d.at, k.at);
    d.during = Math.max(d.during, k.during);
    if (k.after != null) d.after = Math.max(d.after ?? 0, k.after);
    if (k.nextMorning != null) d.nextMorning = Math.max(d.nextMorning ?? 0, k.nextMorning);
  }
  return [...by.values()].sort((a, b) => a.at - b.at);
}

/** A side's value from a test record: an L/R pair, or a single-side result. */
const sideValue = (t, s) => (t[s] != null ? t[s] : t.side === s ? t.value : null);

/**
 * The value that decides a "test" criterion.
 * Injured side known: only that side's results count (the healthy side can't pass it for you).
 * Both sides or not a limb: the worse of the latest left, right and no-side results.
 */
function criterionValue(tests, testId, injured, op) {
  const mine = [...tests].reverse().filter(t => t.test === testId);
  if (injured) { const t = mine.find(x => sideValue(x, injured) != null); return t ? sideValue(t, injured) : null; }
  const vals = [
    mine.find(x => sideValue(x, 'L') != null), mine.find(x => sideValue(x, 'R') != null), mine.find(x => !x.side && x.value != null),
  ].map((t, i) => (t ? (i === 0 ? sideValue(t, 'L') : i === 1 ? sideValue(t, 'R') : t.value) : null)).filter(v => v != null);
  if (!vals.length) return null;
  return op === '>=' ? Math.min(...vals) : Math.max(...vals);
}

/** Two flare-up (red) sessions in a row in this phase: stop progressing and get a physio to review the plan. */
export function needsReview(cond, plan) {
  const days = checkinDays(plan.checkins, plan.phaseStartedAt || 0).slice(-2);
  const limit = plan.painLimit ?? cond.painLimit;
  return days.length === 2 && days.every(k => painLight({ ...k, usualMorning: plan.usualMorning ?? null }, limit).light === 'red');
}

export function evaluatePhase(cond, phaseIdx, plan, now = Date.now()) {
  const phase = cond.phases[phaseIdx], out = [];
  const weeks = (now - (plan.phaseStartedAt || plan.startedAt)) / (7 * DAY);
  out.push({ label: `At least ${phase.minWeeks} week${phase.minWeeks > 1 ? 's' : ''} in this phase`, met: weeks >= phase.minWeeks, detail: `${Math.floor(weeks * 7)} days so far` });
  const recent = checkinDays(plan.checkins, plan.phaseStartedAt || 0).slice(-3);
  const tests = plan.tests || [];
  // Goals from the movement check (plan.extraCriteria) are added to the phase they belong to.
  for (const c of [...phase.criteria, ...((plan.extraCriteria || {})[phaseIdx] || [])]) {
    // A goal can name its own side ('L', 'R', or 'both' = the worse of the two); otherwise the injured side.
    const side = c.side === 'both' ? null : (c.side ?? plan.injured);
    if (c.type === 'pain') {
      // The care plan can lower the limit (high irritability); it never raises it.
      const max = Math.min(c.max, plan.painLimit ?? Infinity);
      const noMorning = recent.filter(r => r.nextMorning == null).length;
      const ok = recent.length >= 3 && !noMorning && recent.every(r => r.during <= max && r.nextMorning <= Math.max(max, 1));
      out.push({ label: max === 0 ? 'Pain-free during exercise (last 3 session days)' : `Pain ${max}/10 or less during exercise (last 3 session days)`, met: ok,
        detail: recent.length < 3 ? `${recent.length}/3 days checked in` : noMorning ? `${noMorning} morning check${noMorning > 1 ? 's' : ''} missing` : recent.map(r => r.during).join(', ') });
    } else if (c.type === 'since') {
      const from = plan.surgeryAt ?? plan.injuryAt ?? null, months = from != null ? (now - from) / (30.44 * DAY) : null;
      out.push({ label: c.label, met: months != null && months >= c.months, detail: months == null ? 'add your surgery or injury date' : `${Math.floor(months)} months so far` });
    } else if (c.type === 'psfs') {
      const p = (plan.psfs || []).slice(-1)[0];
      out.push({ label: `Daily activities rated ${c.min}/10 or better`, met: !!p && p.score >= c.min, detail: p ? `latest ${p.score}/10` : 'not rated yet' });
    } else if (c.type === 'test') {
      const v = criterionValue(tests, c.test, side, c.op);
      const met = v != null && (c.op === '>=' ? v >= c.v : v <= c.v);
      out.push({ label: c.label, met, detail: v == null ? (side ? `test your ${side === 'L' ? 'left' : 'right'} side` : 'not tested yet') : `latest ${v}`, test: c.test });
    } else if (c.type === 'lsi') {
      const inj = side;
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
  if (needsReview(cond, plan)) out.push({ label: 'Physio review after 2 flare-ups in a row', met: false, detail: 'ease off and get your plan reviewed', review: true });
  return { items: out, allMet: out.every(i => i.met) };
}

// ---------------- Clinic intake (the first appointment) ----------------
/**
 * Irritability is how clinicians decide how hard to start: how severe the pain is, whether it is there at
 * rest or at night, and how long it takes to settle after activity. It sets the starting dose and pain
 * limit. It never skips a phase: every patient starts at phase 1 and moves on by passing its checks.
 * answers: { restPain 0–10, worstPain 0–10, settle: 'minutes'|'hours'|'nextDay', nightPain, duration:
 *            'acute'|'subacute'|'persistent', goal: 'daily'|'gym'|'sport', daysAvailable 0–7 }
 */
export function consult(a) {
  const reasons = [], warnings = [];
  let irritability = 'moderate';
  if (a.restPain >= 6 || a.settle === 'nextDay' || (a.nightPain && a.worstPain >= 6)) {
    irritability = 'high';
    if (a.restPain >= 6) reasons.push(`Pain at rest is ${a.restPain}/10.`);
    if (a.settle === 'nextDay') reasons.push('Pain from activity lasts until the next day.');
    if (a.nightPain && a.worstPain >= 6) reasons.push('Strong pain that also disturbs your sleep.');
  } else if (a.worstPain <= 3 && a.settle === 'minutes' && !a.nightPain && a.restPain <= 2) {
    irritability = 'low';
    reasons.push('Mild pain that settles within minutes and doesn\'t wake you.');
  } else {
    reasons.push(a.settle === 'hours' ? 'Pain settles within hours after activity.' : `Worst pain is ${a.worstPain}/10.`);
  }
  const days = Math.max(0, Math.min(7, a.daysAvailable ?? 3));
  const sessionsPerWeek = Math.min(5, Math.max(2, days));
  if (days < 2) warnings.push('Most strength guidelines suggest at least 2 sessions a week. Try to find a second day.');
  if (a.duration === 'persistent') warnings.push('Pain lasting over 3 months is common and can still improve with graded exercise. Progress is usually steady rather than fast.');
  return { irritability, reasons, warnings, sessionsPerWeek, duration: a.duration, goal: a.goal, answers: a };
}

/** Starting dose: a gentle start takes one set off each exercise; everything else is as prescribed. */
export function dose(text, level) {
  if (level !== 'gentle') return text;
  return text.replace(/^(\d+)×/, (m, n) => (+n >= 2 ? `${+n - 1}×` : m));
}

const IRRIT_TEXT = {
  high: 'Your pain is easily stirred up, so we start gently: one set fewer on each exercise and a lower pain limit.',
  moderate: 'Your pain is moderate, so you start at the standard dose for phase 1.',
  low: 'Your pain settles quickly, so you start at the standard dose and can keep other training going if it stays within your limit.',
};
const GOAL_TEXT = { daily: 'everyday activities', gym: 'training in the gym', sport: 'your sport' };

/** The care plan the "clinic" hands over after the first appointment. Times are minimums, never promises. */
export function carePlan(cond, c) {
  const minWeeks = cond.phases.reduce((s, p) => s + p.minWeeks, 0);
  return {
    irritability: c.irritability, doseLevel: c.irritability === 'high' ? 'gentle' : 'standard',
    painLimit: Math.max(0, cond.painLimit - (c.irritability === 'high' ? 1 : 0)),
    sessionsPerWeek: c.sessionsPerWeek, reassessEveryDays: 7,
    summary: IRRIT_TEXT[c.irritability],
    goal: `Goal: back to ${GOAL_TEXT[c.goal] || GOAL_TEXT.daily}.`,
    expect: `${cond.phases.length} phases, at least ${minWeeks} weeks in total. You move to the next phase when you pass its checks, so it can take longer, and stepping back a phase is normal.${cond.needsDate ? ' Return to sport also needs at least 9 months since surgery or injury.' : ''}`,
    reasons: c.reasons, warnings: c.warnings,
  };
}

/** PSFS score: mean of the 1–3 activities the person chose (0 = unable, 10 = as before injury). */
export const psfsScore = ratings => (ratings.length ? Math.round(ratings.reduce((s, v) => s + v, 0) / ratings.length * 10) / 10 : null);

// ---------------- Clinician mode (on the patient's phone, unlocked by the physio's PIN) ----------------
// No server: the physio uses the patient's phone at the visit. Every action is written to the programme
// log with the clinician's name, so the shared report shows who changed what. This deters, but can't
// prove, tampering: anyone holding the phone can reset clinician access, and the reset is logged too.
const LOCK_AFTER = 5, LOCK_MS = 10 * 60e3;
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const sha256 = async text => hex(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));

export async function clinicianSetup({ name, role, licence = '', pin }) {
  if (!name || !String(name).trim()) throw new Error('Enter the clinician\'s name.');
  if (!/^\d{4,8}$/.test(String(pin))) throw new Error('The PIN must be 4 to 8 digits.');
  const salt = hex(globalThis.crypto.getRandomValues(new Uint8Array(16)));
  return { name: String(name).trim(), role: role || 'Physiotherapist', licence: String(licence).trim(), salt, pinHash: await sha256(`${salt}:${pin}`), fails: 0, lockedUntil: 0 };
}

/** Check a PIN. 5 wrong tries lock clinician access for 10 minutes. Mutates the record's counters. */
export async function verifyPin(rec, pin, now = Date.now()) {
  if (rec.lockedUntil > now) return { ok: false, lockedFor: rec.lockedUntil - now };
  if (await sha256(`${rec.salt}:${pin}`) === rec.pinHash) { rec.fails = 0; return { ok: true }; }
  rec.fails = (rec.fails || 0) + 1;
  if (rec.fails >= LOCK_AFTER) { rec.fails = 0; rec.lockedUntil = now + LOCK_MS; return { ok: false, lockedFor: LOCK_MS }; }
  return { ok: false, triesLeft: LOCK_AFTER - rec.fails };
}

const logBy = (p, who, text, now) => (p.notes ||= []).push({ at: now, by: who.name, text: `${who.name} (${who.role}): ${text}` });

/** Apply one clinician action to a plan, and log it under the clinician's name. */
export function applyClinician(p, a, who, now = Date.now()) {
  const c = () => COND[p.cond];
  if (a.type === 'diagnose') {
    const nc = COND[a.cond]; if (!nc) throw new Error('Unknown condition');
    p.cond = a.cond; p.phase = Math.max(0, Math.min(nc.phases.length - 1, a.phase ?? 0)); p.phaseStartedAt = now;
    p.diagnosed = true; p.confirmedBy = who.name;
    p.painLimit = Math.max(0, nc.painLimit - (p.doseLevel === 'gentle' ? 1 : 0));
    logBy(p, who, `confirmed ${nc.name}. Switched to that programme at phase ${p.phase + 1}; measurements and check-ins kept.`, now);
  } else if (a.type === 'setPhase') {
    if (!a.reason || !String(a.reason).trim()) throw new Error('Give a reason for changing the phase.');
    p.phase = Math.max(0, Math.min(c().phases.length - 1, a.phase)); p.phaseStartedAt = now;
    logBy(p, who, `set phase ${p.phase + 1} (${c().phases[p.phase].name}). Reason: ${String(a.reason).trim()}`, now);
  } else if (a.type === 'dose') {
    if (a.doseLevel) p.doseLevel = a.doseLevel === 'gentle' ? 'gentle' : 'standard';
    if (a.painLimit != null) p.painLimit = Math.max(0, Math.min(10, Math.round(a.painLimit)));
    logBy(p, who, `set ${p.doseLevel === 'gentle' ? 'gentle' : 'standard'} dose, pain limit ${p.painLimit}/10.`, now);
  } else if (a.type === 'requireApproval') {
    p.requireApproval = !!a.on;
    logBy(p, who, a.on ? 'phase changes now need clinician approval.' : 'the patient can move phases when the checks are met.', now);
  } else if (a.type === 'dates') {
    if (a.surgeryAt == null && a.injuryAt == null) throw new Error('Enter a surgery or injury date.');
    if (a.surgeryAt != null) p.surgeryAt = a.surgeryAt;
    if (a.injuryAt != null) p.injuryAt = a.injuryAt;
    logBy(p, who, `recorded ${a.surgeryAt != null ? `surgery ${new Date(a.surgeryAt).toDateString()}` : `injury ${new Date(a.injuryAt).toDateString()}`}.`, now);
  } else if (a.type === 'review') {
    p.nextReviewAt = a.at; logBy(p, who, `next review ${new Date(a.at).toDateString()}.`, now);
  } else if (a.type === 'note') {
    if (!a.text || !String(a.text).trim()) throw new Error('Write a note first.');
    logBy(p, who, String(a.text).trim(), now);
  } else throw new Error('Unknown action ' + a.type);
  return p;
}

/**
 * Why the patient can't move on yet, beyond the phase checks, or null.
 * A named programme the person picked themselves (no diagnosis) stays in phase 1: picking from a list is
 * self-diagnosis. Movement-check programmes and non-specific back and neck pain are not capped.
 */
export function advanceBlock(p) {
  if (p.requireApproval) return 'Your clinician approves phase changes. Show them your results at your next visit.';
  const c = COND[p.cond];
  if (p.physioAdvised && !p.diagnosed && p.phase === 0) return 'Some movements in your check were too painful or couldn\'t be done, so the programme stays in phase 1 until a physio has assessed you.';
  if (!p.diagnosed && c && !c.general && !['lbp', 'neck'].includes(c.id) && p.phase === 0) return 'You picked this condition yourself, so the programme stays in phase 1 until a physio or doctor confirms it.';
  return null;
}
export const canAdvance = (p, ev) => !!ev.allMet && !advanceBlock(p);

// ---------------- Shareable report ----------------
const TEST_NAMES = { kneeFlexion: ['Knee bend', '°', true], kneeExtension: ['Knee short of straight', '°', false], shoulderFlexion: ['Shoulder forward raise', '°', true],
  shoulderAbduction: ['Shoulder side raise', '°', true], trunkFlexion: ['Forward bend', '°', true], trunkExtension: ['Backward bend', '°', true],
  ankleDorsiflexion: ['Ankle bend (knee to wall)', '°', true], chairStand30: ['30-s sit-to-stand', ' reps', true], calfRaiseEndurance: ['Single-leg calf raises', ' reps', true],
  hop: ['Single-leg hop', ' cm', true], landingFPPA: ['Landing knee drift', '°', false] };

/** Everything a physio needs on one page, from the patient's own records. */
export function reportData(p, profile = {}, now = Date.now()) {
  const c = COND[p.cond], inj = p.injured, other = inj === 'L' ? 'R' : inj === 'R' ? 'L' : null;
  const measurements = [];
  for (const test of [...new Set((p.tests || []).map(t => t.test))]) {
    const [name, unit, higher] = TEST_NAMES[test] || [test, '', true];
    const rows = (p.tests || []).filter(t => t.test === test);
    const sides = inj ? [inj] : ['L', 'R', null];
    for (const s of sides) {
      const vals = rows.map(t => (s ? sideValue(t, s) : (!t.side && t.L == null && t.R == null ? t.value : null))).filter(v => v != null);
      if (!vals.length) continue;
      const opp = s === inj ? other : s === 'L' ? 'R' : s === 'R' ? 'L' : null;
      const ov = opp ? rows.map(t => sideValue(t, opp)).filter(v => v != null).slice(-1)[0] ?? null : null;
      const latest = vals[vals.length - 1];
      const lsi = ov && latest ? Math.round((higher ? latest / ov : ov / latest) * 100) : null;
      measurements.push({ test, name, unit, side: s, first: vals[0], latest, other: ov, lsi });
    }
  }
  const days = checkinDays(p.checkins || []);
  const limit = p.painLimit ?? c.painLimit;
  const ps = p.psfs || [];
  return {
    name: profile.name || '', condition: c.name, general: !!c.general, diagnosed: !!p.diagnosed, confirmedBy: p.confirmedBy || null,
    phase: p.phase + 1, phases: c.phases.length, phaseName: c.phases[p.phase].name, startedAt: p.startedAt, surgeryAt: p.surgeryAt ?? null, injuryAt: p.injuryAt ?? null,
    injured: inj, painLimit: limit, doseLevel: p.doseLevel || 'standard', requireApproval: !!p.requireApproval,
    measurements, painDays: days.slice(-7).map(d => ({ at: d.at, during: d.during, nextMorning: d.nextMorning ?? null })),
    flareUps: days.filter(d => painLight({ ...d, usualMorning: p.usualMorning ?? null }, limit).light === 'red').length,
    psfs: ps.length ? { first: ps[0].score, latest: ps[ps.length - 1].score, activities: p.acts || [] } : null,
    findings: p.findings || [], notes: (p.notes || []).slice(-15), generatedAt: now,
  };
}

const d8 = at => new Date(at).toISOString().slice(0, 10);
export const REPORT_DISCLAIMER = 'Made by the Shred app from the patient\'s own entries and phone-camera estimates. It is not a diagnosis, and camera angles are estimates, not clinical measurements.';

/** Plain-text version of the report, for sharing in a message. */
export function reportText(d) {
  const L = [];
  L.push(`Rehab progress report${d.name ? ` · ${d.name}` : ''} · ${d8(d.generatedAt)}`);
  L.push(`Programme: ${d.condition}${d.diagnosed ? (d.confirmedBy ? ` (confirmed by ${d.confirmedBy})` : ' (patient reports a diagnosis)') : d.general ? ' (from the movement check, no diagnosis)' : ' (picked by the patient, not confirmed)'}`);
  L.push(`Phase ${d.phase} of ${d.phases}: ${d.phaseName} · started ${d8(d.startedAt)}${d.surgeryAt ? ` · surgery ${d8(d.surgeryAt)}` : d.injuryAt ? ` · injury ${d8(d.injuryAt)}` : ''}`);
  L.push(`Side: ${d.injured === 'L' ? 'left' : d.injured === 'R' ? 'right' : 'both / not a limb'} · pain limit ${d.painLimit}/10 · ${d.doseLevel} dose${d.requireApproval ? ' · phase changes need clinician approval' : ''}`);
  if (d.findings.length) { L.push('', 'Movement check (start):'); d.findings.forEach(f => L.push(`- ${f.text}`)); }
  if (d.measurements.length) {
    L.push('', 'Measurements (first → latest):');
    d.measurements.forEach(m => L.push(`- ${m.name}${m.side ? ` (${m.side === 'L' ? 'left' : 'right'})` : ''}: ${m.first}${m.unit} → ${m.latest}${m.unit}${m.other != null ? ` · other side ${m.other}${m.unit}` : ''}${m.lsi != null ? ` · ${m.lsi}% of other side` : ''}`));
  }
  if (d.painDays.length) L.push('', `Pain during exercise, last ${d.painDays.length} session days: ${d.painDays.map(x => x.during).join(', ')} · flare-ups so far: ${d.flareUps}`);
  if (d.psfs) L.push(`Daily activities (0–10): ${d.psfs.first} → ${d.psfs.latest}${d.psfs.activities.length ? ` (${d.psfs.activities.join(', ')})` : ''}`);
  if (d.notes.length) { L.push('', 'Programme log:'); d.notes.forEach(n => L.push(`- ${d8(n.at)} ${n.text}`)); }
  L.push('', d.REPORT_DISCLAIMER || REPORT_DISCLAIMER);
  return L.join('\n');
}
