// Regression tests for the research-prototype findings reported against 21317c5. Written BEFORE the fixes; the failing
// run is committed in research/docs/test-logs/. Browser races are in research/tests/e2e-races.cjs. Synthetic data only.
// These tests check code behaviour. They are not evidence of accuracy. Run: node research/tests/regressions-21317c5.test.mjs
import { createServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../server/store.js';
import { createApp } from '../server/server.js';
import { preview, validateAnnotation, annotationHash } from '../lib/ingest.js';
import { parseCSV, parseJSONRecords } from '../lib/csv.js';
import { parseUnit } from '../lib/units.js';
import { effectiveAnnotations } from '../lib/cycles.js';
import { nightlyReports } from '../lib/quality.js';
import { sustainedShift } from '../lib/inference.js';
import { analyse } from '../lib/pipeline.js';
import { hashJSON } from '../lib/hash.js';
import { CONFIG } from '../lib/config.js';
import { check, done, throwsCode } from './harness.mjs';

const PW = 'synthetic-pass-123', D = s => Date.parse(s);
const addDays = (d, n) => new Date(D(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const OBS_H = 'participant_ref,timestamp_utc,end_timestamp_utc,utc_offset_minutes,tz_name,device_manufacturer,device_model,device_serial_pseudonym,firmware,sampling_interval_s,sampling_config,sensor_site,measurement_kind,derivation,aggregation,night_label,value,unit,precision,source_quality_flags,sleep_session_id';
const ANN_H = 'participant_ref,entry_id,type,value,date,recorded_at,corrects';
const obsRow = (ref, o = {}) => { const d = { participant_ref: ref, timestamp_utc: '2026-02-01T23:00:00Z', end_timestamp_utc: '', utc_offset_minutes: 0, tz_name: '', device_manufacturer: 'SyntheticCo', device_model: 'SYN-1', device_serial_pseudonym: `${ref}-d1`, firmware: '1', sampling_interval_s: 600, sampling_config: '', sensor_site: 'wrist', measurement_kind: 'skin_temperature', derivation: 'raw', aggregation: 'sample', night_label: '', value: '33.80', unit: 'C', precision: '', source_quality_flags: '', sleep_session_id: 'S1', ...o }; return OBS_H.split(',').map(k => d[k]).join(','); };
const obsPreview = (ref, rows, extra = {}) => preview([OBS_H, ...rows].join('\n'), { format: 'csv', recordType: 'observations', participantRef: ref, ...extra });
const accepted = (p, ingestedAt = D('2026-03-01T00:00:00Z')) => p.accepted.map((o, i) => ({ ...o, id: i + 1, seq: i + 1, ingestedAt }));

/* ================= Server for 1b, 1d, 2a, 3f ================= */
let clock = D('2026-03-10T12:00:00Z');
const store = openStore(':memory:', { now: () => clock });
const server = createServer(createApp({ store, settings: { secureCookies: false, idleMs: 1e12, absoluteMs: 1e12 }, log: () => {}, now: () => clock }));
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
async function call(method, path, { body, as } = {}) {
  const h = {}; if (as) { h.cookie = as.cookie; h['x-csrf-token'] = as.csrf; } if (body !== undefined) h['content-type'] = 'application/json';
  const r = await fetch(BASE + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: r.status, text, json };
}
async function login(u) { const r = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: u, password: PW }) }); return { cookie: r.headers.get('set-cookie').split(';')[0], csrf: (await r.json()).csrf }; }
store.createUser({ username: 'admin', password: PW, role: 'admin' }); store.createUser({ username: 'res', password: PW, role: 'researcher' });
const ADM = await login('admin'), R = await login('res');
const pid = ref => store.participantByRef(ref).id;
await call('POST', '/api/participants', { as: R, body: { ref: 'P-Q1-0001', adultConfirmed: true } });
await call('POST', '/api/participants/P-Q1-0001/consents/record-signed', { as: R, body: { scope: 'core_research', signedFormReference: true } });
await call('POST', '/api/users', { as: ADM, body: { username: 'p_q1', password: PW, role: 'participant', participantRef: 'P-Q1-0001' } });
const PP = await login('p_q1');

