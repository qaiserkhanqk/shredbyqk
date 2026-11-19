# Supplier acceptance report: SYNTHETIC SAMPLE (not a real device)

> **These files are synthetic.** The result shows that the checks run, nothing about any real device.

> Technical acceptance of the supplied files only: it shows whether this platform can use them. It is not evidence of measurement accuracy, clinical usefulness or suitability for any medical purpose, it does not detect or confirm ovulation, and it does not mark any device adapter as verified.

- **Device (as named by the supplier profile):** Synthetic test device (not a real product)
- **Verdict:** not verified
- **Blocking items:** sensor_specification, vendor_processing, offline_storage, sdk_licence, data_ownership_and_cloud, platform_route, vendor_validation_evidence, change_control
- **Report version:** supplier-acceptance-1.0.0; configuration research-config-0.2.0

## Checks run on the files

| Item | Status | Detail |
|---|---|---|
| `files_parse_cleanly`: Every row passes schema validation (no rejected or quarantined rows) | **PASS** | 3456 rows accepted from 3 files. |
| `identity_on_every_record`: Device manufacturer, model, serial and firmware on every record | **PASS** | All 3456 records identify the device and firmware. |
| `utc_offset_on_every_record`: UTC offset at recording time on every sample | **PASS** | All 3456 samples carry a UTC offset. |
| `sampling_interval_declared`: Sampling interval or measurement end time on every sample | **PASS** | Declared interval(s): 300 s; observed median spacing 300 s (for review). |
| `quality_flags_documented`: Only quality flags the supplier documented appear | **PASS** | Flags seen: off_body; all documented. |
| `nights_and_quality`: 10 consecutive nights on 3+ people, ≥90% of worn nights good or limited | **PASS** | 3 of 3 people have 10+ consecutive worn nights (need 3); 36 of 36 worn nights good or limited (100%). |
| `clock_within_2_minutes`: Device timestamps within 2 minutes of a reference clock | **PASS** | 3 pairs; largest difference 30 s (limit 120 s). |
| `off_wrist_flagged`: Known off-wrist periods are flagged (or produce no samples) | **PASS** | 1 removal period: 12 samples inside, all flagged. |
| `firmware_change_detected`: A known firmware change is visible as a stream change | **PASS** | Stream change flagged on 2026-02-07 (1.4.2 → 1.5.0). |
| `time_zone_change_reflected`: A known time-zone change is reflected in the UTC offsets | **PASS** | Offsets change to 540 min from 2026-02-08. |
| `units_confirmed_against_bench`: Declared units agree with a bench reference thermometer | **PASS** | Declared units agree better than the alternative (median \|difference\| 0.1 °C vs 33.013 °C). The size of the difference is for a reviewer to judge; no tolerance is applied. |
| `resync_no_duplicates`: Re-sync of an overlapping period produces no conflicting duplicates | **PASS** | 300 re-sent readings were exact duplicates; 0 new; no conflicts. |

## Supplier answers (need a written answer, then our review)

| Item | Status | Detail |
|---|---|---|
| `sensor_specification`: Sensor site, contact method, units, resolution and stated accuracy (with its conditions) | **NEEDS WRITTEN ANSWER** | Needs a written answer from the supplier. |
| `vendor_processing`: Any filtering, smoothing or gap-filling, and whether it can be disabled | **NEEDS WRITTEN ANSWER** | Needs a written answer from the supplier. |
| `offline_storage`: Retention on the device and the backfill window | **NEEDS WRITTEN ANSWER** | Needs a written answer from the supplier. |
| `sdk_licence`: SDK rights and licence for research use of health data, local processing, export and deletion | **ANSWERED, NOT REVIEWED** | Supplier statement (none (synthetic example)); not yet reviewed by us. |
| `data_ownership_and_cloud`: Whether data passes through a vendor cloud; location, retention, processor terms, sub-processors, deletion | **NEEDS WRITTEN ANSWER** | Needs a written answer from the supplier. |
| `platform_route`: Web Bluetooth GATT profile, native SDK or server API; sandbox with test data | **NEEDS WRITTEN ANSWER** | Needs a written answer from the supplier. |
| `vendor_validation_evidence`: Vendor validation protocol, population and results (does not transfer to our use) | **NEEDS WRITTEN ANSWER** | Needs a written answer from the supplier. |
| `change_control`: Advance notice of firmware or algorithm changes; version pinning for studies | **NEEDS WRITTEN ANSWER** | Needs a written answer from the supplier. |

Pass criteria come from `research/docs/supplier-checklist.md`. Bench differences are reported, not judged against an invented tolerance.
