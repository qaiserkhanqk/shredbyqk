// Companion check-in (flag companion, default OFF). One caring message from her companion ("Zara" by default; she can
// rename her in settings) on the days that matter for HER:
//   1. the first days of a period she logged ("Day 2 of your period. How are you feeling today?");
//   2. around her estimated start, from her own past cycles ("may start around now"), including when it is late;
//   3. (only with the pattern research flag) a heads-up from her own logged pattern, with her numbers.
// It ASKS and never guesses: nothing is saved until she taps an answer, and "Fine" records only that she answered.
// At most one message a day; "Not now" hides it for the day. Silent in pregnancy (a pregnancy mode will handle that).
// Wording is our own, warm and plain, with no medical claims and no adult content (the audience may include teenagers);
// it is a placeholder awaiting clinician review. No new physiological thresholds: the windows are her logged period
// start (days 1–3, the first days of bleeding) and her own estimated range (predict.js), with two days' notice.
import { addDays, diffDays, human } from './dates.js';
import { CycleError, hasConsent, categoryOn, CATEGORIES, logDay, logPeriodStart } from './model.js';

export const COMPANION_VERSION = 'companion-0.2.0'; // 0.2.0: renamed from "QK" to "Zara"; her own name; privacy line
export const DEFAULT_NAME = 'Zara';
export const PRIVACY = 'Your answers stay on this phone, encrypted. Nothing is uploaded or shared.';
const NAME_RE = /^[\p{L}][\p{L} '\-]{0,19}$/u;
export const REVIEW_STATUS = 'awaiting_clinician_review';
export const NOTICE_DAYS = 2;   // how many days before her estimated range the companion checks in (a UI choice, not physiology)
export const PERIOD_DAYS = 3;   // check in on days 1–3 after a logged start (a UI choice, not physiology)

/** One-tap answers. A symptom answer is offered only when she switched that category on. */
export const QUICK = {
  periodStarted: { label: 'My period started' },
  fine: { label: 'Fine' },
  cramps: { label: 'Cramps', category: 'pain', severities: [['mild', 'Mild'], ['moderate', 'Moderate'], ['severe', 'Severe']] },
  lowEnergy: { label: 'Low energy', category: 'energy', value: 'low' },
  lowMood: { label: 'Low mood', category: 'mood', value: 'low' },
  other: { label: 'Something else' },
};

const loggedToday = (s, t) => Object.keys(s.days[t] || {}).some(k => k in CATEGORIES);
const startsUpTo = (s, t) => s.periods.map(p => p.start).filter(d => d <= t).sort();
const quickFor = (s, withStart) => [...(withStart ? ['periodStarted'] : []), 'fine', 'cramps', 'lowEnergy', 'lowMood', 'other']
  .filter(id => !QUICK[id].category || categoryOn(s, QUICK[id].category)).map(id => ({ id, label: QUICK[id].label, severities: QUICK[id].severities || null }));

/** Which kind of companion day `date` is, from her logs and her estimate (no flags, no answers). */
function dayKind(s, date, estimate, patterns = []) {
  const starts = startsUpTo(s, date), last = starts.at(-1);
  if (last && diffDays(last, date) < PERIOD_DAYS) return { kind: 'periodDays', day: diffDays(last, date) + 1 };
  const e = estimate;
  // From two days before her estimated range, and on while it is late, until she logs a start (the estimate then moves on).
  if (e?.rangeStart && date >= addDays(e.rangeStart, -NOTICE_DAYS) && !(last && last >= addDays(e.rangeStart, -10))) return { kind: 'periodSoon' };
  if (patterns.length && last) {
    const cd = diffDays(last, date) + 1;
    const p = patterns.find(x => cd + NOTICE_DAYS >= x.from && cd <= x.to);
    if (p) return { kind: 'pattern', pattern: p, inDays: Math.max(0, p.from - cd) };
  }
  return null;
}

/** The companion's name: hers if she chose one, otherwise Zara. */
export const companionName = s => (typeof s?.settings?.companionName === 'string' && s.settings.companionName) || DEFAULT_NAME;

/** She can rename her companion: letters, spaces, apostrophes and hyphens, up to 20 characters. Empty = back to Zara. */
export function setCompanionName(s, name) {
  const n = String(name ?? '').trim().replace(/\s+/g, ' ');
  if (n && !NAME_RE.test(n)) throw new CycleError('INVALID_INPUT');
  (s.settings ||= {}).companionName = n || null;
  return s;
}

/** True when the companion would check in on `date` (used to schedule the optional companion reminder). */
export const isCompanionDay = (s, date, estimate, patterns = []) => !!(hasConsent(s) && !s.situation?.pregnant && dayKind(s, date, estimate, patterns));

/**
 * Today's companion message, or null.
 * opts: { estimate (predict.estimateNext for today), patternsOn (pattern research flag), patterns (findPatterns, if on) }
 */
export function companionToday(s, today, { estimate = null, patternsOn = false, patterns = [] } = {}) {
  if (!hasConsent(s) || s.situation?.pregnant) return null;
  const c = s.companion || {};
  if (c.dismissed?.[today] || c.answered?.[today] || loggedToday(s, today)) return null;
  const k = dayKind(s, today, estimate, patternsOn ? patterns.filter(p => !s.dismissed?.[p.key]) : []);
  if (!k) return null;
  const name = companionName(s);
  const base = { version: COMPANION_VERSION, reviewStatus: REVIEW_STATUS, from: name, privacy: PRIVACY, kind: k.kind };
  if (k.kind === 'periodDays') return { ...base, title: `Day ${k.day} of your period`, text: `Hi, it's ${name}. Day ${k.day} of your period. How are you feeling today?`,
    why: `Your period started on ${human(startsUpTo(s, today).at(-1))}, so I'm checking in for the first few days.`, quick: quickFor(s, false) };
  if (k.kind === 'periodSoon') return { ...base, title: estimate.overdue ? 'Your period may be late' : 'Your period may start soon',
    text: estimate.overdue ? `Hi, it's ${name}. Your period hasn't been logged yet, and it is later than your past cycles. Cycles vary for many reasons. How are you feeling today?` : `Hi, it's ${name}. Based on your past cycles, your period may start around now. How are you feeling today?`,
    why: `Your past cycles put your next period ${estimate.singleDate ? `on ${human(estimate.rangeStart)}` : `between ${human(estimate.rangeStart)} and ${human(estimate.rangeEnd)}`}. It's a description of your history, not a certain date.`, quick: quickFor(s, true) };
  const p = k.pattern, when = k.inDays === 0 ? 'around now' : `in about ${k.inDays} day${k.inDays === 1 ? '' : 's'}`;
  return { ...base, title: 'A heads-up from your own logs', text: `Hi, it's ${name}. In ${p.notable} of the ${p.observed} cycles with logs then, you logged ${CATEGORIES[p.category].notableLabel} around this point, ${when}. How are you feeling today?`,
    why: 'This comes only from your own logs. With few cycles it can be chance (it is an unvalidated research feature).', quick: quickFor(s, false) };
}

/** Her answer. Saves only what she chose; "fine" and "other" save no symptom. */
export function answerCheckIn(s, today, answer, { severity, today: t = today, at = new Date().toISOString() } = {}) {
  if (!hasConsent(s)) throw new CycleError('NO_CONSENT');
  const q = QUICK[answer]; if (!q) throw new CycleError('INVALID_INPUT');
  if (answer === 'periodStarted') logPeriodStart(s, today, { today: t, at, source: 'companion' });
  else if (answer === 'cramps') {
    if (!categoryOn(s, 'pain')) throw new CycleError('CATEGORY_OFF');
    if (!q.severities.some(([v]) => v === severity)) throw new CycleError('INVALID_INPUT');
    logDay(s, today, { pain: severity }, { today: t, at, source: 'companion' });
  } else if (q.category) {
    if (!categoryOn(s, q.category)) throw new CycleError('CATEGORY_OFF');
    logDay(s, today, { [q.category]: q.value }, { today: t, at, source: 'companion' });
  }
  ((s.companion ||= {}).answered ||= {})[today] = answer;
  return s;
}

/** "Not now": hidden for the rest of today. */
export function dismissCompanion(s, today) { ((s.companion ||= {}).dismissed ||= {})[today] = true; return s; }
