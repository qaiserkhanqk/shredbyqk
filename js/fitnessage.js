// Fitness Age: your estimated aerobic fitness (VO2peak) turned into the age whose healthy average matches it.
// Pure maths, unit tested. Research and exact sources: SCIENCE.md, "Fitness Age".
//
// 1. Estimated fitness (eCRF, mL/kg/min): the HUNT Study non-exercise model (Nauman et al. 2017, as printed in
//    doi:10.3389/fnbeh.2019.00053, doi:10.1161/JAHA.118.010293 and doi:10.1038/s41598-025-29410-7):
//      men   = 105.91 − 0.334·age − 0.402·waist − 0.144·restingHR + 3.102·PA
//      women =  78.00 − 0.297·age − 0.270·waist − 0.110·restingHR + 2.674·PA
//    PA = 1 when you meet the activity guideline (150 min moderate or 75 min vigorous a week), else 0.
// 2. Fitness Age: the age at which healthy Norwegians of your sex average that VO2max
//    (HUNT 3 fitness study, 4,631 healthy adults, Aspenes et al. 2011, doi:10.1371/journal.pone.0064319, Table 2).
// Estimated fitness predicts mortality: each 1 MET (3.5 mL/kg/min) higher ≈ 15% lower all-cause death risk in men
// (Nes et al. 2014, doi:10.1249/MSS.0000000000000219).

export const EQ = {
  male: { c: 105.91, age: 0.334, waist: 0.402, rhr: 0.144, pa: 3.102 },
  female: { c: 78.0, age: 0.297, waist: 0.27, rhr: 0.11, pa: 2.674 },
};

// Mean VO2max (mL/kg/min) by age group, healthy HUNT 3 participants (Aspenes 2011, Table 2). Plotted at group mid-age.
export const REF = {
  male: [[25, 54.4], [35, 49.1], [45, 47.2], [55, 42.6], [65, 39.2], [75, 35.3]],
  female: [[25, 43.0], [35, 40.0], [45, 38.4], [55, 34.4], [65, 31.1], [75, 28.3]],
};
export const MIN_AGE = 18, MAX_AGE = 90;
const sexOf = s => (s === 'female' ? 'female' : 'male');

/** Is this complete enough to calculate? Returns the missing pieces (empty = ready). */
export function missing({ sex, age, waistCm, rhr } = {}) {
  const m = [];
  if (!sex) m.push('sex');
  if (!(age >= MIN_AGE && age <= MAX_AGE)) m.push('age');
  if (!(waistCm >= 50 && waistCm <= 200)) m.push('waist');
  if (!(rhr >= 30 && rhr <= 130)) m.push('rhr');
  return m;
}

/** Estimated VO2peak (mL/kg/min) from the HUNT non-exercise model. */
export function ecrf({ sex, age, waistCm, rhr, active }) {
  const e = EQ[sexOf(sex)];
  return e.c - e.age * age - e.waist * waistCm - e.rhr * rhr + e.pa * (active ? 1 : 0);
}

/** Average VO2max of healthy people this age (linear between age groups, end slopes carried beyond). */
export function refVo2(age, sex) {
  const r = REF[sexOf(sex)];
  let i = r.findIndex(([a]) => a >= age);
  if (i <= 0) i = i === 0 ? 1 : r.length - 1; // before first point → first segment; after last → last segment
  const [a0, v0] = r[i - 1], [a1, v1] = r[i];
  return v0 + (v1 - v0) * (age - a0) / (a1 - a0);
}

/** The age whose healthy average matches this VO2, rounded to a whole year and kept within 18–90. */
export function ageForVo2(vo2, sex) {
  const r = REF[sexOf(sex)];
  let i = r.findIndex(([, v]) => v <= vo2); // reference falls with age
  if (i <= 0) i = i === 0 ? 1 : r.length - 1;
  const [a0, v0] = r[i - 1], [a1, v1] = r[i];
  const a = a0 + (a1 - a0) * (vo2 - v0) / (v1 - v0);
  return Math.round(Math.min(MAX_AGE, Math.max(MIN_AGE, a)));
}

/** Weekly activity from the training log: does it meet 150 min moderate / 75 min vigorous? */
export function meetsGuideline({ weeks = [], minsPerSession = 50 } = {}) {
  // weeks: sessions per week for recent full weeks (most recent last). Needs 2+ weeks so one good week isn't enough.
  if (weeks.length < 2) return null;
  const avg = weeks.reduce((a, b) => a + b, 0) / weeks.length;
  return avg * minsPerSession >= 150;
}

/** Full result. */
export function fitnessAge(input) {
  if (missing(input).length) return null;
  const vo2 = ecrf(input), fa = ageForVo2(vo2, input.sex);
  return { vo2: Math.round(vo2 * 10) / 10, met: Math.round(vo2 / 3.5 * 10) / 10, fitnessAge: fa, diff: fa - Math.round(input.age), pct: Math.round(vo2 / refVo2(input.age, input.sex) * 100) };
}

