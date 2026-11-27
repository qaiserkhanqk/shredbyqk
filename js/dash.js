// Coach dashboard model: turns synced rows into one card per client. Pure functions, unit tested.
// Status, in plain words a coach can act on:
//   inactive  – hasn't opened the app in 3+ days
//   slipping  – opens the app but is behind this week's training days, or form dropped 10+ points
//   on track  – everything else
import { lifetimeClean, progress as rewardProgress } from './rewards.js';
import { allScores, scoreSummary } from './scores.js';
import { e1rm } from './progression.js';
import { foodCard, foodDayRows, foodWeekSummary } from './foodsync.js';

const D = 864e5;
export const weekStart = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); }; // Monday
const ms = x => (typeof x === 'number' ? x : Date.parse(x));
const dayKey = t => new Date(t).toDateString();
const score = sets => { const xs = sets.filter(s => !s.guided && !s.manual && s.reps); const r = xs.reduce((a, s) => a + s.reps, 0); return r ? Math.round(xs.reduce((a, s) => a + Math.min(s.good || 0, s.reps), 0) / r * 100) : null; };

/**
 * @param p profile row, @param sets session rows, @param opens event rows, @param checks checkin rows
 * @param o { now, names: id → exercise name }
 */
export function clientCard(p, sets = [], opens = [], checks = [], { now = Date.now(), names = {}, food = [] } = {}) {
  sets = sets.map(s => ({ ...s, at: ms(s.at) })).sort((a, b) => a.at - b.at);
  const seenTimes = [...opens.map(e => ms(e.at)), ...sets.map(s => s.at), ...checks.map(c => ms(c.at)), p.last_seen ? ms(p.last_seen) : 0].filter(Boolean);
  const lastSeen = seenTimes.length ? Math.max(...seenTimes) : null;
  const daysAway = lastSeen == null ? null : Math.floor((now - lastSeen) / D);
  const wk = weekStart(now), thisWeek = sets.filter(s => s.at >= wk), lastWeek = sets.filter(s => s.at >= wk - 7 * D && s.at < wk);
  const daysTrained = new Set(thisWeek.map(s => dayKey(s.at))).size, goal = p.weekly_goal || p.plan?.days?.length || 3;
  // Expected by now: the goal spread over the week (e.g. 4 days, Thursday → about 2).
  const dayOfWeek = Math.floor((now - wk) / D) + 1, expected = Math.floor(goal * dayOfWeek / 7);
  const form = score(thisWeek), formPrev = score(lastWeek);
  const lastSet = sets[sets.length - 1] || null;
  const lastDay = lastSet ? sets.filter(s => dayKey(s.at) === dayKey(lastSet.at)) : [];
  // Personal bests this week: estimated 1RM above anything before this week.
  const prs = [];
  for (const ex of new Set(thisWeek.filter(s => s.kg > 0).map(s => s.ex))) {
    const best = Math.max(...thisWeek.filter(s => s.ex === ex).map(s => e1rm(s.kg, s.reps) || 0));
    const before = Math.max(0, ...sets.filter(s => s.ex === ex && s.at < wk).map(s => e1rm(s.kg, s.reps) || 0));
    if (before && best > before + 0.01) prs.push({ ex, name: names[ex] || lastDay.find(s => s.ex === ex)?.name || ex, e1rm: best });
  }
  const tally = {}; for (const s of sets.filter(s => s.at >= now - 28 * D)) for (const [id, n] of Object.entries(s.faults || {})) tally[id] = (tally[id] || 0) + n;
  const topFault = Object.entries(tally).sort((a, b) => b[1] - a[1])[0] || null;
  const clean = lifetimeClean(sets.map(s => ({ ...s, ex: s.ex })));
  const status = daysAway == null || daysAway >= 3 ? 'inactive' : daysTrained < expected || (form != null && formPrev != null && form <= formPrev - 10) ? 'slipping' : 'on track';
  const reason = status === 'inactive' ? (daysAway == null ? 'Never opened the app' : `No app open in ${daysAway} days`)
    : daysTrained < expected ? `${daysTrained} of ${expected} training days so far this week`
    : status === 'slipping' ? `Form down from ${formPrev}% to ${form}%` : daysTrained >= goal ? 'Weekly goal hit' : `${daysTrained} of ${goal} days this week`;
  return {
    id: p.id, name: p.name || 'Client', goal: p.goal, program: p.program, status, reason,
    lastSeen, daysAway, openedToday: lastSeen != null && dayKey(lastSeen) === dayKey(now),
    daysTrained, weeklyGoal: goal, sets: thisWeek.length, volume: Math.round(thisWeek.reduce((a, s) => a + (s.kg || 0) * (s.reps || 0), 0)),
    form, formPrev, prs, topFault: topFault && { id: topFault[0], n: topFault[1] },
    lastWorkout: lastSet ? { at: lastSet.at, exercises: [...new Set(lastDay.map(s => s.name || names[s.ex] || s.ex))] } : null,
    cleanReps: clean, medal: rewardProgress(clean).earned.at(-1) || null,
    checkin: checks.length ? checks.map(c => ({ ...c, at: ms(c.at) })).sort((a, b) => b.at - a.at)[0] : null,
    food: foodCard(p.food_week, food, now),
    care: p.care || null,
  };
}

