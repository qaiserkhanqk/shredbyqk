// SQLite persistence (node:sqlite, built into Node 22). Every statement is parameterised. Every data query is scoped
// by participant_id, and callers reach it only after the server has authorised access to that participant.
// Raw observations are never updated during analysis; exclusions are separate, reversible correction rows. Derived
// results are stored as versioned runs. deleteParticipant() removes raw AND derived data (deletion rights win over
// immutability); audit rows keep only an internal number and an action name.
//
// Encryption at rest (schema 4): when opened with a key, every sensitive payload (observations, annotations, quarantined
// cells and reasons, import previews, derived runs, two-factor secrets) is stored as AES-256-GCM ciphertext, and the
// values that must stay comparable (observation keys and fingerprints, entry IDs, annotation types, filename hashes,
// run scopes) are stored as keyed blind indexes. Pseudonymous participant refs, usernames, consent scope names, times,
// counts and audit codes stay readable so that access control and audits work. See research/docs/threat-model.md.
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomInt, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { appendFileSync, chmodSync, existsSync } from 'node:fs';
import { canonicalType, CONSENT_SCOPED_TYPES, observationRowHash, annotationHash as annHash } from '../lib/ingest.js';
import { correctionState } from '../lib/pipeline.js';
import { ENC_SCHEME, assertKey, wrapKey, unwrapKey, fieldCipher, isEncryptedField } from './keys.js';
import { base32Encode, verifyTotp, stepAt } from './totp.js';

export const SCHEMA_VERSION = 4;
const SCHEMA = `
PRAGMA foreign_keys = ON; PRAGMA secure_delete = ON; PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS participants (id INTEGER PRIMARY KEY, ref TEXT UNIQUE NOT NULL, adult_confirmed INTEGER NOT NULL CHECK (adult_confirmed = 1), created_at INTEGER NOT NULL, uid TEXT);
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, pw_salt BLOB NOT NULL, pw_hash BLOB NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','researcher','participant')), participant_id INTEGER REFERENCES participants(id) ON DELETE CASCADE, created_at INTEGER NOT NULL, failed INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0,
  totp_secret TEXT, totp_pending TEXT, totp_enabled INTEGER NOT NULL DEFAULT 0, totp_last_step INTEGER NOT NULL DEFAULT 0, recovery_salt TEXT, recovery_json TEXT, pw_changed_at INTEGER);
CREATE TABLE IF NOT EXISTS deletion_ledger (uid TEXT PRIMARY KEY, deleted_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS assignments (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE, PRIMARY KEY (user_id, participant_id));
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, csrf TEXT NOT NULL, created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS consents (id INTEGER PRIMARY KEY, participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE, scope TEXT NOT NULL, granted INTEGER NOT NULL, at INTEGER NOT NULL, by_user INTEGER);
CREATE TABLE IF NOT EXISTS features (participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE, name TEXT NOT NULL, enabled INTEGER NOT NULL, by_user INTEGER, at INTEGER NOT NULL, PRIMARY KEY (participant_id, name));
CREATE TABLE IF NOT EXISTS batches (id INTEGER PRIMARY KEY, participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE, record_type TEXT NOT NULL, format TEXT NOT NULL, source_hash TEXT NOT NULL,
  filename_hash TEXT, extension TEXT, ingest_version TEXT NOT NULL, config_version TEXT NOT NULL, config_hash TEXT NOT NULL, counts_json TEXT NOT NULL, created_at INTEGER NOT NULL, created_by INTEGER,
  attempt INTEGER NOT NULL DEFAULT 0, reimport_reason TEXT, UNIQUE (participant_id, record_type, source_hash, attempt));
CREATE TABLE IF NOT EXISTS observations (id INTEGER PRIMARY KEY, participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE, batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  obs_key TEXT NOT NULL, row_hash TEXT NOT NULL, data_json TEXT NOT NULL, ingested_at INTEGER NOT NULL, UNIQUE (participant_id, obs_key));
CREATE TABLE IF NOT EXISTS annotations (id INTEGER PRIMARY KEY, participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE, batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  entry_id TEXT NOT NULL, entry_hash TEXT NOT NULL, data_json TEXT NOT NULL, canonical_type TEXT, UNIQUE (participant_id, entry_id));
CREATE TABLE IF NOT EXISTS quarantine (id INTEGER PRIMARY KEY, participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE, batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  line INTEGER, reasons_json TEXT NOT NULL, raw_json TEXT, rejected INTEGER NOT NULL, canonical_type TEXT);
CREATE TABLE IF NOT EXISTS corrections (id INTEGER PRIMARY KEY, participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE, observation_id INTEGER NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('exclude','exclude_timing','restore')), reason TEXT NOT NULL, by_user INTEGER, at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS derived_runs (id INTEGER PRIMARY KEY, participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE, kind TEXT NOT NULL, algorithm_version TEXT NOT NULL,
  config_version TEXT NOT NULL, config_hash TEXT NOT NULL, input_hash TEXT NOT NULL, data_cutoff TEXT, scope TEXT NOT NULL, output_json TEXT NOT NULL, created_at INTEGER NOT NULL,
  UNIQUE (participant_id, kind, scope, algorithm_version, config_hash, input_hash, data_cutoff));
CREATE TABLE IF NOT EXISTS previews (id TEXT PRIMARY KEY, participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE, user_id INTEGER NOT NULL, payload_json TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, at INTEGER NOT NULL, actor INTEGER, action TEXT NOT NULL, participant_id INTEGER, outcome TEXT NOT NULL, detail_json TEXT);
`;
export const CONSENT_SCOPES = ['core_research', 'lh_tests', 'hormonal_context'];
export const FEATURES = ['experimental_shift', 'experimental_forecast'];
/** Annotation types that may be stored only while their optional consent scope is granted. */
export const SCOPE_DATA = Object.fromEntries(Object.entries(CONSENT_SCOPED_TYPES).map(([type, scope]) => [scope, type])); // { lh_tests: 'lh_test', hormonal_context: 'hormonal_medication' }
export class ConsentError extends Error { constructor(code) { super(code); this.code = code; } }
const PARTICIPANT_TABLES = ['previews', 'derived_runs', 'corrections', 'quarantine', 'annotations', 'observations', 'batches', 'features', 'consents', 'assignments'];

