// Unit tests: output policy, units, CSV safety, ingestion, fixtures provenance. Synthetic data only.
// These prove code behaviour, not accuracy. Run: node research/tests/ingest.test.mjs
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as P from '../lib/policy.js';
import { parseUnit, normalise } from '../lib/units.js';
import { parseCSV, safeCell, toCSV } from '../lib/csv.js';
import { preview, validOffset } from '../lib/ingest.js';
import { buildFixtures } from '../tools/make-fixtures.mjs';
import { sha256 } from '../lib/hash.js';
import { check, done, throwsCode } from './harness.mjs';

const FX = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const fx = n => readFileSync(join(FX, n), 'utf8');
const obsPreview = (name, o = {}) => preview(fx(name), { format: name.endsWith('.json') ? 'json' : 'csv', recordType: 'observations', participantRef: 'P-SYN-0001', filename: name, ...o });

/* ---- Output policy ---- */
check('policy: label is attached to every payload', P.apply({ a: 1 }).label === P.LABEL && P.apply([1]).label === P.LABEL);
for (const bad of ['Today is a safe day', 'You are infertile now', 'You are protected', 'green day', 'This is not a safe day', 'unprotected sex is fine today', 'You did not ovulate', 'anovulatory cycle', 'You ovulated on 3 May', 'possible PCOS', 'progesterone level estimate', 'no need for contraception'])
  check(`policy: refuses "${bad}"`, throwsCode(() => P.apply({ text: bad }), 'policy:') !== null);
check('policy: the sanctioned no-shift sentence passes', !throwsCode(() => P.apply({ text: P.NO_SHIFT_TEXT })));
check('policy: a forbidden word in a key is caught too', !!throwsCode(() => P.apply({ safeDays: [] })) || !!throwsCode(() => P.apply({ 'safe day': 1 })));
check('policy: an estimate without experimental marking is refused', P.apply.length >= 0 && throwsCode(() => P.apply({ x: { layer: 'estimate', status: 'detected', reasons: ['r'], uncertainty: { calibrated: false } } }))?.code === 'experimental_unmarked');
check('policy: an estimate without reasons is refused', throwsCode(() => P.apply({ x: { layer: 'estimate', experimental: true, status: 'detected', uncertainty: { calibrated: false } } }))?.code === 'reasons_missing');
check('policy: an estimate without uncertainty is refused', throwsCode(() => P.apply({ x: { layer: 'forecast', experimental: true, status: 'estimate', reasons: ['r'] } }))?.code === 'uncertainty_missing');
check('policy: an uncalibrated interval described as a probability is refused', throwsCode(() => P.apply({ x: { layer: 'forecast', experimental: true, status: 'estimate', reasons: ['r'], uncertainty: { calibrated: false, note: '90% chance' } } }))?.code === 'calibration_claim');
check('policy: "calibrated: true" without evidence is refused', throwsCode(() => P.apply({ x: { layer: 'forecast', experimental: true, status: 'estimate', reasons: ['r'], uncertainty: { calibrated: true } } }))?.code === 'calibration_unevidenced');
check('policy: an ovulation date field is refused', throwsCode(() => P.apply({ x: { layer: 'estimate', experimental: true, status: 'detected', reasons: ['r'], uncertainty: { calibrated: false }, ovulationDate: '2026-01-01' } }))?.code === 'ovulation_date_output');
for (const f of ['contraception', 'Contraceptive-Mode', 'fertile_window', 'safeDays', 'safe days', 'conception timing', 'pregnancy_detection'])
  check(`policy: feature "${f}" cannot be enabled`, throwsCode(() => P.assertFeatureAllowed(f))?.code === 'prohibited_feature');
check('policy: an ordinary research feature name is allowed', !throwsCode(() => P.assertFeatureAllowed('experimental_shift')));

/* ---- Units ---- */
check('units: C/F spellings recognised; missing or unknown unit is null (never guessed)', parseUnit('°F') === 'degF' && parseUnit('C') === 'degC' && parseUnit('') === null && parseUnit('K') === null);
check('units: 98.6 °F → 37 °C; 0.018 °F precision → 0.01 °C', normalise(98.6, 'degF', 0.018).valueC === 37 && normalise(98.6, 'degF', 0.018).precisionC === 0.01);
check('units: offsets validated as whole minutes, multiples of 15, UTC−12…+14', validOffset(345) && validOffset(-720) && validOffset(840) && !validOffset(7) && !validOffset(841) && !validOffset(NaN) && !validOffset(60.5));

/* ---- CSV safety ---- */
check('csv: quoted commas, quotes and newlines parse', parseCSV('a,b\n"x,1","he said ""hi""\nthere"\n')[0].record.b === 'he said "hi"\nthere');
check('csv: unterminated quote, binary content, duplicate headers and oversize input are refused',
  throwsCode(() => parseCSV('a\n"x\n'))?.code === 'unterminated_quote' && throwsCode(() => parseCSV('a\n\u0000'))?.code === 'binary_content' && throwsCode(() => parseCSV('a,a\n1,2'))?.code === 'duplicate_header'
  && throwsCode(() => parseCSV('a\n' + 'x'.repeat(10), { maxUploadBytes: 5, maxRows: 10, maxColumns: 5, maxCellChars: 100 }))?.code === 'too_large');
