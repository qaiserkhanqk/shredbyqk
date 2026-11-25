// Pregnancy and postpartum modes (flag pregnancyMode, default OFF).
// She tells the app she is pregnant; the app never detects, suggests or tests for a pregnancy.
// Every fact shown comes from a published source (docs/pregnancy-postpartum-evidence.md, SOURCES below); the wording is
// our own, plain enough for teenagers, and is a placeholder awaiting clinician review. No diagnosis, no treatment
// advice, no contraception advice beyond "talk to your midwife or doctor".
// Numbers used, all from the sources: due date = first day of last period + 280 days (ACOG CO 700); trimesters
// 1st to 13+6, 2nd 14+0 to 27+6, 3rd from 28+0 (ACOG); term from 37+0, postterm from 42+0 (ACOG CO 579); postpartum
// contact within 3 weeks and a full check by 12 weeks (ACOG CO 736); baby blues in the first 2 weeks (NICE CG192),
// about 4 in 10 women (Rezaie-Keikhaie 2020); first ovulation in non-breastfeeding women on average 45-94 days after
// birth (Jackson & Glasier 2011). Input limits (a due date up to 44 weeks ahead) are data-entry safeguards.
import { isDate, addDays, diffDays, human } from './dates.js';
import { CycleError, hasConsent, setSituation, eraseSituation, CATEGORIES } from './model.js';

export const PREGNANCY_VERSION = 'pregnancy-0.1.0';
export const REVIEW_STATUS = 'awaiting_clinician_review';
export const PREGNANCY_DAYS = 280;
const MAX_AHEAD = 44 * 7, MAX_PAST = 6 * 7; // data-entry safeguards, not clinical limits

export const SOURCES = {
  acogDueDate: { title: 'ACOG Committee Opinion No. 700: Methods for Estimating the Due Date (2017)', doi: '10.1097/AOG.0000000000002046' },
  acogTerm: { title: 'ACOG Committee Opinion No. 579: Definition of Term Pregnancy (2013)', doi: '10.1097/01.AOG.0000437385.88715.4a' },
  acogPostpartum: { title: 'ACOG Committee Opinion No. 736: Optimizing Postpartum Care (2018)', doi: '10.1097/AOG.0000000000002633' },
  returnOfPeriods: { title: 'Jackson & Glasier. Return of ovulation and menses in postpartum nonlactating women: a systematic review. Obstet Gynecol 2011', doi: '10.1097/AOG.0b013e31820ce18c' },
  babyBlues: { title: 'Rezaie-Keikhaie et al. Prevalence of the maternity blues: systematic review and meta-analysis. JOGNN 2020', doi: '10.1016/j.jogn.2020.01.001' },
  niceMentalHealth: { title: 'NICE CG192: Antenatal and postnatal mental health', url: 'https://www.nice.org.uk/guidance/cg192' },
  cdcWarningSigns: { title: 'CDC Hear Her: urgent maternal warning signs', url: 'https://www.cdc.gov/hearher/maternal-warning-signs/index.html' },
};

export const WARNING_INTRO = 'Get medical help now if you have any of these. Call your maternity unit, midwife or doctor, or emergency services (999 in the UK, 911 in the US). Don\'t wait for your next appointment.';
const COMMON_SIGNS = [
  'A headache that won\'t go away or gets worse',
  'Dizziness or fainting',
  'Changes in your vision, such as blurring or flashing lights',
  'A fever of 38°C (100.4°F) or higher',
  'Sudden or severe swelling of your face or hands',
  'Trouble breathing, chest pain, or a racing heart',
  'Severe belly pain that doesn\'t go away',
  'Swelling, redness or pain in one leg',
  'Thoughts of harming yourself or your baby',
  'Feeling so tired you can\'t cope',
];
export const PREGNANCY_WARNING_SIGNS = [
  'Your baby moving less than usual, or stopping moving: call now, don\'t wait until tomorrow',
  'Any bleeding from your vagina',
  'Fluid leaking from your vagina',
  'Being sick so much you can\'t keep anything down',
  ...COMMON_SIGNS,
];
export const POSTPARTUM_WARNING_SIGNS = [
  'Heavy bleeding: soaking a pad in an hour or less, or passing large clots',
  'Discharge from your vagina that smells bad',
  ...COMMON_SIGNS,
];

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const weeksDays = days => { const w = Math.floor(days / 7), d = days % 7; return w ? (d ? `${plural(w, 'week')} and ${plural(d, 'day')}` : plural(w, 'week')) : plural(d, 'day'); };
const need = s => { if (!hasConsent(s)) throw new CycleError('NO_CONSENT'); };

export const dueDateFromLmp = lmp => addDays(lmp, PREGNANCY_DAYS);

