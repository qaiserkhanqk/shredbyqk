# Synthetic false-pattern investigation (NOT a real-world error rate)

Rule: {"RECENT":6,"HALF_WINDOW":1,"MIN_OBSERVED":3,"MIN_SHARE":0.75,"MAX_OUTSIDE":0.5}. 200 synthetic people per row, none with a real pattern. Seed 7.

| Complete cycles | Days logged | "Notable" rate | People with ≥1 false pattern (scanning all windows) | False patterns per person | False pattern in ONE pre-chosen window |
|---|---|---|---|---|---|
| 3 | 30% | 10% | 1.5% | 0.01 | 0% |
| 3 | 30% | 15% | 6% | 0.07 | 1% |
| 3 | 30% | 25% | 12% | 0.14 | 0.5% |
| 3 | 60% | 10% | 8% | 0.08 | 1% |
| 3 | 60% | 15% | 19% | 0.22 | 1.5% |
| 3 | 60% | 25% | 68% | 1.01 | 4.5% |
| 3 | 90% | 10% | 22% | 0.24 | 0.5% |
| 3 | 90% | 15% | 55% | 0.74 | 4.5% |
| 3 | 90% | 25% | 91.5% | 2 | 17% |
| 6 | 30% | 10% | 7.5% | 0.07 | 0% |
| 6 | 30% | 15% | 23% | 0.25 | 0.5% |
| 6 | 30% | 25% | 63% | 0.96 | 5.5% |
| 6 | 60% | 10% | 10.5% | 0.11 | 0% |
| 6 | 60% | 15% | 26.5% | 0.31 | 1.5% |
| 6 | 60% | 25% | 78.5% | 1.35 | 6.5% |
| 6 | 90% | 10% | 12% | 0.13 | 0% |
| 6 | 90% | 15% | 38% | 0.44 | 1.5% |
| 6 | 90% | 25% | 94.5% | 2.13 | 14.5% |
