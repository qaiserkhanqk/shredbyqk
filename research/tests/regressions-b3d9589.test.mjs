// Regression tests for the research-prototype issues reported against b3d9589 (issues 1, 2, 5, 6, 7, 8; issues 3 and 4
// are in tests/cycle-regressions-b3d9589.test.mjs). Written BEFORE the fixes; the failing run is committed in
// research/docs/test-logs/. Synthetic data only. Run: node research/tests/regressions-b3d9589.test.mjs
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openStore } from '../server/store.js';
import { createApp } from '../server/server.js';
import { participant, OBS_COLUMNS, ANN_COLUMNS } from '../lib/synth.js';
import { preview, validateAnnotation } from '../lib/ingest.js';
import { nightlyReports } from '../lib/quality.js';
import { effectiveAnnotations, segment } from '../lib/cycles.js';
import { sustainedShift } from '../lib/inference.js';
import { analyse } from '../lib/pipeline.js';
import { check, done } from './harness.mjs';

const csv = (cols, rows) => [cols.join(','), ...rows.map(r => cols.map(c => String(r[c] ?? '')).join(','))].join('\n');
const PW = 'synthetic-pass-123';
const D = s => Date.parse(s);
let clock = D('2026-03-10T12:00:00Z');
const store = openStore(':memory:', { now: () => clock });
const app = createApp({ store, settings: { secureCookies: false, idleMs: 1e12, absoluteMs: 1e12 }, log: () => {}, now: () => clock });
const server = createServer(app); await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
async function call(method, path, { body, as } = {}) {
  const h = {}; if (as) { h.cookie = as.cookie; h['x-csrf-token'] = as.csrf; } if (body !== undefined) h['content-type'] = 'application/json';
  const r = await fetch(BASE + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* csv */ }
  return { status: r.status, text, json };
}
async function login(u) {
  const r = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: u, password: PW }) });
  return { cookie: r.headers.get('set-cookie').split(';')[0], csrf: (await r.json()).csrf };
}
store.createUser({ username: 'admin', password: PW, role: 'admin' });
store.createUser({ username: 'res', password: PW, role: 'researcher' });
const R = await login('res'), ADM = await login('admin');
async function newParticipant(ref, scopes = ['core_research']) {
  await call('POST', '/api/participants', { as: R, body: { ref, adultConfirmed: true } });
  for (const scope of scopes) await call('POST', `/api/participants/${ref}/consents/record-signed`, { as: R, body: { scope, signedFormReference: true } });
}
async function importText(ref, recordType, content) {
  const pv = await call('POST', `/api/participants/${ref}/imports/preview`, { as: R, body: { recordType, format: 'csv', content } });
  if (!pv.json?.previewId) return { pv };
  const cm = await call('POST', `/api/participants/${ref}/imports/commit`, { as: R, body: { previewId: pv.json.previewId } });
  return { pv, cm };
}
const pid = ref => store.participantByRef(ref).id;
const previewsFor = ref => store.db.prepare('SELECT payload_json FROM previews WHERE participant_id = ?').all(pid(ref));
const ANN_HEAD = 'participant_ref,entry_id,type,value,date,recorded_at,corrects';

