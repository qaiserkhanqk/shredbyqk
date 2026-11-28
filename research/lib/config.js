// Versioned processing configuration. EVERY number here is an ENGINEERING ASSUMPTION REQUIRING VALIDATION, chosen to
// make the prototype behave sensibly on synthetic data. None is a clinically accepted cutoff, and none was taken from
// a competitor. Values are kept per measurement kind: oral basal temperature settings are never applied to wrist or
// finger skin temperature. Changing any value requires a new `version`, and every derived result records the version
// and a hash of the configuration it used.
import { hashJSON } from './hash.js';

export const CONFIG = Object.freeze({
  version: 'research-config-0.2.0',
  status: 'unvalidated_engineering_assumptions',
  limits: {
    maxUploadBytes: 5 * 1024 * 1024, maxRows: 200_000, maxColumns: 40, maxCellChars: 512, // shared by CSV and JSON input
    // Longest sampling interval (and longest single measurement interval) accepted, in seconds. Justification: nightly
    // coverage is judged against a 90-minute maximum gap, so an interval above one hour cannot describe within-night
    // coverage; longer values are quarantined, not stretched across the night.
    maxSamplingIntervalS: 3600,
  },
  // Format / sanity bounds in °C, per measurement kind. Outside → quarantined (kept, not deleted). Not physiology.
  bounds: {
    skin_temperature: { min: 20, max: 42 },
    basal_body_temperature: { min: 33, max: 40 },
    ambient_temperature: { min: -40, max: 60 },
  },
  night: {
    // Used only when the source gives no sleep-session ID. Local clock time, inclusive start, exclusive end.
    fallbackWindow: { start: '21:00', end: '09:00' },
    labelShiftHours: 12, // a night is labelled by the local date of (local time − 12 h), so 23:00 and 02:00 share a label
    // A sample more than this many hours from its sleep session's median time is treated as a timing outlier: it is not
    // used to label the session and is not placed (reported as session_timing_outlier). Assumes a main sleep session
    // spans well under a day.
    sessionTimingToleranceHours: 18,
    // When a timestamp-free vendor nightly value counts as known (analysis cutoff and import check).
    vendorNightCompleteRule: 'A vendor night labelled D is treated as complete at 12:00 local time on D+1. With no UTC offset on the record, the latest civil time zone (UTC-12:00) is assumed, so the night becomes usable at D+2 00:00 UTC. This never makes a night usable before it could have ended anywhere.',
    vendorNightCompleteLocalHour: 12,
    vendorDefaultOffsetMin: -720,
  },
  quality: {
    skin_temperature: { minValidSamples: 6, minCoverageMinutes: 180, maxGapMinutes: 90, jumpPerMinute: 0.05, outlierMadK: 5, outlierMinScale: 0.05 },
    basal_body_temperature: { minValidSamples: 1, minCoverageMinutes: 0, maxGapMinutes: null, jumpPerMinute: null, outlierMadK: null },
    ambient_temperature: { minValidSamples: 6, minCoverageMinutes: 180, maxGapMinutes: 90, jumpPerMinute: 0.2, outlierMadK: 5, outlierMinScale: 0.1 },
    // Only flags the source documents. Anything else is kept verbatim and not interpreted.
    exclusionFlags: ['off_body', 'no_contact', 'sensor_error'],
  },
  segmentation: { bleedingRunGapDays: 5, plausibleCycleDays: { min: 15, max: 90 } },
  trend: { baselineNights: 6, rollingNights: 3 },
  shift: {
    // Experimental sustained-shift rule, per kind. `minDelta` is in °C relative to the person's own preceding nights.
    // maxJoinGapNights: largest calendar gap (missing nights) allowed between the last baseline night and the candidate;
    // the same tolerance as inside the confirmation window (maxGapNights), so no new number is introduced.
    // maxBaselineSpanNights: the baseline nights must lie within this many calendar nights (6 nights plus up to 6 missing).
    // Beyond either limit the rule abstains (gap_between_baseline_and_candidate / baseline_too_spread) instead of
    // comparing nights weeks apart.
    skin_temperature: { baselineNights: 6, minBaselineNights: 5, sustainNights: 3, minDelta: 0.25, madK: 2.5, maxGapNights: 2, maxJoinGapNights: 2, maxBaselineSpanNights: 12 },
    basal_body_temperature: { baselineNights: 6, minBaselineNights: 5, sustainNights: 3, minDelta: 0.2, madK: 2.5, maxGapNights: 2, maxJoinGapNights: 2, maxBaselineSpanNights: 12 },
  },
  forecast: { minCycles: 4, maxCycles: 12, intervalMethod: 'min_max_of_recent_cycles' },
});

export const configHash = (c = CONFIG) => hashJSON(c);
