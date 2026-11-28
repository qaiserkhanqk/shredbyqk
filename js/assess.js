// Assessment beyond joint angles: how big a change has to be before it's real, strength checks,
// short validated questions, and the statistics for checking the app against a physio's goniometer.

// ---------------- Measurement error ----------------
// The app's working margin: the smallest change it counts as real, in degrees. These are working
// estimates from published studies (phone inclinometer close to a goniometer; single camera about 4–5° at
// best for hip and knee, worse for the shoulder and ankle), doubled to allow for home conditions.
// Replace them with the numbers from our own accuracy study (see TESTING.md) once it has been run.
export const MEASURE_ERROR = {
  sensor: { default: 5 },
  camera: { default: 8, shoulderFlexion: 12, shoulderAbduction: 12, ankleDorsiflexion: 10, trunkFlexion: 10, trunkExtension: 10, landingFPPA: 8 },
};
export const errorFor = (test, method = 'camera') => {
  const m = MEASURE_ERROR[method] || MEASURE_ERROR.camera;
  return m[test] ?? m.default;
};

/**
 * Is the change from `before` to `after` bigger than measurement error?
 * Returns { change, real, band }. When the two readings came from different methods, the larger error counts.
 */
export function realChange(test, before, after) {
  if (!before || !after || !Number.isFinite(before.value) || !Number.isFinite(after.value)) return null;
  const band = Math.max(errorFor(test, before.method), errorFor(test, after.method));
  const change = Math.round((after.value - before.value) * 10) / 10;
  return { change, real: Math.abs(change) > band, band };
}

// ---------------- Strength checks ----------------
// Joint angles don't show strength, and strength is what most rehab works on. These checks need no equipment:
// reps are counted by the person, holds are timed by the app. Each side is tested, so the two can be compared.
// kind: 'reps' (counted) or 'hold' (seconds, timed in the app).
export const STRENGTH_TESTS = {
  slSitToStand: { name: 'Single-leg sit-to-stand', kind: 'reps', unit: 'reps', sides: true, areas: ['Knee', 'Hip', 'Thigh'],
    how: 'Sit on a chair next to a wall, arms crossed. Stand up and sit down on one leg, slowly, as many times as you can with good control. Steady yourself on the wall if you need to. Stop when your knee wobbles inwards, you need your hands, or pain goes above your limit.' },
  slBridge: { name: 'Single-leg bridge', kind: 'reps', unit: 'reps', sides: true, areas: ['Knee', 'Hip', 'Thigh', 'Lower back'],
    how: 'Lie on your back, one foot flat with the knee bent, the other leg straight up. Lift your hips until they are level and lower again, as many times as you can with good control. Stop when your hips twist or drop, or pain goes above your limit.' },
  sidePlank: { name: 'Side plank hold', kind: 'hold', unit: 's', sides: true, areas: ['Lower back', 'Hip'],
    how: 'Lie on your side, propped on the elbow, knees straight. Lift your hips into a straight line and hold as long as you can with good form. Stop when the hips drop or pain goes above your limit.' },
  calfRaiseCount: { name: 'Single-leg calf raises (counted)', kind: 'reps', unit: 'reps', sides: true, areas: ['Ankle & foot', 'Shin'],
    how: 'Stand on one leg, fingertips on a wall. Rise onto your toes as high as you can and lower slowly, as many times as you can at the same height. Stop when you can\'t rise as high, or pain goes above your limit.' },
  armHold: { name: 'Straight-arm side hold', kind: 'hold', unit: 's', sides: true, areas: ['Shoulder', 'Elbow'],
    how: 'Stand holding a full 500 ml water bottle. Raise the straight arm out to the side to shoulder height, or as high as is comfortable if that\'s lower, and hold as long as you can. Stop when the arm drops, or pain goes above your limit.' },
};
export const strengthFor = area => Object.entries(STRENGTH_TESTS).filter(([, t]) => t.areas.includes(area)).map(([id]) => id);

// Muscle groups a clinician can enter handheld dynamometer readings for (kg, each side).
export const DYNAMOMETER_GROUPS = {
  kneeExt: 'Knee straighteners (quadriceps)', kneeFlex: 'Knee benders (hamstrings)', hipAbd: 'Hip side-lifters (abductors)',
  hipExt: 'Hip extensors (glutes)', ankle: 'Ankle pushers (calf)', shoulderER: 'Shoulder outward rotators', shoulderAbd: 'Shoulder side-lifters', grip: 'Grip',
};