/** What would make you younger: the changes in your control, each with the years it's worth. Biggest first. */
export function levers(input) {
  const base = fitnessAge(input); if (!base) return [];
  const male = sexOf(input.sex) === 'male', out = [];
  const gain = (id, text, change) => {
    const r = fitnessAge({ ...input, ...change });
    const years = base.fitnessAge - r.fitnessAge;
    if (years >= 1) out.push({ id, text, years });
  };
  if (!input.active) gain('active', 'Train or move briskly 150 minutes a week (3 sessions of 50 minutes counts)', { active: true });
  // WHO waist cut-offs for raised risk: 94 cm men, 80 cm women.
  if (input.waistCm > (male ? 94 : 80)) gain('waist', 'Bring your waist down 5 cm', { waistCm: input.waistCm - 5 });
  if (input.rhr > 60) gain('rhr', 'Lower your resting heart rate by 5 beats (regular cardio does this)', { rhr: input.rhr - 5 });
  return out.sort((a, b) => b.years - a.years);
}

/** Retest due? Monthly, so changes have time to show. */
export const RETEST_DAYS = 30;
export const retestDue = (tests = [], now = Date.now()) => tests.length > 0 && now - tests[tests.length - 1].at >= RETEST_DAYS * 864e5;

/* ---------- Extra body markers: each compared with what the research found, not part of the number ---------- */

/** Push-ups in one go (men, Yang et al. 2019, doi:10.1001/jamanetworkopen.2018.8341). */
export function pushupNote(n) {
  if (!(n >= 0)) return null;
  if (n > 40) return { level: 'great', text: 'Over 40: men in this range had 96% fewer heart events over 10 years than those under 10.' };
  if (n >= 11) return { level: 'ok', text: `${n}: every step towards 40 counts. Men doing over 40 had 96% fewer heart events than those under 10.` };
  return { level: 'low', text: `${n}: a good one to build. Men doing 10 or fewer had the most heart events in the study.` };
}

/** Sit-and-rise score, 0–10 (Brito et al. 2012, doi:10.1177/2047487312471759). Start at 10, minus 1 per hand, knee,
 *  forearm or leg-side used for support (down and up), minus 0.5 for a wobble. */
export function sitRiseNote(score) {
  if (!(score >= 0 && score <= 10)) return null;
  if (score >= 8) return { level: 'great', text: `${score}/10: the top group in the study, with the lowest death rate.` };
  if (score >= 4) return { level: 'ok', text: `${score}/10: each extra point was linked to 21% lower mortality. Mobility and leg strength move it.` };
  return { level: 'low', text: `${score}/10: the group with the highest risk in the study. Squats, lunges and hip mobility work help most.` };
}

/** Resting heart rate note (Zhang et al. 2016, doi:10.1503/cmaj.150535: each 10 bpm higher ≈ 9% higher mortality). */
export function rhrNote(rhr) {
  if (!(rhr >= 30)) return null;
  if (rhr < 60) return { level: 'great', text: `${rhr} bpm: a strong heart. Lower resting rates go with longer lives.` };
  if (rhr <= 75) return { level: 'ok', text: `${rhr} bpm: normal. Each 10 beats lower was linked to about 9% lower mortality.` };
  return { level: 'low', text: `${rhr} bpm: on the high side. Each 10 beats higher was linked to about 9% higher mortality. Cardio brings it down.` };
}

/* ---------- When training stops ---------- */
// The HUNT model's activity term: stop meeting the guideline and the estimate drops by 3.1 (men) / 2.7 (women)
// mL/kg/min. We switch it off after 14 days with no training, so a busy week doesn't count against anyone.
export const LAPSE_DAYS = 14;
export function daysSinceTraining(sessions = [], now = Date.now()) {
  const real = sessions.filter(s => !s.demo).map(s => s.at);
  return real.length ? Math.floor((now - Math.max(...real)) / 864e5) : null;
}
/** The latest test re-scored for today: if they've stopped training, the activity term goes. */
export function liveFitAge(tests = [], sessions = [], now = Date.now()) {
  const t = tests[tests.length - 1]; if (!t) return null;
  const off = daysSinceTraining(sessions, now), lapsed = t.active && off !== null && off >= LAPSE_DAYS;
  if (!lapsed) return { ...t, lapsed: false, daysOff: off };
  const r = fitnessAge({ sex: t.sex, age: t.age, waistCm: t.waist, rhr: t.rhr, active: false });
  return { ...t, ...r, active: false, was: t.fitnessAge, lapsed: true, daysOff: off };
}
/** What it would be if they stopped now (sent to the server so a closed app can still be reminded). */
export function ifStopped(t) { return t?.active ? fitnessAge({ sex: t.sex, age: t.age, waistCm: t.waist, rhr: t.rhr, active: false })?.fitnessAge ?? null : null; }
