// Security features required before any real-participant study (research/docs/threat-model.md, "Not yet done"):
// encryption at rest, two-factor sign-in, password change, session list and sign-out of other sessions, encrypted
// backups whose restore re-applies deletions, and backup retention. Written BEFORE the implementation; the failing
// run is committed in research/docs/test-logs/. Synthetic data only. Run: node research/tests/security.test.mjs
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, statSync, readdirSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { check, done, throwsCode, throwsCodeAsync } from './harness.mjs';
import { participant, OBS_COLUMNS, ANN_COLUMNS } from '../lib/synth.js';

const HERE = dirname(fileURLToPath(import.meta.url)), CLI = join(HERE, '..', 'server', 'cli.mjs');
const imp = async p => { try { return await import(p); } catch (e) { return { __missing: e.message }; } };
const storeMod = await import('../server/store.js'), serverMod = await import('../server/server.js');
const { openStore } = storeMod;
const totpMod = await imp('../server/totp.js'), keysMod = await imp('../server/keys.js'), backupMod = await imp('../server/backup.js');
const missing = (m, name) => { if (m.__missing) check(`module ${name} exists`, false, m.__missing); return !!m.__missing; };
missing(totpMod, 'server/totp.js'); missing(keysMod, 'server/keys.js'); missing(backupMod, 'server/backup.js');
const totp = totpMod.totp || (() => '000000');

const PW = 'synthetic-pass-123', DIR = mkdtempSync(join(tmpdir(), 'rs-sec-'));
let clock = Date.parse('2026-03-10T12:00:00Z');
const csv = (cols, rows) => [cols.join(','), ...rows.map(r => cols.map(c => String(r[c] ?? '')).join(','))].join('\n');
const KEY = randomBytes(32), KEY2 = randomBytes(32), BKEY = randomBytes(32);