/* ---------- 1b. Consent and feature toggles require real Booleans ---------- */
for (const [label, body] of [['missing', {}], ['null', { granted: null }], ['"false"', { granted: 'false' }], ['"true"', { granted: 'true' }], ['0', { granted: 0 }], ['1', { granted: 1 }], ['[]', { granted: [] }], ['{}', { granted: {} }]]) {
  for (const [who, as] of [['participant', PP], ['researcher', R]]) {
    const before = JSON.stringify(store.consentLog(pid('P-Q1-0001')));
    const r = await call('POST', '/api/participants/P-Q1-0001/consents', { as, body: { scope: 'lh_tests', ...body } });
    check(`1b consent granted=${label} (${who}) is rejected with 400 and changes nothing`, r.status === 400 && JSON.stringify(store.consentLog(pid('P-Q1-0001'))) === before, `${r.status} ${r.text.slice(0, 80)} lh=${store.consents(pid('P-Q1-0001')).lh_tests}`);
  }
}
{
  const ok1 = await call('POST', '/api/participants/P-Q1-0001/consents', { as: PP, body: { scope: 'lh_tests', granted: true } });
  const ok2 = await call('POST', '/api/participants/P-Q1-0001/consents', { as: PP, body: { scope: 'lh_tests', granted: false } });
  check('1b control: real Booleans still work (participant grants then withdraws)', ok1.status === 200 && ok2.status === 200 && store.consents(pid('P-Q1-0001')).lh_tests === false);
  for (const v of [undefined, null, 'false', 'true', 0, 1, [], {}]) {
    const before = store.features(pid('P-Q1-0001')).experimental_shift;
    const r = await call('POST', '/api/participants/P-Q1-0001/features', { as: R, body: { name: 'experimental_shift', ...(v === undefined ? {} : { enabled: v }) } });
    check(`1b feature enabled=${JSON.stringify(v) ?? 'missing'} is rejected with 400 and changes nothing`, r.status === 400 && store.features(pid('P-Q1-0001')).experimental_shift === before, `${r.status} on=${store.features(pid('P-Q1-0001')).experimental_shift}`);
  }
  const rr = await call('POST', '/api/participants/P-Q1-0001/imports/preview', { as: R, body: { recordType: 'annotations', format: 'csv', content: ANN_H + '\n', reimport: 'true', reason: 'researcher_review' } });
  check('1b a non-Boolean reimport flag is rejected', rr.status === 400);
}

/* ---------- 1d. Participant restrictions still hold (guard) ---------- */
{
  const runs = await call('GET', '/api/participants/P-Q1-0001/runs', { as: PP }), q = await call('GET', '/api/participants/P-Q1-0001/quarantine', { as: PP });
  const imp = await call('POST', '/api/participants/P-Q1-0001/imports/preview', { as: PP, body: { recordType: 'annotations', format: 'csv', content: ANN_H + '\n' } });
  check('1d guard: participants still cannot read runs or quarantine, or import', runs.status === 403 && q.status === 403 && imp.status === 403);
}

/* ---------- 2a. Server binds a preview to its record type and source file ---------- */
{
  const content = [OBS_H, obsRow('P-Q1-0001')].join('\n');
  const pv = await call('POST', '/api/participants/P-Q1-0001/imports/preview', { as: R, body: { recordType: 'observations', format: 'csv', content } });
  check('2a the preview response identifies the previewed file and type (sourceHash, recordType)', /^[0-9a-f]{64}$/.test(pv.json?.sourceHash || '') && pv.json?.recordType === 'observations', JSON.stringify(pv.json).slice(0, 160));
  const wrongType = await call('POST', '/api/participants/P-Q1-0001/imports/commit', { as: R, body: { previewId: pv.json.previewId, recordType: 'annotations', sourceHash: pv.json.sourceHash } });
  const wrongFile = await call('POST', '/api/participants/P-Q1-0001/imports/commit', { as: R, body: { previewId: pv.json.previewId, recordType: 'observations', sourceHash: 'f'.repeat(64) } });
  check('2a a commit naming a different type or file than the preview is refused (409) and stores nothing', wrongType.status === 409 && wrongFile.status === 409 && store.observations(pid('P-Q1-0001')).length === 0, `${wrongType.status} ${wrongFile.status}`);
  const pv2 = await call('POST', '/api/participants/P-Q1-0001/imports/preview', { as: R, body: { recordType: 'observations', format: 'csv', content } });
  const good = await call('POST', '/api/participants/P-Q1-0001/imports/commit', { as: R, body: { previewId: pv2.json.previewId, recordType: 'observations', sourceHash: pv2.json.sourceHash } });
  check('2a control: a commit naming the previewed type and file succeeds', good.status === 200 && store.observations(pid('P-Q1-0001')).length === 1, `${good.status} ${good.text.slice(0, 100)}`);
  const obsId = store.observations(pid('P-Q1-0001'))[0]?.id;
  const ct = await call('POST', '/api/participants/P-Q1-0001/corrections', { as: R, body: { observationId: obsId, action: 'exclude_timing', reason: 'clock_error' } });
  check('4c the API accepts a timing exclusion as its own correction action', ct.status === 200 && store.observations(pid('P-Q1-0001'))[0]?.corrections?.at(-1)?.action === 'exclude_timing', `${ct.status} ${ct.text.slice(0, 100)}`);
}

