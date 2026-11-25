// Band-adjusted period estimate (research flag temperatureEstimate, default OFF).
// When her band shows a sustained rise in wrist skin temperature in THIS cycle (tempshift.js, the existing research
// rule), and she has at least 2 past cycles in which a rise was seen, the estimate is re-centred on this cycle's rise
// plus HER OWN past rise→next-period intervals (shortest to longest; middle = median). Otherwise it says why not and
// the dates-only estimate (predict.js) stands alone. It is the "sensor" candidate in the synthetic evaluation harness
// (js/cycle/eval.js sensorModel), moved here unchanged so the app and the evaluation give the same dates
// (tests/cycle-adjust.test.mjs checks this). No new physiological thresholds: the only number is "2 past rises",
// the harness's own minimum, a data-sufficiency rule.
// Evidence: SYNTHETIC ONLY (docs/cycle-eval-synthetic.md). Not validated on real people, a real band or real cycles.
// It never mentions ovulation or fertility, and it is not for contraception.
import { addDays, diffDays, human } from './dates.js';
import { hasConsent, cycles } from './model.js';
import { retrospectiveShift, SHIFT_VERSION } from './tempshift.js';

export const ADJUST_VERSION = `band-adjusted-0.1.0+${SHIFT_VERSION}`;
export const MIN_PAST_RISES = 2;
const median = xs => { const a = [...xs].sort((x, y) => x - y), m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };

const WHY = 'Research feature. It uses your band\'s skin temperature together with your own past cycles. It has not been validated on real people or a real band; it has only been tested on synthetic (made-up) data. Your period may come earlier or later. It is not for contraception.';
const REASONS = {
  no_consent: 'Cycle tracking is not set up.',
  situation: 'Not used in pregnancy, after a birth or with hormonal contraception: your temperature pattern may not follow your cycle then.',
  band_off: 'Your band is not connected.',
  no_period: 'Log a period start first.',
  no_rise_yet: 'No sustained temperature rise seen in this cycle yet, so your estimate comes from your past cycle dates only.',
  too_few_past_rises: `Your band needs to have seen a rise in at least ${MIN_PAST_RISES} past cycles before it can adjust your estimate.`,
};
const notAdjusted = (reason, extra = {}) => ({ version: ADJUST_VERSION, status: 'not_adjusted', reason, text: REASONS[reason], why: WHY, ...extra });

/** The band-adjusted estimate for `today`, or { status: 'not_adjusted', reason } with a plain explanation. */
export function adjustedEstimate(s, today) {
  if (!hasConsent(s)) return notAdjusted('no_consent');
  const sit = s.situation || {};
  if (sit.pregnant || sit.postpartum || sit.hormonalContraception) return notAdjusted('situation');
  if (!s.wearable?.nights?.length) return notAdjusted('band_off');
  const starts = s.periods.map(p => p.start).filter(d => d <= today).sort();
  if (!starts.length) return notAdjusted('no_period');
  const asOf = addDays(today, 1); // includes last night
  const cur = retrospectiveShift(s, starts.at(-1), asOf);
  if (!cur.detected) return notAdjusted('no_rise_yet', { detail: cur.why || null });
  const intervals = [];
  for (const c of cycles(s).filter(c => c.usable && c.nextStart <= today)) {
    const sh = retrospectiveShift(s, c.start, c.nextStart);
    if (sh.detected) intervals.push(diffDays(sh.firstHighNight, c.nextStart));
  }
  if (intervals.length < MIN_PAST_RISES) return notAdjusted('too_few_past_rises', { riseNight: cur.firstHighNight, intervals });
  const lo = Math.min(...intervals), hi = Math.max(...intervals), mid = Math.round(median(intervals));
  const rangeStart = addDays(cur.firstHighNight, lo), rangeEnd = addDays(cur.firstHighNight, hi);
  const span = lo === hi ? `${lo} days` : `${lo} to ${hi} days`;
  const when = lo === hi ? human(rangeStart) : `${human(rangeStart)} – ${human(rangeEnd)}`;
  return { version: ADJUST_VERSION, status: 'adjusted', riseNight: cur.firstHighNight, intervals, date: addDays(cur.firstHighNight, mid),
    rangeStart, rangeEnd, singleDate: lo === hi, overdue: today > rangeEnd,
    text: `Your band showed a sustained rise in skin temperature from ${human(cur.firstHighNight)}. In your past ${intervals.length} cycles with a rise, your period started ${span} after it, so this cycle that points to ${when}.`,
    why: WHY };
}
