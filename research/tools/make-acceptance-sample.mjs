// Writes a SYNTHETIC example input set for the supplier acceptance test to research/fixtures/acceptance-synthetic/,
// so the tool can be tried before any real device data exists. Deterministic (fixed seeds). Not a real device.
//   node research/tools/make-acceptance-sample.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { participant, OBS_COLUMNS, addDays } from '../lib/synth.js';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'acceptance-synthetic');
mkdirSync(OUT, { recursive: true });
const csv = rows => [OBS_COLUMNS.join(','), ...rows.map(r => OBS_COLUMNS.map(c => String(r[c] ?? '')).join(','))].join('\n') + '\n';
const START = '2026-02-02', iso = ms => new Date(ms).toISOString().replace('.000Z', 'Z');
const person = (ref, seed, opts = {}) => participant({ ref, seed, start: START, cycleLengths: [12], samplesPerNight: 96, intervalMin: 5, ...opts }).observations;
const OFF_FROM = `${addDays(START, 4)}T00:00:00Z`, OFF_TO = `${addDays(START, 4)}T01:00:00Z`, inOff = r => r.timestamp_utc >= OFF_FROM && r.timestamp_utc < OFF_TO;
const a = person('P-SAMPLE-A', 1, { tzChanges: [{ from: addDays(START, 6), offset: 540 }] });
const b = person('P-SAMPLE-B', 2).map(r => (r.timestamp_utc >= `${addDays(START, 5)}T12:00:00Z` ? { ...r, firmware: '1.5.0' } : r));
const c = person('P-SAMPLE-C', 3).map(r => (inOff(r) ? { ...r, source_quality_flags: 'off_body' } : r));
const files = {
  'P-SAMPLE-A.csv': csv(a), 'P-SAMPLE-B.csv': csv(b), 'P-SAMPLE-C.csv': csv(c), 'P-SAMPLE-C-resync.csv': csv(c.slice(-300)),
  'clock.csv': ['participant_ref,device_serial_pseudonym,device_time_utc,reference_time_utc', ...['A', 'B', 'C'].map(x => `P-SAMPLE-${x},P-SAMPLE-${x}-dev1,${iso(Date.parse('2026-02-03T08:00:30Z'))},2026-02-03T08:00:00Z`)].join('\n') + '\n',
  'wear.csv': `participant_ref,removed_at_utc,put_on_at_utc\nP-SAMPLE-C,${OFF_FROM},${OFF_TO}\n`,
  'bench.csv': ['device_serial_pseudonym,timestamp_utc,reference_c', ...c.filter(r => !inOff(r)).slice(0, 12).map(r => `${r.device_serial_pseudonym},${iso(Date.parse(r.timestamp_utc) + 60e3)},${(Number(r.value) + 0.1).toFixed(2)}`)].join('\n') + '\n',
  'profile.json': JSON.stringify({
    synthetic: true, device: { manufacturer: 'SyntheticCo', model: 'SYN-1', name: 'Synthetic test device (not a real product)' },
    documentedFlags: ['off_body'], offWristFlags: ['off_body'],
    expect: { firmwareChange: { ref: 'P-SAMPLE-B', night: addDays(START, 5) }, timeZoneChange: { ref: 'P-SAMPLE-A', night: addDays(START, 6), offsetMin: 540 } },
    answers: { sdk_licence: { answer: 'Example only: replace with the supplier\'s written answer.', source: 'none (synthetic example)' } },
  }, null, 2) + '\n',
};
for (const [n, t] of Object.entries(files)) writeFileSync(join(OUT, n), t);
console.log(`Wrote ${Object.keys(files).length} synthetic files to ${OUT}`);