/* ---------- 3f. Prototype-property names never crash the server ---------- */
{
  const content = [ANN_H, ...['constructor', '__proto__', 'hasOwnProperty', 'valueOf'].map((t, i) => `P-Q1-0001,P-Q1-0001-p${i},${t},yes,2026-01-05,2026-01-05T09:00:00Z,`)].join('\n');
  const r = await call('POST', '/api/participants/P-Q1-0001/imports/preview', { as: R, body: { recordType: 'annotations', format: 'csv', content } });
  check('3f annotation types "constructor", "__proto__", … are rejected as invalid types (no server error)', r.status === 200 && r.json.counts.rejected === 4 && r.json.quarantined.every(q => q.reasons.includes('type_invalid')), `${r.status} ${r.text.slice(0, 160)}`);
  const content2 = [OBS_H, obsRow('P-Q1-0001', { measurement_kind: 'constructor' }), obsRow('P-Q1-0001', { timestamp_utc: '2026-02-01T23:10:00Z', unit: 'constructor' }), obsRow('P-Q1-0001', { timestamp_utc: '2026-02-01T23:20:00Z', unit: '__proto__' })].join('\n');
  const r2 = await call('POST', '/api/participants/P-Q1-0001/imports/preview', { as: R, body: { recordType: 'observations', format: 'csv', content: content2 } });
  check('3f measurement kind or unit named "constructor"/"__proto__" is rejected or quarantined (no server error)', r2.status === 200 && r2.json.quarantined[0]?.reasons.includes('measurement_kind_invalid') && r2.json.quarantined.filter(q => q.reasons.includes('unit_unrecognised')).length === 2, `${r2.status} ${r2.text.slice(0, 200)}`);
}
check('3f parseUnit never returns an inherited object property', ['constructor', '__proto__', 'toString', 'hasOwnProperty'].every(u => parseUnit(u) === null));
server.close();