const hashPw = (pw, salt) => scryptSync(String(pw), salt, 32, { N: 16384, r: 8, p: 1 });
const sha = s => createHash('sha256').update(s).digest('hex');

/* Upgrades a database created by an earlier version (schema 1), in place:
   • batches: one row per source file → one row per ATTEMPT (explicit reimports, issue 2 reported against f67000b).
     SQLite cannot drop a UNIQUE constraint, so the table is rebuilt with the same IDs (foreign keys stay valid).
   • annotations / quarantine: add `canonical_type` and fill it from the stored type (issue 1). */
function migrate(db) {
  const cols = t => db.prepare(`SELECT name FROM pragma_table_info('${t}')`).all().map(r => r.name);
  const from = Number(db.prepare("SELECT v FROM meta WHERE k = 'schema_version'").get()?.v ?? SCHEMA_VERSION);
  if (!cols('batches').includes('attempt')) {
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(`CREATE TABLE batches_v2 (id INTEGER PRIMARY KEY, participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE, record_type TEXT NOT NULL, format TEXT NOT NULL, source_hash TEXT NOT NULL,
        filename_hash TEXT, extension TEXT, ingest_version TEXT NOT NULL, config_version TEXT NOT NULL, config_hash TEXT NOT NULL, counts_json TEXT NOT NULL, created_at INTEGER NOT NULL, created_by INTEGER,
        attempt INTEGER NOT NULL DEFAULT 0, reimport_reason TEXT, UNIQUE (participant_id, record_type, source_hash, attempt));
        INSERT INTO batches_v2 (id, participant_id, record_type, format, source_hash, filename_hash, extension, ingest_version, config_version, config_hash, counts_json, created_at, created_by)
          SELECT id, participant_id, record_type, format, source_hash, filename_hash, extension, ingest_version, config_version, config_hash, counts_json, created_at, created_by FROM batches;
        DROP TABLE batches; ALTER TABLE batches_v2 RENAME TO batches;`);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; } finally { db.exec('PRAGMA foreign_keys = ON'); }
  }
  for (const [t, col] of [['annotations', 'data_json'], ['quarantine', 'raw_json']]) {
    if (!cols(t).includes('canonical_type')) db.exec(`ALTER TABLE ${t} ADD COLUMN canonical_type TEXT`);
    const upd = db.prepare(`UPDATE ${t} SET canonical_type = ? WHERE id = ?`);
    for (const r of db.prepare(`SELECT id, ${col} AS j FROM ${t} WHERE canonical_type IS NULL AND ${col} IS NOT NULL`).all()) {
      let v = null; try { v = JSON.parse(r.j); } catch { /* keep null */ }
      if (v && typeof v === 'object' && v.type != null) upd.run(canonicalType(v.type), r.id);
    }
  }
  if (from < 3) migrateToV3(db, from);
  ensureV4(db);
  db.prepare("INSERT INTO meta (k, v) VALUES ('schema_version', ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v").run(String(SCHEMA_VERSION));
}

/* Schema 3 (findings reported against 21317c5), one transaction:
   • corrections may record "exclude_timing" (the table is rebuilt: SQLite cannot alter a CHECK constraint);
   • observations are re-fingerprinted with rowhash-2, which covers every analysis-relevant field, so re-sending an
     unchanged reading stays an exact duplicate and a changed one is a conflict;
   • CONSENT RECONCILIATION: for every participant whose optional consent (lh_tests, hormonal_context) is not currently
     granted (e.g. withdrawn before this upgrade, when the older purge matched raw types exactly), annotations and
     quarantined rows of that canonical type are deleted, and saved previews containing such content are invalidated.
     Only counts are audited (no types, values or references). Nothing deleted is ever restored. */
function migrateToV3(db, from) {
  const scopeOfType = CONSENT_SCOPED_TYPES; // canonical type → consent scope
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('BEGIN IMMEDIATE');
  try {
    const sql = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'corrections'").get()?.sql || '';
    if (!sql.includes('exclude_timing')) {
      db.exec(`CREATE TABLE corrections_v3 (id INTEGER PRIMARY KEY, participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE, observation_id INTEGER NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
          action TEXT NOT NULL CHECK (action IN ('exclude','exclude_timing','restore')), reason TEXT NOT NULL, by_user INTEGER, at INTEGER NOT NULL);
        INSERT INTO corrections_v3 SELECT id, participant_id, observation_id, action, reason, by_user, at FROM corrections;
        DROP TABLE corrections; ALTER TABLE corrections_v3 RENAME TO corrections;`);
    }
    const upd = db.prepare('UPDATE observations SET row_hash = ? WHERE id = ?');
    for (const r of db.prepare('SELECT id, data_json FROM observations').all()) { try { upd.run(observationRowHash(JSON.parse(r.data_json)), r.id); } catch { /* leave as is */ } }
    const now = Date.now();
    for (const { id: pid } of db.prepare('SELECT id FROM participants').all()) {
      const granted = {}; for (const c of db.prepare('SELECT scope, granted FROM consents WHERE participant_id = ? ORDER BY id').all(pid)) granted[c.scope] = !!c.granted;
      const unauthorized = Object.keys(scopeOfType).filter(t => !granted[scopeOfType[t]]);
      if (!unauthorized.length) continue;
      const removed = { annotations: 0, quarantine: 0, previews: 0 };
      for (const t of unauthorized) {
        removed.annotations += Number(db.prepare('DELETE FROM annotations WHERE participant_id = ? AND canonical_type = ?').run(pid, t).changes);
        removed.quarantine += Number(db.prepare('DELETE FROM quarantine WHERE participant_id = ? AND canonical_type = ?').run(pid, t).changes);
      }
      for (const pv of db.prepare('SELECT id, payload_json FROM previews WHERE participant_id = ?').all(pid)) {
        let p = null; try { p = JSON.parse(pv.payload_json); } catch { /* unreadable: invalidate */ }
        const types = p ? [...(p.accepted || []).map(a => a?.type), ...(p.quarantined || []).map(q => q?.raw?.type)] : [null];
        if (!p || types.some(x => x != null && unauthorized.includes(canonicalType(x)))) { db.prepare('DELETE FROM previews WHERE id = ?').run(pv.id); removed.previews++; }
      }
      if (removed.annotations || removed.quarantine || removed.previews) db.prepare('INSERT INTO audit (at, actor, action, participant_id, outcome, detail_json) VALUES (?, NULL, ?, ?, ?, ?)')
        .run(now, 'migration_consent_reconciled', pid, 'ok', JSON.stringify({ schemaFrom: from, schemaTo: 3, removed }));
    }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; } finally { db.exec('PRAGMA foreign_keys = ON'); }
}

