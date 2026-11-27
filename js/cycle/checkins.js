// Smarter period-start check-ins. Logging quality decides accuracy: on the real Marquette data, recording starts 1–3
// days late (the day she remembered, not the real day) raised the dates-only error from 2.21 to 2.68 days when 1 in 3
// starts were late, and to 2.99 when 2 in 3 were. So:
//   1. "Has your period started?" offers the REAL start day: today, yesterday, 2 days ago, or another date.
//   2. When late, it keeps asking gently: daily for a week after her range, then every few days (less nagging).
//   3. A gap of about two of her usual cycles ASKS whether she missed logging one; it never assumes.
// Nothing is logged without her tap. The cadence and the "about two cycles" tolerance are data-quality choices for the
// prototype, not physiological thresholds.
import { addDays, diffDays, human } from './dates.js';
import { CycleError, hasConsent, cycles, logPeriodStart, logDay, editPeriod, dismissPrompt, restartDate, PLAUSIBLE } from './model.js';
import { estimateNext, typicalPeriodLength } from './predict.js';

export const CHECKINS_VERSION = 'checkins-0.3.0'; // 0.3.0: shared just-logged-period rule, Not yet/Spotting answers; 0.2.0: fixes reported against a531ff2
/** How often to ask after her range has ended without a logged start (a UI choice, not physiology). */
export const CADENCE = Object.freeze({ DAILY_DAYS_AFTER_RANGE: 7, THEN_EVERY_DAYS: 3 });
/** Asking about a possibly missed log (a data-quality question, not physiology). */
export const MISSED = Object.freeze({ TOLERANCE_DAYS: 3, MIN_EARLIER_CYCLES: 2,
  note: 'A gap within max(3 days, her usual spread) of two of her typical cycles, and longer than any of her earlier cycles, prompts a question. It is a data-quality check, not physiological.' });
/** Quiet days after a newly logged start, so she isn't asked "Has your period started?" about the period she just
 *  logged: until its logged end, else her usual period length, else this many days (the same 7-day period window the
 *  app uses for "Has your period ended?"). Always ends before her typical date. A UI choice, not physiology. */
export const QUIET = Object.freeze({ DEFAULT_PERIOD_DAYS: 7 });

const lastStartUpTo = (s, today) => s.periods.map(p => p.start).filter(d => d <= today).sort().at(-1) || null;

/** True while `date` is still within the period she logged most recently: until its logged end, else her usual
 *  period length, else QUIET.DEFAULT_PERIOD_DAYS, and always before her typical date. Used by the check-in, Zara and
 *  the "Has your period started?" reminder, so none of them asks about the period she has just logged. */
export function inLatestPeriod(s, date, estimate) {
  const last = lastStartUpTo(s, date); if (!last) return false;
  const latest = s.periods.find(p => p.start === last);
  const periodEnd = latest?.end || addDays(last, (typicalPeriodLength(s) || QUIET.DEFAULT_PERIOD_DAYS) - 1);
  const quietUntil = !estimate?.typicalDate || periodEnd < estimate.typicalDate ? periodEnd : addDays(estimate.typicalDate, -1);
  return date <= quietUntil;
}

