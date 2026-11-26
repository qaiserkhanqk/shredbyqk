// Progressive overload: QK picks the next weight from what you actually did last time.
// Pure functions, no browser APIs, so they are unit tested. Weights are stored in kg; the app
// converts for people who train in pounds.
//
// The method (evidence in SCIENCE.md, "Progression"):
//  - Beginners progress session to session (linear). Varying the week doesn't help untrained lifters
//    (Moesgaard et al. 2022, Sports Med).
//  - Once a lift stalls (missed twice), it moves to a weekly wave: heavy (5 reps), medium (8) and light
//    (12) days in rotation. Undulating beats linear for 1RM in trained lifters (Moesgaard 2022).
//  - Dumbbell, machine, cable and isolation lifts use double progression: add reps within a range, then
//    the smallest weight step. Adding reps works as well as adding load (Plotkin et al. 2022, PeerJ).
//  - The jump is autoregulated: it depends on last time's reps, how much the reps slowed (camera speed
//    loss tracks reps left in reserve; González-Badillo 2017, Rodríguez-Rosell 2020) and form. Autoregulated
//    loading matches or beats fixed percentages (Hickmott 2022; Zhang 2021).
//  - No weight is added to a lift that was only finished with form faults.
//  - Two misses in a row: back off 10% and build up again.
//  - Light weeks cut sets by a third and keep the weight (a full week off cost strength in Coleman 2024).

export const KG_PER_LB = 0.45359237;
export const toUnit = (kg, unit) => (unit === 'lb' ? kg / KG_PER_LB : kg);
export const fromUnit = (v, unit) => (unit === 'lb' ? v * KG_PER_LB : v);
export function fmtW(kg, unit = 'kg') {
  if (kg == null || !(kg > 0)) return '';
  const v = toUnit(kg, unit), r = Math.round(v * 4) / 4;
  return `${Number.isInteger(r) ? r : r.toFixed(r * 2 % 1 ? 2 : 1)} ${unit}`;
}

const SMALL = ['curl', 'triExt', 'raise', 'calf', 'fly', 'kneeExt', 'kneeFlex', 'shrug', 'facePull'];
const LOWER = ['squat', 'rdl', 'hipThrust', 'lunge'];
const BAR = ['Barbell', 'EZ bar'];

/** big-lower | big-upper | mid (dumbbell/machine/cable compound) | small (isolation) | null (not loaded) */
export function liftClass(item) {
  if (!item) return null;
  const eq = item.equipment;
  if (!['Barbell', 'EZ bar', 'Dumbbells', 'Dumbbell', 'Machine', 'Cable', 'Kettlebell', 'Kettlebells', 'Plate', 'Sandbag'].includes(eq)) return null;
  if (SMALL.includes(item.pattern)) return 'small';
  if (BAR.includes(eq)) return LOWER.includes(item.pattern) ? 'big-lower' : 'big-upper';
  return 'mid';
}

// Weight steps, in the lifter's own unit: what's actually loadable in a gym.
const STEP = {
  kg: { 'big-lower': 5, 'big-upper': 2.5, mid: 2.5, small: 1 },
  lb: { 'big-lower': 10, 'big-upper': 5, mid: 5, small: 2.5 },
};
// Rounding grain: barbells load in 2.5 kg / 5 lb (two smallest plates); others in 0.5 kg / 2.5 lb.
const GRAIN = { kg: { bar: 2.5, other: 0.5 }, lb: { bar: 5, other: 2.5 } };
export const stepKg = (cls, unit = 'kg') => fromUnit(STEP[unit][cls] || STEP[unit].mid, unit);
export function roundLoad(kg, cls, unit = 'kg') {
  const g = GRAIN[unit][cls?.startsWith('big') ? 'bar' : 'other'];
  return fromUnit(Math.max(g, Math.round(toUnit(kg, unit) / g) * g), unit);
}

// Rep targets.
export const WAVE = { heavy: { reps: 5, sets: 4, f: 1.1 }, medium: { reps: 8, sets: 3, f: 1 }, light: { reps: 12, sets: 3, f: 0.85 } };
const ORDER = ['heavy', 'medium', 'light'];
export const RANGE = { lo: 8, hi: 12, sets: 3 };
const LINEAR = { reps: 8, sets: 3 };

// Thresholds.
const CLEAN_OK = 0.8;   // at least 80% of reps clean
const GRIND = 0.3;      // reps slowed by 30%+: about 1–2 left in reserve, close to failure

const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };

