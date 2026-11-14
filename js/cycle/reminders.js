// Optional reminders: pure scheduling. Delivery is done by the UI (in-app card, plus a local notification
// while the app is open, if the user allowed notifications). There is no push server, so nothing is sent
// while the app is closed, and nothing is ever sent by SMS or shared with anyone.
//
//  • Times are wall-clock in the device's current time zone: "09:00" means 09:00 wherever you are.
//  • Quiet hours move a reminder to the end of the quiet period; they never drop it silently.
//  • Pause per reminder or all at once (until a date, inclusive). Delete removes it completely.
//  • Every reminder carries a reason, shown as "Why am I seeing this?".
//  • Lock-screen text is neutral by default. Details appear only if the user opts in, and even then
//    never include symptom values or dates.
import { addDays, diffDays, hm, fmtHM, weekday, human } from './dates.js';
import { CycleError, CATEGORIES } from './model.js';

export const KINDS = {
  dailyLog: 'Daily reminder to log',
  weeklyLog: 'Weekly check-in',
  periodCheck: 'Check-in when your estimated range begins',
  pattern: 'Check-in from one of your patterns',
};
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
let seq = 0;

export function addReminder(s, r, { at = new Date().toISOString() } = {}) {
  if (!s.consent.reminders) throw new CycleError('NO_CONSENT');
  if (!(r.kind in KINDS) || hm(r.time) == null) throw new CycleError('INVALID_INPUT');
  if (r.kind === 'weeklyLog' && !(r.weekday >= 0 && r.weekday <= 6)) throw new CycleError('INVALID_INPUT');
  if (r.kind === 'pattern' && !(r.cycleDay >= 1 && r.category in CATEGORIES)) throw new CycleError('INVALID_INPUT');
  const rem = { id: `r${Date.now().toString(36)}${(seq++).toString(36)}`, kind: r.kind, time: r.time, weekday: r.weekday, offsetDays: Math.max(0, Math.min(7, r.offsetDays | 0)),
    cycleDay: r.cycleDay, category: r.category, enabled: true, pausedUntil: null, createdAt: at, origin: r.origin || null };
  s.reminders.push(rem); return rem;
}
export function updateReminder(s, id, patch) {
  const r = s.reminders.find(x => x.id === id); if (!r) throw new CycleError('NOT_FOUND');
  if (patch.time != null && hm(patch.time) == null) throw new CycleError('INVALID_INPUT');
  for (const k of ['time', 'enabled', 'pausedUntil', 'offsetDays', 'weekday']) if (k in patch) r[k] = patch[k];
  if (patch.enabled && r.kind === 'pattern' && !s.consent.categories?.[r.category]) throw new CycleError('CATEGORY_OFF'); // can't re-enable while the category is off
  if (patch.enabled) delete r.disabledReason;
  return r;
}
export function deleteReminder(s, id) { s.reminders = s.reminders.filter(r => r.id !== id); delete s.delivered[id]; }

/** Minutes after midnight on `date` that this reminder would fire, before quiet hours; null if not that day. */
function occurrence(r, s, date, est) {
  const t = hm(r.time);
  switch (r.kind) {
    case 'dailyLog': return t;
    case 'weeklyLog': return weekday(date) === r.weekday ? t : null;
    case 'periodCheck': {
      if (!est?.rangeStart || s.situation?.pregnant) return null;
      return date >= addDays(est.rangeStart, -r.offsetDays) && date <= est.rangeEnd ? t : null;
    }
    case 'pattern': {
      if (!est?.lastStart) return null;
      return diffDays(est.lastStart, date) + 1 === r.cycleDay ? t : null;
    }
  }
  return null;
}
function applyQuiet(date, mins, q) {
  const qs = hm(q?.start), qe = hm(q?.end);
  if (qs == null || qe == null || qs === qe) return { date, mins, shifted: false };
  if (qs < qe) return mins >= qs && mins < qe ? { date, mins: qe, shifted: true } : { date, mins, shifted: false };
  if (mins >= qs) return { date: addDays(date, 1), mins: qe, shifted: true }; // quiet period crosses midnight
  if (mins < qe) return { date, mins: qe, shifted: true };
  return { date, mins, shifted: false };
}
const pausedOn = (r, s, date) => (r.pausedUntil && date <= r.pausedUntil) || (s.settings.remindersPausedUntil && date <= s.settings.remindersPausedUntil);

