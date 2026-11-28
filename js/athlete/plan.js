// Athlete plans: a weekly programme built from sport + position + the combine limiter.
//
// Structure (common practice in team-sport S&C, see SCIENCE.md §Athlete):
//  - Every session opens with a prevention warm-up (FIFA 11+ style for field sports).
//  - The #1 limiter gets its own block in every session, done first while fresh.
//  - Sessions rotate Speed & power → Strength → Conditioning so hard days are spread out.
//  - In season, sessions are placed around the match: MD-4 strength, MD-3 speed, MD-2 light,
//    MD-1 primer, MD+1 recovery, and volume drops by about a third.
import { SPORT, roleOf, QUALITIES } from './sports.js';

const BLOCKS = {
  power: [['trapBarJump', '4×3'], ['boxJump', '3×4'], ['broadJump', '3×3']],
  reactive: [['pogoHop', '3×15'], ['aSkip', '3×20 m'], ['lateralBound', '3×5 each']],
  speed: [['aSkip', '2×20 m'], ['accelSprint', '5×15 m'], ['flyingSprint', '4×20 m']],
  agility: [['decelDrill', '4 each leg'], ['shuttle505', '3 each way'], ['sideShuffle', '4×10 m']],
  hamstring: [['nordic', '3×5'], ['singleLegRdl', '3×8 each'], ['flyingSprint', '3×20 m']],
  symmetry: [['bulgarian', '3×8, weaker side first'], ['singleLegRdl', '3×8 each'], ['lateralBound', '3×5 each']],
  aerobic: [['intervalRun', '2×8 min'], ['repeatSprint', '2×8'], ['tempoRun', '8×100 m']],
  upper: [['pushUp', '3×max minus 2'], ['pullUp', '4×6'], ['landminePress', '3×8 each']],
  grip: [['deadHang', '3×max'], ['towelHang', '3×20 s'], ['farmerCarry', '4×30 m']],
  trunk: [['sidePlank', '3×40 s each'], ['pallof', '3×10 each'], ['medBallRotThrow', '4×5 each']],
  groin: [['copenhagen', '3×20 s each'], ['lateralLunge', '3×8 each']],
  bowlKnee: [['stepDown', '3×8 front leg'], ['bulgarian', '3×6 heavy, front leg'], ['decelDrill', '5 bowling-stride stops']],
};

const STRENGTH = [['squat', '4×5'], ['rdl', '3×6'], ['hipThrust', '3×8'], ['pullUp', '3×6'], ['benchPress', '3×6'], ['bentRow', '3×8']];

const WARMUP = {
  field: [['aSkip', '2×20 m'], ['nordic', '1×5'], ['copenhagen', '2×15 s each'], ['lateralLunge', '1×6 each']],
  cricket: [['aSkip', '2×20 m'], ['sidePlank', '2×20 s each'], ['bandPullApart', '2×15'], ['lateralLunge', '1×6 each']],
  mma: [['sprawl', '2×5'], ['neckIso', '1 round'], ['bandPullApart', '2×15'], ['pogoHop', '2×10']],
  squash: [['sideShuffle', '2×10 m'], ['lateralLunge', '1×6 each'], ['pogoHop', '2×10'], ['copenhagen', '2×15 s each']],
};
const warmupKey = s => (s === 'football' || s === 'hockey') ? 'field' : s;

