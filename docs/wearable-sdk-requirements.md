# Wearable SDK requirements (what a real integration must provide)

**Status of the SWL DS07:** **unverified and not integrated.** We have no SDK, API documentation or test data.
`SwlDs07Adapter` deliberately refuses to connect. Nothing in the app claims it works. Overnight sampling,
timestamps, units, firmware reporting and data access are all **unknown**.

## Required from the vendor / SDK
| Requirement | Why | How we'd verify |
|---|---|---|
| Programmatic access to **raw or clearly labelled vendor-derived** nightly wrist skin temperature, at sample level (preferred) or with documented aggregation | We must show what is measured vs derived | SDK docs + sample export |
| **Sampling during sleep:** interval, and whether sampling continues all night or only during detected sleep | Coverage rules and the 180-minute threshold | 10+ test nights with known wear times |
| **Timestamps:** UTC epoch plus the device's UTC offset at recording time; clock-drift behaviour; behaviour when the phone is offline | Night assignment, travel, ordering | Compare against a reference clock; airplane-mode test; time-zone change test |
| **Units and resolution** (°C/°F, decimal precision), and the sensor's stated accuracy | Normalisation and plausibility ranges | Docs + bench test against a reference thermometer at controlled skin temperature |
| **Device ID, model and firmware version on every record**, and a notice when firmware changes | Segmenting analyses; freezing firmware in studies | Firmware update during a test |
| **Quality signals:** off-wrist / contact detection, motion, sensor error codes | Exclude bad samples instead of guessing | Remove the band mid-night |
| **Duplicate and retransmission behaviour** (sequence numbers or idempotent IDs) | De-duplication | Interrupt sync; re-sync |
| **Backfill window** (how far back data can be fetched) and data retention on the device | Missed-sync handling | Skip syncing for N days |
| Optional HR, HRV (with the method, e.g. RMSSD, and the window) and breathing rate, each marked raw or derived | Optional inputs only | Docs |
| **Licensing / terms** allowing health-data use, with **no vendor cloud upload** required (or one covered by a DPA) | Privacy, GDPR Art. 9 | Legal review |
| A platform route: a Web Bluetooth GATT profile, or a native SDK (which would need a native wrapper; a pure PWA can't use most native SDKs) | Feasibility in this static PWA | Prototype connection |

## Overnight extraction contract (required since 29780c5)
The app builds a nightly summary **only** from readings the source attributes to a **verified main-sleep session**:
- **`sleepSessionId`:** the source's identifier for the sleep period the reading belongs to.
- **`sleepMain: true`:** only when the source classifies that period as the person's main sleep. Naps are not used.
- **No built-in window.** The app has **no built-in sleep window** (no "23:00–07:00"). A shift worker's daytime main sleep is treated like any other, and readings without sleep information are quarantined.
- **Verification needed:** before relying on a vendor's sleep classification, verify it per device against a reference (e.g. a sleep diary and/or actigraphy) for main-sleep detection, start and end times, and naps.
- **Other required fields:**
  - the measurement **`kind`** exactly `raw` or `vendor_derived`; anything else is excluded and never defaulted to raw;
  - a **time-zone offset** in whole minutes, a multiple of 15, within UTC−12:00…UTC+14:00; anything else is quarantined.

## Acceptance checks before setting `verified = true`
1. 10 consecutive nights on 3+ people: ≥ 90% of worn nights produce `ok` summaries, and timestamps align to the reference clock within 2 minutes.
2. Off-wrist periods are flagged and produce no values.
3. Firmware version is reported and changes are detected.
4. A time-zone change is reflected in the recorded offsets.
5. Re-sync produces no duplicates (`mergeNights`).
6. Units are confirmed against a bench reference.

Passing these makes the integration *technically* verified only. It says nothing about clinical usefulness (see the validation plan).

## Adapter contract (implemented in `js/cycle/wearables.js`)
```
capabilities() → { skinTemp, heartRate, hrv, breathing }: 'raw' | 'vendor_derived' | false
connect() / disconnect()
fetchPackets({ from, to }) → [{ deviceId, model, firmware, metric, value, unit, tStart, tEnd, tzOffsetMin, kind, vendorQuality?, seq? }]
```
`MockWearable` implements this with synthetic data for development and the evaluation harness.
