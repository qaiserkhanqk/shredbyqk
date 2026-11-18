// Research inference baseline: transparent, original rules (not a recreation of any product's algorithm).
//  1. descriptiveTrend   — observed nightly medians relative to the person's own early-cycle nights (layer 'descriptive').
//  2. sustainedShift     — EXPERIMENTAL retrospective change rule (layer 'estimate'). A sustained shift is a pattern in
//                          temperature. It is NOT an ovulation date and is never reported as one.
//  3. nextPeriodForecast — EXPERIMENTAL forward forecast from logged cycle lengths only (layer 'forecast'), with an
//                          empirical range that is explicitly NOT a calibrated probability interval.
// Every output carries explanation codes, the algorithm and configuration versions, the data cutoff and a hash of
// exactly the inputs used, so a run can be reproduced and a later revision never overwrites an earlier one.
import { CONFIG, configHash } from './config.js';
import { hashJSON } from './hash.js';
import { median, mad, streamId } from './quality.js';
import { addDays, diffDays } from './cycles.js';
import { NO_SHIFT_TEXT } from './policy.js';

export const TREND_VERSION = 'descriptive-trend-1.1.0';
export const SHIFT_VERSION = 'sustained-shift-rule-1.1.0';
export const FORECAST_VERSION = 'cycle-length-empirical-1.0.0';
const CONFOUNDERS = ['illness', 'fever', 'disrupted_sleep', 'travel'];
const r3 = x => (x == null ? null : Math.round(x * 1000) / 1000);
// The canonical stream identity from quality.js (serial, model, firmware, site, kind, derivation, aggregation): a change
// of any part, including the device model, starts a new segment (issue 6 reported against b3d9589).
const segKey = r => streamId(r.stream);

/** Usable nights of one segment within [from, to): data quality not insufficient and no confounder annotation. */
function nightsFor(reports, from, to) {
  const segs = new Map();
  for (const r of reports) {
    if (r.night < from || (to && r.night >= to) || !r.features) continue;
    const k = segKey(r); if (!segs.has(k)) segs.set(k, []);
    segs.get(k).push(r);
  }
  return segs;
}
const usable = r => r.dataQuality.level !== 'insufficient' && !r.confounders.some(c => CONFOUNDERS.includes(c));

export function descriptiveTrend(reports, cycle, config = CONFIG) {
  const out = [];
  for (const [seg, rs] of nightsFor(reports, cycle.start, cycle.nextStart)) {
    const ok = rs.filter(usable), base = ok.slice(0, config.trend.baselineNights);
    if (base.length < config.trend.baselineNights) { out.push({ layer: 'descriptive', segment: seg, status: 'insufficient_data', reasons: ['too_few_usable_nights_for_baseline'], nights: [] }); continue; }
    const b = median(base.map(r => r.features.median));
    const devs = ok.map(r => ({ night: r.night, median: r.features.median, deviation: r3(r.features.median - b) }));
    devs.forEach((d, i) => { const w = devs.slice(Math.max(0, i - config.trend.rollingNights + 1), i + 1); d.rolling = r3(median(w.map(x => x.deviation))); });
    out.push({ layer: 'descriptive', segment: seg, status: 'ok', baseline: r3(b), baselineNights: base.map(r => r.night), nights: devs, reasons: ['relative_to_own_first_usable_nights_of_cycle'], version: TREND_VERSION });
  }
  return out;
}

/**
 * Experimental retrospective sustained-shift rule, per cycle and per device segment. A candidate night c qualifies when
 * the `sustainNights` usable nights starting at c (no calendar gap above `maxGapNights`) are ALL at least
 * max(minDelta, madK × scaled MAD) above the median of the `baselineNights` usable nights before c (≥ minBaselineNights).
 * The reported night is the earliest qualifying c. Its uncertainty is the calendar range in which the change could
 * have begun (after the last usable night below the threshold, up to c), given gaps in the data.
 */
