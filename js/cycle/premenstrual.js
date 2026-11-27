// Her premenstrual pattern: symptoms that come back before her periods, from her OWN logs only (flag
// premenstrualPatterns, off by default; product owner, 2026-11-27).
//
// The app uses the C-PASS rule (Eisenlohr-Moul et al. 2017, calibrated against expert clinical diagnosis): in each of
// her last 3 cycles with logs, the average on days -7..-1 before her period is at least 30% of the scale above the
// average on cycle days 4..10. Chosen over the strict ACOG rule below after the synthetic comparison
// (docs/premenstrual-patterns.md): both kept false patterns below 1%, but the strict rule found only 13-16% of
// patterns (one occasional symptom in the week after cancelled a cycle) against 32-35% for C-PASS.
// The strict ACOG rule, kept for comparison, from published criteria:
//   • ACOG's PMS criteria: one or more symptoms in the 5 days before the period, in each of 3 cycles, eased within 4
//     days of the period starting and not back before cycle day 13. So a symptom counts as her pattern only if, in
//     each of her last 3 cycles where she logged it, it was notable in the 5 days before her period and NOT notable on
//     cycle days 5 to 12.
//   • ACOG Clinical Practice Guideline No. 7 (2023): timing is the key, from a symptom log kept over several cycles.
//   • Daily ratings, as in the Daily Record of Severity of Problems (DRSP; Endicott et al. 2006).
// Cycles are counted BACKWARDS from each period start, so the pattern shows even when her cycle length varies (the
// older pattern finder, patterns.js, counts forwards from day 1). A cycle she did not log in both windows is unknown
// and skipped, never counted as "didn't happen". This describes her own logs; it is not a diagnosis.
import { addDays, human } from './dates.js';
import { CATEGORIES, CycleError, cycles, categoryOn, restartDate, logDay, hasConsent } from './model.js';
import { pregnantSpans, inLatestPeriod } from './checkins.js';
import { askAllowed, recordNotNow, recordAnswer } from './asks.js';

export const PREMENSTRUAL_VERSION = 'premenstrual-0.1.0';
export const REVIEW_STATUS = 'awaiting_clinician_review';
export const PMS_RULE = Object.freeze({ BEFORE_DAYS: 5, AFTER_FROM_DAY: 5, AFTER_TO_DAY: 12, MIN_CYCLES: 3, RECENT: 6, MAX_QUESTIONS: 3,
  note: 'Windows and the 3-cycle minimum from ACOG\'s PMS criteria; RECENT (last 6 usable cycles) and MAX_QUESTIONS (3) are app choices.' });
/** C-PASS (Eisenlohr-Moul et al. 2017): in a cycle, the average score on days -7..-1 before the period is at least 30%
 *  of the scale's range above the average on cycle days 4..10. Kept here for the synthetic comparison
 *  (tools/premenstrual-eval.mjs); which rule the app uses is the product owner's decision. */
export const CPASS_RULE = Object.freeze({ BEFORE_DAYS: 7, AFTER_FROM_DAY: 4, AFTER_TO_DAY: 10, ELEVATION: 0.30, MIN_CYCLES: 3, RECENT: 6,
  note: 'Windows and the 30% elevation from C-PASS (calibrated against expert diagnosis); 3 cycles from ACOG (C-PASS needs 2).' });
