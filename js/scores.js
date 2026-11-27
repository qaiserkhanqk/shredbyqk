// Scores the client sees every day (Today) and QK sees for every client (dashboard).
// Each score is 0–100 over the last 7 days (one bad meal or night doesn't swing it), comes with the one thing
// that would raise it most, and is only shown when there's enough data to be fair: no data is grey, never red.
//
// Colours: 75+ green "Strong" · 50–74 amber "Building" · under 50 red "Needs attention".
// Red always comes with one concrete fix, so it pushes in a good way rather than shaming.
//
// Fitness age: one calculation for the whole app, in fitnessage.js (HUNT Study fitness model with every coefficient
// as printed, compared with the HUNT 3 healthy averages by age; sources in SCIENCE.md "Fitness Age"). When the
// client has done the Fitness Age test, the card shows that result (re-scored if they've stopped training).
import * as N from './nutrition.js';
import { weekReport, dayKey } from './weekly.js';
import { readiness } from './load.js';
import { strength } from './signals.js';
import * as FA from './fitnessage.js';

const DAY = 864e5;
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const r0 = Math.round;
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;

export function band(score) {
  if (score == null) return { id: 'none', label: 'Not enough data yet' };
  return score >= 75 ? { id: 'good', label: 'Strong' } : score >= 50 ? { id: 'mid', label: 'Building' } : { id: 'low', label: 'Needs attention' };
}
const out = (score, why, fix, extra = {}) => ({ score: score == null ? null : r0(clamp(score)), band: band(score == null ? null : clamp(score)), why, fix, ...extra });

/** Nutrition: calories near target, protein, veg and fruit, and logging. Needs 3 logged days in 7. */
export function nutritionScore(S, now = Date.now()) {
  const p = S.profile || {}, t = N.targets(p), log = S.food?.log || [];
  const days = Array.from({ length: 7 }, (_, i) => N.dayTotals(log, now - i * DAY)).filter(d => d.items.length >= 2);
  if (!t || days.length < 3) return out(null, 'Log your meals on 3 days this week to see this.', 'Snap or say each meal for a few days.');
  const cal = mean(days.map(d => clamp(100 - Math.abs(d.kcal - t.kcal) / t.kcal * 200)));
  const pro = clamp(mean(days.map(d => d.protein)) / t.protein * 100);
  const rep = weekReport({ log, profile: p, now, weights: [], sessions: S.sessions || [] });
  const veg = clamp((rep.avg?.vegFruit || 0) / 400 * 100), logged = days.length / 7 * 100;
  const parts = { calories: cal, protein: pro, vegFruit: veg, logging: logged };
  const score = 0.35 * cal + 0.3 * pro + 0.2 * veg + 0.15 * logged;
  const FIX = {
    calories: `Stay close to ${t.kcal.toLocaleString()} kcal: your diet plan's amounts get you there.`,
    protein: `Add a protein to each meal (eggs, chicken, dahi, daal): your target is ${t.protein} g a day.`,
    vegFruit: 'Add salad or a fruit to two meals a day (400 g of veg and fruit).',
    logging: 'Log every day this week: one photo per meal is enough.',
  };
  const low = Object.entries(parts).sort((a, b) => a[1] - b[1])[0][0];
  return out(score, `Calories ${r0(cal)}, protein ${r0(pro)}, veg and fruit ${r0(veg)}, logging ${r0(logged)} (of 100).`, FIX[low], { parts });
}

/** Recovery: the one-tap morning card (sleep, tiredness, stress, soreness), last 7 days. Needs 3 mornings. */
export function recoveryScore(S, now = Date.now()) {
  const all = (S.readiness || []).filter(r => r.at <= now).sort((a, b) => a.at - b.at);
  const week = all.filter(r => r.at > now - 7 * DAY);
  if (week.length < 3) return out(null, 'Answer "How do you feel today?" on 3 mornings to see this.', 'One tap on Today each morning.');
  const scores = week.map(c => readiness(c, all.filter(x => x.at < c.at)).score);
  const sleep = mean(week.map(r => +r.sleepH).filter(h => h > 0));
  const score = mean(scores) - (sleep != null && sleep < 6.5 ? 8 : 0);
  const fix = sleep != null && sleep < 7 ? `Aim for 7–8 hours: you've averaged ${sleep.toFixed(1)}. A fixed bedtime helps most.`
    : week.filter(r => (r.stress ?? 0) >= 5).length >= 3 ? 'Stress is high this week: a 5-minute Sukoon breathing session before bed helps.'
      : 'Keep your sleep regular and take your rest days.';
  return out(score, `${week.length} mornings this week${sleep != null ? `, about ${sleep.toFixed(1)} h sleep` : ''}.`, fix);
}

/** Activity: daily steps against the step goal. Needs 3 days of steps. */
export function activityScore(S, now = Date.now()) {
  const st = S.food?.steps || {}, keys = Array.from({ length: 7 }, (_, i) => dayKey(now - i * DAY));
  const v = keys.map(k => +st[k]).filter(n => n > 0);
  if (v.length < 3) return out(null, 'Add your steps on 3 days (or connect your phone\'s health app) to see this.', 'Sync steps on Food → Steps today.');
  // The check-in's step goal once set; until then 8,000 a day (around where the health benefit of steps levels off
  // for most adults, Paluch et al., Lancet Public Health 2022), not what they already walk.
  const avg = mean(v), goal = S.food?.adapt?.stepGoal || 8000;
  return out(avg / goal * 100, `About ${r0(avg).toLocaleString()} steps a day; goal ${goal.toLocaleString()}.`, avg >= goal ? 'Keep it up: a 10-minute walk after meals holds it there.' : `Walk ${r0((goal - avg) / 100) * 100} more steps a day: a 10–15 minute walk after lunch and dinner.`);
}