/** Scheduled occurrences (after quiet hours) whose delivery date falls in [from, to]. */
export function schedule(r, s, from, to, est) {
  const out = [];
  if (!r.enabled) return out;
  for (let d = addDays(from, -1); d <= to; d = addDays(d, 1)) {
    const m = occurrence(r, s, d, est); if (m == null) continue;
    const q = applyQuiet(d, m, s.settings.quietHours);
    if (q.date < from || q.date > to || pausedOn(r, s, q.date)) continue;
    out.push({ id: r.id, date: q.date, time: fmtHM(q.mins), mins: q.mins, shiftedForQuietHours: q.shifted });
  }
  return out;
}

/** The next time this reminder will appear, or null with a reason. */
export function nextFire(r, s, { today, nowMin, estimate }) {
  if (!r.enabled) return { next: null, why: r.disabledReason === 'category_off' ? `Turned off because you stopped logging ${CATEGORIES[r.category]?.label.toLowerCase() || 'that category'}.` : 'Turned off.' };
  const occ = schedule(r, s, today, addDays(today, 62), estimate).find(o => (o.date > today || o.mins >= nowMin) && s.delivered[r.id] !== o.date);
  if (occ) return { next: occ, why: reasonFor(r, estimate) };
  const why = r.kind === 'periodCheck' && !estimate?.rangeStart ? 'Waiting: there is no estimated range yet.'
    : r.kind === 'pattern' ? 'Waiting for your next logged period start.' : 'Paused.';
  return { next: null, why };
}

/** Reminders due right now that haven't been shown today. */
export function dueNow(s, { today, nowMin, estimate }) {
  if (!s.consent.reminders) return [];
  return s.reminders.filter(r => schedule(r, s, today, today, estimate).some(o => o.mins <= nowMin) && s.delivered[r.id] !== today)
    .map(r => ({ reminder: r, why: reasonFor(r, estimate), content: notificationContent(r, s.settings) }));
}
export const markDelivered = (s, id, today) => { s.delivered[id] = today; };

export function reasonFor(r, est) {
  switch (r.kind) {
    case 'dailyLog': return `You asked for a daily reminder at ${r.time}.`;
    case 'weeklyLog': return `You asked for a check-in every ${DAYS[r.weekday]} at ${r.time}.`;
    case 'periodCheck': return est?.rangeStart ? `Your estimated range starts on ${human(est.rangeStart)}. You asked for a check-in ${r.offsetDays ? `${r.offsetDays} day${r.offsetDays > 1 ? 's' : ''} before` : 'from that day'} until you log a period.` : 'You asked for a check-in when your estimated range begins.';
    case 'pattern': return `You set this from a pattern in your own logs (${CATEGORIES[r.category].label.toLowerCase()} around cycle day ${r.cycleDay}).${r.origin ? ' ' + r.origin : ''}`;
  }
  return '';
}

/** What appears on the lock screen. Neutral unless the user opted in; never symptom values or dates. */
export function notificationContent(r, settings) {
  if (!settings.lockScreenDetail) return { title: 'Shred by QK', body: 'You have a check-in.' };
  const body = { dailyLog: 'Time for your daily log.', weeklyLog: 'Time for your weekly check-in.', periodCheck: 'Cycle check-in: has your period started?', pattern: 'A check-in you set up is ready.' }[r.kind];
  return { title: 'Shred by QK', body };
}