/** Severity scores for the C-PASS comparison: graded symptoms use their order; the others count 1 for a notable answer. */
const GRADED = { cravings: ['none', 'some', 'strong'], pain: ['none', 'mild', 'moderate', 'severe'], bloating: ['none', 'mild', 'moderate', 'severe'], breasts: ['none', 'mild', 'moderate', 'severe'], headache: ['none', 'mild', 'moderate', 'severe'] };
const score = (cat, v) => GRADED[cat] ? GRADED[cat].indexOf(v) / (GRADED[cat].length - 1) : (CATEGORIES[cat].notable.includes(v) ? 1 : 0);
const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
export const DEFAULT_RULE = 'cpass';
const ruleOf = name => (name === 'acog' ? PMS_RULE : CPASS_RULE);
export const SOURCES = [
  { title: 'Management of Premenstrual Disorders. ACOG Clinical Practice Guideline No. 7', journal: 'Obstet Gynecol 2023;142(6):1516-1533', doi: '10.1097/AOG.0000000000005426' },
  { title: 'Premenstrual syndrome. ACOG Practice Bulletin No. 15 (criteria as summarised in Am J Manag Care 2005)', url: 'https://www.ajmc.com/view/dec05-2235ps473-s479' },
  { title: 'Toward the reliable diagnosis of DSM-5 premenstrual dysphoric disorder: the Carolina Premenstrual Assessment Scoring System (C-PASS)', journal: 'Am J Psychiatry 2017;174(1):51-59', authors: 'Eisenlohr-Moul TA, Girdler SS, Schmalenberger KM, et al.', doi: '10.1176/appi.ajp.2016.15121510' },
  { title: 'Daily Record of Severity of Problems (DRSP): reliability and validity', journal: 'Arch Womens Ment Health 2006;9(1):41-9', authors: 'Endicott J, Nee J, Harrison W', doi: '10.1007/s00737-005-0103-y' },
];
/** Symptoms this looks at (not training, and not the pregnancy, postpartum or midlife groups). */
export const SYMPTOMS = Object.freeze(['cravings', 'appetite', 'sleep', 'mood', 'energy', 'pain', 'bloating', 'breasts', 'headache']);
const NOT_APPLICABLE = ['pregnant', 'postpartum', 'hormonalContraception'];
export const PMDD_NOTE = 'Mood changes that come back before your period every cycle, and get in the way of daily life, have a name: premenstrual dysphoric disorder (PMDD). Treatments help, so it is worth talking to a doctor. If you ever have thoughts of harming yourself, get help straight away.';
export const OTHER_CAUSES = 'Stress, illness, travel, alcohol or a bad night can cause the same things.';

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const listOf = xs => xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`;

/** Her premenstrual pattern so far. Never changes data. opts.rule: 'cpass' (the app's rule) or 'acog' (comparison). */
export function premenstrualPatterns(s, today, { rule = DEFAULT_RULE } = {}) {
  const R = ruleOf(rule);
  if (!hasConsent(s)) return null;
  const base = { version: PREMENSTRUAL_VERSION, reviewStatus: REVIEW_STATUS, ruleName: rule, rule: ruleOf(rule), needed: ruleOf(rule).MIN_CYCLES };
  if (s.pregnancy || NOT_APPLICABLE.some(k => s.situation?.[k])) return { ...base, status: 'not_applicable', patterns: [], text: 'Not used in pregnancy, after a birth, or on hormonal contraception (bleeds on hormonal contraception are not periods).' };
  const cats = SYMPTOMS.filter(k => categoryOn(s, k));
  if (!cats.length) return { ...base, status: 'off', patterns: [], text: `Turn on the symptoms you'd like to track (for example ${SYMPTOMS.slice(0, 4).map(k => CATEGORIES[k].label.toLowerCase()).join(', ')}). After ${ruleOf(rule).MIN_CYCLES} cycles, you'll see which ones come back before your period.` };
  const since = restartDate(s, today), spans = pregnantSpans(s);
  const cs = cycles(s).filter(c => c.usable && c.nextStart <= today && (!since || c.start >= since) && !spans.some(p => c.start < p.to && c.nextStart > p.from)).slice(-R.RECENT).reverse(); // newest first
  let maxObserved = 0;
  const patterns = [];
  for (const cat of cats) {
    const def = CATEGORIES[cat], notable = v => def.notable.includes(v), observed = [];
    for (const c of cs) {
      const preFrom = addDays(c.nextStart, -R.BEFORE_DAYS);
      const pre = [], post = [];
      for (let d = preFrom; d < c.nextStart; d = addDays(d, 1)) { const v = s.days[d]?.[cat]; if (v != null) pre.push(v); }
      for (let k = R.AFTER_FROM_DAY; k <= R.AFTER_TO_DAY; k++) { const d = addDays(c.start, k - 1); if (d >= preFrom) break; const v = s.days[d]?.[cat]; if (v != null) post.push(v); }
      if (!pre.length || !post.length) continue; // unknown, skipped
      const hit = rule === 'cpass'
        ? pre.some(notable) && mean(pre.map(v => score(cat, v))) - mean(post.map(v => score(cat, v))) >= CPASS_RULE.ELEVATION
        : pre.some(notable) && !post.some(notable);
      observed.push({ start: c.start, hit });
    }
    maxObserved = Math.max(maxObserved, observed.length);
    const last = observed.slice(0, R.MIN_CYCLES);
    if (last.length === R.MIN_CYCLES && last.every(o => o.hit)) {
      patterns.push({ category: cat, label: def.label, notableLabel: def.notableLabel, cycles: last.length, of: last.length, cycleStarts: last.map(o => o.start),
        text: rule === 'acog'
          ? `In ${last.length} of your last ${last.length} cycles with logs, you logged ${def.notableLabel} in the ${R.BEFORE_DAYS} days before your period, and not on days ${R.AFTER_FROM_DAY} to ${R.AFTER_TO_DAY} of your cycle.`
          : `In ${last.length} of your last ${last.length} cycles with logs, you logged ${def.notableLabel} in the ${R.BEFORE_DAYS} days before your period, clearly more than in the week after it (days ${R.AFTER_FROM_DAY} to ${R.AFTER_TO_DAY} of your cycle).` });
    }
  }
  const note = patterns.some(p => p.category === 'mood') ? PMDD_NOTE : null;
  if (patterns.length) return { ...base, status: 'found', patterns, note, text: `Your premenstrual pattern, from your own logs: ${listOf(patterns.map(p => p.notableLabel))}. ${OTHER_CAUSES} This describes your logs; it is not a diagnosis.` };
  if (maxObserved >= R.MIN_CYCLES) return { ...base, status: 'none', patterns: [], note, text: `No symptom you track came back before your periods in each of your last ${R.MIN_CYCLES} cycles with logs.` };
  const more = R.MIN_CYCLES - maxObserved;
  return { ...base, status: 'learning', patterns: [], note, text: `Learning your pattern: ${maxObserved} of ${R.MIN_CYCLES} cycles with symptom logs before and after your period. ${plural(more, 'more cycle')} needed.` };
}

/** In the days before her expected range: a gentle note about her own pattern, with at most 3 one-tap questions.
 *  Shown in the app only (never a notification), once a day, and less often after repeated "Not now". */
export function premenstrualNow(s, today, estimate) {
  const r = premenstrualPatterns(s, today);
  if (r?.status !== 'found' || !estimate?.rangeStart) return null;
  if (s.premenstrual?.done?.[today] || !askAllowed(s, 'premenstrual', today)) return null;
  const R = ruleOf(DEFAULT_RULE);
  if (today < addDays(estimate.rangeStart, -R.BEFORE_DAYS) || today >= estimate.rangeStart) return null;
  if (inLatestPeriod(s, today, estimate)) return null;
  const labels = r.patterns.map(p => p.notableLabel);
  const when = estimate.singleDate ? `on ${human(estimate.rangeStart)}` : `between ${human(estimate.rangeStart)} and ${human(estimate.rangeEnd)}`;
  return { version: PREMENSTRUAL_VERSION, reviewStatus: REVIEW_STATUS, kind: 'premenstrual', patterns: r.patterns, note: r.note,
    text: `Your next period is most likely ${when}. In your last ${R.MIN_CYCLES} cycles, you logged ${listOf(labels)} in the ${R.BEFORE_DAYS} days before your period. If you're noticing ${labels.length === 1 ? 'it' : 'any of these'} now, it may be part of that pattern. ${OTHER_CAUSES}`,
    questions: r.patterns.slice(0, PMS_RULE.MAX_QUESTIONS).map(p => ({ category: p.category, label: CATEGORIES[p.category].label, options: CATEGORIES[p.category].options })) };
}

/** Her one-tap answers. Saves only what she chose; the questions are done for today. */
export function saveQuickLog(s, today, values = {}, { at = new Date().toISOString() } = {}) {
  if (!hasConsent(s)) throw new CycleError('NO_CONSENT');
  const chosen = Object.fromEntries(Object.entries(values).filter(([, v]) => v != null && v !== ''));
  if (!Object.keys(chosen).length || Object.keys(chosen).some(k => !SYMPTOMS.includes(k))) throw new CycleError('INVALID_INPUT');
  logDay(s, today, chosen, { today, at }); // validates each value
  ((s.premenstrual ||= {}).done ||= {})[today] = 'answered';
  recordAnswer(s, 'premenstrual');
  return s;
}
/** "Not now": quiet for today; repeated "Not now" makes it ask less often (asks.js). */
export function dismissPremenstrual(s, today) {
  ((s.premenstrual ||= {}).done ||= {})[today] = 'notNow';
  recordNotNow(s, 'premenstrual', today);
  return s;
}
