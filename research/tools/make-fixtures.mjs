// Writes the small SYNTHETIC ingestion fixtures and their provenance manifest. Deterministic: running it again
// produces byte-identical files (the test suite checks this). Run: node research/tools/make-fixtures.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { participant, OBS_COLUMNS, ANN_COLUMNS, SYNTH_VERSION } from '../lib/synth.js';
import { sha256 } from '../lib/hash.js';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const csv = (cols, rows) => [cols.join(','), ...rows.map(r => cols.map(c => { const v = r[c] ?? ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(','))].join('\n') + '\n';

export function buildFixtures() {
  const files = {};
  const a = participant({ ref: 'P-SYN-0001', seed: 11, cycleLengths: [29], samplesPerNight: 48, intervalMin: 10 });
  const threeNights = a.observations.filter(o => o.sleep_session_id.endsWith('2026-01-05') || o.sleep_session_id.endsWith('2026-01-06') || o.sleep_session_id.endsWith('2026-01-07'));
  files['overnight-samples.csv'] = { purpose: 'Individual timestamped overnight wrist-skin samples, 3 nights, 10-minute interval', text: csv(OBS_COLUMNS, threeNights) };
  files['vendor-nightly.json'] = { purpose: 'One vendor-derived nightly value (not raw samples)', text: JSON.stringify({ records: [{ participant_ref: 'P-SYN-0001', device_manufacturer: 'SyntheticCo', device_model: 'SYN-1', device_serial_pseudonym: 'P-SYN-0001-dev1', firmware: '1.4.2', sensor_site: 'wrist', measurement_kind: 'skin_temperature', derivation: 'vendor_derived', aggregation: 'nightly_value', night_label: '2026-01-08', value: 33.91, unit: 'C', precision: 0.01, source_quality_flags: '' }] }, null, 2) + '\n' };
  const ok = threeNights[0];
  files['missing-timestamps-units.csv'] = { purpose: 'Rows with a missing timestamp, a missing unit, an unrecognised unit and an invalid UTC offset, plus one valid row', text: csv(OBS_COLUMNS, [
    ok, { ...ok, timestamp_utc: '', end_timestamp_utc: '' }, { ...threeNights[1], unit: '' }, { ...threeNights[2], unit: 'kelvinish' }, { ...threeNights[3], utc_offset_minutes: '7' }]) };
  files['mixed-units.csv'] = { purpose: 'The same night reported partly in °C and partly in °F', text: csv(OBS_COLUMNS, threeNights.slice(0, 48).map((o, i) => (i % 2 ? { ...o, value: (Number(o.value) * 9 / 5 + 32).toFixed(3), unit: 'F', precision: '0.018' } : o))) };
  files['overlap-conflict.csv'] = { purpose: 'Re-upload overlap: one exact duplicate of overnight-samples.csv and one row with the same timestamp but a different value', text: csv(OBS_COLUMNS, [threeNights[0], { ...threeNights[1], value: (Number(threeNights[1].value) + 0.5).toFixed(2) }]) };
  const b = participant({ ref: 'P-SYN-0002', seed: 12, cycleLengths: [8], samplesPerNight: 48, intervalMin: 10, deviceChangeOn: '2026-01-09', tzChanges: [{ from: '2026-01-11', offset: 540 }] });
  files['device-tz-change.csv'] = { purpose: 'Device replacement (new serial, model and firmware from 2026-01-09) and a time-zone change to UTC+09:00 from 2026-01-11', text: csv(OBS_COLUMNS, b.observations) };
  files['annotations-with-correction.csv'] = { purpose: 'Bleeding entries with a later correction and a retraction; an illness flag', text: csv(ANN_COLUMNS, [
    { participant_ref: 'P-SYN-0001', entry_id: 'P-SYN-0001-a1', type: 'bleeding', value: 'period_start', date: '2026-01-05', recorded_at: '2026-01-05T09:00:00Z' },
    { participant_ref: 'P-SYN-0001', entry_id: 'P-SYN-0001-a2', type: 'bleeding', value: 'period_start', date: '2026-02-04', recorded_at: '2026-02-04T09:00:00Z' },
    { participant_ref: 'P-SYN-0001', entry_id: 'P-SYN-0001-a3', type: 'bleeding', value: 'period_start', date: '2026-02-03', recorded_at: '2026-02-06T09:00:00Z', corrects: 'P-SYN-0001-a2' },
    { participant_ref: 'P-SYN-0001', entry_id: 'P-SYN-0001-a4', type: 'bleeding', value: 'spotting', date: '2026-01-20', recorded_at: '2026-01-20T09:00:00Z' },
    { participant_ref: 'P-SYN-0001', entry_id: 'P-SYN-0001-a5', type: 'bleeding', value: 'retracted', date: '2026-01-20', recorded_at: '2026-01-21T09:00:00Z', corrects: 'P-SYN-0001-a4' },
    { participant_ref: 'P-SYN-0001', entry_id: 'P-SYN-0001-a6', type: 'illness', value: 'yes', date: '2026-01-12', recorded_at: '2026-01-13T09:00:00Z' }]) };
  files['corrupted.csv'] = { purpose: 'A broken file: an unterminated quote', text: 'participant_ref,value\nP-SYN-0001,"33.9\n' };
  return files;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync(OUT, { recursive: true });
  const files = buildFixtures(), manifest = { synthetic: true, generator: SYNTH_VERSION, builder: 'research/tools/make-fixtures.mjs', note: 'Invented data for testing code behaviour only. Not real people, not real devices, not evidence of accuracy.', files: {} };
  for (const [name, f] of Object.entries(files)) { writeFileSync(join(OUT, name), f.text); manifest.files[name] = { sha256: sha256(f.text), purpose: f.purpose }; }
  writeFileSync(join(OUT, 'MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`wrote ${Object.keys(files).length} fixtures to research/fixtures`);
}
