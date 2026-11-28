# Security operations: keys, two-factor sign-in, backups and restore

This covers the **local research prototype** (`research/`). It is not a production deployment.
- No regulatory compliance is claimed.
- Nothing here has had an external security review.
- **Synthetic data only** until an approved study protocol exists.

All commands use `node research/server/cli.mjs <command>`. Secrets never go on the command line:
- passwords come from `RESEARCH_NEW_PASSWORD`;
- codes come from `RESEARCH_MFA_CODE`;
- keys come from key files.

## What is protected, and how
| Feature | How it works | Limits |
|---|---|---|
| **Encryption at rest** | Every sensitive payload is AES-256-GCM ciphertext: observations, annotations, quarantined cells and reasons, import previews, derived runs, two-factor secrets. Each value has a fresh IV and is bound to its table, column and participant. Values that must stay comparable are keyed HMAC-SHA-256 indexes: observation keys and fingerprints, entry IDs, annotation types, filename hashes, run scopes. Envelope encryption: a random data key encrypts the fields, and your key file only wraps that data key. | **Readable:** pseudonymous participant refs, usernames, consent scope names, timestamps of records (`created_at`, `ingested_at`), counts, audit codes and the database structure. Field-level encryption does not hide how many rows a participant has. While the server runs, the key is in memory. |
| **Two-factor sign-in** | Time-based codes (RFC 6238, the scheme authenticator apps use). Required for admins and researchers by default; optional for participants. Each code works once. 10 one-time recovery codes are stored as salted hashes. Wrong codes count towards the 5-attempt lockout. Turning two-factor on, or changing a password, signs out the account's other sessions. | No WebAuthn or passkeys. The secret is shown as text (no QR code, so no third-party service is contacted). |
| **Password change, sessions** | The Account page changes the password (current password, plus a code if two-factor is on). It lists the account's sessions and signs out the others. | No list of devices or locations is recorded (on purpose: less personal data). |
| **Encrypted backups** | A consistent snapshot, encrypted as a whole with a **separate** backup key and integrity-checked on restore. Backups older than the retention period (default 35 days) are deleted whenever a backup is made. | The prototype has no scheduler. Run `backup` from cron or a system timer. |
| **Deletion that survives a restore** | Every deletion appends a random participant ID (never the ref) and a time to the deletion ledger. A restore re-applies every ledger entry before the database is used, and refuses to run without a ledger. | The ledger must survive losing the database. Keep it on **separate storage** from the database (`RESEARCH_DELETION_LEDGER`). |

## First set-up
**1. Create two different keys.** Keep copies offline: without the database key, the data cannot be read.

```bash
node research/server/cli.mjs generate-key --out /secure/research-db.key
```

```bash
node research/server/cli.mjs generate-key --out /secure/research-backup.key
```

**2. Set the environment.** Put the deletion ledger on different storage from the database.

```bash
export RESEARCH_DB=/data/research.sqlite RESEARCH_DB_KEY_FILE=/secure/research-db.key RESEARCH_BACKUP_KEY_FILE=/secure/research-backup.key RESEARCH_BACKUP_DIR=/backups/research RESEARCH_DELETION_LEDGER=/ledger/deletion-ledger.jsonl
```

**3. Create accounts.** Each researcher or admin must have two-factor set up before they can sign in.

```bash
RESEARCH_NEW_PASSWORD='a-long-unique-password' node research/server/cli.mjs create-user --role researcher --username alex
```

```bash
node research/server/cli.mjs enroll-mfa --username alex
```

Give the printed key to the account holder **privately**. They add it to an authenticator app and tell you a current code:

```bash
RESEARCH_MFA_CODE=123456 node research/server/cli.mjs confirm-mfa --username alex
```

The 10 recovery codes are printed once. The account holder stores them offline.

**4. Start the server:**

```bash
npm run research:start
```

It refuses to start on a database file without `RESEARCH_DB_KEY_FILE`. `RESEARCH_ALLOW_UNENCRYPTED=1` overrides this; it is unsupported and must never be used with real data.

An existing unencrypted database is encrypted in place the first time it is opened with a key. The files are then rewritten, so no plaintext page remains in the database file or its write-ahead log.

