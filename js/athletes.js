// Athlete section: sport → position/style → season phase → a gym programme built from sport science.
// Every role lists the exercises its research brief recommends (SCIENCE.md, "Athletes"), grouped as:
//   power (explosive work), strength (main lifts), trunk (rotation and anti-rotation), protect
//   (injury prevention that runs all year) and condition (energy-system work that matches the sport).
// The generator turns a role into the same program shape as programs.js, so QK's weights, the Today
// plan, workout mode, warm-ups, the monthly refresh and swaps all work unchanged.
// Where research is thin, the role says so in `gaps`; the app shows it rather than overclaiming.

const role = (id, name, desc, picks, extra = {}) => ({ id, name, desc, ...picks, ...extra });

export const SPORTS = [
  {
    id: 'cricket', name: 'Cricket', icon: '🏏',
    intro: 'Hamstring strains are the most common cricket injury; lumbar stress fractures in young fast bowlers are the most serious.',
    protect: ['nordic', 'copenhagen'],
    roles: [
      role('fastSide', 'Fast bowler: side-on action', 'Hips and shoulders both closed at back-foot contact. Pace comes from hip–shoulder separation and a braced front leg.',
        { power: ['jumpSquat', 'yMedicineBallScoopThrow'], strength: ['trapBarDeadlift', 'bulgarian', 'singleLegRdl'], trunk: ['pallof', 'backExtHold'], protect: ['dropStick', 'pronYTW'], condition: 'runSprints' },
        { why: 'Faster bowlers have more relative strength (mid-thigh pull) and jump height.' }),
      role('fastFront', 'Fast bowler: front-on action', 'Hips and shoulders both open. Relies more on side-bending, so anti-side-bend strength and hip mobility come first.',
        { power: ['jumpSquat', 'yMedicineBallScoopThrow'], strength: ['trapBarDeadlift', 'bulgarian', 'singleLegRdl'], trunk: ['suitcaseCarry', 'sidePlank', 'backExtHold'], protect: ['dropStick', 'pronYTW'], condition: 'runSprints' }),
      role('fastMixed', 'Fast bowler: mixed action', 'Hips open but shoulders closed (shoulders counter-rotate). The action most linked to lower-back stress injuries: maximum trunk protection, and get the action checked by a coach.',
        { power: ['jumpSquat'], strength: ['trapBarDeadlift', 'bulgarian', 'singleLegRdl'], trunk: ['pallof', 'suitcaseCarry', 'backExtHold', 'sidePlank'], protect: ['dropStick', 'pronYTW'], condition: 'runSprints' },
        { flag: 'Mixed actions have the strongest link to lumbar stress fractures (counter-rotation over 30°). Ask your coach to review the action; training supports it but doesn\'t fix technique.' }),
      role('spin', 'Spin bowler', 'Shoulder rotation and wrist drive spin. Fewer injuries than quicks, mostly shoulder.',
        { power: ['mbShotPut'], strength: ['singleLegRdl', 'straightArmPulldown', 'bentRow'], trunk: ['cableChop', 'landmineRotation'], protect: ['bandER', 'wristCurl', 'nordic'], condition: 'turn505' }),
      role('batPower', 'Batter: explosive / power hitter', 'Bat speed comes from pulling strength, rotational power and hip–shoulder separation.',
        { power: ['mbShotPut', 'landminePunch', 'jumpSquat'], strength: ['frontSquat', 'chinUp', 'bentRow'], trunk: ['cableChop', 'landmineRotation'], protect: ['farmerCarry'], condition: 'turn505' },
        { gaps: 'Batting research is small; this is built from bat-speed studies and practice.' }),
      role('batClassic', 'Batter: conventional / technical', 'Long innings and repeated sprints between the wickets: endurance, hamstrings and turning.',
        { power: ['yLateralBound'], strength: ['bulgarian', 'singleLegRdl', 'bentRow'], trunk: ['pallof'], protect: ['farmerCarry'], condition: 'turn505' }),
      role('keeper', 'Wicketkeeper', 'Every ball: deep squats and explosive sideways moves. Hips, groin and fingers.',
        { power: ['skaterBounds', 'yLateralBound'], strength: ['gobletSquat', 'lateralLunge', 'singleLegRdl'], trunk: ['pallof'], protect: ['cossack', 'tibRaise', 'platePinch', 'y9090Hamstring'], condition: 'turn505' },
        { gaps: 'Very little keeper research; built from a narrative review and practice.' }),
      role('allrounder', 'All-rounder', 'Bowling and batting load together, so bowling load rules first and total volume is about a quarter lower.',
        { power: ['jumpSquat', 'mbShotPut'], strength: ['trapBarDeadlift', 'bulgarian'], trunk: ['pallof', 'backExtHold'], protect: ['dropStick'], condition: 'turn505' }, { volume: 0.75 }),
    ],
    gaps: 'Nordic and Copenhagen evidence comes from football; cricket uses them widely.',
    season: { off: 'Strength and muscle; rebuild bowling volume gradually.', pre: 'Turn strength into power; build bowling load slowly (no big weekly jumps).', in: 'Two short sessions to hold strength; keep the Nordic and Copenhagen work.' },
  },
  {
    id: 'football', name: 'Football', icon: '⚽',
    intro: 'Hamstring injuries are now about a quarter of all injuries in elite football. The FIFA 11+ warm-up, Nordic curls and the Copenhagen exercise each cut injuries in trials.',
    protect: ['nordic', 'copenhagen'],
    roles: [
      role('gk', 'Goalkeeper', 'Short explosive saves, dives and jumps. Shoulder injuries are twice as likely as for outfield players.',
        { power: ['trapBarJump', 'skaterBounds', 'mbShotPut'], strength: ['squat', 'lateralLunge'], trunk: ['pallof'], protect: ['landminePress', 'bandER', 'tgu'], condition: 'runSprints' }),
      role('cb', 'Centre-back', 'Least high-intensity running, most headers and aerial duels: jump, strength and braking.',
        { power: ['yFrontBoxJump', 'jumpSquat'], strength: ['trapBarDeadlift', 'squat', 'landminePress'], trunk: ['farmerCarry'], protect: ['neckIso', 'dropStick'], condition: 'turn505' },
        { gaps: 'Neck training for heading is plausible, not proven.' }),
      role('fb', 'Full-back / wing-back', 'Repeated overlapping sprints, and the biggest rise in sprint demands of any position.',
        { power: ['yLateralBound', 'skaterBounds'], strength: ['hipThrust', 'singleLegRdl', 'bulgarian'], trunk: ['pallof'], protect: ['rdl', 'calfRaise'], condition: 'runSprints' }),
      role('cdm', 'Defensive midfielder', 'Most total distance, constant turning and duels: aerobic engine, braking and contact strength.',
        { power: ['yLateralBound'], strength: ['frontSquat', 'bulgarian', 'dbRow'], trunk: ['pallof'], protect: ['lateralLunge'], condition: 'runIntervals' }),
      role('wide', 'Winger / attacking midfielder', 'The most high-intensity running and 1v1 cutting: top speed, change of direction and ACL-safe landing.',
        { power: ['skaterBounds', 'yLateralBound'], strength: ['hipThrust', 'trapBarDeadlift', 'singleLegRdl'], trunk: ['pallof'], protect: ['dropStick', 'calfRaise'], condition: 'runSprints' }),
      role('st', 'Striker', 'Straight sprints and jumps come before most goals; holding off defenders.',
        { power: ['jumpSquat', 'hyroxSledPush'], strength: ['hipThrust', 'squat', 'xStandingDumbbellShoulderPress'], trunk: ['landmineRotation'], protect: ['dropStick'], condition: 'runSprints' }),
    ],
    gaps: 'No trials of position-specific gym programmes; picks follow each position\'s demands.',
    season: { off: 'Strength and muscle, 2–3 sessions a week.', pre: '2 sessions of strength and power; start the Nordic and Copenhagen build-up.', in: '1–2 sessions a week holds the gains (one every two weeks loses them). Heavy early in the week, primers the day before a match.' },
  },
  {
    id: 'hockey', name: 'Field hockey', icon: '🏑',
    intro: 'Dribbling in a crouch loads the lower back. Ankle sprains are the most common injury.',
    protect: ['nordic', 'copenhagen', 'backExt'],
    roles: [
      role('gk', 'Goalkeeper', 'Low crouch, lateral splits and slides in heavy kit.',
        { power: ['yLateralBound'], strength: ['lateralLunge', 'gobletSquat', 'cossack'], trunk: ['pallof', 'sidePlank'], protect: ['y9090Hamstring'], condition: 'turn505' },
        { gaps: 'Hockey goalkeepers are barely studied.' }),
      role('def', 'Defender', 'Braking and side-to-side work in a low stance; ball impact at penalty corners.',
        { power: ['skaterBounds'], strength: ['trapBarDeadlift', 'bulgarian', 'singleLegRdl'], trunk: ['sidePlank'], protect: ['dropStick'], condition: 'turn505' }),
      role('mid', 'Midfielder', 'High distance and repeated sprints; posture endurance.',
        { power: ['yLateralBound'], strength: ['frontSquat', 'hipThrust'], trunk: ['suitcaseCarry', 'sidePlank', 'deadBug'], protect: [], condition: 'runIntervals' }),
      role('fwd', 'Forward', 'Highest top speed and work rate; power in a low dribbling position.',
        { power: ['trapBarJump', 'hyroxSledPush'], strength: ['hipThrust', 'singleLegRdl'], trunk: ['landmineRotation'], protect: [], condition: 'runSprints' }),
    ],
    gaps: 'Prevention programmes are borrowed from football; not yet tested in hockey.',
    season: { off: 'Strength, aerobic base and back endurance.', pre: 'Power and repeated sprints.', in: 'At least one strength session a week; primers only during tournaments.' },
  },
  {
    id: 'mma', name: 'MMA', icon: '🥋',
    intro: 'Fights are mostly aerobic with explosive bursts (about 1 part work to 2–4 parts recovery). Lower-body power and relative strength separate higher-level fighters.',
    protect: ['neckIso', 'farmerCarry'],
    roles: [
      role('striker', 'Striker', 'Standing exchanges and takedown defence: rotational and leg power.',
        { power: ['mbShotPut', 'landminePunch', 'jumpSquat'], strength: ['trapBarDeadlift', 'bulgarian'], trunk: ['pallof'], protect: ['singleLegRdl'], condition: 'bikeIntervals' }),
      role('grappler', 'Grappler / wrestler', 'Long isometric efforts, grip fights and takedowns: maximal strength, grip and neck.',
        { power: ['trapBarJump'], strength: ['deadlift', 'frontSquat', 'imtp', 'pullUp'], trunk: ['backExt'], protect: ['towelPullUp', 'nordic', 'copenhagen'], condition: 'hyroxSledPush' }),
      role('allround', 'All-rounder', 'Both: one power day, one strength day; neck and grip all year.',
        { power: ['mbShotPut', 'jumpSquat'], strength: ['trapBarDeadlift', 'frontSquat', 'pullUp'], trunk: ['pallof'], protect: ['towelPullUp'], condition: 'bikeIntervals' }),
    ],
    gaps: 'No studies compare MMA styles. Neck training may reduce head acceleration but is not proven to prevent concussion.',
    season: { off: 'Off camp: build strength 3 times a week and the aerobic base. Fix weak links (neck, grip).', pre: 'Fight camp: 2–3 gym sessions, strength turning into power; rounds that match the fight.', in: 'Taper and fight week: cut volume by about half, keep it sharp. Weight cutting only with medical supervision.' },
  },
  {
    id: 'boxing', name: 'Boxing', icon: '🥊',
    intro: 'Punch impact is strongly linked to lower-body power and upper-body explosive strength. Hand injuries are the most common upper-limb injury.',
    protect: ['neckIso', 'eccWrist'],
    roles: [
      role('out', 'Out-boxer', 'Highest punch volume and footwork: aerobic engine, springy calves, shoulder endurance.',
        { power: ['pogoJumps', 'yPlyoPushUp'], strength: ['bulgarian', 'calfRaise'], trunk: ['pallof'], protect: ['facePull', 'bandER'], condition: 'runIntervals' }),
      role('pressure', 'Pressure fighter', 'Sustained output and inside work: repeated rotational power and trunk stiffness.',
        { power: ['mbShotPut', 'landmineRotation'], strength: ['trapBarDeadlift'], trunk: ['pallof', 'farmerCarry'], protect: [], condition: 'bikeIntervals' }),
      role('power', 'Power puncher', 'Fewer, maximal punches: maximal strength, then explosive power.',
        { power: ['trapBarJump', 'landminePunch', 'mbShotPut', 'yPlyoPushUp'], strength: ['trapBarDeadlift', 'squat'], trunk: ['cableChop'], protect: ['wristCurl'], condition: 'runSprints' }),
    ],
    gaps: 'No studies compare boxing styles; the styles are built from sport-level research.',
    season: { off: 'Strength and aerobic base.', pre: 'Fight camp: power and 3-minute rounds with 1-minute rest.', in: 'Taper the last 2 weeks; primers in fight week. No extreme weight cutting.' },
  },
  {
    id: 'padel', name: 'Padel', icon: '🎾',
    intro: 'Rallies last about 10–15 seconds. Elbow, shoulder and ankle are the most injured areas. Wear eye protection.',
    protect: ['bandER', 'eccWrist', 'copenhagen'],
    roles: [
      role('left', 'Left side (revés)', 'More smashes, winners and accelerations; left-side players tend to be stronger.',
        { power: ['mbShotPut', 'skaterBounds'], strength: ['squat', 'nordic', 'bulgarian'], trunk: ['cableChop'], protect: ['pronYTW', 'platePinch'], condition: 'turn505' }),
      role('right', 'Right side (drive)', 'More defence and longer rallies: repeated efforts and change of direction.',
        { power: ['yLateralBound', 'jumpSquat'], strength: ['bulgarian', 'reverseLunge', 'singleLegRdl'], trunk: ['pallof'], protect: ['pronYTW'], condition: 'turn505' }),
    ],
    gaps: 'Padel injury research is mostly surveys; programmes borrow from tennis and handball.',
    season: { off: 'Strength 2–3 times a week and the shoulder programme 3 times a week.', pre: 'Power and rally-length intervals (10–15 s on).', in: '1–2 short heavy sessions; shoulder and ankle work in the warm-up.' },
  },
  {
    id: 'tennis', name: 'Tennis', icon: '🎾',
    intro: 'Points last under 10 seconds with 3–5 times as much rest. The serve is the hardest stroke on the shoulder; a weak external-rotation ratio predicts shoulder problems.',
    protect: ['bandER', 'pronYTW', 'eccWrist'],
    roles: [
      role('aggressive', 'Aggressive baseliner / serve-and-volley', 'More serves, overheads and hard braking.',
        { power: ['mbShotPut', 'yOverheadSlam', 'jumpSquat'], strength: ['trapBarDeadlift', 'bulgarian'], trunk: ['pallof'], protect: ['crossBody'], condition: 'runSprints' }),
      role('counter', 'Counter-puncher / defensive', 'Longer rallies and constant lateral movement.',
        { power: ['yLateralBound'], strength: ['bulgarian', 'lateralLunge', 'singleLegRdl'], trunk: ['sidePlank'], protect: ['copenhagen', 'calfRaise'], condition: 'runIntervals' }),
    ],
    gaps: 'Only juniors have been compared by style.',
    season: { off: 'Strength and the shoulder programme.', pre: 'Power and point-length intervals.', in: '1–2 short heavy sessions; cut gym volume by about half in tournament weeks.' },
  },
  {
    id: 'squash', name: 'Squash', icon: '🎾',
    intro: 'The most demanding racket sport: about 92% of max heart rate and 70% of the match in play. One match drops thigh strength by 16%.',
    protect: ['copenhagen', 'calfRaise', 'eccWrist'],
    roles: [
      role('attack', 'Attacking player', 'Shorter, explosive rallies: first step, change of direction, rotation.',
        { power: ['skaterBounds', 'mbShotPut'], strength: ['bulgarian', 'squat'], trunk: ['cableChop'], protect: ['bandER'], condition: 'turn505' }),
      role('retrieve', 'Retriever / attritional', 'Rallies over 20 seconds: aerobic engine and lunge endurance.',
        { power: ['yLateralBound'], strength: ['reverseLunge', 'legPress', 'lateralLunge'], trunk: ['pallof'], protect: ['seatedCalf'], condition: 'runIntervals' }),
    ],
    gaps: 'No studies compare squash styles.',
    season: { off: 'Aerobic intervals 2–3 times a week and lunge strength.', pre: 'Repeated sprints and ghosting-style change of direction.', in: '1–2 short heavy sessions; hydrate well (indoor heat).' },
  },
];

