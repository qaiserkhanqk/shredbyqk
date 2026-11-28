// Comfort suggestions that learn what helps HER (flag comfortSuggestions, default OFF).
//
// Why this design: what helps period pain differs between people, and the published evidence is averages from
// mostly low-quality trials. So the app does not prescribe. After she logs moderate or severe pain (the pain
// category's own "notable" values) it offers a few LOW-RISK options that have published evidence, asks afterwards
// whether it helped, and orders the options by her own answers. Her record is shown with its denominator.
//
// Never offered: medicines, supplements, doses, diets, calories or weight. Warning signs are always shown, first
// when pain is severe. All wording is a placeholder awaiting clinician review (reviewStatus below).
// Ordering rule (no weights or new numbers): options that helped her at least once come first, by her share of
// "yes" answers (then "a little"); then options she has not answered yet, in the default order; then options she
// answered that never helped.
import { isDate, addDays } from './dates.js';
import { CycleError, hasConsent, categoryOn, CATEGORIES } from './model.js';

export const COMFORT_VERSION = 'comfort-suggest-learn-0.1.0';
export const REVIEW_STATUS = 'awaiting_clinician_review';
export const ANSWERS = { yes: 'Yes', a_little: 'A little', no: 'No' };
/** How many days back "did it help?" is asked (today and the two days before). A UI choice, not a health threshold. */
export const ASK_DAYS = 3;

export const COMFORT_OPTIONS = {
  heat: { label: 'Heat', text: 'A heat pad or hot-water bottle on your lower tummy, or a warm bath.',
    evidence: [{ label: 'Heat therapy for period pain: systematic review (Sci Rep 2018)', url: 'https://doi.org/10.1038/s41598-018-34303-z' }, { label: 'Non-drug options for period pain: network meta-analysis (BMJ EBM 2024)', url: 'https://doi.org/10.1136/bmjebm-2023-112434' }] },
  movement: { label: 'Gentle movement', text: 'Gentle stretching, yoga or a short easy walk, if you feel up to it. Regular exercise over several weeks has the most evidence.',
    evidence: [{ label: 'Exercise for period pain: network meta-analysis of 49 trials (BMC Women\'s Health 2024)', url: 'https://doi.org/10.1186/s12905-024-03453-w' }, { label: 'Non-drug options for period pain: network meta-analysis (BMJ EBM 2024)', url: 'https://doi.org/10.1136/bmjebm-2023-112434' }] },
  warmDrink: { label: 'Warm drink', text: 'A warm drink, such as ginger tea, if you like it.',
    evidence: [{ label: 'Ginger and period pain: systematic review (J Integr Complement Med 2024)', url: 'https://doi.org/10.1089/jicm.2023.0799' }] },
};
export const RED_FLAGS = [
  'Pain so bad you can\'t do your usual things, or pain that doesn\'t ease',
  'Very heavy bleeding (for example, soaking through a pad or tampon every hour) or large clots',
  'Pain between periods, or pain during or after sex',
  'Bleeding between periods or after sex',
  'Feeling faint, dizzy or very unwell, or a high temperature',
  'Your periods or your pain have changed from what is usual for you',
];
export const NOTE = 'Things some people find helpful. This is not medical advice or a treatment, and what helps differs between people, so the app learns from your own answers. If you notice any of the warning signs, talk to a doctor.';

const requireConsent = s => { if (!hasConsent(s)) throw new CycleError('NO_CONSENT'); };
const tries = s => ((s.comfort ||= { tries: [] }).tries ||= []); // for writes
const readTries = s => s.comfort?.tries || []; // reads never change the state
let seq = 0;
const newId = () => `c${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Her own record for one option: answered tries, how many helped (yes) or helped a little. */
export function ownRecord(s, option) {
  const t = readTries(s).filter(x => x.option === option && x.helped);
  const helped = t.filter(x => x.helped === 'yes').length, aLittle = t.filter(x => x.helped === 'a_little').length;
  const text = !t.length ? 'You haven\'t answered for this one yet.' : `Helped ${helped} of ${t.length} times you answered${aLittle ? ` (a little: ${aLittle} more)` : ''}.`;
  return { answered: t.length, helped, aLittle, no: t.length - helped - aLittle, text };
}

/** Suggestions for today, or null when the pain category is off or today's pain isn't moderate or severe. */
export function comfortSuggestions(s, today) {
  if (!hasConsent(s) || !categoryOn(s, 'pain')) return null;
  const pain = s.days[today]?.pain;
  if (!CATEGORIES.pain.notable.includes(pain)) return null;
  const ids = Object.keys(COMFORT_OPTIONS);
  const options = ids.map((id, i) => ({ id, ...COMFORT_OPTIONS[id], own: ownRecord(s, id), order: i }));
  const group = o => (o.own.helped + o.own.aLittle > 0 ? 0 : o.own.answered === 0 ? 1 : 2);
  const share = o => (o.own.answered ? (o.own.helped * 2 + o.own.aLittle) / (o.own.answered * 2) : 0);
  options.sort((a, b) => group(a) - group(b) || share(b) - share(a) || a.order - b.order);
  return { version: COMFORT_VERSION, reviewStatus: REVIEW_STATUS, severe: pain === 'severe', options: options.map(({ order, ...o }) => o), redFlags: RED_FLAGS, note: NOTE };
}

/** She chose to try an option on `date`. */
export function logComfortTry(s, date, option, { today, at = new Date().toISOString() } = {}) {
  requireConsent(s);
  if (!categoryOn(s, 'pain')) throw new CycleError('CATEGORY_OFF');
  if (!isDate(date)) throw new CycleError('INVALID_DATE');
  if (today && date > today) throw new CycleError('FUTURE_DATE');
  if (!(option in COMFORT_OPTIONS)) throw new CycleError('INVALID_INPUT');
  const t = { id: newId(), date, option, at, helped: null, answeredAt: null };
  tries(s).push(t);
  return t;
}

/** Her answer: yes / a little / no. */
export function answerComfort(s, id, helped, { at = new Date().toISOString() } = {}) {
  requireConsent(s);
  if (!(helped in ANSWERS)) throw new CycleError('INVALID_INPUT');
  const t = tries(s).find(x => x.id === id); if (!t) throw new CycleError('NOT_FOUND');
  t.helped = helped; t.answeredAt = at;
  return t;
}

/** Tries from the last ASK_DAYS days without an answer. Older ones stay unanswered: never assumed either way. */
export function pendingComfortQuestions(s, today) {
  const from = addDays(today, -(ASK_DAYS - 1));
  return readTries(s).filter(t => t.helped == null && t.date >= from && t.date <= today).map(t => ({ ...t, label: COMFORT_OPTIONS[t.option].label }));
}

/** Delete every comfort record. */
export function deleteComfort(s) { s.comfort = { tries: [] }; return s; }
