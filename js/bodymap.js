// "Map my body": a one-minute guided calibration that measures THIS person, so every camera
// exercise is judged against their own body instead of one textbook number for everyone.
//
// Steps (QK talks the lifter through them; each is detected from the movement itself, not the clock):
//   side-on   1 stand still        → limb proportions, how straight knees/hips/elbows go, posture line
//             2 rise onto the toes → calf-raise height
//             3 3 slow squats      → comfortable depth, ankle bend (shin angle), heel rise, lean
//             4 reach overhead     → shoulder flexion range
//             5 2 slow hinges      → hip-hinge range (hamstring length)
//   facing    6 stand still        → natural knee width
//             7 arms out and up    → shoulder abduction range
//             8 2 slow squats      → knee tracking at depth
// Proportions: thigh length vs torso changes squat lean (Fry et al. 2003; Demers et al. 2018).
// Mobility: ankle dorsiflexion limits squat depth and adds trunk lean (Kim et al. 2015; Macrum et al.
// 2012). Normal-range references for the explanations: AAOS / Norkin & White.
import { angle, fromVertical, dist, bestSide, viewOf } from './angles.js';

const med = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pct = (a, q) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]; };
const r2 = x => (x == null ? null : Math.round(x * 100) / 100);
const rd = x => (x == null ? null : Math.round(x));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/** @param frames [{t, px}] covering the whole calibration (side then front) */
export function analyseBodyMap(frames) {
  const side = [], front = [];
  for (const f of frames) {
    const p = f.px; if (!p) continue;
    const s = bestSide(p); if (s.conf < 0.55) continue;
    (viewOf(p) === 'side' ? side : front).push({ ...f, s });
  }
  const out = { at: Date.now(), ok: false, issues: [], v: 2 };
  if (side.length < 30) { out.issues.push('I couldn\'t see you side-on for long enough. Stand side-on, whole body in view.'); return out; }

  const heelOf = s => (s.he && s.ft && s.he.v > 0.4 && s.ft.v > 0.4 ? (s.ft.y - s.he.y) / (dist(s.he, s.ft) || 1) : null);
  const F = side.map(f => {
    const s = f.s;
    return { f, s, knee: angle(s.hip, s.kn, s.an), hip: angle(s.sh, s.hip, s.kn), elbow: angle(s.sh, s.el, s.wr), flex: angle(s.hip, s.sh, s.el), heel: heelOf(s) };
  });

  // 1. Standing still: knees and hips straight, arms by the sides.
  const stand = F.filter(x => x.knee > 165 && x.hip > 160 && x.flex < 35);
  if (stand.length < 8) { out.issues.push('Stand still and tall for a few seconds at the start, arms by your sides.'); return out; }
  const L = k => med(stand.map(x => k(x.s)));
  const torso = L(s => dist(s.sh, s.hip)), femur = L(s => dist(s.hip, s.kn)), tibia = L(s => dist(s.kn, s.an));
  const upperArm = L(s => dist(s.sh, s.el)), forearm = L(s => dist(s.el, s.wr));
  out.femurTorso = r2(femur / torso); out.tibiaFemur = r2(tibia / femur); out.armTorso = r2((upperArm + forearm) / torso);
  out.kneeStraight = rd(med(stand.map(x => x.knee)));
  out.hipStraight = rd(med(stand.map(x => x.hip)));
  out.elbowStraight = rd(pct(stand.map(x => x.elbow), 0.75));
  out.line = rd(med(stand.map(x => angle(x.s.sh, x.s.hip, x.s.an))));
  const heelStand = med(stand.map(x => x.heel).filter(v => v != null));

  // 2. Rising onto the toes (knees straight).
  if (heelStand != null) {
    const toes = F.filter(x => x.knee > 160 && x.heel != null).map(x => x.heel - heelStand);
    const top = pct(toes, 0.97);
    if (top > 0.15) out.calfLift = r2(top);
  }

  // 3. Squats: each rep's deepest frame (knee below 140° between standing phases).
  const bottoms = []; let cur = null;
  F.forEach(x => {
    if (x.knee < 140) { if (!cur || x.knee < cur.knee) cur = x; }
    else if (x.knee > 155 && cur) { bottoms.push(cur); cur = null; }
  });
  if (cur) bottoms.push(cur);
  if (bottoms.length < 2) { out.issues.push('Do three slow squats side-on, as deep as is comfortable.'); return out; }
  out.reps = bottoms.length;
  out.kneeMin = rd(med(bottoms.map(b => b.knee)));
  out.leanAtDepth = rd(med(bottoms.map(b => fromVertical(b.s.hip, b.s.sh))));
  out.shinAtDepth = rd(med(bottoms.map(b => fromVertical(b.s.an, b.s.kn))));
  const hb = bottoms.map(b => b.heel).filter(v => v != null);
  out.heelRise = heelStand != null && hb.length ? r2(Math.max(0, med(hb) - heelStand)) : null;

  // 4. Overhead reach (knees straight): shoulder flexion, measured between trunk and upper arm.
  const over = F.filter(x => x.knee > 160 && x.hip > 150 && x.flex > 110);
  if (over.length >= 5) out.shoulderFlex = rd(pct(over.map(x => x.flex), 0.9));

  // 5. Hinge (knees soft, not a squat): smallest trunk-to-thigh angle.
  const hinge = F.filter(x => x.knee > 145 && x.hip < 150);
  if (hinge.length >= 5) out.hingeMin = rd(pct(hinge.map(x => x.hip), 0.05));

  // 6–8. Facing the camera: knee width standing / at the bottom, and arms out to the side.
  if (front.length >= 20) {
    const ratio = f => dist(f.px[25], f.px[26]) / (dist(f.px[27], f.px[28]) || 1);
    const hipY = f => (f.px[23].y + f.px[24].y) / 2;
    const ys = front.map(hipY), top = Math.min(...ys), low = Math.max(...ys), span = low - top;
    const st = front.filter(f => hipY(f) < top + span * 0.15), deep = front.filter(f => hipY(f) > low - span * 0.15);
    if (span > 20 && st.length >= 5 && deep.length >= 3) { out.kneeRatioStand = r2(med(st.map(ratio))); out.kneeRatioBottom = r2(med(deep.map(ratio))); }
    const abd = front.map(f => Math.max(angle(f.px[23], f.px[11], f.px[13]), angle(f.px[24], f.px[12], f.px[14])));
    const a = pct(abd, 0.95); if (a > 100) out.shoulderAbd = rd(a);
  }
  out.ok = true;
  return out;
}

