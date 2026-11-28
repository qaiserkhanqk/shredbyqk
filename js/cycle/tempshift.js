// RESEARCH ONLY (flag temperatureResearch, default OFF). Not used for any period estimate in the app.
//
// Looks back over the current cycle for a SUSTAINED RISE in nightly wrist skin temperature, using a
// "three-over-six" style rule adapted from basal-body-temperature charting: three consecutive valid nights
// all above the highest of the six valid nights before them, with the mean rise at least DELTA.
//
// Why it is retrospective: the rise can only be confirmed on the third high night, so by definition it
// describes something that may already have happened. It is NOT an advance warning of ovulation, and a
// rise "may be consistent with" ovulation; it is not proof.
// Why it is research: the rule comes from oral/vaginal BBT practice. Its behaviour on wrist SKIN temperature
// from a given device is unknown until tested against a clinician-designed reference (e.g. urinary LH plus
// ultrasound). DELTA and the window sizes are placeholders, NOT weights fitted to data; they must be
// pre-registered before any study.
//
// Data rules: only 'ok' nights, from ONE device + firmware segment (a device change restarts the baseline),
// excluding nights with a time-zone change and nights the user marked as disturbed (unwell, travelling, alcohol, a late
// night, a hot or cold room: model.NIGHT_DISRUPTORS).
import { diffDays, addDays } from './dates.js';
import { segments } from './wearables.js';
import { nightDisrupted } from './model.js';

export const SHIFT_PARAMS = Object.freeze({ BASELINE: 6, CONFIRM: 3, DELTA: 0.15, MAX_BASELINE_SPAN: 12, MAX_CONFIRM_SPAN: 5 });
// 0.2.0 (f67000b fix, issue 4 reported against b3d9589): one eligible observation per biological night; several sessions on
// one night no longer count as several nights. 0.1.0 counted every session summary. (Version bumped: issue 3 reported against f67000b.)
// 0.3.0 (findings reported against 21317c5): reports a possible-onset interval, and says when a rise may have begun while
// the baseline was forming. The detection rule itself is unchanged from 0.2.0.
// 0.4.0 (competitor-gap work): nights marked with alcohol, a late night or a hot or cold room are left out too, as
// unwell and travelling nights already were. The detection rule is unchanged.
export const SHIFT_VERSION = 'three-over-six-skin-0.4.0-night-aggregated-onset-interval-disruptors-research';
/** The data-quality rules this rule applies to a night, as one test (used for band-data freshness in adjust.js):
 *  a skin-temperature night with status 'ok', a value, no time-zone change, and not marked disturbed by the user. */
export const isUsableNight = (s, n) => n.metric === 'skin_temp' && n.status === 'ok' && n.value != null && !(n.flags || []).includes('tz_change') && !nightDisrupted(s, n.night);
const BASELINE_LIMIT = 'This rule cannot see a rise that begins while its 6-night baseline is still forming.';

