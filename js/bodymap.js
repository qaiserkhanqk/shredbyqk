// "Map my body": a 30-second calibration that measures THIS person, so form is judged against
// their own body instead of one textbook number for everyone.
//
// What it measures (side-on: standing, then 3 slow bodyweight squats; then facing the camera: 2 more):
//  - Limb proportions: thigh-to-torso and shin-to-thigh ratios. Long thighs force more forward lean
//    in a squat to stay balanced over the feet (Fry et al. 2003; Demers et al. 2018).
//  - Their comfortable depth: the deepest knee angle reached with good balance.
//  - Ankle mobility proxy: how far the shin tilts forward at the bottom, and whether the heels rise.
//    Limited dorsiflexion reduces squat depth and increases trunk lean (Kim et al. 2015; Macrum 2012).
//  - Natural lean at depth, and their natural knee width standing and at the bottom (front view).
// The results become personal thresholds that the rep engine uses (see personalThresholds).
import { angle, fromVertical, dist, bestSide, viewOf } from './angles.js';

const med = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const r2 = x => (x == null ? null : Math.round(x * 100) / 100);

/** @param frames [{t, px}] covering the whole calibration (side then front) */
export function analyseBodyMap(frames) {
  const side = [], front = [];
  for (const f of frames) {
    const p = f.px; if (!p) continue;
    const s = bestSide(p); if (s.conf < 0.55) continue;
    (viewOf(p) === 'side' ? side : front).push({ ...f, s });
  }
  const out = { at: Date.now(), ok: false, issues: [] };
  if (side.length < 30) { out.issues.push('I couldn\'t see you side-on for long enough. Stand side-on, whole body in view.'); return out; }

  // --- side: standing proportions
  const knee = side.map(f => angle(f.s.hip, f.s.kn, f.s.an));
  const standing = side.filter((f, i) => knee[i] > 165);
  if (standing.length < 8) { out.issues.push('Stand still and tall for a few seconds at the start.'); return out; }
  const torso = med(standing.map(f => dist(f.s.sh, f.s.hip))), femur = med(standing.map(f => dist(f.s.hip, f.s.kn))), tibia = med(standing.map(f => dist(f.s.kn, f.s.an)));
  out.femurTorso = r2(femur / torso); out.tibiaFemur = r2(tibia / femur);
  const heelOf = s => (s.he && s.ft && s.he.v > 0.4 && s.ft.v > 0.4 ? (s.ft.y - s.he.y) / (dist(s.he, s.ft) || 1) : null);
  const heelStand = med(standing.map(f => heelOf(f.s)).filter(v => v != null));

  // --- side: each squat's deepest frame (a rep = knee below 140° between standing phases)
  const bottoms = []; let cur = null;
  side.forEach((f, i) => {
    if (knee[i] < 140) { if (!cur || knee[i] < cur.k) cur = { k: knee[i], f }; }
    else if (knee[i] > 155 && cur) { bottoms.push(cur); cur = null; }
  });
  if (cur) bottoms.push(cur);
  if (bottoms.length < 2) { out.issues.push('Do three slow squats side-on, as deep as is comfortable.'); return out; }
  out.reps = bottoms.length;
  out.kneeMin = Math.round(med(bottoms.map(b => b.k)));
  out.leanAtDepth = Math.round(med(bottoms.map(b => fromVertical(b.f.s.hip, b.f.s.sh))));
  out.shinAtDepth = Math.round(med(bottoms.map(b => fromVertical(b.f.s.an, b.f.s.kn))));
  const hb = bottoms.map(b => heelOf(b.f.s)).filter(v => v != null);
  out.heelRise = heelStand != null && hb.length ? r2(Math.max(0, med(hb) - heelStand)) : null;

  // --- front (optional): natural knee width standing and at the bottom
  if (front.length >= 20) {
    const ratio = f => dist(f.px[25], f.px[26]) / (dist(f.px[27], f.px[28]) || 1);
    const hipY = f => (f.px[23].y + f.px[24].y) / 2;
    const ys = front.map(hipY), top = Math.min(...ys), low = Math.max(...ys), span = low - top;
    const stand = front.filter(f => hipY(f) < top + span * 0.15), deep = front.filter(f => hipY(f) > low - span * 0.15);
    if (span > 20 && stand.length >= 5 && deep.length >= 3) { out.kneeRatioStand = r2(med(stand.map(ratio))); out.kneeRatioBottom = r2(med(deep.map(ratio))); }
  }
  out.ok = true;
  return out;
}

