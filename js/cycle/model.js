// Cycle data model: pure functions over one user's state object. No storage, no DOM. The encrypted
// repository (store.js) persists the result.
//
// Principles enforced here:
//  • A period exists only because the user logged or confirmed it. Nothing is inferred from a watch.
//  • Spotting is logged as a day, separate from periods. It never starts a cycle.
//  • A day with no entry is UNKNOWN. It is never read as "no bleeding".
//  • Nothing can be written before core consent. Symptom categories are opt-in one by one.
//  • Errors carry a code only, never the data that caused them, so error logs stay free of health data.
import { isDate, addDays, diffDays } from './dates.js';

export const CONSENT_VERSION = 'cycle-prototype-2026-11';
export const SCHEMA = 1;

/** Symptom categories. All off by default; each has a plain explanation shown before it is turned on. */
export const CATEGORIES = {
  pain: { label: 'Pain', why: 'Cramps or other pain, so you can look back at when it happened.', options: [['none', 'None'], ['mild', 'Mild'], ['moderate', 'Moderate'], ['severe', 'Severe']], notable: ['moderate', 'severe'], notableLabel: 'moderate or severe pain' },
  energy: { label: 'Energy', why: 'How your energy felt compared with your usual.', options: [['low', 'Lower than usual'], ['usual', 'Usual'], ['high', 'Higher than usual']], notable: ['low'], notableLabel: 'lower energy' },
  mood: { label: 'Mood', why: 'A word for your mood, only if you want to track it. Nothing is inferred from sensors.', options: [['good', 'Good'], ['okay', 'Okay'], ['low', 'Low'], ['anxious', 'Anxious'], ['irritable', 'Irritable']], notable: ['low', 'anxious', 'irritable'], notableLabel: 'low, anxious or irritable mood' },
  cravings: { label: 'Cravings', why: 'Food cravings, if you notice them.', options: [['none', 'None'], ['some', 'Some'], ['strong', 'Strong']], notable: ['strong'], notableLabel: 'strong cravings' },
  sleep: { label: 'Sleep', why: 'How you felt you slept. This is your rating, not a sensor reading.', options: [['poor', 'Poor'], ['ok', 'OK'], ['good', 'Good']], notable: ['poor'], notableLabel: 'poor sleep' },
};
export const BLEEDING = ['period', 'spotting', 'none'];

/** Situations in which dates-based phase information is not shown, and estimates carry a caveat. */
export const SITUATIONS = {
  hormonalContraception: { label: 'Using hormonal contraception', note: 'Bleeds on hormonal contraception are usually withdrawal bleeds, not a natural cycle. Estimates describe your logged bleeding pattern only.' },
  pregnant: { label: 'Pregnant', note: 'Estimates and period reminders are paused.' },
  postpartum: { label: 'Recently gave birth or breastfeeding', note: 'Cycles often change after birth and while breastfeeding, so estimates may be less reliable.' },
  perimenopause: { label: 'Perimenopause or menopause', note: 'Cycles often become more variable, so estimates may be less reliable.' },
  other: { label: 'Another condition or medicine that affects my cycle', note: 'Estimates may be less reliable.' },
};

export class CycleError extends Error {
  constructor(code) { super(`cycle:${code}`); this.code = code; }
}

export const blankState = owner => ({
  schema: SCHEMA, owner,
  consent: { version: null, core: null, categories: {}, wearable: null, reminders: null, log: [] },
  periods: [],           // [{id, start, end|null, missedBefore, createdAt, updatedAt}]
  days: {},              // {'YYYY-MM-DD': {bleeding?, pain?, energy?, mood?, cravings?, sleep?, unwell?, travel?}}
  situation: {},         // keys of SITUATIONS → true
  settings: { lockScreenDetail: false, quietHours: { start: '22:00', end: '07:00' }, remindersPausedUntil: null },
  reminders: [],
  delivered: {},         // reminderId → last date it was shown
  dismissed: {},         // insight key → date dismissed
  promptsDismissed: {},  // confirmation prompt key → date
  wearable: { devices: [], nights: [] }, // nightly summaries only; raw samples are not kept
});

