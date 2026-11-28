// Regression tests for the research-prototype issues reported against f67000b (issues 1 and 2; issue 3 is in
// tests/cycle-regressions-f67000b.test.mjs). Written BEFORE the fixes; the failing run is committed in
// research/docs/test-logs/. Synthetic data only. Run: node research/tests/regressions-f67000b.test.mjs
import { createServer } from 'node:http';
import { openStore } from '../server/store.js';
import { createApp } from '../server/server.js';
import { check, done } from './harness.mjs';

const PW = 'synthetic-pass-123';
let clock = Date.parse('2026-03-10T12:00:00Z');
const store = openStore(':memory:', { now: () => clock });
const app = createApp({ store, settings: { secureCookies: false, idleMs: 1e12, absoluteMs: 1e12 }, log: () => {}, now: () => clock });
const server = createServer(app); await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
async function call(method, path, { body, as } = {}) {
  const h = {}; if (as) { h.cookie = as.cookie; h['x-csrf-token'] = as.csrf; } if (body !== undefined) h['content-type'] = 'application/json';
  const r = await fetch(BASE + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: r.status, text, json };
}
async function login(u) {
  const r = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: u, password: PW }) });
  return { cookie: r.headers.get('set-cookie').split(';')[0], csrf: (await r.json()).csrf };
}
store.createUser({ username: 'admin', password: PW, role: 'admin' });
store.createUser({ username: 'res', password: PW, role: 'researcher' });
const R = await login('res'), ADM = await login('admin');
const pid = ref => store.participantByRef(ref).id;
async function newParticipant(ref, scopes) {
  await call('POST', '/api/participants', { as: R, body: { ref, adultConfirmed: true } });
  for (const scope of scopes) await call('POST', `/api/participants/${ref}/consents/record-signed`, { as: R, body: { scope, signedFormReference: true } });
}
const previewOf = (ref, body) => call('POST', `/api/participants/${ref}/imports/preview`, { as: R, body: { recordType: 'annotations', format: 'csv', ...body } });
const commit = (ref, previewId) => call('POST', `/api/participants/${ref}/imports/commit`, { as: R, body: { previewId } });
const HEAD = 'participant_ref,entry_id,type,value,date,recorded_at,corrects';
// Detects LH or hormonal-medication CONTENT however the type was formatted (case, spaces, hyphens). Used to verify
// absence after withdrawal. It deliberately does not match the scope names "lh_tests" / "hormonal_context" or the
// reason codes, which are kept.
// Every string VALUE (parsed, so tabs and newlines are real characters) is checked against these patterns.
const LH_VALUE = /^\s*lh[\s_-]*test\s*$/i, HORMONAL_VALUE = /^\s*hormonal[\s_-]*medication\s*$/i;
function strings(v, out = []) { if (typeof v === 'string') out.push(v); else if (Array.isArray(v)) v.forEach(x => strings(x, out)); else if (v && typeof v === 'object') Object.values(v).forEach(x => strings(x, out)); return out; }
const parsedRows = (sql, ref) => store.db.prepare(sql).all(pid(ref)).map(r => JSON.parse(Object.values(r)[0] ?? 'null'));
const dbValues = ref => strings([parsedRows('SELECT raw_json FROM quarantine WHERE participant_id = ?', ref), parsedRows('SELECT data_json FROM annotations WHERE participant_id = ?', ref), parsedRows('SELECT payload_json FROM previews WHERE participant_id = ?', ref)]);
const has = (values, re) => values.some(v => re.test(v));
const exportValues = text => strings(JSON.parse(text));