/** Today's "Has your period started?" check-in, or null. Never changes her data. */
export function periodCheckIn(s, today) {
  if (!hasConsent(s) || isPregnant(s)) return null;
  if (s.promptsDismissed?.[`check:${today}`]) return null;
  const e = estimateNext(s, today), last = lastStartUpTo(s, today);
  if (!e.rangeStart || !last || today < e.rangeStart) return null;
  // Not about the period she has just logged. (Fix: the old guard, last >= rangeStart - 10, assumed ~4-week cycles
  // and hid the question for good when cycles were short or variable; reported against a531ff2.)
  if (inLatestPeriod(s, today, e)) return null;
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
/** "Not yet" button: records "no bleeding" today only if she hasn't logged bleeding today (it never overwrites what
 *  she logged), and quiets the question for today. */
export function answerNotYet(s, today, { at = new Date().toISOString() } = {}) {
  if (!hasConsent(s)) throw new CycleError('NO_CONSENT');
  if (s.days?.[today]?.bleeding == null) logDay(s, today, { bleeding: 'none' }, { today, at });
  dismissPeriodCheckIn(s, today); return s;
}
/** "Spotting only": saves spotting today and quiets the question for today (she has answered it). */
export function answerSpotting(s, today, { at = new Date().toISOString() } = {}) {
  if (!hasConsent(s)) throw new CycleError('NO_CONSENT');
  logDay(s, today, { bleeding: 'spotting' }, { today, at });
  dismissPeriodCheckIn(s, today); return s;
}

/** She tells us the day it started. Refuses a future date and any day on or before her last logged start. */
export function answerPeriodCheckIn(s, today, date, { at = new Date().toISOString(), source = 'checkin' } = {}) {
  if (!hasConsent(s)) throw new CycleError('NO_CONSENT');
  if (date > today) throw new CycleError('FUTURE_DATE');
  const last = lastStartUpTo(s, today);
  if (last && date <= last) throw new CycleError('INVALID_DATE');
  logPeriodStart(s, date, { today, at, source });
  return { missed: missedLogQuestion(s, today) };
}

const isPregnant = s => !!(s.situation?.pregnant || s.pregnancy);
/** Dates she was marked pregnant: ended pregnancies she recorded, and times "Pregnant" was ticked as a situation. */
export function pregnantSpans(s) {
  const out = (s.pregnancies || []).filter(p => p.endDate).map(p => ({ from: p.lmp || (p.dueDate ? addDays(p.dueDate, -280) : p.endDate), to: p.endDate }));
  let on = null;
  for (const e of [...(s.situationLog || [])].filter(e => e.key === 'pregnant').sort((a, b) => a.at.localeCompare(b.at))) {
    const d = e.at.slice(0, 10);
    if (e.on && !on) on = d; else if (!e.on && on) { out.push({ from: addDays(on, -1), to: addDays(d, 1) }); on = null; }
  }
  return out;
}

/** If her latest gap is about two of her usual cycles, ask whether she missed logging a period. Never changes data.
 *  Not while she is pregnant; never for a gap that crosses a pregnancy; after a pregnancy, only cycles since then
 *  count as "usual" (the same restart the estimate uses). */
export function missedLogQuestion(s, today) {
  if (!hasConsent(s) || isPregnant(s)) return null;
  const since = restartDate(s, today), spans = pregnantSpans(s);
  const cs = cycles(s).filter(c => c.nextStart <= today && (!since || c.start >= since));
  const latest = cs.at(-1); if (!latest) return null;
  if (spans.some(p => latest.start < p.to && latest.nextStart > p.from)) return null;
  const period = s.periods.find(p => p.start === latest.nextStart);
  if (!period || period.missedBefore || s.promptsDismissed?.[`missed:${period.id}`]) return null;
  const earlier = cs.slice(0, -1).filter(c => c.usable).slice(-6).map(c => c.length);
  if (earlier.length < MISSED.MIN_EARLIER_CYCLES) return null;
  const sorted = [...earlier].sort((a, b) => a - b), m = sorted.length >> 1;
  const typical = sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2, spread = sorted.at(-1) - sorted[0];
  if (latest.length <= sorted.at(-1)) return null; // a gap no longer than one of her own cycles is not "two in one"
  if (Math.abs(latest.length - 2 * typical) > Math.max(MISSED.TOLERANCE_DAYS, spread)) return null;
  return { version: CHECKINS_VERSION, kind: 'missedLog', periodId: period.id, length: latest.length, typical,
    text: `Your last cycle was ${latest.length} days, about twice your usual ${typical}. Did you have a period in between that you didn't log? (It started on ${human(latest.start)} and the next on ${human(latest.nextStart)}.)` };
}

/** Her answer: yes marks that gap as containing a missed log (so it isn't used as one long cycle); no keeps her dates
 *  exactly as they are. If the gap is outside the app's 15-90 day check, it stays out of the estimate until she
 *  confirms it (gapReview below says so). Nothing in her history is changed by "no". */
export function answerMissedLog(s, periodId, yes, { at = new Date().toISOString(), today } = {}) {
  if (!hasConsent(s)) throw new CycleError('NO_CONSENT');
  const p = s.periods.find(x => x.id === periodId); if (!p) throw new CycleError('INVALID_INPUT');
  if (yes) editPeriod(s, periodId, { missedBefore: true }, { today: today || p.start, at });
  else dismissPrompt(s, `missed:${periodId}`, today || p.start);
  return s;
}

/** After "No, it was one long cycle" for a gap the estimate still leaves out (outside the 15-90 day check): tell her
 *  that her dates are saved but the gap is not used, and let her review the dates or confirm the gap. Never changes
 *  data. The 15-90 day check is the app's existing data-entry safeguard (model.js PLAUSIBLE), not physiology. */
export function gapReview(s, today) {
  if (!hasConsent(s) || isPregnant(s)) return null;
  for (const c of [...cycles(s)].reverse()) {
    if (c.nextStart > today) continue;
    const p = s.periods.find(x => x.start === c.nextStart);
    if (!p || !s.promptsDismissed?.[`missed:${p.id}`] || s.promptsDismissed?.[`gap:${p.id}`] || c.usable || p.missedBefore || p.lengthConfirmed) continue;
    return { version: CHECKINS_VERSION, kind: 'unusualGap', periodId: p.id, start: c.start, nextStart: c.nextStart, length: c.length,
      text: `Your dates are saved as you entered them (${human(c.start)} and ${human(c.nextStart)}). This ${c.length}-day gap is outside the ${PLAUSIBLE.min}-${PLAUSIBLE.max} days the app checks for one cycle, so it is not used in your estimate unless you confirm it. You can review the dates, or confirm that it was one cycle.` };
  }
  return null;
}
/** Her explicit tap: "Use this gap in my estimate". The only way this flow makes such a gap count. */
export function confirmGap(s, periodId, { at = new Date().toISOString(), today } = {}) {
  if (!hasConsent(s)) throw new CycleError('NO_CONSENT');
  const p = s.periods.find(x => x.id === periodId); if (!p) throw new CycleError('INVALID_INPUT');
  return editPeriod(s, periodId, { lengthConfirmed: true }, { today: today || p.start, at });
}
/** "Keep it out": the notice goes away; the gap stays out; her dates are unchanged. */
export function dismissGapReview(s, periodId, { today } = {}) {
  if (!hasConsent(s)) throw new CycleError('NO_CONSENT');
  dismissPrompt(s, `gap:${periodId}`, today);
  return s;
}
