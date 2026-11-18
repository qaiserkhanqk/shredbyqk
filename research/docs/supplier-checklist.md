# Supplier integration checklist

No vendor API or SDK is implemented or assumed. `research/lib/adapters.js` contains stubs (including `SWL DS07 (stub)`). They refuse to import and return the questions below. Each item needs a written answer from the supplier and our own verification before an adapter is written.

| Area | What we need | How we would verify it |
|---|---|---|
| **Timestamped temperature access** | Per-sample skin temperature with UTC epoch timestamps and the device UTC offset at recording time, or a clearly documented vendor-derived nightly value (method, window, exclusions) | Sample export from 10+ test nights. Compare it with our own nightly summary. |
| **Sampling** | Interval during sleep; whether sampling stops outside detected sleep; behaviour when off the wrist | Nights with known wear and removal times |
| **Sensor** | Site (wrist or finger), contact method, units, resolution, stated accuracy and the conditions of that claim | Bench test against a reference thermometer at controlled skin temperature |
| **Identity** | Device ID, model and firmware on every record; a notice when firmware changes | Firmware update during a test |
| **Quality signals** | Definitions of off-wrist, contact, motion and error codes. We use only the signals that are documented. | Remove the device mid-night; induce motion |
| **De-duplication** | Stable sample IDs or sequence numbers; retransmission behaviour | Interrupted and repeated sync |
| **Clock and time zones** | Drift, how the device resynchronises, behaviour when offline, time-zone changes | Compare with a reference clock; airplane-mode test; time-zone change test |
| **Offline storage** | Retention on the device and the backfill window | Skip syncing for N days |
| **Processing** | Any filtering, smoothing or gap-filling the vendor applies, and whether it can be disabled | Compare raw and derived outputs |
| **SDK rights and licence** | Terms allowing research use of health data, local processing, export and deletion; no lock-in on derived data | Legal review |
| **Data ownership and cloud** | Whether data must pass through a vendor cloud; where it is stored and for how long; processor terms (a DPA); sub-processors; deletion on request | Legal and privacy review |
| **Platform route** | Web Bluetooth GATT profile, native SDK (needs a native wrapper), or server API; a sandbox with test data | Prototype connection |
| **Validation evidence** | Any vendor validation against a reference: protocol, population and results. A vendor's claims do not transfer to our use without our own testing. | Read the protocol; replicate a subset |
| **Change control** | Advance notice of firmware or algorithm changes; version pinning for studies | Contract term |

**Acceptance before an adapter is marked verified:**
- 10 consecutive nights on 3 or more people, with at least 90% of worn nights giving `good` or `limited` quality;
- timestamps within 2 minutes of a reference clock;
- off-wrist periods flagged;
- firmware changes detected;
- time-zone changes reflected in the offsets;
- re-sync produces no duplicates;
- units confirmed against a bench reference.

Passing these makes the integration *technically* verified only. It says nothing about clinical usefulness.
