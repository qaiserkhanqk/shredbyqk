# ML extension: interface and evaluation specification

**No trained model exists.** `research/lib/ml.js` defines a model-card validator and a registry that **refuses** any model not meeting the requirements below. `predict()` throws `no_trained_model`. ML is not part of the minimum viable product.

## A model can be registered only if its card states:
- **Intended use and population.** An explicit intended use and target population, and the uses that are out of scope. Contraceptive, fertility-status, pregnancy or diagnostic uses are refused.
- **Data.** Documented consent and dataset provenance.
- **Splits.** Participant-disjoint splits, a temporal evaluation, and confirmation that the test set was never used for tuning.
- **Labels.**
  - Labels come from an **independent** reference suited to the question, never from the model being evaluated.
  - LH-based labels must be described as an **imperfect reference**, not an exact time of egg release.
- **Evaluation.** Subgroup analysis by device site, at least, plus device model.
- **Frozen artefact.** A SHA-256 of the artefact, a version and an owner. Updates are controlled releases with a new version and a new evaluation.
- **No online learning.** `onlineLearning: false`; production users' data never retrains a model automatically.

These rules are tested in `research/tests/extensions.test.mjs`.

## Evaluation requirements
The same requirements as `evaluation-plan.md`:
- metrics with endpoint, denominator, reference and exclusions;
- clustered confidence intervals;
- the abstention rate reported beside the conditional error;
- calibration measured before any interval is described as a probability;
- no benchmark against labels the model produced itself.