function checkDue(dueDate, today) {
  if (!isDate(dueDate)) throw new CycleError('INVALID_DATE');
  if (dueDate > addDays(today, MAX_AHEAD) || dueDate < addDays(today, -MAX_PAST)) throw new CycleError('OUT_OF_RANGE');
}

/** She tells the app she is pregnant. One of: dueDate (from her midwife or doctor: preferred) or lmp. */
export function startPregnancy(s, { dueDate, lmp, today, at = new Date().toISOString() } = {}) {
  need(s);
  if (!isDate(today)) throw new CycleError('INVALID_DATE');
  let source = 'clinician';
  if (!dueDate) {
    if (!lmp) throw new CycleError('INVALID_INPUT');
    if (!isDate(lmp)) throw new CycleError('INVALID_DATE');
    if (lmp > today) throw new CycleError('FUTURE_DATE');
    dueDate = dueDateFromLmp(lmp); source = 'lmp';
  }
  checkDue(dueDate, today);
  s.pregnancy = { dueDate, dueSource: source, lmp: source === 'lmp' ? lmp : null, startedAt: at };
  s.postpartum = null;
  setSituation(s, 'postpartum', false, { at });
  setSituation(s, 'pregnant', true, { at });
  if (s.companion) delete s.companion.quietSince;
  return s;
}

/** A new due date from her midwife or doctor (for example after a dating scan). */
export function setDueDate(s, dueDate, { today, at = new Date().toISOString() } = {}) {
  need(s);
  if (!s.pregnancy) throw new CycleError('INVALID_INPUT');
  checkDue(dueDate, today);
  Object.assign(s.pregnancy, { dueDate, dueSource: 'clinician', updatedAt: at });
  return s;
}

/** Today in pregnancy, or null. */
export function pregnancyToday(s, today) {
  if (!hasConsent(s) || !s.situation?.pregnant || !s.pregnancy?.dueDate) return null;
  const p = s.pregnancy, ga = PREGNANCY_DAYS - diffDays(today, p.dueDate);
  if (ga < 0) return null;
  const week = Math.floor(ga / 7), day = ga % 7, trimester = week < 14 ? 1 : week < 28 ? 2 : 3;
  const stageNote = week >= 42 ? 'You\'re 42 weeks or more. If you haven\'t already, talk to your midwife or doctor today.'
    : week >= 37 ? 'From 37 weeks, babies are considered term (ACOG). Keep your planned appointments, and call your maternity unit if anything worries you.' : null;
  return {
    version: PREGNANCY_VERSION, reviewStatus: REVIEW_STATUS, week, day, gestationalDays: ga, trimester,
    weeksText: weeksDays(ga), dueDate: p.dueDate, dueSource: p.dueSource, daysToDue: diffDays(today, p.dueDate),
    dueNote: `${p.dueSource === 'lmp' ? 'Calculated as 280 days after the first day of your last period. ' : 'The date from your midwife or doctor. '}Your due date is an estimate: most babies arrive in the weeks around it, not on the day. If you've had a dating scan, the date from your scan comes first (ACOG).`,
    stageNote, warningIntro: WARNING_INTRO, warningSigns: PREGNANCY_WARNING_SIGNS,
    sources: [SOURCES.acogDueDate, SOURCES.acogTerm, SOURCES.cdcWarningSigns],
  };
}

/** Alerts for what she logged today in pregnancy. */
export function pregnancyAlerts(s, values = {}) {
  const out = [];
  if (values.swelling === 'severe') out.push({ level: 'urgent', text: 'Sudden or severe swelling of your face or hands needs checking now. Call your maternity unit, midwife or doctor.' });
  if (values.nausea === 'severe') out.push({ level: 'soon', text: 'If you can\'t keep food or drink down, call your midwife or doctor today.' });
  return out;
}

/** The pregnancy ends. outcome: 'birth' (postpartum mode starts) or 'ended' (she is not asked why). */
export function endPregnancy(s, { outcome, date, today, at = new Date().toISOString() } = {}) {
  need(s);
  if (!s.pregnancy || !['birth', 'ended'].includes(outcome)) throw new CycleError('INVALID_INPUT');
  if (!isDate(date)) throw new CycleError('INVALID_DATE');
  if (today && date > today) throw new CycleError('FUTURE_DATE');
  if (date < addDays(s.pregnancy.dueDate, -PREGNANCY_DAYS)) throw new CycleError('OUT_OF_RANGE');
  (s.pregnancies ||= []).push({ ...s.pregnancy, endDate: date, outcome, endedAt: at });
  s.pregnancy = null;
  setSituation(s, 'pregnant', false, { at });
  if (outcome === 'birth') {
    s.postpartum = { birthDate: date };
    setSituation(s, 'postpartum', true, { at });
    return { message: 'Postpartum mode is on. It covers your recovery, your mood and when your periods come back. Take care of yourself.' };
  }
  (s.companion ||= {}).quietSince = date;
  return { message: 'We\'re so sorry. Pregnancy mode is off. If you\'d like support, your midwife or doctor can help, as can a pregnancy loss support charity, or someone you trust you can talk to. Your period estimates will start again from your next period. Zara\'s check-ins are paused until then. You can delete your pregnancy records in settings at any time.' };
}