// Textbook defaults, used when there's no body map.
export const DEFAULTS = { sqDepth: 105, sqValgus: 0.8 };
export const anthroLeanLimit = femurTorso => Math.min(60, Math.max(38, 45 + (femurTorso - 0.85) * 60));

/**
 * Personal thresholds for the rep engine. Every number moves only in the lifter's favour where
 * their body explains it (longer thighs → more lean allowed; limited range → depth judged
 * against their range), so they're not told to do something their body can't.
 */
export function personalThresholds(b) {
  if (!b?.ok) return null;
  const P = { personal: true };
  // Depth: judged against their own comfortable range (with a little room to work), never
  // stricter than the standard.
  P.sqDepth = Math.max(DEFAULTS.sqDepth, b.kneeMin + 10);
  // Rep counting follows their range too, or a lifter who can't reach the textbook depth would
  // never get a rep counted at all.
  P.downT = Math.max(115, b.kneeMin + 20);
  // Lean: the larger of what their proportions need and what their own bodyweight squat shows.
  P.sqLean = Math.round(Math.min(62, Math.max(anthroLeanLimit(b.femurTorso), b.leanAtDepth + 6)));
  P.femurTorso = b.femurTorso;
  // Knees: some people stand with their knees naturally closer than their ankles. Caving in is
  // judged as a drop from THEIR standing alignment, not a fixed ratio.
  P.sqValgus = b.kneeRatioStand ? Math.min(DEFAULTS.sqValgus, r2(b.kneeRatioStand * 0.85)) : DEFAULTS.sqValgus;
  P.tightAnkles = (b.shinAtDepth != null && b.shinAtDepth < 28) || (b.heelRise != null && b.heelRise > 0.2);
  return P;
}

/** Plain-language findings for the "Your body" card. */
export function explainBodyMap(b) {
  if (!b?.ok) return [];
  const P = personalThresholds(b), out = [];
  const ft = b.femurTorso;
  out.push(ft >= 0.95
    ? { title: 'Long thighs for your torso', detail: `Your thigh-to-torso ratio is ${ft} (about 0.85 is typical). To stay balanced over your feet you have to lean forward more in a squat, so that's normal for you. QK allows you up to ${P.sqLean}° of lean instead of the usual 45°.` }
    : ft <= 0.78
      ? { title: 'Short thighs for your torso', detail: `Your thigh-to-torso ratio is ${ft}. You can squat quite upright, so QK expects your chest to stay tall (up to ${P.sqLean}° of lean).` }
      : { title: 'Typical proportions', detail: `Your thigh-to-torso ratio is ${ft}. QK allows up to ${P.sqLean}° of forward lean at the bottom of your squat.` });
  out.push(P.sqDepth > DEFAULTS.sqDepth
    ? { title: 'Your depth', detail: `Your deepest comfortable squat bends your knees to ${b.kneeMin}°. QK judges your depth against your own range (target ${P.sqDepth}° or deeper), not a textbook number. The mobility work below will let you go deeper over time.` }
    : { title: 'Your depth', detail: `You squat deep comfortably (knees to ${b.kneeMin}°). QK asks for at least ${P.sqDepth}° on every rep.` });
  if (P.tightAnkles) out.push({ title: 'Tight ankles', detail: `Your shins only tilt forward to ${b.shinAtDepth}° at the bottom${b.heelRise > 0.2 ? ' and your heels lift' : ''} (35° or more is typical). That pushes your chest forward and your heels up. Try small plates under your heels or a slightly wider stance, and stretch your calves daily (knee-to-wall drill, 3 × 30 s each side).`, fix: true });
  else if (b.shinAtDepth != null) out.push({ title: 'Ankles move well', detail: `Your shins tilt forward to ${b.shinAtDepth}° with your heels down. That's good ankle mobility for squatting.` });
  if (b.kneeRatioStand != null) {
    const caved = b.kneeRatioBottom != null && b.kneeRatioBottom < P.sqValgus;
    out.push(caved
      ? { title: 'Knees drift in at the bottom', detail: `Your knees came in to ${Math.round(b.kneeRatioBottom * 100)}% of your foot width at the bottom, even with no weight. QK will watch this closely. Strengthen the outside of your hips (banded side steps, 3 × 15) and think "spread the floor".`, fix: true }
      : { title: 'Knees track well', detail: `Your knees stay in line with your feet as you squat. QK will call it out if that changes under load.` });
  }
  return out;
}
