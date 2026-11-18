// Unit tests: quality pipeline, segmentation, trend, shift rule, forecast, evaluation. Synthetic data only.
// Passing tests show the code behaves as specified on invented data. They are NOT evidence of accuracy.
// Run: node research/tests/analysis.test.mjs
import { preview } from '../lib/ingest.js';
import { participant, OBS_COLUMNS, ANN_COLUMNS, addDays } from '../lib/synth.js';
import { nightlyReports, placeNight } from '../lib/quality.js';
import { effectiveAnnotations, segment } from '../lib/cycles.js';
import { sustainedShift, nextPeriodForecast, descriptiveTrend } from '../lib/inference.js';
import { analyse } from '../lib/pipeline.js';
import { evaluateForecast, evaluateShift } from '../lib/evaluate.js';
import * as P from '../lib/policy.js';
import { CONFIG } from '../lib/config.js';
import { check, done } from './harness.mjs';

const csv = (cols, rows) => [cols.join(','), ...rows.map(r => cols.map(c => String(r[c] ?? '')).join(','))].join('\n');
const INGESTED = Date.parse('2027-01-01T00:00:00Z');
function load(p, extra = {}) {
  const o = preview(csv(OBS_COLUMNS, p.observations), { format: 'csv', recordType: 'observations', participantRef: p.ref, ...extra });
  const a = preview(csv(ANN_COLUMNS, p.annotations), { format: 'csv', recordType: 'annotations', participantRef: p.ref, consents: { lh_tests: true } });
  return { ref: p.ref, events: p.events, observations: o.accepted.map((x, i) => ({ ...x, id: i + 1, seq: i + 1, ingestedAt: INGESTED })), annotations: a.accepted, prev: o };
}
const obsRow = (ref, iso, value, o = {}) => ({ participant_ref: ref, timestamp_utc: iso, end_timestamp_utc: new Date(Date.parse(iso) + 600e3).toISOString(), utc_offset_minutes: 0, device_manufacturer: 'SyntheticCo', device_model: 'SYN-1', device_serial_pseudonym: `${ref}-dev1`, firmware: '1', sampling_interval_s: 600, sensor_site: 'wrist', measurement_kind: 'skin_temperature', derivation: 'raw', aggregation: 'sample', value, unit: 'C', ...o });
const accept = (ref, rows) => preview(csv(OBS_COLUMNS, rows), { format: 'csv', recordType: 'observations', participantRef: ref }).accepted.map((x, i) => ({ ...x, id: i + 1, seq: i + 1, ingestedAt: INGESTED }));

/* ---- Night placement: DST, travel, midnight crossing ---- */
{
  const at = (iso, off, sess = null) => placeNight({ aggregation: 'sample', tsUtc: Date.parse(iso), offsetMin: off, sleepSessionId: sess });
  check('night: 23:30 and 02:30 local belong to the same night (midnight crossing)', at('2026-03-07T23:30:00Z', 0).night === '2026-03-07' && at('2026-03-08T02:30:00Z', 0).night === '2026-03-07');
  // US DST starts 2026-03-08 02:00 local: offset −300 before, −240 after. Source offsets are used as given.
  check('night: a sample before and after a DST change, each with its own source offset, share a night', at('2026-03-08T06:30:00Z', -300).night === '2026-03-07' && at('2026-03-08T08:30:00Z', -240).night === '2026-03-07');
  check('night: after flying to UTC+9 the local clock decides the night', at('2026-03-10T15:00:00Z', 540).night === '2026-03-10');
  check('night: without a sleep session, a daytime sample is outside the fallback window', at('2026-03-10T14:00:00Z', 0).reason === 'outside_fallback_window');
  check('night: a sample with a sleep session is used whatever the clock time (shift work)', at('2026-03-10T14:00:00Z', 0, 's1').windowSource === 'sleep_session');
  check('night: no UTC offset → cannot be placed (never assumed to be UTC)', at('2026-03-10T01:00:00Z', null).reason === 'no_utc_offset');
}

