# Threat model and privacy checklist

Reproductive health data is treated as **highly sensitive**. This document describes the local prototype, which is **not** a production deployment. Security features are present, but **no regulatory compliance (HIPAA, GDPR or other) is claimed**.

## Assets
- Participant temperature observations and cycle annotations (including LH results and hormonal context)
- Derived results
- Consent records
- Account credentials and sessions
- The audit trail
- Exports

## Trust boundaries and threats
| Threat | Control in this prototype | Residual risk / needed before real use |
|---|---|---|
| Network exposure | Binds to `127.0.0.1` by default. Other addresses are refused unless `RESEARCH_ALLOW_NON_LOCAL=1` (unsupported). No TLS of its own. | A real deployment needs TLS termination, a reviewed host, a firewall and monitoring. |
| Account takeover | scrypt password hashing (N=2¹⁴), minimum 12 characters, 15-minute lockout after 5 failures (wrong passwords **and** wrong codes), login rate limit, the same reply for an unknown user or a wrong password. **Two-factor sign-in** (RFC 6238 codes, each usable once; 10 hashed one-time recovery codes), required for admins and researchers by default. Password change from the Account page (needs the current password and a code); it signs out the other sessions. | No WebAuthn or passkeys (codes can be phished). No password-reuse or breached-password checks. Lockout can be used to annoy a user. |
| Session theft / CSRF / clickjacking | 256-bit random session token, stored hashed. Cookie `HttpOnly; SameSite=Strict; Secure` (on by default). 30-minute idle and 8-hour absolute expiry. CSRF token on every change plus an Origin check. CSP `default-src 'self'`, `frame-ancestors 'none'`, `X-Frame-Options: DENY`. The Account page lists the account's sessions (an opaque ID and times, never the token) and signs out the others. | Sessions live in the same database. An administrator cannot yet end another user's sessions from the UI (the CLI `set-password` ends them). |
| Ambiguous or stale client actions (findings against 21317c5) | Consent, feature and reimport flags must be real Booleans (400 otherwise, no change). The dashboard discards responses from superseded navigations, acts only on the participant rendered on the page, and binds previews to participant, type and file. The server refuses a commit whose type or file differs from its preview (409). | Browser-only checks; tested in Chromium only. |
| Broken access control | Server-side checks on every route. Participants never receive experimental outputs or quarantined cells: `/runs` and `/quarantine` are researcher-only, participant exports omit both, and a central filter strips them from every participant response. Researchers see only participants assigned to them. Participant accounts see only their own data. Admins manage accounts and **cannot read participant data**. A denied record gives the same 404 as a missing one. | Assignment is manual. There is no study-level role model yet. |
| Injection | Parameterised SQL only. A strict CSV parser with no evaluation. Identifier-like formats for every free-text field. HTML-escaped rendering. CSV export neutralises formulas. | |
| Oversized or malicious uploads | 5 MB file limit (7.5 MB body), row, column and cell limits, NUL rejection, JSON-only bodies, upload rate limit | Single process. No antivirus (files are text only). |
| Path traversal | Static files served only from `research/web` with an allow-list of file types | |
| Health data in logs | Logs record request ID, method, route template, status and duration only. Tested: no references, values, filenames, tokens or bodies. | |
| Health data in the audit trail | Audit rows hold an internal participant number, an action and outcome codes, and counts. No values or references. | The audit trail stays after deletion, holding an internal number only. |
| Third parties | No analytics, trackers, CDNs, fonts or external AI calls. The browser test checks that no other host is contacted. | |
| Unsafe output | A central output-policy layer checks every JSON response, export and analysis payload. Forbidden phrases, unmarked experimental outputs, uncalibrated "probability" wording and ovulation-date fields are blocked and replaced with a generic error. Prohibited features cannot be enabled. | The policy is pattern-based. New wording needs new patterns and review. |
| Data at rest | **Field-level encryption** (AES-256-GCM, envelope key). Every sensitive payload is ciphertext bound to its table, column and participant. Comparable values are keyed HMAC indexes. The server refuses to start on a database file without a key. An existing unencrypted database is encrypted in place, and its files are rewritten so no plaintext page remains. `secure_delete` is on. Tested: none of the synthetic payload markers can be found in the database, WAL or SHM files. See `security-operations.md`. | Pseudonymous refs, usernames, consent scope names, record times, counts and audit codes stay readable. The key file and the running process can read everything. Still use full-disk encryption (deleted blocks on the storage medium are outside SQLite's control). No hardware key store. |
| Backups | `cli.mjs backup` writes a consistent snapshot encrypted as a whole with a **separate** backup key and an integrity tag. Backups older than the retention period (default 35 days) are deleted on every backup. A restore always goes to a new file and **re-applies the deletion ledger** (random participant IDs only), so a deleted participant is never brought back. A modified backup or a wrong key writes nothing. | No scheduler (run it from cron). The ledger must be kept on separate storage. No off-site copy or restore drill yet. |
| Deletion | An authorised researcher, or the participant, deletes raw and derived data, consents, features, previews and the participant account and sessions in one transaction. The deletion is recorded in the audit trail without content, and in the deletion ledger as a random ID. | It can't reach exports already downloaded. Backups made before the deletion keep the data until they expire (default 35 days); a restore in that time re-applies the deletion. |
| Secrets | Passwords come from the environment (`RESEARCH_NEW_PASSWORD`). Nothing secret is committed. The demo prints a random local password once. | |

## Privacy checklist
- **Minimisation.**
  - Pseudonymous references only.
  - No names, contact details or dates of birth.
  - Filenames are stored as hashes.
  - Raw samples are kept because research needs them; a production study should set and document retention.
- **Granular consent.**
  - `core_research`, `lh_tests` and `hormonal_context` are separate scopes, each with time-stamped grant and withdrawal records.
  - A researcher can record consent only by confirming a signed form.
  - Any withdrawal invalidates pending import previews, and the commit transaction rechecks consent.
  - Withdrawing `lh_tests` or `hormonal_context` deletes the stored data of that type, including quarantined rows, matched by the stored **canonical** type, whatever the original spelling. Rows submitted without that consent are never retained.
  - Data deleted by a withdrawal is not restored if consent is given again. It can come back only through an explicit, audited reimport of the file under the current consent.
  - Withdrawing core consent stops new imports. What happens to data already collected must be set by the study protocol, and full deletion is available.
- **Adults only.** Participant creation requires an adult confirmation; minors are not supported.
- **Experimental features** are off by default and enabled per participant by a researcher. Each change is audited.
- **No contraceptive features** in the UI, API, exports or feature flags.
- **No real data.** Synthetic fixtures only until research-ethics approval, a data-protection impact assessment, legal review and an approved protocol exist.
- **Done in the prototype (automated tests only, no external review):** field-level encryption at rest, two-factor sign-in, password change, session list and sign-out of other sessions, encrypted backups with retention, and deletions that survive a restore.
- **Not yet done:** an external security review and penetration test, a hosting and TLS review, a backup scheduler and restore drill, incident response, DPIA, records of processing, accessibility review, phishing-resistant sign-in (WebAuthn).
