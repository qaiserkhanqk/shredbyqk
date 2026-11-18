// Central output-policy layer. Every API response, export and dashboard string passes through here, so the safety
// rules are enforced in one place instead of as scattered disclaimers. A violation is a bug: the caller gets a generic
// error, never the offending text, and nothing unsafe is sent.
//
// Rules (from the project brief):
//  • a persistent research label on every payload;
//  • no contraception, fertility-status, conception-timing, diagnostic or hormone-level language;
//  • "no shift found" must never become "you did not ovulate";
//  • experimental outputs must be marked experimental and carry uncertainty and reasons;
//  • contraceptive features do not exist and cannot be switched on.

export const LABEL = 'Research prototype. Not for contraception, diagnosis or medical decisions.';
export const NO_SHIFT_TEXT = 'No clear temperature shift detected in the available data.';
export const POLICY_VERSION = 'output-policy-1.0.0';

/* Forbidden in any outgoing text. Each pattern is matched case-insensitively on word boundaries. Negations are not
   exempt: the product must not say "this is not a safe day" either, because it implies the concept applies. The one
   sanctioned negative sentence is the LABEL, which is added by this layer and checked separately. */
export const FORBIDDEN = [
  ['safe_day', /\bsafe[\s-]*days?\b/i],
  ['infertile', /\b(in|non-?)fertile\b/i],
  ['fertile_status', /\bfertile\s*(day|days|window|phase|status)\b/i],
  ['protected', /\b(un)?protected\b/i],
  ['traffic_light', /\b(green|red)\s*(day|days|light)\b/i],
  ['unprotected_sex', /\b(unprotected|condomless)\s+(sex|intercourse)\b/i],
  ['contraception_advice', /\b(no|without)\s+(need\s+for\s+)?(contraception|protection|condoms?)\b/i],
  ['did_not_ovulate', /\b(did\s*n[o']?t|not)\s+ovulat\w*\b|\banovulat\w*\b/i],
  ['ovulation_date', /\b(ovulat(ed|ion)\s+(on|day|date))\b/i],
  ['pregnancy_claim', /\b(you\s+are|you're|likely|possibly)\s+pregnant\b|\bpregnancy\s+(test|detected|likely)\b/i],
  ['diagnosis', /\b(pcos|polycystic|infertility|hormone\s+deficien\w*|luteal\s+phase\s+defect)\b/i],
  ['hormone_level', /\b(progesterone|oestrogen|estrogen|lh|fsh)\s+(level|concentration)s?\b/i],
];

/** Features that must never exist. Requests to enable them are refused with this code. */
export const PROHIBITED_FEATURES = ['contraception', 'contraceptive_mode', 'fertility_status', 'fertile_window', 'safe_days', 'conception_timing', 'pregnancy_detection', 'ovulation_date_display'];

export class PolicyViolation extends Error {
  constructor(code, path) { super(`policy:${code}`); this.code = code; this.path = path; }
}

/** Throws PolicyViolation if a string breaks a rule. */
export function checkText(text, path = '') {
  if (typeof text !== 'string') return;
  const t = text.split(LABEL).join(' ');
  for (const [code, re] of FORBIDDEN) if (re.test(t)) throw new PolicyViolation(code, path);
}

/** Walk any JSON-like value and check every string (keys included). */
export function checkValue(v, path = '$') {
  if (typeof v === 'string') return checkText(v, path);
  if (Array.isArray(v)) return v.forEach((x, i) => checkValue(x, `${path}[${i}]`));
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { checkText(k, `${path}.${k}`); checkValue(x, `${path}.${k}`); }
}

/** Structural rules for inference outputs (any object with `layer: 'estimate' | 'forecast'`). */
export function checkInference(v, path = '$') {
  if (Array.isArray(v)) return v.forEach((x, i) => checkInference(x, `${path}[${i}]`));
  if (!v || typeof v !== 'object') return;
  if (v.layer === 'estimate' || v.layer === 'forecast') {
    if (v.experimental !== true) throw new PolicyViolation('experimental_unmarked', path);
    if (!Array.isArray(v.reasons) || !v.reasons.length) throw new PolicyViolation('reasons_missing', path);
    if (!['insufficient_data', 'abstained'].includes(v.status) && !v.uncertainty) throw new PolicyViolation('uncertainty_missing', path);
    if (v.uncertainty) {
      // An interval may only be described as a probability / confidence statement if calibration was measured.
      if (typeof v.uncertainty.calibrated !== 'boolean') throw new PolicyViolation('calibration_unstated', path);
      if (v.uncertainty.calibrated && !v.uncertainty.calibrationEvidence) throw new PolicyViolation('calibration_unevidenced', path);
      if (!v.uncertainty.calibrated && /\b\d+\s*%|probabilit|confidence\s+interval|likelihood|chance/i.test(JSON.stringify(v.uncertainty))) throw new PolicyViolation('calibration_claim', path);
    }
    if ('ovulationDate' in v || 'ovulation_date' in v) throw new PolicyViolation('ovulation_date_output', path);
  }
  for (const [k, x] of Object.entries(v)) if (x && typeof x === 'object') checkInference(x, `${path}.${k}`);
}

/** Apply the policy to an outgoing payload: check it and attach the label and policy version. */
export function apply(payload) {
  const out = payload && typeof payload === 'object' && !Array.isArray(payload) ? { ...payload } : { data: payload };
  out.label = LABEL; out.policyVersion = POLICY_VERSION;
  checkValue(out); checkInference(out);
  return out;
}

/** Refuse prohibited feature names regardless of how they are spelled. */
export function assertFeatureAllowed(name) {
  const n = String(name || '').toLowerCase().replace(/[^a-z]+/g, '_');
  if (PROHIBITED_FEATURES.some(p => n.includes(p.replace(/_/g, '')) || n.includes(p))) throw new PolicyViolation('prohibited_feature', name);
}