const ORDER = { inactive: 0, slipping: 1, 'on track': 2 };
/** Who needs you first: inactive, then slipping, then on track; longest away first. */
export const sortCards = cards => [...cards].sort((a, b) => ORDER[a.status] - ORDER[b.status] || (b.daysAway ?? 999) - (a.daysAway ?? 999) || a.name.localeCompare(b.name));

export function overview(cards) {
  const n = s => cards.filter(c => c.status === s).length;
  return { total: cards.length, onTrack: n('on track'), slipping: n('slipping'), inactive: n('inactive'), openedToday: cards.filter(c => c.openedToday).length, prs: cards.reduce((a, c) => a + c.prs.length, 0) };
}

/**
 * What the coach should know to look after the client: sore areas, rough days this week, travel, Ramadan.
 * Labels and counts only (the same privacy rule as everything else: no videos, no free text).
 */
const PAIN_LABEL = { shoulder: 'shoulder', knee: 'knee', back: 'lower back', elbow: 'elbow', wrist: 'wrist', hip: 'hip' };
export function careSummary(S, now = Date.now()) {
  const p = S?.profile || {}, wk = 7 * D;
  const rough = new Set([...(S?.checkinLog || []).filter(c => ['rest', 'easy'].includes(c.level)), ...(S?.readiness || []).filter(c => /rough/.test(c.feel || ''))]
    .filter(c => now - c.at < wk).map(c => dayKey(c.at))).size;
  const care = {
    pain: (p.pain || []).map(a => PAIN_LABEL[a] || a),
    rough7: rough,
    travel: p.travel && now < p.travel.until ? p.travel.kind : null,
    ramadan: !!(p.ramadan && now < p.ramadan.until),
  };
  return care.pain.length || care.rough7 || care.travel || care.ramadan ? care : null;
}
/** Short chips for the coach: "Sore: knee", "2 rough days", "Travelling", "Ramadan". */
export const careChips = c => (c ? [...(c.pain?.length ? [`Sore: ${c.pain.join(', ')}`] : []), ...(c.rough7 ? [`${c.rough7} rough day${c.rough7 > 1 ? 's' : ''}`] : []), ...(c.travel ? ['Travelling'] : []), ...(c.ramadan ? ['Ramadan'] : [])] : []);

/** Ready-made messages. {name} is the client's first name. */
export const TEMPLATES = {
  cheer: ['Huge week, {name}. Keep it rolling!', 'New personal best, {name}! That\'s the work paying off.', 'Your form is getting cleaner every session, {name}. Proud of you.', 'Every session done this week, {name}. That\'s how results happen.'],
  nudge: ['Haven\'t seen you this week, {name}. One short session today?', '{name}, your plan is ready and the weights are set. Just open the app and press Start.', 'Missed a few days, {name}? No stress. Today counts. Let\'s go.', '{name}, even 20 minutes today keeps the streak alive.'],
};
export const fill = (t, name) => t.replace(/\{name\}/g, (name || '').split(' ')[0] || 'champ');

