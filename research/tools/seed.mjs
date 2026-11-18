// Seeds a store with three SYNTHETIC participants through the normal ingestion path (preview → commit).
// A: regular cycles with a clear synthetic rise. B: long, irregular cycles, sparse nights and an annotated fever.
// C: a device replacement and travel to UTC+9, with no synthetic rise (flat signal).
import { participant, OBS_COLUMNS, ANN_COLUMNS, addDays } from '../lib/synth.js';
import { preview, annotationHash } from '../lib/ingest.js';

const csv = (cols, rows) => [cols.join(','), ...rows.map(r => cols.map(c => String(r[c] ?? '')).join(','))].join('\n');
export const DEMO_PEOPLE = () => [
  participant({ ref: 'P-DEMO-A', seed: 101, rise: 0.45, samplesPerNight: 24, intervalMin: 20, cycleLengths: [29, 30, 28, 31, 29, 30] }),
  participant({ ref: 'P-DEMO-B', seed: 102, rise: 0.35, samplesPerNight: 24, intervalMin: 20, cycleLengths: [35, 42, 31, 50, 38], missingNights: new Set(Array.from({ length: 60 }, (_, i) => addDays('2026-01-05', i * 3 + 1))),
    illness: Object.fromEntries(['2026-03-20', '2026-03-21', '2026-03-22'].map(d => [d, { delta: 0.7, flag: 'fever' }])) }),
  participant({ ref: 'P-DEMO-C', seed: 103, rise: 0, samplesPerNight: 24, intervalMin: 20, cycleLengths: [30, 29, 31, 30], deviceChangeOn: '2026-02-20', deviceBias: 0.25, tzChanges: [{ from: '2026-03-15', offset: 540 }, { from: '2026-03-25', offset: 0 }] }),
];

export function seedDemo(store, { researcherId, features = {} } = {}) {
  const people = DEMO_PEOPLE();
  for (const p of people) {
    const pid = store.createParticipant({ ref: p.ref, adultConfirmed: true }, researcherId);
    store.setConsent(pid, 'core_research', true, researcherId);
    for (const [recordType, cols, rows] of [['observations', OBS_COLUMNS, p.observations], ['annotations', ANN_COLUMNS, p.annotations]]) {
      const pv = preview(csv(cols, rows), { format: 'csv', recordType, participantRef: p.ref, filename: `demo-${recordType}.csv`, existing: store.existingFor(pid), consents: store.consents(pid) });
      if (!pv.ok) throw new Error(`seed failed: ${pv.error}`);
      store.commitImport(pid, pv, researcherId, annotationHash);
    }
    for (const [k, v] of Object.entries(features)) store.setFeature(pid, k, v, researcherId);
  }
  return people;
}