// Sport- and position-specific work added to the conditioning / sport day.
const SPORT_BLOCK = {
  'cricket:pace': { name: 'Bowling strength', items: [['medBallRotThrow', '4×5 each side'], ['pallof', '3×10 each'], ['singleCalf', '3×12 each']] },
  'cricket:fingerSpin': { name: 'Spin bowling', items: [['medBallRotThrow', '3×6 each'], ['gripSqueeze', '3×20 s'], ['bandER', '3×12']] },
  'cricket:wristSpin': { name: 'Shoulder and wrist', items: [['bandER', '3×12'], ['eccWristExt', '3×15'], ['wristCurl', '3×15'], ['medBallRotThrow', '3×6 each']] },
  'cricket:topBatter': { name: 'Running between wickets', items: [['repeatSprint', '6 × three runs (22 yd), 40 s rest'], ['shuttle505', '3 each way']] },
  'cricket:finisher': { name: 'Bat speed', items: [['medBallRotThrow', '5×4 each, max speed'], ['medBallSlam', '3×6'], ['farmerCarry', '3×30 m']] },
  'cricket:keeper': { name: 'Keeping', items: [['gobletSquat', '3×45 s hold'], ['sideShuffle', '6×5 m'], ['lateralBound', '3×5 each']] },
  'football:gk': { name: 'Goalkeeping', items: [['lateralBound', '4×4 each'], ['boxJump', '3×3'], ['medBallSlam', '3×5']] },
  'football:cb': { name: 'Aerial duels', items: [['boxJump', '4×3'], ['broadJump', '3×3'], ['accelSprint', '6×10 m']] },
  'football:fb': { name: 'Overlap repeats', items: [['repeatSprint', '2×8 × 30 m'], ['flyingSprint', '3×20 m']] },
  'football:cdm': { name: 'Duels and screening', items: [['sledPush', '4×15 m'], ['shuttle505', '4 each way'], ['pallof', '3×10 each']] },
  'football:cm': { name: 'Box-to-box', items: [['intervalRun', '2×6 min'], ['shuttle505', '3 each way']] },
  'football:winger': { name: '1v1 speed', items: [['decelDrill', '4 each leg'], ['flyingSprint', '4×20 m'], ['lateralBound', '3×4 each']] },
  'football:st': { name: 'Finishing power', items: [['accelSprint', '6×10 m'], ['boxJump', '3×3'], ['sledPush', '3×10 m']] },
  'mma:striker': { name: 'Fight rounds', items: [['bikeIntervals', 'rounds matching your fight, e.g. 3 × 5 min (20 s hard / 10 s easy)'], ['medBallRotThrow', '4×5 each'], ['neckIso', '2 rounds']] },
  'mma:grappler': { name: 'Grappling strength', items: [['towelHang', '4×20 s'], ['sprawl', '4×6'], ['turkishGetUp', '3×2 each'], ['neckIso', '2 rounds']] },
  'mma:allround': { name: 'Fight rounds', items: [['bikeIntervals', '3 × 5 min rounds'], ['sprawl', '3×6'], ['towelHang', '3×20 s'], ['neckIso', '2 rounds']] },
  'squash:player': { name: 'Court movement', items: [['ghosting', '6 × 40 s on / 40 s off'], ['lunge', '3×8 each, deep'], ['lateralLunge', '3×8 each']] },
  'hockey:gk': { name: 'Goalkeeping', items: [['lateralBound', '4×4 each'], ['sideShuffle', '6×5 m'], ['gobletSquat', '3×40 s hold']] },
  'hockey:def': { name: 'Low position', items: [['bulgarian', '3×8 each'], ['sideShuffle', '6×5 m'], ['copenhagen', '3×20 s each']] },
  'hockey:mid': { name: 'Running load', items: [['intervalRun', '2×6 min'], ['bulgarian', '3×8 each']] },
  'hockey:fwd': { name: 'Circle speed', items: [['accelSprint', '6×10 m'], ['decelDrill', '4 each leg'], ['shuttle505', '3 each way']] },
  'hockey:dragFlicker': { name: 'Drag-flick support', items: [['pallof', '3×10 each'], ['sidePlank', '3×40 s each'], ['lateralLunge', '3×8 each'], ['medBallRotThrow', '3×5 each']] },
};

const SESSION_TYPES = {
  sp: { name: 'Speed & power', from: ['speed', 'power', 'reactive', 'agility'] },
  str: { name: 'Strength', from: ['hamstring', 'upper', 'trunk', 'groin', 'symmetry', 'grip'] },
  cond: { name: 'Conditioning & sport', from: ['aerobic'] },
};
const ROTATION = { 2: ['sp', 'str'], 3: ['sp', 'str', 'cond'], 4: ['sp', 'str', 'cond', 'str'], 5: ['sp', 'str', 'cond', 'sp', 'str'] };
const IN_SEASON = { 1: [['MD-3', 'sp']], 2: [['MD-4', 'str'], ['MD-2', 'sp']], 3: [['MD+1', 'rec'], ['MD-4', 'str'], ['MD-3', 'sp']], 4: [['MD+1', 'rec'], ['MD-4', 'str'], ['MD-3', 'sp'], ['MD-1', 'prime']], 5: [['MD+1', 'rec'], ['MD-4', 'str'], ['MD-3', 'sp'], ['MD-2', 'cond'], ['MD-1', 'prime']] };

const lighter = dose => dose.replace(/^(\d+)×/, (_, n) => `${Math.max(1, Math.round(n * 2 / 3))}×`);

/**
 * @param o { sport, role, limiter: quality id | null, next: quality ids[], phase: 'off'|'pre'|'in', days: 2–5, youth?, action? }
 * @returns { title, phase, sessions: [{ label, name, blocks: [{ name, items: [[exId, dose]], focus? }] }], notes: [] }
 */