check('csv: row and column limits enforced', throwsCode(() => parseCSV('a\n1\n2\n3', { maxUploadBytes: 1e6, maxRows: 2, maxColumns: 5, maxCellChars: 100 }))?.code === 'too_many_rows' && throwsCode(() => parseCSV('a,b,c', { maxUploadBytes: 1e6, maxRows: 9, maxColumns: 2, maxCellChars: 100 }))?.code === 'too_many_columns');
for (const evil of ['=HYPERLINK("x")', '+SUM(A1)', '-2+3', '@cmd', '\tx', '|calc'])
  check(`csv export: formula-like cell neutralised (${JSON.stringify(evil)})`, safeCell(evil).replace(/^"/, '').startsWith("'"));
check('csv export: plain negative numbers are left as numbers', safeCell(-0.25) === '-0.25' && safeCell('-12') === '-12');
check('csv export: round trip keeps the text', parseCSV(toCSV(['a'], [{ a: 'x,"y"' }]))[0].record.a === 'x,"y"');

/* ---- Ingestion fixtures ---- */
{
  const p = obsPreview('overnight-samples.csv');
  check('ingest 1: 144 overnight samples accepted, nothing quarantined', p.ok && p.counts.accepted === 144 && p.counts.quarantined === 0 && p.counts.rejected === 0, JSON.stringify(p.counts));
  check('ingest 1: source value and unit preserved alongside °C', p.accepted[0].sourceUnit === 'C' && typeof p.accepted[0].sourceValue === 'number' && p.accepted[0].valueC === p.accepted[0].sourceValue);
  check('ingest 1: nothing is stored by preview; versions and hashes recorded', p.ingestVersion && p.configVersion && /^[0-9a-f]{64}$/.test(p.sourceHash) && /^[0-9a-f]{64}$/.test(p.configHash));
  check('ingest 1: the filename is kept only as a hash and an extension', p.sourceFilenameHash === sha256('overnight-samples.csv') && p.sourceExtension === 'csv' && !JSON.stringify(p).includes('overnight-samples'));
  const again = obsPreview('overnight-samples.csv', { existing: { batchHashes: new Set([p.sourceHash]) } });
  check('ingest 5: uploading the same file again is idempotent (recognised duplicate batch, 0 rows)', again.duplicateBatch === true && again.counts.accepted === 0);
  const existing = { obsRowHash: new Map(p.accepted.map(o => [o.obsKey, o.rowHash])) };
  const ov = obsPreview('overlap-conflict.csv', { existing });
  check('ingest 5: an overlapping row identical to a stored one is a duplicate; a changed value is quarantined as a conflict', ov.counts.duplicates === 1 && ov.quarantined.length === 1 && ov.quarantined[0].reasons.includes('conflicting_duplicate'), JSON.stringify(ov.counts));
  const wrong = obsPreview('overnight-samples.csv', { participantRef: 'P-SYN-9999' });
  check('ingest: rows for another participant are rejected (identity never taken from the file name)', wrong.counts.accepted === 0 && wrong.quarantined.every(q => q.rejected && q.reasons.includes('participant_mismatch')));
}
{
  const p = obsPreview('vendor-nightly.json');
  check('ingest 2: one vendor-derived nightly value accepted as vendor_derived / nightly_value', p.counts.accepted === 1 && p.accepted[0].derivation === 'vendor_derived' && p.accepted[0].aggregation === 'nightly_value');
  const asRaw = preview(fx('vendor-nightly.json').replace('"vendor_derived"', '"raw"'), { format: 'json', recordType: 'observations', participantRef: 'P-SYN-0001' });
  check('ingest 2: a nightly value labelled "raw" is rejected (a vendor average is not raw data)', asRaw.counts.rejected === 1 && asRaw.quarantined[0].reasons.includes('nightly_value_must_be_vendor_derived'));
  const noDeriv = preview(fx('vendor-nightly.json').replace('"derivation": "vendor_derived",', ''), { format: 'json', recordType: 'observations', participantRef: 'P-SYN-0001' });
  check('ingest 2: missing derivation is rejected, never defaulted to raw', noDeriv.quarantined[0]?.reasons.includes('derivation_missing_or_invalid'));
}
{
  const p = obsPreview('missing-timestamps-units.csv');
  const reasons = p.quarantined.flatMap(q => q.reasons);
  check('ingest 3: 1 valid row accepted; 4 suspicious rows quarantined (kept), not dropped', p.counts.accepted === 1 && p.counts.quarantined === 4 && p.quarantined.every(q => q.raw), JSON.stringify(p.counts));
  check('ingest 3: reasons are specific', ['timestamp_missing', 'unit_missing', 'unit_unrecognised', 'utc_offset_invalid'].every(r => reasons.includes(r)), reasons.join(','));
}
{
  const p = obsPreview('mixed-units.csv');
  const c = p.accepted.filter(o => o.sourceUnit === 'C'), f = p.accepted.filter(o => o.sourceUnit === 'F');
  check('ingest 4: mixed °C/°F rows all accepted and normalised to the same scale', p.counts.accepted === 48 && c.length === 24 && f.length === 24);
  const orig = obsPreview('overnight-samples.csv').accepted.slice(0, 48);
  check('ingest 4: °F rows convert back to the original °C values (±0.001)', f.every(o => Math.abs(o.valueC - orig.find(x => x.obsKey === o.obsKey).valueC) <= 0.001));
}
{
  const p = preview(fx('device-tz-change.csv'), { format: 'csv', recordType: 'observations', participantRef: 'P-SYN-0002' });
  check('ingest 6: device replacement and time-zone change rows accepted with their own device and offset', p.counts.accepted === 8 * 48 && new Set(p.accepted.map(o => o.device.serial)).size === 2 && new Set(p.accepted.map(o => o.offsetMin)).size === 2);
}
{
  const bad = obsPreview('corrupted.csv');
  check('ingest: a corrupted file fails with a clear code and no rows', bad.ok === false && bad.error === 'unterminated_quote');
  const empty = preview('', { format: 'csv', recordType: 'observations', participantRef: 'P-SYN-0001' });
  check('ingest: empty input fails clearly', empty.ok === false && empty.error === 'empty');
  const js = preview('{"records": 5}', { format: 'json', recordType: 'observations', participantRef: 'P-SYN-0001' });
  check('ingest: JSON without a records array fails clearly', js.ok === false && js.error === 'no_records_array');
  const big = preview('x'.repeat(5 * 1024 * 1024 + 1), { format: 'csv', recordType: 'observations', participantRef: 'P-SYN-0001' });
  check('ingest: input over the 5 MB limit is refused before parsing', big.ok === false && big.error === 'too_large');
  const oob = preview(fx('overnight-samples.csv').replace(/,33\.\d\d,C,/, ',55.00,C,'), { format: 'csv', recordType: 'observations', participantRef: 'P-SYN-0001' });
  check('ingest: an out-of-bounds wrist value is quarantined (kept), not deleted', oob.quarantined.some(q => q.reasons.includes('out_of_bounds_for_kind') && q.raw));
  const oral = preview(fx('overnight-samples.csv').replace(/,wrist,skin_temperature,/, ',wrist,basal_body_temperature,'), { format: 'csv', recordType: 'observations', participantRef: 'P-SYN-0001' });
  check('ingest: wrist skin temperature cannot be labelled as oral basal temperature', oral.quarantined.some(q => q.reasons.includes('site_kind_mismatch')));
}
{
  const ann = s => preview(s, { format: 'csv', recordType: 'annotations', participantRef: 'P-SYN-0001' });
  const p = ann(fx('annotations-with-correction.csv'));
  check('annotations: entries, a correction and a retraction accepted', p.counts.accepted === 6, JSON.stringify(p.counts) + JSON.stringify(p.quarantined.map(q => q.reasons)));
  const lh = ann('participant_ref,entry_id,type,value,date,recorded_at,corrects\nP-SYN-0001,P-SYN-0001-x1,lh_test,positive,2026-01-15,2026-01-15T09:00:00Z,\n');
  check('annotations: LH results need their own consent', lh.quarantined[0]?.reasons.includes('lh_tests_not_consented'));
  const horm = ann('participant_ref,entry_id,type,value,date,recorded_at,corrects\nP-SYN-0001,P-SYN-0001-x2,hormonal_medication,yes,2026-01-15,2026-01-15T09:00:00Z,\n');
  check('annotations: hormonal-medication context needs its own specific consent', horm.quarantined[0]?.reasons.includes('hormonal_context_not_consented'));
  const reuse = ann('participant_ref,entry_id,type,value,date,recorded_at,corrects\nP-SYN-0001,P-SYN-0001-a1,bleeding,spotting,2026-01-05,2026-01-05T09:00:00Z,\n');
  const ex = { entryHash: new Map(p.accepted.map(a => [a.entryId, 'h'])) };
  const r2 = preview('participant_ref,entry_id,type,value,date,recorded_at,corrects\nP-SYN-0001,P-SYN-0001-a1,bleeding,spotting,2026-01-05,2026-01-05T09:00:00Z,\n', { format: 'csv', recordType: 'annotations', participantRef: 'P-SYN-0001', existing: ex });
  check('annotations: an entry ID reused with different content is quarantined, not overwritten', reuse.counts.accepted === 1 && r2.quarantined[0]?.reasons.includes('entry_id_reused_with_different_content'));
}

/* ---- Fixture provenance ---- */
{
  const m = JSON.parse(fx('MANIFEST.json')), built = buildFixtures();
  check('fixtures: manifest marks every file synthetic and names the generator', m.synthetic === true && m.generator && Object.keys(m.files).length === Object.keys(built).length);
  check('fixtures: every fixture matches its manifest hash', Object.entries(m.files).every(([n, f]) => sha256(fx(n)) === f.sha256));
  check('fixtures: regenerating from the seeded generator gives byte-identical files', Object.entries(built).every(([n, f]) => f.text === fx(n)));
}
done();