/* ---------- 1c. Legacy database: optional consent withdrawn BEFORE the upgrade ---------- */
{
  const dir = mkdtempSync(join(tmpdir(), 'rs-legacy-')), db = join(dir, 'v1.sqlite');
  const { openStore: openV1 } = await import('./fixtures/store-v1-f67000b.mjs');
  const old = openV1(db);
  const a = old.createParticipant({ ref: 'P-LEG-0001', adultConfirmed: true }, null), bId = old.createParticipant({ ref: 'P-LEG-0002', adultConfirmed: true }, null);
  for (const p of [a, bId]) for (const s of ['core_research', 'lh_tests', 'hormonal_context']) old.setConsent(p, s, true, null);
  const rows = ref => [ANN_H, `${ref},${ref}-b1,bleeding,period_start,2026-01-05,2026-01-05T09:00:00Z,`, `${ref},${ref}-l1, lh_test ,negative,2026-13-40,2026-01-19T09:00:00Z,`, `${ref},${ref}-h1, hormonal_medication ,yes,2026-13-40,2026-01-19T09:00:00Z,`, `${ref},${ref}-l2,lh_test,positive,2026-01-20,2026-01-20T09:00:00Z,`].join('\n');
  for (const [p, ref] of [[a, 'P-LEG-0001'], [bId, 'P-LEG-0002']]) old.commitImport(p, preview(rows(ref), { format: 'csv', recordType: 'annotations', participantRef: ref, consents: { core_research: true, lh_tests: true, hormonal_context: true } }), null, annotationHash);
  // A preview saved by the old version AFTER the withdrawal: its ingestion did not recognise "LH_TEST", so it kept the cells.
  old.setConsent(a, 'lh_tests', false, null); old.setConsent(a, 'hormonal_context', false, null);
  old.savePreview(a, 1, { recordType: 'annotations', accepted: [], counts: {}, quarantined: [{ line: 2, reasons: ['type_invalid'], rejected: true, raw: { participant_ref: 'P-LEG-0001', entry_id: 'P-LEG-0001-x', type: 'LH_TEST', value: 'positive', date: '2026-01-21' } }] });
  old.savePreview(bId, 1, { recordType: 'annotations', accepted: [], counts: {}, quarantined: [] });
  const legacyLeft = old.db.prepare('SELECT COUNT(*) AS n FROM quarantine WHERE participant_id = ?').get(a).n;
  old.close();
  check('1c setup: the old version left the " lh_test " / " hormonal_medication " quarantine rows after withdrawal', legacyLeft === 2, String(legacyLeft));
  const s = openStore(db);
  const qa = s.db.prepare('SELECT raw_json, canonical_type FROM quarantine WHERE participant_id = ?').all(a);
  check('1c after upgrade: retained raw LH/hormonal rows of the participant who withdrew are removed', !qa.some(r => /lh[\s_-]*test|hormonal[\s_-]*medication/i.test(r.raw_json || '')), JSON.stringify(qa));
  check('1c after upgrade: no LH/hormonal annotation remains for that participant', !s.annotations(a).some(x => ['lh_test', 'hormonal_medication'].includes(x.type)));
  check('1c after upgrade: the affected preview is invalidated', s.db.prepare('SELECT COUNT(*) AS n FROM previews WHERE participant_id = ?').get(a).n === 0);
  check('1c the other participant (consent still given) keeps everything, including an unaffected preview', s.db.prepare('SELECT COUNT(*) AS n FROM quarantine WHERE participant_id = ?').get(bId).n === 2 && s.annotations(bId).some(x => x.type === 'lh_test') && s.db.prepare('SELECT COUNT(*) AS n FROM previews WHERE participant_id = ?').get(bId).n === 1);
  const aud = s.db.prepare("SELECT action, detail_json FROM audit WHERE action LIKE 'migration%'").all();
  check('1c the purge is audited with counts only (no content, no reference)', aud.length >= 1 && aud.every(x => !/lh_test|hormonal_medication|P-LEG|positive|negative/i.test(x.detail_json || '')), JSON.stringify(aud));
  check('1c control: the bleeding entry of the withdrawn participant is kept', s.annotations(a).some(x => x.entryId === 'P-LEG-0001-b1'));
  s.setConsent(a, 'lh_tests', true, null);
  check('1c granting consent again after the upgrade restores nothing', !s.annotations(a).some(x => x.type === 'lh_test'));
  s.close();
}

/* ---------- 3a. Duplicate / conflict handling uses all analysis-relevant metadata ---------- */
{
  const base = obsPreview('P-Q3-0001', [obsRow('P-Q3-0001')]);
  const existing = { obsRowHash: new Map(base.accepted.map(o => [o.obsKey, o.rowHash])) };
  check('3a control: an identical row is an exact duplicate', obsPreview('P-Q3-0001', [obsRow('P-Q3-0001')], { existing }).counts.duplicates === 1);
  for (const [k, v] of [['sleep_session_id', 'S2'], ['device_model', 'SYN-1b'], ['sampling_interval_s', 60], ['precision', '0.1'], ['tz_name', 'Europe/London'], ['device_manufacturer', 'OtherCo'], ['sampling_config', 'mode2']]) {
    const p = obsPreview('P-Q3-0001', [obsRow('P-Q3-0001', { [k]: v })], { existing });
    check(`3a a changed ${k} is not discarded as an exact duplicate (quarantined as a conflict, original kept)`, p.counts.duplicates === 0 && p.quarantined[0]?.reasons.includes('conflicting_duplicate'), JSON.stringify(p.counts));
  }
}

