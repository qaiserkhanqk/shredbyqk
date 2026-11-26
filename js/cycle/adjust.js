// Band-adjusted period estimate (research flag temperatureEstimate, default OFF).
// When her band shows a sustained rise in wrist skin temperature in THIS cycle (tempshift.js, the existing research
// rule), and she has at least 2 past cycles in which a rise was seen, the estimate is re-centred on this cycle's rise
// plus HER OWN past rise→next-period intervals (shortest to longest; middle = median). Otherwise it says why not and
// the dates-only estimate (predict.js) stands alone. It is the "sensor" candidate in the synthetic evaluation harness
// (js/cycle/eval.js sensorModel). Since 0.2.0 the evaluator calls this function, so the app and the evaluation use the
// same eligibility rules (tests/cycle-adjust.test.mjs and tests/cycle-adjust-eligibility.test.mjs check this). No new physiological thresholds: the only number is "2 past rises",
// the harness's own minimum, a data-sufficiency rule.
// Evidence: SYNTHETIC ONLY (docs/cycle-eval-synthetic.md). Not validated on real people, a real band or real cycles.
// It never mentions ovulation or fertility, and it is not for contraception.
import { addDays, diffDays, human } from './dates.js';
import { hasConsent, cycles, restartDate } from './model.js';
import { estimateNext } from './predict.js';
import { retrospectiveShift, SHIFT_VERSION } from './tempshift.js';

// 0.2.0 (eligibility fixes reported against aee2de8): (1) the same restart boundary after a pregnancy as the dates-only
// model; (2) a current rise that newer usable nights show went back to baseline is not used; (3) rise-to-period history
// is used only from the same band identity (device, model and firmware, all known) as the current rise. Each is a
// conservative data rule for the prototype, not a claim about physiology. No temperature threshold was added: "back to
// baseline" is the rule's own definition (a later usable night at or below the baseline maximum, tempshift.js).
export const ADJUST_VERSION = `band-adjusted-0.2.0+${SHIFT_VERSION}`;
export const MIN_PAST_RISES = 2;
const median = xs => { const a = [...xs].sort((x, y) => x - y), m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
/** The band identity a set of nights came from, or null when any part is missing (unknown is never "the same"). */
const setupId = seg => (seg && [seg.deviceId, seg.model, seg.firmware].every(v => v != null && v !== '') ? JSON.stringify([seg.deviceId, seg.model, seg.firmware]) : null);

const WHY = 'Research feature. It uses your band\'s skin temperature together with your own past cycles. It has not been validated on real people or a real band; it has only been tested on synthetic (made-up) data. Your period may come earlier or later. It is not for contraception.';
const REASONS = {
  no_consent: 'Cycle tracking is not set up.',
  situation: 'Not used in pregnancy, after a birth or with hormonal contraception: your temperature pattern may not follow your cycle then.',
  band_off: 'Your band is not connected.',
  no_period: 'Log a period start first.',
  since_pregnancy: `After a pregnancy, the band needs at least ${MIN_PAST_RISES} new cycles with a rise, plus a rise in this cycle, before it can adjust your estimate. Cycles from before the pregnancy aren't used.`,
  no_rise_yet: 'No sustained temperature rise seen in this cycle yet, so your estimate comes from your past cycle dates only.',
  setup_unknown: 'Your band\'s details (which device, model or software version) are missing from its readings, so they can\'t be matched with your earlier history.',
  rise_ended: 'Your band saw a temperature rise this cycle, but newer nights show it went back to your earlier level, so it isn\'t used to adjust your estimate.',
  new_setup: `Your band or its software changed. Your earlier history came from the previous setup, so it isn't combined with the new one. This returns once there are ${MIN_PAST_RISES} cycles of history from the current setup.`,
  too_few_past_rises: `Your band needs to have seen a rise in at least ${MIN_PAST_RISES} past cycles before it can adjust your estimate.`,
};

/** What to show when the temperature model abstains: the dates-only result, or "Not enough data yet." */
function fallbackFor(s, today) {
  const e = hasConsent(s) ? estimateNext(s, today) : null;
  if (e?.rangeStart) return { status: 'dates_only', rangeStart: e.rangeStart, rangeEnd: e.rangeEnd, singleDate: e.singleDate,
    text: `Your dates-only estimate: ${e.singleDate ? human(e.rangeStart) : `${human(e.rangeStart)} – ${human(e.rangeEnd)}`}.` };
  if (e?.status === 'paused') return { status: 'paused', text: 'Period estimates are paused during pregnancy.' };
  return { status: 'none', text: 'Not enough data yet.' };
}
const abstain = (s, today, reason, extra = {}) => ({ version: ADJUST_VERSION, status: 'not_adjusted', reason, text: REASONS[reason], why: WHY, fallback: fallbackFor(s, today), ...extra });

/** The band-adjusted estimate for `today`, or { status: 'not_adjusted', reason, text, fallback } in plain words. */
export function adjustedEstimate(s, today) {
  const no = (reason, extra) => abstain(s, today, reason, extra);
  if (!hasConsent(s)) return no('no_consent');
  const sit = s.situation || {};
  if (sit.pregnant || sit.postpartum || sit.hormonalContraception) return no('situation');
  if (!s.wearable?.nights?.length) return no('band_off');
  const starts = s.periods.map(p => p.start).filter(d => d <= today).sort();
  if (!starts.length) return no('no_period');
  const since = restartDate(s, today); // (1) the dates-only model's boundary: only cycles that start after the pregnancy
  if (since && starts.at(-1) < since) return no('since_pregnancy');
  const asOf = addDays(today, 1); // includes last night
  const cur = retrospectiveShift(s, starts.at(-1), asOf);
  if (!cur.detected) return no('no_rise_yet', { detail: cur.why || null });
  const id = setupId(cur.segment); // (3) the current rise's band identity must be known
  if (!id) return no('setup_unknown', { riseNight: cur.firstHighNight });
  if (!cur.stillElevated) return no('rise_ended', { riseNight: cur.firstHighNight, returnedOn: cur.returnedOn }); // (2)
  const intervals = []; let otherSetup = 0;
  for (const c of cycles(s).filter(c => c.usable && c.nextStart <= today && (!since || c.start >= since))) {
    const sh = retrospectiveShift(s, c.start, c.nextStart);
    if (!sh.detected) continue;
    if (setupId(sh.segment) !== id) { otherSetup++; continue; } // (3) never combine setups, and unknown never matches
    intervals.push(diffDays(sh.firstHighNight, c.nextStart));
  }
  if (intervals.length < MIN_PAST_RISES) return no(otherSetup ? 'new_setup' : since ? 'since_pregnancy' : 'too_few_past_rises', { riseNight: cur.firstHighNight, intervals });
  const lo = Math.min(...intervals), hi = Math.max(...intervals), mid = Math.round(median(intervals));
  const rangeStart = addDays(cur.firstHighNight, lo), rangeEnd = addDays(cur.firstHighNight, hi);
  const span = lo === hi ? `${lo} days` : `${lo} to ${hi} days`;
  const when = lo === hi ? human(rangeStart) : `${human(rangeStart)} – ${human(rangeEnd)}`;
  return { version: ADJUST_VERSION, status: 'adjusted', riseNight: cur.firstHighNight, intervals, date: addDays(cur.firstHighNight, mid),
    rangeStart, rangeEnd, singleDate: lo === hi, overdue: today > rangeEnd,
    text: `Your band showed a sustained rise in skin temperature from ${human(cur.firstHighNight)}. In your past ${intervals.length} cycles with a rise, your period started ${span} after it, so this cycle that points to ${when}.`,
    why: WHY };
}