/* ---- Quality ---- */
{
  const ref = 'P-QUAL-0001', t0 = Date.parse('2026-02-01T23:00:00Z');
  const rows = Array.from({ length: 30 }, (_, i) => obsRow(ref, new Date(t0 + i * 600e3).toISOString(), (33.8 + (i % 2) * 0.02).toFixed(2)));
  rows[10].value = '38.90'; // isolated spike
  rows[20].source_quality_flags = 'off_body';
  rows[21].source_quality_flags = 'vendor_mystery_flag';
  const obs = accept(ref, rows);
  obs.reverse().forEach((o, i) => { o.seq = i + 1; }); // arrived in reverse order
  const [r] = nightlyReports(obs).reports;
  check('quality: an isolated spike is excluded with a reason and not averaged in', r.counts.excluded.isolated_outlier === 1 && r.features.median < 34, JSON.stringify(r.counts));
  check('quality: a documented off-body flag excludes that sample', r.counts.excluded['source_flag:off_body'] === 1);
  check('quality: an unknown source flag is reported verbatim and not interpreted', r.unrecognisedSourceFlags.includes('vendor_mystery_flag') && r.dataQuality.reasons.includes('unrecognised_source_flags'));
  check('quality: out-of-order arrival is detected', r.flags.includes('out_of_order_arrival') && r.counts.outOfOrder > 0);
  check('quality: coverage in minutes from measurement intervals; window and offsets reported', r.coverageMinutes > 250 && r.window.source === 'config_fallback_window' && r.window.utcOffsetsMin[0] === 0);
  check('quality: robust features (median, MAD, IQR) with method and config versions', r.features.mad != null && r.features.p25 <= r.features.p75 && r.method && r.dataQuality.about.includes('not biological'));
  const sparse = nightlyReports(accept(ref, rows.slice(0, 4))).reports[0];
  check('quality: a sparse night is "insufficient" with reasons', sparse.dataQuality.level === 'insufficient' && sparse.dataQuality.reasons.includes('too_few_valid_samples'));
  const gap = nightlyReports(accept(ref, [...rows.slice(0, 12), ...rows.slice(25)])).reports[0];
  check('quality: a long gap is reported and limits quality', gap.maxGapMinutes >= 120 && gap.dataQuality.reasons.includes('gap_above_maximum'));
  const noEnd = nightlyReports(accept(ref, rows.map(x => ({ ...x, end_timestamp_utc: '', sampling_interval_s: '' })))).reports[0];
  check('quality: with no end time or sampling interval, coverage is unknown, not guessed', noEnd.coverageMinutes === null && noEnd.dataQuality.reasons.includes('coverage_unknown'));
  check('quality: empty input gives no reports and no crash', nightlyReports([]).reports.length === 0);
}
{
  const p = load(participant({ ref: 'P-DEV-0001', seed: 3, cycleLengths: [8], samplesPerNight: 48, intervalMin: 10, deviceChangeOn: '2026-01-09', tzChanges: [{ from: '2026-01-11', offset: 540 }] }));
  const reps = nightlyReports(p.observations).reports;
  check('quality: device replacement creates a separate stream; never pooled', new Set(reps.map(r => r.stream.serial)).size === 2 && reps.every(r => new Set([r.stream.serial]).size === 1));
  check('quality: the first night on the new device is flagged as a transition', reps.find(r => r.night === '2026-01-09').flags.includes('device_change_since_previous_night'));
  const fw = accept('P-FW-0001', [...Array.from({ length: 12 }, (_, i) => obsRow('P-FW-0001', new Date(Date.parse('2026-02-01T23:00:00Z') + i * 600e3).toISOString(), '33.8')), ...Array.from({ length: 12 }, (_, i) => obsRow('P-FW-0001', new Date(Date.parse('2026-02-02T23:00:00Z') + i * 600e3).toISOString(), '33.8', { firmware: '2' }))]);
  check('quality: a firmware change is flagged and kept as a separate stream', nightlyReports(fw).reports[1].flags.includes('firmware_change_since_previous_night'));
  const mixed = accept('P-MIX-0001', [...Array.from({ length: 12 }, (_, i) => obsRow('P-MIX-0001', new Date(Date.parse('2026-02-01T23:00:00Z') + i * 600e3).toISOString(), '33.8')), ...Array.from({ length: 12 }, (_, i) => obsRow('P-MIX-0001', new Date(Date.parse('2026-02-01T23:00:00Z') + i * 600e3).toISOString(), '36.6', { sensor_site: 'oral', measurement_kind: 'basal_body_temperature', device_serial_pseudonym: 'P-MIX-0001-thermo' }))]);
  const mr = nightlyReports(mixed).reports;
  check('quality: wrist skin and oral readings on the same night stay separate (no cross-site averaging)', mr.length === 2 && mr.some(r => r.features.median < 34) && mr.some(r => r.features.median > 36));
}

