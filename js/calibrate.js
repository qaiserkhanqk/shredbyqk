// Accuracy from real weighings.
//
// 1. Personal portion calibration. When someone weighs a photo-logged meal ("I weighed it: 260 g"),
//    we keep the ratio of real grams to the photo's estimate. Once a kind of food (curry, rice,
//    bread…) has 3+ weighings, the median ratio corrects that person's future photo portions. People
//    serve themselves consistently, and the camera misjudges the same katori the same way, so this
//    removes most of the systematic portion error.
// 2. The validation study. QK weighs real plates (and the oil, when cooking), snaps them, and exports
//    the pairs as CSV: estimate vs weighed, per dish. That's the evidence for "most accurate on desi
//    food", and the data to re-tune each dish's oil grams.
import { DISH, estimate } from './nutrition.js';

const median = xs => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Weighed photo entries: [{ kind, ratio, entry }]. */
export function weighings(log) {
  return (log || []).filter(e => e.source === 'photo' && e.photoG > 0 && e.weighedG > 0 && e.ref?.t === 'dish' && DISH[e.ref.id])
    .map(e => ({ kind: DISH[e.ref.id].kind, dish: e.ref.id, ratio: e.weighedG / e.photoG, entry: e }));
}

/** Portion correction for a kind of food, or 1 until there are enough weighings. Clamped to ×0.6–×1.6. */
export function portionFactor(log, kind, min = 3) {
  const r = weighings(log).filter(w => w.kind === kind).map(w => w.ratio);
  if (r.length < min) return 1;
  return Math.min(1.6, Math.max(0.6, median(r.slice(-15)))); // the latest 15, so habits can change
}

/** All factors, for showing "QK has learned your portions" in the app. */
export function factors(log) {
  const kinds = [...new Set(weighings(log).map(w => w.kind))];
  return Object.fromEntries(kinds.map(k => [k, { factor: portionFactor(log, k), n: weighings(log).filter(w => w.kind === k).length }]));
}

/** Validation study CSV: one row per weighed photo entry. */
export function studyCSV(log) {
  const rows = [['date', 'dish', 'style', 'photo_servings', 'photo_grams', 'weighed_grams', 'portion_error_pct', 'kcal_from_photo', 'kcal_at_weighed_portion', 'kcal_error_pct', 'oil_weighed_g']];
  for (const w of weighings(log)) {
    const e = w.entry, d = DISH[e.ref.id];
    const atPhoto = estimate(e.ref, { ...e.opts, grams: undefined, servings: e.photoServings ?? e.opts.servings }).kcal;
    const atWeighed = estimate(e.ref, { ...e.opts, grams: e.weighedG }).kcal;
    rows.push([new Date(e.at).toISOString().slice(0, 10), d.name, e.opts.style || '', e.photoServings ?? '', Math.round(e.photoG), Math.round(e.weighedG),
      Math.round((e.photoG - e.weighedG) / e.weighedG * 100), Math.round(atPhoto), Math.round(atWeighed), Math.round((atPhoto - atWeighed) / atWeighed * 100), e.oilG ?? '']);
  }
  return rows.map(r => r.map(v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v).join(',')).join('\n');
}

/** Summary for the study: how far off photo portions were, before and after calibration. */
export function studySummary(log) {
  const w = weighings(log); if (!w.length) return null;
  const err = w.map(x => Math.abs(x.entry.photoG - x.entry.weighedG) / x.entry.weighedG); // relative to the true weight
  return { n: w.length, medianPortionError: Math.round(median(err) * 100), meanPortionError: Math.round(err.reduce((a, b) => a + b, 0) / err.length * 100) };
}
