// Integration tests against the real HTTP server on 127.0.0.1 with an in-memory database. Synthetic data only.
// Run: node research/tests/api.test.mjs
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore } from '../server/store.js';
import { createApp, start } from '../server/server.js';
import { participant, OBS_COLUMNS, ANN_COLUMNS } from '../lib/synth.js';
import { FORBIDDEN, LABEL } from '../lib/policy.js';
import { parseCSV } from '../lib/csv.js';
import { check, done, throwsCodeAsync } from './harness.mjs';

const FX = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const logs = [], store = openStore(':memory:');
const app = createApp({ store, settings: { secureCookies: false, idleMs: 30 * 60e3, absoluteMs: 8 * 36e5 }, log: l => logs.push(l) });
const server = createServer(app); await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const responses = [];
async function call(method, path, { body, as, csrf = true, headers = {}, raw = false } = {}) {
  const h = { ...headers }; if (as?.cookie) h.cookie = as.cookie; if (as?.csrf && csrf) h['x-csrf-token'] = as.csrf;
  if (body !== undefined) h['content-type'] = h['content-type'] || 'application/json';
  const r = await fetch(BASE + path, { method, headers: h, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
  const text = await r.text(); responses.push(text);
  return { status: r.status, headers: r.headers, text, json: raw ? null : (() => { try { return JSON.parse(text); } catch { return null; } })() };
}
async function login(username, password) {
  const r = await call('POST', '/api/login', { body: { username, password } });
  return r.status === 200 ? { cookie: r.headers.get('set-cookie').split(';')[0], csrf: r.json.csrf, r } : { r };
}
const csv = (cols, rows) => [cols.join(','), ...rows.map(r => cols.map(c => String(r[c] ?? '')).join(','))].join('\n');
const PW = 'synthetic-pass-123';
store.createUser({ username: 'admin', password: PW, role: 'admin' });
const resA = store.createUser({ username: 'res_a', password: PW, role: 'researcher' });
store.createUser({ username: 'res_b', password: PW, role: 'researcher' });

check('server: refuses to bind to a non-local address', !!(await throwsCodeAsync(() => start({ host: '0.0.0.0', port: 0, db: ':memory:' }), 'local-only')));
const anon = await call('GET', '/api/participants');
check('auth: unauthenticated API request → 401, still labelled', anon.status === 401 && anon.json.label === LABEL);
const sec = await call('GET', '/');
check('static: dashboard served with CSP, nosniff, frame-deny and no-store', sec.status === 200 && /default-src 'self'/.test(sec.headers.get('content-security-policy')) && sec.headers.get('x-content-type-options') === 'nosniff' && sec.headers.get('x-frame-options') === 'DENY');
check('static: path traversal refused', (await call('GET', '/../server/store.js')).status === 404 && (await call('GET', '/%2e%2e/server/store.js')).status === 404);

const A = await login('res_a', PW), B = await login('res_b', PW), ADM = await login('admin', PW);
check('auth: session cookie is HttpOnly and SameSite=Strict', /HttpOnly/.test(A.r.headers.get('set-cookie')) && /SameSite=Strict/.test(A.r.headers.get('set-cookie')));
for (let i = 0; i < 5; i++) await call('POST', '/api/login', { body: { username: 'res_b', password: 'wrong-password-x' } });
check('auth: 5 failed logins lock the account temporarily (even the right password fails)', (await call('POST', '/api/login', { body: { username: 'res_b', password: PW } })).status === 401);
check('auth: unknown user and wrong password give the same answer', (await call('POST', '/api/login', { body: { username: 'nobody', password: PW } })).json.error === 'login_failed');

/* ---- Participants, minors, isolation ---- */
check('participants: creation requires adult confirmation (no minors in this prototype)', (await call('POST', '/api/participants', { as: A, body: { ref: 'P-API-0001' } })).status === 400);
check('participants: researcher creates a pseudonymous participant', (await call('POST', '/api/participants', { as: A, body: { ref: 'P-API-0001', adultConfirmed: true } })).status === 201);
await call('POST', '/api/participants', { as: A, body: { ref: 'P-API-0002', adultConfirmed: true } });
check('csrf: a change without the CSRF token is refused', (await call('POST', '/api/participants', { as: A, csrf: false, body: { ref: 'P-API-0003', adultConfirmed: true } })).status === 403);
check('csrf: a cross-origin request is refused', (await call('POST', '/api/participants', { as: A, headers: { origin: 'https://evil.example' }, body: { ref: 'P-API-0003', adultConfirmed: true } })).status === 403);
check('isolation: researcher B cannot see researcher A\'s participant (404, same as not existing)', (await call('GET', '/api/participants/P-API-0001', { as: B })).status === 404 && (await call('GET', '/api/participants', { as: B })).json.participants.length === 0);
check('isolation: an admin manages accounts but cannot read participant data', (await call('GET', '/api/participants/P-API-0001', { as: ADM })).status === 404);
check('roles: a researcher cannot create accounts', (await call('POST', '/api/users', { as: A, body: { username: 'x_user', password: PW, role: 'admin' } })).status === 403);

/* ---- Consent and import ---- */
const p = participant({ ref: 'P-API-0001', seed: 81, rise: 0.5, samplesPerNight: 24, intervalMin: 20, cycleLengths: [30, 29, 31, 30, 28, 30] });
const obsText = csv(OBS_COLUMNS, p.observations), annText = csv(ANN_COLUMNS, p.annotations);
check('consent: import refused without core research consent', (await call('POST', '/api/participants/P-API-0001/imports/preview', { as: A, body: { recordType: 'observations', format: 'csv', content: obsText } })).status === 409);
check('consent: a researcher cannot simply grant consent', (await call('POST', '/api/participants/P-API-0001/consents', { as: A, body: { scope: 'core_research', granted: true } })).status === 403);
check('consent: a researcher records consent from a signed form (explicit confirmation)', (await call('POST', '/api/participants/P-API-0001/consents/record-signed', { as: A, body: { scope: 'core_research', signedFormReference: true } })).json.consents.core_research === true);
const pv = await call('POST', '/api/participants/P-API-0001/imports/preview', { as: A, body: { recordType: 'observations', format: 'csv', filename: 'jane-doe-1990.csv', content: obsText } });
check('import: preview reports counts and stores nothing yet', pv.status === 200 && pv.json.counts.accepted === p.observations.length && store.observations(store.participantByRef('P-API-0001').id).length === 0, JSON.stringify(pv.json?.counts));
check('import: a filename that looks like a name is never stored or echoed', !JSON.stringify(store.batches(1)).includes('jane') && !pv.text.includes('jane'));
check('import: only the researcher who made a preview can commit it', (await call('POST', '/api/participants/P-API-0001/imports/commit', { as: B, body: { previewId: pv.json.previewId } })).status === 404);
const cm = await call('POST', '/api/participants/P-API-0001/imports/commit', { as: A, body: { previewId: pv.json.previewId } });
check('import: commit stores the observations', cm.status === 200 && store.observations(1).length === p.observations.length);
const again = await call('POST', '/api/participants/P-API-0001/imports/preview', { as: A, body: { recordType: 'observations', format: 'csv', content: obsText } });
check('import: re-uploading the same file is recognised as a duplicate batch', again.json.duplicateBatch === true && again.json.counts.accepted === 0);
const apv = await call('POST', '/api/participants/P-API-0001/imports/preview', { as: A, body: { recordType: 'annotations', format: 'csv', content: annText } });
await call('POST', '/api/participants/P-API-0001/imports/commit', { as: A, body: { previewId: apv.json.previewId } });
const miss = await call('POST', '/api/participants/P-API-0001/imports/preview', { as: A, body: { recordType: 'observations', format: 'csv', content: readFileSync(join(FX, 'missing-timestamps-units.csv'), 'utf8').replace(/P-SYN-0001/g, 'P-API-0001') } });
check('import: suspicious rows are reported for quarantine with reasons', miss.json.counts.quarantined === 4 && miss.json.quarantined.every(q => q.reasons.length));
await call('POST', '/api/participants/P-API-0001/imports/commit', { as: A, body: { previewId: miss.json.previewId } });
check('import: quarantined rows are kept with their original cells (researcher view)', (await call('GET', '/api/participants/P-API-0001/quarantine', { as: A })).json.quarantine.length >= 4);
check('import: corrupted file → clear error', (await call('POST', '/api/participants/P-API-0001/imports/preview', { as: A, body: { recordType: 'observations', format: 'csv', content: 'a\n"x' } })).json.error === 'unterminated_quote');
check('import: oversized body refused (413) and non-JSON refused (415)', (await call('POST', '/api/participants/P-API-0001/imports/preview', { as: A, body: JSON.stringify({ content: 'x'.repeat(8 * 1024 * 1024) }) })).status === 413
  && (await call('POST', '/api/participants/P-API-0001/imports/preview', { as: A, body: 'a=b', headers: { 'content-type': 'text/plain' } })).status === 415);

/* ---- Features and analysis ---- */
for (const bad of ['contraception', 'fertile_window', 'safe_days', 'conception_timing'])
  check(`features: "${bad}" cannot be enabled through the API`, (await call('POST', '/api/participants/P-API-0001/features', { as: A, body: { name: bad, enabled: true } })).json.error === 'feature_prohibited');
const off = await call('GET', '/api/participants/P-API-0001/analysis', { as: A });
check('analysis: experimental layers are off by default', off.json.estimates.status === 'disabled' && off.json.forecasts.status === 'disabled' && off.json.label === LABEL);
await call('POST', '/api/participants/P-API-0001/features', { as: A, body: { name: 'experimental_shift', enabled: true } });
await call('POST', '/api/participants/P-API-0001/features', { as: A, body: { name: 'experimental_forecast', enabled: true } });
const on = await call('GET', '/api/participants/P-API-0001/analysis?asOf=2026-07-20T12:00:00Z', { as: A });
check('analysis: once enabled, estimates are experimental with reasons and uncertainty', Array.isArray(on.json.estimates) && on.json.estimates.every(e => e.experimental && e.reasons.length) && on.json.forecasts.layer === 'forecast', JSON.stringify(on.json.forecasts).slice(0, 200));
check('analysis: observed, descriptive, estimate and forecast layers are separate', ['observed', 'descriptive', 'estimates', 'forecasts', 'provenance'].every(k => k in on.json));
const runs1 = (await call('GET', '/api/participants/P-API-0001/runs', { as: A })).json.runs.length;
await call('GET', '/api/participants/P-API-0001/analysis?asOf=2026-07-20T12:00:00Z', { as: A });
const runs2 = (await call('GET', '/api/participants/P-API-0001/runs', { as: A })).json.runs.length;
await call('GET', '/api/participants/P-API-0001/analysis?asOf=2026-05-20T12:00:00Z', { as: A });
const runs3 = (await call('GET', '/api/participants/P-API-0001/runs', { as: A })).json.runs;
check('provenance: identical analysis is not duplicated; a different cutoff adds versions without overwriting', runs1 > 0 && runs2 === runs1 && runs3.length > runs1 && runs3.every(r => r.input_hash && r.config_hash && r.algorithm_version), `${runs1} ${runs2} ${runs3.length}`);
const obs1 = store.observations(1)[0].id;
await call('POST', '/api/participants/P-API-0001/corrections', { as: A, body: { observationId: obs1, action: 'exclude', reason: 'sensor_check' } });
check('corrections: exclusion is a reversible correction; the raw row is unchanged', store.observations(1)[0].excludedBy === 'correction' && store.observations(1)[0].valueC != null);
await call('POST', '/api/participants/P-API-0001/corrections', { as: A, body: { observationId: obs1, action: 'restore', reason: 'sensor_check' } });
check('corrections: restore reverses it', store.observations(1)[0].excludedBy === null);
check('corrections: cannot target another participant\'s observation', (await call('POST', '/api/participants/P-API-0002/corrections', { as: A, body: { observationId: obs1, action: 'exclude', reason: 'sensor_check' } })).status === 404);

/* ---- Participant account ---- */
await call('POST', '/api/users', { as: ADM, body: { username: 'p_api_1', password: PW, role: 'participant', participantRef: 'P-API-0001' } });
const PP = await login('p_api_1', PW);
const mine = await call('GET', '/api/participants/P-API-0001/analysis', { as: PP });
check('participant: sees own observations but no experimental estimates or forecasts', mine.status === 200 && mine.json.estimates.status === 'not_shown_to_participants' && mine.json.forecasts.status === 'not_shown_to_participants');
check('participant: cannot import, cannot see quarantine, cannot see another participant', (await call('POST', '/api/participants/P-API-0001/imports/preview', { as: PP, body: { recordType: 'observations', format: 'csv', content: obsText } })).status === 403
  && (await call('GET', '/api/participants/P-API-0001/quarantine', { as: PP })).status === 403 && (await call('GET', '/api/participants/P-API-0002', { as: PP })).status === 404);

/* ---- Export ---- */
const ej = await call('GET', '/api/participants/P-API-0001/export', { as: A });
check('export: JSON export carries the label and source values', ej.json.label === LABEL && ej.json.observations[0].sourceUnit && ej.json.observations.length === p.observations.length + 1 /* + the one valid row of the missing-fields fixture */, `${ej.status} ${ej.text.slice(0,200)}`);
const inj = participant({ ref: 'P-API-0002', seed: 2, samplesPerNight: 6, intervalMin: 10, cycleLengths: [1] }).observations.map(o => ({ ...o, firmware: '-2+3' }));
await call('POST', '/api/participants/P-API-0002/consents/record-signed', { as: A, body: { scope: 'core_research', signedFormReference: true } });
const ipv = await call('POST', '/api/participants/P-API-0002/imports/preview', { as: A, body: { recordType: 'observations', format: 'csv', content: csv(OBS_COLUMNS, inj) } });
await call('POST', '/api/participants/P-API-0002/imports/commit', { as: A, body: { previewId: ipv.json.previewId } });
const ec = await call('GET', '/api/participants/P-API-0002/export?format=csv', { as: A, raw: true });
const rows = parseCSV(ec.text.split('\r\n').slice(1).join('\r\n'));
check('export: CSV starts with the label line', ec.text.startsWith(`# ${LABEL}`));
check('export: a formula-like cell is neutralised in the CSV export', rows.length > 0 && rows.every(r => r.record.firmware === "'-2+3"), rows[0]?.record?.firmware);

/* ---- Unsafe output suppression across every response ---- */
const allText = responses.join('\n').split(LABEL).join(' ');
const hits = FORBIDDEN.filter(([, re]) => re.test(allText)).map(([c]) => c);
check(`policy: no forbidden phrase in any of ${responses.length} API responses or exports`, hits.length === 0, hits.join(','));
check('policy: every JSON response carries the persistent label', responses.filter(t => t.startsWith('{')).every(t => JSON.parse(t).label === LABEL));

/* ---- Logs ---- */
const logText = logs.join('\n');
check('logs: no participant references, values, filenames, tokens or bodies in application logs', !/P-API-000|33\.\d|jane|rs_session|synthetic-pass|csrf/i.test(logText) && logs.length > 20, logs.find(l => /P-API|33\./.test(l)));

/* ---- Deletion ---- */
const pid = store.participantByRef('P-API-0001').id;
check('delete: requires typing the reference to confirm', (await call('DELETE', '/api/participants/P-API-0001', { as: A, body: {} })).status === 400);
check('delete: another researcher cannot delete it', (await call('DELETE', '/api/participants/P-API-0001', { as: B, body: { confirmRef: 'P-API-0001' } })).status !== 200);
const del = await call('DELETE', '/api/participants/P-API-0001', { as: PP, body: { confirmRef: 'P-API-0001' } });
const left = store.countsFor(pid);
check('delete: the participant can delete their own data', del.status === 200 && del.json.deleted === true);
check('delete: raw AND derived records are gone (observations, annotations, quarantine, corrections, runs, previews, consents, features)', Object.values(left).every(n => n === 0), JSON.stringify(left));
check('delete: the participant account and its sessions are gone', (await call('GET', '/api/me', { as: PP })).status === 401);
const aud = store.auditFor(pid);
check('delete: the audit trail records the deletion without health content or the reference', aud.some(a => a.action === 'participant_deleted') && !JSON.stringify(store.allAudit()).match(/P-API-0001|33\.\d|positive/));
check('delete: the researcher no longer sees it', (await call('GET', '/api/participants/P-API-0001', { as: A })).status === 404);

server.close(); done();