export function buildPlan({ sport, role, limiter = null, next = [], phase = 'pre', days = 3, youth = false, action = null, fixes = [] }) {
  const s = SPORT[sport], r = roleOf(sport, role);
  if (!s || !r) return null;
  days = Math.max(2, Math.min(5, Math.round(days) || 3));
  const top = Object.entries(r.weights).sort((a, b) => b[1] - a[1]).map(([q]) => q);
  const warm = { name: 'Warm-up', items: WARMUP[warmupKey(sport)] };
  const limBlock = limiter && BLOCKS[limiter] ? { name: `Your #1 focus: ${QUALITIES[limiter].name}`, items: BLOCKS[limiter], focus: true } : null;
  // Lab faults (lab.js): their exercises, de-duplicated, max 4, in one block after the limiter.
  const fixItems = []; for (const f of fixes) for (const it of f.ex || []) if (fixItems.length < 4 && !fixItems.some(([id]) => id === it[0])) fixItems.push(it);
  const fixBlock = fixItems.length ? { name: `Movement work: ${fixes.map(f => f.title.toLowerCase()).join('; ')}`, items: fixItems, fix: true } : null;
  const pick = type => {
    const pool = SESSION_TYPES[type].from;
    // Next-priority qualities first, then the role's most important ones.
    return [...next, ...top].filter((q, i, a) => a.indexOf(q) === i && pool.includes(q) && q !== limiter && BLOCKS[q]).slice(0, 2)
      .map(q => ({ name: QUALITIES[q].name, items: BLOCKS[q] }));
  };
  const make = (label, type) => {
    if (type === 'rec') return { label, name: 'Recovery', blocks: [{ name: 'Recovery', items: [['walk', '20 min'], ['bikeIntervals', '15 min easy, no intervals'], ['thoracicExt', '2×60 s']] }] };
    if (type === 'prime') return { label, name: 'Primer', blocks: [warm, { name: 'Short and sharp', items: [['accelSprint', '3×10 m'], ['boxJump', '2×3']] }] };
    const blocks = [warm];
    if (limBlock) blocks.push(limBlock);
    if (fixBlock) blocks.push(fixBlock);
    if (type === 'str') blocks.push({ name: 'Main strength', items: youth ? STRENGTH.map(([id]) => [id, '3×8, light, technique first']) : STRENGTH.slice(0, 4) });
    blocks.push(...pick(type));
    if (type === 'cond') blocks.push(SPORT_BLOCK[`${sport}:${role}`]);
    return { label, name: SESSION_TYPES[type].name, blocks: blocks.filter(Boolean) };
  };
  let sessions;
  if (phase === 'in' && sport !== 'cricket') {
    sessions = IN_SEASON[Math.min(days, 5)].map(([label, type]) => make(label, type));
    // Make sure the sport block appears once even when there's no conditioning day.
    if (!sessions.some(x => x.blocks.includes(SPORT_BLOCK[`${sport}:${role}`]))) sessions.find(x => x.name === 'Speed & power')?.blocks.push(SPORT_BLOCK[`${sport}:${role}`]);
    // New block objects: blocks are shared between sessions, so lightening in place would compound.
    sessions.forEach(x => { x.blocks = x.blocks.filter(Boolean).map(b => b === warm ? b : { ...b, items: b.items.map(([id, d]) => [id, lighter(d)]) }); });
  } else {
    sessions = ROTATION[days].map((type, i) => make(`Day ${i + 1}`, type));
    if (!sessions.some(x => x.name === 'Conditioning & sport')) sessions[0].blocks.push(SPORT_BLOCK[`${sport}:${role}`]);
  }
  sessions.forEach(x => { x.blocks = x.blocks.filter(Boolean); });

  const notes = [];
  if (phase === 'off') notes.push('Off-season: build volume. Add a set to the main strength block if you recover well.');
  if (phase === 'pre') notes.push('Pre-season: build speed and fitness. Increase running volume by no more than about 10–20% a week.');
  if (phase === 'in') notes.push(sport === 'cricket' ? 'In season: keep 2 short strength sessions a week. Do them on non-bowling days, and never the day before a match.' : 'In season: sessions are placed around your match (MD = match day). Volume is about a third lower. Skip MD-1 if you feel flat.');
  if (sport === 'cricket' && role === 'pace') {
    notes.push('Keep a count of balls bowled each week. Raise it gradually and avoid sudden jumps.');
    if (action === 'Mixed') notes.push('Your action is set to Mixed. Studies link it with more lower-back stress injuries. Get it reviewed by a qualified bowling coach before you add bowling volume.');
  }
  if (sport === 'hockey' && role === 'dragFlicker') notes.push('Drag-flicking loads the lower back and groin heavily. Cap flicks per session and tell your coach or a physio about any back pain early.');
  if (sport === 'mma') notes.push('Hard sparring counts as a conditioning session. Don\'t stack it on the same day as Speed & power.');
  if (youth && sport === 'cricket' && role === 'pace') notes.push('Young fast bowlers: follow your cricket board\'s age-group overs limits.');
  if (youth) notes.push('Under 16: technique and bodyweight first. Heavy lifting only with a qualified coach supervising.');
  notes.push('Stop any exercise that causes sharp pain. Pain that changes how you move needs a physio, not a plan.');
  return { title: `${r.name} · ${s.name}`, phase, days, sessions, notes, evidence: s.evidence.length ? [...s.evidence, 'These studies tested supervised programmes. This app has not been tested for injury outcomes.'] : [] };
}

export const ALL_PLAN_EXERCISES = () => {
  const ids = new Set();
  for (const v of [...Object.values(BLOCKS), STRENGTH, ...Object.values(WARMUP), ...Object.values(SPORT_BLOCK).map(b => b.items)]) for (const [id] of v) ids.add(id);
  ['walk', 'bikeIntervals', 'thoracicExt', 'accelSprint', 'boxJump'].forEach(i => ids.add(i));
  return [...ids];
};
export const SPORT_BLOCK_KEYS = Object.keys(SPORT_BLOCK);