/** Postpartum mode without pregnancy mode first (she had her baby before using the app). */
export function startPostpartum(s, { birthDate, today, at = new Date().toISOString() } = {}) {
  need(s);
  if (!isDate(birthDate)) throw new CycleError('INVALID_DATE');
  if (birthDate > today) throw new CycleError('FUTURE_DATE');
  if (birthDate < addDays(today, -730)) throw new CycleError('OUT_OF_RANGE'); // a data-entry safeguard
  (s.pregnancies ||= []).push({ dueDate: null, dueSource: null, endDate: birthDate, outcome: 'birth', endedAt: at });
  s.pregnancy = null; s.postpartum = { birthDate };
  setSituation(s, 'pregnant', false, { at }); setSituation(s, 'postpartum', true, { at });
  return s;
}

/** Today after birth, or null. */
export function postpartumToday(s, today) {
  if (!hasConsent(s) || !s.situation?.postpartum || !s.postpartum?.birthDate) return null;
  const n = diffDays(s.postpartum.birthDate, today);
  if (n < 0) return null;
  const firstPeriod = s.periods.map(p => p.start).filter(d => d > s.postpartum.birthDate && d <= today).sort()[0] || null;
  return {
    version: PREGNANCY_VERSION, reviewStatus: REVIEW_STATUS, birthDate: s.postpartum.birthDate, daysSinceBirth: n, weeksText: weeksDays(n),
    bleedingNote: 'Bleeding after birth is not a period. It is usually heaviest in the first days and settles over about 6 weeks. Log it under "Bleeding after birth", not as a period.',
    moodNote: 'Feeling low, tearful or anxious in the first 2 weeks after birth (the "baby blues") is common: about 4 in 10 women in one review. If it lasts longer than 2 weeks, or you feel very low at any time, talk to your midwife, health visitor or doctor.',
    checkNote: 'ACOG recommends contact with your midwife or doctor within the first 3 weeks after birth, and a full check no later than 12 weeks. (In the UK the check is usually at 6 to 8 weeks.)',
    periodsNote: firstPeriod
      ? `You logged your first period since the birth on ${human(firstPeriod)}. Estimates use only your cycles since the birth, so they start again from here.`
      : 'Your periods may take weeks or months to come back, often longer if you breastfeed. You can get pregnant before your first period returns. If you want to avoid that, talk to your midwife or doctor about contraception.',
    yearNote: n >= 365 ? 'It\'s been a year since the birth. You can turn off postpartum mode whenever you like.' : null,
    warningIntro: WARNING_INTRO, warningSigns: POSTPARTUM_WARNING_SIGNS,
    sources: [SOURCES.acogPostpartum, SOURCES.babyBlues, SOURCES.niceMentalHealth, SOURCES.returnOfPeriods, SOURCES.cdcWarningSigns],
  };
}

/** Alerts for what she logged today after birth. */
export function postpartumAlerts(s, values = {}) {
  const out = [];
  if (values.afterBirthBleeding === 'heavy') out.push({ level: 'urgent', text: 'Heavy bleeding after birth can be serious. If you are soaking a pad in an hour or less, or passing large clots, call your maternity unit or emergency services now.' });
  if (values.healingPain === 'severe') out.push({ level: 'soon', text: 'Severe or worsening pain where you are healing, especially with a fever or a bad smell, should be checked today. Call your midwife or doctor.' });
  return out;
}

/** She ends postpartum mode. The birth stays in her history, so estimates still use only later cycles. */
export function finishPostpartum(s, { at = new Date().toISOString() } = {}) {
  need(s); s.postpartum = null; setSituation(s, 'postpartum', false, { at }); return s;
}

/** Deletes every pregnancy and postpartum record, including the symptoms in those groups. */
export function deletePregnancyRecords(s) {
  need(s);
  s.pregnancy = null; s.pregnancies = []; s.postpartum = null;
  eraseSituation(s, 'pregnant'); eraseSituation(s, 'postpartum');
  const keys = Object.entries(CATEGORIES).filter(([, c]) => c.group === 'pregnancy' || c.group === 'postpartum').map(([k]) => k);
  for (const [d, day] of Object.entries(s.days)) {
    for (const k of keys) { delete day[k]; if (day.src) delete day.src[k]; if (day.rec) delete day.rec[k]; if (day.hist) delete day.hist[k]; }
    if (!Object.keys(day).some(k => !['src', 'rec', 'hist'].includes(k))) delete s.days[d];
  }
  for (const k of keys) delete s.consent.categories[k];
  if (s.companion) delete s.companion.quietSince;
  return s;
}