/* ---------- 1. Optional-consent withdrawal uses a canonical annotation type ---------- */
{
  const ref = 'P-F1-0001';
  await newParticipant(ref, ['core_research', 'lh_tests', 'hormonal_context']);
  // Rows whose TYPE is formatted with whitespace or case differences. Some are valid; some are quarantined for another
  // reason (an invalid date or value) while consent was present, so their cells are kept in quarantine.
  const rows = [HEAD,
    `${ref},${ref}-l1, lh_test ,positive,2026-01-18,2026-01-18T09:00:00Z,`,       // valid, padded type
    `${ref},${ref}-l2, lh_test ,negative,2026-13-40,2026-01-19T09:00:00Z,`,       // padded type, invalid date → quarantine
    `${ref},${ref}-l3,LH_TEST,maybe,2026-01-20,2026-01-20T09:00:00Z,`,            // upper case, invalid value → quarantine
    `${ref},${ref}-h1, hormonal_medication ,yes,2026-13-40,2026-01-18T09:00:00Z,`, // padded type, invalid date → quarantine
    `${ref},${ref}-h2,Hormonal_Medication,yes,2026-01-21,2026-01-21T09:00:00Z,`,   // mixed case, valid
    `${ref},${ref}-b1,bleeding,period_start,2026-01-05,2026-01-05T09:00:00Z,`].join('\n');
  const pv = await previewOf(ref, { content: rows });
  await commit(ref, pv.json.previewId);
  const json = JSON.stringify({ records: [{ participant_ref: ref, entry_id: `${ref}-l4`, type: '\tlh_test\n', value: 'positive', date: 'not-a-date', recorded_at: '2026-01-22T09:00:00Z' }] });
  const pj = await call('POST', `/api/participants/${ref}/imports/preview`, { as: R, body: { recordType: 'annotations', format: 'json', content: json } });
  await commit(ref, pj.json.previewId);
  // A pending (uncommitted) preview that also holds an LH row with odd formatting.
  await previewOf(ref, { content: [HEAD, `${ref},${ref}-l5, Lh_Test ,positive,2026-02-30,2026-02-01T09:00:00Z,`].join('\n') });
  check('1 setup: LH/hormonal content with odd type formatting is present while consent is given', has(dbValues(ref), LH_VALUE) && has(dbValues(ref), HORMONAL_VALUE) && dbValues(ref).includes('\tlh_test\n'));
  await call('POST', `/api/participants/${ref}/consents`, { as: R, body: { scope: 'lh_tests', granted: false } });
  const afterLh = dbValues(ref);
  check('1 withdrawing LH consent removes every LH record, whatever its type formatting (quarantine, annotations, previews)', !has(afterLh, LH_VALUE), JSON.stringify(afterLh.filter(v => LH_VALUE.test(v))));
  check('1 ... hormonal records are untouched by the LH withdrawal', has(afterLh, HORMONAL_VALUE));
  const ex1 = await call('GET', `/api/participants/${ref}/export`, { as: R });
  check('1 ... and the export contains no LH record', ex1.status === 200 && !has(exportValues(ex1.text), LH_VALUE));
  await call('POST', `/api/participants/${ref}/consents`, { as: R, body: { scope: 'hormonal_context', granted: false } });
  const afterH = dbValues(ref);
  check('1 withdrawing hormonal consent removes every hormonal-medication record, whatever its formatting', !has(afterH, HORMONAL_VALUE), JSON.stringify(afterH.filter(v => HORMONAL_VALUE.test(v))));
  const ex2 = await call('GET', `/api/participants/${ref}/export`, { as: R });
  check('1 ... and the export contains no hormonal record', ex2.status === 200 && !has(exportValues(ex2.text), HORMONAL_VALUE));
  check('1 control: the bleeding entry is kept', store.annotations(pid(ref)).some(a => a.entryId === `${ref}-b1`));
  check('1 the stored annotation and quarantine rows carry a canonical type', store.db.prepare("SELECT COUNT(*) AS n FROM pragma_table_info('quarantine') WHERE name = 'canonical_type'").get().n === 1
    && store.annotations(pid(ref)).every(a => a.type === a.type.trim().toLowerCase()));
}
{
  // Without consent, a differently formatted LH or hormonal type must still be recognised, so its cells are not kept.
  const ref = 'P-F1-0002';
  await newParticipant(ref, ['core_research']);
  const pv = await previewOf(ref, { content: [HEAD, `${ref},${ref}-l1,LH_TEST,positive,2026-01-18,2026-01-18T09:00:00Z,`, `${ref},${ref}-l2, Lh-Test ,positive,2026-01-19,2026-01-19T09:00:00Z,`,
    `${ref},${ref}-h1,HORMONAL_MEDICATION,yes,2026-01-18,2026-01-18T09:00:00Z,`, `${ref},${ref}-b1,bleeding,period_start,2026-01-05,2026-01-05T09:00:00Z,`].join('\n') });
  const saved = dbValues(ref);
  check('1 unconsented: a saved preview keeps no LH/hormonal cells, whatever the type formatting', !has(saved, LH_VALUE) && !has(saved, HORMONAL_VALUE), JSON.stringify(saved.filter(v => LH_VALUE.test(v) || HORMONAL_VALUE.test(v))));
  check('1 unconsented: the rows are reported with the consent reason (recognised as LH/hormonal)', pv.json.quarantined.filter(q => q.reasons.includes('lh_tests_not_consented')).length === 2 && pv.json.quarantined.some(q => q.reasons.includes('hormonal_context_not_consented')), JSON.stringify(pv.json.quarantined));
  await commit(ref, pv.json.previewId);
  const ex = await call('GET', `/api/participants/${ref}/export`, { as: R });
  check('1 unconsented: neither quarantine nor export holds LH/hormonal cells', ![...dbValues(ref), ...exportValues(ex.text)].some(v => LH_VALUE.test(v) || HORMONAL_VALUE.test(v)));
}