/* ---------- 1. Participant permissions are consistent across /analysis, /runs and /export ---------- */
{
  const p = participant({ ref: 'P-R1-0001', seed: 201, rise: 0.5, samplesPerNight: 12, intervalMin: 40, cycleLengths: [30, 29, 31] });
  await newParticipant('P-R1-0001');
  await importText('P-R1-0001', 'observations', csv(OBS_COLUMNS, p.observations));
  await importText('P-R1-0001', 'annotations', csv(ANN_COLUMNS, p.annotations));
  await importText('P-R1-0001', 'observations', csv(OBS_COLUMNS, [{ ...p.observations[0], timestamp_utc: '', unit: '' }])); // something in quarantine
  clock = D('2026-05-01T12:00:00Z');
  for (const name of ['experimental_shift', 'experimental_forecast']) await call('POST', '/api/participants/P-R1-0001/features', { as: R, body: { name, enabled: true } });
  const ra = await call('GET', '/api/participants/P-R1-0001/analysis', { as: R });
  check('1 control: the researcher sees experimental estimates and stored runs', Array.isArray(ra.json.estimates) && (await call('GET', '/api/participants/P-R1-0001/runs', { as: R })).json.runs.length > 0);
  await call('POST', '/api/users', { as: ADM, body: { username: 'p_r1', password: PW, role: 'participant', participantRef: 'P-R1-0001' } });
  const PP = await login('p_r1');
  const runs = await call('GET', '/api/participants/P-R1-0001/runs', { as: PP });
  check('1 /runs: a participant cannot read stored experimental runs (historical outputs)', runs.status === 403 || (runs.status === 200 && !/"layer":"(estimate|forecast)"/.test(runs.text)), `${runs.status} ${runs.text.slice(0, 120)}`);
  const ex = await call('GET', '/api/participants/P-R1-0001/export', { as: PP });
  check('1 /export: a participant export contains no experimental estimates or forecasts', ex.status === 200 && !/"layer":"(estimate|forecast)"/.test(ex.text), ex.text.match(/"layer":"(estimate|forecast)"/)?.[0]);
  check('1 /export: a participant export contains no quarantine records (researcher-only, as on /quarantine)', ex.status === 200 && !/verbatimSource/.test(ex.text) && (await call('GET', '/api/participants/P-R1-0001/quarantine', { as: PP })).status === 403);
  const hist = await call('GET', '/api/participants/P-R1-0001/analysis?asOf=2026-04-01T00:00:00Z', { as: PP });
  check('1 /analysis (historical as-of): still no experimental layers for a participant', hist.status === 200 && !/"layer":"(estimate|forecast)"/.test(hist.text));
  const rex = await call('GET', '/api/participants/P-R1-0001/export', { as: R });
  check('1 control: the researcher export still has derived runs and quarantine', /"layer":"estimate"/.test(rex.text) && /verbatimSource/.test(rex.text));
}

/* ---------- 2. Consent rechecked at commit; previews invalidated; no unconsented LH/hormonal data retained ---------- */
{
  const p = participant({ ref: 'P-R2-0001', seed: 202, samplesPerNight: 6, intervalMin: 60, cycleLengths: [3] });
  await newParticipant('P-R2-0001');
  const pv = await call('POST', '/api/participants/P-R2-0001/imports/preview', { as: R, body: { recordType: 'observations', format: 'csv', content: csv(OBS_COLUMNS, p.observations) } });
  await call('POST', '/api/participants/P-R2-0001/consents', { as: R, body: { scope: 'core_research', granted: false } });
  check('2 withdrawing consent invalidates pending previews for that participant', previewsFor('P-R2-0001').length === 0, `${previewsFor('P-R2-0001').length} previews left`);
  const cm = await call('POST', '/api/participants/P-R2-0001/imports/commit', { as: R, body: { previewId: pv.json.previewId } });
  check('2 a commit after core consent was withdrawn is refused and stores nothing', cm.status >= 400 && store.observations(pid('P-R2-0001')).length === 0, `${cm.status} stored=${store.observations(pid('P-R2-0001')).length}`);
}
{
  await newParticipant('P-R2-0002'); // core consent only: no LH, no hormonal consent
  const rows = [ANN_HEAD, 'P-R2-0002,P-R2-0002-b1,bleeding,period_start,2026-01-05,2026-01-05T09:00:00Z,', 'P-R2-0002,P-R2-0002-l1,lh_test,positive,2026-01-18,2026-01-18T09:00:00Z,', 'P-R2-0002,P-R2-0002-h1,hormonal_medication,yes,2026-01-18,2026-01-18T09:00:00Z,'].join('\n');
  const pv = await call('POST', '/api/participants/P-R2-0002/imports/preview', { as: R, body: { recordType: 'annotations', format: 'csv', content: rows } });
  const saved = previewsFor('P-R2-0002').map(r => r.payload_json).join('');
  check('2 a saved preview holds no unconsented LH or hormonal content', saved.length > 0 && !/lh_test|hormonal_medication/.test(saved), saved.match(/.{40}(lh_test|hormonal_medication).{20}/)?.[0]);
  await call('POST', '/api/participants/P-R2-0002/imports/commit', { as: R, body: { previewId: pv.json.previewId } });
  const q = JSON.stringify(store.quarantine(pid('P-R2-0002')));
  check('2 quarantine keeps the reason but not the unconsented LH/hormonal cells', /lh_tests_not_consented/.test(q) && /hormonal_context_not_consented/.test(q) && !/"lh_test"|"hormonal_medication"|"positive"/.test(q), q.slice(0, 300));
  const ex = await call('GET', '/api/participants/P-R2-0002/export', { as: R });
  check('2 exports contain no unconsented LH or hormonal data', !/lh_test|hormonal_medication/.test(ex.text));
}
{
  await newParticipant('P-R2-0003', ['core_research', 'lh_tests']);
  const lh = [ANN_HEAD, 'P-R2-0003,P-R2-0003-l1,lh_test,positive,2026-01-18,2026-01-18T09:00:00Z,'].join('\n');
  await importText('P-R2-0003', 'annotations', lh);
  check('2 control: with LH consent the LH result is stored', store.annotations(pid('P-R2-0003')).some(a => a.type === 'lh_test'));
  const pv = await call('POST', '/api/participants/P-R2-0003/imports/preview', { as: R, body: { recordType: 'annotations', format: 'csv', content: [ANN_HEAD, 'P-R2-0003,P-R2-0003-l2,lh_test,negative,2026-01-17,2026-01-17T09:00:00Z,'].join('\n') } });
  await call('POST', '/api/participants/P-R2-0003/consents', { as: R, body: { scope: 'lh_tests', granted: false } });
  const cm = await call('POST', '/api/participants/P-R2-0003/imports/commit', { as: R, body: { previewId: pv.json.previewId } });
  check('2 an LH import previewed before LH consent was withdrawn cannot be committed', cm.status >= 400 && !store.annotations(pid('P-R2-0003')).some(a => a.entryId === 'P-R2-0003-l2'));
  check('2 withdrawing LH consent removes stored LH results from the database', !store.annotations(pid('P-R2-0003')).some(a => a.type === 'lh_test'));
  const ex = await call('GET', '/api/participants/P-R2-0003/export', { as: R });
  check('2 ... and from exports', !/lh_test/.test(ex.text));
}
{
  // Commit-time recheck inside the transaction, independent of preview invalidation (e.g. a race).
  await newParticipant('P-R2-0004', ['core_research', 'lh_tests']);
  const id = pid('P-R2-0004');
  const pv = preview([ANN_HEAD, 'P-R2-0004,P-R2-0004-l1,lh_test,positive,2026-01-18,2026-01-18T09:00:00Z,'].join('\n'), { format: 'csv', recordType: 'annotations', participantRef: 'P-R2-0004', consents: { core_research: true, lh_tests: true } });
  store.setConsent(id, 'lh_tests', false, null); // consent changes after the preview was made
  let threw = null; try { store.commitImport(id, pv, null, a => a.entryId); } catch (e) { threw = e.code || e.message; }
  check('2 the commit transaction itself rechecks optional consent (no LH stored when it was withdrawn)', !store.annotations(id).some(a => a.type === 'lh_test'), `threw=${threw}`);
  store.setConsent(id, 'core_research', false, null);
  const pv2 = preview([ANN_HEAD, 'P-R2-0004,P-R2-0004-b1,bleeding,period_start,2026-01-05,2026-01-05T09:00:00Z,'].join('\n'), { format: 'csv', recordType: 'annotations', participantRef: 'P-R2-0004', consents: { core_research: true } });
  threw = null; try { store.commitImport(id, pv2, null, a => a.entryId); } catch (e) { threw = e.code || e.message; }
  check('2 the commit transaction itself rechecks core consent', store.annotations(id).length === 0, `threw=${threw}`);
}

