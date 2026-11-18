# Data dictionary and ingestion specification (format v1)

## Files
- **Formats and size.** Two record types, each as **CSV** (header row, RFC 4180 quoting, UTF-8, optional BOM) or **JSON** (`{"records":[…]}` or a bare array). One file per record type. Limits are in `research/lib/config.js` (`limits`).
- **Hard limits:** 5 MB per file, 200,000 rows, 40 columns, 512 characters per cell. Binary content (NUL bytes) is refused.
- **Atomic preview.** A file is parsed and validated in full and shown as a **preview**, with counts and reasons. Nothing is stored until the researcher **commits** it, and commit is one database transaction.
- **Filenames.** The filename is stored only as a SHA-256 hash plus its extension. **No identity is ever taken from a filename.** Every row must carry `participant_ref`, and it must match the participant the import was opened for; otherwise the row is rejected.

## Observation records
| Column | Required | Format / values | Notes |
|---|---|---|---|
| `participant_ref` | yes | `[A-Za-z0-9_-]{4,64}` | Pseudonymous. No names, emails or dates of birth. |
| `timestamp_utc` | for samples | ISO 8601 with `Z` or `±hh:mm` | Missing → quarantined (`timestamp_missing`). |
| `end_timestamp_utc` | no | ISO 8601 | Used for coverage. Must be after the start. |
| `utc_offset_minutes` | for samples | integer, multiple of 15, −720…840 | The device's offset **at recording time**. Missing or invalid → quarantined. Never assumed to be 0. |
| `tz_name` | no | IANA-style name | Informational. |
| `device_manufacturer`, `device_model`, `firmware`, `sampling_config` | model required | `[A-Za-z0-9 ._:+/-]{1,64}` | Identifier-like only, so no free text can enter the UI. |
| `device_serial_pseudonym` | yes | `[A-Za-z0-9_-]{4,64}` | A pseudonym, not the real serial. |
| `sampling_interval_s` | no | positive number | Used for coverage when there is no end time. |
| `sensor_site` | yes | `wrist`, `finger`, `oral`, `ambient`, `other` | |
| `measurement_kind` | yes | `skin_temperature` (wrist / finger / other), `basal_body_temperature` (oral / other), `ambient_temperature` (ambient) | A mismatched site is rejected. Wrist skin is **never** basal or core temperature. |
| `derivation` | yes | `raw`, `vendor_derived` | **No default.** Missing → rejected. |
| `aggregation` | yes | `sample`, `nightly_value` | A `nightly_value` must be `vendor_derived` (a vendor average is not raw data). |
| `night_label` | for `nightly_value` | `YYYY-MM-DD` | The local date of the evening the night began. |
| `value` | yes | number | The source value, stored unchanged. |
| `unit` | yes | °C (`C`, `degC`, `°C`, `celsius`) or °F (`F`, `degF`, `°F`, `fahrenheit`) | Missing or unknown → quarantined. **Never guessed from the value.** |
| `precision` | no | positive number, in the source unit | Kept and converted to °C. |
| `source_quality_flags` | no | `;`-separated `[a-z0-9_]{1,40}` | Only `off_body`, `no_contact` and `sensor_error` exclude samples. Other flags are kept verbatim and not interpreted. |
| `sleep_session_id` | no | `[A-Za-z0-9_.:-]{1,80}` | If present, the source's sleep session decides the night. |

**Stored per observation:**
- source value and unit, °C value (to 0.001), precision in °C, device block, site, kind, derivation and aggregation;
- `obsKey` (identity hash) and `rowHash` (content hash);
- batch ID and ingestion time.

**Rules:**
- **Raw rows are never updated.** A researcher exclusion is a separate, reversible correction (`exclude` or `restore`, with a reason code).
- **Duplicates.** Same `obsKey` and same `rowHash` is a duplicate and is skipped. Same `obsKey` with a different value is quarantined as `conflicting_duplicate`. The same file again is recognised as a duplicate batch.
- **Bounds.** Format and sanity limits per kind, in °C (configurable): skin 20–42, basal 33–40, ambient −40–60. Outside them, a row is quarantined, never deleted. **These are not physiological thresholds.**