export function retrospectiveShift(s, cycleStart, asOf, params = SHIFT_PARAMS) {
  const segs = segments(s.wearable.nights.filter(n => n.night >= cycleStart && n.night < asOf));
  const seg = segs.at(-1);
  const res = { version: SHIFT_VERSION, detected: false, segment: seg ? { deviceId: seg.deviceId, model: seg.model, firmware: seg.firmware } : null, deviceChangedThisCycle: segs.length > 1, excluded: { notOk: 0, flagged: 0, userFlagged: 0 }, nightsUsed: 0 };
  if (!seg) return { ...res, why: 'No skin-temperature nights in this cycle.' };
  // One eligible observation per biological night (issue 4 reported against b3d9589): several sleep sessions can
  // carry the same night label (split sleep, a nap misclassified as main sleep, a corrected re-send). They must not
  // count as separate nights in the baseline or the confirmation window. The night's observation is its eligible
  // session with the most coverage (then the earliest start, then the session ID, so the choice is deterministic);
  // the others are counted in `excluded.sameNightSessions`. This is a data rule, not a physiological one.
  const byNight = new Map();
  res.excluded.sameNightSessions = 0;
  for (const n of seg.nights) {
    if (n.status !== 'ok' || n.value == null) { res.excluded.notOk++; continue; }
    if (n.flags.includes('tz_change')) { res.excluded.flagged++; continue; }
    if (nightDisrupted(s, n.night)) { res.excluded.userFlagged++; continue; }
    const cur = byNight.get(n.night);
    if (!cur) { byNight.set(n.night, n); continue; }
    res.excluded.sameNightSessions++;
    const better = (n.coverageMin ?? 0) - (cur.coverageMin ?? 0) || (cur.firstAt ?? 0) - (n.firstAt ?? 0) || String(cur.sleepSessionId).localeCompare(String(n.sleepSessionId));
    if (better > 0) byNight.set(n.night, n);
  }
  const valid = [...byNight.values()].sort((a, b) => a.night.localeCompare(b.night));
  res.nightsUsed = valid.length; // distinct biological nights
  const { BASELINE: B, CONFIRM: C, DELTA, MAX_BASELINE_SPAN, MAX_CONFIRM_SPAN } = params;
  if (valid.length < B + C) return { ...res, why: `Only ${valid.length} usable nights${res.deviceChangedThisCycle ? ' since the device changed' : ''}; ${B + C} are needed.` };
  // Continuity (issue 8 reproduced in 0f26696): the baseline and the high nights must be close together, not
  // separated by a long gap. No new physiological number is introduced: the gap allowed between the two windows
  // is the same number of missing nights the confirmation window already tolerates (MAX_CONFIRM_SPAN − CONFIRM + 1).
  // It is a data-continuity rule pending device evidence, not a claim about physiology.
  const MAX_JOIN_MISSING = MAX_CONFIRM_SPAN - C + 1;
  let gapBlocked = 0, judged = 0;
  for (let i = B; i + C <= valid.length; i++) {
    const base = valid.slice(i - B, i), high = valid.slice(i, i + C);
    if (diffDays(base[0].night, base.at(-1).night) > MAX_BASELINE_SPAN || diffDays(high[0].night, high.at(-1).night) > MAX_CONFIRM_SPAN ||
        diffDays(base.at(-1).night, high[0].night) - 1 > MAX_JOIN_MISSING) { gapBlocked++; continue; }
    judged++;
    const bMax = Math.max(...base.map(n => n.value)), bMean = base.reduce((a, n) => a + n.value, 0) / B, hMean = high.reduce((a, n) => a + n.value, 0) / C;
    if (high.every(n => n.value > bMax) && hMean - bMean >= DELTA) {
      // What happened AFTER the rise (issue 2 reproduced in 80ea40f). This is reported, not judged here: whether the
      // event can describe TODAY is decided by phase.js. "Back to baseline" uses the rule's own definition of
      // high (above the baseline maximum); no new physiological threshold is introduced.
      const after = valid.filter(n => n.night > high.at(-1).night), back = after.find(n => n.value <= bMax);
      // Possible onset (finding 4a): the change began after the last baseline night (all of which are at or below the
      // baseline maximum) and by the first high night. Missing nights in between are part of the interval. It is a range
      // of nights in the temperature data, not a biological date, and it is not calibrated.
      const possibleOnset = { earliestNight: addDays(base.at(-1).night, 1), latestNight: high[0].night, leftCensored: false, basis: 'after the last baseline night, up to the first high night' };
      return { ...res, detected: true, firstHighNight: high[0].night, confirmedNight: high.at(-1).night, possibleOnset, baselineMean: +bMean.toFixed(2), highMean: +hMean.toFixed(2), rise: +(hMean - bMean).toFixed(2),
        cycleDayOfRise: diffDays(cycleStart, high[0].night) + 1, nightsAfter: after.length, stillElevated: !back, returnedOn: back?.night || null, lastValidNight: valid.at(-1).night,
        why: back ? `A rise was seen from ${high[0].night}, but it did not last: back to the earlier level on ${back.night}.` : 'A rise was seen. This may be consistent with a past ovulation. It is not proof.' };
    }
  }
  if (!judged) return { ...res, abstained: true, why: 'Not judged: there are gaps in the nightly data, so there is not enough continuous data to compare nights.' };
  if (gapBlocked) return { ...res, why: `No sustained rise seen in the continuous stretches of data; some gaps could not be judged. ${BASELINE_LIMIT}` };
  return { ...res, why: `No sustained rise seen in this cycle so far. ${BASELINE_LIMIT}` };
}