/* ---------- 5. One biological-night label for a whole sleep session ---------- */
const INGESTED = D('2027-01-01T00:00:00Z');
const obsRow = (ref, iso, value, o = {}) => ({ participant_ref: ref, timestamp_utc: iso, end_timestamp_utc: new Date(D(iso) + 1800e3).toISOString(), utc_offset_minutes: 0, device_manufacturer: 'SyntheticCo', device_model: 'SYN-1', device_serial_pseudonym: `${ref}-dev1`, firmware: '1', sampling_interval_s: 1800, sensor_site: 'wrist', measurement_kind: 'skin_temperature', derivation: 'raw', aggregation: 'sample', value, unit: 'C', ...o });
const accept = (ref, rows) => preview(csv(OBS_COLUMNS, rows), { format: 'csv', recordType: 'observations', participantRef: ref }).accepted.map((x, i) => ({ ...x, id: i + 1, seq: i + 1, ingestedAt: INGESTED }));
{
  // Day sleep after a night shift: 08:00–16:00 local, one source session.
  const rows = Array.from({ length: 16 }, (_, i) => obsRow('P-R5-0001', new Date(D('2026-02-10T08:00:00Z') + i * 1800e3).toISOString(), '33.80', { sleep_session_id: 'day-sleep-1' }));
  const reps = nightlyReports(accept('P-R5-0001', rows)).reports;
  check('5 a daytime sleep session crossing noon gets ONE night label (not split at noon)', reps.length === 1 && reps[0].counts.total === 16, reps.map(r => `${r.night}:${r.counts.total}`).join(' '));
  // Travel during one session: the offset changes from UTC+0 to UTC+9 part-way through.
  const trip = Array.from({ length: 16 }, (_, i) => obsRow('P-R5-0002', new Date(D('2026-02-10T20:00:00Z') + i * 1800e3).toISOString(), '33.80', { sleep_session_id: 'flight-night', utc_offset_minutes: i < 8 ? 0 : 540 }));
  const tr = nightlyReports(accept('P-R5-0002', trip)).reports;
  check('5 a session whose UTC offset changes part-way keeps one label (taken from the session start, documented)', tr.length === 1 && tr[0].night === '2026-02-10' && tr[0].flags.includes('utc_offset_changed_within_night'), tr.map(r => `${r.night}:${r.counts.total}`).join(' '));
}

