# What remains unvalidated, and what is intentionally disabled

## Intentionally disabled or absent (by design, in the UI, the API, exports and feature flags)
- Contraception, contraceptive modes, fertility status or "fertile window", safe or traffic-light days, conception timing.
- **Contraceptive or fertility features cannot be added through the flag system.** `assertFeatureAllowed` refuses those names, and the server accepts only `experimental_shift` and `experimental_forecast`.
- Pregnancy detection, any diagnosis (including anovulation, PCOS or hormone deficiency), hormone-level estimates.
- Ovulation dates or timing in any user-facing view. The shift rule's night is labelled a temperature-pattern marker.
- Experimental estimates and forecasts for participants. Researchers see them only after enabling them per participant.
- Minors (participant creation requires an adult confirmation).
- Vendor integrations, including the SWL DS07: stubs only.
- Machine learning: interface and card validator only; no model.
- The state-space model from arXiv 1606.02536: not implemented, because the paper could not be read.
- Network exposure: local-only binding.

## Unvalidated
| Item | Why it is unvalidated | What would validate it |
|---|---|---|
| Every threshold in `research/lib/config.js` (version `research-config-0.1.0`) | Engineering assumptions chosen for synthetic data | Device studies and the prospective study in `evaluation-plan.md` |
| Nightly quality levels and outlier rules | Synthetic noise only | Reference wear diaries and actigraphy on real devices |
| The sustained-shift rule | Synthetic events only. It misses about half of near-threshold rises and many noisy ones (`eval-synthetic.md`). | Independent references (LH, ultrasound) in an approved study |
| The forecast's empirical range | Not calibrated. Synthetic coverage of 77% describes independent synthetic lengths only. | Locked test-set coverage on real data |
| The output-policy word list | Pattern-based; reviewed by engineering only | Clinical and legal review of all wording, and user testing |
| Security controls, including encryption at rest, two-factor sign-in and backups | Automated tests only; no penetration test or cryptographic review | External security review |
| Accessibility of the dashboard | Not tested | Screen-reader and keyboard audit |
| Browsers | Chromium (headless) only | Firefox, Safari, mobile |

## Known defects and limitations (current)
- **Storage:**
  - `node:sqlite` is marked experimental in Node 22 and prints a warning.
  - Encryption at rest is field-level: pseudonymous refs, usernames, consent scope names, record times, counts and audit codes stay readable (see `security-operations.md`).
  - The rate limiter is in-memory and per process.
  - Backups need an external scheduler; no restore drill has been run outside the tests.
- **Accounts and consent:**
  - No account removal for researchers, and no UI for an administrator to end another user's sessions.
  - Two-factor uses time-based codes, not WebAuthn or passkeys.
  - Assignments are made through the API only; there is no UI for them.
  - Withdrawing core consent blocks new imports and clears pending previews but does not delete existing data; the study protocol must define retention after withdrawal. (Withdrawing LH or hormonal consent does delete that data.)
  - Concurrent consent withdrawal and commit (or reimport) from two processes on one database file is untested (single-process tests only).
  - Canonical annotation types cover spacing, case and hyphen variants only. A synonym (for example "ovulation test") is `type_invalid`, kept in quarantine like any unrecognised row, and not caught by an LH withdrawal purge.
  - Rows rejected for missing consent can come back only by reimporting the original file (their cells were never kept).
- **Imports and exports:**
  - A preview is stored for up to 15 minutes (it is participant-scoped and deleted on commit, expiry, any consent withdrawal or participant deletion).
  - The CSV export's label line comes before the header; strict CSV readers need to skip the first line.
  - Observation `timestamp_after_ingestion` exclusion uses a 5-minute tolerance (an assumption).
- **Analysis:** an unannotated multi-night fever can trigger the shift rule, as the tests document.
- **Unvalidated engineering assumptions added with the 21317c5 fixes:**
  - maximum sampling interval 3600 s;
  - session-timing tolerance 18 h;
  - vendor-night completion convention;
  - shift-rule gap limits (2 / 12 nights);
  - minDelta as the baseline-formation step;
  - deterministic resolution of branched corrections.
- **Not tested:** two server processes on one database file; migration of large databases.