/* ---------- 3b. Corrections supersede their ancestors even with tied timestamps ---------- */
{
  const ann = (id, c, t, v = 'period_start', d = '2026-01-05') => ({ participantRef: 'P', entryId: id, type: 'bleeding', value: v, date: d, recordedAt: t, ingestedAt: 0, corrects: c });
  const ids = e => e.map(x => `${x.entryId}@${x.date}`).join(',');
  check('3b a correction recorded at the same instant supersedes its ancestor (id order irrelevant)', ids(effectiveAnnotations([ann('P-z-A', null, 5), ann('P-a-B', 'P-z-A', 5, 'period_start', '2026-01-07')])) === 'P-a-B@2026-01-07', ids(effectiveAnnotations([ann('P-z-A', null, 5), ann('P-a-B', 'P-z-A', 5, 'period_start', '2026-01-07')])));
  check('3b a same-instant retraction removes its ancestor', effectiveAnnotations([ann('P-z-A', null, 5), ann('P-a-R', 'P-z-A', 5, 'retracted')]).length === 0);
  check('3b a correction recorded EARLIER than its ancestor (clock skew) still supersedes it', ids(effectiveAnnotations([ann('P-z-A', null, 9), ann('P-a-B', 'P-z-A', 3, 'period_start', '2026-01-08')])) === 'P-a-B@2026-01-08');
  const chain = [ann('P-c-A', null, 5), ann('P-b-B', 'P-c-A', 5, 'period_start', '2026-01-06'), ann('P-a-C', 'P-b-B', 5, 'period_start', '2026-01-09')];
  check('3b a multi-level chain with tied times resolves to its last link', ids(effectiveAnnotations(chain)) === 'P-a-C@2026-01-09' && ids(effectiveAnnotations([...chain].reverse())) === 'P-a-C@2026-01-09');
  check('3b a multi-level chain ending in a retraction removes the entry', effectiveAnnotations([...chain, ann('P-0-R', 'P-a-C', 5, 'retracted')]).length === 0);
  const cyc = effectiveAnnotations([ann('P-x-A', 'P-x-B', 5), ann('P-x-B', 'P-x-A', 5), ann('P-x-D', null, 5, 'period_start', '2026-02-01')]);
  check('3b cycles are still rejected safely (valid entries kept)', ids(cyc) === 'P-x-D@2026-02-01' && cyc.malformed.length === 2);
}

/* ---------- 3c. Strict calendar timestamps ---------- */
{
  const ts = t => { const p = obsPreview('P-Q3-0002', [obsRow('P-Q3-0002', { timestamp_utc: t })]); return p.accepted.length ? 'accepted' : p.quarantined[0]?.reasons.join(','); };
  for (const t of ['2026-02-30T10:00:00Z', '2026-02-29T10:00:00Z', '2026-04-31T10:00:00Z', '2026-13-01T10:00:00Z', '2026-01-01T24:00:00Z', '2026-01-01T23:60:00Z', '2026-01-01T23:59:60Z', '2026-01-01T10:00:00+14:30', '2026-01-01T10:00:00-12:30', '2026-01-01T10:00:00+05:61'])
    check(`3c impossible timestamp ${t} is quarantined, not normalised`, ts(t) !== 'accepted' && /timestamp_invalid/.test(ts(t)), ts(t));
  for (const t of ['2024-02-29T10:00:00Z', '2026-12-31T23:59:59Z', '2026-01-01T10:00:00+14:00', '2026-01-01T10:00:00-12:00', '2026-01-01T10:00:00+05:45', '2026-01-01T10:00:00.123456Z'])
    check(`3c valid timestamp ${t} is accepted`, ts(t) === 'accepted', ts(t));
  const end = obsPreview('P-Q3-0002', [obsRow('P-Q3-0002', { end_timestamp_utc: '2026-02-30T00:00:00Z' })]);
  check('3c an impossible end timestamp is quarantined', end.quarantined[0]?.reasons.includes('end_timestamp_invalid'));
  const rec = validateAnnotation({ participant_ref: 'P-Q3-0002', entry_id: 'P-Q3-0002-a', type: 'bleeding', value: 'period', date: '2026-01-05', recorded_at: '2026-02-30T09:00:00Z' }, { participantRef: 'P-Q3-0002' });
  check('3c an impossible recorded_at is rejected', !!rec.reject?.includes('recorded_at_missing_or_invalid'));
  check('3c annotation dates: 29 Feb only in leap years; 31 Apr never', !!validateAnnotation({ participant_ref: 'P-Q3-0002', entry_id: 'P-Q3-0002-b', type: 'bleeding', value: 'period', date: '2026-02-29', recorded_at: '2026-03-01T09:00:00Z' }, {}).reject?.includes('date_invalid')
    && !validateAnnotation({ participant_ref: 'P-Q3-0002', entry_id: 'P-Q3-0002-c', type: 'bleeding', value: 'period', date: '2024-02-29', recorded_at: '2024-03-01T09:00:00Z' }, {}).reject);
}

