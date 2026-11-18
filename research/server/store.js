// SQLite persistence (node:sqlite, built into Node 22). Every statement is parameterised. Every data query is scoped
// by participant_id, and callers reach it only after the server has authorised access to that participant.
// Raw observations are never updated during analysis; exclusions are separate, reversible correction rows. Derived
// results are stored as versioned runs. deleteParticipant() removes raw AND derived data (deletion rights win over
// immutability); audit rows keep only an internal number and an action name.
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

export const SCHEMA_VERSION = 1;
const SCHEMA = `
PRAGMA foreign_keys = ON; PRAGMA secure_delete = ON; PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS participants (id INTEGER PRIMARY KEY, ref TEXT UNIQUE NOT NULL, adult_confirmed INTEGER NOT NULL CHECK (adult_confirmed = 1), created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, pw_salt BLOB NOT NULL, pw_hash BLOB NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','researcher','participant')), participant_id INTEGER REFERENCES participants(id) ON DELETE CASCADE, created_at INTEGER NOT NULL, failed INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS assignments (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE, PRIMARY KEY (user_id, participant_id));
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, csrf TEXT NOT NULL, created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS consents (id INTEGER PRIMARY KEY, participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE, scope TEXT NOT NULL, granted INTEGER NOT NULL, at INTEGER NOT NULL, by_user INTEGER);
CREATE TABLE IF NOT EXISTS features (participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE, name TEXT NOT NULL, enabled INTEGER NOT NULL, by_user INTEGER, at INTEGER NOT NULL, PRIMARY KEY (participant_id, name));
CREATE TABLE IF NOT EXISTS batches (id INTEGER PRIMARY KEY, participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE, record_type TEXT NOT NULL, format TEXT NOT NULL, source_hash TEXT NOT NULL,
  filename_hash TEXT, extension TEXT, ingest_version TEXT NOT NULL, config_version TEXT NOT NULL, config_hash TEXT NOT NULL, counts_json TEXT NOT NULL, created_at INTEGER NOT NULL, created_by INTEGER, UNIQUE (participant_id, record_type, source_hash));
CREATE TABLE IF NOT EXISTS observations (id INTEGER PRIMARY KEY, participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE, batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  obs_key TEXT NOT NULL, row_hash TEXT NOT NULL, data_json TEXT NOT NULL, ingested_at INTEGER NOT NULL, UNIQUE (participant_id, obs_key));
CREATE TABLE IF NOT EXISTS annotations (id INTEGER PRIMARY KEY, participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE, batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  entry_id TEXT NOT NULL, entry_hash TEXT NOT NULL, data_json TEXT NOT NULL, UNIQUE (participant_id, entry_id));
CREATE TABLE IF NOT EXISTS quarantine (id INTEGER PRIMARY KEY, participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE, batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  line INTEGER, reasons_json TEXT NOT NULL, raw_json TEXT, rejected INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS corrections (id INTEGER PRIMARY KEY, participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE, observation_id INTEGER NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('exclude','restore')), reason TEXT NOT NULL, by_user INTEGER, at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS derived_runs (id INTEGER PRIMARY KEY, participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE, kind TEXT NOT NULL, algorithm_version TEXT NOT NULL,
  config_version TEXT NOT NULL, config_hash TEXT NOT NULL, input_hash TEXT NOT NULL, data_cutoff TEXT, scope TEXT NOT NULL, output_json TEXT NOT NULL, created_at INTEGER NOT NULL,
  UNIQUE (participant_id, kind, scope, algorithm_version, config_hash, input_hash, data_cutoff));
CREATE TABLE IF NOT EXISTS previews (id TEXT PRIMARY KEY, participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE, user_id INTEGER NOT NULL, payload_json TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, at INTEGER NOT NULL, actor INTEGER, action TEXT NOT NULL, participant_id INTEGER, outcome TEXT NOT NULL, detail_json TEXT);
`;
export const CONSENT_SCOPES = ['core_research', 'lh_tests', 'hormonal_context'];
export const FEATURES = ['experimental_shift', 'experimental_forecast'];
const PARTICIPANT_TABLES = ['previews', 'derived_runs', 'corrections', 'quarantine', 'annotations', 'observations', 'batches', 'features', 'consents', 'assignments'];

