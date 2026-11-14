# Cycle tracking: clinician-led prospective validation plan (draft)

> Draft for a clinical lead to own, revise and submit for ethics approval. Nothing here has started.
> A small feasibility test is **not** proof of clinical accuracy, and no result from another brand's device or
> from our synthetic harness may be presented as this product's performance.

## 1. Questions, as separate endpoints

| # | Question | Primary endpoint | Reference |
|---|---|---|---|
| Q1 | How well does the **dates-only** estimate place the next period start? | Absolute error (days) between the estimated typical date and the observed start; % within ±1/2/3 days; range coverage and width; lead time; % of cycles with no estimate | Prospective daily bleeding diary (participant-confirmed first day of period-type bleeding) |
| Q2 | Does adding wrist-sensor data **improve** Q1 over the dates-only baseline? | Paired difference in Q1 metrics, same participants and cycles | As Q1 |
| Q3 | Does the retrospective temperature rise correspond to ovulation? | Days between rise and reference ovulation; sensitivity and specificity per cycle, including anovulatory cycles | **Clinician-designed** reference, e.g. daily urinary LH (surge day + 1) with serum/urinary progesterone confirmation, and transvaginal ultrasound in a sub-cohort |
| Q4 | Is the phase-education label accurate when shown? | Agreement of the displayed label with the reference phase | As Q3 |
| Q5 | Do pattern-based check-in suggestions beat each person's own simple baselines? | Precision, recall, **false alerts per cycle**, against (a) same-cycle-day-last-cycle and (b) personal base rate | Prospective daily symptom diary |
| Q6 | Safety and acceptability | Misunderstanding of estimates (e.g. read as contraception), anxiety, reminder burden, privacy concerns | Structured interviews and questionnaires |

Irregular cycles (shortest-to-longest variation above the pre-registered threshold), long cycles and adolescents and perimenopausal participants (if included) are **analysed separately**, never only pooled.

## 2. Design
- **Phase A, feasibility** (about 20–30 participants, 3 cycles): data completeness, wear time, device sampling and timestamps, diary burden, and participants' understanding of the copy. Not powered for accuracy and **not reported as accuracy**.
- **Phase B, prospective validation:** observational. Sample size from a power calculation on Q1/Q2 (paired MAE difference), done by a statistician with the clinical lead.
- **Pre-registration** (e.g. on a public registry) of endpoints, thresholds, the analysis plan and the frozen algorithm versions **before** data collection.
- **Frozen system:** one device model and one firmware version for the whole study. App algorithm versions are fixed (`dates-only-1.0.0`, the sensor candidate version). Any change → a new study arm or a new study.
- **Train/test separation:**
  - Any parameter fitting uses a development cohort only.
  - The test cohort is **separate participants**.
  - All predictions are **time-ordered**, using only data before the prediction time; the harness enforces this with `stateAsOf` and a leakage self-check.
- **Run-in:** at least 3 diary-confirmed cycles before scoring, so the personal baseline has history. Report the no-prediction rate separately.

## 3. Participants
- **Inclusion:** adults who menstruate, are willing to wear the device nightly and keep diaries, and give informed consent.
- **Excluded or stratified:** hormonal contraception, pregnancy or trying to conceive with treatment, postpartum ≤ 12 months or breastfeeding, known perimenopause, and conditions or medicines that affect cycles. Collect these as covariates, not as hidden exclusions, so subgroup performance is visible.
- Recruit for diversity in age, BMI, skin tone (optical sensors) and cycle regularity.

## 4. Data handling
- A DPIA is completed first. Collect the minimum, under pseudonymous IDs.
- Encrypt at rest and in transit, with access-controlled storage and a defined retention period.
- No real participant data in development or demo environments.
- Device data is logged with model, firmware, units, timestamps and quality flags. Missing data is reported, never imputed in the primary analysis.

## 5. Analysis (pre-specified)
- **Q1/Q2:**
  - MAE with participant-clustered bootstrap 95% CIs; % within ±1/2/3 days.
  - Range coverage vs nominal (the range is **not** a confidence interval, and the analysis must show what coverage it actually achieves) and mean width.
  - Results by lead-time bucket (1–3, 4–7, 8–14, 15+ days); the no-prediction rate.
  - Regular vs irregular subgroups.
- **Q2:** a paired comparison. The sensor model only "wins" if it improves the error **without** worse coverage or more no-predictions, by a pre-registered margin.
- **Q3:** sensitivity and specificity against the reference, including anovulatory cycles; the distribution of timing error. It is reported as **retrospective** detection only.
- **Q5:** false alerts per cycle are a primary metric; an extra feature must not add alert burden without benefit.
- Missing data: report it as observed. Run sensitivity analyses only as secondary.

## 6. Decision rules
- Turn on **symptomForecast** only if Q5 beats both personal baselines on precision **and** false alerts per cycle.
- Use sensor data in the user-facing period estimate only if Q2 meets the pre-registered margin on the frozen device and firmware, **and** regulatory review agrees the claim.
- Show phase education beyond menstruation only if Q4 meets a clinician-set threshold.
- Make no contraception, fertility, pregnancy-detection or diagnostic claim without a separate regulatory pathway.

## 7. Governance
Clinical lead (gynaecology or reproductive endocrinology), statistician, DPO, ethics committee approval, data-monitoring plan, adverse-event and complaint reporting, participant withdrawal with data deletion, and publication of results whatever they show.

## 8. Tooling already in place
`js/cycle/eval.js` implements the scoring for Q1, Q2, Q3 (as a separate endpoint) and Q5. To use it on study data, replace `makeCohort()` with a loader that produces the same participant shape. Today it runs only on the synthetic cohort, and its output is stamped **SYNTHETIC**.