/* ---- Segmentation and corrections ---- */
{
  const a = preview(['participant_ref,entry_id,type,value,date,recorded_at,corrects',
    'P-SEG-0001,P-SEG-0001-1,bleeding,period_start,2026-01-05,2026-01-05T09:00:00Z,', 'P-SEG-0001,P-SEG-0001-2,bleeding,period,2026-01-06,2026-01-06T09:00:00Z,',
    'P-SEG-0001,P-SEG-0001-3,bleeding,spotting,2026-01-20,2026-01-20T09:00:00Z,', 'P-SEG-0001,P-SEG-0001-4,bleeding,period,2026-02-04,2026-02-04T09:00:00Z,',
    'P-SEG-0001,P-SEG-0001-5,bleeding,period_start,2026-02-03,2026-02-07T09:00:00Z,P-SEG-0001-4', 'P-SEG-0001,P-SEG-0001-6,bleeding,period_start,2026-03-30,2026-03-30T09:00:00Z,'].join('\n'),
    { format: 'csv', recordType: 'annotations', participantRef: 'P-SEG-0001' }).accepted;
  const now = segment(effectiveAnnotations(a)).cycles;
  check('segment: spotting never starts a cycle; a bleeding run without an explicit start does', now.length === 3 && now[0].start === '2026-01-05');
  check('segment: a correction replaces the earlier entry (start moved to 3 Feb)', now[1].start === '2026-02-03' && now[0].length === 29);
  const before = segment(effectiveAnnotations(a, { asOf: Date.parse('2026-02-05T00:00:00Z') })).cycles;
  check('segment: the view as known on 5 Feb still has the uncorrected start (history kept)', before[1].start === '2026-02-04');
  check('segment: a 55-day cycle is within the 15–90 day range and used', now[1].length === 55 && now[1].usable);
  const long = segment(effectiveAnnotations([...a, { participantRef: 'P-SEG-0001', entryId: 'P-SEG-0001-7', type: 'bleeding', value: 'period_start', date: '2026-07-30', recordedAt: Date.parse('2026-07-30T09:00:00Z'), corrects: null }])).cycles;
  check('segment: a 122-day cycle is marked "check entries" and not used', long[2].length === 122 && !long[2].usable && long[2].codes.includes('length_outside_plausible_range_check_entries'));
  const retract = effectiveAnnotations([...a, { participantRef: 'P-SEG-0001', entryId: 'P-SEG-0001-8', type: 'bleeding', value: 'retracted', date: '2026-03-30', recordedAt: Date.parse('2026-04-01T09:00:00Z'), corrects: 'P-SEG-0001-6' }]);
  check('segment: a retraction removes the entry', segment(retract).cycles.length === 2);
}