export function sustainedShift(reports, cycle, { dataCutoff, config = CONFIG } = {}) {
  const base = { layer: 'estimate', experimental: true, kind: 'retrospective_sustained_temperature_shift', cycleStart: cycle.start, dataCutoff: dataCutoff ?? null, algorithmVersion: SHIFT_VERSION, configVersion: config.version, configHash: configHash(config),
    note: 'A sustained shift is a change in the temperature pattern. It does not confirm or date ovulation.' };
  const end = cycle.nextStart ?? (dataCutoff ? addDays(dataCutoff, 1) : null);
  const segs = nightsFor(reports, cycle.start, end), results = [];
  if (!segs.size) return { ...base, status: 'insufficient_data', reasons: ['no_nightly_data_in_cycle'], inputHash: hashJSON([]) };
  const multiSeg = segs.size > 1;
  for (const [seg, rs] of segs) {
    const p = config.shift[rs[0].stream.kind];
    const inputHash = hashJSON({ cycle, rs: rs.map(r => [r.night, r.features.median, r.dataQuality.level, r.confounders]), cfg: p });
    if (!p) { results.push({ seg, status: 'insufficient_data', reasons: ['no_shift_rule_for_measurement_kind'], inputHash }); continue; }
    const excluded = rs.filter(r => !usable(r)).map(r => ({ night: r.night, reason: r.dataQuality.level === 'insufficient' ? 'data_quality_insufficient' : 'confounder_annotated' }));
    const ok = rs.filter(usable);
    let found = null; const candidates = [];
    for (let i = p.minBaselineNights; i + p.sustainNights <= ok.length; i++) {
      const before = ok.slice(Math.max(0, i - p.baselineNights), i), after = ok.slice(i, i + p.sustainNights);
      if (before.length < p.minBaselineNights) continue;
      if (after.some((r, k) => k && diffDays(after[k - 1].night, r.night) > p.maxGapNights + 1)) continue;
      const vals = before.map(r => r.features.median), b = median(vals), thr = Math.max(p.minDelta, p.madK * 1.4826 * mad(vals));
      if (after.every(r => r.features.median >= b + thr)) { candidates.push({ night: ok[i].night, baseline: r3(b), threshold: r3(thr), prevUsable: ok[i - 1].night }); if (!found) found = candidates.at(-1); }
    }
    const cycleNights = end ? diffDays(cycle.start, end) : null, usableShare = cycleNights ? ok.length / cycleNights : null;
    if (found) {
      results.push({ seg, status: 'shift_detected', shiftNight: found.night, reasons: ['sustained_rise_above_own_preceding_nights', ...(multiSeg ? ['device_segments_analysed_separately'] : []), ...(excluded.length ? ['some_nights_excluded'] : [])],
        evidence: { baseline: found.baseline, threshold: found.threshold, sustainNights: p.sustainNights, usableNights: ok.length, excludedNights: excluded },
        uncertainty: { earliestNight: addDays(found.prevUsable, 1), latestNight: found.night, calibrated: false, meaning: 'calendar range in which the change could have begun, given gaps in the data (uncalibrated)' }, inputHash });
    } else {
      const reasons = [];
      if (ok.length < p.minBaselineNights + p.sustainNights) reasons.push('too_few_usable_nights');
      if (!cycle.complete && !dataCutoff) reasons.push('cycle_in_progress_without_cutoff');
      if (usableShare != null && usableShare < 0.6) reasons.push('usable_nights_below_60_percent_of_cycle');
      if (multiSeg) reasons.push('device_change_within_cycle');
      if (reasons.length) results.push({ seg, status: 'insufficient_data', reasons, evidence: { usableNights: ok.length, excludedNights: excluded }, inputHash });
      else results.push({ seg, status: 'no_clear_shift', text: NO_SHIFT_TEXT, reasons: ['rule_not_met_in_available_nights'], evidence: { usableNights: ok.length, excludedNights: excluded }, uncertainty: { calibrated: false, meaning: 'absence of a detected pattern under this rule; says nothing about biology' }, inputHash });
    }
  }
  const pick = results.find(r => r.status === 'shift_detected') || results.find(r => r.status === 'no_clear_shift') || results[0];
  const { seg, ...rest } = pick;
  return { ...base, ...rest, segment: seg, segments: results.map(r => ({ segment: r.seg, status: r.status, reasons: r.reasons })), inputHash: hashJSON(results.map(r => r.inputHash)) };
}

/**
 * Experimental next-period forecast from the person's own logged cycle lengths known at `asOfDate`.
 * Point: median of the last ≤ maxCycles usable lengths. Range: shortest to longest of the same cycles. The range is an
 * empirical description of past cycles and has NOT been calibrated as a probability interval.
 */
export function nextPeriodForecast(cycles, { asOfDate, config = CONFIG } = {}) {
  const p = config.forecast, done = cycles.filter(c => c.complete && c.nextStart <= asOfDate), last = cycles.filter(c => c.start <= asOfDate).at(-1);
  const lengths = done.filter(c => c.usable).slice(-p.maxCycles).map(c => c.length);
  const base = { layer: 'forecast', experimental: true, kind: 'next_period_start', asOfDate, algorithmVersion: FORECAST_VERSION, configVersion: config.version, configHash: configHash(config), inputHash: hashJSON({ asOfDate, lengths, last: last?.start ?? null }) };
  if (!last) return { ...base, status: 'insufficient_data', reasons: ['no_logged_period_start'] };
  if (lengths.length < p.minCycles) return { ...base, status: 'insufficient_data', reasons: ['too_few_usable_cycles', `have_${lengths.length}_need_${p.minCycles}`] };
  const since = diffDays(last.start, asOfDate);
  if (since > Math.max(...lengths) + 30) return { ...base, status: 'insufficient_data', reasons: ['history_stale_no_recent_period_logged'] };
  const m = Math.round(median(lengths)), lo = Math.min(...lengths), hi = Math.max(...lengths);
  const reasons = ['from_own_logged_cycle_lengths_only', `cycles_used_${lengths.length}`];
  if (since > hi) reasons.push('past_longest_recent_cycle');
  if (hi - lo > 9) reasons.push('cycle_lengths_vary_widely');
  return { ...base, status: 'estimate', pointDate: addDays(last.start, m), lastStart: last.start, cycleLengthsUsed: lengths, reasons,
    uncertainty: { rangeStart: addDays(last.start, lo), rangeEnd: addDays(last.start, hi), method: p.intervalMethod, calibrated: false, meaning: 'shortest to longest of recent cycles; not a calibrated interval' } };
}