let seq = 0;
const newId = () => `${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* ---------- Consent ---------- */
const stamp = (s, change, at) => { s.consent.log.push({ at, change }); };
export function giveConsent(s, at = new Date().toISOString()) {
  s.consent.version = CONSENT_VERSION; s.consent.core = at; stamp(s, 'core:given', at); return s;
}
export const hasConsent = s => !!s.consent.core && s.consent.version === CONSENT_VERSION;
function requireConsent(s) { if (!hasConsent(s)) throw new CycleError('NO_CONSENT'); }

/** Turn a symptom category on or off. Turning it off stops collection; pass purge to delete past entries. */
export function setCategory(s, cat, on, { purge = false, at = new Date().toISOString() } = {}) {
  requireConsent(s);
  if (!(cat in CATEGORIES)) throw new CycleError('INVALID_INPUT');
  if (on) s.consent.categories[cat] = at; else delete s.consent.categories[cat];
  stamp(s, `category:${cat}:${on ? 'on' : 'off'}${purge ? ':purged' : ''}`, at);
  if (!on && purge) for (const d of Object.values(s.days)) delete d[cat];
  pruneDays(s);
  return s;
}
export const categoryOn = (s, cat) => !!s.consent.categories[cat];

export function setScopeConsent(s, scope, on, at = new Date().toISOString()) {
  requireConsent(s);
  if (!['wearable', 'reminders'].includes(scope)) throw new CycleError('INVALID_INPUT');
  s.consent[scope] = on ? at : null; stamp(s, `${scope}:${on ? 'on' : 'off'}`, at);
  if (!on && scope === 'wearable') s.wearable = { devices: [], nights: [] }; // withdrawing deletes the data
  if (!on && scope === 'reminders') { s.reminders = []; s.delivered = {}; }
  return s;
}

/* ---------- Periods ---------- */
const sorted = s => [...s.periods].sort((a, b) => a.start.localeCompare(b.start));
function checkPeriod(s, start, end, ignoreId, todayStr) {
  if (!isDate(start) || (end != null && !isDate(end))) throw new CycleError('INVALID_DATE');
  if (todayStr && start > todayStr) throw new CycleError('FUTURE_DATE');
  if (end != null && end < start) throw new CycleError('END_BEFORE_START');
  if (todayStr && end != null && end > todayStr) throw new CycleError('FUTURE_DATE');
  const e = end ?? start;
  for (const p of s.periods) {
    if (p.id === ignoreId) continue;
    const pe = p.end ?? p.start;
    if (start <= pe && e >= p.start) throw new CycleError('OVERLAP');
  }
}

/** Log the first day of a period (a confirmed start). */
/** Where an entry came from. Every stored value is something the user typed or confirmed; predictions are never stored. */
export const SOURCES = ['typed', 'suggestion', 'range_prompt', 'sensor_prompt'];
const src = v => (SOURCES.includes(v) ? v : 'typed');

export function logPeriodStart(s, start, { today: t, at = new Date().toISOString(), source } = {}) {
  requireConsent(s); checkPeriod(s, start, null, null, t);
  // An earlier period with no end stays without an end: we never invent an end date. The user can add it.
  const p = { id: newId(), start, end: null, missedBefore: false, source: src(source), createdAt: at, updatedAt: at };
  s.periods.push(p); s.periods = sorted(s);
  if (s.days[start]?.bleeding) { delete s.days[start].bleeding; pruneDays(s); } // the period record now covers that day
  return p;
}
export function logPeriodEnd(s, id, end, { today: t, at = new Date().toISOString() } = {}) {
  requireConsent(s);
  const p = s.periods.find(x => x.id === id); if (!p) throw new CycleError('NOT_FOUND');
  checkPeriod(s, p.start, end, id, t); p.end = end; p.updatedAt = at; return p;
}
/** Edit (correct) a period. Corrections replace the old values; nothing is kept from the wrong entry. */
export function editPeriod(s, id, { start, end, missedBefore, lengthConfirmed }, { today: t, at = new Date().toISOString() } = {}) {
  requireConsent(s);
  const p = s.periods.find(x => x.id === id); if (!p) throw new CycleError('NOT_FOUND');
  const ns = start ?? p.start, ne = end === undefined ? p.end : end;
  checkPeriod(s, ns, ne, id, t);
  Object.assign(p, { start: ns, end: ne, updatedAt: at });
  if (missedBefore != null) p.missedBefore = !!missedBefore;
  if (lengthConfirmed != null) p.lengthConfirmed = !!lengthConfirmed; // "yes, the gap before this start is right"
  s.periods = sorted(s); return p;
}
export function deletePeriod(s, id) {
  requireConsent(s);
  const n = s.periods.length; s.periods = s.periods.filter(p => p.id !== id);
  if (s.periods.length === n) throw new CycleError('NOT_FOUND');
}

/** The period covering a date, if any. Without a logged end, an older period covers only its start day; the
 *  latest one covers up to `today` for at most 7 days, after which the app asks whether it has ended. */
export function periodOn(s, date, t = date) {
  const latest = sorted(s).at(-1);
  return s.periods.find(p => p.start <= date && date <= (p.end ?? (p === latest ? minDate(t, addDays(p.start, 6)) : p.start)));
}
const minDate = (a, b) => (a < b ? a : b);

/* ---------- Day logs ---------- */
export function logDay(s, date, fields, { today: t, source } = {}) {
  requireConsent(s);
  if (!isDate(date)) throw new CycleError('INVALID_DATE');
  if (t && date > t) throw new CycleError('FUTURE_DATE');
  const d = s.days[date] || {};
  for (const [k, v] of Object.entries(fields)) {
    if (k === 'bleeding') { if (v != null && !BLEEDING.includes(v)) throw new CycleError('INVALID_INPUT'); }
    else if (k === 'unwell' || k === 'travel') { if (v != null && typeof v !== 'boolean') throw new CycleError('INVALID_INPUT'); }
    else if (k in CATEGORIES) {
      if (!categoryOn(s, k)) throw new CycleError('CATEGORY_OFF');
      if (v != null && !CATEGORIES[k].options.some(([o]) => o === v)) throw new CycleError('INVALID_INPUT');
    } else throw new CycleError('INVALID_INPUT');
    if (v == null || v === false) { delete d[k]; if (d.src) delete d.src[k]; }
    else { d[k] = v; if (k in CATEGORIES || k === 'bleeding') (d.src ||= {})[k] = src(source); }
  }
  s.days[date] = d; pruneDays(s); return d;
}
function pruneDays(s) {
  for (const [k, v] of Object.entries(s.days)) {
    if (v.src) { for (const f of Object.keys(v.src)) if (!(f in v)) delete v.src[f]; if (!Object.keys(v.src).length) delete v.src; }
    if (!Object.keys(v).length) delete s.days[k];
  }
}

/* ---------- Confirmation prompts ----------
   The app asks; it never decides. Two prompts:
   1. "Did a period start?" when the user logged period-type bleeding on a day not inside a logged period.
   2. "Has your period ended?" when a period has been open for 8+ days. */
export function pendingPrompts(s, t) {
  const out = [];
  for (const [date, d] of Object.entries(s.days)) {
    if (d.bleeding === 'period' && !periodOn(s, date, t) && !s.promptsDismissed[`start:${date}`]) {
      out.push({ key: `start:${date}`, kind: 'confirmStart', date, text: `You logged bleeding on ${date}. Was that the first day of a period?` });
    }
  }
  const latest = sorted(s).at(-1);
  for (const p of latest ? [latest] : []) {
    const since = diffDays(p.start, t);
    if (p.end == null && since >= 7 && since <= 20 && !s.promptsDismissed[`end:${p.id}`]) out.push({ key: `end:${p.id}`, kind: 'confirmEnd', id: p.id, date: p.start, text: 'Your period has been open for over a week. Has it ended?' });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
export function dismissPrompt(s, key, t) { s.promptsDismissed[key] = t; }

/* ---------- Cycles ----------
   A cycle runs from one confirmed start to the day before the next. Its length is known only when the next
   start exists. Lengths outside 15–90 days are kept but marked "check" (often a typo or a missed log) and
   left out of estimates until the user confirms the entries. Both bounds are display safeguards, not
   clinical limits. */
export const PLAUSIBLE = { min: 15, max: 90 };

export function cycles(s) {
  const ps = sorted(s), out = [];
  for (let i = 0; i + 1 < ps.length; i++) {
    const a = ps[i], b = ps[i + 1], length = diffDays(a.start, b.start);
    let usable = true, reason = null;
    if (b.missedBefore) { usable = false; reason = 'You said you may have missed logging a period in this gap.'; }
    else if (length < PLAUSIBLE.min || length > PLAUSIBLE.max) { usable = !!b.lengthConfirmed; reason = usable ? null : `${length} days is unusual for one cycle. Check the dates, or mark a missed log.`; }
    out.push({ start: a.start, nextStart: b.start, length, periodLength: a.end ? diffDays(a.start, a.end) + 1 : null, usable, reason });
  }
  return out;
}

/** State restricted to what was known before `asOf` (exclusive). Used to prevent future-data leakage. */
export function stateAsOf(s, asOf) {
  const c = JSON.parse(JSON.stringify(s));
  c.periods = c.periods.filter(p => p.start < asOf).map(p => ({ ...p, end: p.end && p.end < asOf ? p.end : null }));
  c.days = Object.fromEntries(Object.entries(c.days).filter(([d]) => d < asOf));
  c.wearable.nights = c.wearable.nights.filter(r => r.night < asOf);
  return c;
}
