// Encrypted backups, verification, retention and restore. node built-ins only.
//
// • A backup is a consistent snapshot (SQLite VACUUM INTO) encrypted AS A WHOLE with AES-256-GCM under a separate
//   BACKUP key (it must differ from the database key). Field-level encryption inside the snapshot stays as it is, so a
//   backup is protected by both keys' holders being needed for the payloads, and by the backup key alone for metadata.
// • File format: "RSB1" · uint32 header length · header JSON (authenticated, not secret: format, creation time, schema
//   version) · 12-byte IV · ciphertext · 16-byte tag.
// • Retention: backups older than `retentionDays` are deleted whenever a backup is made (and by pruneBackups). So a
//   deleted participant disappears from backups within the retention period.
// • Restore re-applies every deletion in the deletion ledger (random participant uids only), so restoring an older
//   backup can never bring back someone who was deleted after it was made. Restore refuses to run without a ledger.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync, openSync, readSync, closeSync, chmodSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { join, dirname, basename } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { assertKey, unwrapKey } from './keys.js';
import { openStore } from './store.js';

const MAGIC = Buffer.from('RSB1'), fail = code => Object.assign(new Error(code), { code });
const DAY = 864e5;
const sqlQuote = p => `'${String(p).replace(/'/g, "''")}'`;
/** Overwrites a file with zeros before deleting it (best effort; see the threat model on storage media). */
function shred(path) { try { if (existsSync(path)) { const n = statSync(path).size; if (n) writeFileSync(path, Buffer.alloc(Math.min(n, 64 * 1024 * 1024))); unlinkSync(path); } } catch { /* already gone */ } }
const withUmask = (mask, fn) => { const old = process.umask(mask); try { return fn(); } finally { process.umask(old); } };

/** Reads the (authenticated but not secret) header of a backup file, or null if it is not one. */
export function readBackupHeader(file) {
  let fd; try {
    fd = openSync(file, 'r'); const head = Buffer.alloc(8); if (readSync(fd, head, 0, 8, 0) !== 8 || !head.subarray(0, 4).equals(MAGIC)) return null;
    const n = head.readUInt32BE(4); if (n > 4096) return null;
    const h = Buffer.alloc(n); readSync(fd, h, 0, n, 8);
    return { header: JSON.parse(h.toString('utf8')), headerBytes: h, offset: 8 + n };
  } catch { return null; } finally { if (fd !== undefined) closeSync(fd); }
}

/** Makes an encrypted backup of `dbPath` in `dir`, then prunes backups past the retention period. */
export async function backup({ dbPath, dbKey = null, backupKey, dir, now = Date.now(), retentionDays = 35 }) {
  assertKey(backupKey);
  if (dbKey && Buffer.from(dbKey).equals(backupKey)) throw fail('backup_key_must_differ');
  if (!existsSync(dbPath)) throw fail('database_not_found');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const src = new DatabaseSync(dbPath, { readOnly: true });
  let schemaVersion, encrypted;
  const tmp = join(dir, `.backup-tmp-${randomBytes(8).toString('hex')}.sqlite`);
  try {
    const meta = k => { try { return src.prepare('SELECT v FROM meta WHERE k = ?').get(k)?.v ?? null; } catch { return null; } };
    schemaVersion = Number(meta('schema_version')); encrypted = !!meta('enc_scheme');
    if (encrypted) { if (!dbKey) throw fail('db_key_required'); unwrapKey(dbKey, meta('dek_wrapped')); } // a backup must be restorable with the known key
    withUmask(0o077, () => src.exec(`VACUUM INTO ${sqlQuote(tmp)}`));
  } finally { src.close(); }
  const header = Buffer.from(JSON.stringify({ format: 'rs-backup-1', createdAt: now, schemaVersion, fieldEncryption: encrypted }));
  const lenBuf = Buffer.alloc(4); lenBuf.writeUInt32BE(header.length);
  const stamp = new Date(now).toISOString().replace(/[:.]/g, '-');
  const file = join(dir, `research-backup-${stamp}-${randomBytes(3).toString('hex')}.rsb`), part = `${file}.part`;
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', backupKey, iv);
  cipher.setAAD(Buffer.concat([MAGIC, lenBuf, header]));
  try {
    writeFileSync(part, Buffer.concat([MAGIC, lenBuf, header, iv]), { mode: 0o600 });
    await pipeline(createReadStream(tmp), cipher, createWriteStream(part, { flags: 'a', mode: 0o600 }));
    writeFileSync(part, cipher.getAuthTag(), { flag: 'a' });
    chmodSync(part, 0o600); renameSync(part, file);
  } catch (e) { shred(part); throw e; } finally { shred(tmp); }
  const { removed } = pruneBackups({ dir, retentionDays, now, keep: [file] });
  return { file, bytes: statSync(file).size, createdAt: now, schemaVersion, pruned: removed };
}

