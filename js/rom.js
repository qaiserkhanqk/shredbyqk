// Clinical measurement tests from one camera, used by the Rehab clinic to track progress objectively.
// Each test says which camera view it needs. Only movements that happen ACROSS the camera's view are
// measured (twisting movements, such as shoulder rotation with the arm at the side, are not, because one camera can't do them reliably).
// Results are compared with the client's other side and their own earlier results, which matters more
// than population norms: a ratio between sides cancels most camera and scale error.
import { angle, fromVertical, bestSide, mid, dist } from './angles.js';
import { measuredFps } from './measure.js';

const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] ?? NaN; };
// Robust peak: the 95th percentile, not the single max, so one jittery frame can't inflate a result.
const p95 = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * 0.95))] : NaN; };
const p05 = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length * 0.05)] : NaN; };
const vis = (px, ids) => ids.every(i => px[i] && px[i].v >= 0.6);
const sideName = s => (s === 'left' || s === 'L' ? 'L' : 'R');

/** Count repetitions of a signal crossing low→high thresholds (hysteresis), e.g. sit-to-stands. */
function countCycles(sig, lowT, highT) {
  let state = 'high', n = 0;
  for (const v of sig) { if (!Number.isFinite(v)) continue; if (state === 'high' && v < lowT) state = 'low'; else if (state === 'low' && v > highT) { state = 'high'; n++; } }
  return n;
}

export const ROM_TESTS = {
  shoulderFlexion: {
    name: 'Shoulder forward raise', view: 'side', unit: '°', secs: 12, norm: '160–180°', higher: true,
    how: 'Stand side-on, the arm to test nearest the camera. Raise your straight arm forward and up as high as you can, 3 times, slowly.',
    measure: frames => { const s = bestSide(frames[0].px).side; const v = frames.map(f => { const b = bestSide(f.px); return [b.hip, b.sh, b.el].every(q => q.v >= 0.6) ? angle(b.hip, b.sh, b.el) : NaN; }); return { value: p95(v), side: sideName(s) }; }, // side-on: only the near arm is visible
  },
  shoulderAbduction: {
    name: 'Shoulder side raise', view: 'front', unit: '°', secs: 12, norm: '160–180°', higher: true, bothSides: true,
    how: 'Face the camera. Raise both straight arms out to the side and up as high as you can, 3 times, slowly.',
    measure: frames => ({ L: p95(frames.map(f => vis(f.px, [11, 13, 23]) ? angle(f.px[23], f.px[11], f.px[13]) : NaN)), R: p95(frames.map(f => vis(f.px, [12, 14, 24]) ? angle(f.px[24], f.px[12], f.px[14]) : NaN)) }),
  },
  trunkFlexion: {
    name: 'Forward bend', view: 'side', unit: '°', secs: 12, norm: 'compare with your own baseline', higher: true,
    how: 'Stand side-on, knees straight. Slowly bend forward as far as is comfortable, reaching towards your toes, then come back up. 3 times.',
    measure: frames => ({ value: p95(frames.map(f => { const b = bestSide(f.px); return b.sh.v >= 0.6 && b.hip.v >= 0.6 ? fromVertical(b.hip, b.sh) : NaN; })) }), // near side only (side-on)
  },
  trunkExtension: {
    name: 'Backward bend', view: 'side', unit: '°', secs: 12, norm: 'about 20–30°', higher: true,
    how: 'Stand side-on, hands on your lower back. Slowly lean backwards as far as is comfortable, then return. 3 times.',
    measure: frames => {
      const dir = Math.sign(med(frames.map(f => (f.px[31].x - f.px[29].x) + (f.px[32].x - f.px[30].x)))) || 1;
      return { value: p95(frames.map(f => { const b = bestSide(f.px); if (b.sh.v < 0.6 || b.hip.v < 0.6) return NaN; return Math.sign(dir * (b.sh.x - b.hip.x)) < 0 ? fromVertical(b.hip, b.sh) : 0; })) };
    },
  },
  kneeFlexion: {
    name: 'Knee bend', view: 'side', unit: '°', secs: 12, norm: '135°+ (full bend)', higher: true,
    how: 'Lie or sit side-on, the knee to test nearest the camera. Slide your heel towards your bottom as far as you can, 3 times.',
    measure: frames => { const s = bestSide(frames[0].px).side; return { value: p95(frames.map(f => { const b = bestSide(f.px); return 180 - angle(b.hip, b.kn, b.an); })), side: sideName(s) }; },
  },
  kneeExtension: {
    name: 'Knee straightening', view: 'side', unit: '° short of straight', secs: 10, norm: '0° (fully straight)', higher: false,
    how: 'Sit or lie side-on, the knee to test nearest the camera. Straighten the knee as fully as you can and hold for 3 seconds, twice.',
    measure: frames => { const s = bestSide(frames[0].px).side; return { value: Math.max(0, 180 - p95(frames.map(f => { const b = bestSide(f.px); return angle(b.hip, b.kn, b.an); }))), side: sideName(s) }; },
  },
  ankleDorsiflexion: {
    name: 'Knee-to-wall ankle bend', view: 'side', unit: '° shin angle', secs: 12, norm: 'about 35°+; compare sides', higher: true,
    how: 'Side-on, facing a wall, test foot in front. Keeping your heel down, push your knee forward towards the wall as far as you can, 3 times.',
    measure: frames => {
      // The front leg's shin angle from vertical at its most forward point (weight-bearing lunge test).
      const s = bestSide(frames[0].px).side;
      return { value: p95(frames.map(f => { const b = bestSide(f.px); return fromVertical(b.an, b.kn); })), side: sideName(s) };
    },
  },
  chairStand30: {
    name: '30-second sit-to-stand', view: 'side', unit: 'reps', secs: 30, norm: 'compare with age norms and your baseline', higher: true,
    how: 'Side-on, arms crossed on your chest, sitting on a firm chair. Stand fully up and sit back down as many times as you can in 30 seconds.',
    measure: frames => ({ value: countCycles(frames.map(f => { const b = bestSide(f.px); return angle(b.hip, b.kn, b.an); }), 115, 155) }),
  },
  calfRaiseEndurance: {
    name: 'Single-leg calf raise endurance', view: 'side', unit: 'reps', secs: 60, norm: '25+ reps is a common return-to-running mark', higher: true, chooseSide: true,
    how: 'Side-on, on one leg, fingertips on a wall for balance. Rise as high as you can and lower fully, one per 2 seconds, until you can\'t keep the height.',
    measure: frames => {
      // Heel height relative to the toes, normalised by foot length; count full rises.
      const lift = frames.map(f => { const b = bestSide(f.px), heel = b.side === 'left' ? f.px[29] : f.px[30]; const foot = dist(heel, b.ft) || 1; return (b.ft.y - heel.y) / foot; });
      const lo = p05(lift), hi = p95(lift), span = hi - lo;
      return { value: span > 0.15 ? countCycles(lift.map(v => -v), -(lo + span * 0.75), -(lo + span * 0.25)) : 0 };
    },
  },
  hop: {
    name: 'Single-leg hop for distance', view: 'side', unit: 'cm', secs: 15, norm: '90%+ of the other leg to return to sport', higher: true, chooseSide: true, needsScale: true,
    how: 'Side-on, 3–4 m from the camera with space in front. Hop as far as you can on one leg and stick the landing for 2 seconds. Do 2 hops on each leg.',
    measure: (frames, { mPerPx }) => {
      if (!mPerPx) return { value: NaN, issue: 'Add your height in Profile so hop distance can be measured.' };
      const footY = f => Math.max(f.px[27].y, f.px[28].y, f.px[29].y, f.px[30].y, f.px[31].y, f.px[32].y);
      const ground = med(frames.slice(0, 15).map(footY));
      const shin = med(frames.slice(0, 15).map(f => Math.abs(f.px[27].y - f.px[25].y))) || 50;
      const air = frames.map(f => ground - footY(f) > shin * 0.08);
      const ankleX = f => (f.px[27].x + f.px[28].x) / 2;
      const hops = [];
      for (let i = 1; i < frames.length; i++) if (air[i] && !air[i - 1]) {
        let j = i; while (j < frames.length && air[j]) j++;
        if (j < frames.length && j - i >= 2) hops.push(Math.abs(ankleX(frames[Math.min(j + 2, frames.length - 1)]) - ankleX(frames[Math.max(0, i - 1)])) * mPerPx * 100);
        i = j;
      }
      return { value: hops.length ? Math.max(...hops) : NaN, trials: hops.map(h => Math.round(h)) };
    },
  },
  landingFPPA: {
    name: 'Drop-landing knee control', view: 'front', unit: '° knee drift', secs: 15, norm: 'under about 10°; compare sides', higher: false, bothSides: true,
    how: 'Face the camera, standing on a 30 cm box. Drop off, land on both feet and jump straight up. 3 times. Watch whether your knees cave in on landing.',
    measure: async frames => {
      const { fppa } = await import('./kneetest.js');
      // Landing = the 0.25 s after the hips are lowest following a drop; take the worst (95th percentile) drift.
      const hipY = frames.map(f => (f.px[23].y + f.px[24].y) / 2), deep = [];
      for (let i = 3; i < frames.length - 3; i++) if (hipY[i] >= Math.max(...hipY.slice(i - 3, i + 4)) && hipY[i] > med(hipY) + 10) deep.push(i);
      const win = deep.flatMap(i => frames.slice(Math.max(0, i - 4), i + 4));
      const use = win.length ? win : frames;
      return { L: p95(use.map(f => fppa(f.px, 'L'))), R: p95(use.map(f => fppa(f.px, 'R'))) };
    },
  },
};

