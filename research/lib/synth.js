// Seeded SYNTHETIC data generator. Everything it produces is invented, tagged `synthetic`, and reproducible from its
// seed and parameters. The shapes (a rise after a defined "synthetic event night", noise, spikes, gaps) are chosen to
// exercise the code paths; they are not a physiological model, and results on this data say nothing about accuracy.
export const SYNTH_VERSION = 'synth-1.0.0';

export function rng(seed) { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; }
export const gauss = r => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const pad = n => String(n).padStart(2, '0');
export const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const iso = ms => new Date(ms).toISOString().replace('.000Z', 'Z');

/**
 * A participant with `cycleLengths` cycles starting at `start`. In each complete cycle a synthetic event night is
 * placed `lutealNights` before the next start; from the night after it, the wrist stream is raised by `rise` °C.
 * Options: missingNights (Set of night labels), illness ({night: +°C}), deviceChangeOn (night label: new serial with
 * `deviceBias`), tzChanges ([{from: night, offset}]), samplesPerNight, intervalMin, noise.
 */
export function participant({ ref, seed = 1, start = '2026-01-05', cycleLengths = [29, 30, 28, 31, 29, 30, 29], lutealNights = 12, rise = 0.35, base = 33.8, noise = 0.08,
  nightlyNoise = 0.06, intervalMin = 5, startLocal = '23:00', samplesPerNight = 96, offset = 0, tzChanges = [], missingNights = new Set(), illness = {}, deviceChangeOn = null, deviceBias = 0.3,
  periodDays = 5, recordedLagHours = 10 } = {}) {
  const r = rng(seed), starts = [start];
  for (const L of cycleLengths) starts.push(addDays(starts.at(-1), L));
  const events = []; // synthetic ground truth (never exported to the platform as an annotation)
  for (let k = 0; k + 1 < starts.length; k++) events.push({ cycleStart: starts[k], eventNight: addDays(starts[k + 1], -lutealNights - 1) });
  const raisedFrom = new Map(events.map(e => [e.cycleStart, addDays(e.eventNight, 1)]));
  const end = starts.at(-1), obs = [], ann = [];
  let entry = 0;
  for (const st of starts) {
    for (let d = 0; d < periodDays; d++) {
      const date = addDays(st, d), type = 'bleeding', value = d === 0 ? 'period_start' : 'period';
      if (date > end) break;
      ann.push({ participant_ref: ref, entry_id: `${ref}-e${++entry}`, type, value, date, recorded_at: iso(Date.parse(`${date}T00:00:00Z`) + recordedLagHours * 36e5), corrects: '' });
    }
  }
  for (const [n, v] of Object.entries(illness)) ann.push({ participant_ref: ref, entry_id: `${ref}-e${++entry}`, type: v.flag || 'illness', value: 'yes', date: n, recorded_at: iso(Date.parse(`${n}T12:00:00Z`)), corrects: '' });
  const [sh, sm] = startLocal.split(':').map(Number);
  let cycleIdx = 0;
  for (let night = start; night < end; night = addDays(night, 1)) {
    while (cycleIdx + 1 < starts.length && night >= starts[cycleIdx + 1]) cycleIdx++;
    if (missingNights.has(night)) continue;
    const off = [...tzChanges].filter(t => night >= t.from).at(-1)?.offset ?? offset;
    const newDev = deviceChangeOn && night >= deviceChangeOn;
    const raised = raisedFrom.get(starts[cycleIdx]) && night >= raisedFrom.get(starts[cycleIdx]);
    const level = base + (raised ? rise : 0) + (newDev ? deviceBias : 0) + (illness[night]?.delta || 0) + nightlyNoise * gauss(r);
    const t0 = Date.parse(`${night}T${pad(sh)}:${pad(sm)}:00Z`) - off * 60e3; // local start time → UTC
    for (let i = 0; i < samplesPerNight; i++) {
      const ts = t0 + i * intervalMin * 60e3;
      obs.push({ participant_ref: ref, timestamp_utc: iso(ts), end_timestamp_utc: iso(ts + intervalMin * 60e3), utc_offset_minutes: off, tz_name: '',
        device_manufacturer: 'SyntheticCo', device_model: newDev ? 'SYN-2' : 'SYN-1', device_serial_pseudonym: newDev ? `${ref}-dev2` : `${ref}-dev1`, firmware: newDev ? '2.0.0' : '1.4.2',
        sampling_interval_s: intervalMin * 60, sampling_config: 'synthetic', sensor_site: 'wrist', measurement_kind: 'skin_temperature', derivation: 'raw', aggregation: 'sample',
        night_label: '', value: (level + noise * gauss(r)).toFixed(2), unit: 'C', precision: '0.01', source_quality_flags: '', sleep_session_id: `${ref}-${night}` });
    }
  }
  return { ref, starts, events, observations: obs, annotations: ann, provenance: { synthetic: true, generator: SYNTH_VERSION, seed, params: { start, cycleLengths, lutealNights, rise, base, noise, nightlyNoise, intervalMin, samplesPerNight, offset, deviceChangeOn, deviceBias } } };
}

export const OBS_COLUMNS = ['participant_ref', 'timestamp_utc', 'end_timestamp_utc', 'utc_offset_minutes', 'tz_name', 'device_manufacturer', 'device_model', 'device_serial_pseudonym', 'firmware', 'sampling_interval_s', 'sampling_config', 'sensor_site', 'measurement_kind', 'derivation', 'aggregation', 'night_label', 'value', 'unit', 'precision', 'source_quality_flags', 'sleep_session_id'];
export const ANN_COLUMNS = ['participant_ref', 'entry_id', 'type', 'value', 'date', 'recorded_at', 'corrects'];