## Annotation records
| Column | Required | Values |
|---|---|---|
| `participant_ref` | yes | as above |
| `entry_id` | yes | `[A-Za-z0-9_-]{4,64}`, unique per participant |
| `type` | yes | Read in **canonical form**: trimmed, lower-case, spaces and hyphens folded to `_` (so `" LH-Test "` is `lh_test`). The canonical type is stored (`canonical_type`) and used for consent checks and consent-withdrawal purges. Values: `bleeding` (`period_start`, `period`, `spotting`, `none`), `lh_test` (`positive`, `negative`, `invalid`; **needs consent scope `lh_tests`**), `illness` / `fever` / `disrupted_sleep` / `travel` / `device_change` (`yes`/`no`), `hormonal_medication` (`yes`/`no`; **needs the separate `hormonal_context` consent**) |
| `value` | yes | as above, or `retracted` (with `corrects`) |
| `date` | yes | `YYYY-MM-DD` (local date) |
| `recorded_at` | yes | ISO 8601: when the entry was made (its knowledge time) |
| `corrects` | no | the `entry_id` this entry replaces |

**History and reuse:**
- Annotations are **append-only**. A correction is a new entry, and the history is kept for "as known at time T" views. An entry counts as known at T only if it was both recorded (`recorded_at`) and ingested (its batch's commit time) before T.
- A correction that names itself (`self_correction`), or that closes a loop of corrections within the file or with stored entries (`circular_correction`), is quarantined.
- Re-using an `entry_id` with different content is quarantined.

## Quarantine reason codes
`participant_ref_invalid`, `participant_mismatch`, `sensor_site_invalid`, `measurement_kind_invalid`, `site_kind_mismatch`, `derivation_missing_or_invalid`, `aggregation_invalid`, `nightly_value_must_be_vendor_derived`, `device_model_missing`, `device_serial_pseudonym_invalid`, `value_not_numeric`, `precision_invalid`, `sampling_interval_invalid`, `field_format_invalid:<field>`, `timestamp_missing`, `timestamp_invalid`, `end_timestamp_invalid`, `end_not_after_start`, `utc_offset_missing`, `utc_offset_invalid`, `night_label_missing_or_invalid`, `unit_missing`, `unit_unrecognised`, `out_of_bounds_for_kind`, `conflicting_duplicate`, `entry_id_invalid`, `type_invalid`, `value_invalid`, `retraction_needs_corrects`, `date_invalid`, `recorded_at_missing_or_invalid`, `corrects_invalid`, `self_correction`, `circular_correction`, `lh_tests_not_consented`, `hormonal_context_not_consented`, `entry_id_reused_with_different_content`, `column_count`, `not_an_object`.

**Reimport:** a file already imported is a duplicate batch. A researcher can explicitly **reimport** it with a reason code. Every row is then revalidated under the **current** consent, rows already stored are skipped, and the result is a new batch attempt marked with its reason. Reimports are audited. Granting consent again never restores deleted data by itself.

**Rows without the needed consent:** a row rejected with `lh_tests_not_consented` or `hormonal_context_not_consented` keeps only its line number and reasons. Its cells are not retained in the saved preview, quarantine, database or exports.

**File-level errors:** `empty`, `too_large`, `too_many_rows`, `too_many_columns`, `cell_too_long`, `binary_content`, `unterminated_quote`, `stray_quote`, `duplicate_header`, `invalid_json`, `no_records_array`.

## Fixtures (synthetic)
These are in `research/fixtures/`, with `MANIFEST.json` giving each file's SHA-256, purpose and generator. The tests regenerate them and check they are byte-identical.

| File | Contents |
|---|---|
| `overnight-samples.csv` | individual overnight samples |
| `vendor-nightly.json` | one vendor-derived nightly value |
| `missing-timestamps-units.csv` | missing timestamp, missing and unknown units, invalid offset |
| `mixed-units.csv` | °C and °F mixed |
| `overlap-conflict.csv` | one exact duplicate and one conflicting row |
| `device-tz-change.csv` | device replacement and a time-zone change |
| `annotations-with-correction.csv` | a correction and a retraction |
| `corrupted.csv` | a damaged file |

## Exports
- **JSON:** everything stored for the participant, including verbatim quarantined cells, correction history and derived runs.
- **CSV:** observations with source and normalised values. It starts with a `# Research prototype…` label line. Any cell that a spreadsheet would read as a formula (starting `=`, `+`, `-`, `@`, tab, CR, `|`, `%`; plain numbers excepted) is prefixed with `'`.