## Routine operations
**Backup.** Run daily from a scheduler. Old backups past `RESEARCH_BACKUP_RETENTION_DAYS` (default 35) are deleted at the same time.

```bash
node research/server/cli.mjs backup
```

**Verify a backup.** This decrypts it to a temporary file, runs SQLite's integrity check, then overwrites and deletes the temporary file.

```bash
node research/server/cli.mjs verify-backup --file /backups/research/research-backup-….rsb
```

**Restore** always goes to a new file and re-applies the deletion ledger:

```bash
node research/server/cli.mjs restore --file /backups/research/research-backup-….rsb --to /data/research-restored.sqlite
```

**Rotate the database key.** The data key is re-wrapped; the data itself is not rewritten.

```bash
node research/server/cli.mjs generate-key --out /secure/research-db-2.key
```

```bash
node research/server/cli.mjs rotate-key --new-key-file /secure/research-db-2.key
```

Then point `RESEARCH_DB_KEY_FILE` at the new file. **Keep the old key until every backup made before the rotation has expired**: restoring those backups needs it.

**Lost device.** An operator turns two-factor off, then enrols the account again:

```bash
node research/server/cli.mjs disable-mfa --username alex
```

**Forgotten password.** This also ends all of the account's sessions:

```bash
RESEARCH_NEW_PASSWORD='…' node research/server/cli.mjs set-password --username alex
```

## HTTPS (needed for Safari)
**Why:** Safari does not keep `Secure` cookies on plain http, even on `127.0.0.1`. Over plain http, sign-in therefore fails in Safari (`docs/browser-test-report-2026-11-25.md`, finding 3). HTTPS fixes this and keeps the `Secure` cookie default.

**Quick demo:**

```bash
npm run research:demo:https
```

- A fresh self-signed certificate is made in `research/data/demo-tls/` (git-ignored).
- The browser warns once.
  - Safari: "Show Details" → "visit this website".
  - Chrome: "Advanced" → "Proceed".

**A real instance:**
1. Make a certificate:

   ```bash
   node research/server/cli.mjs make-local-cert --dir research/data/tls
   ```

   This writes `cert.pem` and `key.pem` (owner-only, never overwritten) for `localhost`, `127.0.0.1` and `::1`.
2. Start with:

   ```bash
   RESEARCH_TLS_CERT=research/data/tls/cert.pem RESEARCH_TLS_KEY=research/data/tls/key.pem npm run research:start
   ```

   The server prints its `https://` address.

**No warning at all:** use a locally trusted certificate instead of the self-signed one. For example, mkcert:
1. Run `mkcert -install` once per computer. This installs a local certificate authority on that computer only.
2. Run `mkcert localhost 127.0.0.1 ::1`.
3. Point `RESEARCH_TLS_CERT` and `RESEARCH_TLS_KEY` at the two files, then `chmod 600` the key.

**Rules:**
- The key must be readable by its owner only, or the server refuses to start (`tls_key_permissions`).
- Both variables are needed, or neither (`tls_incomplete`).
- Over HTTPS the server sends `Strict-Transport-Security: max-age=86400` (one day, no subdomains).
- Plain http on the HTTPS port is not served.

**Not covered:** certificates for a server reachable from other machines. That needs a reviewed hosting set-up (see "Not done yet").

## Deletion and backups: what a participant should be told
- Deleting a participant removes their raw and derived data from the live database at once.
- Their data remains only in backups made before the deletion. Those backups are deleted within the retention period (default 35 days).
- If a backup is restored in that time, the deletion is re-applied before anyone can use the restored database.
- Exports that were already downloaded are outside this system.

## Not done yet (needed before real participants)
- An external security review and penetration test.
- A reviewed hosting set-up: TLS, firewall, monitoring, and full-disk encryption on every host and backup medium.
- An operating-system keychain or hardware key store instead of key files.
- A scheduled, monitored backup job, and a tested restore drill.
- An incident-response plan, a data-protection impact assessment and records of processing.
- WebAuthn or passkeys, if the study wants phishing-resistant sign-in.