/**
 * Run a test. Returns { ok, value | L,R, unit, lsi?, issues[] }.
 * LSI (limb symmetry index) = tested side ÷ other side × 100, when the other side has a result.
 */
export async function runRomTest(id, frames, { mPerPx = null } = {}) {
  const t = ROM_TESTS[id];
  if (!t) throw new Error('Unknown test ' + id);
  const issues = [];
  if (frames.length < 20) return { ok: false, issues: ['The recording was too short. Follow the instructions for the full time.'] };
  const fps = measuredFps(frames.map(f => f.t));
  const r = await t.measure(frames, { mPerPx });
  if (r.issue) issues.push(r.issue);
  const vals = t.bothSides ? [r.L, r.R] : [r.value];
  if (!vals.some(Number.isFinite)) return { ok: false, issues: issues.length ? issues : ['No clear movement was measured. Check the camera view in the instructions and try again.'] };
  const round = v => (Number.isFinite(v) ? Math.round(v * 10) / 10 : null);
  return { ok: true, test: id, unit: t.unit, fps: Math.round(fps), value: round(r.value), side: r.side, L: round(r.L), R: round(r.R), trials: r.trials, issues };
}

/** Limb symmetry index (%). For "lower is better" measures (e.g. knee drift) the ratio is inverted. */
export function lsi(tested, other, higherIsBetter = true) {
  if (!Number.isFinite(tested) || !Number.isFinite(other) || other === 0 || tested === 0) return null;
  return Math.round((higherIsBetter ? tested / other : other / tested) * 100);
}