/* Decrypts a backup to a temporary file next to `near`; the tag is verified before the caller sees it. */
async function decryptToTemp(file, backupKey, near) {
  assertKey(backupKey);
  const h = readBackupHeader(file); if (!h || h.header.format !== 'rs-backup-1') throw fail('backup_integrity_failed');
  const size = statSync(file).size, ivAt = h.offset, ctAt = ivAt + 12, tagAt = size - 16;
  if (tagAt < ctAt) throw fail('backup_integrity_failed');
  const fd = openSync(file, 'r'), iv = Buffer.alloc(12), tag = Buffer.alloc(16);
  readSync(fd, iv, 0, 12, ivAt); readSync(fd, tag, 0, 16, tagAt); closeSync(fd);
  const lenBuf = Buffer.alloc(4); lenBuf.writeUInt32BE(h.headerBytes.length);
  const d = createDecipheriv('aes-256-gcm', backupKey, iv); d.setAAD(Buffer.concat([MAGIC, lenBuf, h.headerBytes])); d.setAuthTag(tag);
  const tmp = join(near, `.restore-tmp-${randomBytes(8).toString('hex')}.sqlite`);
  try {
    if (tagAt > ctAt) await pipeline(createReadStream(file, { start: ctAt, end: tagAt - 1 }), d, createWriteStream(tmp, { mode: 0o600 }));
    else { writeFileSync(tmp, d.final(), { mode: 0o600 }); }
  } catch { shred(tmp); throw fail('backup_integrity_failed'); }
  return { tmp, header: h.header };
}

/** Decrypts a backup (to a temporary file that is then shredded) and runs SQLite's integrity check. */
export async function verifyBackup({ file, backupKey }) {
  const { tmp, header } = await decryptToTemp(file, backupKey, dirname(file));
  try {
    const db = new DatabaseSync(tmp, { readOnly: true });
    try {
      const integrity = db.prepare('PRAGMA integrity_check').get();
      const schemaVersion = Number(db.prepare("SELECT v FROM meta WHERE k = 'schema_version'").get()?.v);
      return { ok: Object.values(integrity)[0] === 'ok', schemaVersion, createdAt: header.createdAt, fieldEncryption: header.fieldEncryption };
    } finally { db.close(); }
  } finally { shred(tmp); }
}

/** Reads the uids in a deletion-ledger file (a missing file means no deletions yet). */
export function readLedger(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l).uid; } catch { return null; } }).filter(u => /^[0-9a-f]{32}$/.test(String(u)));
}

/**
 * Restores a backup to a NEW database file `to`, then re-applies every deletion recorded in the ledger file and in
 * the restored database itself. Refuses to overwrite an existing file or to run without a ledger path.
 */
export async function restore({ file, backupKey, to, dbKey = null, ledgerPath, now = Date.now() }) {
  if (existsSync(to)) throw fail('restore_target_exists');
  if (!ledgerPath) throw fail('ledger_required');
  mkdirSync(dirname(to), { recursive: true, mode: 0o700 });
  const { tmp } = await decryptToTemp(file, backupKey, dirname(to));
  try { renameSync(tmp, to); chmodSync(to, 0o600); } catch (e) { shred(tmp); throw e; }
  let s;
  try { s = openStore(to, { key: dbKey, ledgerPath, now: () => now }); }
  catch (e) { for (const f of [to, `${to}-wal`, `${to}-shm`]) shred(f); throw e; }
  try {
    const uids = [...new Set([...readLedger(ledgerPath), ...s.ledgerUids()])];
    const deletionsReapplied = s.reapplyDeletions(uids);
    return { restored: to, from: basename(file), deletionsReapplied, ledgerEntries: uids.length };
  } finally { s.close(); }
}

/** Deletes backups in `dir` whose creation time is older than the retention period. */
export function pruneBackups({ dir, retentionDays = 35, now = Date.now(), keep = [] }) {
  if (!existsSync(dir)) return { removed: 0, kept: 0 };
  let removed = 0, kept = 0;
  for (const f of readdirSync(dir).filter(x => /^research-backup-.*\.rsb$/.test(x))) {
    const path = join(dir, f), h = readBackupHeader(path);
    if (keep.includes(path) || !h || !Number.isFinite(h.header.createdAt) || h.header.createdAt >= now - retentionDays * DAY) { kept++; continue; }
    unlinkSync(path); removed++;
  }
  return { removed, kept };
}
