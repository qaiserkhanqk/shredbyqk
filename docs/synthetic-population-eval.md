# Synthetic population: stress test of the cycle estimates

**SYNTHETIC DATA generated from published parameters and stated assumptions. It tests software behaviour only. It is not real-world or clinical performance and must not be quoted as accuracy.**

- Generator `synthetic-population-0.1.0`, seed 20261126: 3000 synthetic people, 41792 cycles, 1055399 band nights, 83584 check points.
- App code under test, unchanged: dates-only `dates-only-2.0.0`; band-adjusted `band-adjusted-0.3.0+three-over-six-skin-0.4.0-night-aggregated-onset-interval-disruptors-research` (research flag, off by default).
- Groups (share is an assumption): afterPregnancy 208, bandChange 159, forgetfulWearer 228, noBand 143, perimenopause 269, regular 1404, teen 316, variable 273.

## Rules checked at every check point
**All passed at all 83584 check points:**
- no dates-only date before a completed cycle;
- no date during pregnancy;
- band adjustment only with fresh band data, outside pregnancy, postpartum and hormonal contraception, with at least 2 past rises, a date after the rise, and nothing from before a pregnancy;
- never for someone without a band;
- estimates never changed her data;
- the dates-only estimate was identical with or without band data (checked on a sample).

## Three days before the real next start
| Group | Checks | Dates-only gave a date | Dates-only average error (days) | Within ±2 days | Real start inside shown range | Band-adjusted used | Band vs dates-only average error, same checks | Real start inside band range |
|---|---|---|---|---|---|---|---|---|
| afterPregnancy | 2704 | 80.3% | 3.32 | 57.3% | 76.9% | 33.1% | 1.69 vs 2.25 | 63.8% |
| bandChange | 2226 | 81.2% | 3.21 | 58.7% | 78.3% | 24.3% | 1.68 vs 2.22 | 60.6% |
| forgetfulWearer | 3192 | 78.9% | 3.43 | 58.4% | 77.2% | 16.7% | 1.73 vs 2.16 | 67.1% |
| noBand | 2002 | 82.6% | 3.02 | 62.3% | 77.9% | 0.0% | – vs – | – |
| perimenopause | 3766 | 51.0% | 7.01 | 31.5% | 57.1% | 33.2% | 2.30 vs 4.69 | 73.1% |
| regular | 19656 | 82.8% | 3.19 | 59.8% | 78.3% | 44.7% | 1.48 vs 2.18 | 78.8% |
| teen | 4424 | 79.8% | 5.94 | 28.1% | 57.0% | 32.8% | 1.76 vs 4.59 | 76.8% |
| variable | 3822 | 61.0% | 7.43 | 20.7% | 48.9% | 32.7% | 1.87 vs 6.52 | 77.9% |
| **All** | 41792 | 77.1% | 4.05 | 51.6% | 72.4% | 35.2% | 1.61 vs 2.84 | 76.1% |

## The day after her period started
| Group | Checks | Dates-only gave a date | Dates-only average error (days) | Within ±2 days | Real start inside shown range | Band-adjusted used | Band vs dates-only average error, same checks | Real start inside band range |
|---|---|---|---|---|---|---|---|---|
| **All** | 20595 | 77.6% | 3.90 | 51.7% | 72.6% | 0.0% | – vs – | – |

This counts only check points where she had already logged the period that day. On 21197 other check points (50.7%) she had not logged it yet (late or missed logging). The app then still shows the previous, now-overdue estimate and asks her to log, which is the intended behaviour, so those are not counted as errors.

## Why the band-adjusted estimate was not used (three days before)
- adjusted: 14702 (35.2%)
- no_rise_yet: 13342 (31.9%)
- rise_ended: 4920 (11.8%)
- too_few_past_rises: 4571 (10.9%)
- band_off: 2002 (4.8%)
- stale_band: 1439 (3.4%)
- new_setup: 478 (1.1%)
- since_pregnancy: 338 (0.8%)

