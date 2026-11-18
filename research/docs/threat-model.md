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
| Account takeover | scrypt password hashing (N=2¹⁴), minimum 12 characters, 15-minute lockout after 5 failures, login rate limit, the same reply for an unknown user or a wrong password | No MFA. No password-reuse checks. Lockout can be used to annoy a user. |
| Session theft / CSRF / clickjacking | 256-bit random session token, stored hashed. Cookie `HttpOnly; SameSite=Strict; Secure` (on by default). 30-minute idle and 8-hour absolute expiry. CSRF token on every change plus an Origin check. CSP `default-src 'self'`, `frame-ancestors 'none'`, `X-Frame-Options: DENY` | No session-revocation UI. Sessions live in the same database. |
| Broken access control | Server-side checks on every route. Participants never receive experimental outputs or quarantined cells: `/runs` and `/quarantine` are researcher-only, participant exports omit both, and a central filter strips them from every participant response. Researchers see only participants assigned to them. Participant accounts see only their own data. Admins manage accounts and **cannot read participant data**. A denied record gives the same 404 as a missing one. | Assignment is manual. There is no study-level role model yet. |
| Injection | Parameterised SQL only. A strict CSV parser with no evaluation. Identifier-like formats for every free-text field. HTML-escaped rendering. CSV export neutralises formulas. | |
| Oversized or malicious uploads | 5 MB file limit (7.5 MB body), row, column and cell limits, NUL rejection, JSON-only bodies, upload rate limit | Single process. No antivirus (files are text only). |
| Path traversal | Static files served only from `research/web` with an allow-list of file types | |
| Health data in logs | Logs record request ID, method, route template, status and duration only. Tested: no references, values, filenames, tokens or bodies. | |
| Health data in the audit trail | Audit rows hold an internal participant number, an action and outcome codes, and counts. No values or references. | The audit trail stays after deletion, holding an internal number only. |
| Third parties | No analytics, trackers, CDNs, fonts or external AI calls. The browser test checks that no other host is contacted. | |
| Unsafe output | A central output-policy layer checks every JSON response, export and analysis payload. Forbidden phrases, unmarked experimental outputs, uncalibrated "probability" wording and ovulation-date fields are blocked and replaced with a generic error. Prohibited features cannot be enabled. | The policy is pattern-based. New wording needs new patterns and review. |
| Data at rest | A local SQLite file (`research/data/`, git-ignored) with `secure_delete` on | **Not encrypted at rest.** Use full-disk encryption locally. Production needs database encryption and key management. |
| Backups | None are made by the prototype | Define encrypted backups, with retention that honours deletion (deleted participants must expire out of backups within a stated period). |
| Deletion | An authorised researcher, or the participant, deletes raw and derived data, consents, features, previews and the participant account and sessions in one transaction. The deletion is recorded in the audit trail without content. | It can't reach exports already downloaded or backups. The UI and API say so. |
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
  - Withdrawing `lh_tests` or `hormonal_context` deletes the stored data of that type, including quarantined rows. Rows submitted without that consent are never retained.
  - Withdrawing core consent stops new imports. What happens to data already collected must be set by the study protocol, and full deletion is available.
- **Adults only.** Participant creation requires an adult confirmation; minors are not supported.
- **Experimental features** are off by default and enabled per participant by a researcher. Each change is audited.
- **No contraceptive features** in the UI, API, exports or feature flags.
- **No real data.** Synthetic fixtures only until research-ethics approval, a data-protection impact assessment, legal review and an approved protocol exist.
- **Not yet done:** encryption at rest, MFA, retention schedule, backup policy, incident response, DPIA, records of processing, penetration test, accessibility review.