/* ---------- 3d. Vendor nightly values respect the analysis cutoff ---------- */
{
  const nightly = label => obsRow('P-Q3-0003', { aggregation: 'nightly_value', derivation: 'vendor_derived', timestamp_utc: '', utc_offset_minutes: '', sleep_session_id: '', sampling_interval_s: '', night_label: label });
  const ing = D('2026-11-01T00:00:00Z');
  const future = obsPreview('P-Q3-0003', [nightly('2026-12-01')], { now: ing });
  check('3d at import, a vendor night that has not ended yet is quarantined, not accepted', future.accepted.length === 0 && future.quarantined[0]?.reasons.includes('night_not_yet_complete'), JSON.stringify(future.quarantined.map(q => q.reasons)));
  const hist = obsPreview('P-Q3-0003', [nightly('2026-10-01')], { now: ing });
  check('3d a historical vendor night imports normally', hist.accepted.length === 1);
  // Defence in depth: stored data that bypassed that check (e.g. imported by an older version).
  const obs = [...accepted(obsPreview('P-Q3-0003', [nightly('2026-12-01')]), ing), ...accepted(hist, ing).map(o => ({ ...o, id: 9, seq: 9 }))];
  const early = analyse({ observations: obs, annotations: [], asOf: D('2026-11-15T00:00:00Z') });
  check('3d a future-dated vendor night does not appear in an earlier analysis', !early.observed.nights.some(n => n.night === '2026-12-01') && early.observed.nights.some(n => n.night === '2026-10-01'), JSON.stringify(early.observed.nights.map(n => n.night)));
  const later = analyse({ observations: obs, annotations: [], asOf: D('2026-12-05T00:00:00Z') });
  check('3d it appears once its night has ended under the documented convention', later.observed.nights.some(n => n.night === '2026-12-01'));
  check('3d the convention is documented in the configuration', typeof CONFIG.night.vendorNightCompleteRule === 'string' && CONFIG.night.vendorNightCompleteRule.length > 20);
}

/* ---------- 3e. Sampling intervals ---------- */
{
  for (const v of ['1e308', '1e20', '86400000', '3601', 'Infinity'])
    { const p = obsPreview('P-Q3-0004', [obsRow('P-Q3-0004', { sampling_interval_s: v })]); check(`3e sampling interval ${v} s is rejected or quarantined (out of range / not finite)`, p.accepted.length === 0, JSON.stringify(p.counts)); }
  const okv = obsPreview('P-Q3-0004', [obsRow('P-Q3-0004', { sampling_interval_s: '3600' })]);
  check('3e an interval at the documented maximum (3600 s) is accepted', okv.accepted.length === 1 && CONFIG.limits.maxSamplingIntervalS === 3600);
  const longEnd = obsPreview('P-Q3-0004', [obsRow('P-Q3-0004', { end_timestamp_utc: '2026-02-03T23:00:00Z' })]);
  check('3e a single measurement interval longer than the maximum is quarantined', longEnd.accepted.length === 0 && longEnd.quarantined[0]?.reasons.includes('measurement_interval_too_long'), JSON.stringify(longEnd.quarantined.map(q => q.reasons)));
  // Analysis robustness: malformed stored observations (bypassing ingestion) must not crash or inflate coverage.
  const good = accepted(obsPreview('P-Q3-0004', Array.from({ length: 8 }, (_, i) => obsRow('P-Q3-0004', { timestamp_utc: new Date(D('2026-02-01T23:00:00Z') + i * 600e3).toISOString() }))));
  const bad = [{ ...good[0], id: 90, seq: 90, tsUtc: D('2026-02-02T01:00:00Z'), device: { ...good[0].device, samplingIntervalS: 1e308 } }, { ...good[0], id: 91, seq: 91, tsUtc: NaN }, { ...good[0], id: 92, seq: 92, tsUtc: D('2026-02-02T02:00:00Z'), endUtc: D('2027-02-02T02:00:00Z') }];
  let rep = null, err = null; try { rep = nightlyReports([...good, ...bad]); } catch (e) { err = e.message; }
  check('3e malformed observations do not crash the whole analysis', !err && rep.reports.length >= 1, err);
  const night = rep?.reports.find(r => r.night === '2026-02-01');
  check('3e calculated coverage is limited to the night window (≤ 12 h fallback window)', !!night && night.coverageMinutes != null && night.coverageMinutes <= 720, JSON.stringify(night?.coverageMinutes));
  let a2 = null; try { a2 = analyse({ observations: [...good, ...bad], annotations: [], asOf: D('2026-03-02T00:00:00Z') }); } catch (e) { err = e.message; }
  check('3e the full pipeline completes with malformed stored observations', !!a2 && !err, err);
}