export const PHASES = [
  { id: 'off', name: 'Off-season', sub: 'Build strength and muscle' },
  { id: 'pre', name: 'Pre-season', sub: 'Turn it into speed and power' },
  { id: 'in', name: 'In-season', sub: 'Stay strong and fresh for games' },
];

export const sportById = id => SPORTS.find(s => s.id === id);
export const roleOf = (sport, id) => sportById(sport)?.roles.find(r => r.id === id);

// Sets × reps by category and phase.
const DOSE = {
  off: { power: [3, '5', 120], strength: [4, '5-6', 150], trunk: [3, '10/side', 60], protect: [3, '6', 60], condition: [1, '20 min', 0] },
  pre: { power: [4, '3-5', 150], strength: [3, '3-5', 180], trunk: [3, '8/side', 60], protect: [2, '6', 60], condition: [1, '15 min', 0] },
  in: { power: [3, '3', 120], strength: [2, '3-5', 150], trunk: [2, '8/side', 45], protect: [2, '5', 45], condition: [1, '10 min', 0] },
};
const it = (lib, id, cat, phase, scale = 1) => {
  if (!lib[id]) return null;
  let [sets, reps, rest] = DOSE[phase][cat];
  const x = lib[id];
  if (x.hold) reps = `${x.hold}s`;
  if (x.coach === 'timer') reps = `${x.mins || 1} min`;
  if (x.kind === 'run' || x.kind === 'cardio' || x.coach === 'intervals') { sets = 1; reps = `${x.rounds || 8} rounds`; rest = 0; }
  return [id, Math.max(1, Math.round(sets * scale)), reps, rest];
};
const uniq = xs => [...new Set(xs.filter(Boolean))];

