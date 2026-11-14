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
// excluding nights with a time-zone change and days the user marked as unwell or travelling.
import { diffDays } from './dates.js';
import { segments } from './wearables.js';

export const SHIFT_PARAMS = Object.freeze({ BASELINE: 6, CONFIRM: 3, DELTA: 0.15, MAX_BASELINE_SPAN: 12, MAX_CONFIRM_SPAN: 5 });
export const SHIFT_VERSION = 'three-over-six-skin-0.1.0-research';

export function retrospectiveShift(s, cycleStart, asOf, params = SHIFT_PARAMS) {
  const segs = segments(s.wearable.nights.filter(n => n.night >= cycleStart && n.night < asOf));
  const seg = segs.at(-1);
  const res = { version: SHIFT_VERSION, detected: false, segment: seg ? { model: seg.model, firmware: seg.firmware } : null, deviceChangedThisCycle: segs.length > 1, excluded: { notOk: 0, flagged: 0, userFlagged: 0 }, nightsUsed: 0 };
  if (!seg) return { ...res, why: 'No skin-temperature nights in this cycle.' };
  const valid = [];
  for (const n of seg.nights) {
    if (n.status !== 'ok' || n.value == null) { res.excluded.notOk++; continue; }
    if (n.flags.includes('tz_change')) { res.excluded.flagged++; continue; }
    if (s.days[n.night]?.unwell || s.days[n.night]?.travel) { res.excluded.userFlagged++; continue; }
    valid.push(n);
  }
  res.nightsUsed = valid.length;
  const { BASELINE: B, CONFIRM: C, DELTA, MAX_BASELINE_SPAN, MAX_CONFIRM_SPAN } = params;
  if (valid.length < B + C) return { ...res, why: `Only ${valid.length} usable nights${res.deviceChangedThisCycle ? ' since the device changed' : ''}; ${B + C} are needed.` };
  for (let i = B; i + C <= valid.length; i++) {
    const base = valid.slice(i - B, i), high = valid.slice(i, i + C);
    if (diffDays(base[0].night, base.at(-1).night) > MAX_BASELINE_SPAN || diffDays(high[0].night, high.at(-1).night) > MAX_CONFIRM_SPAN) continue;
    const bMax = Math.max(...base.map(n => n.value)), bMean = base.reduce((a, n) => a + n.value, 0) / B, hMean = high.reduce((a, n) => a + n.value, 0) / C;
    if (high.every(n => n.value > bMax) && hMean - bMean >= DELTA) {
      return { ...res, detected: true, firstHighNight: high[0].night, confirmedNight: high.at(-1).night, baselineMean: +bMean.toFixed(2), highMean: +hMean.toFixed(2), rise: +(hMean - bMean).toFixed(2),
        cycleDayOfRise: diffDays(cycleStart, high[0].night) + 1, why: 'A sustained rise was seen. This may be consistent with a past ovulation. It is not proof.' };
    }
  }
  return { ...res, why: 'No sustained rise seen in this cycle so far.' };
}
