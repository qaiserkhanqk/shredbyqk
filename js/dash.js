// Coach dashboard model: turns synced rows into one card per client. Pure functions, unit tested.
// Status, in plain words a coach can act on:
//   inactive  – hasn't opened the app in 3+ days
//   slipping  – opens the app but is behind this week's training days, or form dropped 10+ points
//   on track  – everything else
import { lifetimeClean, progress as rewardProgress } from './rewards.js';
import { e1rm } from './progression.js';

const D = 864e5;
export const weekStart = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); }; // Monday
const ms = x => (typeof x === 'number' ? x : Date.parse(x));
const dayKey = t => new Date(t).toDateString();
const score = sets => { const xs = sets.filter(s => !s.guided && s.reps); const r = xs.reduce((a, s) => a + s.reps, 0); return r ? Math.round(xs.reduce((a, s) => a + Math.min(s.good || 0, s.reps), 0) / r * 100) : null; };

/**
 * @param p profile row, @param sets session rows, @param opens event rows, @param checks checkin rows
 * @param o { now, names: id → exercise name }
 */
export function clientCard(p, sets = [], opens = [], checks = [], { now = Date.now(), names = {} } = {}) {
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
  };
}

const ORDER = { inactive: 0, slipping: 1, 'on track': 2 };
/** Who needs you first: inactive, then slipping, then on track; longest away first. */
export const sortCards = cards => [...cards].sort((a, b) => ORDER[a.status] - ORDER[b.status] || (b.daysAway ?? 999) - (a.daysAway ?? 999) || a.name.localeCompare(b.name));

export function overview(cards) {
  const n = s => cards.filter(c => c.status === s).length;
  return { total: cards.length, onTrack: n('on track'), slipping: n('slipping'), inactive: n('inactive'), openedToday: cards.filter(c => c.openedToday).length, prs: cards.reduce((a, c) => a + c.prs.length, 0) };
}

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
  return { profiles, sets, opens, checks: [] };
}
