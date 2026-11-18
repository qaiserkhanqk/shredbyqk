# Cycle estimate evaluation (synthetic)

> **SYNTHETIC DATA. These results test the software only. They are not real-world or clinical performance and must not be quoted as accuracy.**

Frozen config: cohort `synthetic-cohort-1`, seed 20261114, device `Mock Band (synthetic)` firmware `mock-1.0`, baseline `dates-only-1.1.0`, sensor candidate `sensor-candidate-0.1.0+three-over-six-skin-0.2.0-night-aggregated-research`.
Participants: 9 development (not scored), 31 held-out test. Leakage self-check (every test participant, 3 dates each, both models): **passed**.

Cycles scored: 335. Excluded because a period in between was never logged (the true outcome is unknown to the app): 3.
Wearable nights: 11000; by status {"ok":10232,"insufficient_wear":768}; rejected readings by reason {"out_of_range":7437,"invalid":7522}.

"Window coverage" below is how often the true start fell inside the past-cycle window. The app does NOT present that window as a prediction interval: an interval would be derived from held-out data like this, but from a real study, not synthetic data.

## Period-start estimate (held-out test participants, every day of every scored cycle)

| Model | Slice | Opportunities | No prediction | MAE (days) | ±1 d | ±2 d | ±3 d | Window coverage | Mean window width | Mean lead time | Sensor used |
|---|---|---|---|---|---|---|---|---|---|---|---|
| baseline | all | 10395 | 3% | 2.58 | 43% | 64.1% | 76.3% | 66.8% | 6.7 d | 16.5 d | 0% |
| baseline | cycle day 2 | 335 | 3% | 2.55 | 44.9% | 65.5% | 76.9% | 67.1% | 6.6 d | 31 d | 0% |
| baseline | 1–3 days ahead | 1005 | 3% | 2.55 | 44.9% | 65.5% | 76.9% | 67.1% | 6.6 d | 2 d | 0% |
| baseline | 4–7 days ahead | 1340 | 3% | 2.55 | 44.9% | 65.5% | 76.9% | 67.1% | 6.6 d | 5.5 d | 0% |
| baseline | 8–14 days ahead | 2345 | 3% | 2.55 | 44.9% | 65.5% | 76.9% | 67.1% | 6.6 d | 11 d | 0% |
| baseline | 15+ days ahead | 5705 | 2.9% | 2.61 | 41.5% | 63% | 75.7% | 66.6% | 6.8 d | 23.8 d | 0% |
| baseline | regular cycles | 4191 | 4.2% | 1.03 | 73.2% | 93.3% | 98.8% | 70.1% | 3.4 d | 14.5 d | 0% |
| baseline | variable cycles | 2612 | 5% | 4.56 | 19.2% | 38% | 52.3% | 62.1% | 11.2 d | 15.7 d | 0% |
| baseline | long cycles | 3592 | 0% | 2.95 | 25.8% | 49.6% | 67.7% | 66.4% | 7.2 d | 19.2 d | 0% |
| sensor | all | 10395 | 2% | 2.36 | 44.8% | 67.1% | 79.8% | 67.5% | 6.3 d | 16.4 d | 26.7% |
| sensor | cycle day 2 | 335 | 3% | 2.55 | 44.9% | 65.5% | 76.9% | 67.1% | 6.6 d | 31 d | 0% |
| sensor | 1–3 days ahead | 1005 | 0% | 1.82 | 51% | 74.9% | 88.4% | 69% | 5.5 d | 2 d | 83.6% |
| sensor | 4–7 days ahead | 1340 | 0.1% | 1.81 | 51.4% | 75.3% | 88.6% | 69.6% | 5.5 d | 5.5 d | 82.9% |
| sensor | 8–14 days ahead | 2345 | 1.9% | 2.29 | 46.2% | 69% | 81% | 67.9% | 6.2 d | 11 d | 33.1% |
| sensor | 15+ days ahead | 5705 | 2.9% | 2.61 | 41.5% | 63% | 75.7% | 66.6% | 6.8 d | 23.8 d | 0% |
| sensor | regular cycles | 4191 | 2.8% | 1.21 | 66.1% | 88.8% | 97.2% | 69.8% | 4.2 d | 14.4 d | 29.6% |
| sensor | variable cycles | 2612 | 3.7% | 3.74 | 30% | 49.3% | 62.6% | 64.9% | 9.5 d | 15.6 d | 26% |
| sensor | long cycles | 3592 | 0% | 2.69 | 31% | 55% | 72.2% | 66.7% | 6.6 d | 19.2 d | 23.7% |

## Separate endpoint: retrospective temperature rise vs the generator's synthetic ovulation label

Cycles scored: 369. Rise detected: 93.5%. Nights excluded for non-frozen firmware: 630.
Rise night minus synthetic ovulation (days): median 1, range -2 to 4.
This only checks that the detector behaves as designed on data built to contain a step. A real ovulation endpoint needs a clinician-designed reference protocol.

## Symptom check-in forecast vs personal simple baselines (energy, held-out test)

| Method | Alerts | True | False | False per cycle | Precision | Recall |
|---|---|---|---|---|---|---|
| pattern | 290 | 110 | 180 | 0.53 | 37.9% | 9.5% |
| lastCycle | 1894 | 423 | 1471 | 4.35 | 22.3% | 36.6% |
| baseRate | 0 | 0 | 0 | 0 | –% | 0% |

## Low-effort mode: "Has your period started?" prompt (held-out test)

| Prompt | Cycles | Hit (−1…+2 days) | Median lag (days) | False prompts per cycle |
|---|---|---|---|---|
| wearable-timed | 338 | 85.8% | 1 | 0.03 |
| dates-only range | 338 | 90.2% | -1 | 2.6 |

Neither prompt records anything: a hit saves the person a tap, a false prompt costs one "Not yet". The wearable-timed prompt looks good here by construction (the synthetic generator puts a temperature step before each period).

`pattern` = the app's personal-pattern rule; `lastCycle` = alert if the same cycle day (±1) was notable last cycle; `baseRate` = alert every day if the person logs "notable" on half or more of their days.