/* ---- Shift rule ---- */
const cohort = {
  regular: participant({ ref: 'P-REG-0001', seed: 21, rise: 0.5, samplesPerNight: 48, intervalMin: 10 }), // a deliberately clear synthetic rise
  flat: participant({ ref: 'P-FLAT-0001', seed: 22, rise: 0, samplesPerNight: 48, intervalMin: 10 }),
  noisy: participant({ ref: 'P-NOISY-0001', seed: 23, nightlyNoise: 0.35, samplesPerNight: 48, intervalMin: 10 }),
  gradual: participant({ ref: 'P-GRAD-0001', seed: 24, rise: 0.12, samplesPerNight: 48, intervalMin: 10 }),
};
const L = Object.fromEntries(Object.entries(cohort).map(([k, p]) => [k, load(p)]));
const shiftsFor = l => { const eff = effectiveAnnotations(l.annotations), q = nightlyReports(l.observations, eff); return segment(eff).cycles.filter(c => c.complete).map(c => sustainedShift(q.reports, c)); };
{
  const s = shiftsFor(L.regular), ev = cohort.regular.events;
  check('shift: a clear synthetic rise is detected in every complete cycle', s.every(x => x.status === 'shift_detected'), s.map(x => x.status).join(','));
  check('shift: the reported night is within 2 nights of the synthetic rise night', s.every((x, i) => Math.abs((Date.parse(x.shiftNight) - Date.parse(addDays(ev[i].eventNight, 1))) / 864e5) <= 2));
  check('shift: output is experimental, has reasons, uncalibrated uncertainty, versions, hashes and passes the policy', s.every(x => x.experimental && x.reasons.length && x.uncertainty.calibrated === false && x.algorithmVersion && /^[0-9a-f]{64}$/.test(x.inputHash)) && !!P.apply({ s }));
  check('shift: no ovulation date is produced', s.every(x => !JSON.stringify(x).match(/ovulationDate|ovulation_date/)) && s.every(x => /does not confirm or date ovulation/.test(x.note)));
  const f = shiftsFor(L.flat);
  check('shift: a flat signal gives "No clear temperature shift detected…" (never "did not ovulate")', f.every(x => x.status === 'no_clear_shift' && x.text === P.NO_SHIFT_TEXT), f.map(x => x.status).join(','));
  const n = shiftsFor(L.noisy), g = shiftsFor(L.gradual);
  check('shift: very noisy signal — results recorded, all policy-clean (behaviour reported in the evaluation, not asserted as accuracy)', n.length > 0 && !!P.apply({ n }));
  check('shift: a small gradual rise below the configured minimum is not reported as a shift', g.every(x => x.status !== 'shift_detected'), g.map(x => x.status).join(','));
}
{
  const p = participant({ ref: 'P-ILL-0001', seed: 31, rise: 0, samplesPerNight: 48, intervalMin: 10, cycleLengths: [30], illness: Object.fromEntries(['2026-01-14', '2026-01-15', '2026-01-16', '2026-01-17'].map(d => [d, { delta: 0.8, flag: 'fever' }])) });
  const l = load(p), eff = effectiveAnnotations(l.annotations), q = nightlyReports(l.observations, eff), c = segment(eff).cycles[0];
  const s = sustainedShift(q.reports, c);
  check('shift: a fever-associated elevation that was annotated is excluded, so no shift is reported', s.status !== 'shift_detected' && s.evidence.excludedNights.filter(e => e.reason === 'confounder_annotated').length === 4, s.status);
  const unflagged = load(participant({ ref: 'P-ILL-0002', seed: 31, rise: 0, samplesPerNight: 48, intervalMin: 10, cycleLengths: [30], illness: {} }));
  unflagged.observations.forEach(o => { const night = o.sleepSessionId.slice(-10); if (night >= '2026-01-14' && night <= '2026-01-17') o.valueC += 0.8; });
  const qu = nightlyReports(unflagged.observations, effectiveAnnotations(unflagged.annotations)), su = sustainedShift(qu.reports, segment(effectiveAnnotations(unflagged.annotations)).cycles[0]);
  check('shift: an UNannotated transient spike (4 nights) is not sustained to the next period, but the rule can still fire — documented limitation', ['shift_detected', 'no_clear_shift'].includes(su.status));
}
{
  const p = participant({ ref: 'P-DEVS-0001', seed: 41, samplesPerNight: 48, intervalMin: 10, cycleLengths: [30, 30], deviceChangeOn: '2026-01-15', deviceBias: 0.6, rise: 0 });
  const l = load(p), eff = effectiveAnnotations(l.annotations), q = nightlyReports(l.observations, eff), c = segment(eff).cycles[0];
  const s = sustainedShift(q.reports, c);
  check('shift: a device change with a level offset is NOT reported as a shift (segments analysed separately)', s.status !== 'shift_detected' && s.segments.length === 2, `${s.status} ${JSON.stringify(s.segments)}`);
  check('shift: the device-change cycle is marked in the output', s.segments.length === 2 && (s.reasons.includes('device_change_within_cycle') || s.segments.some(x => x.reasons.includes('device_change_within_cycle'))));
}
{
  const p = participant({ ref: 'P-SPARSE-0001', seed: 51, samplesPerNight: 48, intervalMin: 10, cycleLengths: [30], missingNights: new Set(Array.from({ length: 22 }, (_, i) => addDays('2026-01-07', i))) });
  const l = load(p), eff = effectiveAnnotations(l.annotations), s = sustainedShift(nightlyReports(l.observations, eff).reports, segment(eff).cycles[0]);
  check('shift: sparse nights → insufficient_data with explanation codes, not a reassuring answer', s.status === 'insufficient_data' && s.reasons.length > 0, `${s.status} ${s.reasons}`);
  const none = sustainedShift([], { start: '2026-01-01', nextStart: '2026-01-30', complete: true });
  check('shift: no data at all → insufficient_data', none.status === 'insufficient_data' && none.reasons.includes('no_nightly_data_in_cycle'));
}
{
  // Reproducibility: identical inputs → identical outputs and hashes.
  const a = shiftsFor(L.regular), b = shiftsFor(load(cohort.regular));
  check('reproducibility: same inputs give identical results and input hashes', JSON.stringify(a) === JSON.stringify(b));
  const t = descriptiveTrend(nightlyReports(L.regular.observations).reports, segment(effectiveAnnotations(L.regular.annotations)).cycles[0]);
  check('trend: descriptive layer relative to own first nights, separate from estimates', t[0].layer === 'descriptive' && t[0].status === 'ok' && t[0].nights.length > 20);
}