/** Sets of one exercise grouped by training day, oldest first. Only real, weighted sets. */
export function sessionsOf(sets, ex) {
  const days = new Map();
  for (const s of sets) {
    if (s.ex !== ex || s.demo || s.guided || !(s.kg > 0) || !s.reps) continue;
    const k = dayKey(s.at); if (!days.has(k)) days.set(k, []); days.get(k).push(s);
  }
  return [...days.values()];
}

/** How a training day went, against its target. */
export function judge(day, target) {
  const work = day.filter(s => s.kg >= Math.max(...day.map(x => x.kg)) * 0.95); // working sets, not warm-ups
  const reps = work.map(s => s.reps), kg = Math.max(...work.map(s => s.kg));
  const tReps = target?.reps ?? day[0].target ?? LINEAR.reps;
  const clean = work.reduce((a, s) => a + Math.min(s.good ?? s.reps, s.reps), 0) / (reps.reduce((a, b) => a + b, 0) || 1);
  const slow = Math.max(0, ...work.map(s => s.vl || 0));
  return { kg, reps, tReps, hit: reps.length > 0 && Math.min(...reps) >= tReps, clean, grind: slow >= GRIND, cleanOk: clean >= CLEAN_OK, best: Math.max(...reps), worst: Math.min(...reps), sets: work.length };
}

/**
 * The next prescription for one exercise.
 * @param item library item, @param sets all logged sets, @param o { unit, light, now }
 * @returns { kg, reps, sets, day?, mode, action, why } or null when there's no weighted history yet.
 */
export function nextFor(item, sets, o = {}) {
  const unit = o.unit || 'kg', cls = liftClass(item);
  if (!cls) return null;
  const days = sessionsOf(sets, item.id);
  if (!days.length) return null;
  const step = stepKg(cls, unit), round = kg => roundLoad(kg, cls, unit);
  const last = days[days.length - 1], j = judge(last, { reps: last[0].target });
  const lastDay = last[0].wave;

  // Count consecutive misses, newest first.
  let misses = 0; for (let i = days.length - 1; i >= 0; i--) { const d = judge(days[i], { reps: days[i][0].target }); if (d.hit) break; misses++; }

  // A program can set the rep target: a fixed number (e.g. 10 × 10) or a range (double progression).
  const sc = o.scheme;
  const dbl = sc ? sc.hi > sc.lo : cls === 'small' || cls === 'mid';
  const R = sc && sc.hi > sc.lo ? { lo: sc.lo, hi: sc.hi, sets: sc.sets } : RANGE;
  const mode = dbl ? 'reps' : sc ? 'linear' : days.some(d => d[0].mode === 'wave') || stalledBefore(days) ? 'wave' : 'linear';
  let base = j.kg / (lastDay && !sc ? WAVE[lastDay].f : 1), action, why, reps, nSets, day;

  if (dbl) {
    nSets = R.sets;
    if (misses >= 2 && j.worst < R.lo) { base = round(j.kg * 0.9); reps = R.lo; action = 'reset'; why = `Missed ${R.lo} reps twice. Back off 10% and build up again.`; }
    else if (j.worst >= R.hi && j.cleanOk && !j.grind) { base = round(j.kg + step); reps = R.lo; action = 'add'; why = `Every set hit ${R.hi} clean reps. Time for more weight.`; }
    else {
      base = j.kg; reps = Math.min(R.hi, Math.max(R.lo, j.worst + 1)); action = 'reps';
      why = !j.cleanOk ? 'Same weight: tidy up the form before adding reps.' : j.grind ? `Same weight, aim for ${reps} reps: the last reps slowed down a lot.` : `Same weight, aim for ${reps} reps on every set.`;
      if (!j.cleanOk) reps = Math.max(R.lo, j.worst);
    }
    day = undefined;
  } else {
    const sw = !sc && mode === 'wave' && !days.some(d => d[0].mode === 'wave');
    if (misses >= 2) { base = round(base * 0.9); action = 'reset'; why = 'Missed the target twice. Back off 10% and build up again.'; }
    else if (j.hit && j.cleanOk && !j.grind) { base = base + step; action = 'add'; why = `All reps clean and the bar speed held up. Add ${fmtW(step, unit)}.`; }
    else if (j.hit) { action = 'same'; why = !j.cleanOk ? 'Reps done, but form slipped. Same weight until every rep is clean.' : 'Reps done, but they slowed down a lot. Same weight until it moves faster.'; }
    else { action = 'same'; why = `Missed ${j.tReps} reps once. Same weight, one more go.`; }
    if (sc) { reps = sc.lo; nSets = sc.sets; }
    else if (mode === 'linear') { reps = LINEAR.reps; nSets = LINEAR.sets; }
    else {
      day = lastDay ? ORDER[(ORDER.indexOf(lastDay) + 1) % 3] : 'heavy';
      reps = WAVE[day].reps; nSets = WAVE[day].sets;
      if (sw) why = 'You stalled on steady jumps, so this lift now rotates heavy, medium and light days. ' + why;
    }
  }
  let kg = round(day ? base * WAVE[day].f : base);
  if (o.light) { kg = round(day ? (j.kg / (lastDay ? WAVE[lastDay].f : 1)) * WAVE[day].f : j.kg); nSets = Math.max(1, Math.round(nSets * 2 / 3)); why = 'Light week: same weight, fewer sets, so you recover and come back stronger.'; action = 'light'; }
  return { kg, base: round(base), reps, sets: nSets, day, mode: dbl ? 'reps' : mode, action, why, cls };
}

