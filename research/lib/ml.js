// Interface for a FUTURE machine-learning component. No model exists and none is trained here. The registry refuses
// any model that lacks the documented model-card fields, is not frozen (content hash), was evaluated on labels made by
// itself, or allows online self-training. See research/docs/ml-evaluation-spec.md.
export const REQUIRED_CARD_FIELDS = ['name', 'version', 'intendedUse', 'targetPopulation', 'outOfScopeUses', 'consentAndProvenance', 'trainingData', 'splits', 'labels', 'evaluation', 'limitations', 'frozenArtifactSha256', 'owner'];

export function validateModelCard(c) {
  const errors = [];
  for (const f of REQUIRED_CARD_FIELDS) if (c?.[f] == null || c[f] === '') errors.push(`missing:${f}`);
  if (c?.splits && c.splits.participantDisjoint !== true) errors.push('splits_not_participant_disjoint');
  if (c?.splits && c.splits.temporal !== true) errors.push('no_temporal_evaluation');
  if (c?.splits && c.splits.testSetUsedForTuning !== false) errors.push('test_set_tuning_not_ruled_out');
  if (c?.labels && c.labels.generatedByThisModel !== false) errors.push('labels_may_come_from_the_model');
  if (c?.labels && /lh/i.test(c.labels.reference || '') && !/imperfect|proxy|not.*exact/i.test(c.labels.notes || '')) errors.push('lh_reference_must_be_described_as_imperfect');
  if (c?.evaluation && !c.evaluation.subgroups?.includes('device_site')) errors.push('no_device_site_subgroup_analysis');
  if (c?.onlineLearning !== false) errors.push('online_self_training_not_disabled');
  if (/contracept|fertil|safe.?day|pregnan|diagnos/i.test(c?.intendedUse || '')) errors.push('prohibited_intended_use');
  if (c?.frozenArtifactSha256 && !/^[0-9a-f]{64}$/.test(c.frozenArtifactSha256)) errors.push('artifact_hash_invalid');
  return errors;
}

export class ModelRegistry {
  #models = new Map();
  register(card) { const e = validateModelCard(card); if (e.length) throw Object.assign(new Error('model_card_invalid'), { code: 'model_card_invalid', errors: e }); this.#models.set(`${card.name}@${card.version}`, Object.freeze({ ...card })); }
  get(name, version) { return this.#models.get(`${name}@${version}`) || null; }
  list() { return [...this.#models.keys()]; }
}
/** The only predictor in this prototype: there is none. */
export function predict() { throw Object.assign(new Error('no_trained_model'), { code: 'no_trained_model' }); }
