// Smarter period-start check-ins. Logging quality decides accuracy: on the real Marquette data, recording starts 1–3
// days late (the day she remembered, not the real day) raised the dates-only error from 2.21 to 2.68 days when 1 in 3
// starts were late, and to 2.99 when 2 in 3 were. So:
//   1. "Has your period started?" offers the REAL start day: today, yesterday, 2 days ago, or another date.
//   2. When late, it keeps asking gently: daily for a week after her range, then every few days (less nagging).
//   3. A gap of about two of her usual cycles ASKS whether she missed logging one; it never assumes.
// Nothing is logged without her tap. The cadence and the "about two cycles" tolerance are data-quality choices for the
// prototype, not physiological thresholds.
import { addDays, diffDays, human } from './dates.js';
import { CycleError, hasConsent, cycles, logPeriodStart, editPeriod, dismissPrompt } from './model.js';
import { estimateNext } from './predict.js';

export const CHECKINS_VERSION = 'checkins-0.1.0';
/** How often to ask after her range has ended without a logged start (a UI choice, not physiology). */
export const CADENCE = Object.freeze({ DAILY_DAYS_AFTER_RANGE: 7, THEN_EVERY_DAYS: 3 });
/** Asking about a possibly missed log (a data-quality question, not physiology). */
export const MISSED = Object.freeze({ TOLERANCE_DAYS: 3, MIN_EARLIER_CYCLES: 2,
  note: 'A gap within max(3 days, her usual spread) of two of her typical cycles prompts a question. It is a data-quality check, not physiological.' });

const lastStartUpTo = (s, today) => s.periods.map(p => p.start).filter(d => d <= today).sort().at(-1) || null;

/** Today's "Has your period started?" check-in, or null. Never changes her data. */
export function periodCheckIn(s, today) {
  if (!hasConsent(s) || s.situation?.pregnant) return null;
  if (s.promptsDismissed?.[`check:${today}`]) return null;
  const e = estimateNext(s, today), last = lastStartUpTo(s, today);
  if (!e.rangeStart || !last || today < e.rangeStart) return null;
  if (last >= addDays(e.rangeStart, -10)) return null; // she already logged this period
  const quietFrom = addDays(e.rangeEnd, CADENCE.DAILY_DAYS_AFTER_RANGE);
  if (today > quietFrom && diffDays(quietFrom, today) % CADENCE.THEN_EVERY_DAYS !== 0) return null;
  const opt = (id, label, n) => { const d = addDays(today, -n); return d > last ? { id, label, date: d } : null; };
  const late = today > e.rangeEnd;
  return {
    version: CHECKINS_VERSION, kind: 'periodStart', title: 'Has your period started?',
    text: late ? 'Your period hasn\'t been logged yet and it is later than your usual range. Cycles vary for many reasons. If it has started, tell us the day it began.'
      : 'You\'re in your usual range. If it has started, tell us the day it began, so your next estimate stays accurate.',
    options: [opt('today', 'Today', 0), opt('yesterday', 'Yesterday', 1), opt('twoDaysAgo', '2 days ago', 2), { id: 'pick', label: 'Another day' }].filter(Boolean),
    pick: { min: addDays(last, 1), max: today }, spotting: true, notYet: true, late,
  };
}

/** "Not yet": quiet for the rest of today. */
export const dismissPeriodCheckIn = (s, today) => dismissPrompt(s, `check:${today}`, today);

/** She tells us the day it started. Refuses a future date and any day on or before her last logged start. */
export function answerPeriodCheckIn(s, today, date, { at = new Date().toISOString(), source = 'checkin' } = {}) {
  if (!hasConsent(s)) throw new CycleError('NO_CONSENT');
  if (date > today) throw new CycleError('FUTURE_DATE');
  const last = lastStartUpTo(s, today);
  if (last && date <= last) throw new CycleError('INVALID_DATE');
  logPeriodStart(s, date, { today, at, source });
  return { missed: missedLogQuestion(s, today) };
}

/** If her latest gap is about two of her usual cycles, ask whether she missed logging a period. Never changes data. */
export function missedLogQuestion(s, today) {
  if (!hasConsent(s)) return null;
  const cs = cycles(s).filter(c => c.nextStart <= today);
  const latest = cs.at(-1); if (!latest) return null;
  const period = s.periods.find(p => p.start === latest.nextStart);
  if (!period || period.missedBefore || s.promptsDismissed?.[`missed:${period.id}`]) return null;
  const earlier = cs.slice(0, -1).filter(c => c.usable).slice(-6).map(c => c.length);
  if (earlier.length < MISSED.MIN_EARLIER_CYCLES) return null;
  const sorted = [...earlier].sort((a, b) => a - b), m = sorted.length >> 1;
  const typical = sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2, spread = sorted.at(-1) - sorted[0];
  if (Math.abs(latest.length - 2 * typical) > Math.max(MISSED.TOLERANCE_DAYS, spread)) return null;
  return { version: CHECKINS_VERSION, kind: 'missedLog', periodId: period.id, length: latest.length, typical,
    text: `Your last cycle was ${latest.length} days, about twice your usual ${typical}. Did you have a period in between that you didn't log? (It started on ${human(latest.start)} and the next on ${human(latest.nextStart)}.)` };
}

/** Her answer: yes marks that gap as containing a missed log (so it isn't used as one long cycle); no keeps it. */
export function answerMissedLog(s, periodId, yes, { at = new Date().toISOString(), today } = {}) {
  if (!hasConsent(s)) throw new CycleError('NO_CONSENT');
  const p = s.periods.find(x => x.id === periodId); if (!p) throw new CycleError('INVALID_INPUT');
  if (yes) editPeriod(s, periodId, { missedBefore: true }, { today: today || p.start, at });
  else dismissPrompt(s, `missed:${periodId}`, today || p.start);
  return s;
}
