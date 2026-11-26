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
import { retrospectiveShift, isUsableNight, SHIFT_VERSION } from './tempshift.js';

// 0.2.0 (eligibility fixes reported against aee2de8): (1) the same restart boundary after a pregnancy as the dates-only
// model; (2) a current rise that newer usable nights show went back to baseline is not used; (3) rise-to-period history
// is used only from the same band identity (device, model and firmware, all known) as the current rise. Each is a
// conservative data rule for the prototype, not a claim about physiology. No temperature threshold was added: "back to
// baseline" is the rule's own definition (a later usable night at or below the baseline maximum, tempshift.js).
// 0.3.0 (stale band data, reported on e02a689): the band's data must be recent. Freshness comes from the night of the
// last USABLE overnight reading (the same quality rules as the temperature rule), never from when the band connected
// or synced, so old nights arriving late, duplicates and failed readings can't make it look fresh. When stale, band
// data is not used and the logged-period estimate is shown; it resumes only when new usable nights meet every rule.
export const ADJUST_VERSION = `band-adjusted-0.3.0+${SHIFT_VERSION}`;
/** PROVISIONAL settings, not clinical thresholds. MAX_MISSING_RECENT_NIGHTS: how many nights in a row since the last
 *  usable overnight reading may be missing before band data counts as stale. 3 matches the gap the temperature rule
 *  already tolerates between its windows (tempshift.js MAX_JOIN_MISSING = MAX_CONFIRM_SPAN − CONFIRM + 1). It is a
 *  data-continuity choice for the prototype and must be validated with the actual band before a pilot. */
export const ADJUST_PARAMS = Object.freeze({ MAX_MISSING_RECENT_NIGHTS: 3 });
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
  stale_band: 'No recent usable band data. This estimate is based on your logged periods.',
  stale_band_no_dates: 'No recent usable band data, and there aren\'t enough logged periods yet for an estimate.',
  setup_unknown: 'Your band\'s details (which device, model or software version) are missing from its readings, so they can\'t be matched with your earlier history.',
  rise_ended: 'Your band saw a temperature rise this cycle, but newer nights show it went back to your earlier level, so it isn\'t used to adjust your estimate.',
  new_setup: `Your band or its software changed. Your earlier history came from the previous setup, so it isn't combined with the new one. This returns once there are ${MIN_PAST_RISES} cycles of history from the current setup.`,
  too_few_past_rises: `Your band needs to have seen a rise in at least ${MIN_PAST_RISES} past cycles before it can adjust your estimate.`,
};

/** What to show when the temperature model abstains: the dates-only result, or "Not enough data yet." */
function fallbackFor(s, today) {
  const e = hasConsent(s) ? estimateNext(s, today) : null;
  if (e?.rangeStart) {
    const when = e.singleDate ? human(e.rangeStart) : `${human(e.rangeStart)} – ${human(e.rangeEnd)}`;
    return { status: 'dates_only', rangeStart: e.rangeStart, rangeEnd: e.rangeEnd, singleDate: e.singleDate, overdue: !!e.overdue,
      text: e.overdue ? `Based on your logged periods, your period was expected ${e.singleDate ? 'on' : 'between'} ${when}. That has passed and no new period has been logged. If your period has started, please log it.`
        : `Your dates-only estimate: ${when}.` };
  }
  if (e?.status === 'paused') return { status: 'paused', text: 'Period estimates are paused during pregnancy.' };
  return { status: 'none', text: 'Not enough data yet.' };
}
const abstain = (s, today, reason, extra = {}) => {
  const fallback = fallbackFor(s, today);
  const text = reason === 'stale_band' && fallback.status !== 'dates_only' ? REASONS.stale_band_no_dates : REASONS[reason];
  return { version: ADJUST_VERSION, status: 'not_adjusted', reason, text, why: WHY, fallback, ...extra };
};

/** The night of the last usable overnight skin-temperature reading up to `today`, or null. Uses the night the
 *  reading describes (not when it was synced); duplicates of a night count once; readings failing quality checks
 *  don't count. */
export function lastUsableNight(s, today) {
  let last = null;
  for (const n of s.wearable?.nights || []) if (n.night <= today && (!last || n.night > last) && isUsableNight(s, n)) last = n.night;
  return last;
}

/** The band-adjusted estimate for `today`, or { status: 'not_adjusted', reason, text, fallback } in plain words. */
export function adjustedEstimate(s, today, { params = ADJUST_PARAMS } = {}) {
  let lastNight;
  const no = (reason, extra) => abstain(s, today, reason, lastNight === undefined ? extra : { lastUsableNight: lastNight, ...extra });
  if (!hasConsent(s)) return no('no_consent');
  const sit = s.situation || {};
  if (sit.pregnant || sit.postpartum || sit.hormonalContraception) return no('situation');
  if (!s.wearable?.nights?.length) return no('band_off');
  const starts = s.periods.map(p => p.start).filter(d => d <= today).sort();
  if (!starts.length) return no('no_period');
  lastNight = lastUsableNight(s, today); // freshness: from the last usable overnight reading, not from syncing
  if (!lastNight || diffDays(lastNight, today) - 1 > params.MAX_MISSING_RECENT_NIGHTS) return no('stale_band');
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
  return { version: ADJUST_VERSION, status: 'adjusted', lastUsableNight: lastNight, riseNight: cur.firstHighNight, intervals, date: addDays(cur.firstHighNight, mid),
    rangeStart, rangeEnd, singleDate: lo === hi, overdue: today > rangeEnd,
    text: `Your band showed a sustained rise in skin temperature from ${human(cur.firstHighNight)}. In your past ${intervals.length} cycles with a rise, your period started ${span} after it, so this cycle that points to ${when}.`,
    why: WHY };
}

/** What the card shows, for any result: the range (only when adjusted), the reason or explanation, the fallback, the
 *  date of the last usable overnight reading, and — when an estimated date has passed with no new period logged —
 *  that it is overdue and a request to log or confirm her period. Dates are never rolled forward. */
export function cardLines(a) {
  const when = a.rangeStart ? (a.singleDate ? human(a.rangeStart) : `${human(a.rangeStart)} – ${human(a.rangeEnd)}`) : null;
  const overdue = a.status === 'adjusted' && a.overdue
    ? `The band-adjusted date (${when}) has passed and no new period has been logged. If your period has started, please log it.` : null;
  return {
    range: a.status === 'adjusted' ? when : null,
    text: a.text, fallback: a.fallback?.text || null, overdue,
    askToLog: !!(overdue || a.fallback?.overdue),
    lastReading: a.lastUsableNight ? `Last usable overnight band reading: ${human(a.lastUsableNight)}.` : a.lastUsableNight === null ? 'No usable overnight band reading yet.' : null,
    why: a.why,
  };
}
