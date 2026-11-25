// Next-period estimate from the user's own confirmed period starts ONLY (the "dates-only baseline").
//
// Method, in full (shown to the user under "Why this estimate"):
//   1. Take the most recent usable cycles (up to RECENT = 6). A cycle is usable when both starts were logged,
//      the user did not mark a missed log in between, and the length is plausible or was confirmed.
//   2. Typical length = median of those cycles. The dates shown = last start + shortest … last start + longest.
//   3. With only 1–2 usable cycles it is an EARLY estimate. No padding is added (issue 4 reproduced in 80ea40f:
//      the former ±2 days was invented). Any interval must be derived from held-out validation data, which does
//      not exist yet; until then the app shows only what the person's own past cycles imply.
//   4. If the shortest and longest differ by more than VARIABLE days, the estimate is labelled "variable".
//      If they differ by more than TOO_VARIABLE days, no range is given: we offer a check-in instead.
// No population default (such as 28 days) is ever used, and no ovulation day is assumed.
// What is shown is a description of the user's own recent history (`intervalSource: 'past-cycles-only'`,
// `calibrated: false`). It is NOT a prediction or confidence interval, it is not validated, and the next period
// can fall outside it. Every result says so in its visible text.
// Parameter values are placeholders chosen for clarity, not tuned on data. VARIABLE = 9 echoes the
// upper end of the FIGO 2018 description of normal cycle-to-cycle variation (see docs/cycle-evidence-register.md).
import { addDays, diffDays, human } from './dates.js';
import { cycles, SITUATIONS, restartDate } from './model.js';

export const PARAMS = Object.freeze({ RECENT: 6, EARLY_MIN: 1, FULL_MIN: 3, VARIABLE: 9, TOO_VARIABLE: 20, STALE_FACTOR: 2 });
export const OUTSIDE_NOTE = 'Your next period may come earlier or later than this. It is what your past cycles would show, not a prediction interval, and it has not been validated.';
export const ALGORITHM_VERSION = 'dates-only-1.2.0'; // 1.2.0: restart after a pregnancy; 1.1.0: no padding, past-cycles-only labelling, overdue flag

const median = xs => { const a = [...xs].sort((x, y) => x - y), m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };

/**
 * @param s user state (only the user's own data)
 * @param today local date 'YYYY-MM-DD'; everything is computed as if nothing after it were known
 */
export function estimateNext(s, today, params = PARAMS) {
  const all = cycles(s);
  const starts = s.periods.map(p => p.start).filter(d => d <= today).sort();
  const lastStart = starts.at(-1) || null;
  const situations = Object.keys(s.situation || {}).filter(k => s.situation[k]);
  const notes = situations.map(k => SITUATIONS[k]?.note).filter(Boolean);
  const base = { algorithm: ALGORITHM_VERSION, lastStart, cycleDay: lastStart ? diffDays(lastStart, today) + 1 : null, excluded: all.filter(c => !c.usable), notes, situations };

  if (s.situation?.pregnant) return { ...base, status: 'paused', headline: 'Estimates are paused', detail: SITUATIONS.pregnant.note };
  const since = restartDate(s, today); // after a pregnancy, only cycles that start after it
  const used = all.filter(c => c.usable && c.nextStart <= today && (!since || c.start >= since)).slice(-params.RECENT);
  const lengths = used.map(c => c.length);
  if (!lastStart || lengths.length < params.EARLY_MIN) {
    return { ...base, status: 'none', used, lengths, headline: 'Not enough data yet',
      detail: since ? 'After a pregnancy, estimates start again from your periods since then. Periods can take weeks or months to come back, often longer while breastfeeding.' : starts.length < 2 ? 'Log at least two period start dates and we can describe your cycle length. Until then there is no estimate.' : 'Your logged cycles are marked for checking, so none can be used yet.' };
  }
  const min = Math.min(...lengths), max = Math.max(...lengths), med = median(lengths), spread = max - min;
  const sinceLast = diffDays(lastStart, today);
  if (sinceLast > params.STALE_FACTOR * Math.max(max, params.VARIABLE)) {
    return { ...base, status: 'stale', used, lengths, min, max, median: med, spread, headline: 'Your last logged start is a while ago',
      detail: 'If you have had periods since, log them. We will not estimate from old data.' };
  }
  if (spread > params.TOO_VARIABLE) {
    return { ...base, status: 'too_variable', used, lengths, min, max, median: med, spread, headline: 'Your cycles vary too much for a useful range',
      detail: `Your recent cycles were between ${min} and ${max} days. Instead of a guess, you can turn on a weekly check-in.` };
  }
  const early = lengths.length < params.FULL_MIN;
  const rangeStart = addDays(lastStart, min), rangeEnd = addDays(lastStart, max), singleDate = rangeStart === rangeEnd;
  const status = early ? 'early' : spread > params.VARIABLE ? 'variable' : 'estimate';
  const overdue = today > rangeEnd; // later than every recent cycle (audit 2.4); no new threshold
  const n = lengths.length, plural = n === 1 ? 'cycle' : 'cycles';
  const when = singleDate ? `on ${human(rangeStart)}` : `between ${human(rangeStart)} and ${human(rangeEnd)}`;
  const history = early
    ? `From ${n} ${plural} only (${lengths.join(' and ')} days), which would put your next period ${when}. ${n} ${plural} can't show how much yours varies.`
    : singleDate
      ? `Your last ${n} cycles were all ${min} days long, which would put your next period ${when}.`
      : `Your last ${n} cycles were between ${min} and ${max} days long (typical: ${med}), which would put your next period ${when}${status === 'variable' ? '. Your cycles vary a lot' : ''}.`;
  const detail = `${overdue ? 'Your period hasn\'t been logged yet and it is later than all your recent cycles. ' : ''}${history} ${OUTSIDE_NOTE}`;
  const headline = overdue ? 'Later than your recent cycles' : status === 'variable' ? 'Variable cycles' : early ? 'Early: from very few cycles' : 'From your past cycles';
  return { ...base, status, used, lengths, min, max, median: med, spread, rangeStart, rangeEnd, singleDate, overdue, beyondRange: overdue, inRange: today >= rangeStart && today <= rangeEnd,
    calibrated: false, intervalSource: 'past-cycles-only', headline, detail };
}

/** Typical period length (days) from periods with a logged end. Null when fewer than 2. */
export function typicalPeriodLength(s) {
  const ls = s.periods.filter(p => p.end).map(p => diffDays(p.start, p.end) + 1);
  return ls.length >= 2 ? median(ls) : null;
}

export const DISCLAIMER = 'This comes only from your own logged dates. It is not a guaranteed date, not a prediction or confidence interval, and has not been clinically validated. Your period can come earlier or later. It cannot be used for contraception or to detect pregnancy.';
