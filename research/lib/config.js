// Versioned processing configuration. EVERY number here is an ENGINEERING ASSUMPTION REQUIRING VALIDATION, chosen to
// make the prototype behave sensibly on synthetic data. None is a clinically accepted cutoff, and none was taken from
// a competitor. Values are kept per measurement kind: oral basal temperature settings are never applied to wrist or
// finger skin temperature. Changing any value requires a new `version`, and every derived result records the version
// and a hash of the configuration it used.
import { hashJSON } from './hash.js';

export const CONFIG = Object.freeze({
  version: 'research-config-0.1.0',
  status: 'unvalidated_engineering_assumptions',
  limits: { maxUploadBytes: 5 * 1024 * 1024, maxRows: 200_000, maxColumns: 40, maxCellChars: 512 },
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
    skin_temperature: { baselineNights: 6, minBaselineNights: 5, sustainNights: 3, minDelta: 0.25, madK: 2.5, maxGapNights: 2 },
    basal_body_temperature: { baselineNights: 6, minBaselineNights: 5, sustainNights: 3, minDelta: 0.2, madK: 2.5, maxGapNights: 2 },
  },
  forecast: { minCycles: 4, maxCycles: 12, intervalMethod: 'min_max_of_recent_cycles' },
});

export const configHash = (c = CONFIG) => hashJSON(c);