// A linear lift stalled earlier if it ever had two misses in a row.
function stalledBefore(days) {
  let run = 0; for (const d of days) { run = judge(d, { reps: d[0].target }).hit ? 0 : run + 1; if (run >= 2) return true; } return false;
}

/** Light week due: every ~7 training weeks, or when 2+ lifts had to back off in the last 3 weeks. */
export function lightWeekDue(sets, { now = Date.now(), lastLight = 0, resets = [] } = {}) {
  const W = 7 * 864e5, real = sets.filter(s => !s.demo && !s.guided && s.kg > 0);
  if (now - lastLight < 3 * W) return false;
  const weeks = new Set(real.filter(s => s.at > Math.max(lastLight, now - 12 * W)).map(s => Math.floor(s.at / W)));
  if (weeks.size >= 7) return true;
  return new Set(resets.filter(r => now - r.at < 3 * W).map(r => r.ex)).size >= 2;
}

/** Estimated 1-rep max (Epley), trusted up to 12 reps. */
export const e1rm = (kg, reps) => (kg > 0 && reps > 0 && reps <= 12 ? kg * (1 + reps / 30) : null);

/**
 * Strength over time for one exercise.
 * @param range '1M' (each session), '3M' (weekly best), '1Y' (monthly best) or 'ALL' (monthly best)
 * @returns { points: [{t, e1rm, vol, pr}], change } with weights in kg
 */
export function strengthSeries(sets, ex, range = '3M', now = Date.now()) {
  const DAY = 864e5, span = { '1M': 31, '3M': 92, '1Y': 366, ALL: 1e6 }[range] * DAY;
  const bucket = range === '1M' ? t => dayKey(t) : range === '3M' ? t => Math.floor((t - 4 * DAY) / (7 * DAY)) : t => { const d = new Date(t); return d.getFullYear() * 12 + d.getMonth(); };
  const rows = sets.filter(s => s.ex === ex && !s.demo && !s.guided && s.kg > 0 && s.reps).sort((a, b) => a.at - b.at);
  const map = new Map();
  for (const s of rows) {
    if (s.at < now - span) continue;
    const k = bucket(s.at), b = map.get(k) || { t: s.at, e1rm: 0, vol: 0 };
    b.e1rm = Math.max(b.e1rm, e1rm(s.kg, s.reps) || 0); b.vol += s.kg * s.reps; b.t = Math.max(b.t, s.at); map.set(k, b);
  }
  let best = Math.max(0, ...rows.filter(s => s.at < now - span).map(s => e1rm(s.kg, s.reps) || 0));
  const points = [...map.values()].filter(p => p.e1rm > 0).map(p => { const pr = p.e1rm > best + 0.01; if (pr) best = p.e1rm; return { ...p, pr }; });
  const change = points.length >= 2 ? (points[points.length - 1].e1rm - points[0].e1rm) / points[0].e1rm : null;
  return { points, change };
}

/** Weekly tonnage (kg × reps) across all lifts, last n weeks, oldest first. */
export function weeklyVolume(sets, n = 8, now = Date.now()) {
  const W = 7 * 864e5, out = Array(n).fill(0);
  for (const s of sets) {
    if (s.demo || s.guided || !(s.kg > 0) || !s.reps) continue;
    const w = Math.floor((now - s.at) / W); if (w >= 0 && w < n) out[n - 1 - w] += s.kg * s.reps;
  }
  return out;
}