/** Sample clients for trying the dashboard before the server is connected. */
export function demoData(now = Date.now()) {
  const P = (id, name, goal, program, wg, extra = {}) => ({ id, name, goal, program: { id: program, block: 2 }, weekly_goal: wg, ...extra });
  const profiles = [P('d1', 'Sara Ahmed', 'muscle', 'hypertrophyLab', 4), P('d2', 'Omar Khan', 'hyrox', 'raceReady', 4), P('d3', 'Lena Fischer', 'lose', 'shredCircuit', 3), P('d4', 'Bilal Raza', 'strength', 'platformPrep', 4), P('d5', 'Maya Chen', 'glutes', 'gluteLab', 3), P('d6', 'Jon Park', 'powerbuild', 'powerPump', 4)];
  const sets = [], opens = [];
  const train = (id, daysAgo, ex, name, kg, reps, good) => { for (let i = 0; i < 3; i++) sets.push({ client_id: id, at: now - daysAgo * D + i * 4e5, ex, name, kg, reps, good: good ?? reps, faults: good < reps ? { sq_depth: reps - good } : null }); opens.push({ client_id: id, at: now - daysAgo * D }); };
  const wd = Math.floor((now - weekStart(now)) / D); // days since Monday
  // Sara: on track, PR this week.
  train('d1', 9, 'squat', 'Back Squat', 60, 8); train('d1', Math.min(wd, 1), 'squat', 'Back Squat', 65, 8); train('d1', 0, 'benchPress', 'Barbell Bench Press', 40, 8);
  // Omar: on track.
  train('d2', 8, 'squat', 'Back Squat', 80, 6); train('d2', 0, 'deadlift', 'Deadlift', 120, 5);
  // Lena: inactive 5 days.
  train('d3', 5, 'gobletSquat', 'Goblet Squat', 16, 12); train('d3', 12, 'gobletSquat', 'Goblet Squat', 14, 12);
  // Bilal: slipping, form dropped.
  train('d4', 8, 'squat', 'Back Squat', 140, 3, 3); train('d4', 0, 'squat', 'Back Squat', 142.5, 3, 1);
  // Maya: opened the app, not trained this week.
  train('d5', 10, 'hipThrust', 'Barbell Hip Thrust', 80, 10); opens.push({ client_id: 'd5', at: now - 3600e3 });
  // Jon: never opened.
  // Food for two sample clients: Sara logs well; Lena logs little and eats out.
  const dk = d => new Date(now - d * D).toISOString().slice(0, 10), food = [];
  for (let d = 0; d < 6; d++) food.push({ client_id: 'd1', at: dk(d), kcal: 2350 + d * 40, protein: 138, carbs: 260, fat: 75, water: 9, steps: 8200, items: [{ meal: 'Lunch', name: 'Chicken tikka / tandoori (leg piece)', kcal: 260 }, { meal: 'Dinner', name: 'Daal masoor', kcal: 230 }] });
  for (const d of [1, 4]) food.push({ client_id: 'd3', at: dk(d), kcal: 2650, protein: 70, carbs: 300, fat: 120, water: 4, steps: 3900, items: [{ meal: 'Dinner', name: 'KFC · Zinger Burger', kcal: 420 }, { meal: 'Dinner', name: 'Butt Karahi · Chicken karahi (per person)', kcal: 713 }] });
  profiles[0].food_week = { logged: 6, kcal: 2450, protein: 138, target: { kcal: 2600, protein: 130 }, focus: ['Add colour: salad or fruit with two meals'], wins: ['Protein averaged 138 g a day'], weightPerWeek: 0.2 };
  profiles[3].care = { pain: ['knee'], rough7: 2, travel: null, ramadan: false }; // Bilal: sore knee, two rough days → his form drop makes sense
  profiles[2].food_week = { logged: 2, kcal: 2650, protein: 70, target: { kcal: 1850, protein: 130 }, focus: ['Add a protein to each meal', 'One easy swap a day'], wins: [], weightPerWeek: null };
  return { profiles, sets, opens, checks: [], food };
}

export const LOCAL_ID = 'this-phone';
/** A finished class as a guided set, so it counts as a training day. */
export const classRow = c => ({ at: c.at, ex: 'class:' + c.class, name: c.name, reps: 0, good: 0, secs: (c.minutes || 0) * 60, guided: true });
export const DEMO_INBOX = 'qk_demo_inbox';
/** Demo mode: the training saved on this device (the app's local state) as one more client. */
export function localClient(S, now = Date.now()) {
  if (!S?.profile?.name && !(S?.sessions || []).length) return null;
  const sets = [...(S.sessions || []).filter(s => !s.demo), ...(S.classes || []).map(classRow)].map(s => ({ ...s, client_id: LOCAL_ID }));
  const opens = [{ client_id: LOCAL_ID, at: now }]; // you're looking at it on this device right now
  const profile = { id: LOCAL_ID, name: `${S.profile?.name || 'You'} (this phone)`, goal: S.profile?.goal, weekly_goal: S.profile?.weeklyGoal || S.plan?.days?.length || 3, plan: S.plan,
    program: S.program ? { id: S.program.id, block: S.program.block || 1, name: (S.customPrograms || []).find(p => p.id === S.program.id)?.name } : null };
  profile.food_week = foodWeekSummary(S, now);
  profile.care = careSummary(S, now);
  profile.diet_plan = S.food?.plan || null;
  profile.scores = scoreSummary(allScores(S, now));
  return { profile, sets, opens, checks: (S.checkins || []).map(c => ({ ...c, client_id: LOCAL_ID })), food: foodDayRows(LOCAL_ID, S, now) };
}