/* ---------- 6. One canonical stream identity, including device model ---------- */
{
  const base = participant({ ref: 'P-R6-0001', seed: 206, rise: 0, samplesPerNight: 12, intervalMin: 40, cycleLengths: [30, 30], deviceChangeOn: '2026-01-20', deviceBias: 0.6 });
  // Same serial pseudonym and firmware, different MODEL from 20 Jan (e.g. a replacement unit the vendor reports under one serial).
  base.observations.forEach(o => { if (o.device_model === 'SYN-2') { o.device_serial_pseudonym = 'P-R6-0001-dev1'; o.firmware = '1.4.2'; } });
  const obs = accept('P-R6-0001', base.observations), ann = preview(csv(ANN_COLUMNS, base.annotations), { format: 'csv', recordType: 'annotations', participantRef: 'P-R6-0001' }).accepted;
  const eff = effectiveAnnotations(ann), q = nightlyReports(obs, eff), c = segment(eff).cycles[0];
  check('6 quality: a model change (same serial and firmware) is flagged as a device transition', q.reports.find(r => r.night === '2026-01-20')?.flags.includes('device_change_since_previous_night'), JSON.stringify(q.reports.find(r => r.night === '2026-01-20')?.flags));
  const s = sustainedShift(q.reports, c);
  check('6 inference: a model change with a level offset is not reported as a shift (separate segments)', s.status !== 'shift_detected' && s.segments?.length === 2, `${s.status} segments=${s.segments?.length}`);
  const a = analyse({ observations: obs, annotations: ann, asOf: INGESTED + 1, features: { experimental_shift: true } });
  check('6 provenance lists the canonical stream identities, including model', Array.isArray(a.provenance.streams) && a.provenance.streams.some(x => x.includes('SYN-2')) && a.provenance.streams.some(x => x.includes('SYN-1')), JSON.stringify(a.provenance.streams));
}

/* ---------- 7. Historical analysis is reproducible ---------- */
{
  clock = D('2026-03-10T12:00:00Z');
  const p = participant({ ref: 'P-R7-0001', seed: 207, samplesPerNight: 12, intervalMin: 40, cycleLengths: [30, 30] });
  await newParticipant('P-R7-0001');
  await importText('P-R7-0001', 'observations', csv(OBS_COLUMNS, p.observations));
  await importText('P-R7-0001', 'annotations', csv(ANN_COLUMNS, p.annotations));
  const at = '2026-03-20T00:00:00Z';
  clock = D('2026-03-25T12:00:00Z');
  const before = await call('GET', `/api/participants/P-R7-0001/analysis?asOf=${at}`, { as: R });
  clock = D('2026-04-01T12:00:00Z');
  const firstObs = store.observations(pid('P-R7-0001'))[0].id;
  await call('POST', '/api/participants/P-R7-0001/corrections', { as: R, body: { observationId: firstObs, action: 'exclude', reason: 'sensor_check' } });
  clock = D('2026-04-05T12:00:00Z');
  const after = await call('GET', `/api/participants/P-R7-0001/analysis?asOf=${at}`, { as: R });
  const strip = j => JSON.stringify({ observed: j.observed, descriptive: j.descriptive, provenance: j.provenance });
  check('7 a correction made AFTER the cutoff does not change the as-of analysis (reproducible)', strip(before.json) === strip(after.json), `${before.json.provenance.inputHash.slice(0, 8)} vs ${after.json.provenance.inputHash.slice(0, 8)}`);
  const n0 = after.json.observed.nights.find(r => r.night === '2026-01-05');
  check('7 ... the excluded sample is still counted as valid at the earlier cutoff', n0 && !n0.counts.excluded.researcher_excluded, JSON.stringify(n0?.counts));
  const later = await call('GET', '/api/participants/P-R7-0001/analysis?asOf=2026-04-02T00:00:00Z', { as: R });
  check('7 a cutoff after the correction applies it', !!later.json.observed.nights.find(r => r.night === '2026-01-05')?.counts.excluded.researcher_excluded);
  check('7 the provenance input hash includes effective corrections (differs once a correction applies)', later.json.provenance.inputHash !== after.json.provenance.inputHash && Array.isArray(later.json.provenance.effectiveCorrections) && later.json.provenance.effectiveCorrections.length === 1);
  // An annotation recorded "earlier" but INGESTED after the cutoff was not known at the cutoff.
  clock = D('2026-05-01T12:00:00Z');
  await importText('P-R7-0001', 'annotations', [ANN_HEAD, 'P-R7-0001,P-R7-0001-late,bleeding,period_start,2026-03-12,2026-03-12T09:00:00Z,'].join('\n'));
  const asOfApr = await call('GET', '/api/participants/P-R7-0001/analysis?asOf=2026-04-10T00:00:00Z', { as: R });
  check('7 an entry ingested after the cutoff is not used, even if its recorded_at is earlier', !asOfApr.json.observed.cycles.some(c => c.start === '2026-03-12'), JSON.stringify(asOfApr.json.observed.cycles.map(c => c.start)));
  const nowView = await call('GET', '/api/participants/P-R7-0001/analysis?asOf=2026-05-02T00:00:00Z', { as: R });
  check('7 control: after ingestion it is used', nowView.json.observed.cycles.some(c => c.start === '2026-03-12'));
}