/* ---------- 3f. Strict CSV quoting and shared JSON/CSV limits ---------- */
{
  check('3f CSV "33".5 is rejected, not read as 33.5', !!throwsCode(() => parseCSV('a,b\n"33".5,x\n'), 'text_after_closing_quote'));
  check('3f CSV x"y (quote inside an unquoted cell) is rejected', !!throwsCode(() => parseCSV('a\nx"y\n')));
  check('3f control: valid quoted CSV still parses', parseCSV('a,b\n"33.5","x,y"\n')[0].record.a === '33.5');
  const wide = parseJSONRecords(JSON.stringify({ records: [Object.fromEntries(Array.from({ length: 41 }, (_, i) => ['k' + i, 'x']))] }));
  check('3f JSON records are limited to the same column count as CSV (41 fields rejected)', wide[0].error === 'too_many_columns', JSON.stringify(wide[0]).slice(0, 80));
  const long = parseJSONRecords(JSON.stringify({ records: [{ a: 'x'.repeat(513) }] }));
  check('3f JSON cells are limited to the same length as CSV (513 characters rejected)', long[0].error === 'cell_too_long');
  const nested = parseJSONRecords(JSON.stringify({ records: [{ a: { b: 1 } }, { a: [1, 2] }] }));
  check('3f JSON values must be plain values (objects and arrays rejected)', nested.every(r => r.error === 'nested_value_not_allowed'));
}

/* ---------- 4a. Detection, confirmation and possible onset are separate ---------- */
const stream = { serial: 's', model: 'm', firmware: 'f', site: 'wrist', kind: 'skin_temperature', derivation: 'raw', aggregation: 'sample' };
const nights = (vals, start = '2026-01-10') => vals.map((v, i) => (v == null ? null : { night: addDays(start, i), streamKey: 'k', stream, features: { median: v }, dataQuality: { level: 'good', reasons: [] }, confounders: [], flags: [] })).filter(Boolean);
const cyc = (n, start = '2026-01-10') => ({ start, nextStart: addDays(start, n), complete: true, length: n });
{
  const s = sustainedShift(nights([33, 33, 33, 33, 34, 34, 34, 34]), cyc(8));
  check('4a [33,33,33,33,34,34,34,34]: separate detection, confirmation and possible-onset fields', s.status === 'shift_detected' && !!s.confirmationNight && !!s.possibleOnset, JSON.stringify({ shiftNight: s.shiftNight, confirmationNight: s.confirmationNight, possibleOnset: s.possibleOnset }));
  check('4a ... the possible onset includes night 5 (the first observed high night), not only night 6', s.possibleOnset?.latestNight === '2026-01-14' && s.possibleOnset?.earliestNight <= '2026-01-14' && !s.possibleOnset?.leftCensored, JSON.stringify(s.possibleOnset));
  check('4a ... confirmation is the last night of the qualifying window', s.confirmationNight === addDays(s.shiftNight, 2));
  const g = sustainedShift(nights([33, 33, 33, 33, 33, 33, 33.1, 33.2, 33.3, 33.4, 33.5, 33.6, 33.7, 33.8]), cyc(14));
  check('4a gradual rise: onset is an interval reaching back before the threshold crossing, or abstains', g.status === 'insufficient_data' || (g.possibleOnset && g.possibleOnset.earliestNight < g.possibleOnset.latestNight && g.reasons.includes('rise_may_have_begun_before_threshold_crossing')), JSON.stringify({ st: g.status, po: g.possibleOnset, r: g.reasons }));
  const b = sustainedShift(nights([33, 33, 34, 34, 34, 34, 34, 34, 34]), cyc(9));
  check('4a rise during baseline formation: not reported as "no clear shift"; onset left-censored or abstained', b.status !== 'no_clear_shift' && (b.status === 'insufficient_data' || b.possibleOnset?.leftCensored === true), JSON.stringify({ st: b.status, r: b.reasons, po: b.possibleOnset }));
  const m = sustainedShift(nights([33, 33, 33, 33, 33, 33, null, null, 34, 34, 34]), cyc(11));
  check('4a missing nights before the rise: the onset interval spans the unobserved nights', m.status === 'shift_detected' && m.possibleOnset?.earliestNight === '2026-01-16' && m.possibleOnset?.latestNight === '2026-01-18', JSON.stringify(m.possibleOnset));
  const e = sustainedShift(nights([34, 34, 34, 34, 34, 34, 34, 34, 34, 34], '2026-01-20'), { start: '2026-01-10', nextStart: '2026-01-30', complete: true, length: 20 });
  check('4a already-elevated readings from the first observed night (nothing near cycle start): not "no clear shift"', e.status === 'insufficient_data' && e.reasons.some(r => /cycle_start|left_censored/.test(r)), JSON.stringify({ st: e.status, r: e.reasons }));
}

