// Operator commands for a local deployment. Secrets are never command-line arguments (they would land in shell
// history): passwords come from RESEARCH_NEW_PASSWORD, codes from RESEARCH_MFA_CODE, keys from key files.
// See research/docs/security-operations.md for the full procedures.
//
//   node research/server/cli.mjs generate-key --out FILE              new 32-byte key file (mode 0600); refuses to overwrite
//   node research/server/cli.mjs make-local-cert --dir DIR            self-signed HTTPS certificate for localhost (key 0600)
//   RESEARCH_NEW_PASSWORD=… … create-user --role admin|researcher --username NAME
//   RESEARCH_NEW_PASSWORD=… … set-password --username NAME            operator reset; ends the account's sessions
//   … enroll-mfa --username NAME                                       prints a secret / otpauth URI to pass on securely
//   RESEARCH_MFA_CODE=123456 … confirm-mfa --username NAME             turns two-factor on; prints 10 recovery codes once
//   … disable-mfa --username NAME                                      operator reset for a lost device (audited)
//   … backup [--dir DIR] [--retention-days N]                          encrypted backup + retention pruning
//   … verify-backup --file FILE
//   … restore --file FILE --to NEW_DB_PATH                             re-applies the deletion ledger
//   … prune-backups [--dir DIR] [--retention-days N]
//   … rotate-key --new-key-file FILE                                   re-wraps the database's data key
// Environment: RESEARCH_DB, RESEARCH_DB_KEY_FILE, RESEARCH_BACKUP_KEY_FILE, RESEARCH_BACKUP_DIR,
//              RESEARCH_BACKUP_RETENTION_DAYS (default 35), RESEARCH_DELETION_LEDGER.
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { openStore, rotateKey } from './store.js';
import { settingsFromEnv } from './server.js';
import { generateKey, writeKeyFile, loadKeyFile } from './keys.js';
import { backup, verifyBackup, restore, pruneBackups } from './backup.js';
import { makeLocalCert, certInfo } from './tls.js';

const arg = k => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
const [cmd] = process.argv.slice(2);
const die = (msg, code = 1) => { console.error(msg); process.exit(code); };
const env = process.env;
const settings = () => { try { return settingsFromEnv(); } catch (e) { die(`Cannot load settings: ${e.code || e.message}`); } };
const backupKey = () => { if (!env.RESEARCH_BACKUP_KEY_FILE) die('Set RESEARCH_BACKUP_KEY_FILE (a key file different from the database key).', 2); try { return loadKeyFile(env.RESEARCH_BACKUP_KEY_FILE); } catch (e) { die(`Backup key: ${e.code || e.message}`); } };
const backupDir = s => arg('dir') || env.RESEARCH_BACKUP_DIR || join(dirname(s.db), 'backups');
const retention = () => Number(arg('retention-days') || env.RESEARCH_BACKUP_RETENTION_DAYS || 35);
function store(s = settings()) {
  if (!s.dbKey && !s.allowUnencrypted) die('Set RESEARCH_DB_KEY_FILE (create one with: node research/server/cli.mjs generate-key --out FILE).', 2);
  try { return openStore(s.db, { key: s.dbKey, ledgerPath: s.ledgerPath }); } catch (e) { die(`Cannot open the database: ${e.code || e.message}`); }
}
const user = (st, name) => st.userByName(name) || die(`No such user: ${name}`);

