// Next-period estimate from the user's own confirmed period starts ONLY (the "dates-only baseline").
//
// Method, in full (shown to the user under "Why this estimate"):
//   1. Take the most recent usable cycles (up to RECENT = 6). A cycle is usable when both starts were logged,
//      the user did not mark a missed log in between, and the length is plausible or was confirmed.
//   2. Typical length = median of those cycles. The DATE shown = last start + that median.
//   3. The RANGE (since dates-only-2.0.0, the product owner's decision of 2026-11-26) = date ± RANGE.Z × s, rounded to
//      whole days, where s is her own cycle-to-cycle spread (SD of the same cycles) steadied by a population spread
//      (RANGE.POP_SD, worth RANGE.PRIOR_CYCLES cycles). Both numbers were set on the development group of real data
//      (Marquette, Fehring 2012) and checked on a held-out test group: the real next start fell inside 83.5% of the time
//      (80–85% at every history length). docs/design-comparison-marquette.md. This replaces the earlier
//      shortest-to-longest window, which held the real start only 20% of the time after one cycle (69% overall).
//      Issue 4 of 80ea40f required any interval to come from held-out validation data; this one does. It is still not
//      validated for this app's users or in a clinical study, and every result says so. With only 1–2 usable cycles it
//      is an EARLY estimate.
//   4. If the shortest and longest differ by more than VARIABLE days, the estimate is labelled "variable".
//      If they differ by more than TOO_VARIABLE days, no range is given: we offer a check-in instead.
// No population cycle length (such as 28 days) ever sets the date, no date is given before one completed cycle, and no
// ovulation day is assumed. The only population figure is RANGE.POP_SD, and it only sets the range's width.
// Parameter values are placeholders chosen for clarity, not tuned on data. VARIABLE = 9 echoes the
// upper end of the FIGO 2018 description of normal cycle-to-cycle variation (see docs/cycle-evidence-register.md).
import { addDays, diffDays, human } from './dates.js';
import { cycles, SITUATIONS, restartDate } from './model.js';

export const PARAMS = Object.freeze({ RECENT: 6, EARLY_MIN: 1, FULL_MIN: 3, VARIABLE: 9, TOO_VARIABLE: 20, STALE_FACTOR: 2 });
/** Calibrated range settings (set on the Marquette development group; see the method above). */
export const RANGE = Object.freeze({ Z: 1.2, POP_SD: 2.94, PRIOR_CYCLES: 3, TARGET: 0.8,
  source: 'Marquette menstrual cycle data (Fehring 2012), development group of 44 women; held-out test group of 100 women', heldOutCoverage: 0.835 });
export const OUTSIDE_NOTE = 'In a research dataset of real cycles, about 8 in 10 next periods started inside a range like this. It has not been validated for you or in a clinical study, and your period may come earlier or later.';
export const ALGORITHM_VERSION = 'dates-only-2.0.0'; // 2.0.0: calibrated range; 1.2.0: restart after a pregnancy; 1.1.0: no padding, overdue flag

const sd = xs => { if (xs.length < 2) return 0; const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, v) => a + (v - m) ** 2, 0) / (xs.length - 1)); };
/** Half-width of the calibrated range for these cycle lengths (days, before rounding). */
export const rangeHalfWidth = (lengths, r = RANGE) => { const n = lengths.length; return r.Z * Math.sqrt(((n - 1) * sd(lengths) ** 2 + r.PRIOR_CYCLES * r.POP_SD ** 2) / (n - 1 + r.PRIOR_CYCLES)); };
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
  const half = rangeHalfWidth(lengths);
  const rangeStart = addDays(lastStart, Math.round(med - half)), rangeEnd = addDays(lastStart, Math.round(med + half)), singleDate = rangeStart === rangeEnd;
  const typical = addDays(lastStart, Math.round(med));
  const status = early ? 'early' : spread > params.VARIABLE ? 'variable' : 'estimate';
  const overdue = today > rangeEnd; // past the end of the range shown to her
  const n = lengths.length, plural = n === 1 ? 'cycle' : 'cycles';
  const when = singleDate ? `on ${human(rangeStart)}` : `between ${human(rangeStart)} and ${human(rangeEnd)}`;
  const history = early
    ? `From ${n} ${plural} only (${lengths.join(' and ')} days): most likely around ${human(typical)}, ${when}. With so few cycles, the range is wider.`
    : min === max
      ? `Your last ${n} cycles were all ${min} days long: most likely around ${human(typical)}, ${when}.`
      : `Your last ${n} cycles were between ${min} and ${max} days long (typical: ${med}): most likely around ${human(typical)}, ${when}${status === 'variable' ? '. Your cycles vary a lot' : ''}.`;
  const detail = `${overdue ? 'Your period hasn\'t been logged yet and it is later than the range below. ' : ''}${history} ${OUTSIDE_NOTE}`;
  const headline = overdue ? 'Later than your recent cycles' : status === 'variable' ? 'Variable cycles' : early ? 'Early: from very few cycles' : 'From your past cycles';
  return { ...base, status, used, lengths, min, max, median: med, spread, rangeStart, rangeEnd, singleDate, overdue, beyondRange: overdue, inRange: today >= rangeStart && today <= rangeEnd,
    typicalDate: typical, calibrated: true, intervalSource: 'calibrated-80', calibration: { method: 'own spread steadied by population spread', z: RANGE.Z, popSd: RANGE.POP_SD, priorCycles: RANGE.PRIOR_CYCLES, target: RANGE.TARGET, source: RANGE.source, heldOutCoverage: RANGE.heldOutCoverage },
    headline, detail };
}

/** Typical period length (days) from periods with a logged end. Null when fewer than 2. */
export function typicalPeriodLength(s) {
  const ls = s.periods.filter(p => p.end).map(p => diffDays(p.start, p.end) + 1);
  return ls.length >= 2 ? median(ls) : null;
}

export const DISCLAIMER = 'The date comes only from your own logged periods. The range around it is set so that, in a research dataset of real cycles, about 8 in 10 next periods started inside it. It is not a guaranteed date and has not been clinically validated. Your period can come earlier or later. It cannot be used for contraception or to detect pregnancy.';