/* ---------- 8. Self-referencing and circular corrections ---------- */
{
  const self = validateAnnotation({ participant_ref: 'P-R8-0001', entry_id: 'P-R8-0001-a', type: 'bleeding', value: 'period', date: '2026-01-05', recorded_at: '2026-01-05T09:00:00Z', corrects: 'P-R8-0001-a' }, { participantRef: 'P-R8-0001' });
  check('8 a self-referencing correction is rejected', !!self.reject?.includes('self_correction'), JSON.stringify(self));
  const circ = preview([ANN_HEAD, 'P-R8-0001,P-R8-0001-a,bleeding,period_start,2026-01-05,2026-01-05T09:00:00Z,P-R8-0001-b', 'P-R8-0001,P-R8-0001-b,bleeding,period_start,2026-01-06,2026-01-06T09:00:00Z,P-R8-0001-a'].join('\n'), { format: 'csv', recordType: 'annotations', participantRef: 'P-R8-0001' });
  check('8 a circular correction within one file is rejected', circ.counts.accepted === 0 && circ.quarantined.every(q => q.reasons.includes('circular_correction')), JSON.stringify(circ.quarantined.map(q => q.reasons)));
  const across = preview([ANN_HEAD, 'P-R8-0001,P-R8-0001-y,bleeding,period_start,2026-01-06,2026-01-06T09:00:00Z,P-R8-0001-x'].join('\n'), { format: 'csv', recordType: 'annotations', participantRef: 'P-R8-0001', existing: { entryHash: new Map([['P-R8-0001-x', 'h']]), entryCorrects: new Map([['P-R8-0001-x', 'P-R8-0001-y']]) } });
  check('8 a circular correction across imports (existing x corrects y, new y corrects x) is rejected', across.counts.accepted === 0 && across.quarantined[0]?.reasons.includes('circular_correction'), JSON.stringify(across.quarantined.map(q => q.reasons)));
  // Defensive: malformed stored data (bypassing ingestion) must not hang analysis.
  const lib = fileURLToPath(new URL('../lib/cycles.js', import.meta.url));
  const code = `const { effectiveAnnotations, segment } = await import(${JSON.stringify(lib)});
    const a = (id, c, t) => ({ participantRef: 'P-R8-0001', entryId: id, type: 'bleeding', value: 'period_start', date: '2026-01-0' + t, recordedAt: t, corrects: c });
    const eff = effectiveAnnotations([a('A', 'B', 1), a('B', 'A', 2), a('C', 'C', 3), a('D', null, 4)]); segment(eff); console.log(JSON.stringify(eff.map(x => x.entryId)));`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], { timeout: 5000, encoding: 'utf8' });
  check('8 malformed circular data in storage cannot hang analysis (finishes within 5 s)', r.status === 0 && !r.error, r.error ? `timed out: ${r.error.code}` : r.stderr.slice(0, 200));
  check('8 ... and the circular/self-referencing entries are dropped, valid ones kept', r.status === 0 && JSON.parse(r.stdout.trim() || '[]').join(',') === 'D', r.stdout);
}

server.close(); done();
