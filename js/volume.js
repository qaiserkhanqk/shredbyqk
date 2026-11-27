// Weight lifted: per workout, week, month and lifetime, plus the bests that make a workout feel like a win.
// Volume = weight × reps for every logged set with a weight (the weight as entered; for dumbbells, one dumbbell).
// Bodyweight moves count as reps, not kg, so nobody's total is inflated by a guess.
// Efficient by design: rollup() keeps running totals in S.totals and only reads sets it hasn't seen, so a client
// with years of history costs the same as one with a week. Pure functions, unit tested (tests/volume.test.mjs).
import { e1rm } from './progression.js';

const DAY = 864e5;
const real = s => s && !s.demo;
export const setKg = s => (real(s) && s.kg > 0 && s.reps > 0 ? s.kg * s.reps : 0);
const pad = n => String(n).padStart(2, '0');
const local = t => new Date(t);
export const dayKey = t => { const d = local(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const monthKey = t => dayKey(t).slice(0, 7);
export function weekKey(t) { const d = local(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dayKey(d.getTime()); }

/** Fun equivalents (approximate weights), smallest first. The largest one that fits is used. */
export const THINGS = [
  { kg: 20, one: 'a sack of atta', many: 'sacks of atta' },
  { kg: 85, one: 'a Honda 70 motorbike', many: 'Honda 70 motorbikes' },
  { kg: 450, one: 'a grand piano', many: 'grand pianos' },
  { kg: 650, one: 'a Suzuki Mehran', many: 'Suzuki Mehrans' },
  { kg: 1500, one: 'a family car', many: 'family cars' },
  { kg: 5000, one: 'an elephant', many: 'elephants' },
  { kg: 12000, one: 'a double-decker bus', many: 'double-decker buses' },
  { kg: 150000, one: 'a blue whale', many: 'blue whales' },
];
/** "That's like lifting 3 Suzuki Mehrans". Picks the biggest thing they lifted at least once. */
export function equivalent(kg) {
  if (!(kg >= THINGS[0].kg)) return null;
  const t = [...THINGS].reverse().find(x => kg >= x.kg), n = kg / t.kg;
  const count = n < 1.5 ? 1 : n < 10 ? Math.round(n * 2) / 2 : Math.round(n);
  return { thing: t, count, text: count === 1 ? t.one : `${count} ${t.many}` };
}

/**
 * Everything for the "workout complete" screen. sets: this workout's sets (same day), history: all earlier sets.
 * Returns totals, PRs (heaviest weight, best estimated 1-rep max, most reps at a weight), comparisons with the
 * last time they did this workout, and the number of this workout ever.
 */
export function workoutSummary(sets = [], history = [], { lib = {}, workoutsBefore = 0 } = {}) {
  sets = sets.filter(real); history = history.filter(real);
  const kg = sets.reduce((a, s) => a + setKg(s), 0), reps = sets.reduce((a, s) => a + (s.reps || 0), 0);
  const exs = [...new Set(sets.map(s => s.ex))];
  const t0 = Math.min(...sets.map(s => s.at)), t1 = Math.max(...sets.map(s => s.at));
  const minutes = sets.length > 1 ? Math.max(1, Math.round((t1 - t0) / 60000) + 2) : null;
  const prs = [];
  for (const ex of exs) {
    const mine = sets.filter(s => s.ex === ex && s.kg > 0 && s.reps > 0), before = history.filter(s => s.ex === ex && s.kg > 0 && s.reps > 0);
    if (!mine.length || !before.length) continue; // first time: a baseline, not a PR
    const name = lib[ex]?.name || mine[0].name || ex;
    const top = Math.max(...mine.map(s => s.kg)), prevTop = Math.max(...before.map(s => s.kg));
    const best1 = Math.max(...mine.map(s => e1rm(s.kg, s.reps))), prev1 = Math.max(...before.map(s => e1rm(s.kg, s.reps)));
    if (top > prevTop) prs.push({ ex, name, kind: 'weight', text: `Heaviest ever: ${top} kg`, value: top, was: prevTop });
    else if (best1 > prev1 + 0.5) prs.push({ ex, name, kind: 'e1rm', text: `Strongest set ever (est. 1-rep max ${Math.round(best1)} kg)`, value: Math.round(best1), was: Math.round(prev1) });
    else {
      const atTop = mine.filter(s => s.kg === top), r = Math.max(...atTop.map(s => s.reps)), prevR = Math.max(0, ...before.filter(s => s.kg === top).map(s => s.reps));
      if (prevR && r > prevR) prs.push({ ex, name, kind: 'reps', text: `Most reps at ${top} kg: ${r}`, value: r, was: prevR });
    }
  }
  // Same exercises last time → "+12% volume" (only when the comparison is like for like).
  const lastDayOf = new Map();
  for (const s of history) if (exs.includes(s.ex)) lastDayOf.set(s.ex, Math.max(lastDayOf.get(s.ex) || 0, s.at));
  let prevKg = 0, compared = 0;
  for (const ex of exs) {
    const t = lastDayOf.get(ex); if (!t) continue;
    const d = dayKey(t); prevKg += history.filter(s => s.ex === ex && dayKey(s.at) === d).reduce((a, s) => a + setKg(s), 0);
    compared++;
  }
  const change = compared === exs.length && prevKg > 0 && kg > 0 ? Math.round((kg / prevKg - 1) * 100) : null;
  const clean = sets.reduce((a, s) => a + (s.good || 0), 0), cameraReps = sets.filter(s => !s.manual && s.good != null).reduce((a, s) => a + (s.reps || 0), 0);
  return {
    kg: Math.round(kg), reps, sets: sets.length, exercises: exs.length, minutes, prs, change, number: workoutsBefore + 1,
    form: cameraReps >= 5 ? Math.round(clean / cameraReps * 100) : null, equivalent: equivalent(kg),
  };
}

/** Milestones worth a bigger celebration: workout counts and lifetime kg. */
export const WORKOUT_MILESTONES = [1, 5, 10, 25, 50, 75, 100, 150, 200, 250, 300, 365, 500, 750, 1000];
export const KG_MILESTONES = [1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000, 2000000, 5000000];
export function milestones(before, after) {
  const out = [];
  for (const n of WORKOUT_MILESTONES) if (before.workouts < n && after.workouts >= n) out.push({ kind: 'workouts', n, text: n === 1 ? 'Your first workout with QK!' : `Workout number ${n}!` });
  for (const n of KG_MILESTONES) if (before.kg < n && after.kg >= n) out.push({ kind: 'kg', n, text: `${n >= 1000 ? (n / 1000).toLocaleString() + ' tonne' + (n > 1000 ? 's' : '') : n + ' kg'} lifted in total!` });
  return out;
}

/**
 * Running totals, updated incrementally. S.totals = { upTo, kg, reps, sets, workouts, days: {dayKey: kg},
 * weeks: {weekKey: {kg, reps, sets, days}}, months: {monthKey: {kg, reps, sets, days}} }.
 * Only sets after `upTo` are read, so this is cheap to call after every set. A workout = a day with sets.
 * Returns the same object (mutated) for convenience.
 */
export function rollup(S) {
  const T = (S.totals ||= { upTo: 0, kg: 0, reps: 0, sets: 0, workouts: 0, days: {}, weeks: {}, months: {} });
  const fresh = (S.sessions || []).filter(s => real(s) && s.at > T.upTo).sort((a, b) => a.at - b.at);
  for (const s of fresh) {
    const kg = setKg(s), d = dayKey(s.at), w = weekKey(s.at), m = monthKey(s.at), newDay = !(d in T.days);
    T.kg += kg; T.reps += s.reps || 0; T.sets++;
    if (newDay) { T.days[d] = 0; T.workouts++; }
    T.days[d] += kg;
    for (const [bucket, k] of [[T.weeks, w], [T.months, m]]) {
      const b = (bucket[k] ||= { kg: 0, reps: 0, sets: 0, days: 0 });
      b.kg += kg; b.reps += s.reps || 0; b.sets++; if (newDay) b.days++;
    }
    T.upTo = s.at;
  }
  // Keep day-level detail for a year only (weeks and months are kept forever: a few bytes each).
  const cutoff = dayKey(Date.now() - 400 * DAY);
  for (const d of Object.keys(T.days)) if (d < cutoff) delete T.days[d];
  return T;
}
/** Recount from scratch (after a set is edited or deleted). */
export function recount(S) { S.totals = null; return rollup(S); }
