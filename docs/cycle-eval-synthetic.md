# Cycle estimate evaluation (synthetic)

> **SYNTHETIC DATA. These results test the software only. They are not real-world or clinical performance and must not be quoted as accuracy.**

Frozen config: cohort `synthetic-cohort-1`, seed 20261114, device `Mock Band (synthetic)` firmware `mock-1.0`, baseline `dates-only-1.0.0`, sensor candidate `sensor-candidate-0.1.0+three-over-six-skin-0.1.0-research`.
Participants: 9 development (not scored), 31 held-out test. Leakage self-check: **passed**.

## Period-start estimate (held-out test participants, every day of every scored cycle)

| Model | Slice | Opportunities | No prediction | MAE (days) | ±1 d | ±2 d | ±3 d | Range coverage | Mean width | Mean lead time | Sensor used |
|---|---|---|---|---|---|---|---|---|---|---|---|
| baseline | all | 10590 | 2.9% | 3.17 | 42.2% | 62.9% | 74.8% | 71.5% | 7.4 d | 16.8 d | 0% |
| baseline | cycle day 2 | 338 | 3% | 2.83 | 44.5% | 64.9% | 76.2% | 72.9% | 7.3 d | 31.4 d | 0% |
| baseline | 1–3 days ahead | 1014 | 3% | 2.83 | 44.5% | 64.9% | 76.2% | 72.9% | 7.3 d | 2 d | 0% |
| baseline | 4–7 days ahead | 1352 | 3% | 2.83 | 44.5% | 64.9% | 76.2% | 72.9% | 7.3 d | 5.5 d | 0% |
| baseline | 8–14 days ahead | 2366 | 3% | 2.83 | 44.5% | 64.9% | 76.2% | 72.9% | 7.3 d | 11 d | 0% |
| baseline | 15+ days ahead | 5858 | 2.9% | 3.45 | 40.4% | 61.3% | 73.7% | 70.4% | 7.5 d | 24.3 d | 0% |
| baseline | regular cycles | 4308 | 4.1% | 1.84 | 71.1% | 90.6% | 96% | 79% | 4.2 d | 14.9 d | 0% |
| baseline | variable cycles | 2612 | 5% | 4.56 | 19.2% | 38% | 52.3% | 64.3% | 12 d | 15.7 d | 0% |
| baseline | long cycles | 3670 | 0% | 3.74 | 25.3% | 48.6% | 66.3% | 68% | 7.9 d | 19.6 d | 0% |
| sensor | all | 10590 | 2% | 2.94 | 43.9% | 65.9% | 78.3% | 71.4% | 6.9 d | 16.7 d | 27.4% |
| sensor | cycle day 2 | 338 | 3% | 2.83 | 44.5% | 64.9% | 76.2% | 72.9% | 7.3 d | 31.4 d | 0% |
| sensor | 1–3 days ahead | 1014 | 0% | 2.09 | 50.6% | 74.3% | 87.6% | 72.5% | 5.9 d | 2 d | 83.7% |
| sensor | 4–7 days ahead | 1352 | 0.1% | 2.08 | 50.9% | 74.6% | 87.9% | 73.2% | 5.9 d | 5.5 d | 83% |
| sensor | 8–14 days ahead | 2366 | 1.9% | 2.57 | 45.8% | 68.4% | 80.2% | 72.6% | 6.8 d | 11 d | 33.7% |
| sensor | 15+ days ahead | 5858 | 2.9% | 3.44 | 40.3% | 61.3% | 73.7% | 70.4% | 7.5 d | 24.3 d | 1.5% |
| sensor | regular cycles | 4308 | 2.7% | 1.99 | 64.2% | 86.4% | 94.5% | 77.2% | 4.9 d | 14.8 d | 30.7% |
| sensor | variable cycles | 2612 | 3.7% | 3.74 | 30% | 49.3% | 62.6% | 66.7% | 10.1 d | 15.6 d | 26% |
| sensor | long cycles | 3670 | 0% | 3.47 | 30.3% | 53.9% | 70.7% | 68.1% | 7.2 d | 19.6 d | 24.6% |

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
| dates-only range | 338 | 91.7% | -1 | 2.83 |

Neither prompt records anything: a hit saves the person a tap, a false prompt costs one "Not yet". The wearable-timed prompt looks good here by construction (the synthetic generator puts a temperature step before each period).

`pattern` = the app's personal-pattern rule; `lastCycle` = alert if the same cycle day (±1) was notable last cycle; `baseRate` = alert every day if the person logs "notable" on half or more of their days.