/**
 * A programme for sport + role + phase, in the same shape as programs.js.
 * Off-season: 3 days. Pre-season: 2 days. In-season: 2 short days.
 */
export function buildProgram(sportId, roleId, phase, lib) {
  const sp = sportById(sportId), r = roleOf(sportId, roleId); if (!sp || !r) return null;
  const k = r.volume || 1, I = (id, cat) => it(lib, id, cat, phase, k);
  const protect = uniq([...(sp.protect || []), ...(r.protect || [])]);
  const P = r.power || [], S = r.strength || [], T = r.trunk || [];
  const days = [];
  if (phase === 'off') {
    days.push({ name: 'Strength', focus: 'Main lifts and trunk', items: [...S.slice(0, 3).map(x => I(x, 'strength')), ...T.slice(0, 2).map(x => I(x, 'trunk')), I(protect[0], 'protect')] });
    days.push({ name: 'Power + protect', focus: 'Explosive work and injury prevention', items: [...P.slice(0, 2).map(x => I(x, 'power')), ...protect.slice(1, 4).map(x => I(x, 'protect')), I(r.condition, 'condition')] });
    days.push({ name: 'Strength + engine', focus: 'Second strength day and conditioning', items: [...S.slice(1, 3).map(x => I(x, 'strength')), I(P[2] || P[0], 'power'), ...T.slice(2).map(x => I(x, 'trunk')), I(protect[0], 'protect'), I(r.condition, 'condition')] });
  } else if (phase === 'pre') {
    days.push({ name: 'Power', focus: 'Heavy, then fast', items: [I(S[0], 'strength'), ...P.slice(0, 3).map(x => I(x, 'power')), I(T[0], 'trunk'), I(protect[0], 'protect')] });
    days.push({ name: 'Speed + protect', focus: 'Sport-speed work and prevention', items: [I(S[1] || S[0], 'strength'), I(P[1] || P[0], 'power'), ...protect.slice(1, 4).map(x => I(x, 'protect')), I(r.condition, 'condition')] });
  } else {
    days.push({ name: 'Maintain A', focus: 'Short and heavy, early in the week', items: [I(S[0], 'strength'), I(P[0], 'power'), I(T[0], 'trunk'), I(protect[0], 'protect')] });
    days.push({ name: 'Maintain B', focus: 'Prevention dose and a primer', items: [I(S[1] || S[0], 'strength'), ...protect.slice(1, 3).map(x => I(x, 'protect')), I(P[1] || P[0], 'power')] });
  }
  for (const d of days) { const seen = new Set(); d.items = d.items.filter(x => x && !seen.has(x[0]) && seen.add(x[0])); }
  const ph = PHASES.find(p => p.id === phase);
  return {
    id: `ath-${sportId}-${roleId}-${phase}`, name: `${sp.name}: ${r.name}`, goal: `${sp.name} · ${ph.name}`, level: 'Athlete',
    days: days.length, weeks: phase === 'in' ? 12 : 6, athlete: { sport: sportId, role: roleId, phase },
    tagline: r.desc, method: `${sp.season[phase]} ${r.why || ''}`.trim(), flag: r.flag, gaps: [r.gaps, sp.gaps].filter(Boolean).join(' '),
    plan: days,
  };
}

/** Parse an athlete programme id back into its parts (for saved state). */
export function parseId(id) {
  const m = /^ath-([a-z]+)-([A-Za-z]+)-(off|pre|in)$/.exec(id || ''); return m ? { sport: m[1], role: m[2], phase: m[3] } : null;
}