/* ---------- 2. Explicit, audited reimport under current consent ---------- */
{
  const ref = 'P-F2-0001';
  await newParticipant(ref, ['core_research']);
  const file = [HEAD, `${ref},${ref}-b1,bleeding,period_start,2026-01-05,2026-01-05T09:00:00Z,`, `${ref},${ref}-l1,lh_test,positive,2026-01-18,2026-01-18T09:00:00Z,`].join('\n');
  const first = await previewOf(ref, { content: file });
  await commit(ref, first.json.previewId);
  check('2 setup: without LH consent the LH row is rejected and only the bleeding entry is stored', store.annotations(pid(ref)).length === 1);
  await call('POST', `/api/participants/${ref}/consents/record-signed`, { as: R, body: { scope: 'lh_tests', signedFormReference: true } });
  const again = await previewOf(ref, { content: file });
  check('2 a plain re-upload is still recognised as a duplicate (nothing happens implicitly) and says a reimport is available', again.json?.duplicateBatch === true && again.json?.reimportAvailable === true, JSON.stringify(again.json).slice(0, 200));
  const noReason = await previewOf(ref, { content: file, reimport: true });
  check('2 a reimport needs a stated reason code', noReason.status === 400, `${noReason.status}`);
  const re = await previewOf(ref, { content: file, reimport: true, reason: 'consent_granted_after_rejection' });
  check('2 an explicit reimport is revalidated under CURRENT consent: the LH row is now accepted, the stored entry is a duplicate', re.status === 200 && re.json.counts?.accepted === 1 && re.json.counts?.duplicates === 1 && !re.json.duplicateBatch, JSON.stringify(re.json).slice(0, 200));
  const cm = await commit(ref, re.json?.previewId);
  check('2 committing the reimport stores the LH result', cm.status === 200 && store.annotations(pid(ref)).some(a => a.type === 'lh_test'), `${cm.status} ${cm.text.slice(0, 120)}`);
  const audit = store.auditFor(pid(ref)).map(a => a.action + ' ' + (a.detail_json || ''));
  check('2 the reimport is audited (preview and commit, with the reason)', audit.some(a => /import_reimport_previewed/.test(a) && /consent_granted_after_rejection/.test(a)) && audit.some(a => /import_committed/.test(a) && /"reimport":true/.test(a)), audit.join(' | '));
  const batches = store.batches(pid(ref));
  check('2 the reimport is a separate, marked batch; the original batch is unchanged', batches.length === 2 && batches[0].source_hash === batches[1].source_hash && batches[1].reimport_reason === 'consent_granted_after_rejection' && !batches[0].reimport_reason, JSON.stringify(batches.map(b => [b.id, b.reimport_reason])));
  // Deleted data is NOT restored automatically when consent is granted again.
  await call('POST', `/api/participants/${ref}/consents`, { as: R, body: { scope: 'lh_tests', granted: false } });
  check('2 setup: withdrawing LH consent deleted the LH result', !store.annotations(pid(ref)).some(a => a.type === 'lh_test'));
  await call('POST', `/api/participants/${ref}/consents/record-signed`, { as: R, body: { scope: 'lh_tests', signedFormReference: true } });
  check('2 granting consent again does NOT restore deleted data', !store.annotations(pid(ref)).some(a => a.type === 'lh_test'));
  const re2 = await previewOf(ref, { content: file, reimport: true, reason: 'consent_granted_again' });
  await commit(ref, re2.json?.previewId);
  check('2 ... only an explicit reimport brings it back', store.annotations(pid(ref)).some(a => a.type === 'lh_test'));
  // A participant account cannot reimport.
  await call('POST', '/api/users', { as: ADM, body: { username: 'p_f2', password: PW, role: 'participant', participantRef: ref } });
  const PP = await login('p_f2');
  const pr = await call('POST', `/api/participants/${ref}/imports/preview`, { as: PP, body: { recordType: 'annotations', format: 'csv', content: file, reimport: true, reason: 'consent_granted_again' } });
  check('2 a participant account cannot trigger a reimport', pr.status === 403);
  // A reimport of an unchanged observation-free file adds nothing.
  const re3 = await previewOf(ref, { content: file, reimport: true, reason: 'check_unchanged' });
  check('2 reimporting when nothing is missing adds nothing (all duplicates)', re3.json?.counts?.accepted === 0 && re3.json?.counts?.duplicates === 2);
}

server.close(); done();