/* Schema 4 (security features): a random participant uid (the deletion ledger records it, never the ref), two-factor
   and password-change columns on users, and the deletion ledger. Idempotent: safe on every open. */
function ensureV4(db) {
  const cols = t => db.prepare(`SELECT name FROM pragma_table_info('${t}')`).all().map(r => r.name);
  if (!cols('participants').includes('uid')) db.exec('ALTER TABLE participants ADD COLUMN uid TEXT');
  const fill = db.prepare('UPDATE participants SET uid = ? WHERE id = ?');
  for (const r of db.prepare('SELECT id FROM participants WHERE uid IS NULL').all()) fill.run(randomBytes(16).toString('hex'), r.id);
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS participants_uid ON participants(uid)');
  const u = cols('users');
  for (const [c, def] of [['totp_secret', 'TEXT'], ['totp_pending', 'TEXT'], ['totp_enabled', 'INTEGER NOT NULL DEFAULT 0'], ['totp_last_step', 'INTEGER NOT NULL DEFAULT 0'], ['recovery_salt', 'TEXT'], ['recovery_json', 'TEXT'], ['pw_changed_at', 'INTEGER']])
    if (!u.includes(c)) db.exec(`ALTER TABLE users ADD COLUMN ${c} ${def}`);
}

const meta = (db, k) => db.prepare('SELECT v FROM meta WHERE k = ?').get(k)?.v ?? null;
const setMeta = (db, k, v) => db.prepare('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v').run(k, v);
const codeErr = code => Object.assign(new Error(code), { code });
/* Additional authenticated data: binds each ciphertext to its table, column and owner. */
const AAD = {
  obs: pid => `observations.data_json|${pid}`, ann: pid => `annotations.data_json|${pid}`, qraw: pid => `quarantine.raw_json|${pid}`, qreasons: pid => `quarantine.reasons_json|${pid}`,
  preview: (pid, id) => `previews.payload_json|${pid}|${id}`, run: pid => `derived_runs.output_json|${pid}`, totp: uid => `users.totp|${uid}`,
};

/* Encrypts an existing plaintext database in place, in one transaction, then rewrites the files (checkpoint + VACUUM)
   so no plaintext page survives in the main file or the write-ahead log. */
function encryptInPlace(db, C, wrapped) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const each = (sql, fn) => { for (const r of db.prepare(sql).all()) fn(r); };
    const enc = (v, aad) => (v == null || isEncryptedField(v) ? v : C.enc(v, aad));
    const idx = v => (v == null || String(v).startsWith('k1.') ? v : C.idx(v));
    const uo = db.prepare('UPDATE observations SET data_json = ?, obs_key = ?, row_hash = ? WHERE id = ?');
    each('SELECT id, participant_id AS p, data_json, obs_key, row_hash FROM observations', r => uo.run(enc(r.data_json, AAD.obs(r.p)), idx(r.obs_key), idx(r.row_hash), r.id));
    const ua = db.prepare('UPDATE annotations SET data_json = ?, entry_id = ?, entry_hash = ?, canonical_type = ? WHERE id = ?');
    each('SELECT id, participant_id AS p, data_json, entry_id, entry_hash, canonical_type FROM annotations', r => ua.run(enc(r.data_json, AAD.ann(r.p)), idx(r.entry_id), idx(r.entry_hash), idx(r.canonical_type), r.id));
    const uq = db.prepare('UPDATE quarantine SET raw_json = ?, reasons_json = ?, canonical_type = ? WHERE id = ?');
    each('SELECT id, participant_id AS p, raw_json, reasons_json, canonical_type FROM quarantine', r => uq.run(enc(r.raw_json, AAD.qraw(r.p)), enc(r.reasons_json, AAD.qreasons(r.p)), idx(r.canonical_type), r.id));
    const up = db.prepare('UPDATE previews SET payload_json = ? WHERE id = ?');
    each('SELECT id, participant_id AS p, payload_json FROM previews', r => up.run(enc(r.payload_json, AAD.preview(r.p, r.id)), r.id));
    const ur = db.prepare('UPDATE derived_runs SET output_json = ?, scope = ? WHERE id = ?');
    each('SELECT id, participant_id AS p, output_json, scope FROM derived_runs', r => ur.run(enc(r.output_json, AAD.run(r.p)), idx(r.scope), r.id));
    const ub = db.prepare('UPDATE batches SET filename_hash = ? WHERE id = ?');
    each('SELECT id, filename_hash FROM batches WHERE filename_hash IS NOT NULL', r => ub.run(idx(r.filename_hash), r.id));
    const uu = db.prepare('UPDATE users SET totp_secret = ?, totp_pending = ? WHERE id = ?');
    each('SELECT id, totp_secret, totp_pending FROM users', r => uu.run(enc(r.totp_secret, AAD.totp(r.id)), enc(r.totp_pending, AAD.totp(r.id)), r.id));
    setMeta(db, 'dek_wrapped', wrapped); setMeta(db, 'enc_scheme', ENC_SCHEME);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  scrubFiles(db);
}
/** Rewrites the database files so freed pages (which may hold old plaintext) are gone, and empties the WAL. */
export function scrubFiles(db) { db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); db.exec('VACUUM'); db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); }

/** Re-wraps the data key of an encrypted database with a new key-encryption key. The data itself is unchanged.
 *  Backups made before the rotation still need the OLD key to be restored (keep it until they expire). */
