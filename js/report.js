// The weekly report every client gets on Monday: physical, mental and food health in one place, plus the weight
// they lifted. Opens with wins, compares with their plan (never "beat last week"), ends with one focus.
// Each week is saved as a small snapshot in S.reports (a few hundred bytes), so months of history cost nothing.
// Pure, unit tested (tests/report.test.mjs). Why it's built this way: SCIENCE.md "Weekly report".
import { setKg, workoutSummary, equivalent, weekKey, rollup } from './volume.js';
import { allScores, scoreSummary } from './scores.js';
import { weekScore, weekStart } from './leaderboard.js';
import { weekReport as foodReport } from './weekly.js';
import { liveFitAge } from './fitnessage.js';

const DAY = 864e5;
const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const fmtKg = kg => (kg >= 10000 ? `${(kg / 1000).toFixed(1)} tonnes` : `${Math.round(kg).toLocaleString()} kg`);
export { fmtKg };

/** Last full week (Monday to Sunday) before `now`. */
export const lastWeekStart = (now = Date.now()) => weekStart(now) - 7 * DAY;

/**
 * The report for the week starting ws (Monday 00:00). Returns sections ready to show:
 * { week, training, health, mind, food, fitness, board, wins, focus, history }.
 */
export function buildReport(S, ws = lastWeekStart(), { lib = {} } = {}) {
  const we = ws + 7 * DAY, end = we - 1, inW = t => t >= ws && t < we;
  const all = (S.sessions || []).filter(s => !s.demo);
  const sets = all.filter(s => inW(s.at)), before = all.filter(s => s.at < ws);
  const days = new Set([...sets, ...(S.classes || []).filter(c => inW(c.at))].map(s => new Date(s.at).toDateString())).size;
  const planned = Math.max(1, S.plan?.days?.length || S.program?.days || S.profile?.weeklyGoal || 4);
  const kg = sets.reduce((a, s) => a + setKg(s), 0);
  const w = sets.length ? workoutSummary(sets, before, { lib }) : null;
  const camReps = sets.filter(s => !s.manual && s.good != null).reduce((a, s) => a + (s.reps || 0), 0);
  const training = {
    days, planned, kg: Math.round(kg), sets: sets.length, reps: sets.reduce((a, s) => a + (s.reps || 0), 0),
    prs: w?.prs || [], equivalent: equivalent(kg), form: camReps >= 10 ? Math.round(sets.reduce((a, s) => a + (s.good || 0), 0) / camReps * 100) : null,
    classes: (S.classes || []).filter(c => inW(c.at)).length,
  };

  const sc = allScores(S, end), health = scoreSummary(sc);
  const ready = (S.readiness || []).filter(r => inW(r.at));
  const mind = {
    checkDays: ready.length,
    sleep: avg(ready.map(r => r.sleepQ).filter(Number.isFinite)), stress: avg(ready.map(r => r.stress).filter(Number.isFinite)),
    sleepH: avg(ready.map(r => +r.sleepH).filter(h => h > 0)),
    calm: (S.calm || []).filter(c => inW(c.at)).length,
    asked: (S.mind || []).filter(m => inW(m.at)).map(m => m.answer),
  };
  const f = S.food?.log?.length ? foodReport({ log: S.food.log, water: S.food.water, steps: S.food.steps, weights: [...(S.food.weights || []), ...(S.scans || []).filter(x => x.weight).map(x => ({ at: x.at, kg: +x.weight }))], sessions: all, profile: S.profile || {}, now: end }) : null;
  const food = f ? { logged: f.logged, enough: f.enough, wins: f.wins || [], focus: f.focus?.[0]?.title || null, protein: f.avg?.protein, target: f.target } : null;
  const fa = liveFitAge(S.fitage || [], all, end);
  const fitness = fa ? { fitnessAge: fa.fitnessAge, age: fa.age, lapsed: fa.lapsed } : sc.fitness?.age != null ? { fitnessAge: sc.fitness.age, age: sc.fitness.actualAge } : null;
  const board = { score: weekScore(S, ws, end).score };

  /* ---------- Wins: always first, always true ---------- */
  const wins = [];
  if (days >= planned) wins.push(`You hit your plan: ${days} of ${planned} training days.`);
  else if (days >= 1) wins.push(`${days} training day${days > 1 ? 's' : ''} done. Every session counts.`);
  if (training.prs.length) wins.push(`${training.prs.length} new personal best${training.prs.length > 1 ? 's' : ''}: ${training.prs.slice(0, 2).map(p => p.name).join(' and ')}.`);
  if (kg >= 500) wins.push(`${fmtKg(kg)} lifted${training.equivalent ? `, about ${training.equivalent.text}` : ''}.`);
  if (training.form >= 85) wins.push(`Form score ${training.form}%: clean, controlled reps.`);
  if (fitness && fitness.fitnessAge < fitness.age && !fitness.lapsed) wins.push(`Fitness Age ${fitness.fitnessAge}, younger than your ${fitness.age} years.`);
  if (mind.sleep != null && mind.sleep <= 3 && mind.checkDays >= 3) wins.push('You slept well most nights.');
  if (mind.calm) wins.push(`${mind.calm} calm session${mind.calm > 1 ? 's' : ''} for your mind.`);
  if (food?.enough && food.wins[0]) wins.push(food.wins[0]);
  if (days === 0 && all.length) wins.unshift('A quiet week happens. Your plan is ready and QK has kept your weights, so jumping back in is easy.');
  if (!wins.length) wins.push('You showed up and opened the app. That is where it starts.');

  /* ---------- One focus for next week: the thing that would move their health most ---------- */
  let focus;
  if (days < planned) focus = days === 0 ? 'One session this week. Just one: QK has it ready on Today.' : `Add ${planned - days} more training day${planned - days > 1 ? 's' : ''} to hit your plan.`;
  else if (mind.checkDays < 3) focus = 'Tap "How do you feel?" on Today each morning: QK uses it to set your weights and protect your recovery.';
  else if (mind.sleep != null && mind.sleep >= 5) focus = 'Sleep is your weak spot this week: same bedtime every night and screens away 30 minutes before.';
  else if (sc.health?.weakest && sc[sc.health.weakest]?.fix) focus = sc[sc.health.weakest].fix;
  else focus = food?.focus || 'Keep doing exactly this. QK will add a little weight where you are ready.';

  return { week: weekKey(ws), from: ws, to: end, training, health, mind, food, fitness, board, wins: wins.slice(0, 4), focus };
}