/** Workout: training days vs plan, form quality, strength trend. Shown once they've trained in the app. */
export function workoutScore(S, now = Date.now()) {
  const sessions = (S.sessions || []).filter(s => !s.demo);
  const checkins = S.checkins || [];
  if (!sessions.length && !checkins.length) return out(null, 'Do your first workout in the app to see this.', 'Start today\'s workout on Today.');
  const goal = +S.profile?.weeklyGoal || S.plan?.days?.length || 3;
  const days = new Set([...sessions, ...checkins].filter(s => s.at > now - 7 * DAY).map(s => dayKey(s.at))).size;
  const recent = sessions.filter(s => s.at > now - 14 * DAY && s.reps);
  const reps = recent.reduce((a, s) => a + s.reps, 0), good = recent.reduce((a, s) => a + Math.min(s.good ?? s.reps, s.reps), 0);
  const form = reps ? good / reps * 100 : null;
  const st = strength(S, now).change, str = st == null ? null : clamp(100 + st * 10);
  const cons = clamp(days / goal * 100);
  const score = 0.5 * cons + 0.25 * (form ?? cons) + 0.25 * (str ?? 75);
  const fix = days < goal ? `Train ${goal - days} more day${goal - days > 1 ? 's' : ''} this week: even a 20-minute session counts.`
    : form != null && form < 80 ? 'Slow down your reps and follow the camera\'s form cues: clean reps build more.'
      : str != null && st < 0 ? 'Lifts are dipping: sleep, eat your protein, and take a lighter week if you need it.' : 'Great consistency. Add a little weight when the camera says your reps are clean.';
  return out(score, `${days} of ${goal} training days${form != null ? `, ${r0(form)}% clean reps` : ''}${st != null ? `, strength ${st > 0 ? '+' : ''}${st}%` : ''}.`, fix);
}

/** Inputs for fitness age: latest waist (cm) and resting heart rate (median of the last 30 days' readings). */
export function fitnessInputs(S, now = Date.now()) {
  const waist = [...(S.scans || [])].reverse().find(s => +s.waistCm > 40)?.waistCm ?? (+S.profile?.waistCm || null);
  const hr = (S.vitals || []).filter(v => v.bpm > 30 && v.bpm < 120 && v.at > now - 30 * DAY && (v.kind === 'hr' || v.kind === 'hrv')).map(v => v.bpm).sort((a, b) => a - b);
  const rhr = hr.length ? hr[hr.length >> 1] : (+S.profile?.restingHr || null);
  const sessions = (S.sessions || []).filter(s => !s.demo && s.at > now - 28 * DAY);
  const perWeek = sessions.length ? new Set(sessions.map(s => dayKey(s.at))).size / 4 : (S.plan?.days?.length || 0) * 0.5;
  return { age: +S.profile?.age || null, sex: S.profile?.sex === 'female' ? 'female' : 'male', waist: waist ? +waist : null, rhr, perWeek };
}

/** Fitness age from the card's inputs. Returns { age, vo2, actualAge, diff } or { missing: [...] }.
 *  Active = meets the 150-minute guideline (training days a week × session minutes). */
export function fitnessAge({ age, sex, waist, rhr, perWeek = 0, minutes = 50 }) {
  const missing = [!age && 'age', !waist && 'waist', !rhr && 'resting heart rate'].filter(Boolean);
  if (missing.length) return { missing };
  const r = FA.fitnessAge({ sex, age, waistCm: waist, rhr, active: perWeek * minutes >= 150 });
  if (!r) return { missing: ['waist', 'resting heart rate'] }; // outside realistic ranges: ask them to re-measure
  return { age: r.fitnessAge, vo2: r.vo2, actualAge: r0(age), diff: r.diff };
}
/** The latest Fitness Age test, if there is one from the last 60 days (re-scored if training stopped). */
function tested(S, now) {
  const live = FA.liveFitAge(S.fitage || [], S.sessions || [], now);
  return live && now - live.at < 60 * DAY ? { age: live.fitnessAge, vo2: live.vo2, actualAge: live.age, diff: live.fitnessAge - live.age, tested: true, lapsed: live.lapsed } : null;
}

/** Everything for the Today card and the coach. */
export function allScores(S, now = Date.now()) {
  const nutrition = nutritionScore(S, now), recovery = recoveryScore(S, now), activity = activityScore(S, now), workout = workoutScore(S, now);
  const W = { nutrition: 0.3, workout: 0.25, recovery: 0.25, activity: 0.2 };
  const have = Object.entries({ nutrition, recovery, activity, workout }).filter(([, v]) => v.score != null);
  const healthVal = have.length >= 2 ? have.reduce((a, [k, v]) => a + W[k] * v.score, 0) / have.reduce((a, [k]) => a + W[k], 0) : null;
  const weakest = have.sort((a, b) => a[1].score - b[1].score)[0];
  const health = out(healthVal, have.length >= 2 ? `From your ${have.map(([k]) => k).join(', ')} scores.` : 'Two of the scores below unlock your health score.',
    weakest ? weakest[1].fix : 'Log your meals and answer the morning card for a few days.', { weakest: weakest?.[0] || null });
  const fit = tested(S, now) || fitnessAge(fitnessInputs(S, now));
  return { health, nutrition, recovery, activity, workout, fitness: fit };
}

/** Compact version for sync to the coach dashboard. */
export const scoreSummary = s => ({
  health: s.health.score, nutrition: s.nutrition.score, recovery: s.recovery.score, activity: s.activity.score, workout: s.workout.score,
  fitnessAge: s.fitness.age ?? null, age: s.fitness.actualAge ?? null,
});