/* ---- Forecast ---- */
{
  const cyc = n => segment(effectiveAnnotations(load(participant({ ref: 'P-FC-0001', seed: 61, samplesPerNight: 1, cycleLengths: Array(n).fill(30) })).annotations)).cycles;
  const few = nextPeriodForecast(cyc(2), { asOfDate: '2026-03-10' });
  check('forecast: too little history → insufficient_data with codes', few.status === 'insufficient_data' && few.reasons.includes('too_few_usable_cycles'));
  const c6 = cyc(6), f = nextPeriodForecast(c6, { asOfDate: addDays(c6.at(-1).start, 3) });
  check('forecast: with enough history, a point and an EMPIRICAL range marked uncalibrated', f.status === 'estimate' && f.uncertainty.calibrated === false && f.uncertainty.rangeStart <= f.pointDate && !!P.apply({ f }));
  const irregular = segment(effectiveAnnotations(load(participant({ ref: 'P-IRR-0001', seed: 62, samplesPerNight: 1, cycleLengths: [26, 41, 33, 52, 29, 38] })).annotations)).cycles;
  const fi = nextPeriodForecast(irregular, { asOfDate: addDays(irregular.at(-1).start, 2) });
  check('forecast: irregular, long cycles → a wide range flagged as varying widely', fi.status === 'estimate' && fi.reasons.includes('cycle_lengths_vary_widely') && fi.uncertainty.rangeEnd > fi.uncertainty.rangeStart);
  const stale = nextPeriodForecast(c6, { asOfDate: addDays(c6.at(-1).start, 120) });
  check('forecast: no recent period logged → insufficient_data (not a confident date)', stale.status === 'insufficient_data');
}
{
  // Leakage: the forecast evaluated at 5 Feb must not change when later periods are added to the data.
  const p = participant({ ref: 'P-LEAK-0001', seed: 71, samplesPerNight: 1, cycleLengths: [30, 29, 31, 30, 28, 30, 31] }), l = load(p);
  const asOf = Date.parse(`${addDays(p.starts[5], 1)}T12:00:00Z`), asOfDate = addDays(p.starts[5], 1);
  const early = nextPeriodForecast(segment(effectiveAnnotations(l.annotations.filter(a => a.recordedAt < asOf), { asOf })).cycles, { asOfDate });
  const full = nextPeriodForecast(segment(effectiveAnnotations(l.annotations, { asOf })).cycles, { asOfDate });
  check('leakage: a forecast made at time T is identical whether or not later entries exist', JSON.stringify(early) === JSON.stringify(full) && early.status === 'estimate');
  const ev = evaluateForecast([l]);
  check('leakage: the evaluation harness finds no future information in any forecast', ev.leakageViolations === 0 && ev.denominator === 7);
  const pipeA = analyse({ ...l, asOf, features: { experimental_forecast: true } }), pipeB = analyse({ ...l, observations: l.observations, asOf, features: { experimental_forecast: true } });
  check('pipeline: as-of analysis is reproducible and hides later data', JSON.stringify(pipeA) === JSON.stringify(pipeB) && pipeA.observed.cycles.every(c => c.start <= asOfDate));
  const off = analyse({ ...l, asOf });
  check('pipeline: experimental layers are off unless a researcher enables them', off.estimates.status === 'disabled' && off.forecasts.status === 'disabled');
  check('pipeline: the whole analysis passes the output policy', !!P.apply(analyse({ ...L.regular, features: { experimental_shift: true, experimental_forecast: true } })));
}
{
  const e = evaluateShift([{ ...L.regular }, { ...L.flat, flat: true }]);
  check('evaluation: shift report separates cycles with/without events, abstentions and false detections, with denominators', e.cyclesWithEvent === 7 && e.cyclesWithoutEvent === 7 && e.falseDetections === 0 && e.endpoint && e.reference.includes('not ovulation'));
}
done();