// ---------------------------------------------------------------------------------------------
// Personal limits per movement pattern. Each one only moves where the body explains it, and never
// asks for more range than the person showed they have. Keys are read by the rules in exercises.js
// (via lim()), plus downT / upT, which set where a rep counts.

export const anthroLeanLimit = femurTorso => Math.min(60, Math.max(38, 45 + (femurTorso - 0.85) * 60));

// Lockout: "straight" is judged against how straight THEIR joint goes, standing relaxed.
const lockFrom = (straight, def, margin = 8) => (straight == null ? def : Math.min(def, straight - margin));

/** @returns personal limits for one pattern, or null if the body map doesn't change anything */
export function personalFor(pattern, b) {
  if (!b?.ok) return null;
  const P = { personal: true };
  const elbowLock = d => lockFrom(b.elbowStraight, d, 10), elbowTop = d => lockFrom(b.elbowStraight, d, 15);
  const kneeLock = d => lockFrom(b.kneeStraight, d, 8), kneeTop = d => lockFrom(b.kneeStraight, d, 12);
  const hipLock = d => lockFrom(b.hipStraight, d, 8), hipTop = d => lockFrom(b.hipStraight, d, 10);
  // Pressing depth: shorter arms (relative to the torso) reach the chest/floor with the elbow less bent.
  const pressDepth = b.armTorso ? Math.round(clamp(100 + (1.15 - b.armTorso) * 80, 90, 115)) : 100;
  const line = def => (b.line == null ? def : Math.min(def, b.line - 12));

  switch (pattern) {
    case 'squat':
      P.sqDepth = Math.max(105, b.kneeMin + 10);
      P.downT = Math.max(115, b.kneeMin + 20); // rep counting follows their range too
      P.upT = kneeTop(160); P.lockKnee = kneeLock(165);
      P.sqLean = Math.round(Math.min(62, Math.max(anthroLeanLimit(b.femurTorso), b.leanAtDepth + 6)));
      P.femurTorso = b.femurTorso;
      P.sqValgus = b.kneeRatioStand ? Math.min(0.8, r2(b.kneeRatioStand * 0.85)) : 0.8;
      P.tightAnkles = (b.shinAtDepth != null && b.shinAtDepth < 28) || (b.heelRise != null && b.heelRise > 0.2);
      break;
    case 'lunge':
      P.luLean = Math.round(clamp(25 + (b.femurTorso - 0.85) * 40, 20, 35));
      P.luDepth = Math.max(105, b.kneeMin + 5); P.downT = Math.max(115, P.luDepth + 10); P.upT = kneeTop(155);
      break;
    case 'rdl':
      if (b.hingeMin != null) { P.hingeDepth = b.hingeMin + 20; P.downT = Math.max(120, b.hingeMin + 30); }
      P.upT = hipTop(165); P.lockHip = hipLock(168);
      break;
    case 'hipThrust': P.upT = hipTop(155); P.lockHip = hipLock(165); break;
    case 'bench': P.pressDepth = pressDepth; P.downT = Math.max(105, pressDepth + 5); P.upT = elbowTop(150); P.lockElbow = elbowLock(155); break;
    case 'pushUp': P.pressDepth = pressDepth; P.downT = Math.max(105, pressDepth + 5); P.upT = elbowTop(150); P.line = line(160); break;
    case 'press': P.upT = elbowTop(155); P.lockElbow = elbowLock(160); break;
    case 'dip': P.upT = elbowTop(150); P.lockElbow = elbowLock(155); break;
    case 'triExt': P.upT = elbowTop(155); P.lockElbow = elbowLock(160); break;
    case 'vPull': P.upT = elbowTop(150); P.lockElbow = elbowLock(155); break;
    case 'row': P.upT = elbowTop(145); P.reachElbow = lockFrom(b.elbowStraight, 150, 15); break;
    case 'curl': P.upT = elbowTop(145); P.reachElbow = lockFrom(b.elbowStraight, 150, 15); break;
    case 'raise': {
      const range = Math.min(b.shoulderAbd ?? 180, b.shoulderFlex ?? 180);
      P.raiseLow = range < 100 ? range - 15 : 75;
      break;
    }
    case 'calf': if (b.calfLift) P.calfLift = r2(Math.min(0.35, b.calfLift * 0.8)); break;
    case 'legRaise': if (b.hingeMin != null) P.legRaise = Math.max(115, b.hingeMin + 10); break;
    case 'kneeExt': P.upT = kneeTop(160); P.lockKnee = kneeLock(165); break;
    case 'kneeFlex': P.upT = lockFrom(b.kneeStraight, 150, 20); P.reachKnee = lockFrom(b.kneeStraight, 150, 20); break;
    case 'plank': P.line = line(162); break;
    default: return null; // fly, crunch: nothing in the body map changes what's correct
  }
  return P;
}

