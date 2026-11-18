# Algorithm card: research inference baseline

**Intended use:** research description of imported temperature and logged cycle data by researchers, in a local prototype, with synthetic data only.

**Out of scope, and unavailable:** contraception, fertility status, conception timing, pregnancy detection, any diagnosis (including anovulation, PCOS or hormone deficiency), hormone-level estimation, and ovulation dates.

**Users:** no minors are supported.

**Status:** unvalidated. Tested on synthetic data only.

## Layers (kept separate in the API and on screen)
| Layer | What it is | Module / version | Default |
|---|---|---|---|
| **Observed** | Imported values (source and °C), nightly quality reports, logged cycle annotations, cycle segmentation | `quality.js` `nightly-quality-1.0.0`, `cycles.js` `segmentation-1.0.0` | on |
| **Descriptive** | Each night's median relative to the median of the person's own first 6 usable nights of the cycle, with a 3-night rolling median | `inference.js` `descriptive-trend-1.0.0` | on |
| **Estimate (experimental)** | Retrospective sustained temperature-shift rule | `sustained-shift-rule-1.0.0` | **off**; a researcher enables it per participant |
| **Forecast (experimental)** | Next period start from logged cycle lengths only | `cycle-length-empirical-1.0.0` | **off**; a researcher enables it per participant |

Participants never see the experimental layers.

## Methods
**Nightly features:**
- Samples are grouped per **stream**: device serial × model × firmware × site × kind × derivation × aggregation. This one canonical identity (`streamId`) is used by quality control, inference segments, the dashboard and provenance. Streams are never pooled, and a change of any part, including the model, is a transition.
- Night: the source's sleep session if one is given, otherwise a configured local window (21:00–09:00).
  - **A whole session gets one label:** the local date of (session start − 12 h), using the UTC offset of the session's first sample. Daytime sleep crossing noon, or a time-zone change during a session, never splits it. An offset change inside a session is flagged.
  - **Without a session**, each sample's own UTC offset handles daylight-saving changes and travel.
- Exclusions: researcher corrections, documented source flags, duplicate timestamps, timestamps after ingestion, and isolated outliers (more than 5 × the scaled median absolute deviation (MAD) from the night's median, with both neighbours not outlying).
- Features: median, MAD, interquartile range (IQR), counts, coverage (union of measurement intervals, or **unknown** if the source gives neither end times nor a sampling interval), largest gap.
- Data-quality level: good / limited / insufficient, with reasons. It describes the measurements only.

**Segmentation:** a cycle starts at a logged `period_start`, or at the first `period` day of a run with no period bleeding in the preceding 5 days. Spotting never starts a cycle. Lengths outside 15–90 days are kept but marked for checking and not used.

**Sustained-shift rule (original baseline):** applied per cycle and per device segment.
1. Take a candidate night *c* and the median *B* of the 6 usable nights before it (at least 5 required).
2. Set the threshold *T* = max(minDelta, 2.5 × 1.4826 × MAD of those nights).
3. *c* qualifies if the 3 usable nights starting at *c* (no calendar gap over 2 nights) are all ≥ *B* + *T*.
4. Report the earliest qualifying night as `shiftNight`.
5. Uncertainty is the calendar range from the night after the last usable night before *c* up to *c*, labelled **uncalibrated**.

**Abstention and wording:**
- **Reported separately (since 21317c5):** `detectionNight` (first night of the first qualifying window), `confirmationNight` (last night of that window) and `possibleOnset`.
  - **possibleOnset:** from the night after the last night at or below the baseline median, to the first observed elevated night. Missing nights are included. If no low night was observed, it is left-censored (`earliestNight` null).
  - **None of these is an ovulation date.**
- **Gap policy (configurable, unvalidated):** the baseline must lie within `maxBaselineSpanNights` (12), and the gap to the candidate night must be at most `maxJoinGapNights` (2). Otherwise the rule abstains (`gap_between_baseline_and_candidate`, `baseline_too_spread`).
- **Further abstention reasons:** a step of at least minDelta inside the nights that form the first baseline (`rise_may_have_begun_during_baseline_formation`), or a first observation far from the cycle start (`no_observations_near_cycle_start`).
- **Value vs timing exclusion:** a value exclusion keeps the sample's timing. A timing exclusion (`exclude_timing`) removes it from placement and session labelling. Samples more than 18 h from their session's median are timing outliers.
- The rule abstains (`insufficient_data`) when:
  - there are too few usable nights;
  - fewer than 60% of the cycle's nights are usable;
  - the device changed within the cycle;
  - the cycle is in progress without a cutoff.
- Nights annotated with illness, fever, disrupted sleep or travel are excluded.
- With adequate data and no qualifying night, the output says: "No clear temperature shift detected in the available data."
- **The shift night is not an ovulation date and is never presented as one.**

**Forecast:**
- Uses cycles completed before the as-of date, from annotations **recorded before** the as-of moment.
- Needs ≥ 4 usable lengths; uses up to the last 12.
- Point: median length after the last start. Range: shortest to longest length. **Not a calibrated interval.**
- Abstains when history is too short, or when no period has been logged for more than the longest cycle + 30 days.

**Reproducibility:**
- Every output records its algorithm version, configuration version and hash, data cutoff, and a SHA-256 of exactly the inputs used.
- An as-of analysis uses only what was known at the cutoff: observations ingested before it, annotations recorded **and** ingested before it, and researcher corrections made before it. The provenance lists the stream identities and the effective corrections, and its hash covers them.
- Runs are stored as new versions and never overwrite earlier ones.
- The same inputs give byte-identical outputs (tested).

## What is verified science, what is an assumption, what is unknown
| Verified (background; see `sources.md`) | Engineering assumptions (configurable, versioned, **need validation**) | Unknown |
|---|---|---|
| Cycle and phase lengths vary widely between and within people (source 2, full text). No 28-day default is used. | Every number in `config.js`: bounds, the 21:00–09:00 window, 12-hour night labelling, minimum samples (6) and coverage (180 min), maximum gap (90 min), jump rate, outlier k (5) and floor, 5-day bleeding-run gap, 15–90-day plausible range, 6/5/3-night shift windows, minDelta 0.25 °C (skin) and 0.20 °C (basal), MAD factor 2.5, 2-night gap tolerance, 60% usable share, forecast minimum of 4 cycles | Whether wrist or finger skin temperature from any specific device shows a usable post-ovulatory change, of what size, and with what noise |
| A temperature rise is **retrospective** evidence. On its own it does not prove ovulation. | Treating the illness, fever, disrupted-sleep and travel annotations as exclusions | Confounding by illness, alcohol, room temperature, bedding, medication or sleep timing in real wear |
| LH tests are an imperfect reference, not an exact time of egg release. | The choice of median / MAD as robust statistics | How any vendor computes "nightly" values; clock drift; real quality flags |
| | | Real abstention, error and false-detection rates in any population |

## Known failure modes (seen on synthetic data)
- **Small rises.** A rise close to the threshold is often missed: in `eval-synthetic.md`, about half of 0.30 °C rises, and many in noisy signals.
- **Unflagged transient spikes.** Fever that is not annotated can trigger the rule. Annotated fever is excluded.
- **Device changes** split a cycle into segments, so the rule abstains rather than compare across devices.
- **Forecast range.** The forecast range is only as wide as recent cycles were, so a new long cycle falls outside it.
