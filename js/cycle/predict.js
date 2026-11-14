// Next-period estimate from the user's own confirmed period starts ONLY (the "dates-only baseline").
//
// Method, in full (shown to the user under "Why this estimate"):
//   1. Take the most recent usable cycles (up to RECENT = 6). A cycle is usable when both starts were logged,
//      the user did not mark a missed log in between, and the length is plausible or was confirmed.
//   2. Typical length = median of those cycles. Range = last start + shortest … last start + longest.
//   3. With only 1–2 usable cycles it is an EARLY estimate, and the range is widened by EARLY_PAD days per side.
//   4. If the shortest and longest differ by more than VARIABLE days, the estimate is labelled "variable".
//      If they differ by more than TOO_VARIABLE days, no range is given: we offer a check-in instead.
// No population default (such as 28 days) is ever used, and no ovulation day is assumed.
// The range is a description of the user's own recent history. It is NOT a statistical confidence
// interval, it is not validated, and it is not a guarantee.
// Parameter values are placeholders chosen for clarity, not tuned on data. VARIABLE = 9 echoes the
// upper end of the FIGO 2018 description of normal cycle-to-cycle variation (see docs/cycle-evidence-register.md).
import { addDays, diffDays } from './dates.js';
import { cycles, SITUATIONS } from './model.js';

export const PARAMS = Object.freeze({ RECENT: 6, EARLY_MIN: 1, FULL_MIN: 3, EARLY_PAD: 2, VARIABLE: 9, TOO_VARIABLE: 20, STALE_FACTOR: 2 });
export const ALGORITHM_VERSION = 'dates-only-1.0.0';

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
  const used = all.filter(c => c.usable && c.nextStart <= today).slice(-params.RECENT);
  const lengths = used.map(c => c.length);
  if (!lastStart || lengths.length < params.EARLY_MIN) {
    return { ...base, status: 'none', used, lengths, headline: 'Not enough data yet',
      detail: starts.length < 2 ? 'Log at least two period start dates and we can describe your cycle length. Until then there is no estimate.' : 'Your logged cycles are marked for checking, so none can be used yet.' };
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
  const early = lengths.length < params.FULL_MIN, pad = early ? params.EARLY_PAD : 0;
  let rangeStart = addDays(lastStart, min - pad), rangeEnd = addDays(lastStart, max + pad);
  const status = early ? 'early' : spread > params.VARIABLE ? 'variable' : 'estimate';
  const n = lengths.length, plural = n === 1 ? 'cycle' : 'cycles';
  const detail = early
    ? `Early estimate from ${n} ${plural} (${lengths.join(' and ')} days). We added ${pad} days either side because ${n} ${plural} can't show how much yours varies.`
    : `Your last ${n} cycles were between ${min} and ${max} days long (typical: ${med}). The range covers that spread${status === 'variable' ? ', which is wide because your cycles vary' : ''}.`;
  return { ...base, status, used, lengths, min, max, median: med, spread, pad, rangeStart, rangeEnd, beyondRange: today > rangeEnd, inRange: today >= rangeStart && today <= rangeEnd,
    headline: status === 'variable' ? 'Variable cycles: wide range' : early ? 'Early estimate' : 'Estimated range', detail };
}

/** Typical period length (days) from periods with a logged end. Null when fewer than 2. */
export function typicalPeriodLength(s) {
  const ls = s.periods.filter(p => p.end).map(p => diffDays(p.start, p.end) + 1);
  return ls.length >= 2 ? median(ls) : null;
}

export const DISCLAIMER = 'This is an estimate from your own logged dates. It is not a guaranteed date, not a statistical confidence interval, and has not been clinically validated. It cannot be used for contraception or to detect pregnancy.';