function serve(store, settings = {}) {
  const logs = [];
  const app = serverMod.createApp({ store, settings: { secureCookies: false, idleMs: 1e12, absoluteMs: 1e12, ...settings }, log: l => logs.push(l), now: () => clock });
  const server = createServer(app);
  return new Promise(r => server.listen(0, '127.0.0.1', () => {
    const BASE = `http://127.0.0.1:${server.address().port}`;
    async function call(method, path, { body, as, csrf = true } = {}) {
      const h = {}; if (as?.cookie) h.cookie = as.cookie; if (as?.csrf && csrf) h['x-csrf-token'] = as.csrf; if (body !== undefined) h['content-type'] = 'application/json';
      const res = await fetch(BASE + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
      const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch { /* not JSON */ }
      return { status: res.status, text, json, cookie: res.headers.get('set-cookie')?.split(';')[0] };
    }
    async function login(username, password = PW, code) {
      const res = await call('POST', '/api/login', { body: { username, password, ...(code !== undefined ? { code } : {}) } });
      return res.status === 200 ? { cookie: res.cookie, csrf: res.json.csrf, res } : { res };
    }
    r({ server, call, login, logs, close: () => new Promise(c => server.close(c)) });
  }));
}

// A small synthetic dataset: two cycles of observations plus bleeding, LH and hormonal annotations.
const REF = 'P-SEC-0001', REF2 = 'P-SEC-0002';
const synth = ref => participant({ ref, seed: 7, cycleLengths: [28, 29], samplesPerNight: 12, intervalMin: 20 });
const lhRows = ref => [
  { participant_ref: ref, entry_id: `${ref}-lh1`, type: 'lh_test', value: 'positive', date: '2026-01-19', recorded_at: '2026-01-19T09:00:00Z', corrects: '' },
  { participant_ref: ref, entry_id: `${ref}-hm1`, type: 'hormonal_medication', value: 'yes', date: '2026-01-20', recorded_at: '2026-01-20T09:00:00Z', corrects: '' }];
async function populate(api, R, ref) {
  const d = synth(ref);
  await api.call('POST', '/api/participants', { as: R, body: { ref, adultConfirmed: true } });
  for (const scope of ['core_research', 'lh_tests', 'hormonal_context']) await api.call('POST', `/api/participants/${ref}/consents/record-signed`, { as: R, body: { scope, signedFormReference: true } });
  const put = async (recordType, content) => { const pv = await api.call('POST', `/api/participants/${ref}/imports/preview`, { as: R, body: { recordType, format: 'csv', filename: `${recordType}.csv`, content } });
    const c = await api.call('POST', `/api/participants/${ref}/imports/commit`, { as: R, body: { previewId: pv.json?.previewId, recordType, sourceHash: pv.json?.sourceHash } }); return { pv, c }; };
  const o = await put('observations', csv(OBS_COLUMNS, d.observations));
  // One malformed observation row so the quarantine holds verbatim cells too.
  const bad = { ...d.observations[0], timestamp_utc: '2026-02-30T25:00:00Z', firmware: 'QUARANTINED-FW-9' };
  const q = await put('observations', csv(OBS_COLUMNS, [bad]));
  const a = await put('annotations', csv(ANN_COLUMNS, [...d.annotations, ...lhRows(ref)]));
  await api.call('POST', `/api/participants/${ref}/features`, { as: R, body: { name: 'experimental_shift', enabled: true } });
  return { d, o, q, a };
}
// Strings that exist only inside sensitive payloads (never in pseudonymous refs, scope names or reason codes).
const MARKERS = [['manufacturer', /SyntheticCo/], ['serial', /SEC-000[12]-dev1/], ['entry id', /SEC-000[12]-(e\d|lh1|hm1)/], ['LH type', /lh_test(?!s)/], ['hormonal type', /hormonal_medication/],
  ['LH value', /positive/], ['bleeding value', /period_start/], ['cycle start date', /2026-02-0[2-6]/], ['quarantined cell', /QUARANTINED-FW-9/], ['night label', /2026-01-1\d/]];
const rawBytes = path => ['', '-wal', '-shm'].map(s => existsSync(path + s) ? readFileSync(path + s).toString('latin1') : '').join('\n');
const leaks = text => MARKERS.filter(([, re]) => re.test(text)).map(([n]) => n);
const analysisOf = async (api, R, ref) => { const r = await api.call('GET', `/api/participants/${ref}/analysis?asOf=2026-03-10T00:00:00Z`, { as: R }); return r.json; };
const stripVolatile = a => JSON.stringify(a);

/* =============== 1. Encryption at rest =============== */
let plainAnalysis = null;
{
  // Reference: the same flows on an unencrypted in-memory store.
  const ref = openStore(':memory:', { now: () => clock }); ref.createUser({ username: 'res', password: PW, role: 'researcher' });
  const api = await serve(ref), R = await api.login('res');
  await populate(api, R, REF); plainAnalysis = await analysisOf(api, R, REF); await api.close(); ref.close();
}
const ENC = join(DIR, 'enc.sqlite');
{
  const s = openStore(ENC, { key: KEY, now: () => clock });
  check('encryption: a store opened with a key reports encryption on', s.encrypted === true, String(s.encrypted));
  s.createUser({ username: 'res', password: PW, role: 'researcher' });
  const api = await serve(s), R = await api.login('res');
  const { o, q, a } = await populate(api, R, REF);
  check('encryption: imports still preview and commit', o.c.status === 200 && a.c.status === 200 && o.pv.json?.counts?.accepted > 0, JSON.stringify([o.c.status, a.c.status, o.pv.json?.counts]));
  check('encryption: the malformed row is quarantined with its cells', q.pv.json?.counts?.quarantined === 1, JSON.stringify(q.pv.json?.counts));
  const enc = await analysisOf(api, R, REF);
  check('encryption: analysis is identical to the unencrypted store (same inputs, same outputs, same input hash)', stripVolatile(enc) === stripVolatile(plainAnalysis), `${stripVolatile(enc).length} vs ${stripVolatile(plainAnalysis).length}`);
  // Duplicate and conflict detection still work although the stored keys and fingerprints are keyed hashes.
  const d = synth(REF), sub = d.observations.slice(0, 5), changed = { ...d.observations[6], value: '35.55' };
  const pv = await api.call('POST', `/api/participants/${REF}/imports/preview`, { as: R, body: { recordType: 'observations', format: 'csv', filename: 'again.csv', content: csv(OBS_COLUMNS, [...sub, changed]) } });
  check('encryption: re-sent identical rows are exact duplicates', pv.json?.counts?.duplicates === 5, JSON.stringify(pv.json?.counts));
  check('encryption: a changed reading for a stored timestamp is a conflict (quarantined)', pv.json?.counts?.quarantined === 1 && pv.json.quarantined.some(x => x.reasons.some(r => /conflict/.test(r))), JSON.stringify(pv.json?.quarantined));
  const dupBatch = await api.call('POST', `/api/participants/${REF}/imports/preview`, { as: R, body: { recordType: 'observations', format: 'csv', filename: 'x.csv', content: csv(OBS_COLUMNS, d.observations) } });
  check('encryption: the same source file is still recognised as already imported', dupBatch.json?.duplicateBatch === true);
  // Corrections and quarantine read back.
  const exp1 = await api.call('GET', `/api/participants/${REF}/export?format=json`, { as: R });
  const obsId = exp1.json?.observations?.[3]?.id;
  const cor = await api.call('POST', `/api/participants/${REF}/corrections`, { as: R, body: { observationId: obsId, action: 'exclude', reason: 'researcher_review' } });
  const exp2 = await api.call('GET', `/api/participants/${REF}/export?format=json`, { as: R });
  check('encryption: corrections apply to encrypted observations', cor.status === 200 && !!exp2.json?.observations?.find(x => x.id === obsId)?.excludedBy);
  const qr = await api.call('GET', `/api/participants/${REF}/quarantine`, { as: R });
  check('encryption: quarantined verbatim cells are readable by the researcher', qr.json?.quarantine?.some(x => JSON.stringify(x.verbatimSource || {}).includes('QUARANTINED-FW-9')));
  check('encryption: export contains the decrypted annotations', exp2.json?.annotations?.some(x => x.type === 'lh_test'));
  // Optional-consent withdrawal still purges by canonical type (now a keyed index).
  const before = s.countsFor(s.participantByRef(REF).id).annotations;
  await api.call('POST', `/api/participants/${REF}/consents`, { as: R, body: { scope: 'lh_tests', granted: false } });
  const exp3 = await api.call('GET', `/api/participants/${REF}/export?format=json`, { as: R });
  check('encryption: withdrawing LH consent still deletes LH annotations', s.countsFor(s.participantByRef(REF).id).annotations === before - 1 && !exp3.json.annotations.some(x => x.type === 'lh_test') && exp3.json.annotations.some(x => x.type === 'hormonal_medication'));
  // An MFA secret stored in this database is encrypted too.
  const uid = s.db.prepare("SELECT id FROM users WHERE username = 'res'").get().id;
  const e = s.mfaBegin?.(uid); globalThis.__encSecret = e?.secret;
  await api.close(); s.close();
  const raw = rawBytes(ENC);
  check('encryption: no sensitive payload is readable in the database files (main, WAL, SHM)', leaks(raw).length === 0, leaks(raw).join(', '));
  check('encryption: the MFA secret is not stored in plaintext', !!globalThis.__encSecret && !raw.includes(globalThis.__encSecret));
  check('encryption: the database file is still a valid SQLite file (metadata such as refs stays queryable)', raw.startsWith('SQLite format 3') && raw.includes(REF));
}
{
  const noKey = throwsCode(() => openStore(ENC), 'db_key_required');
  check('encryption: opening an encrypted database without a key is refused (db_key_required)', !!noKey, String(noKey));
  const wrong = throwsCode(() => openStore(ENC, { key: KEY2 }), 'db_key_invalid');
  check('encryption: opening it with the wrong key is refused (db_key_invalid)', !!wrong);
  const bad = throwsCode(() => openStore(ENC, { key: Buffer.alloc(16) }), 'key_invalid');
  check('encryption: a key that is not 32 bytes is refused (key_invalid)', !!bad);
}
// Key rotation re-wraps the data key; the data is unchanged.
{
  let ok = false; try { storeMod.rotateKey(ENC, KEY, KEY2); ok = true; } catch (e) { check('rotation: rotateKey is available', false, e.message); }
  if (ok) {
    check('rotation: the old key no longer opens the database', !!throwsCode(() => openStore(ENC, { key: KEY }), 'db_key_invalid'));
    const s = openStore(ENC, { key: KEY2, now: () => clock });
    check('rotation: the new key opens it and the data is intact', s.observations(s.participantByRef(REF).id).length > 0 && s.annotations(s.participantByRef(REF).id).some(x => x.type === 'bleeding'));
    s.close(); storeMod.rotateKey(ENC, KEY2, KEY); // back to KEY for the tests below
  }
}
// An existing unencrypted database is encrypted in place when it is first opened with a key.
{
  const P = join(DIR, 'legacy.sqlite');
  const s = openStore(P, { now: () => clock }); s.createUser({ username: 'res', password: PW, role: 'researcher' });
  const api = await serve(s), R = await api.login('res'); await populate(api, R, REF); const before = await analysisOf(api, R, REF); await api.close(); s.close();
  check('upgrade: the unencrypted database really does contain readable payloads (control)', leaks(rawBytes(P)).length > 3);
  const s2 = openStore(P, { key: KEY, now: () => clock }); s2.close();
  check('upgrade: after opening with a key, no sensitive payload is readable in the files', leaks(rawBytes(P)).length === 0, leaks(rawBytes(P)).join(', '));
  const s3 = openStore(P, { key: KEY, now: () => clock }); s3.createUser?.({ username: 'res2', password: PW, role: 'researcher' }); s3.assign(s3.db.prepare("SELECT id FROM users WHERE username='res2'").get().id, s3.participantByRef(REF).id);
  const api3 = await serve(s3), R3 = await api3.login('res2'); const after = await analysisOf(api3, R3, REF); await api3.close(); s3.close();
  check('upgrade: the analysis is unchanged after encryption', stripVolatile(after) === stripVolatile(before));
  check('upgrade: the upgraded database now refuses to open without the key', !!throwsCode(() => openStore(P), 'db_key_required'));
}
// The server refuses to start on a file database without a key, unless explicitly allowed (unsupported, for tests).
{
  const P = join(DIR, 'start.sqlite');
  const e = await throwsCodeAsync(() => serverMod.start({ host: '127.0.0.1', port: 0, db: P }), 'db_key_required');
  check('server: refuses to start on a file database without an encryption key', !!e);
  let started = null; try { started = await serverMod.start({ host: '127.0.0.1', port: 0, db: P, dbKey: KEY, requireMfaRoles: [] }); } catch (err) { check('server: starts with a key', false, err.message); }
  if (started) { check('server: starts with a key and encrypts', started.store.encrypted === true); await new Promise(r => started.server.close(r)); started.store.close(); }
}
// Key files: generated with owner-only permissions; looser permissions and wrong lengths are refused.
{
  if (!keysMod.__missing) {
    const f = join(DIR, 'db.key'); keysMod.writeKeyFile(f, keysMod.generateKey());
    check('keys: a generated key file is readable by its owner only (0600)', (statSync(f).mode & 0o777) === 0o600, (statSync(f).mode & 0o777).toString(8));
    check('keys: the key file loads as 32 bytes', keysMod.loadKeyFile(f).length === 32);
    chmodSync(f, 0o644);
    check('keys: a group- or world-readable key file is refused (key_file_permissions)', !!throwsCode(() => keysMod.loadKeyFile(f), 'key_file_permissions'));
    const g = join(DIR, 'short.key'); writeFileSync(g, Buffer.alloc(16).toString('base64'), { mode: 0o600 });
    check('keys: a key that is not 32 bytes is refused (key_invalid)', !!throwsCode(() => keysMod.loadKeyFile(g), 'key_invalid'));
    const env = serverMod.settingsFromEnv({ RESEARCH_DB_KEY_FILE: (keysMod.writeKeyFile(join(DIR, 'env.key'), KEY), join(DIR, 'env.key')) });
    check('settings: RESEARCH_DB_KEY_FILE provides the database key', Buffer.isBuffer(env.dbKey) && env.dbKey.equals(KEY));
    check('settings: MFA is required for admins and researchers by default', JSON.stringify(serverMod.settingsFromEnv({}).requireMfaRoles) === '["admin","researcher"]', JSON.stringify(serverMod.settingsFromEnv({}).requireMfaRoles));
    check('settings: RESEARCH_REQUIRE_MFA=0 turns the requirement off (synthetic demo only)', JSON.stringify(serverMod.settingsFromEnv({ RESEARCH_REQUIRE_MFA: '0' }).requireMfaRoles) === '[]');
  }
}

/* =============== 2. Two-factor sign-in (TOTP, RFC 6238) =============== */
{
  // RFC 6238 appendix B test vectors (SHA-1, 8 digits, secret "12345678901234567890").
  const secret = totpMod.base32Encode ? totpMod.base32Encode(Buffer.from('12345678901234567890')) : '';
  const vectors = [[59, '94287082'], [1111111109, '07081804'], [1111111111, '14050471'], [1234567890, '89005924'], [2000000000, '69279037'], [20000000000, '65353130']];
  check('totp: matches the RFC 6238 test vectors', vectors.every(([t, v]) => totp(secret, t * 1000, { digits: 8 }) === v), vectors.map(([t]) => totp(secret, t * 1000, { digits: 8 })).join(','));
  check('totp: base32 round trip', !!totpMod.base32Decode && totpMod.base32Decode(secret).toString() === '12345678901234567890');
}
{
  const s = openStore(':memory:', { now: () => clock });
  const resId = s.createUser({ username: 'res', password: PW, role: 'researcher' });
  const lockId = s.createUser({ username: 'res_lock', password: PW, role: 'researcher' });
  s.createUser({ username: 'admin', password: PW, role: 'admin' });
  const pid = s.createParticipant({ ref: 'P-MFA-0001', adultConfirmed: true }, resId);
  const partId = s.createUser({ username: 'part', password: PW, role: 'participant', participantId: pid });
  const api = await serve(s, { requireMfaRoles: ['admin', 'researcher'] });
  const noMfa = await api.login('res');
  check('mfa: a researcher without two-factor set up cannot sign in when it is required (403 mfa_enrolment_required)', noMfa.res.status === 403 && noMfa.res.json?.error === 'mfa_enrolment_required', `${noMfa.res.status} ${noMfa.res.json?.error}`);
  check('mfa: the refused sign-in sets no session cookie', !noMfa.res.cookie || /rs_session=x?;?$/.test(noMfa.res.cookie));
  // Operator enrolment (CLI path): begin + confirm with a valid code.
  const e = s.mfaBegin?.(resId) || {};
  check('mfa: enrolment returns a base32 secret and an otpauth URI', /^[A-Z2-7]{32}$/.test(e.secret || '') && /^otpauth:\/\/totp\/[^?]+\?secret=[A-Z2-7]{32}&issuer=/.test(e.uri || ''), JSON.stringify(e));
  check('mfa: an unconfirmed enrolment does not turn two-factor on', !s.mfaStatus?.(resId)?.enabled);
  const wrongConfirm = s.mfaConfirm?.(resId, '000000');
  check('mfa: confirming with a wrong code fails', wrongConfirm?.ok === false);
  const conf = s.mfaConfirm?.(resId, totp(e.secret, clock)) || {};
  check('mfa: confirming with a valid code enables it and returns 10 one-time recovery codes', conf.ok === true && conf.recoveryCodes?.length === 10 && conf.recoveryCodes.every(c => /^\d{5}-\d{5}-\d{5}-\d{5}$/.test(c)), JSON.stringify(conf));
  const recoveryRaw = JSON.stringify(s.db.prepare('SELECT * FROM users WHERE id = ?').get(resId), (k, v) => typeof v === 'bigint' ? Number(v) : v instanceof Uint8Array ? '' : v);
  check('mfa: recovery codes are stored only as hashes', !conf.recoveryCodes?.some(c => recoveryRaw.includes(c) || recoveryRaw.includes(c.replace(/-/g, ''))));
  clock += 30e3;
  const noCode = await api.login('res');
  check('mfa: correct password without a code → 401 mfa_code_required, no session', noCode.res.status === 401 && noCode.res.json?.error === 'mfa_code_required' && !noCode.cookie, `${noCode.res.status} ${noCode.res.json?.error}`);
  const wrongCode = await api.login('res', PW, '123456' === totp(e.secret, clock) ? '654321' : '123456');
  check('mfa: a wrong code → 401 login_failed', wrongCode.res.status === 401 && wrongCode.res.json?.error === 'login_failed');
  const badPwGoodCode = await api.login('res', 'wrong-password-xyz', totp(e.secret, clock));
  check('mfa: a valid code with a wrong password → 401 login_failed (no hint)', badPwGoodCode.res.status === 401 && badPwGoodCode.res.json?.error === 'login_failed');
  const code = totp(e.secret, clock), good = await api.login('res', PW, code);
  check('mfa: password + valid code → signed in', good.res.status === 200 && !!good.cookie);
  const replay = await api.login('res', PW, code);
  check('mfa: the same code cannot be used twice (replay refused)', replay.res.status === 401);
  clock += 30e3;
  const next = await api.login('res', PW, totp(e.secret, clock));
  check('mfa: the next time step\'s code works', next.res.status === 200);
  clock += 30e3;
  const rc = conf.recoveryCodes?.[0], viaRecovery = await api.login('res', PW, rc);
  check('mfa: a recovery code signs in once', viaRecovery.res.status === 200);
  const rcAgain = await api.login('res', PW, rc);
  check('mfa: a used recovery code is refused', rcAgain.res.status === 401);
  check('mfa: the status shows 9 recovery codes left', s.mfaStatus?.(resId)?.recoveryCodesLeft === 9, JSON.stringify(s.mfaStatus?.(resId)));
  // Wrong codes count towards the account lockout.
  const e2 = s.mfaBegin?.(lockId) || {}; s.mfaConfirm?.(lockId, totp(e2.secret, clock)); clock += 30e3;
  for (let i = 0; i < 5; i++) await api.login('res_lock', PW, '000001');
  const afterLock = await api.login('res_lock', PW, totp(e2.secret, clock));
  check('mfa: five wrong codes lock the account (even a valid code is then refused)', afterLock.res.status === 401);
  // A participant (MFA optional) signs in with a password, can enrol themselves through the API, and can turn it off.
  const P1 = await api.login('part');
  check('mfa: a participant can sign in without two-factor (optional for participants)', P1.res.status === 200);
  const setupBad = await api.call('POST', '/api/account/mfa/setup', { as: P1, body: { password: 'wrong-password-xyz' } });
  check('mfa: self-enrolment needs the current password (401 password_incorrect)', setupBad.status === 401 && setupBad.json?.error === 'password_incorrect', `${setupBad.status} ${setupBad.json?.error}`);
  const setup = await api.call('POST', '/api/account/mfa/setup', { as: P1, body: { password: PW } });
  check('mfa: self-enrolment returns a secret and otpauth URI', setup.status === 200 && /^[A-Z2-7]{32}$/.test(setup.json?.secret || '') && /^otpauth:/.test(setup.json?.otpauthUri || ''), `${setup.status} ${setup.text.slice(0, 200)}`);
  const P2 = await api.login('part'); // a second session that should be ended when two-factor is turned on
  const confirm = await api.call('POST', '/api/account/mfa/confirm', { as: P1, body: { code: totp(setup.json?.secret || 'A', clock) } });
  check('mfa: self-enrolment is confirmed with a code and returns recovery codes', confirm.status === 200 && confirm.json?.enabled === true && confirm.json?.recoveryCodes?.length === 10, `${confirm.status} ${confirm.text.slice(0, 200)}`);
  check('mfa: turning on two-factor ends the account\'s other sessions', (await api.call('GET', '/api/me', { as: P2 })).status === 401 && (await api.call('GET', '/api/me', { as: P1 })).status === 200);
  clock += 30e3;
  check('mfa: after self-enrolment, sign-in needs a code', (await api.login('part')).res.json?.error === 'mfa_code_required');
  const disNoCode = await api.call('POST', '/api/account/mfa/disable', { as: P1, body: { password: PW } });
  check('mfa: turning it off needs password and a code', disNoCode.status === 401);
  const dis = await api.call('POST', '/api/account/mfa/disable', { as: P1, body: { password: PW, code: totp(setup.json?.secret || 'A', clock) } });
  check('mfa: a participant can turn it off with password and code', dis.status === 200 && !s.mfaStatus?.(partId)?.enabled);
  const R = good.cookie ? good : next;
  clock += 30e3;
  const resDis = await api.call('POST', '/api/account/mfa/disable', { as: R, body: { password: PW, code: totp(e.secret, clock) } });
  check('mfa: a researcher cannot turn it off while it is required (403 mfa_required_for_role)', resDis.status === 403 && resDis.json?.error === 'mfa_required_for_role', `${resDis.status} ${resDis.json?.error}`);
  const st = await api.call('GET', '/api/account', { as: R });
  check('mfa: the account endpoint shows two-factor status without the secret', st.status === 200 && st.json?.mfa?.enabled === true && st.json.mfa.required === true && !st.text.includes(e.secret), st.text.slice(0, 200));
  const everything = api.logs.join('\n') + JSON.stringify(s.allAudit());
  check('mfa: no secret, code or recovery code appears in logs or the audit trail', ![e.secret, setup.json?.secret, ...(conf.recoveryCodes || []), code].filter(Boolean).some(x => everything.includes(x)));
  check('mfa: sign-in outcomes are audited (codes only)', ['login_mfa_required', 'login_failed', 'mfa_enabled', 'mfa_disabled'].every(a => s.allAudit().some(r => r.action === a)), [...new Set(s.allAudit().map(r => r.action))].join(','));
  await api.close(); s.close();
}

/* =============== 3. Password change, session list, sign out other sessions =============== */
{
  const s = openStore(':memory:', { now: () => clock });
  s.createUser({ username: 'res', password: PW, role: 'researcher' });
  const api = await serve(s);
  const A = await api.login('res'), B = await api.login('res'), C = await api.login('res');
  const list = await api.call('GET', '/api/account/sessions', { as: A });
  const sessions = list.json?.sessions || [];
  check('sessions: lists the account\'s sessions, exactly one marked current', list.status === 200 && sessions.length === 3 && sessions.filter(x => x.current).length === 1, `${list.status} ${list.text.slice(0, 200)}`);
  check('sessions: each has a short opaque id and times, never a token', sessions.every(x => /^[0-9a-f]{12}$/.test(x.id) && Number.isFinite(x.createdAt) && Number.isFinite(x.lastSeen)) && !/token/i.test(list.text) && ![A, B, C].some(x => list.text.includes(x.cookie.split('=')[1])));
  const noCsrf = await api.call('POST', '/api/account/sessions/revoke-others', { as: A, csrf: false });
  check('sessions: revoking needs the CSRF token', noCsrf.status === 403);
  const rev = await api.call('POST', '/api/account/sessions/revoke-others', { as: C });
  check('sessions: "sign out other sessions" ends them and keeps this one', rev.status === 200 && rev.json?.ended === 2 && (await api.call('GET', '/api/me', { as: A })).status === 401 && (await api.call('GET', '/api/me', { as: B })).status === 401 && (await api.call('GET', '/api/me', { as: C })).status === 200, `${rev.status} ${rev.text.slice(0, 120)}`);
  const D = await api.login('res');
  const wrong = await api.call('POST', '/api/account/password', { as: C, body: { current: 'not-the-password', next: 'a-brand-new-password-1' } });
  check('password: a wrong current password → 401 password_incorrect', wrong.status === 401 && wrong.json?.error === 'password_incorrect', `${wrong.status} ${wrong.json?.error}`);
  const short = await api.call('POST', '/api/account/password', { as: C, body: { current: PW, next: 'short' } });
  check('password: a new password under 12 characters → 400 password_too_short', short.status === 400 && short.json?.error === 'password_too_short');
  const same = await api.call('POST', '/api/account/password', { as: C, body: { current: PW, next: PW } });
  check('password: the same password → 400 password_unchanged', same.status === 400 && same.json?.error === 'password_unchanged');
  const nameAsPw = await api.call('POST', '/api/account/password', { as: C, body: { current: PW, next: 'res-res-res-res' } });
  check('password: a password containing the username → 400 password_contains_username', nameAsPw.status === 400 && nameAsPw.json?.error === 'password_contains_username', `${nameAsPw.status} ${nameAsPw.json?.error}`);
  const NEW = 'a-brand-new-password-1';
  const okc = await api.call('POST', '/api/account/password', { as: C, body: { current: PW, next: NEW } });
  check('password: change succeeds and ends the other sessions', okc.status === 200 && okc.json?.otherSessionsEnded === 1 && (await api.call('GET', '/api/me', { as: D })).status === 401 && (await api.call('GET', '/api/me', { as: C })).status === 200, `${okc.status} ${okc.text.slice(0, 120)}`);
  check('password: the old password no longer works, the new one does', (await api.login('res')).res.status === 401 && (await api.login('res', NEW)).res.status === 200);
  check('password: the change is audited without any password', s.allAudit().some(r => r.action === 'password_changed') && !JSON.stringify(s.allAudit()).includes(NEW) && !api.logs.join('').includes(NEW));
  // Wrong current passwords count towards the lockout.
  const E = await api.login('res', NEW);
  for (let i = 0; i < 5; i++) await api.call('POST', '/api/account/password', { as: E, body: { current: 'not-the-password', next: 'another-new-password-2' } });
  check('password: five wrong current passwords lock the account', (await api.login('res', NEW)).res.status === 401);
  await api.close(); s.close();
}

/* =============== 4. Encrypted backups, retention and deletion that survives a restore =============== */
if (!backupMod.__missing) {
  const BDIR = join(DIR, 'backups'), LEDGER = join(DIR, 'deletion-ledger.jsonl'), LIVE = join(DIR, 'live.sqlite');
  const s = openStore(LIVE, { key: KEY, ledgerPath: LEDGER, now: () => clock });
  s.createUser({ username: 'res', password: PW, role: 'researcher' });
  const api = await serve(s), R = await api.login('res');
  await populate(api, R, REF); await populate(api, R, REF2);
  const obsCount = s.observations(s.participantByRef(REF).id).length;
  await api.close(); s.close();
  const sameKey = await throwsCodeAsync(() => backupMod.backup({ dbPath: LIVE, dbKey: KEY, backupKey: KEY, dir: BDIR, now: clock }), 'backup_key_must_differ');
  check('backup: the backup key must differ from the database key', !!sameKey);
  const b1 = await backupMod.backup({ dbPath: LIVE, dbKey: KEY, backupKey: BKEY, dir: BDIR, now: clock });
  const braw = readFileSync(b1.file).toString('latin1');
  check('backup: the backup file is encrypted as a whole (no SQLite header, no refs, no payloads)', !braw.includes('SQLite format 3') && !braw.includes('P-SEC') && leaks(braw).length === 0);
  check('backup: the backup file is readable by its owner only (0600)', (statSync(b1.file).mode & 0o777) === 0o600);
  const v = await backupMod.verifyBackup({ file: b1.file, backupKey: BKEY });
  check('backup: verification decrypts it and runs an integrity check', v.ok === true && v.schemaVersion >= 4, JSON.stringify(v));
  // Delete participant 2 after the backup was made.
  clock += 864e5;
  const s2 = openStore(LIVE, { key: KEY, ledgerPath: LEDGER, now: () => clock });
  s2.deleteParticipant(s2.participantByRef(REF2).id, null); s2.close();
  const ledger = readFileSync(LEDGER, 'utf8');
  check('ledger: the deletion is recorded with a random participant id only (no ref, no data)', /"uid":"[0-9a-f]{32}"/.test(ledger) && !ledger.includes('P-SEC') && leaks(ledger).length === 0, ledger);
  check('ledger: the ledger file is readable by its owner only (0600)', (statSync(LEDGER).mode & 0o777) === 0o600);
  // Restore the older backup: participant 2 must stay deleted.
  const TO = join(DIR, 'restored.sqlite');
  const r = await backupMod.restore({ file: b1.file, backupKey: BKEY, to: TO, dbKey: KEY, ledgerPath: LEDGER, now: clock });
  const rs = openStore(TO, { key: KEY, now: () => clock });
  check('restore: a participant deleted after the backup stays deleted', !rs.participantByRef(REF2) && r.deletionsReapplied === 1, JSON.stringify(r));
  check('restore: other participants come back complete', !!rs.participantByRef(REF) && rs.observations(rs.participantByRef(REF).id).length === obsCount);
  check('restore: the re-applied deletions are audited (counts only)', rs.allAudit().some(x => x.action === 'restore_reapplied_deletions'));
  check('restore: no data of the deleted participant remains in the restored files', !/SEC-0002/.test(rawBytes(TO)));
  rs.close();
  check('restore: refuses to overwrite an existing database', !!(await throwsCodeAsync(() => backupMod.restore({ file: b1.file, backupKey: BKEY, to: TO, dbKey: KEY, ledgerPath: LEDGER }), 'restore_target_exists')));
  check('restore: refuses without a deletion ledger (it would bring deleted people back)', !!(await throwsCodeAsync(() => backupMod.restore({ file: b1.file, backupKey: BKEY, to: join(DIR, 'r2.sqlite'), dbKey: KEY }), 'ledger_required')));
  // Tampering and wrong keys.
  const tampered = join(DIR, 'tampered.rsb'), buf = readFileSync(b1.file); buf[Math.floor(buf.length / 2)] ^= 0xff; writeFileSync(tampered, buf);
  const T2 = join(DIR, 'r-tampered.sqlite');
  check('restore: a modified backup fails its integrity check and writes nothing', !!(await throwsCodeAsync(() => backupMod.restore({ file: tampered, backupKey: BKEY, to: T2, dbKey: KEY, ledgerPath: LEDGER }), 'backup_integrity_failed')) && !existsSync(T2) && !readdirSync(DIR).some(f => f.startsWith('r-tampered')));
  check('restore: the wrong backup key fails and writes nothing', !!(await throwsCodeAsync(() => backupMod.restore({ file: b1.file, backupKey: KEY2, to: T2, dbKey: KEY, ledgerPath: LEDGER }), 'backup_integrity_failed')) && !existsSync(T2));
  // Retention: backups older than the retention period are removed.
  const old = await backupMod.backup({ dbPath: LIVE, dbKey: KEY, backupKey: BKEY, dir: BDIR, now: clock - 40 * 864e5, retentionDays: 0 });
  const fresh = await backupMod.backup({ dbPath: LIVE, dbKey: KEY, backupKey: BKEY, dir: BDIR, now: clock, retentionDays: 35 });
  check('retention: a backup older than the retention period is deleted when a new one is made', !existsSync(old.file) && existsSync(fresh.file) && fresh.pruned >= 1, JSON.stringify(fresh));
  const pr = backupMod.pruneBackups({ dir: BDIR, retentionDays: 35, now: clock + 36 * 864e5 });
  check('retention: pruneBackups removes everything past the retention period', pr.removed >= 2 && readdirSync(BDIR).filter(f => f.endsWith('.rsb')).length === 0, JSON.stringify(pr));
}

/* =============== 5. CLI =============== */
{
  const env = { ...process.env, RESEARCH_DB: join(DIR, 'cli.sqlite'), RESEARCH_DB_KEY_FILE: join(DIR, 'cli-db.key'), RESEARCH_BACKUP_KEY_FILE: join(DIR, 'cli-backup.key'), RESEARCH_DELETION_LEDGER: join(DIR, 'cli-ledger.jsonl') };
  const run = (args, extra = {}) => spawnSync(process.execPath, ['--no-warnings', CLI, ...args], { env: { ...env, ...extra }, encoding: 'utf8' });
  const g1 = run(['generate-key', '--out', env.RESEARCH_DB_KEY_FILE]), g2 = run(['generate-key', '--out', env.RESEARCH_BACKUP_KEY_FILE]);
  check('cli: generate-key writes owner-only key files', g1.status === 0 && g2.status === 0 && existsSync(env.RESEARCH_DB_KEY_FILE) && (statSync(env.RESEARCH_DB_KEY_FILE).mode & 0o777) === 0o600, g1.stderr);
  check('cli: generate-key refuses to overwrite an existing key', run(['generate-key', '--out', env.RESEARCH_DB_KEY_FILE]).status !== 0);
  const cu = run(['create-user', '--role', 'researcher', '--username', 'clires'], { RESEARCH_NEW_PASSWORD: PW });
  check('cli: create-user works on an encrypted database', cu.status === 0, cu.stderr);
  const en = run(['enroll-mfa', '--username', 'clires']);
  check('cli: enroll-mfa prints an otpauth URI for the operator to pass on', en.status === 0 && /otpauth:\/\/totp\//.test(en.stdout), en.stderr);
  const secret = (en.stdout.match(/secret=([A-Z2-7]{32})/) || [])[1];
  const cf = run(['confirm-mfa', '--username', 'clires'], { RESEARCH_MFA_CODE: secret ? totp(secret, Date.now()) : '000000' });
  check('cli: confirm-mfa enables it with a code and prints recovery codes', cf.status === 0 && (cf.stdout.match(/\d{5}-\d{5}-\d{5}-\d{5}/g) || []).length === 10, cf.stderr + cf.stdout.slice(0, 200));
  const bk = run(['backup', '--dir', join(DIR, 'cli-backups')]);
  const bfile = (bk.stdout.match(/(\S+\.rsb)/) || [])[1];
  check('cli: backup writes an encrypted backup', bk.status === 0 && !!bfile && existsSync(bfile), bk.stderr);
  const vb = run(['verify-backup', '--file', bfile || 'none']);
  check('cli: verify-backup confirms it', vb.status === 0 && /ok/i.test(vb.stdout), vb.stderr);
  const rsd = run(['restore', '--file', bfile || 'none', '--to', join(DIR, 'cli-restored.sqlite')]);
  check('cli: restore writes a new database', rsd.status === 0 && existsSync(join(DIR, 'cli-restored.sqlite')), rsd.stderr);
  const rk = run(['rotate-key', '--new-key-file', join(DIR, 'cli-new.key')]);
  check('cli: rotate-key needs an existing new key file (refuses a missing one)', rk.status !== 0);
  run(['generate-key', '--out', join(DIR, 'cli-new.key')]);
  const rk2 = run(['rotate-key', '--new-key-file', join(DIR, 'cli-new.key')]);
  check('cli: rotate-key re-wraps the data key', rk2.status === 0 && !!throwsCode(() => openStore(env.RESEARCH_DB, { key: keysMod.loadKeyFile?.(env.RESEARCH_DB_KEY_FILE) }), 'db_key_invalid'), rk2.stderr);
  check('cli: nothing secret is printed by backup or restore', ![bk.stdout, rsd.stdout, vb.stdout].some(t => /[A-Za-z0-9+/]{43}=/.test(t)));
}
done();