/** The compact snapshot kept forever (and sent to the coach). */
export const snapshot = r => ({
  week: r.week, days: r.training.days, planned: r.training.planned, kg: r.training.kg, sets: r.training.sets, prs: r.training.prs.length,
  form: r.training.form, health: r.health.health, nutrition: r.health.nutrition, recovery: r.health.recovery, fitnessAge: r.fitness?.fitnessAge ?? null,
  sleep: r.mind.sleep == null ? null : Math.round(r.mind.sleep * 10) / 10, stress: r.mind.stress == null ? null : Math.round(r.mind.stress * 10) / 10, calm: r.mind.calm, points: r.board.score,
});

/** Save last week's snapshot (once). Returns the report if a new one was made. */
export function saveWeek(S, now = Date.now(), opts) {
  const ws = lastWeekStart(now), k = weekKey(ws);
  S.reports ||= {};
  if (S.reports[k]) return null;
  const hadAnything = (S.sessions || []).some(s => !s.demo && s.at < ws + 7 * DAY) || (S.readiness || []).length || (S.food?.log || []).length;
  if (!hadAnything) return null;
  const r = buildReport(S, ws, opts); S.reports[k] = snapshot(r); rollup(S);
  return r;
}

/** The last n weekly snapshots, oldest first (for the trend bars). */
export const history = (S, n = 8) => Object.values(S.reports || {}).sort((a, b) => (a.week < b.week ? -1 : 1)).slice(-n);