/* ---------- 4b. Long gaps between baseline and confirmation ---------- */
{
  const vals = [33, 33, 33, 33, 33, ...Array(55).fill(null), 34, 34, 34];
  const s = sustainedShift(nights(vals), cyc(vals.length + 2));
  check('4b five low nights, 55 missing days, three high nights: no shift reported; labelled abstention', s.status === 'insufficient_data' && s.reasons.includes('gap_between_baseline_and_candidate'), JSON.stringify({ st: s.status, r: s.reasons }));
  check('4b the gap policy is configurable and documented as an engineering assumption', Number.isInteger(CONFIG.shift.skin_temperature.maxJoinGapNights) && Number.isInteger(CONFIG.shift.skin_temperature.maxBaselineSpanNights) && CONFIG.status === 'unvalidated_engineering_assumptions');
  const ok = sustainedShift(nights([33, 33, 33, 33, 33, 33, null, 34, 34, 34]), cyc(10));
  check('4b control: a one-night gap still allows detection', ok.status === 'shift_detected');
}

/* ---------- 4c. Excluding a value vs excluding timing ---------- */
{
  const ref = 'P-Q4-0001';
  const mk = (t, v = '33.80') => obsRow(ref, { timestamp_utc: t, sampling_interval_s: 1800, sleep_session_id: 'S1', value: v });
  const main = Array.from({ length: 12 }, (_, i) => mk(new Date(D('2026-02-10T23:00:00Z') + i * 1800e3).toISOString()));
  const farOff = accepted(obsPreview(ref, [...main, mk('2026-02-03T23:00:00Z')]));
  const r1 = nightlyReports(farOff);
  check('4c a sample with a corrupted timestamp far from its session does not decide the session\'s night', r1.reports.length === 1 && r1.reports[0].night === '2026-02-10' && r1.reports[0].counts.total === 12 && r1.unplaced.session_timing_outlier === 1, JSON.stringify({ n: r1.reports.map(r => `${r.night}:${r.counts.total}`), u: r1.unplaced }));
  // A plausible-looking but wrong time (11:00, within the session-span limit) shifts the label until it is corrected.
  const near = accepted(obsPreview(ref, [...main, mk('2026-02-10T11:00:00Z')]));
  check('4c setup: an uncorrected near-session wrong time still labels the session from the earliest sample', nightlyReports(near).reports[0].night === '2026-02-09');
  const valueExcluded = near.map(o => (o.tsUtc === D('2026-02-10T11:00:00Z') ? { ...o, excludedBy: 'correction' } : o));
  const v = nightlyReports(valueExcluded).reports;
  check('4c excluding the VALUE keeps the sample\'s timing (label unchanged, value not used)', v[0].night === '2026-02-09' && v[0].counts.excluded.researcher_excluded === 1, JSON.stringify(v.map(r => [r.night, r.counts])));
  const timingExcluded = near.map(o => (o.tsUtc === D('2026-02-10T11:00:00Z') ? { ...o, timingExcludedBy: 'correction' } : o));
  const t = nightlyReports(timingExcluded);
  check('4c excluding the TIMING removes the sample from session labelling and placement; the session is re-labelled', t.reports.length === 1 && t.reports[0].night === '2026-02-10' && t.reports[0].counts.total === 12 && t.unplaced.timing_excluded_by_correction === 1, JSON.stringify({ n: t.reports.map(r => `${r.night}:${r.counts.total}`), u: t.unplaced }));
  // Historical replay and provenance through the pipeline (correction history with times).
  const obs = near.map(o => (o.tsUtc === D('2026-02-10T11:00:00Z') ? { ...o, corrections: [{ action: 'exclude_timing', reason: 'clock_error', at: D('2026-03-05T00:00:00Z') }] } : { ...o, corrections: [] }));
  const before = analyse({ observations: obs, annotations: [], asOf: D('2026-03-04T00:00:00Z') }), after = analyse({ observations: obs, annotations: [], asOf: D('2026-03-06T00:00:00Z') });
  check('4c replay: before the timing correction the old label stands; after it, the corrected label (and provenance lists it)', before.observed.nights[0]?.night === '2026-02-09' && after.observed.nights[0]?.night === '2026-02-10' && after.provenance.effectiveCorrections.some(c => c.action === 'exclude_timing'), JSON.stringify([before.observed.nights.map(n => n.night), after.observed.nights.map(n => n.night)]));
}
done();
