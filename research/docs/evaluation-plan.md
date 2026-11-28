# Evaluation plan for a future, ethically approved prospective study (draft for review)

This is a **draft for a clinical and statistical team to own**. Nothing here has been approved. No real participant may be enrolled until ethics approval, a data-protection impact assessment, consent materials, a registered protocol and a frozen software version exist.

## Questions
1. **Data quality (device):** For a frozen device and firmware, what proportion of worn nights give usable summaries? How do coverage, gaps and quality flags behave against a reference sleep diary or actigraphy?
2. **Sustained-shift rule:** In ovulatory cycles confirmed by an independent reference, how often does the rule report a shift, how far is it from the reference marker, and how often does it report a shift in cycles with no reference-confirmed ovulation?
3. **Forecast:** For next-period start, what are the abstention rate, the conditional error and the empirical-range coverage, compared with simple baselines (last cycle length; the person's median)?

## Design
- **Population.** Adults (18+), with inclusion and exclusion criteria set by the clinical team: for example, not pregnant, not using hormonal contraception, and stated handling of breastfeeding, perimenopause, and known conditions or medicines.
- **Sample size.** To be justified by the statisticians.
- **Devices.** One frozen device model and firmware per arm. Device-site subgroups (wrist versus finger) are analysed separately and never pooled.
- **References** (chosen for each question, each with its stated limitations):
  - urinary LH tests: an imperfect proxy that brackets egg release and does not time it;
  - transvaginal ultrasound in a sub-cohort, where ethics and burden allow;
  - serum progesterone in a sub-cohort, if approved: a supporting reference, not a timestamp;
  - period start dates logged prospectively, with a daily prompt.
- **Pre-registration.** Before unblinding, fix endpoints, tolerance windows, exclusions, handling of missing data, the analysis code version and the configuration hash.
- **Splits.** Participant-disjoint development and test sets. The test set is locked, with no repeated tuning on it. Evaluation is temporal: forecasts use only data before each forecast time, which the harness already enforces.
- **No self-evaluation.** Labels must never come from the rule or model being evaluated.

## Metrics (always with endpoint, denominator, reference and exclusions)
- **Coverage and abstention**, overall and by reason code.
- **Conditional error** among cases with an estimate: mean absolute error, the signed error distribution, and participant-clustered bootstrap confidence intervals.
- **Forecast ranges:** empirical coverage and width. A range is described as calibrated only if coverage was measured on the locked test set.
- **Shift rule:** the share detected within ±k nights of the reference marker, false detections in reference-anovulatory cycles, and abstentions. All are reported side by side.
- **Subgroups:** device, firmware, site, age band, cycle-length band, and confounder-annotated nights.
- **Not allowed:** a single "accuracy" percentage without endpoint, denominator, reference and exclusions.

## Safety monitoring
- Review participant-facing wording with the clinicians, and keep the output-policy layer active.
- Report any adverse events, including distress from data or errors.

## What synthetic results can and cannot show
`research/docs/eval-synthetic.md` shows that the code does what it was designed to do on invented data. It cannot show clinical accuracy, and it must not be used to size claims.