const hashPw = (pw, salt) => scryptSync(String(pw), salt, 32, { N: 16384, r: 8, p: 1 });
const sha = s => createHash('sha256').update(s).digest('hex');

export function openStore(path = ':memory:', { now = () => Date.now() } = {}) {
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  db.prepare('INSERT OR IGNORE INTO meta (k, v) VALUES (?, ?)').run('schema_version', String(SCHEMA_VERSION));
  const q = (sql) => db.prepare(sql);
  const tx = fn => { db.exec('BEGIN IMMEDIATE'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } };
  const audit = (actor, action, participantId, outcome = 'ok', detail = null) => q('INSERT INTO audit (at, actor, action, participant_id, outcome, detail_json) VALUES (?, ?, ?, ?, ?, ?)').run(now(), actor ?? null, action, participantId ?? null, outcome, detail ? JSON.stringify(detail) : null);

  return {
    db, tx, audit, close: () => db.close(),
    /* ---- users & sessions ---- */
    createUser({ username, password, role, participantId = null }) {
      if (!/^[a-z0-9_.-]{3,40}$/.test(username)) throw Object.assign(new Error('username_invalid'), { code: 'username_invalid' });
      if (String(password).length < 12) throw Object.assign(new Error('password_too_short'), { code: 'password_too_short' });
      const salt = randomBytes(16);
      return Number(q('INSERT INTO users (username, pw_salt, pw_hash, role, participant_id, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(username, salt, hashPw(password, salt), role, participantId, now()).lastInsertRowid);
    },
    verifyLogin(username, password) {
      const u = q('SELECT * FROM users WHERE username = ?').get(String(username));
      const salt = u?.pw_salt ?? randomBytes(16), h = hashPw(password, salt); // same work whether or not the user exists
      if (!u) return { ok: false };
      if (u.locked_until > now()) return { ok: false, locked: true };
      if (!timingSafeEqual(Buffer.from(u.pw_hash), h)) {
        const failed = u.failed + 1; q('UPDATE users SET failed = ?, locked_until = ? WHERE id = ?').run(failed % 5 === 0 ? 0 : failed, failed % 5 === 0 ? now() + 15 * 60e3 : 0, u.id);
        return { ok: false };
      }
      q('UPDATE users SET failed = 0 WHERE id = ?').run(u.id);
      return { ok: true, user: { id: u.id, username: u.username, role: u.role, participantId: u.participant_id } };
    },
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
      return { userId: s.user_id, username: s.username, role: s.role, participantId: s.participant_id, csrf: s.csrf };
    },
    endSession: token => q('DELETE FROM sessions WHERE token_hash = ?').run(sha(String(token || ''))),
    /* ---- participants & access ---- */
    createParticipant({ ref, adultConfirmed }, byUser) {
      if (adultConfirmed !== true) throw Object.assign(new Error('adult_confirmation_required'), { code: 'adult_confirmation_required' });
      return tx(() => { const id = Number(q('INSERT INTO participants (ref, adult_confirmed, created_at) VALUES (?, 1, ?)').run(ref, now()).lastInsertRowid); if (byUser) q('INSERT INTO assignments (user_id, participant_id) VALUES (?, ?)').run(byUser, id); return id; });
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
    setConsent(pid, scope, granted, by) { q('INSERT INTO consents (participant_id, scope, granted, at, by_user) VALUES (?, ?, ?, ?, ?)').run(pid, scope, granted ? 1 : 0, now(), by ?? null); },
    consents(pid) { const out = {}; for (const r of q('SELECT scope, granted FROM consents WHERE participant_id = ? ORDER BY id').all(pid)) out[r.scope] = !!r.granted; return out; },
    consentLog: pid => q('SELECT scope, granted, at FROM consents WHERE participant_id = ? ORDER BY id').all(pid),
    setFeature(pid, name, enabled, by) { q('INSERT INTO features (participant_id, name, enabled, by_user, at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (participant_id, name) DO UPDATE SET enabled = excluded.enabled, by_user = excluded.by_user, at = excluded.at').run(pid, name, enabled ? 1 : 0, by ?? null, now()); },
    features(pid) { const out = Object.fromEntries(FEATURES.map(f => [f, false])); for (const r of q('SELECT name, enabled FROM features WHERE participant_id = ?').all(pid)) if (r.name in out) out[r.name] = !!r.enabled; return out; },
    /* ---- imports ---- */
    existingFor(pid) {
      return {
        batchHashes: new Set(q('SELECT source_hash FROM batches WHERE participant_id = ?').all(pid).map(r => r.source_hash)),
        obsRowHash: new Map(q('SELECT obs_key, row_hash FROM observations WHERE participant_id = ?').all(pid).map(r => [r.obs_key, r.row_hash])),
        entryHash: new Map(q('SELECT entry_id, entry_hash FROM annotations WHERE participant_id = ?').all(pid).map(r => [r.entry_id, r.entry_hash])),
      };
    },
    savePreview(pid, userId, payload) { const id = randomBytes(18).toString('base64url'); q('DELETE FROM previews WHERE created_at < ?').run(now() - 15 * 60e3); q('INSERT INTO previews (id, participant_id, user_id, payload_json, created_at) VALUES (?, ?, ?, ?, ?)').run(id, pid, userId, JSON.stringify(payload), now()); return id; },
    takePreview(id, pid, userId) { const r = q('SELECT * FROM previews WHERE id = ? AND participant_id = ? AND user_id = ? AND created_at >= ?').get(String(id), pid, userId, now() - 15 * 60e3); if (r) q('DELETE FROM previews WHERE id = ?').run(r.id); return r ? JSON.parse(r.payload_json) : null; },
    commitImport(pid, p, userId, annotationHash) {
      return tx(() => {
        if (q('SELECT 1 FROM batches WHERE participant_id = ? AND record_type = ? AND source_hash = ?').get(pid, p.recordType, p.sourceHash)) return { duplicateBatch: true, batchId: null };
        const batchId = Number(q('INSERT INTO batches (participant_id, record_type, format, source_hash, filename_hash, extension, ingest_version, config_version, config_hash, counts_json, created_at, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
          .run(pid, p.recordType, p.format, p.sourceHash, p.sourceFilenameHash, p.sourceExtension, p.ingestVersion, p.configVersion, p.configHash, JSON.stringify(p.counts), now(), userId).lastInsertRowid);
        const t = now();
        if (p.recordType === 'observations') { const ins = q('INSERT OR IGNORE INTO observations (participant_id, batch_id, obs_key, row_hash, data_json, ingested_at) VALUES (?,?,?,?,?,?)'); for (const o of p.accepted) { const { line, ...d } = o; ins.run(pid, batchId, o.obsKey, o.rowHash, JSON.stringify(d), t); } }
        else { const ins = q('INSERT OR IGNORE INTO annotations (participant_id, batch_id, entry_id, entry_hash, data_json) VALUES (?,?,?,?,?)'); for (const a of p.accepted) { const { line, ...d } = a; ins.run(pid, batchId, a.entryId, annotationHash(a), JSON.stringify(d)); } }
        const qi = q('INSERT INTO quarantine (participant_id, batch_id, line, reasons_json, raw_json, rejected) VALUES (?,?,?,?,?,?)');
        for (const x of p.quarantined) qi.run(pid, batchId, x.line, JSON.stringify(x.reasons), JSON.stringify(x.raw ?? null), x.rejected ? 1 : 0);
        return { duplicateBatch: false, batchId };
      });
    },
    batches: pid => q('SELECT id, record_type, format, source_hash, extension, ingest_version, config_version, config_hash, counts_json, created_at FROM batches WHERE participant_id = ? ORDER BY id').all(pid).map(b => ({ ...b, counts: JSON.parse(b.counts_json), counts_json: undefined })),
    observations(pid) {
      const ex = new Map(); for (const c of q('SELECT observation_id, action FROM corrections WHERE participant_id = ? ORDER BY id').all(pid)) ex.set(c.observation_id, c.action === 'exclude');
      return q('SELECT id, data_json, ingested_at FROM observations WHERE participant_id = ? ORDER BY id').all(pid).map(r => ({ ...JSON.parse(r.data_json), id: r.id, seq: r.id, ingestedAt: r.ingested_at, excludedBy: ex.get(r.id) ? 'correction' : null }));
    },
    annotations: pid => q('SELECT data_json FROM annotations WHERE participant_id = ? ORDER BY id').all(pid).map(r => JSON.parse(r.data_json)),
    quarantine: pid => q('SELECT id, batch_id, line, reasons_json, raw_json, rejected FROM quarantine WHERE participant_id = ? ORDER BY id').all(pid).map(r => ({ id: r.id, batchId: r.batch_id, line: r.line, reasons: JSON.parse(r.reasons_json), rejected: !!r.rejected, verbatimSource: JSON.parse(r.raw_json) })),
    addCorrection(pid, obsId, action, reason, by) {
      if (!q('SELECT 1 FROM observations WHERE id = ? AND participant_id = ?').get(obsId, pid)) return false;
      q('INSERT INTO corrections (participant_id, observation_id, action, reason, by_user, at) VALUES (?,?,?,?,?,?)').run(pid, obsId, action, reason, by ?? null, now()); return true;
    },
    corrections: pid => q('SELECT observation_id, action, reason, at FROM corrections WHERE participant_id = ? ORDER BY id').all(pid),
    saveRun(pid, r) {
      q('INSERT OR IGNORE INTO derived_runs (participant_id, kind, algorithm_version, config_version, config_hash, input_hash, data_cutoff, scope, output_json, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .run(pid, r.kind, r.algorithmVersion, r.configVersion, r.configHash, r.inputHash, r.dataCutoff ?? r.asOfDate ?? '', r.cycleStart ?? 'next', JSON.stringify(r), now());
    },
    runs: pid => q('SELECT id, kind, algorithm_version, config_version, config_hash, input_hash, data_cutoff, scope, created_at, output_json FROM derived_runs WHERE participant_id = ? ORDER BY id').all(pid).map(r => ({ ...r, output: JSON.parse(r.output_json), output_json: undefined })),
    /** Authorised deletion of one participant's raw and derived records, accounts and sessions. */
    deleteParticipant(pid, actor) {
      return tx(() => {
        const counts = {};
        for (const t of PARTICIPANT_TABLES) counts[t] = Number(q(`DELETE FROM ${t} WHERE participant_id = ?`).run(pid).changes);
        const users = q("SELECT id FROM users WHERE participant_id = ? AND role = 'participant'").all(pid).map(r => r.id);
        for (const u of users) q('DELETE FROM sessions WHERE user_id = ?').run(u);
        counts.users = Number(q("DELETE FROM users WHERE participant_id = ? AND role = 'participant'").run(pid).changes);
        counts.participants = Number(q('DELETE FROM participants WHERE id = ?').run(pid).changes);
        audit(actor, 'participant_deleted', pid, 'ok', { tables: Object.keys(counts) });
        return counts;
      });
    },
    countsFor: pid => Object.fromEntries([...PARTICIPANT_TABLES, 'participants'].map(t => [t, Number(q(`SELECT COUNT(*) AS n FROM ${t} WHERE ${t === 'participants' ? 'id' : 'participant_id'} = ?`).get(pid).n)])),
    auditFor: pid => q('SELECT at, actor, action, outcome, detail_json FROM audit WHERE participant_id = ? ORDER BY id').all(pid),
    allAudit: () => q('SELECT * FROM audit ORDER BY id').all(),
  };
}