export function rotateKey(path, oldKey, newKey) {
  assertKey(oldKey); assertKey(newKey);
  const db = new DatabaseSync(path);
  try {
    const wrapped = meta(db, 'dek_wrapped'); if (!wrapped) throw codeErr('db_not_encrypted');
    const dek = unwrapKey(oldKey, wrapped);
    setMeta(db, 'dek_wrapped', wrapKey(newKey, dek)); db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  } finally { db.close(); }
}

/**
 * Opens (and if needed creates or upgrades) a store.
 * key: 32-byte key-encryption key. With a key, a new database is created encrypted and an existing unencrypted one is
 *      encrypted in place. An encrypted database cannot be opened without its key (`db_key_required`) or with the
 *      wrong one (`db_key_invalid`). Without a key, the database stays unencrypted (in-memory tests; the server refuses
 *      to start on a file database without a key unless explicitly allowed).
 * ledgerPath: optional append-only deletion-ledger file (random participant uids and times only). Restores re-apply it.
 */
export function openStore(path = ':memory:', { now = () => Date.now(), key = null, ledgerPath = null } = {}) {
  if (key != null) assertKey(key);
  const db = new DatabaseSync(path);
  let C = null;
  try {
    const scheme = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'meta'").get() ? meta(db, 'enc_scheme') : null;
    if (scheme) { // check the key BEFORE anything is written
      if (scheme !== ENC_SCHEME) throw codeErr('db_encryption_unsupported');
      if (!key) throw codeErr('db_key_required');
      C = fieldCipher(unwrapKey(key, meta(db, 'dek_wrapped')));
    }
    db.exec(SCHEMA);
    migrate(db);
    db.prepare('INSERT OR IGNORE INTO meta (k, v) VALUES (?, ?)').run('schema_version', String(SCHEMA_VERSION));
    if (key && !C) { const dek = randomBytes(32); C = fieldCipher(dek); encryptInPlace(db, C, wrapKey(key, dek)); }
  } catch (e) { try { db.close(); } catch { /* already closed */ } throw e; }
  // Field helpers: E encrypts, D decrypts, I makes a blind index. All are the identity on an unencrypted store.
  const E = (v, aad) => (C && v != null ? C.enc(v, aad) : v);
  const D = (v, aad) => { if (v == null) return v; if (C) return C.dec(v, aad); if (isEncryptedField(v)) throw codeErr('db_key_required'); return v; };
  const I = v => (C && v != null ? C.idx(v) : v);
  const q = (sql) => db.prepare(sql);
  const tx = fn => { db.exec('BEGIN IMMEDIATE'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } };
  const audit = (actor, action, participantId, outcome = 'ok', detail = null) => q('INSERT INTO audit (at, actor, action, participant_id, outcome, detail_json) VALUES (?, ?, ?, ?, ?, ?)').run(now(), actor ?? null, action, participantId ?? null, outcome, detail ? JSON.stringify(detail) : null);

  /* ---- password and second-factor checks (shared by sign-in, password change and two-factor settings) ---- */
  const userRow = id => q('SELECT * FROM users WHERE id = ?').get(id);
  const recordFailure = u => { const failed = u.failed + 1; q('UPDATE users SET failed = ?, locked_until = ? WHERE id = ?').run(failed % 5 === 0 ? 0 : failed, failed % 5 === 0 ? now() + 15 * 60e3 : 0, u.id); };
  const passwordMatches = (u, password) => timingSafeEqual(Buffer.from(u.pw_hash), hashPw(password, u.pw_salt));
  const normCode = c => String(c ?? '').replace(/[\s-]/g, '');
  const recoveryHash = (salt, code) => sha(`${salt}|${code}`);
  /** Checks a six-digit code (each time step usable once) or a 20-digit recovery code (each usable once). */
  function useSecondFactor(u, code) {
    const c = normCode(code);
    if (/^\d{6}$/.test(c) && u.totp_secret) {
      const step = verifyTotp(D(u.totp_secret, AAD.totp(u.id)), c, now(), { lastStep: u.totp_last_step });
      if (step === null) return false;
      q('UPDATE users SET totp_last_step = ? WHERE id = ?').run(step, u.id); return 'totp';
    }
    if (/^\d{20}$/.test(c) && u.recovery_json) {
      const hashes = JSON.parse(u.recovery_json), h = recoveryHash(u.recovery_salt, c), i = hashes.findIndex(x => timingSafeEqual(Buffer.from(x), Buffer.from(h)));
      if (i < 0) return false;
      hashes.splice(i, 1); q('UPDATE users SET recovery_json = ? WHERE id = ?').run(JSON.stringify(hashes), u.id); return 'recovery_code';
    }
    return false;
  }
  /** Password (+ second factor if enabled) for an already signed-in user. Failures count towards the lockout. */
  function reauthenticate(userId, password, code) {
    const u = userRow(userId); if (!u) return { ok: false, error: 'password_incorrect' };
    if (u.locked_until > now()) return { ok: false, error: 'account_locked' };
    if (!passwordMatches(u, password)) { recordFailure(u); return { ok: false, error: 'password_incorrect' }; }
    if (u.totp_enabled) {
      if (!normCode(code)) return { ok: false, error: 'mfa_code_required' };
      if (!useSecondFactor(u, code)) { recordFailure(u); return { ok: false, error: 'mfa_code_invalid' }; }
    }
    q('UPDATE users SET failed = 0 WHERE id = ?').run(u.id);
    return { ok: true, user: u };
  }
  const endOtherSessions = (userId, keepTokenHash) => Number(q('DELETE FROM sessions WHERE user_id = ? AND token_hash IS NOT ?').run(userId, keepTokenHash ?? null).changes);
  const ledgerAppend = (uid, at) => { if (!ledgerPath) return; appendFileSync(ledgerPath, JSON.stringify({ uid, deletedAt: new Date(at).toISOString() }) + '\n', { mode: 0o600 }); chmodSync(ledgerPath, 0o600); };

  return {
    db, tx, audit, close: () => db.close(), encrypted: !!C,
    /* ---- users & sessions ---- */
    createUser({ username, password, role, participantId = null }) {
      if (!/^[a-z0-9_.-]{3,40}$/.test(username)) throw Object.assign(new Error('username_invalid'), { code: 'username_invalid' });
      if (String(password).length < 12) throw Object.assign(new Error('password_too_short'), { code: 'password_too_short' });
      const salt = randomBytes(16);
      return Number(q('INSERT INTO users (username, pw_salt, pw_hash, role, participant_id, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(username, salt, hashPw(password, salt), role, participantId, now()).lastInsertRowid);
    },
    /**
     * Sign-in. Order: lockout → password → second factor. A wrong password or a wrong code counts towards the
     * lockout (5 failures → 15 minutes). With the right password: `mfaRequired` if two-factor is on and no code was
     * given; `enrolmentRequired` if the role must use two-factor but it is not set up.
     */
    verifyLogin(username, password, code, { requireMfaRoles = [] } = {}) {
      const u = q('SELECT * FROM users WHERE username = ?').get(String(username));
      const salt = u?.pw_salt ?? randomBytes(16), h = hashPw(password, salt); // same work whether or not the user exists
      if (!u) return { ok: false };
      if (u.locked_until > now()) return { ok: false, locked: true };
      if (!timingSafeEqual(Buffer.from(u.pw_hash), h)) { recordFailure(u); return { ok: false }; }
      if (u.totp_enabled) {
        if (!normCode(code)) return { ok: false, mfaRequired: true };
        const method = useSecondFactor(u, code);
        if (!method) { recordFailure(u); return { ok: false }; }
        q('UPDATE users SET failed = 0 WHERE id = ?').run(u.id);
        return { ok: true, method, user: { id: u.id, username: u.username, role: u.role, participantId: u.participant_id } };
      }
      if (requireMfaRoles.includes(u.role)) return { ok: false, enrolmentRequired: true };
      q('UPDATE users SET failed = 0 WHERE id = ?').run(u.id);
      return { ok: true, method: 'password', user: { id: u.id, username: u.username, role: u.role, participantId: u.participant_id } };
    },
    /* ---- two-factor (TOTP) ---- */
    /** Starts enrolment: a new secret is stored as PENDING (two-factor is not on until confirmed with a code). */
    mfaBegin(userId, { issuer = 'ShredbyQK research prototype' } = {}) {
      const u = userRow(userId); if (!u) throw codeErr('user_not_found');
      const secret = base32Encode(randomBytes(20));
      q('UPDATE users SET totp_pending = ? WHERE id = ?').run(E(secret, AAD.totp(userId)), userId);
      const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(u.username)}`;
      return { secret, uri: `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30` };
    },
    /** Confirms enrolment with a current code: turns two-factor on, issues 10 one-time recovery codes (stored hashed),
     *  and ends the account's other sessions. */
    mfaConfirm(userId, code, { keepTokenHash = null } = {}) {
      const u = userRow(userId); if (!u?.totp_pending) return { ok: false, error: 'mfa_setup_not_started' };
      const secret = D(u.totp_pending, AAD.totp(userId)), step = verifyTotp(secret, normCode(code), now(), { lastStep: u.totp_last_step });
      if (step === null) return { ok: false, error: 'mfa_code_invalid' };
      const salt = randomBytes(16).toString('hex');
      const codes = Array.from({ length: 10 }, () => Array.from({ length: 4 }, () => String(randomInt(0, 100000)).padStart(5, '0')).join('-'));
      return tx(() => {
        q('UPDATE users SET totp_secret = totp_pending, totp_pending = NULL, totp_enabled = 1, totp_last_step = ?, recovery_salt = ?, recovery_json = ? WHERE id = ?')
          .run(step, salt, JSON.stringify(codes.map(c => recoveryHash(salt, normCode(c)))), userId);
        const ended = endOtherSessions(userId, keepTokenHash);
        audit(userId, 'mfa_enabled', null, 'ok', { otherSessionsEnded: ended });
        return { ok: true, recoveryCodes: codes, otherSessionsEnded: ended };
      });
    },
    mfaStatus(userId) {
      const u = userRow(userId); if (!u) return null;
      return { enabled: !!u.totp_enabled, pending: !!u.totp_pending, recoveryCodesLeft: u.recovery_json ? JSON.parse(u.recovery_json).length : 0 };
    },
    /** Turns two-factor off (the caller has checked password and code, or an operator does it from the CLI). */
    mfaDisable(userId, by = userId) {
      q('UPDATE users SET totp_secret = NULL, totp_pending = NULL, totp_enabled = 0, recovery_salt = NULL, recovery_json = NULL WHERE id = ?').run(userId);
      audit(by, 'mfa_disabled', null, 'ok', by === userId ? null : { byOperator: true });
    },
    reauthenticate,
    /* ---- password change ---- */
    changePassword(userId, { current, next, code, keepTokenHash = null }) {
      const a = reauthenticate(userId, current, code); if (!a.ok) return a;
      const n = String(next ?? '');
      if (n.length < 12) return { ok: false, error: 'password_too_short' };
      if (n === String(current)) return { ok: false, error: 'password_unchanged' };
      if (a.user.username.length >= 3 && n.toLowerCase().includes(a.user.username.toLowerCase())) return { ok: false, error: 'password_contains_username' };
      return tx(() => {
        const salt = randomBytes(16);
        q('UPDATE users SET pw_salt = ?, pw_hash = ?, pw_changed_at = ?, failed = 0 WHERE id = ?').run(salt, hashPw(n, salt), now(), userId);
        const ended = endOtherSessions(userId, keepTokenHash);
        audit(userId, 'password_changed', null, 'ok', { otherSessionsEnded: ended });
        return { ok: true, otherSessionsEnded: ended };
      });
    },
    /** Operator password reset from the CLI. Ends every session of the account. */
    setPassword(userId, password) {
      if (String(password).length < 12) throw codeErr('password_too_short');
      const salt = randomBytes(16);
      q('UPDATE users SET pw_salt = ?, pw_hash = ?, pw_changed_at = ?, failed = 0, locked_until = 0 WHERE id = ?').run(salt, hashPw(password, salt), now(), userId);
      endOtherSessions(userId, null); audit(null, 'password_reset_by_operator', null);
    },
    userByName: username => { const u = q('SELECT id, username, role FROM users WHERE username = ?').get(String(username)); return u || null; },
    createSession(userId) {
      const token = randomBytes(32).toString('base64url'), csrf = randomBytes(24).toString('base64url');
      q('INSERT INTO sessions (token_hash, user_id, csrf, created_at, last_seen) VALUES (?, ?, ?, ?, ?)').run(sha(token), userId, csrf, now(), now());
      return { token, csrf };
    },
    getSession(token, { idleMs, absoluteMs }) {
      if (!token) return null;
      const s = q('SELECT s.*, u.username, u.role, u.participant_id FROM sessions s JOIN users u ON u.id = s.user_id WHERE token_hash = ?').get(sha(token));
      if (!s) return null;
      if (now() - s.last_seen > idleMs || now() - s.created_at > absoluteMs) { q('DELETE FROM sessions WHERE token_hash = ?').run(sha(token)); return null; }
      q('UPDATE sessions SET last_seen = ? WHERE token_hash = ?').run(now(), sha(token));
      return { userId: s.user_id, username: s.username, role: s.role, participantId: s.participant_id, csrf: s.csrf, tokenHash: s.token_hash };
    },
    /** The account's sessions: a short opaque id (from the stored hash, never the token), times, and which is current. */
    listSessions: (userId, currentTokenHash) => q('SELECT token_hash, created_at, last_seen FROM sessions WHERE user_id = ? ORDER BY created_at, token_hash').all(userId)
      .map(r => ({ id: createHash('sha256').update(`session-id|${r.token_hash}`).digest('hex').slice(0, 12), createdAt: r.created_at, lastSeen: r.last_seen, current: r.token_hash === currentTokenHash })),
    revokeOtherSessions(userId, keepTokenHash) { const n = endOtherSessions(userId, keepTokenHash); audit(userId, 'other_sessions_ended', null, 'ok', { ended: n }); return n; },
    endSession: token => q('DELETE FROM sessions WHERE token_hash = ?').run(sha(String(token || ''))),
    /* ---- participants & access ---- */
    createParticipant({ ref, adultConfirmed }, byUser) {
      if (adultConfirmed !== true) throw Object.assign(new Error('adult_confirmation_required'), { code: 'adult_confirmation_required' });
      return tx(() => { const id = Number(q('INSERT INTO participants (ref, adult_confirmed, created_at, uid) VALUES (?, 1, ?, ?)').run(ref, now(), randomBytes(16).toString('hex')).lastInsertRowid); if (byUser) q('INSERT INTO assignments (user_id, participant_id) VALUES (?, ?)').run(byUser, id); return id; });
    },
    participantByRef: ref => q('SELECT * FROM participants WHERE ref = ?').get(String(ref)),
    assign: (userId, participantId) => q('INSERT OR IGNORE INTO assignments (user_id, participant_id) VALUES (?, ?)').run(userId, participantId),
    canAccess(session, participantId) {
      if (!session || participantId == null) return false;
      if (session.role === 'participant') return session.participantId === participantId;
      if (session.role === 'researcher') return !!q('SELECT 1 FROM assignments WHERE user_id = ? AND participant_id = ?').get(session.userId, participantId);
      return false; // admins manage accounts; they have no participant-data access
    },
    listParticipants: session => session.role === 'researcher' ? q('SELECT p.id, p.ref, p.created_at FROM participants p JOIN assignments a ON a.participant_id = p.id WHERE a.user_id = ? ORDER BY p.ref').all(session.userId)
      : session.role === 'participant' ? q('SELECT id, ref, created_at FROM participants WHERE id = ?').all(session.participantId) : [],
    /* ---- consent & features ---- */
    /* Consent changes (issue 2 reported against b3d9589). Any withdrawal invalidates every pending import preview for
       the participant. Withdrawing an OPTIONAL scope also deletes the data that only that scope allowed: LH results
       (lh_tests) or hormonal-medication context (hormonal_context), including quarantined rows of that type.
       Withdrawing core consent stops new imports; what happens to data already collected is for the study protocol
       (full deletion is available separately). One transaction, so no import can slip in between. */
    setConsent(pid, scope, granted, by) {
      return tx(() => {
        q('INSERT INTO consents (participant_id, scope, granted, at, by_user) VALUES (?, ?, ?, ?, ?)').run(pid, scope, granted ? 1 : 0, now(), by ?? null);
        const removed = {};
        if (!granted) {
          removed.previews = Number(q('DELETE FROM previews WHERE participant_id = ?').run(pid).changes);
          const type = SCOPE_DATA[scope];
          if (type) { // by the stored CANONICAL type, never the raw spelling (issue 1 reported against f67000b)
            removed.annotations = Number(q('DELETE FROM annotations WHERE participant_id = ? AND canonical_type = ?').run(pid, I(type)).changes);
            removed.quarantine = Number(q('DELETE FROM quarantine WHERE participant_id = ? AND canonical_type = ?').run(pid, I(type)).changes);
          }
        }
        return removed;
      });
    },
    consents(pid) { const out = {}; for (const r of q('SELECT scope, granted FROM consents WHERE participant_id = ? ORDER BY id').all(pid)) out[r.scope] = !!r.granted; return out; },
    consentLog: pid => q('SELECT scope, granted, at FROM consents WHERE participant_id = ? ORDER BY id').all(pid),
    setFeature(pid, name, enabled, by) { q('INSERT INTO features (participant_id, name, enabled, by_user, at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (participant_id, name) DO UPDATE SET enabled = excluded.enabled, by_user = excluded.by_user, at = excluded.at').run(pid, name, enabled ? 1 : 0, by ?? null, now()); },
    features(pid) { const out = Object.fromEntries(FEATURES.map(f => [f, false])); for (const r of q('SELECT name, enabled FROM features WHERE participant_id = ?').all(pid)) if (r.name in out) out[r.name] = !!r.enabled; return out; },
    /* ---- imports ---- */
    existingFor(pid) {
      if (C) { // stored keys and fingerprints are blind indexes: rebuild the maps from the decrypted records
        const obs = q('SELECT data_json FROM observations WHERE participant_id = ?').all(pid).map(r => JSON.parse(D(r.data_json, AAD.obs(pid))));
        const ann = q('SELECT data_json FROM annotations WHERE participant_id = ?').all(pid).map(r => JSON.parse(D(r.data_json, AAD.ann(pid))));
        return {
          batchHashes: new Set(q('SELECT source_hash FROM batches WHERE participant_id = ?').all(pid).map(r => r.source_hash)),
          obsRowHash: new Map(obs.map(o => [o.obsKey, o.rowHash])),
          entryHash: new Map(ann.map(a => [a.entryId, annHash(a)])),
          entryCorrects: new Map(ann.filter(a => a.corrects).map(a => [a.entryId, a.corrects])),
        };
      }
      return {
        batchHashes: new Set(q('SELECT source_hash FROM batches WHERE participant_id = ?').all(pid).map(r => r.source_hash)),
        obsRowHash: new Map(q('SELECT obs_key, row_hash FROM observations WHERE participant_id = ?').all(pid).map(r => [r.obs_key, r.row_hash])),
        entryHash: new Map(q('SELECT entry_id, entry_hash FROM annotations WHERE participant_id = ?').all(pid).map(r => [r.entry_id, r.entry_hash])),
        entryCorrects: new Map(q("SELECT entry_id, json_extract(data_json, '$.corrects') AS c FROM annotations WHERE participant_id = ?").all(pid).filter(r => r.c).map(r => [r.entry_id, r.c])),
      };
    },
    savePreview(pid, userId, payload) { const id = randomBytes(18).toString('base64url'); q('DELETE FROM previews WHERE created_at < ?').run(now() - 15 * 60e3); q('INSERT INTO previews (id, participant_id, user_id, payload_json, created_at) VALUES (?, ?, ?, ?, ?)').run(id, pid, userId, E(JSON.stringify(payload), AAD.preview(pid, id)), now()); return id; },
    /** Consume a preview. With `expect` ({recordType, sourceHash}, each optional), a preview that does not match is NOT
     *  consumed and `{ mismatch: true }` is returned, so only an exact match can ever commit it. */
    takePreview(id, pid, userId, expect = {}) {
      const r = q('SELECT * FROM previews WHERE id = ? AND participant_id = ? AND user_id = ? AND created_at >= ?').get(String(id), pid, userId, now() - 15 * 60e3);
      if (!r) return null;
      const p = JSON.parse(D(r.payload_json, AAD.preview(pid, r.id)));
      if ((expect.recordType !== undefined && expect.recordType !== p.recordType) || (expect.sourceHash !== undefined && expect.sourceHash !== p.sourceHash)) return { mismatch: true };
      q('DELETE FROM previews WHERE id = ?').run(r.id); return p;
    },
    commitImport(pid, p, userId, annotationHash) {
      return tx(() => {
        // Consent is rechecked INSIDE the transaction (issue 2): a preview made under consent that has since been
        // withdrawn cannot be committed, whatever happened to the preview itself.
        const c = this.consents(pid);
        if (!c.core_research) throw new ConsentError('core_research_consent_missing');
        for (const [scope, type] of Object.entries(SCOPE_DATA)) if (!c[scope] && p.recordType === 'annotations' && p.accepted.some(a => a.type === type)) throw new ConsentError(`${scope}_consent_missing`);
        // An explicit reimport (issue 2 reported against f67000b) is stored as a new attempt of the same source file, with
        // its reason; the earlier batch is left unchanged. Without `reimport` the same file is still a duplicate.
        const prev = q('SELECT MAX(attempt) AS a, COUNT(*) AS n FROM batches WHERE participant_id = ? AND record_type = ? AND source_hash = ?').get(pid, p.recordType, p.sourceHash);
        if (prev.n && !p.reimport) return { duplicateBatch: true, batchId: null };
        if (p.reimport && !/^[a-z0-9_]{3,60}$/.test(String(p.reimportReason || ''))) throw new ConsentError('reimport_reason_required');
        const attempt = prev.n ? prev.a + 1 : 0;
        const batchId = Number(q('INSERT INTO batches (participant_id, record_type, format, source_hash, filename_hash, extension, ingest_version, config_version, config_hash, counts_json, created_at, created_by, attempt, reimport_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
          .run(pid, p.recordType, p.format, p.sourceHash, I(p.sourceFilenameHash), p.sourceExtension, p.ingestVersion, p.configVersion, p.configHash, JSON.stringify(p.counts), now(), userId, attempt, p.reimport ? p.reimportReason : null).lastInsertRowid);
        const t = now();
        if (p.recordType === 'observations') { const ins = q('INSERT OR IGNORE INTO observations (participant_id, batch_id, obs_key, row_hash, data_json, ingested_at) VALUES (?,?,?,?,?,?)'); for (const o of p.accepted) { const { line, ...d } = o; ins.run(pid, batchId, I(o.obsKey), I(o.rowHash), E(JSON.stringify(d), AAD.obs(pid)), t); } }
        else { const ins = q('INSERT OR IGNORE INTO annotations (participant_id, batch_id, entry_id, entry_hash, data_json, canonical_type) VALUES (?,?,?,?,?,?)'); for (const a of p.accepted) { const { line, ...d } = a; ins.run(pid, batchId, I(a.entryId), I(annotationHash(a)), E(JSON.stringify(d), AAD.ann(pid)), I(canonicalType(a.type))); } }
        const qi = q('INSERT INTO quarantine (participant_id, batch_id, line, reasons_json, raw_json, rejected, canonical_type) VALUES (?,?,?,?,?,?,?)');
        for (const x of p.quarantined) {
          const ct = p.recordType === 'annotations' ? (x.canonicalType ?? canonicalType(x.raw?.type)) : null;
          const unconsented = !!ct && !!CONSENT_SCOPED_TYPES[ct] && !c[CONSENT_SCOPED_TYPES[ct]]; // never store their cells
          qi.run(pid, batchId, x.line, E(JSON.stringify(x.reasons), AAD.qreasons(pid)), E(JSON.stringify(unconsented ? null : (x.raw ?? null)), AAD.qraw(pid)), x.rejected ? 1 : 0, I(ct));
        }
        return { duplicateBatch: false, batchId };
      });
    },
    batches: pid => q('SELECT id, record_type, format, source_hash, extension, ingest_version, config_version, config_hash, counts_json, created_at, attempt, reimport_reason FROM batches WHERE participant_id = ? ORDER BY id').all(pid).map(b => ({ ...b, counts: JSON.parse(b.counts_json), counts_json: undefined })),
    /** Observations with their ingestion time and full correction history (issue 7): `corrections` lists every
     *  exclude/restore with its time, so an analysis can apply only those made before its cutoff. `excludedBy` is the
     *  CURRENT state, for current views and exports. */
    observations(pid) {
      const hist = new Map();
      for (const c of q('SELECT observation_id, action, reason, at FROM corrections WHERE participant_id = ? ORDER BY at, id').all(pid)) (hist.get(c.observation_id) || hist.set(c.observation_id, []).get(c.observation_id)).push({ action: c.action, reason: c.reason, at: c.at });
      return q('SELECT id, data_json, ingested_at FROM observations WHERE participant_id = ? ORDER BY id').all(pid).map(r => { const h = hist.get(r.id) || [];
        return { ...JSON.parse(D(r.data_json, AAD.obs(pid))), id: r.id, seq: r.id, ingestedAt: r.ingested_at, corrections: h, ...correctionState(h) }; }); // current value AND timing state
    },
    /** Annotations with `ingestedAt` = the commit time of their import batch (issue 7). */
    annotations: pid => q('SELECT a.data_json, b.created_at FROM annotations a JOIN batches b ON b.id = a.batch_id WHERE a.participant_id = ? ORDER BY a.id').all(pid).map(r => ({ ...JSON.parse(D(r.data_json, AAD.ann(pid))), ingestedAt: r.created_at })),
    quarantine: pid => q('SELECT id, batch_id, line, reasons_json, raw_json, rejected FROM quarantine WHERE participant_id = ? ORDER BY id').all(pid).map(r => ({ id: r.id, batchId: r.batch_id, line: r.line, reasons: JSON.parse(D(r.reasons_json, AAD.qreasons(pid))), rejected: !!r.rejected, verbatimSource: JSON.parse(D(r.raw_json, AAD.qraw(pid)) ?? 'null') })),
    addCorrection(pid, obsId, action, reason, by) {
      if (!q('SELECT 1 FROM observations WHERE id = ? AND participant_id = ?').get(obsId, pid)) return false;
      q('INSERT INTO corrections (participant_id, observation_id, action, reason, by_user, at) VALUES (?,?,?,?,?,?)').run(pid, obsId, action, reason, by ?? null, now()); return true;
    },
    corrections: pid => q('SELECT observation_id, action, reason, at FROM corrections WHERE participant_id = ? ORDER BY id').all(pid),
    saveRun(pid, r) {
      q('INSERT OR IGNORE INTO derived_runs (participant_id, kind, algorithm_version, config_version, config_hash, input_hash, data_cutoff, scope, output_json, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .run(pid, r.kind, r.algorithmVersion, r.configVersion, r.configHash, r.inputHash, r.dataCutoff ?? r.asOfDate ?? '', I(r.cycleStart ?? 'next'), E(JSON.stringify(r), AAD.run(pid)), now());
    },
    runs: pid => q('SELECT id, kind, algorithm_version, config_version, config_hash, input_hash, data_cutoff, scope, created_at, output_json FROM derived_runs WHERE participant_id = ? ORDER BY id').all(pid)
      .map(r => { const output = JSON.parse(D(r.output_json, AAD.run(pid))); return { ...r, scope: output.cycleStart ?? 'next', output, output_json: undefined }; }),
    /** Authorised deletion of one participant's raw and derived records, accounts and sessions. */
    deleteParticipant(pid, actor) {
      const uid = q('SELECT uid FROM participants WHERE id = ?').get(pid)?.uid ?? null;
      const out = tx(() => {
        const counts = {};
        for (const t of PARTICIPANT_TABLES) counts[t] = Number(q(`DELETE FROM ${t} WHERE participant_id = ?`).run(pid).changes);
        const users = q("SELECT id FROM users WHERE participant_id = ? AND role = 'participant'").all(pid).map(r => r.id);
        for (const u of users) q('DELETE FROM sessions WHERE user_id = ?').run(u);
        counts.users = Number(q("DELETE FROM users WHERE participant_id = ? AND role = 'participant'").run(pid).changes);
        counts.participants = Number(q('DELETE FROM participants WHERE id = ?').run(pid).changes);
        if (uid) q('INSERT OR IGNORE INTO deletion_ledger (uid, deleted_at) VALUES (?, ?)').run(uid, now());
        audit(actor, 'participant_deleted', pid, 'ok', { tables: Object.keys(counts) });
        return counts;
      });
      if (uid) ledgerAppend(uid, now()); // after commit: the ledger only ever records completed deletions
      return out;
    },
    /** Deletion-ledger uids recorded in this database. */
    ledgerUids: () => q('SELECT uid FROM deletion_ledger').all().map(r => r.uid),
    /** After a restore: deletes every participant whose uid is in `uids` (deletions made after the backup). */
    reapplyDeletions(uids) {
      const set = new Set(uids); let n = 0;
      for (const r of q('SELECT id, uid FROM participants').all()) if (set.has(r.uid)) { this.deleteParticipant(r.id, null); n++; }
      for (const u of set) q('INSERT OR IGNORE INTO deletion_ledger (uid, deleted_at) VALUES (?, ?)').run(u, now());
      audit(null, 'restore_reapplied_deletions', null, 'ok', { participantsDeleted: n, ledgerEntries: set.size });
      if (n) scrubFiles(db);
      return n;
    },
    countsFor: pid => Object.fromEntries([...PARTICIPANT_TABLES, 'participants'].map(t => [t, Number(q(`SELECT COUNT(*) AS n FROM ${t} WHERE ${t === 'participants' ? 'id' : 'participant_id'} = ?`).get(pid).n)])),
    auditFor: pid => q('SELECT at, actor, action, outcome, detail_json FROM audit WHERE participant_id = ? ORDER BY id').all(pid),
    allAudit: () => q('SELECT * FROM audit ORDER BY id').all(),
  };
}