/** Back-compat: squat thresholds. */
export const personalThresholds = b => personalFor('squat', b);

// What the body map changed for a pattern, in plain words (shown on the setup sheet). A line appears
// only when this person's limit differs from what a typical body would get.
const TYPICAL = { ok: true, femurTorso: 0.85, armTorso: 1.15, kneeStraight: 180, hipStraight: 180, elbowStraight: 180, line: 180, calfLift: 0.5,
  kneeMin: 70, leanAtDepth: 35, shinAtDepth: 35, heelRise: 0, hingeMin: 60, shoulderFlex: 175, shoulderAbd: 175, kneeRatioStand: 1 };
export function fitLines(pattern, b) {
  const P = personalFor(pattern, b), D = personalFor(pattern, TYPICAL); if (!P) return [];
  const ch = k => P[k] != null && P[k] !== D[k], out = [];
  if (ch('sqLean')) out.push(`Forward lean allowed: ${P.sqLean}° (typical ${D.sqLean}°), from your proportions`);
  if (ch('sqDepth')) out.push(`Depth judged against your range: knees to ${P.sqDepth}°`);
  if (ch('sqValgus')) out.push(`Knee caving judged from your natural knee position (${Math.round(P.sqValgus * 100)}% of foot width)`);
  if (ch('luLean')) out.push(`Torso lean allowed: ${P.luLean}° (typical ${D.luLean}°), from your proportions`);
  if (ch('luDepth')) out.push(`Depth judged against your range: knee to ${P.luDepth}°`);
  if (ch('hingeDepth')) out.push(`Hinge depth set by your hamstrings: fold to ${P.hingeDepth}° (typical ${D.hingeDepth}°)`);
  if (ch('lockElbow')) out.push(`Lockout matched to your elbows (they straighten to ${b.elbowStraight}°)`);
  if (ch('reachElbow')) out.push(`Full stretch matched to your elbows (they straighten to ${b.elbowStraight}°)`);
  if (ch('lockKnee') || ch('reachKnee')) out.push(`Lockout matched to your knees (they straighten to ${b.kneeStraight}°)`);
  if (ch('lockHip')) out.push(`Hip lockout matched to your standing posture (${b.hipStraight}°)`);
  if (ch('pressDepth')) out.push(`Depth matched to your arm length: elbows to ${P.pressDepth}° (typical ${D.pressDepth}°)`);
  if (ch('raiseLow')) out.push(`Raise height matched to your shoulder range (${Math.min(b.shoulderAbd ?? 180, b.shoulderFlex ?? 180)}°)`);
  if (ch('calfLift')) out.push('Calf-raise height matched to how high you rose on your toes');
  if (ch('legRaise')) out.push(`Leg height matched to your hamstrings (${P.legRaise}°)`);
  if (ch('line')) out.push(`Body line matched to your natural posture (${b.line}°)`);
  if (['press', 'vPull', 'triExt'].includes(pattern) && b.shoulderFlex != null && b.shoulderFlex < 160) out.push(`Your overhead reach is ${b.shoulderFlex}°, so keep your ribs down rather than arching to get your arms by your ears`);
  return out;
}