/** Latest result of a strength check, with the injured side as a % of the other side. */
export function strengthSummary(rows = [], injured = null) {
  const out = [];
  for (const test of [...new Set(rows.map(r => r.test))]) {
    const r = rows.filter(x => x.test === test);
    // Each side is often tested on its own, so take the first and latest reading per side.
    const pick = (list, side) => list.find(x => x[side] != null)?.[side] ?? null;
    const rev = [...r].reverse();
    const first = { L: pick(r, 'L'), R: pick(r, 'R') }, last = { L: pick(rev, 'L'), R: pick(rev, 'R'), method: rev[0].method };
    const name = STRENGTH_TESTS[test]?.name || (test.startsWith('dyn_') ? `Dynamometer: ${DYNAMOMETER_GROUPS[test.slice(4)] || test.slice(4)}` : test);
    const unit = STRENGTH_TESTS[test]?.unit || 'kg';
    const pct = (a, b) => (a != null && b ? Math.round(a / b * 100) : null);
    const inj = injured || (last.L != null && last.R != null ? (last.L <= last.R ? 'L' : 'R') : null);
    const oth = inj === 'L' ? 'R' : inj === 'R' ? 'L' : null;
    out.push({ test, name, unit, method: last.method || 'self', first, latest: { L: last.L, R: last.R },
      weaker: inj, lsi: inj ? pct(last[inj], last[oth]) : null });
  }
  return out;
}

// ---------------- Questions ----------------
// SANE (Single Assessment Numeric Evaluation): one question, 0–100 % of normal, validated across joints and free
// to use. GROC (global rating of change) at the weekly check-in: how it is now compared with the start.
// Longer licensed questionnaires (KOOS, ODI, QuickDASH) are NOT built in: their wording must be copied exactly,
// and several need a commercial licence. Add them only once a licence is confirmed.
export const saneQuestion = area => `How would you rate your ${area === 'Ankle & foot' ? 'ankle or foot' : (area || 'injury').toLowerCase()} today, as a percentage of normal? (0 = can't use it at all, 100 = completely normal)`;
export const GROC = [
  [-3, 'A lot worse'], [-2, 'Worse'], [-1, 'A little worse'], [0, 'About the same'], [1, 'A little better'], [2, 'Better'], [3, 'A lot better'],
];
export const GROC_QUESTION = 'Compared with when you started this programme, how is it now?';
// SANE change of about 10–20 points is often reported as meaningful; 15 is used here as the working mark.
export const SANE_MEANINGFUL = 15;
export function saneTrend(rows = []) {
  if (!rows.length) return null;
  const first = rows[0].value, latest = rows[rows.length - 1].value;
  return { first, latest, change: latest - first, meaningful: Math.abs(latest - first) >= SANE_MEANINGFUL };
}

// ---------------- Accuracy check against a physio's goniometer ----------------
/**
 * Bland–Altman agreement between app readings and a reference (goniometer) reading of the same movement.
 * pairs: [{ app, ref }]. Returns n, bias (mean app − ref), sd, 95% limits of agreement, mean absolute error.
 */
export function agreement(pairs = []) {
  const p = pairs.filter(x => Number.isFinite(x.app) && Number.isFinite(x.ref));
  const n = p.length;
  if (!n) return { n: 0 };
  const d = p.map(x => x.app - x.ref);
  const bias = d.reduce((s, v) => s + v, 0) / n;
  const sd = n > 1 ? Math.sqrt(d.reduce((s, v) => s + (v - bias) ** 2, 0) / (n - 1)) : 0;
  const mae = d.reduce((s, v) => s + Math.abs(v), 0) / n;
  const r1 = v => Math.round(v * 10) / 10;
  return { n, bias: r1(bias), sd: r1(sd), loaLow: r1(bias - 1.96 * sd), loaHigh: r1(bias + 1.96 * sd), mae: r1(mae) };
}

// Summaries of app-vs-goniometer pairs are only shown from this many pairs: fewer looks like a validation result.
export const AGREEMENT_MIN_PAIRS = 5;

/**
 * CSV for a formal accuracy study (lab or ethics-approved clinic study; NOT wired to the app until consent and
 * ethics approval exist, see TESTING.md), in the format `npm run validate` reads (subject,metric,app,reference first).
 * One row per pair. The metric is test + method, so camera and phone-sensor accuracy are reported separately.
 * No names: subject is a pair number only.
 */
export function agreementCsv(pairs = []) {
  const head = 'subject,metric,app,reference,date,side,entered_by_role';
  const rows = pairs.map((x, i) => [`pair${i + 1}`, `${x.test}_${x.method || 'camera'}`, x.app, x.ref, new Date(x.at).toISOString().slice(0, 10),
    x.side || '', (x.role || '').replace(/,/g, ' ')].join(','));
  return [head, ...rows].join('\n');
}