## Generator settings and where they come from
- **LUTEAL**: {"mean":12.4,"personSd":1.2,"withinSd":1,"min":7,"max":17}. Source: bull2019 (SDs: ASSUMPTION, chosen so ~95% fall within 7–17)
- **FOLLICULAR**: {"mean":16.9,"personSd":2.5,"min":10,"max":30,"ageSlopePerYear":-0.19}. Source: bull2019
- **RISE_C**: {"min":0.28,"max":0.56}. Source: goodale2019 (basal temperature; using it for wrist skin temperature is an ASSUMPTION)
- **NO_VISIBLE_RISE**: {"p":0.2}. Source: moghissi1976
- **ANOVULATORY**: {"regular":0.11}. Source: bouchard2026; higher rates for teens, variable cycles and perimenopause are ASSUMPTIONS
- **NIGHT**: {"baseMean":33.8,"baseSd":0.4,"noiseSd":0.12}. Source: ASSUMPTION (matches the app demo band)
- **WEAR**: {"pMissing":0.08,"pPartial":0.04}. Source: ASSUMPTION (no published wear data for the target band)
- **LIFE**: {"pAlcoholNight":0.05,"alcoholRise":0.15,"pMarksAlcohol":0.7,"pIllnessPerCycle":0.03,"illnessRise":0.6,"pMarksIllness":0.6,"pTravelNight":0.01}. Source: ASSUMPTION
- **LOGGING**: {"maxDelayDays":3,"pMissedLog":0.02}. Source: ASSUMPTION
- **GROUPS**: {"regular":0.45,"teen":0.1,"variable":0.1,"perimenopause":0.1,"afterPregnancy":0.07,"forgetfulWearer":0.08,"bandChange":0.05,"noBand":0.05}. Source: ASSUMPTION (a mix chosen to exercise every rule)

### Sources
- **bull2019**: Cycle structure: mean cycle 29.3 days; follicular phase mean 16.9 (95% CI 10–30); luteal phase mean 12.4 (95% CI 7–17); cycle length falls 0.18 days per year of age from 25 to 45. Bull JR et al. npj Digit Med 2019 (https://doi.org/10.1038/s41746-019-0152-7)
- **goodale2019**: Temperature: nightly basal temperature rises 0.28–0.56 °C after ovulation; wrist temperature, heart rate and breathing rate shift by phase. Goodale BM et al. J Med Internet Res 2019 (https://doi.org/10.2196/13404)
- **moghissi1976**: About 20% of ovulatory cycles show no clear temperature rise. Moghissi KS. Fertil Steril 1976 (PMID 1001528)
- **bouchard2026**: About 11% of cycles in regularly cycling women were anovulatory (no ovulation). Bouchard TP et al. Reprod Biomed Online 2026 (https://doi.org/10.1016/j.rbmo.2026.105881)
- **acog651**: Cycles are more variable in the years after the first period. ACOG Committee Opinion No. 651, 2015 (https://doi.org/10.1097/AOG.0000000000001215)
- **straw10**: Early perimenopause: a persistent ≥7-day difference in consecutive cycle lengths; late: ≥60 days without a period. STRAW+10 (see docs/midlife-evidence.md)
- **acog700**: Pregnancy: due date = last period + 280 days. ACOG Committee Opinion No. 700, 2017 (https://doi.org/10.1097/AOG.0000000000002046)

## What this does and does not show
- **It does show** that the app's rules hold across many kinds of synthetic history:
  - regular, teenage, variable and perimenopausal cycles;
  - pregnancy and return of periods;
  - forgetting the band, band and firmware changes;
  - illness, alcohol and travel nights;
  - late and missed logs.
- **Accuracy figures are not real-world accuracy.** The generator encodes our assumptions about how temperature behaves, so a method built on the same assumptions is expected to do well here. Real accuracy needs real data:
  - the Marquette results for dates only: `docs/real-data-eval-marquette.md`;
  - mcPHASES or a prospective study for the band.