/** Plain-language findings for the "Your body" card. */
export function explainBodyMap(b) {
  if (!b?.ok) return [];
  const sq = personalFor('squat', b), out = [];
  const ft = b.femurTorso;
  out.push(ft >= 0.95
    ? { title: 'Long thighs for your torso', detail: `Your thigh-to-torso ratio is ${ft} (about 0.85 is typical). To stay balanced over your feet you have to lean forward more in squats and lunges, so that's normal for you. QK allows you up to ${sq.sqLean}° of lean in a squat instead of the usual 45°.` }
    : ft <= 0.78
      ? { title: 'Short thighs for your torso', detail: `Your thigh-to-torso ratio is ${ft}. You can squat quite upright, so QK expects your chest to stay tall (up to ${sq.sqLean}° of lean).` }
      : { title: 'Typical proportions', detail: `Your thigh-to-torso ratio is ${ft}. QK allows up to ${sq.sqLean}° of forward lean at the bottom of your squat.` });
  if (b.armTorso) out.push(b.armTorso >= 1.25
    ? { title: 'Long arms', detail: `Your arms are long for your torso (${b.armTorso}). Presses and push-ups travel further for you, so QK asks for a deeper elbow bend (${personalFor('bench', b).pressDepth}°).` }
    : b.armTorso <= 1.05
      ? { title: 'Short arms', detail: `Your arms are short for your torso (${b.armTorso}). The bar reaches your chest sooner, so QK accepts a smaller elbow bend on presses and push-ups (${personalFor('bench', b).pressDepth}°).` }
      : { title: 'Arm length', detail: `Your arm-to-torso ratio is ${b.armTorso}. QK uses the standard pressing depth for you.` });
  out.push(sq.sqDepth > 105
    ? { title: 'Your squat depth', detail: `Your deepest comfortable squat bends your knees to ${b.kneeMin}°. QK judges your depth against your own range (${sq.sqDepth}° or deeper), not a textbook number. The mobility work below will let you go deeper over time.` }
    : { title: 'Your squat depth', detail: `You squat deep comfortably (knees to ${b.kneeMin}°). QK asks for at least ${sq.sqDepth}° on every rep.` });
  if (sq.tightAnkles) out.push({ title: 'Tight ankles', detail: `Your shins only tilt forward to ${b.shinAtDepth}° at the bottom${b.heelRise > 0.2 ? ' and your heels lift' : ''}, which means your ankles don't bend much. That pushes your chest forward and your heels up in squats and lunges. Try small plates under your heels or a slightly wider stance, and stretch your calves daily (knee-to-wall drill, 3 × 30 s each side).`, fix: true });
  else if (b.shinAtDepth != null) out.push({ title: 'Ankles move well', detail: `Your shins tilt forward to ${b.shinAtDepth}° with your heels down. That's good ankle mobility for squatting.` });
  // Trunk-to-thigh angle in a soft-knee hinge. A straight-leg raise under 80° (trunk-thigh > 100°
  // with straight legs) marks reduced hamstring length (NSCA PTQ 7.1); soft knees add ~15°, so > 85° here.
  if (b.hingeMin != null) out.push(b.hingeMin > 85
    ? { title: 'Tight hamstrings', detail: `In a hinge your trunk only folds to ${b.hingeMin}° from your thighs, which points to short hamstrings. QK sets your Romanian deadlift depth to your range (folding to ${b.hingeMin + 20}° or deeper) and won't ask you to go lower than your back can stay flat. Hamstring stretches and slow RDLs will raise it.`, fix: true }
    : { title: 'Hamstrings', detail: `You hinge to ${b.hingeMin}° with soft knees: good hamstring length. QK expects you to fold to ${b.hingeMin + 20}° or deeper on Romanian deadlifts.` });
  if (b.shoulderFlex != null) out.push(b.shoulderFlex < 160
    ? { title: 'Limited overhead reach', detail: `Your arms reach ${b.shoulderFlex}° overhead (about 170–180° is typical). In overhead presses and pull-downs your lower back may arch to make up for it. Keep your ribs down, press slightly in front of your head, and work on lat and chest stretches.`, fix: true }
    : { title: 'Shoulders reach overhead well', detail: `Your arms reach ${b.shoulderFlex}° overhead, enough for presses and pull-ups without arching.` });
  if (b.elbowStraight != null && b.elbowStraight < 170) out.push({ title: 'Your elbows don\'t fully straighten', detail: `Your elbows straighten to about ${b.elbowStraight}°. That's common, often from bone shape. QK judges lockouts against that, so you're never told to straighten past what your joints allow.` });
  if (b.kneeRatioStand != null) {
    const caved = b.kneeRatioBottom != null && b.kneeRatioBottom < sq.sqValgus;
    out.push(caved
      ? { title: 'Knees drift in at the bottom', detail: `Your knees came in to ${Math.round(b.kneeRatioBottom * 100)}% of your foot width at the bottom, even with no weight. QK will watch this closely in squats and lunges. Strengthen the outside of your hips (banded side steps, 3 × 15) and think "spread the floor".`, fix: true }
      : { title: 'Knees track well', detail: `Your knees stay in line with your feet as you squat. QK will call it out if that changes under load.` });
  }
  return out;
}