try {
  switch (cmd) {
    case 'make-local-cert': {
      const dir = arg('dir'); if (!dir) die('usage: make-local-cert --dir DIR', 2);
      const c = makeLocalCert(dir);
      console.log(`Wrote ${c.certPath} and ${c.keyPath} (owner-only). ${certInfo(c.certPath)}\nStart with: RESEARCH_TLS_CERT=${c.certPath} RESEARCH_TLS_KEY=${c.keyPath} npm run research:start\nBrowsers warn once about a self-signed certificate. See research/docs/security-operations.md ("HTTPS").`);
      break;
    }
    case 'generate-key': {
      const out = arg('out'); if (!out) die('usage: generate-key --out FILE', 2);
      if (existsSync(out)) die('Refusing to overwrite an existing key file.');
      writeKeyFile(out, generateKey());
      console.log(`Wrote a new key to ${out} (owner-only). Store a copy offline: without it the encrypted data cannot be read.`);
      break;
    }
    case 'create-user': {
      const pw = env.RESEARCH_NEW_PASSWORD; if (!pw) die('Set RESEARCH_NEW_PASSWORD (at least 12 characters).', 2);
      const st = store(), id = st.createUser({ username: arg('username'), password: pw, role: arg('role') }); st.audit(null, 'user_created_cli', null);
      console.log(`created user ${id}`); st.close(); break;
    }
    case 'set-password': {
      const pw = env.RESEARCH_NEW_PASSWORD; if (!pw) die('Set RESEARCH_NEW_PASSWORD (at least 12 characters).', 2);
      const st = store(); st.setPassword(user(st, arg('username')).id, pw); console.log('Password set; the account\'s sessions were ended.'); st.close(); break;
    }
    case 'enroll-mfa': {
      const st = store(), u = user(st, arg('username')), e = st.mfaBegin(u.id);
      console.log(`Two-factor enrolment started for ${u.username}. Give this to the account holder privately (it is shown once):\n  secret: ${e.secret}\n  ${e.uri}\nThen confirm with a current code: RESEARCH_MFA_CODE=123456 node research/server/cli.mjs confirm-mfa --username ${u.username}`);
      st.close(); break;
    }
    case 'confirm-mfa': {
      const st = store(), u = user(st, arg('username')), r = st.mfaConfirm(u.id, env.RESEARCH_MFA_CODE || '');
      if (!r.ok) die(`Not confirmed: ${r.error}`);
      console.log(`Two-factor is on for ${u.username}. One-time recovery codes (shown once; store them offline):\n${r.recoveryCodes.map(c => `  ${c}`).join('\n')}`);
      st.close(); break;
    }
    case 'disable-mfa': {
      const st = store(), u = user(st, arg('username')); st.mfaDisable(u.id, null); console.log(`Two-factor turned off for ${u.username}. Enrol again before they next sign in if their role requires it.`); st.close(); break;
    }
    case 'backup': {
      const s = settings(); if (!s.dbKey && !s.allowUnencrypted) die('Set RESEARCH_DB_KEY_FILE.', 2);
      const r = await backup({ dbPath: s.db, dbKey: s.dbKey, backupKey: backupKey(), dir: backupDir(s), retentionDays: retention() });
      console.log(`Backup written: ${r.file} (${r.bytes} bytes). Backups past ${retention()} days removed: ${r.pruned}.`); break;
    }
    case 'verify-backup': {
      const f = arg('file'); if (!f) die('usage: verify-backup --file FILE', 2);
      const r = await verifyBackup({ file: f, backupKey: backupKey() });
      if (!r.ok) die('Backup failed its integrity check.');
      console.log(`Backup ok (schema ${r.schemaVersion}, made ${new Date(r.createdAt).toISOString()}).`); break;
    }
    case 'restore': {
      const s = settings(), f = arg('file'), to = arg('to'); if (!f || !to) die('usage: restore --file FILE --to NEW_DB_PATH', 2);
      if (!s.dbKey && !s.allowUnencrypted) die('Set RESEARCH_DB_KEY_FILE (the key the backed-up database used).', 2);
      const r = await restore({ file: f, backupKey: backupKey(), to, dbKey: s.dbKey, ledgerPath: s.ledgerPath });
      console.log(`Restored to ${r.restored}. Deletions re-applied from the ledger: ${r.deletionsReapplied}. Point RESEARCH_DB at it to use it.`); break;
    }
    case 'prune-backups': {
      const s = settings(), r = pruneBackups({ dir: backupDir(s), retentionDays: retention() });
      console.log(`Removed ${r.removed} backups older than ${retention()} days; kept ${r.kept}.`); break;
    }
    case 'rotate-key': {
      const s = settings(), nf = arg('new-key-file'); if (!nf) die('usage: rotate-key --new-key-file FILE', 2);
      if (!s.dbKey) die('Set RESEARCH_DB_KEY_FILE to the CURRENT key.', 2);
      if (!existsSync(nf)) die('The new key file does not exist. Create it first with generate-key.');
      rotateKey(s.db, s.dbKey, loadKeyFile(nf));
      console.log(`Rotated. Now set RESEARCH_DB_KEY_FILE=${nf}. Keep the old key until every backup made before now has expired (restoring those needs it).`); break;
    }
    default: die('usage: node research/server/cli.mjs generate-key|create-user|set-password|enroll-mfa|confirm-mfa|disable-mfa|backup|verify-backup|restore|prune-backups|rotate-key …  (see the header of this file)', 2);
  }
} catch (e) { die(e.code || e.message); }
