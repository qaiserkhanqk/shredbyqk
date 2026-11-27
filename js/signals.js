// The small signals a coach watches, read from what the client already does in the app: no extra typing.
//   - Logging: did they log food, weigh in or train lately? (accountability)
//   - Wellbeing: the one-tap morning card (sleep, stress, tiredness). Bad weeks hide fat loss and raise hunger.
//   - Training: is strength holding while they cut? Dropping strength means the cut is too hard.
//   - Cycle (opt-in, women only, private to the phone): the week before and the first days of a period hold
//     1–2 kg of water, which looks like a stall. Check-ins don't cut during that window.
// js/adapt.js uses these to choose a kinder, smarter next step; the coach dashboard shows a summary.
const DAY = 864e5;
const dk = t => { const x = new Date(t); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`; };

/** Days since the client last did anything the app can see (food, weigh-in, training, morning card). */
export function engagement(S, now = Date.now()) {
  const f = S.food || {};
  const foodDays = new Set((f.log || []).filter(e => e.at > now - 14 * DAY).map(e => dk(e.at)));
  const last = Math.max(0, ...(f.log || []).map(e => e.at), ...(f.weights || []).map(w => w.at), ...(S.sessions || []).filter(s => !s.demo).map(s => s.at),
    ...(S.checkins || []).map(c => c.at), ...(S.readiness || []).map(r => r.at));
  const lastFood = Math.max(0, ...(f.log || []).map(e => e.at));
  return {
    daysSinceAny: last ? Math.floor((now - last) / DAY) : null,
    daysSinceFood: lastFood ? Math.floor((now - lastFood) / DAY) : null,
    foodDays14: foodDays.size,
  };
}

/** The last 7 days of morning cards: average sleep, and how many rough days. */
export function wellbeing(S, now = Date.now()) {
  const rs = (S.readiness || []).filter(r => r.at > now - 7 * DAY && r.at <= now);
  if (!rs.length) return { days: 0, sleepH: null, rough: 0, stressed: 0, poor: false };
  const hrs = rs.map(r => +r.sleepH).filter(h => h > 0);
  const rough = rs.filter(r => r.feel === 'rough' || (r.sleepQ ?? 0) >= 6 || (r.fatigue ?? 0) >= 6).length;
  const stressed = rs.filter(r => (r.stress ?? 0) >= 5).length;
  const sleepH = hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length * 10) / 10 : null;
  return { days: rs.length, sleepH, rough, stressed, poor: rs.length >= 3 && (rough >= 3 || stressed >= 3 || (sleepH != null && sleepH < 6)) };
}

/** Strength trend: best estimated 1-rep max per exercise, last 14 days vs the 28 days before (median % change). */
export function strength(S, now = Date.now()) {
  const e1rm = s => s.kg > 0 && s.reps > 0 && s.reps <= 12 ? s.kg * (1 + s.reps / 30) : 0;
  const best = (from, to) => {
    const m = {};
    for (const s of S.sessions || []) if (!s.demo && s.at > from && s.at <= to) { const v = e1rm(s); if (v > (m[s.ex] || 0)) m[s.ex] = v; }
    return m;
  };
  const recent = best(now - 14 * DAY, now), before = best(now - 42 * DAY, now - 14 * DAY);
  const ch = Object.keys(recent).filter(ex => before[ex]).map(ex => (recent[ex] - before[ex]) / before[ex] * 100).sort((a, b) => a - b);
  if (ch.length < 2) return { change: null, lifts: ch.length };
  const mid = ch.length >> 1, med = ch.length % 2 ? ch[mid] : (ch[mid - 1] + ch[mid]) / 2;
  return { change: Math.round(med * 10) / 10, lifts: ch.length };
}

/**
 * Cycle window: from ~7 days before the expected period to 3 days into it, weight runs high with water.
 * Uses the periods the client tapped (opt-in). Returns { inWindow, nextIn, avgLength } or null.
 */
export function cycle(S, now = Date.now()) {
  if (S.profile?.sex !== 'female' || !S.food?.cycleOn) return null;
  const ps = (S.food.periods || []).filter(t => t <= now).sort((a, b) => a - b);
  if (!ps.length) return { inWindow: false, nextIn: null, avgLength: null, known: false };
  const gaps = ps.slice(1).map((t, i) => (t - ps[i]) / DAY).filter(g => g >= 20 && g <= 45);
  const len = gaps.length ? Math.round(gaps.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, gaps.length)) : 28;
  const last = ps[ps.length - 1], since = (now - last) / DAY, next = len - since;
  return { inWindow: since <= 3 || (next <= 7 && next >= -3), nextIn: Math.round(next), avgLength: len, known: true };
}

/** Everything at once, for the check-in and the coach dashboard. */
export function readSignals(S, now = Date.now()) {
  return { engagement: engagement(S, now), wellbeing: wellbeing(S, now), strength: strength(S, now), cycle: cycle(S, now) };
}

/* ---------- Notifications: few, kind, and the client decides ---------- */
// 'essential' (default): the two-weekly check-in and QK's plan updates only.
// 'normal': plus at most one gentle nudge a week after 3 quiet days. 'off': nothing.
// Never more than one notification a day, and never a nudge on a check-in day.
export const NOTIFY_LEVELS = [
  { id: 'essential', label: 'Just the essentials', sub: 'Check-in every two weeks, and when QK updates your plan' },
  { id: 'normal', label: 'A gentle nudge too', sub: 'Plus at most one reminder a week if you go quiet' },
  { id: 'off', label: 'Off', sub: 'No notifications' },
];
export const notifyLevel = S => (['essential', 'normal', 'off'].includes(S.profile?.notify) ? S.profile.notify : 'essential');

/** Should a quiet-days nudge go out now? (Shared by the in-app notice and the daily push job.) */
export function nudgeDue({ level, daysSinceFood, lastNudge, checkinToday, today }) {
  if (level !== 'normal' || checkinToday || daysSinceFood == null || daysSinceFood < 3) return false;
  return !lastNudge || (Date.parse(today) - Date.parse(lastNudge)) / DAY >= 7;
}
